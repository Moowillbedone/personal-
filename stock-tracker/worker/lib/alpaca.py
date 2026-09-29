"""Alpaca historical bars with explicit feed and availability boundaries.

Default: SIP consolidated bars ending 16 minutes ago (free historical access).
ALPACA_FEED=iex requests the single-exchange feed explicitly. Never infer feed
coverage from a successful response or from an omitted query parameter.
Source: https://docs.alpaca.markets/us/docs/market-data-faq
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Iterable

import pandas as pd
import requests

BASE = "https://data.alpaca.markets/v2"
FEED = os.getenv("ALPACA_FEED", "sip").strip().lower() or "sip"
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
    symbols: list[str],
    interval: str = "5m",
    lookback: str = "5d",
    adjustment: str = "raw",
) -> dict[str, pd.DataFrame]:
    """Fetch recent OHLCV bars for many symbols (drop-in for yfinance fetcher).

    interval: '1m' | '5m' | '15m' | '1h' | '1d' | '1wk' (mapped to Alpaca tf)
    lookback: like '1d', '5d', '60d' (parsed as integer days)
    adjustment: 'raw' (default — actual traded prices, correct for intraday
        signal work over a few days) | 'split' | 'dividend' | 'all'. Use
        'split' for long-window trend math (e.g. SMA200): raw leaves splits
        unadjusted, so a 10:1 split inside the window injects 10x closes and
        wrecks the average. 'split' rebases history to today's share basis,
        matching the raw live price we compare it against.
    """
    if not symbols:
        return {}

    tf_map = {
        "1m": "1Min",
        "5m": "5Min",
        "15m": "15Min",
        "1h": "1Hour",
        "1d": "1Day",
        "1wk": "1Week",
        "1w": "1Week",
    }
    tf = tf_map.get(interval, "5Min")

    days = int("".join(c for c in lookback if c.isdigit()) or "5")
    now = datetime.now(timezone.utc)
    end = now - timedelta(minutes=16) if FEED == "sip" else now
    start = now - timedelta(days=days)

    out: dict[str, pd.DataFrame] = {sym: [] for sym in symbols}  # type: ignore[assignment]

    for i in range(0, len(symbols), BATCH_SYMBOLS):
        batch = symbols[i : i + BATCH_SYMBOLS]
        page_token: str | None = None
        while True:
            params: dict = {
                "symbols": ",".join(batch),
                "timeframe": tf,
                "feed": FEED,
                "end": end.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "start": start.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "limit": 10000,
                "adjustment": adjustment,
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
