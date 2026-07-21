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

import os
import sys
import time
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

from lib import alpaca, db

load_dotenv()

SMA_PERIOD = 200
# Fetch generously past the 200-bar minimum so freshly-listed names still
# resolve and there's slack for exchange holidays / thin history.
DAILY_LOOKBACK = "400d"    # ~275 trading days ≥ 200
WEEKLY_LOOKBACK = "1600d"  # ~228 weeks ≥ 200

FINNHUB_KEY = (os.getenv("FINNHUB_API_KEY") or "").strip()
# Per-run cap on Finnhub profile lookups. Sector is fetched only for symbols
# that don't already have one stored (see main), so after the first fill this
# is ~0. Paced under Finnhub's free 60 req/min. Cap protects the job timeout if
# the universe ever balloons.
SECTOR_FETCH_CAP = 260


def fetch_industry(sym: str) -> str | None:
    """finnhubIndustry for one symbol (e.g. 'Semiconductors', 'Banking'), or
    None on any failure / empty. The panel maps this to a Korean label."""
    if not FINNHUB_KEY:
        return None
    url = f"https://finnhub.io/api/v1/stock/profile2?symbol={sym}&token={FINNHUB_KEY}"
    try:
        r = requests.get(url, timeout=15)
        if r.status_code == 429:
            time.sleep(2)
            r = requests.get(url, timeout=15)
        if not r.ok:
            return None
        ind = (r.json() or {}).get("finnhubIndustry")
        return ind.strip() if isinstance(ind, str) and ind.strip() else None
    except Exception:
        return None


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


# Ichimoku Kinko Hyo — standard params (Tenkan 9 / Kijun 26 / SpanB 52 / shift 26).
ICHI_DISP = 26  # 선행 변위(displacement): spans are plotted 26 bars into the future
ICHI_SPANB = 52
ICHI_MIN_BARS = ICHI_SPANB + ICHI_DISP  # 78 — enough to see the cloud AT the latest bar


def _ichimoku_spans(df) -> tuple[float | None, float | None]:
    """(Senkou Span A, Senkou Span B) AS DISPLAYED at the latest bar.

    The cloud drawn under *today's* price was computed ICHI_DISP(26) bars ago and
    projected forward — that projection is exactly what price "touches" now. So we
    take the calc bar = latest − 26 and read the Ichimoku midpoints there:
        Tenkan = (9-high + 9-low)/2, Kijun = (26-high + 26-low)/2,
        Span A = (Tenkan + Kijun)/2, Span B = (52-high + 52-low)/2.
    None when there isn't enough history (< 78 bars) — recent IPOs.
    """
    if df is None or getattr(df, "empty", True):
        return (None, None)
    if "High" not in df.columns or "Low" not in df.columns:
        return (None, None)
    highs, lows = df["High"], df["Low"]
    n = len(df)
    if n < ICHI_MIN_BARS:
        return (None, None)
    calc_end = n - 1 - ICHI_DISP  # inclusive index of the projection's calc bar

    def mid(period: int) -> float | None:
        start = calc_end - period + 1
        if start < 0:
            return None
        hh = float(highs.iloc[start : calc_end + 1].max())
        ll = float(lows.iloc[start : calc_end + 1].min())
        return (hh + ll) / 2.0

    tenkan, kijun, span_b = mid(9), mid(26), mid(ICHI_SPANB)
    span_a = (tenkan + kijun) / 2.0 if (tenkan is not None and kijun is not None) else None
    return (
        round(span_a, 4) if span_a is not None else None,
        round(span_b, 4) if span_b is not None else None,
    )


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
        # Ichimoku Span A/B from the SAME bars (no extra fetch). Needs only 78
        # bars vs 200 for SMA200, so a mid-life listing can have spans but no SMA.
        spana_d, spanb_d = _ichimoku_spans(d)
        spana_w, spanb_w = _ichimoku_spans(w)
        if all(
            v is None for v in (sma_d, sma_w, spanb_d, spanb_w)
        ):
            continue  # not enough history for ANY indicator — skip (recent IPOs)
        last_close = None
        if d is not None and not d.empty:
            last_close = round(float(d["Close"].iloc[-1]), 4)
        rows.append(
            {
                "symbol": sym,
                "sma200_daily": sma_d,
                "sma200_weekly": sma_w,
                "spana_daily": spana_d,
                "spanb_daily": spanb_d,
                "spana_weekly": spana_w,
                "spanb_weekly": spanb_w,
                "last_close": last_close,
                "updated_at": now_iso,
            }
        )

    if not rows:
        print("sma200_scan: nothing to upsert (no symbol had 200 bars)")
        return 0

    # Sector labels (finnhubIndustry). Fetched INCREMENTALLY — only for symbols
    # that don't already have one stored — so after the first fill this is ~0
    # Finnhub calls. Sector rarely changes, so carrying the stored value forward
    # is correct. Paced under the free 60 req/min limit.
    existing_sector: dict[str, str] = {}
    try:
        res = sb.table("sma200").select("symbol, sector").execute()
        existing_sector = {
            r["symbol"]: r["sector"] for r in (res.data or []) if r.get("sector")
        }
    except Exception as e:
        print(f"sma200_scan: existing-sector read failed — {e}", file=sys.stderr)

    to_fetch = [r["symbol"] for r in rows if not existing_sector.get(r["symbol"])]
    fetched_sector: dict[str, str] = {}
    if FINNHUB_KEY and to_fetch:
        capped = to_fetch[:SECTOR_FETCH_CAP]
        print(f"sma200_scan: fetching sector for {len(capped)} new symbols (finnhub)")
        for sym in capped:
            ind = fetch_industry(sym)
            if ind:
                fetched_sector[sym] = ind
            time.sleep(1.1)  # ≤ 55/min, under Finnhub free tier
        if len(to_fetch) > SECTOR_FETCH_CAP:
            print(
                f"sma200_scan: sector fetch capped at {SECTOR_FETCH_CAP}; "
                f"{len(to_fetch) - SECTOR_FETCH_CAP} deferred to next run"
            )
    elif not FINNHUB_KEY:
        print("sma200_scan: FINNHUB_API_KEY not set — sectors skipped", file=sys.stderr)

    for r in rows:
        r["sector"] = fetched_sector.get(r["symbol"]) or existing_sector.get(r["symbol"])

    # Upsert in chunks; returning="minimal" keeps egress flat (no row echo).
    for i in range(0, len(rows), 200):
        sb.table("sma200").upsert(rows[i : i + 200], returning="minimal").execute()

    daily_n = sum(1 for r in rows if r["sma200_daily"] is not None)
    weekly_n = sum(1 for r in rows if r["sma200_weekly"] is not None)
    ichi_d = sum(1 for r in rows if r["spanb_daily"] is not None)
    ichi_w = sum(1 for r in rows if r["spanb_weekly"] is not None)
    sector_n = sum(1 for r in rows if r.get("sector"))
    print(
        f"sma200_scan: upserted {len(rows)} rows "
        f"(sma200 daily={daily_n}/weekly={weekly_n}, "
        f"ichimoku-spanB daily={ichi_d}/weekly={ichi_w}, sector={sector_n})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
