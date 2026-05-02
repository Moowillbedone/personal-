"""Daily job: fill expected_1d/3d/5d on signals using historical analogues."""
from __future__ import annotations

import sys

import pandas as pd
from dotenv import load_dotenv

from lib import backtest as bt, db


def _to_pd_ts(iso: str) -> pd.Timestamp:
    return pd.Timestamp(iso)


def main() -> int:
    load_dotenv()
    sb = db.client()

    symbols = db.get_active_symbols(sb)
    if not symbols:
        print("WARN: no active tickers", file=sys.stderr)
        return 0

    # 1. Build historical signal pool from the last 60 days.
    print(f"collecting 60d historical signals for {len(symbols)} symbols…")
    pool = bt.collect_historical(symbols, lookback_days=60)
    print(f"  found {len(pool)} historical signals in pool")

    # 2. Pull all signals that need backfilling.
    res = (
        sb.table("signals")
        .select("id,symbol,ts,signal_type,pct_change,volume_ratio,expected_1d")
        .is_("expected_1d", "null")
        .execute()
    )
    targets = res.data
    print(f"backfilling {len(targets)} signals with null expected_*")

    if not targets:
        print("nothing to do")
        return 0

    updates = 0
    for t in targets:
        analogues = bt.find_analogues(
            target_type=t["signal_type"],
            target_pct=float(t["pct_change"]),
            target_vol=float(t["volume_ratio"]),
            pool=pool,
            target_ts=_to_pd_ts(t["ts"]),
            target_symbol=t["symbol"],
        )
        e1, e3, e5, n = bt.aggregate_expected(analogues)
        if n == 0:
            continue
        sb.table("signals").update(
            {
                "expected_1d": e1,
                "expected_3d": e3,
                "expected_5d": e5,
                "sample_size": n,
            }
        ).eq("id", t["id"]).execute()
        updates += 1

    print(f"updated {updates} / {len(targets)} signals with backtest expectations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
