"""SMA200 touch-scanner precompute (2026-07-15).

Computes the 200-period simple moving average on BOTH daily and weekly bars for
the full universe (NASDAQ-100 + NYSE-100 proxy, ~200 symbols) and upserts the
result into public.sma200. The dashboard's /api/sma200 route reads this table
plus a live snapshot per symbol to classify which names sit just ABOVE (매수) or
just BELOW (주의) their 200-day / 200-week line.

Why precompute: SMA200 needs 200+ daily bars — and ~200 weekly bars ≈ 4 years —
per symbol. Doing that for 200 symbols on every dashboard request is exactly the
Alpaca fetch storm we spent the outage fixing. Instead one daily worker job
(after the US close) pulls every symbol's bars in a handful of batched Alpaca
calls and stores ~200 tiny rows. SMA200 barely moves day to day, so once-daily
freshness is plenty.

Run: python sma200_scan.py   (GitHub Actions cron, daily after US close)
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

from lib import alpaca, db

load_dotenv()

SMA_PERIOD = 200
# Fetch generously past the 200-bar minimum so freshly-listed names still
# resolve and there's slack for exchange holidays / thin history.
DAILY_LOOKBACK = "400d"    # ~275 trading days ≥ 200
WEEKLY_LOOKBACK = "1600d"  # ~228 weeks ≥ 200


def _sma(df, period: int) -> float | None:
    """Mean of the last `period` closes, or None when history is too short."""
    if df is None or getattr(df, "empty", True):
        return None
    if "Close" not in df.columns:
        return None
    closes = df["Close"].dropna()
    if len(closes) < period:
        return None
    return round(float(closes.iloc[-period:].mean()), 4)


def main() -> int:
    sb = db.client()
    symbols = db.get_active_symbols(sb)
    if not symbols:
        print("sma200_scan: no active symbols, exiting")
        return 0
    print(f"sma200_scan: computing SMA{SMA_PERIOD} for {len(symbols)} symbols")

    # adjustment="split" is REQUIRED here: a split inside the window (e.g. NVDA
    # 10:1 in 2024, within the 200-week window) would otherwise inject ~10x raw
    # closes and wreck SMA200. "split" rebases history to today's share basis so
    # it's comparable to the raw live price the route compares against.
    daily = alpaca.fetch_recent_bars(
        symbols, interval="1d", lookback=DAILY_LOOKBACK, adjustment="split"
    )
    weekly = alpaca.fetch_recent_bars(
        symbols, interval="1wk", lookback=WEEKLY_LOOKBACK, adjustment="split"
    )
    print(
        f"sma200_scan: bars fetched — daily={len(daily)} weekly={len(weekly)} symbols"
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []
    for sym in symbols:
        d = daily.get(sym)
        w = weekly.get(sym)
        sma_d = _sma(d, SMA_PERIOD)
        sma_w = _sma(w, SMA_PERIOD)
        if sma_d is None and sma_w is None:
            continue  # not enough history either way — skip (recent IPOs)
        last_close = None
        if d is not None and not d.empty:
            last_close = round(float(d["Close"].iloc[-1]), 4)
        rows.append(
            {
                "symbol": sym,
                "sma200_daily": sma_d,
                "sma200_weekly": sma_w,
                "last_close": last_close,
                "updated_at": now_iso,
            }
        )

    if not rows:
        print("sma200_scan: nothing to upsert (no symbol had 200 bars)")
        return 0

    # Upsert in chunks; returning="minimal" keeps egress flat (no row echo).
    for i in range(0, len(rows), 200):
        sb.table("sma200").upsert(rows[i : i + 200], returning="minimal").execute()

    daily_n = sum(1 for r in rows if r["sma200_daily"] is not None)
    weekly_n = sum(1 for r in rows if r["sma200_weekly"] is not None)
    print(
        f"sma200_scan: upserted {len(rows)} rows (daily={daily_n}, weekly={weekly_n})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
