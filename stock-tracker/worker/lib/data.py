"""Market-data adapters.

- Universe (top 100 NASDAQ + 100 NYSE) is fetched from NASDAQ's public screener API.
- Intraday bars come from yfinance (15-min delayed, free).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

import pandas as pd
import pytz
import requests
import yfinance as yf

NASDAQ_SCREENER_URL = "https://api.nasdaq.com/api/screener/stocks"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nasdaq.com",
    "Referer": "https://www.nasdaq.com/",
}

ET = pytz.timezone("America/New_York")


# --------------------------------------------------------------------------- #
# Universe
# --------------------------------------------------------------------------- #
def fetch_top_by_market_cap(per_exchange: int = 100) -> list[dict]:
    """Return top-N tickers per exchange (NASDAQ + NYSE) by market cap."""
    params = {
        "tableonly": "true",
        "limit": "10000",
        "exchange": "nasdaq,nyse",
        "marketcap": "mega|large",
    }
    out: list[dict] = []
    for exch in ("nasdaq", "nyse"):
        p = {**params, "exchange": exch}
        r = requests.get(NASDAQ_SCREENER_URL, params=p, headers=HEADERS, timeout=20)
        r.raise_for_status()
        rows = r.json().get("data", {}).get("table", {}).get("rows", []) or []
        cleaned = []
        for row in rows:
            sym = (row.get("symbol") or "").strip().upper()
            mcap_raw = (row.get("marketCap") or "").replace(",", "").strip()
            if not sym or not mcap_raw:
                continue
            # Skip tickers yfinance can't handle (warrants, units, etc.)
            if any(c in sym for c in (".", "^", "/", "=")):
                continue
            try:
                mcap = float(mcap_raw)
            except ValueError:
                continue
            cleaned.append(
                {
                    "symbol": sym,
                    "exchange": exch.upper(),
                    "name": row.get("name") or None,
                    "market_cap": mcap,
                }
            )
        cleaned.sort(key=lambda x: x["market_cap"], reverse=True)
        for i, row in enumerate(cleaned[:per_exchange], start=1):
            row["rank_in_exch"] = i
            out.append(row)
    return out


# --------------------------------------------------------------------------- #
# Intraday bars
# --------------------------------------------------------------------------- #
def fetch_recent_bars(
    symbols: list[str], interval: str = "5m", lookback: str = "1d"
) -> dict[str, pd.DataFrame]:
    """Fetch recent OHLCV for many symbols in one yfinance call.

    Returns {symbol: DataFrame indexed by tz-aware datetime} with columns
    [Open, High, Low, Close, Volume]. yfinance batch-downloads in groups.
    """
    if not symbols:
        return {}

    df = yf.download(
        tickers=symbols,
        period=lookback,
        interval=interval,
        prepost=True,
        progress=False,
        threads=True,
        group_by="ticker",
        auto_adjust=False,
    )
    if df is None or df.empty:
        return {}

    out: dict[str, pd.DataFrame] = {}
    if len(symbols) == 1:
        out[symbols[0]] = df.dropna(how="all")
        return out

    for sym in symbols:
        if sym not in df.columns.get_level_values(0):
            continue
        sub = df[sym].dropna(how="all")
        if not sub.empty:
            out[sym] = sub
    return out


def classify_session(ts: datetime) -> str:
    """ET-based market session classifier (handles DST automatically)."""
    et = ts.astimezone(ET)
    hm = et.hour * 60 + et.minute
    # Pre: 04:00-09:30 / Regular: 09:30-16:00 / After: 16:00-20:00 ET
    if 4 * 60 <= hm < 9 * 60 + 30:
        return "pre"
    if 9 * 60 + 30 <= hm < 16 * 60:
        return "regular"
    if 16 * 60 <= hm < 20 * 60:
        return "after"
    return "regular"  # outside extended hours; should not happen via cron


def to_iso_utc(ts: pd.Timestamp) -> str:
    if ts.tzinfo is None:
        ts = ts.tz_localize(timezone.utc)
    return ts.astimezone(timezone.utc).isoformat()
