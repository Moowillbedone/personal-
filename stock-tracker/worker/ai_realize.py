"""Backfill realized_1d/3d/5d/30d on ai_analysis rows.

For each AI analysis old enough to have its forward window completed, look
up the close price 1 / 3 / 5 / 30 trading days after analysis time and
compute the realized return vs context.last_price (the price recorded at
analysis time, stored in the JSONB context).

Rebase that raw price with its NY session's split/raw daily-close ratio before
comparing split-adjusted forward closes. Prefer context.price_as_of for the
quote's session, retaining created_at for the forward horizon. Legacy rows fall
back to their creation date and cannot establish source quote freshness; no
matching session means no return and an earlier session is never guessed.
These are price returns, excluding dividends and trading costs. Already-filled
results retain their previous convention until a separate audited rebuild.

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
from lib.returns import RETURN_CONVENTION, forward_close, split_adjusted_anchor

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
    """Close of the Nth completed NY session strictly after the anchor date."""
    result = forward_close(daily_df, anchor_ts, n_days)
    return result[0] if result else None


def main() -> int:
    load_dotenv()
    sb = db.client()

    # Z suffix avoids the URL-encoding `+ → space` trap seen in realize.py.
    cutoff_iso = (
        datetime.now(timezone.utc) - timedelta(days=MIN_AGE_DAYS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    # Select only the anchor price/timestamp, not the whole context jsonb. Rows
    # waiting on realized_30d sit in this query for ~28 days after their 5d
    # fill, and full context is ~3KB/row — selecting it re-downloaded
    # megabytes of dead weight every run (~4×/day). The ->> path pulls the
    # scalars we actually use.
    res = (
        sb.table("ai_analysis")
        .select(
            "id,symbol,created_at,last_price:context->>last_price,price_as_of:context->>price_as_of,"
            "realized_1d,realized_3d,realized_5d,realized_30d"
        )
        .or_("realized_5d.is.null,realized_30d.is.null")
        .lt("created_at", cutoff_iso)
        .order("created_at", desc=False)
        .limit(MAX_TARGETS_PER_RUN)
        .execute()
    )
    targets = res.data or []
    print(f"ai_realize: {len(targets)} ai_analysis rows to consider")
    print(f"ai_realize: convention={RETURN_CONVENTION}; dividends/costs excluded; legacy results unchanged")

    if not targets:
        print("ai_realize: nothing to do")
        return 0

    # Group symbols for paired raw/split-adjusted daily-bar fetches.
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
        raw_frames = alpaca.fetch_recent_bars(symbols, interval="1d", lookback=f"{days_back}d", adjustment="raw")
        frames = alpaca.fetch_recent_bars(symbols, interval="1d", lookback=f"{days_back}d", adjustment="split")
    except Exception as e:
        print(f"ai_realize: daily-bar fetch FAILED — {e}", file=sys.stderr)
        return 1

    updated = 0
    skipped_no_data = 0
    skipped_no_price = 0
    skipped_anchor = 0
    skipped_no_change = 0

    now_utc = datetime.now(timezone.utc)

    for sym, rows in by_symbol.items():
        df = frames.get(sym)
        raw_df = raw_frames.get(sym)
        if df is None or df.empty or raw_df is None or raw_df.empty:
            skipped_no_data += len(rows)
            continue

        for r in rows:
            ts = pd.Timestamp(r["created_at"])
            base_raw = r.get("last_price")  # aliased from context->>last_price
            if base_raw is None:
                skipped_no_price += 1
                continue
            # New rows preserve the quote timestamp. Do not let a weekend AI
            # request relabel Friday's quote or apply a Monday split twice.
            price_ts = ts
            if r.get("price_as_of") is not None:
                try:
                    price_ts = pd.Timestamp(r["price_as_of"])
                    if pd.isna(price_ts) or price_ts > ts:
                        raise ValueError("invalid or future quote timestamp")
                except (TypeError, ValueError):
                    skipped_anchor += 1
                    continue
            base_price = split_adjusted_anchor(raw_df, df, price_ts, base_raw)
            if base_price is None:
                skipped_anchor += 1
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

            # minimal: ai_analysis rows are ~8KB (context+horizons jsonb) —
            # echoing them back per update was real egress.
            sb.table("ai_analysis").update(updates, returning="minimal").eq(
                "id", r["id"]
            ).execute()
            updated += 1

    print(
        f"ai_realize: updated={updated}  no_data={skipped_no_data}  "
        f"no_price={skipped_no_price}  no_anchor={skipped_anchor}  no_change={skipped_no_change}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
