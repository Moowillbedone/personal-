"""Backfill realized_1d/3d/5d/30d on ai_analysis rows.

For each AI analysis old enough to have its forward window completed, look
up the close price 1 / 3 / 5 / 30 trading days after analysis time and
compute the realized return vs context.last_price (the price recorded at
analysis time, stored in the JSONB context).

Why: this closes the AI accuracy loop. /api/analyze and worker/ai_scan.py
output BUY/SELL/HOLD verdicts; without this worker, /stats has no way to
report "AI BUY → 1d avg +0.6% vs HOLD → +0.1%" or to calibrate confidence.

Idempotent: per-row, only computes columns that are still NULL and whose
horizon has elapsed. Safe to re-run any time. Chained after backtest.py
+ realize.py in stock-tracker-backtest.yml.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
from dotenv import load_dotenv

from lib import alpaca, db

# (column, trading_days_forward, min_calendar_age_to_attempt)
HORIZONS: tuple[tuple[str, int, int], ...] = (
    ("realized_1d", 1, 2),
    ("realized_3d", 3, 5),
    ("realized_5d", 5, 7),
    ("realized_30d", 30, 35),
)

# Anchor age: any row with realized_5d still NULL after 7 days needs work
# OR any row with realized_30d still NULL (regardless of 5d state). The
# query OR-filters both conditions; per-row logic decides what to compute.
MIN_AGE_DAYS = 7
MAX_TARGETS_PER_RUN = 2000


def _close_n_trading_days_after(
    daily_df: pd.DataFrame, anchor_ts: pd.Timestamp, n_days: int
) -> float | None:
    """Close of the Nth trading day STRICTLY after anchor_ts (or None if not yet)."""
    if daily_df.empty:
        return None
    forward = daily_df[daily_df.index > anchor_ts]
    if len(forward) < n_days:
        return None
    return float(forward.iloc[n_days - 1]["Close"])


def main() -> int:
    load_dotenv()
    sb = db.client()

    cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=MIN_AGE_DAYS)).isoformat()
    res = (
        sb.table("ai_analysis")
        .select(
            "id,symbol,created_at,context,realized_1d,realized_3d,realized_5d,realized_30d"
        )
        .or_("realized_5d.is.null,realized_30d.is.null")
        .lt("created_at", cutoff_iso)
        .order("created_at", desc=False)
        .limit(MAX_TARGETS_PER_RUN)
        .execute()
    )
    targets = res.data or []
    print(f"ai_realize: {len(targets)} ai_analysis rows to consider")

    if not targets:
        print("ai_realize: nothing to do")
        return 0

    # Group by symbol so we make one daily-bar fetch per symbol.
    by_symbol: dict[str, list[dict]] = {}
    earliest: pd.Timestamp | None = None
    for t in targets:
        sym = t["symbol"]
        by_symbol.setdefault(sym, []).append(t)
        ts = pd.Timestamp(t["created_at"])
        if earliest is None or ts < earliest:
            earliest = ts

    assert earliest is not None
    # Need bars from `earliest` forward to today. For 30d horizon we need
    # at least +35 calendar days from the row's ts; +5 buffer covers
    # weekends/holidays for daily-bar density.
    days_back = max(40, (pd.Timestamp.now(tz="UTC") - earliest).days + 5)
    symbols = list(by_symbol.keys())
    print(f"ai_realize: {len(symbols)} unique symbols, fetching {days_back}d daily bars")

    try:
        frames = alpaca.fetch_recent_bars(symbols, interval="1d", lookback=f"{days_back}d")
    except Exception as e:
        print(f"ai_realize: daily-bar fetch FAILED — {e}", file=sys.stderr)
        return 1

    updated = 0
    skipped_no_data = 0
    skipped_no_price = 0
    skipped_no_change = 0

    now_utc = datetime.now(timezone.utc)

    for sym, rows in by_symbol.items():
        df = frames.get(sym)
        if df is None or df.empty:
            skipped_no_data += len(rows)
            continue

        for r in rows:
            ts = pd.Timestamp(r["created_at"])
            ctx = r.get("context") or {}
            base_raw = ctx.get("last_price")
            if base_raw is None:
                skipped_no_price += 1
                continue
            try:
                base_price = float(base_raw)
            except (TypeError, ValueError):
                skipped_no_price += 1
                continue
            if base_price <= 0:
                skipped_no_price += 1
                continue

            age_days = (now_utc - ts.to_pydatetime()).days
            updates: dict[str, float] = {}

            for col, n_days, min_age in HORIZONS:
                # Already filled — leave it (idempotency)
                if r.get(col) is not None:
                    continue
                # Horizon hasn't elapsed yet — try again on a later run
                if age_days < min_age:
                    continue
                fwd = _close_n_trading_days_after(df, ts, n_days)
                if fwd is None:
                    continue
                updates[col] = (fwd - base_price) / base_price

            if not updates:
                skipped_no_change += 1
                continue

            sb.table("ai_analysis").update(updates).eq("id", r["id"]).execute()
            updated += 1

    print(
        f"ai_realize: updated={updated}  no_data={skipped_no_data}  "
        f"no_price={skipped_no_price}  no_change={skipped_no_change}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
