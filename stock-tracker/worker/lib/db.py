"""Supabase client + thin DB helpers.

Egress discipline (2026-07): every write passes ``returning="minimal"`` so
PostgREST does NOT echo the written rows back in the response body. The
default is ``return=representation``, which meant every price_snapshots
upsert downloaded the full ~100k-row batch back to the worker each 5-min
cycle — the single biggest driver of the Supabase free-tier egress blowout
that paused the project. ``minimal`` drops that return payload to empty.
"""
import os
from datetime import datetime, timedelta, timezone
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
        sb.table("tickers").upsert(rows[i : i + 200], returning="minimal").execute()


def upsert_price_snapshots(sb: Client, rows: list[dict]) -> None:
    if not rows:
        return
    for i in range(0, len(rows), 500):
        sb.table("price_snapshots").upsert(
            rows[i : i + 500], returning="minimal"
        ).execute()


# Retention: price_snapshots is a rolling liveness log (read only by
# health_check's "latest bar" probe — the ticker chart and analyze route
# fetch history live from Alpaca, and get_recent_bars() has no callers).
# Without pruning the table grows unbounded (~38k new rows/day) and marches
# toward the free-tier 500MB DB cap. Keep a short window; a fresh restore's
# backlog should be cleared once via 010_price_snapshots_retention.sql.
PRICE_SNAPSHOT_KEEP_DAYS = int(os.getenv("PRICE_SNAPSHOT_KEEP_DAYS", "7"))


def prune_price_snapshots(sb: Client, keep_days: int = PRICE_SNAPSHOT_KEEP_DAYS) -> int:
    """Delete price_snapshots rows older than keep_days. Returns rows deleted
    (best-effort — 0 if the count header is absent). Safe to run repeatedly."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=keep_days)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    res = (
        sb.table("price_snapshots")
        .delete(returning="minimal", count="exact")
        .lt("ts", cutoff)
        .execute()
    )
    return getattr(res, "count", 0) or 0


def insert_signals(sb: Client, rows: list[dict]) -> None:
    """signals 테이블에 새 시그널 행 추가.

    UPSERT with on_conflict="symbol,ts" + ignore_duplicates=True 사용:
    DB의 UNIQUE INDEX(symbol, ts) 와 함께 race condition을 100% 방지.
    여러 poll 워커가 동시 실행되면서 같은 5분 bar를 동시 detect →
    application-level signal_exists() 통과 → 둘 다 insert 했던 race
    bug fix (2026-05-23 발견, migration 009 함께 적용).

    중복 시 동작: ignore (덮어쓰지 않음) — 기존 row의 백필 데이터
    (realized_*, expected_*, recent_news_count) 보존.
    """
    if not rows:
        return
    sb.table("signals").upsert(
        rows,
        on_conflict="symbol,ts",
        ignore_duplicates=True,
        returning="minimal",
    ).execute()


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
