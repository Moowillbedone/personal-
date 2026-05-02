"""5-minute job: pull recent bars for all active tickers, persist, detect signals."""
from __future__ import annotations

import sys
import time

import pandas as pd
from dotenv import load_dotenv

from lib import data, db, signals as sig

BATCH_SIZE = 50  # yfinance batch size; smaller = more reliable, slower


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


def main() -> int:
    load_dotenv()
    sb = db.client()

    symbols = db.get_active_symbols(sb)
    if not symbols:
        print("WARN: no active tickers; run refresh_universe.py first", file=sys.stderr)
        return 0

    print(f"polling {len(symbols)} symbols in batches of {BATCH_SIZE}")

    all_price_rows: list[dict] = []
    fired: list[dict] = []

    for i in range(0, len(symbols), BATCH_SIZE):
        batch = symbols[i : i + BATCH_SIZE]
        try:
            frames = data.fetch_recent_bars(batch, interval="5m", lookback="5d")
        except Exception as e:
            print(f"  batch {i} failed: {e}", file=sys.stderr)
            time.sleep(2)
            continue

        for sym, df in frames.items():
            all_price_rows.extend(_bars_to_rows(sym, df))
            signal = sig.detect_for_symbol(sym, df)
            if not signal:
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

        # tiny pause between batches to be kind to Yahoo
        time.sleep(1)

    db.upsert_price_snapshots(sb, all_price_rows)
    db.insert_signals(sb, fired)

    print(f"persisted {len(all_price_rows)} bars, fired {len(fired)} new signals")
    if fired:
        for f in fired:
            print(
                f"  [{f['signal_type']}] {f['symbol']} "
                f"{f['pct_change']*100:+.2f}% volx{f['volume_ratio']:.1f} @ {f['price']}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
