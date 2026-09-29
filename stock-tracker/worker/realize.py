"""Daily job: backfill realized_1d/3d/5d on past signals.

For each signal in the DB whose realized_5d is NULL and is at least 7 calendar
days old (so the 5-trading-day horizon has elapsed), pull the daily close at
+1, +3, +5 trading days after the signal and compute the realized return as

    split_adjusted_forward_close / split_adjusted_signal_price - 1

The stored raw signal price is rebased with its NY session's split/raw daily
close ratio. Missing anchor sessions are not guessed. Dividends and trading
costs are excluded. Rows with realized_5d already filled are not repaired.

This is the missing measurement loop. expected_* columns (filled by backtest.py)
are PRIORS — what historically similar signals returned on average. realized_*
is what THIS signal actually did. Without realized_*, we can't compute win rate
or judge whether any signal type has real edge.

Idempotent: rows with realized_5d already set are skipped. Safe to re-run.

Run manually:  cd worker && python realize.py
Cron:          .github/workflows/stock-tracker-backtest.yml (daily after close)
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
from dotenv import load_dotenv

from lib import alpaca, db
from lib.returns import RETURN_CONVENTION, forward_close, split_adjusted_anchor

# Forward horizons in trading days.
HORIZONS: tuple[tuple[str, int], ...] = (
    ("realized_1d", 1),
    ("realized_3d", 3),
    ("realized_5d", 5),
)

# Only attempt rows older than this. 5 trading days ≈ 7 calendar days; we add
# a 2-day buffer for weekends/holidays so the +5d close definitely exists.
MIN_AGE_DAYS = 7

# Cap per run. 200 symbols × ~10 signals per symbol per month is well under
# this; the cap protects us from runaway DB writes if something misbehaves.
MAX_TARGETS_PER_RUN = 2000


def _close_n_trading_days_after(
    daily_df: pd.DataFrame, signal_ts: pd.Timestamp, n_days: int
) -> float | None:
    """Close of the Nth completed NY session strictly after the anchor date."""
    result = forward_close(daily_df, signal_ts, n_days)
    return result[0] if result else None


def main() -> int:
    load_dotenv()
    sb = db.client()

    # Use explicit Z suffix instead of isoformat()'s "+00:00" — the `+` can
    # be misinterpreted as a space along certain URL encoding paths and was
    # silently returning 0 rows from Supabase even though matching rows
    # existed (cost us ~5 days of realized backfills going unprocessed).
    cutoff_iso = (
        datetime.now(timezone.utc) - timedelta(days=MIN_AGE_DAYS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    res = (
        sb.table("signals")
        .select("id,symbol,ts,price,realized_5d")
        .is_("realized_5d", "null")
        .lt("ts", cutoff_iso)
        .order("ts", desc=False)
        .limit(MAX_TARGETS_PER_RUN)
        .execute()
    )
    targets = res.data or []
    print(f"realize: {len(targets)} signals to backfill (age > {MIN_AGE_DAYS}d, realized_5d null)")
    print(f"realize: convention={RETURN_CONVENTION}; dividends/costs excluded; completed legacy rows unchanged")

    if not targets:
        print("realize: nothing to do")
        return 0

    # Group symbols for paired raw/split-adjusted daily-bar fetches.
    by_symbol: dict[str, list[dict]] = {}
    earliest_overall: pd.Timestamp | None = None
    for t in targets:
        by_symbol.setdefault(t["symbol"], []).append(t)
        ts = pd.Timestamp(t["ts"])
        if earliest_overall is None or ts < earliest_overall:
            earliest_overall = ts

    assert earliest_overall is not None
    days_back = max(15, (pd.Timestamp.now(tz="UTC") - earliest_overall).days + 12)
    symbols = list(by_symbol.keys())
    print(
        f"realize: {len(symbols)} unique symbols, fetching {days_back}d of daily bars"
    )

    try:
        raw_frames = alpaca.fetch_recent_bars(symbols, interval="1d", lookback=f"{days_back}d", adjustment="raw")
        frames = alpaca.fetch_recent_bars(symbols, interval="1d", lookback=f"{days_back}d", adjustment="split")
    except Exception as e:
        print(f"realize: daily-bar fetch FAILED — {e}", file=sys.stderr)
        return 1

    updated = 0
    skipped_no_data = 0
    skipped_partial = 0
    skipped_anchor = 0

    for sym, rows in by_symbol.items():
        df = frames.get(sym)
        raw_df = raw_frames.get(sym)
        if df is None or df.empty or raw_df is None or raw_df.empty:
            skipped_no_data += len(rows)
            continue

        for r in rows:
            sig_ts = pd.Timestamp(r["ts"])
            sig_price = split_adjusted_anchor(raw_df, df, sig_ts, r["price"])
            if sig_price is None:
                skipped_anchor += 1
                continue

            updates: dict[str, float | None] = {}
            for col, n in HORIZONS:
                fwd = _close_n_trading_days_after(df, sig_ts, n)
                updates[col] = (fwd - sig_price) / sig_price if fwd is not None else None

            # If even realized_5d is missing, the data isn't ready yet — skip
            # this signal entirely so it gets retried tomorrow. We only want
            # to commit when the longest horizon is filled (otherwise the
            # cutoff filter would never let us back to it).
            if updates["realized_5d"] is None:
                skipped_partial += 1
                continue

            # minimal: don't echo the full row back per update (egress).
            sb.table("signals").update(updates, returning="minimal").eq(
                "id", r["id"]
            ).execute()
            updated += 1

    print(
        f"realize: updated={updated}  skipped_no_data={skipped_no_data}  "
        f"skipped_partial={skipped_partial}  skipped_anchor={skipped_anchor}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
