"""Intraday (15분봉) 눌림목 scanner — recomputes the dashboard pullback
classification every ~15 min during the US session (incl. pre-market), so the
verdict reflects intraday price action instead of only the daily close.

Kept SEPARATE from poll.py so the signal poll's blast radius is untouched. Fetches
15m bars for the whole universe in BATCHED multi-symbol calls (~a dozen Alpaca
calls per cycle, NOT per-symbol) and upserts pullback_class/retrace/grades/
pullback_at with returning="minimal" — orders of magnitude below any egress line.

15m is the shortest timeframe our free consolidated tape supports (bars are
~15 min delayed; anything shorter is defeated by the delay). Reuses the exact
classify_pullback engine (worker/lib/pullback.py = port of the reviewed TS one).

Run: python pullback_intraday.py   (LOOP_MIN>0 → loop every LOOP_INTERVAL_SEC)
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

from lib import alpaca, db
from lib.pullback import classify_pullback

load_dotenv()

LOOP_MIN = int(os.getenv("LOOP_MIN", "0"))  # 0 = single shot
LOOP_INTERVAL_SEC = int(os.getenv("LOOP_INTERVAL_SEC", "900"))  # 15 min
INTRADAY_TF = "15m"
INTRADAY_LOOKBACK = "15d"  # ~300 15m bars → SMA200 resolvable


def _load_spans(sb) -> dict:
    """Daily Ichimoku spans (from sma200_scan) — horizontal support levels,
    stable intraday, so loaded once per process."""
    try:
        res = sb.table("sma200").select("symbol, spana_daily, spanb_daily").execute()
        return {
            r["symbol"]: (r.get("spana_daily"), r.get("spanb_daily"))
            for r in (res.data or [])
        }
    except Exception as e:
        print(f"pullback_intraday: span load failed — {e}", file=sys.stderr)
        return {}


def run_scan(sb, symbols: list[str], spans: dict) -> tuple[int, int, int]:
    frames = alpaca.fetch_recent_bars(
        symbols, interval=INTRADAY_TF, lookback=INTRADAY_LOOKBACK
    )
    now_iso = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []
    pull = form = 0
    for sym in symbols:
        df = frames.get(sym)
        if df is None or getattr(df, "empty", True):
            continue
        span_a, span_b = spans.get(sym, (None, None))
        pb = classify_pullback(df, span_a, span_b)
        if not pb:
            continue
        if pb["classification"] == "pullback":
            pull += 1
        elif pb["classification"] == "forming":
            form += 1
        rows.append(
            {
                "symbol": sym,
                "pullback_class": pb["classification"],
                "pullback_retrace": pb["retrace"],
                "pullback_grades": pb["grades"],
                "pullback_at": now_iso,
            }
        )
    for i in range(0, len(rows), 200):
        sb.table("sma200").upsert(rows[i : i + 200], returning="minimal").execute()
    return (len(rows), pull, form)


def main() -> int:
    sb = db.client()
    symbols = db.get_active_symbols(sb)
    if not symbols:
        print("pullback_intraday: no active symbols, exiting")
        return 0
    spans = _load_spans(sb)

    if LOOP_MIN <= 0:
        n, p, f = run_scan(sb, symbols, spans)
        print(f"pullback_intraday: single-shot — {n} rows (지지={p}, 형성={f})")
        return 0

    end = time.time() + LOOP_MIN * 60
    print(
        f"pullback_intraday: loop every {LOOP_INTERVAL_SEC}s for {LOOP_MIN} min "
        f"({len(symbols)} symbols)"
    )
    cycle = 0
    while time.time() < end:
        cycle += 1
        cs = time.time()
        try:
            n, p, f = run_scan(sb, symbols, spans)
            print(
                f"[cycle {cycle}] {datetime.now(timezone.utc).isoformat(timespec='seconds')} "
                f"— {n} rows (지지={p}, 형성={f})",
                flush=True,
            )
        except Exception as e:
            print(f"[cycle {cycle}] FAILED: {e}", file=sys.stderr, flush=True)
        sleep_for = max(0, LOOP_INTERVAL_SEC - (time.time() - cs))
        sleep_for = min(sleep_for, max(0, end - time.time()))
        if sleep_for > 0:
            time.sleep(sleep_for)
    print(f"pullback_intraday: loop done, {cycle} cycles")
    return 0


if __name__ == "__main__":
    sys.exit(main())
