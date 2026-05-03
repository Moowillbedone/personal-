"""Alpaca Markets data adapter (free IEX feed, real-time).

Drop-in replacement for the yfinance-based fetcher. Returns DataFrames with the
same Open/High/Low/Close/Volume columns and a tz-aware DatetimeIndex so the
existing signal detector and DB-row builder keep working unchanged.

Auth via ALPACA_KEY_ID / ALPACA_SECRET env vars.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Iterable

import pandas as pd
import requests

BASE = "https://data.alpaca.markets/v2"
FEED = os.getenv("ALPACA_FEED", "iex")  # 'iex' (free) or 'sip' (paid)
BATCH_SYMBOLS = 100  # Alpaca multi-symbol query supports up to ~100 per call


def _headers() -> dict:
    key = os.environ.get("ALPACA_KEY_ID")
    sec = os.environ.get("ALPACA_SECRET")
    if not key or not sec:
        raise RuntimeError("ALPACA_KEY_ID / ALPACA_SECRET not set")
    return {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": sec,
        "accept": "application/json",
    }


def _to_dataframe(bars: list[dict]) -> pd.DataFrame:
    """Convert Alpaca bar dicts to OHLCV DataFrame indexed by tz-aware datetime."""
    if not bars:
        return pd.DataFrame()
    rows = []
    idx = []
    for b in bars:
        ts = pd.to_datetime(b["t"], utc=True)
        rows.append(
            {
                "Open": float(b["o"]),
                "High": float(b["h"]),
                "Low": float(b["l"]),
                "Close": float(b["c"]),
                "Volume": int(b["v"]),
            }
        )
        idx.append(ts)
    df = pd.DataFrame(rows, index=pd.DatetimeIndex(idx, name="ts"))
    df.sort_index(inplace=True)
    return df


def fetch_recent_bars(
    symbols: list[str], interval: str = "5m", lookback: str = "5d"
) -> dict[str, pd.DataFrame]:
    """Fetch recent OHLCV bars for many symbols (drop-in for yfinance fetcher).

    interval: '1m' | '5m' | '15m' | '1h' | '1d' (mapped to Alpaca timeframes)
    lookback: like '1d', '5d', '60d' (parsed as integer days)
    """
    if not symbols:
        return {}

    tf_map = {"1m": "1Min", "5m": "5Min", "15m": "15Min", "1h": "1Hour", "1d": "1Day"}
    tf = tf_map.get(interval, "5Min")

    days = int("".join(c for c in lookback if c.isdigit()) or "5")
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    out: dict[str, pd.DataFrame] = {sym: [] for sym in symbols}  # type: ignore[assignment]

    for i in range(0, len(symbols), BATCH_SYMBOLS):
        batch = symbols[i : i + BATCH_SYMBOLS]
        page_token: str | None = None
        while True:
            params = {
                "symbols": ",".join(batch),
                "timeframe": tf,
                "start": start.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "end": end.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "limit": 10000,
                "feed": FEED,
                "adjustment": "raw",
            }
            if page_token:
                params["page_token"] = page_token

            r = requests.get(f"{BASE}/stocks/bars", headers=_headers(), params=params, timeout=30)
            if r.status_code == 429:
                # Rate-limited; brief backoff then retry once.
                import time as _t
                _t.sleep(2)
                r = requests.get(f"{BASE}/stocks/bars", headers=_headers(), params=params, timeout=30)
            r.raise_for_status()
            data = r.json()

            for sym, bars in (data.get("bars") or {}).items():
                if not isinstance(out.get(sym), list):
                    out[sym] = []  # type: ignore[assignment]
                out[sym].extend(bars)  # type: ignore[union-attr]

            page_token = data.get("next_page_token")
            if not page_token:
                break

    return {sym: _to_dataframe(bars) for sym, bars in out.items() if bars}  # type: ignore[arg-type]
