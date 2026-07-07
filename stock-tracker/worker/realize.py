"""Daily job: backfill realized_1d/3d/5d on past signals.

For each signal in the DB whose realized_5d is NULL and is at least 7 calendar
days old (so the 5-trading-day horizon has elapsed), pull the daily close at
+1, +3, +5 trading days after the signal and compute the realized return as

    (forward_close - signal.price) / signal.price

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
    """Return the close price of the Nth trading day strictly after signal_ts.

    daily_df is indexed by tz-aware UTC timestamps (one bar per trading day).
    We pick bars with index strictly > signal_ts, then take the Nth one.
    Pre-market signals fired at 06:00 ET on day D therefore measure their
    1d return as the close of day D itself; regular-session signals on day D
    measure 1d as day D+1's close. Either way, "1d" = next available
    trading-session close.
    """
    if daily_df.empty:
        return None
    forward = daily_df[daily_df.index > signal_ts]
    if len(forward) < n_days:
        return None
    return float(forward.iloc[n_days - 1]["Close"])


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

    if not targets:
        print("realize: nothing to do")
        return 0

    # Group by symbol so we make one daily-bar fetch per symbol.
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
        frames = alpaca.fetch_recent_bars(symbols, interval="1d", lookback=f"{days_back}d")
    except Exception as e:
        print(f"realize: daily-bar fetch FAILED — {e}", file=sys.stderr)
        return 1

    updated = 0
    skipped_no_data = 0
    skipped_partial = 0

    for sym, rows in by_symbol.items():
        df = frames.get(sym)
        if df is None or df.empty:
            skipped_no_data += len(rows)
            continue

        for r in rows:
            sig_ts = pd.Timestamp(r["ts"])
            sig_price = float(r["price"])
            if sig_price <= 0:
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
        f"skipped_partial={skipped_partial}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
