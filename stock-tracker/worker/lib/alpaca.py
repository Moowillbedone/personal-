"""Alpaca Markets data adapter (free tier, consolidated feed with 15-min delay).

Drop-in replacement for the yfinance-based fetcher. Returns DataFrames with the
same Open/High/Low/Close/Volume columns and a tz-aware DatetimeIndex so the
existing signal detector and DB-row builder keep working unchanged.

Auth via ALPACA_KEY_ID / ALPACA_SECRET env vars.

Free-tier rules (live-probed 2026-05-19):
  - Setting ``end=<current-time>`` triggers Alpaca's "recent SIP" guard
    and returns 403 ("subscription does not permit querying recent SIP
    data"). Free paper accounts can NOT request bars right up to "now".
  - Setting ``feed=iex`` always works, but IEX is just one exchange and
    its 5-min bar coverage is extremely sparse — today many major names
    had ZERO IEX prints for 16+ hours, even during premarket session.
  - Omitting BOTH ``end`` AND ``feed`` returns the consolidated tape
    (all exchanges) up to Alpaca's free-tier cutoff, which is roughly
    "now minus 15 min". For signal detection on 5-min bars this is fine —
    a bar from 15min ago is still actionable.

Previous worker forced ``feed=iex`` + ``end=now``. That worked yesterday
because IEX had richer print coverage; today IEX dried up and the worker
looped for 5h with bars=46858 (same 5-day snapshot) and fired=0 signals.

This rewrite:
  1. Drops ``end`` so Alpaca picks the latest available timestamp.
  2. Omits ``feed`` so we get consolidated (rich) tape.
  3. ALPACA_FEED env override remains for emergency rollback if Alpaca
     changes free-tier rules again.

Tradeoff vs the old broken behavior: bars are ~15min delayed. Signals
that fire on a freshly-rolled 5-min bar will appear in DB ~15min after
the underlying move instead of ~1min. Trade journal and AI verdicts
remain timely because they read snapshots, which use a different
endpoint with its own freshness profile (Finnhub for extended-hours).
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Iterable

import pandas as pd
import requests

BASE = "https://data.alpaca.markets/v2"
# Empty string (default) → omit the param entirely → Alpaca picks the
# broadest feed available for the account. Override via env to lock to a
# specific feed: 'iex' (IEX exchange only), 'sip' (consolidated, paid).
FEED = os.getenv("ALPACA_FEED", "").strip().lower()
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
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    out: dict[str, pd.DataFrame] = {sym: [] for sym in symbols}  # type: ignore[assignment]

    for i in range(0, len(symbols), BATCH_SYMBOLS):
        batch = symbols[i : i + BATCH_SYMBOLS]
        page_token: str | None = None
        while True:
            params: dict = {
                "symbols": ",".join(batch),
                "timeframe": tf,
                "start": start.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "limit": 10000,
                "adjustment": adjustment,
            }
            # NEVER include explicit `end=now` — Alpaca's free tier rejects
            # that as "recent SIP". Omitting end → Alpaca defaults to its
            # free-tier cutoff (~now-15min) which is fine for signal work.
            # NEVER pin `feed=iex` either — IEX exchange alone has sparse
            # coverage (zero prints for hours on major names today). No-feed
            # gets consolidated tape across all exchanges.
            # Both overrides remain available via ALPACA_FEED env var for
            # emergency rollback.
            if FEED:
                params["feed"] = FEED
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
