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

    # Clear stale ranks for symbols absent from today's batch. Without this,
    # a symbol that drops out of the top-100 keeps its old rank_in_exch
    # forever (we deliberately never deactivate), so the NDX-100 telegram
    # gate (rank_in_exch<=100 in db.get_nasdaq_top100) would accrete every
    # name that was EVER top-100. Symbols stay is_active for the polling
    # universe; they just lose their rank.
    try:
        current = [r["symbol"] for r in rows]
        sb.table("tickers").update(
            {"rank_in_exch": None}, returning="minimal"
        ).not_.in_("symbol", current).execute()
        print("cleared rank_in_exch on symbols outside today's top-100 batch")
    except Exception as e:
        print(f"WARN: stale-rank clear failed (non-fatal): {e}", file=sys.stderr)

    # Daily retention: bound price_snapshots so it never marches toward the
    # free-tier 500MB DB cap. Steady-state this trims ~1 day's worth of rows;
    # the initial post-restore backlog is cleared once by the 010 migration.
    try:
        deleted = db.prune_price_snapshots(sb)
        print(f"pruned {deleted} price_snapshots rows older than "
              f"{db.PRICE_SNAPSHOT_KEEP_DAYS} days")
    except Exception as e:
        print(f"WARN: price_snapshots prune failed (non-fatal): {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
