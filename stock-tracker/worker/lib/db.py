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


# ── Long-horizon retention (2026-07 sustainability audit) ───────────────────
# Growth math at steady state (~330 signals/day, ~50 ai_analysis/day):
#   signals     ~650B/row w/ indexes → ~80MB/year unbounded
#   ai_analysis ~9KB/row (context+horizons jsonb) → ~160MB/year unbounded
# Unbounded, the 500MB free-tier DB cap is hit in ~2 years. The windows below
# bound both tables to a steady state (~180MB total) while keeping every
# consumer working: /stats max lookback is 365d (< 400d), ai_realize needs
# context.last_price only until realized_30d fills (~40d < 120d), and
# rec-performance slippage on trades older than the context window degrades
# to null (already handled in that route).
SIGNALS_KEEP_DAYS = int(os.getenv("SIGNALS_KEEP_DAYS", "400"))
AI_ANALYSIS_KEEP_DAYS = int(os.getenv("AI_ANALYSIS_KEEP_DAYS", "400"))
AI_CONTEXT_KEEP_FULL_DAYS = int(os.getenv("AI_CONTEXT_KEEP_FULL_DAYS", "120"))


def prune_signals(sb: Client, keep_days: int = SIGNALS_KEEP_DAYS) -> int:
    """Delete signals older than keep_days. trade_log.signal_id FK is
    on-delete-set-null, so journal rows survive. Safe to re-run."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=keep_days)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    res = (
        sb.table("signals")
        .delete(returning="minimal", count="exact")
        .lt("ts", cutoff)
        .execute()
    )
    return getattr(res, "count", 0) or 0


def slim_ai_analysis_context(
    sb: Client, keep_full_days: int = AI_CONTEXT_KEEP_FULL_DAYS
) -> int:
    """NULL out the fat context jsonb on ai_analysis rows older than
    keep_full_days. context is ~⅓–½ of each row; verdict/summary/horizons
    (what /stats and /trade actually render for history) are kept intact."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=keep_full_days)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    res = (
        sb.table("ai_analysis")
        .update({"context": None}, returning="minimal", count="exact")
        .lt("created_at", cutoff)
        .not_.is_("context", "null")
        .execute()
    )
    return getattr(res, "count", 0) or 0


def prune_ai_analysis(sb: Client, keep_days: int = AI_ANALYSIS_KEEP_DAYS) -> int:
    """Delete ai_analysis rows older than keep_days. trade_log.ai_analysis_id
    FK is on-delete-set-null, so journal rows survive."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=keep_days)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    res = (
        sb.table("ai_analysis")
        .delete(returning="minimal", count="exact")
        .lt("created_at", cutoff)
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


def get_nasdaq_top100(sb: Client) -> set[str]:
    """NASDAQ top-100 by market cap — the NDX-100 proxy that gates telegram
    signal alerts (2026-07 swing pivot: user wants alerts only for the
    high-volatility mega/large-cap NASDAQ names, not the full 200 universe).

    Proxy note: true NDX-100 membership isn't available from our free data
    sources; top-100 NASDAQ by mcap (refreshed daily by refresh_universe.py)
    overlaps it ~90% and needs zero maintenance. Empty set on failure —
    callers treat that as "filter unavailable" and skip notifications rather
    than spamming the full universe.
    """
    res = (
        sb.table("tickers")
        .select("symbol")
        .eq("exchange", "NASDAQ")
        .eq("is_active", True)
        .lte("rank_in_exch", 100)
        .execute()
    )
    return {r["symbol"] for r in (res.data or []) if r.get("symbol")}


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
