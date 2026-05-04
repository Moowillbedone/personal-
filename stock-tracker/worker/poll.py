"""Polling worker — runs once or in a long-lived loop.

Run modes (env-controlled):
  LOOP_MIN=0   (default)  → single poll cycle, then exit. Useful for manual runs.
  LOOP_MIN=N>0           → poll every LOOP_INTERVAL_SEC for N minutes total.
                           Used by the GitHub Actions long-running schedule to
                           keep an internal 5-min cadence regardless of when
                           the cron actually fires (GH Actions cron is unreliable).
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone

import pandas as pd
from dotenv import load_dotenv

from lib import alpaca, data, db, notify, signals as sig

BATCH_SIZE = 100  # Alpaca multi-symbol query supports ~100/call

# Skip signals where the latest bar is older than this. Prevents stale-data
# fires e.g. running pre-market polls on Friday's last bar (when IEX hasn't
# emitted a Monday bar yet for that symbol).
MAX_AGE_MIN = int(os.getenv("MAX_AGE_MIN", "15"))

# Loop-mode controls
LOOP_MIN = int(os.getenv("LOOP_MIN", "0"))                # 0 = single shot
LOOP_INTERVAL_SEC = int(os.getenv("LOOP_INTERVAL_SEC", "300"))  # cycle every 5 min


def _bars_to_rows(symbol: str, df: pd.DataFrame) -> list[dict]:
    rows: list[dict] = []
    for ts, row in df.iterrows():
        if pd.isna(row["Close"]) or pd.isna(row["Volume"]):
            continue
        rows.append(
            {
                "symbol": symbol,
                "ts": data.to_iso_utc(ts),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"]),
                "session": data.classify_session(ts.to_pydatetime()),
            }
        )
    return rows


def run_once(sb, symbols: list[str]) -> tuple[int, int]:
    """A single poll pass. Returns (#bars_persisted, #signals_fired)."""
    all_price_rows: list[dict] = []
    fired: list[dict] = []

    for i in range(0, len(symbols), BATCH_SIZE):
        batch = symbols[i : i + BATCH_SIZE]
        try:
            frames = alpaca.fetch_recent_bars(batch, interval="5m", lookback="5d")
        except Exception as e:
            print(f"  batch {i} failed: {e}", file=sys.stderr)
            time.sleep(2)
            continue

        now = datetime.now(timezone.utc)
        for sym, df in frames.items():
            all_price_rows.extend(_bars_to_rows(sym, df))
            signal = sig.detect_for_symbol(sym, df)
            if not signal:
                continue
            age_min = (now - signal.ts.to_pydatetime()).total_seconds() / 60
            if age_min > MAX_AGE_MIN:
                continue
            ts_iso = data.to_iso_utc(signal.ts)
            if db.signal_exists(sb, sym, ts_iso):
                continue
            fired.append(
                {
                    "symbol": signal.symbol,
                    "ts": ts_iso,
                    "signal_type": signal.signal_type,
                    "price": signal.price,
                    "pct_change": signal.pct_change,
                    "volume_ratio": signal.volume_ratio,
                    "session": data.classify_session(signal.ts.to_pydatetime()),
                }
            )
        time.sleep(1)

    db.upsert_price_snapshots(sb, all_price_rows)
    db.insert_signals(sb, fired)

    if fired:
        for f in fired:
            print(
                f"  [{f['signal_type']}] {f['symbol']} "
                f"{f['pct_change']*100:+.2f}% volx{f['volume_ratio']:.1f} @ {f['price']}"
            )
        notify.notify_batch(fired)

    return len(all_price_rows), len(fired)


def main() -> int:
    load_dotenv()
    sb = db.client()

    symbols = db.get_active_symbols(sb)
    if not symbols:
        print("WARN: no active tickers; run refresh_universe.py first", file=sys.stderr)
        return 0

    if LOOP_MIN <= 0:
        print(f"single-shot poll over {len(symbols)} symbols")
        bars, signals_n = run_once(sb, symbols)
        print(f"persisted {bars} bars, fired {signals_n} new signals")
        return 0

    end = time.time() + LOOP_MIN * 60
    print(
        f"loop mode: polling {len(symbols)} symbols every "
        f"{LOOP_INTERVAL_SEC}s for {LOOP_MIN} min"
    )
    cycle = 0
    while time.time() < end:
        cycle += 1
        cycle_start = time.time()
        try:
            bars, signals_n = run_once(sb, symbols)
            print(
                f"[cycle {cycle}] {datetime.now(timezone.utc).isoformat(timespec='seconds')}  "
                f"bars={bars}  fired={signals_n}",
                flush=True,
            )
        except Exception as e:
            print(f"[cycle {cycle}] FAILED: {e}", file=sys.stderr, flush=True)
        # Sleep to next interval boundary, but not past the deadline.
        sleep_for = max(0, LOOP_INTERVAL_SEC - (time.time() - cycle_start))
        sleep_for = min(sleep_for, max(0, end - time.time()))
        if sleep_for > 0:
            time.sleep(sleep_for)
    print(f"loop done: completed {cycle} cycles")
    return 0


if __name__ == "__main__":
    sys.exit(main())
