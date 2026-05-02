"""Supabase client + thin DB helpers."""
import os
from typing import Iterable

from supabase import Client, create_client


def client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def upsert_tickers(sb: Client, rows: list[dict]) -> None:
    if not rows:
        return
    # Chunk to avoid request-size limits.
    for i in range(0, len(rows), 200):
        sb.table("tickers").upsert(rows[i : i + 200]).execute()


def upsert_price_snapshots(sb: Client, rows: list[dict]) -> None:
    if not rows:
        return
    for i in range(0, len(rows), 500):
        sb.table("price_snapshots").upsert(rows[i : i + 500]).execute()


def insert_signals(sb: Client, rows: list[dict]) -> None:
    if not rows:
        return
    sb.table("signals").insert(rows).execute()


def get_active_symbols(sb: Client) -> list[str]:
    res = sb.table("tickers").select("symbol").eq("is_active", True).execute()
    return [r["symbol"] for r in res.data]


def get_recent_bars(sb: Client, symbol: str, limit: int = 25) -> list[dict]:
    res = (
        sb.table("price_snapshots")
        .select("ts,open,high,low,close,volume")
        .eq("symbol", symbol)
        .order("ts", desc=True)
        .limit(limit)
        .execute()
    )
    return list(reversed(res.data))


def signal_exists(sb: Client, symbol: str, ts_iso: str) -> bool:
    res = (
        sb.table("signals")
        .select("id")
        .eq("symbol", symbol)
        .eq("ts", ts_iso)
        .limit(1)
        .execute()
    )
    return len(res.data) > 0
