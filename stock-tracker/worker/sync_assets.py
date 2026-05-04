"""Daily job: sync the full universe of US tradable equities into `assets`.

Calls Alpaca /v2/assets and upserts into the `assets` table. This is SEPARATE
from the existing signal-tracker `tickers` table (TOP200) so the worker that
detects gap/volume signals is not affected.
"""
from __future__ import annotations

import os
import sys

import requests
from dotenv import load_dotenv

from lib import db

ALPACA_TRADING_BASE = "https://api.alpaca.markets/v2"


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


# Exchanges we consider primary listings (skip OTC noise).
ALLOWED_EXCHANGES = {"NASDAQ", "NYSE", "ARCA", "AMEX", "BATS"}


def fetch_assets() -> list[dict]:
    """Fetch all active, tradable US equity assets from Alpaca."""
    r = requests.get(
        f"{ALPACA_TRADING_BASE}/assets",
        headers=_headers(),
        params={"status": "active", "asset_class": "us_equity"},
        timeout=60,
    )
    r.raise_for_status()
    raw = r.json()

    rows: list[dict] = []
    for a in raw:
        if not a.get("tradable"):
            continue
        exch = a.get("exchange")
        if exch not in ALLOWED_EXCHANGES:
            continue
        rows.append(
            {
                "symbol": a["symbol"],
                "name": a.get("name"),
                "exchange": exch,
                "asset_class": a.get("class") or "us_equity",
                "status": a.get("status") or "active",
                "tradable": True,
                "fractionable": a.get("fractionable"),
            }
        )
    return rows


def upsert_assets(sb, rows: list[dict]) -> None:
    if not rows:
        return
    for i in range(0, len(rows), 500):
        sb.table("assets").upsert(rows[i : i + 500]).execute()


def main() -> int:
    load_dotenv()
    sb = db.client()
    rows = fetch_assets()
    if not rows:
        print("ERROR: empty asset response", file=sys.stderr)
        return 1
    upsert_assets(sb, rows)
    by_exch: dict[str, int] = {}
    for r in rows:
        by_exch[r["exchange"]] = by_exch.get(r["exchange"], 0) + 1
    summary = ", ".join(f"{k}={v}" for k, v in sorted(by_exch.items()))
    print(f"upserted {len(rows)} assets ({summary})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
