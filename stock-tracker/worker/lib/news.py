"""Alpaca news adapter — used by poll.py to enrich firing signals with
the last few minutes of headlines for the affected symbols.

Why news enrichment matters: a 1.5% gap_up with no associated news is
usually noise (someone's algo, opening-cross imbalance, low-liquidity
quirk). A 1.5% gap with a news headline = real catalyst. Splitting
these in /stats lets us measure the size of the "no-news noise" tax
on each signal type before we filter them out of notifications.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Iterable

import requests

ALPACA_NEWS_URL = "https://data.alpaca.markets/v1beta1/news"

# How far back to look for "recent" news per signal. 30 min covers the
# pre-bar setup window plus the bar itself; longer windows pick up
# yesterday's news that's still echoing.
LOOKBACK_MIN = int(os.getenv("NEWS_LOOKBACK_MIN", "30"))

# Cap how many headlines we keep per symbol. Stored in jsonb on signals.
MAX_TITLES_PER_SYMBOL = 5


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


def fetch_recent_news(
    symbols: Iterable[str], lookback_min: int | None = None
) -> dict[str, list[dict]]:
    """Batch news fetch. Returns {symbol: [news_item, ...]} for the lookback window.

    news_item shape: {headline, source, url, created_at, summary}.
    Symbols with zero matching headlines are still present with an empty list.
    Empty input returns {}; network or auth failures return per-symbol empty
    lists (fail-soft so a transient news outage doesn't suppress signals).
    """
    syms = sorted({s.upper() for s in symbols if s})
    if not syms:
        return {}

    out: dict[str, list[dict]] = {s: [] for s in syms}
    window = lookback_min if lookback_min is not None else LOOKBACK_MIN
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=window)

    # Alpaca news endpoint accepts comma-separated symbols. Cap at ~50/call to
    # keep the URL reasonable; bigger requests have hit 414 in practice.
    for i in range(0, len(syms), 50):
        batch = syms[i : i + 50]
        params = {
            "symbols": ",".join(batch),
            "start": start.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "end": end.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "limit": 50,
            "sort": "desc",
        }
        try:
            r = requests.get(ALPACA_NEWS_URL, headers=_headers(), params=params, timeout=15)
            if r.status_code == 429:
                # Brief backoff, single retry.
                import time as _t
                _t.sleep(2)
                r = requests.get(ALPACA_NEWS_URL, headers=_headers(), params=params, timeout=15)
            if r.status_code != 200:
                # Auth or quota issue — keep going, downstream just sees empty news.
                continue
            data = r.json() or {}
        except Exception:
            continue

        # Each news item carries a `symbols` array linking it to ≥1 ticker.
        for item in data.get("news") or []:
            tickers = item.get("symbols") or []
            for t in tickers:
                if t in out:
                    out[t].append(
                        {
                            "headline": item.get("headline") or "",
                            "source": item.get("source") or "",
                            "url": item.get("url") or "",
                            "created_at": item.get("created_at") or "",
                            "summary": (item.get("summary") or "")[:240],
                        }
                    )

    # Trim per-symbol to the cap — most-recent-first since we requested sort=desc.
    for sym, items in out.items():
        if len(items) > MAX_TITLES_PER_SYMBOL:
            out[sym] = items[:MAX_TITLES_PER_SYMBOL]
    return out


def enrich_signals_with_news(signals: list[dict]) -> None:
    """Mutate `signals` in-place: add recent_news_count + recent_news_titles to each.

    Single batch news call for all firing symbols. After this returns:
      - signals[i]['recent_news_count']  → integer (0 if checked but found nothing)
      - signals[i]['recent_news_titles'] → jsonb-ready list (possibly empty)

    Both keys are always set (not None), so the row writes a meaningful
    "checked, n=0" instead of NULL "never checked" — that's the whole
    point of doing the enrichment.
    """
    if not signals:
        return
    syms = {s["symbol"] for s in signals}
    news_map = fetch_recent_news(syms)
    for s in signals:
        items = news_map.get(s["symbol"], [])
        s["recent_news_count"] = len(items)
        # Store just the headlines (jsonb) — keep payload small. Full URLs/
        # summaries live in the analyzer's separate news pipeline.
        s["recent_news_titles"] = [
            {"headline": it["headline"], "source": it["source"], "ts": it["created_at"]}
            for it in items
        ]
