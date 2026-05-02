"""Daily job: refresh the top-100 NASDAQ + top-100 NYSE universe."""
from __future__ import annotations

import sys

from dotenv import load_dotenv

from lib import data, db


def main() -> int:
    load_dotenv()
    sb = db.client()

    rows = data.fetch_top_by_market_cap(per_exchange=100)
    if not rows:
        print("ERROR: empty universe response", file=sys.stderr)
        return 1

    # Mark every row active; anything not in this batch will stay as-is
    # (we don't deactivate aggressively to keep historical price_snapshots usable).
    for r in rows:
        r["is_active"] = True

    db.upsert_tickers(sb, rows)
    print(f"upserted {len(rows)} tickers "
          f"({sum(1 for r in rows if r['exchange']=='NASDAQ')} NASDAQ + "
          f"{sum(1 for r in rows if r['exchange']=='NYSE')} NYSE)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
