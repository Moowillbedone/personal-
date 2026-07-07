"""Daily health check — verify the whole pipeline is alive and telegram-alert
the user if anything is degraded.

Runs at KST 16:00 (UTC 07:00) every US weekday. This is PT midnight + 0min:
  - Gemini RPD has just reset (clean baseline for the next day)
  - Yesterday's two ai_scan runs (KST 17:00 + 22:00) are both in the past
  - 1h before today's KST 17:00 ai-scan → catches issues before the user
    notices a degraded digest

The user gets ONE message regardless of outcome:
  💚  all-OK heartbeat (short)
  🟡  warnings (degraded but not broken)
  🔴  errors (something needs intervention)

Checks (each fail-soft — one DB hiccup shouldn't kill the whole run):
  1. signals freshness            — did poll fire signals in 24h?
  2. price_snapshots freshness    — are bars flowing?
  3. ai_analysis freshness        — did ai_scan produce verdicts?
  4. Gemini quota remaining       — how much of today's 20 RPD is used?
  5. Alpaca liveness              — fresh-call probe right now
  6. watchlist analysis coverage  — every watchlist symbol analyzed ≤30h?

Add new checks here as new failure modes are discovered — each one is a
self-contained function returning a CheckResult.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

import requests
from dotenv import load_dotenv

from lib import alpaca, db


# ─── Config ────────────────────────────────────────────────────────────────
TG_TOKEN = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
TG_CHAT_ID = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()
# chain 전체 안전망(flash-lite 1,000 RPD) 기준 — ai_scan.py와 정합.
# 하루 50 calls(25×2)는 1,000 한도의 5%라 정상. 2.5-flash 20 RPD 기준이
# 아니라 chain 가용량 기준으로 봐야 false alarm 안 뜸 (2026-05-28).
GEMINI_FREE_RPD = int(os.getenv("GEMINI_FREE_RPD", "1000"))

# Per-check thresholds (env-overridable so we can tune without redeploying).
SIGNALS_STALE_HOURS = int(os.getenv("HC_SIGNALS_STALE_H", "24"))
PRICE_BARS_STALE_HOURS = int(os.getenv("HC_PRICE_STALE_H", "6"))
AI_ANALYSIS_STALE_HOURS = int(os.getenv("HC_AI_STALE_H", "30"))
QUOTA_WARN_THRESHOLD = int(os.getenv("HC_QUOTA_WARN", "900"))  # chain 1000 기준 90%
ALPACA_LATEST_BAR_STALE_MIN = int(os.getenv("HC_ALPACA_STALE_M", "60"))
WATCHLIST_STALE_HOURS = int(os.getenv("HC_WATCHLIST_STALE_H", "30"))


class CheckResult(NamedTuple):
    name: str
    ok: bool
    msg: str
    severity: str  # 'info' | 'warning' | 'error'


def _is_us_weekday() -> bool:
    """Rough EDT/EST weekday check. Treats US holidays as weekdays (we'd
    rather false-alert on a holiday than miss a real outage). KST→ET≈-13h
    so use US-side calendar by subtracting ~5h from UTC."""
    now_et = datetime.now(timezone.utc) - timedelta(hours=5)
    return now_et.weekday() < 5


def _is_us_market_session() -> bool:
    """현재 시각이 미국 거래 세션 (premarket~afterhours) 범위인지.

    premarket 04:00 ET ~ afterhours 마감 20:00 ET = 16시간 윈도우.
    이 범위 밖에선 fresh 5분봉이 발생하지 않는 게 *정상*이므로 staleness
    체크가 false alarm을 만든다.

    2026-05-22 추가: 헬스체크가 KST 16:00 (= UTC 07:00 = ET 03:00 새벽
    휴장 시간)에 발동되면서 매일 'price_snapshots stale', 'alpaca delay'
    false alarm을 보내던 문제 fix. 시각만 보고 평일 가정 X → 시간대 합산.
    """
    now_et = datetime.now(timezone.utc) - timedelta(hours=5)
    if now_et.weekday() >= 5:
        return False  # 주말
    h = now_et.hour
    return 4 <= h < 20


def _yesterday_was_us_trading_day() -> bool:
    """어제 ET 기준이 미국 거래일이었는지 — Alpaca calendar로 정확히.

    2026-05-26 추가: Memorial Day 같은 휴일 다음 날 헬스체크가 KST 16:00
    (= ET 03:00 새벽)에 발동되면, 24h cutoff 안에는 어제 휴일만 있고
    오늘 거래는 아직 시작 안 됨 → signals 0건 정상인데 false alarm.

    어제 ET 날짜 1개만 Alpaca calendar에 물어서 거래일이었는지 정확히
    판정. (calendar API는 거래일만 반환 — 휴일은 응답 list가 빔).
    """
    try:
        import os, requests as _r
        headers = {
            "APCA-API-KEY-ID": os.getenv("ALPACA_KEY_ID", ""),
            "APCA-API-SECRET-KEY": os.getenv("ALPACA_SECRET", ""),
        }
        now = datetime.now(timezone.utc)
        et_yesterday = ((now - timedelta(hours=5)) - timedelta(days=1)).date()
        r = _r.get(
            "https://api.alpaca.markets/v2/calendar",
            headers=headers,
            params={"start": et_yesterday.isoformat(), "end": et_yesterday.isoformat()},
            timeout=10,
        )
        if r.status_code != 200:
            return True  # API fail → 보수적으로 거래일이라 가정 (false alarm OK)
        days = r.json() or []
        return len(days) > 0
    except Exception:
        return True  # 에러 시 보수적 가정


# ─── Individual checks ─────────────────────────────────────────────────────
def check_signals_freshness(sb) -> CheckResult:
    """poll worker should fire at least some signals per US trading day."""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(hours=SIGNALS_STALE_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        res = (
            sb.table("signals")
            .select("id", count="exact")
            .gte("ts", cutoff)
            .limit(1)
            .execute()
        )
        count = res.count or 0
    except Exception as e:
        return CheckResult("signals", False, f"DB query failed: {e}", "error")

    # 휴일 가드: 어제 ET가 미국 거래일이 아니었으면 (Memorial Day 등)
    # signals 0건 정상. Alpaca calendar로 정확 체크.
    if not _yesterday_was_us_trading_day():
        return CheckResult(
            "signals",
            True,
            f"시그널 {SIGNALS_STALE_HOURS}h: {count}건 (어제 미국 휴장 — 정상)",
            "info",
        )

    is_trading_day = _is_us_weekday()
    if count == 0 and is_trading_day:
        return CheckResult(
            "signals",
            False,
            f"poll worker가 {SIGNALS_STALE_HOURS}h 동안 시그널 0건 fire. "
            f"정상 평일이면 100~400건 기대. poll.py · Alpaca feed · "
            f"signal-detection 임계값 또는 MAX_AGE_MIN 게이트 점검 필요.",
            "error",
        )
    if count < 20 and is_trading_day:
        return CheckResult(
            "signals",
            True,
            f"시그널 {SIGNALS_STALE_HOURS}h: {count}건 (정상보다 적음 — quiet day일 수도)",
            "info",
        )
    return CheckResult("signals", True, f"시그널 {SIGNALS_STALE_HOURS}h: {count}건 정상", "info")


def check_price_snapshots(sb) -> CheckResult:
    """price_snapshots는 poll cycle마다 upsert. fresh bar 흐르고 있나."""
    try:
        res = (
            sb.table("price_snapshots")
            .select("ts")
            .order("ts", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            return CheckResult("price_snapshots", False, "테이블이 비어있음", "error")
        last_ts = res.data[0]["ts"]
    except Exception as e:
        return CheckResult("price_snapshots", False, f"DB query failed: {e}", "error")

    last_dt = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
    age_h = (datetime.now(timezone.utc) - last_dt).total_seconds() / 3600
    # 휴장 시간엔 새 bar 자체가 안 나옴. 시장 세션 중일 때만 stale 체크.
    in_session = _is_us_market_session()

    if age_h > PRICE_BARS_STALE_HOURS and in_session:
        return CheckResult(
            "price_snapshots",
            False,
            f"마지막 bar {age_h:.1f}h 전 (>{PRICE_BARS_STALE_HOURS}h). "
            f"poll worker dead 또는 Alpaca outage 의심. "
            f"`gh run list --workflow=stock-tracker-poll.yml` 로 워커 상태 확인.",
            "error",
        )
    note = "" if in_session else " (휴장 중)"
    return CheckResult(
        "price_snapshots", True, f"최근 bar {age_h:.1f}h 전 정상{note}", "info"
    )


def check_ai_analysis(sb) -> CheckResult:
    """ai_scan이 어제 verdict를 만들었나."""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(hours=AI_ANALYSIS_STALE_HOURS)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    try:
        res = (
            sb.table("ai_analysis")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        count = res.count or 0
    except Exception as e:
        return CheckResult("ai_analysis", False, f"DB query failed: {e}", "error")

    if count == 0:
        return CheckResult(
            "ai_analysis",
            False,
            f"ai_scan이 {AI_ANALYSIS_STALE_HOURS}h 동안 verdict 0건. "
            f"Gemini quota 전체 소진 / API key 만료 / ai_scan workflow 미발동 의심.",
            "error",
        )
    return CheckResult(
        "ai_analysis", True, f"ai_analysis {AI_ANALYSIS_STALE_HOURS}h: {count}건", "info"
    )


def check_gemini_quota_remaining(sb) -> CheckResult:
    """현재 PT day quota 얼마나 썼나. 17개 초과면 warning."""
    now = datetime.now(timezone.utc)
    pt_midnight = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now < pt_midnight:
        pt_midnight -= timedelta(days=1)
    cutoff = pt_midnight.strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        res = (
            sb.table("ai_analysis")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        used = res.count or 0
    except Exception as e:
        return CheckResult("gemini_quota", False, f"DB query failed: {e}", "error")

    remaining = GEMINI_FREE_RPD - used
    if used > QUOTA_WARN_THRESHOLD:
        return CheckResult(
            "gemini_quota",
            False,
            f"오늘 Gemini quota {used}/{GEMINI_FREE_RPD} 사용 (남은 {remaining}). "
            f"남은 스캔 + manual 분석 제한될 수 있음.",
            "warning",
        )
    return CheckResult(
        "gemini_quota",
        True,
        f"Gemini quota {used}/{GEMINI_FREE_RPD} 사용 (남은 {remaining})",
        "info",
    )


def check_alpaca_alive() -> CheckResult:
    """라이브 호출로 Alpaca가 fresh bar 주는지 검증.

    2026-05-26 fix: lookback 1d → 5d. 1d로 호출하면 휴일+주말 연속
    (예: Memorial Day + 토일 = 3일 휴장)일 때 false alarm. 5d면 직전
    거래일 데이터 무조건 포함.
    """
    try:
        bars = alpaca.fetch_recent_bars(["AAPL"], interval="5m", lookback="5d")
        df = bars.get("AAPL")
    except Exception as e:
        return CheckResult("alpaca", False, f"호출 실패: {e}", "error")

    if df is None or df.empty:
        return CheckResult("alpaca", False, "AAPL bars 0건 반환 (5d window) — Alpaca 정책 변경 의심", "error")

    last = df.index[-1]
    age_m = (datetime.now(timezone.utc) - last.to_pydatetime()).total_seconds() / 60
    # 휴장 시간엔 fresh bar 없음 — 시장 세션 중일 때만 stale 체크.
    in_session = _is_us_market_session()
    if age_m > ALPACA_LATEST_BAR_STALE_MIN and in_session:
        return CheckResult(
            "alpaca",
            False,
            f"AAPL last bar {age_m:.0f}m 전 (>{ALPACA_LATEST_BAR_STALE_MIN}m). "
            f"Alpaca delay 또는 outage. lib/alpaca.py의 end/feed 파라미터 점검.",
            "warning",
        )
    note = "" if in_session else " (휴장 중)"
    return CheckResult("alpaca", True, f"AAPL last bar {age_m:.0f}m 전 정상{note}", "info")


def check_watchlist_coverage(sb) -> CheckResult:
    """워치리스트 모든 종목이 ≤30h 안에 분석됐나."""
    try:
        wl = [r["symbol"] for r in (sb.table("watchlist").select("symbol").execute().data or [])]
    except Exception as e:
        return CheckResult("watchlist", False, f"DB query failed: {e}", "error")

    if not wl:
        return CheckResult("watchlist", True, "워치리스트 비어있음 (체크 스킵)", "info")

    now = datetime.now(timezone.utc)
    stale_syms = []
    for sym in wl:
        try:
            res = (
                sb.table("ai_analysis")
                .select("created_at")
                .eq("symbol", sym)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
        except Exception:
            stale_syms.append(f"{sym}(?)")
            continue
        if not res.data:
            stale_syms.append(f"{sym}(never)")
            continue
        age_h = (
            now - datetime.fromisoformat(res.data[0]["created_at"].replace("Z", "+00:00"))
        ).total_seconds() / 3600
        if age_h > WATCHLIST_STALE_HOURS:
            stale_syms.append(f"{sym}({age_h:.0f}h)")

    if stale_syms:
        return CheckResult(
            "watchlist",
            False,
            f"분석 누락: {', '.join(stale_syms)}. ai_scan에서 빠졌거나 quota 부족으로 stale.",
            "warning",
        )
    return CheckResult(
        "watchlist", True, f"워치리스트 {len(wl)}개 모두 {WATCHLIST_STALE_HOURS}h 내 분석됨", "info"
    )


# ─── DB footprint guard (2026-07, "다시는 pause 안 당한다" 장치) ────────────
# Supabase 무료티어는 DB 500MB 초과가 지속되면 프로젝트를 pause시킨다 (6-7월
# egress 사고와 동일한 결말). 내부에서 pg_database_size를 직접 못 읽는 대신,
# 행 수 × 실측 기반 행당 바이트 상수로 풋프린트를 추정해 한도 훨씬 전에
# 텔레그램으로 경고한다. 상수는 보수적으로(인덱스 포함) 잡았다.
#
# 또한 retention(400d signals / 7d price_snapshots / ai_analysis 400d)이
# 실제로 돌고 있는지 oldest-row 나이로 검증 — 프루닝이 조용히 죽으면 이게
# 용량 초과의 유일한 경로이므로, 그 자체를 감시한다.
DB_EST_WARN_MB = int(os.getenv("HC_DB_WARN_MB", "300"))
DB_EST_ERROR_MB = int(os.getenv("HC_DB_ERROR_MB", "400"))
# (테이블, 카운트용 컬럼, 행당 추정 바이트 [heap+인덱스], retention 한도일 or None)
_FOOTPRINT_TABLES = (
    ("signals", "id", 700, 410),          # keep 400d + 여유 10d
    ("price_snapshots", "symbol", 300, 9),  # keep 7d + 여유 2d
    ("ai_analysis", "id", 6000, 410),     # context는 120d 후 슬림 — 평균치 반영
    ("assets", "symbol", 250, None),
    ("trade_log", "id", 400, None),
)


def check_db_footprint(sb) -> CheckResult:
    """행 수 기반 DB 용량 추정 + retention 동작 검증."""
    total_mb = 0.0
    parts: list[str] = []
    stale_retention: list[str] = []
    now = datetime.now(timezone.utc)
    ts_col = {"signals": "ts", "price_snapshots": "ts", "ai_analysis": "created_at"}

    for table, col, row_bytes, keep_days in _FOOTPRINT_TABLES:
        try:
            res = (
                sb.table(table)
                .select(col, count="exact")
                .limit(1)
                .execute()
            )
            n = res.count or 0
        except Exception as e:
            return CheckResult("db_footprint", False, f"{table} count 실패: {e}", "error")
        mb = n * row_bytes / 1e6
        total_mb += mb
        parts.append(f"{table} {n:,}행(~{mb:.0f}MB)")

        # retention 검증: 가장 오래된 행이 keep_days를 크게 넘으면 프루닝 죽음.
        if keep_days and n > 0:
            tcol = ts_col.get(table)
            try:
                oldest = (
                    sb.table(table)
                    .select(tcol)
                    .order(tcol, desc=False)
                    .limit(1)
                    .execute()
                )
                if oldest.data:
                    odt = datetime.fromisoformat(
                        oldest.data[0][tcol].replace("Z", "+00:00")
                    )
                    age_d = (now - odt).days
                    if age_d > keep_days:
                        stale_retention.append(f"{table} 최고령 {age_d}d(>{keep_days}d)")
            except Exception:
                pass  # retention 검증 실패는 풋프린트 결과에 비치명

    detail = " · ".join(parts)
    if stale_retention:
        return CheckResult(
            "db_footprint",
            False,
            f"retention 미동작 의심: {', '.join(stale_retention)}. "
            f"refresh-universe 워크플로 로그 확인 필요. (추정 {total_mb:.0f}MB) {detail}",
            "error",
        )
    if total_mb >= DB_EST_ERROR_MB:
        return CheckResult(
            "db_footprint",
            False,
            f"DB 추정 {total_mb:.0f}MB ≥ {DB_EST_ERROR_MB}MB — 500MB pause 한도 임박! "
            f"retention 일수 축소 필요. {detail}",
            "error",
        )
    if total_mb >= DB_EST_WARN_MB:
        return CheckResult(
            "db_footprint",
            False,
            f"DB 추정 {total_mb:.0f}MB ≥ {DB_EST_WARN_MB}MB (한도 500MB). {detail}",
            "warning",
        )
    return CheckResult(
        "db_footprint", True, f"DB 추정 {total_mb:.0f}MB / 500MB · {detail}", "info"
    )


# 6-12h 윈도우는 backtest 발동 cycle (4회/일 = 6h 간격) 한 번 이상 지난 시간대.
# 그 시간대 시그널이 expected_* NULL이면 backtest 워커 또는 GitHub Actions
# 트리거 실패 의심 — 사후 backfill이 안 되고 있는 상태.
BACKTEST_CHECK_MIN_HOURS = int(os.getenv("HC_BACKFILL_MIN_H", "6"))
BACKTEST_CHECK_MAX_HOURS = int(os.getenv("HC_BACKFILL_MAX_H", "12"))
BACKTEST_NULL_WARN_PCT = int(os.getenv("HC_BACKFILL_WARN_PCT", "50"))   # >= warn
BACKTEST_NULL_ERROR_PCT = int(os.getenv("HC_BACKFILL_ERROR_PCT", "80")) # >= error


def check_backtest_freshness(sb) -> CheckResult:
    """6-12h 이전 시그널 중 expected_1d NULL 비율 — backtest 백필 동작 여부.

    2026-05-26 추가: GitHub API outage로 11:00 UTC cron-job.org→workflow_
    dispatch가 HTTP 500 받아서 backtest 발동 실패. 결과 17:00 KST 시그널
    11건 모두 expected_1d/3d/5d NULL 상태 7시간 지속. 사용자 발견 전까지
    헬스체크가 못 잡았음 → 이 check 추가.

    윈도우: now-12h ~ now-6h 사이 시그널.
    - 6h 이상 지났으면 4회/일 backtest 중 적어도 1번 발동 후
    - 12h 이전이면 너무 옛날 (이미 별도 cycle로 처리됐을 거)
    - 이 시간대 시그널 NULL 비율 = backtest 동작 건강 지표
    """
    now = datetime.now(timezone.utc)
    window_end = (now - timedelta(hours=BACKTEST_CHECK_MIN_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    window_start = (now - timedelta(hours=BACKTEST_CHECK_MAX_HOURS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        # 윈도우 안 전체
        total_res = sb.table("signals").select("id", count="exact").gte("ts", window_start).lt("ts", window_end).limit(1).execute()
        total = total_res.count or 0
        # 그 중 expected_1d NULL
        null_res = sb.table("signals").select("id", count="exact").gte("ts", window_start).lt("ts", window_end).is_("expected_1d", "null").limit(1).execute()
        null_count = null_res.count or 0
    except Exception as e:
        return CheckResult("backtest", False, f"DB query failed: {e}", "error")

    if total == 0:
        # 휴장 후 또는 quiet day — 분모 0이면 체크 의미 없음
        return CheckResult(
            "backtest",
            True,
            f"backtest 윈도우 ({BACKTEST_CHECK_MIN_HOURS}-{BACKTEST_CHECK_MAX_HOURS}h ago): 시그널 0건 (체크 스킵)",
            "info",
        )

    null_pct = round(100 * null_count / total)
    if null_pct >= BACKTEST_NULL_ERROR_PCT:
        return CheckResult(
            "backtest",
            False,
            f"{BACKTEST_CHECK_MIN_HOURS}-{BACKTEST_CHECK_MAX_HOURS}h 전 시그널 {null_count}/{total}건 "
            f"expected_* NULL ({null_pct}%). backtest 워커 또는 GitHub Actions "
            f"트리거 실패 의심. `gh run list --workflow=stock-tracker-backtest.yml` 확인.",
            "error",
        )
    if null_pct >= BACKTEST_NULL_WARN_PCT:
        return CheckResult(
            "backtest",
            False,
            f"{BACKTEST_CHECK_MIN_HOURS}-{BACKTEST_CHECK_MAX_HOURS}h 전 시그널 {null_count}/{total}건 "
            f"expected_* NULL ({null_pct}%). backtest 백필 지연.",
            "warning",
        )
    return CheckResult(
        "backtest",
        True,
        f"backtest 백필: {total - null_count}/{total}건 채워짐 ({100-null_pct}%)",
        "info",
    )


# ─── Telegram delivery ─────────────────────────────────────────────────────
def send_telegram(text: str) -> bool:
    """Send a plain-text telegram. NO parse_mode — health-check messages
    contain shell snippets, file paths, and quota strings that include
    backticks/asterisks/underscores. Markdown mode rejects unbalanced
    entities and silently fails the whole alert (the very thing we're
    trying to surface). Plain text always delivers.

    2026-05-21: switched from parse_mode='Markdown' after a 🔴 error
    payload was dropped because the hint contained `gh run list ...`
    with single backticks — Markdown parser saw an unclosed code entity
    at the message boundary and returned HTTP 400.
    """
    if not TG_TOKEN or not TG_CHAT_ID:
        print("  TELEGRAM_BOT_TOKEN/CHAT_ID not set — skipping send", file=sys.stderr)
        return False
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    try:
        r = requests.post(
            url,
            json={
                "chat_id": TG_CHAT_ID,
                "text": text,
                # No parse_mode — see docstring.
                "disable_web_page_preview": True,
            },
            timeout=15,
        )
        if r.status_code >= 300:
            print(f"  telegram failed [{r.status_code}]: {r.text[:200]}", file=sys.stderr)
            return False
        return True
    except Exception as e:
        print(f"  telegram exception: {e}", file=sys.stderr)
        return False


def _format_message(results: list[CheckResult]) -> str:
    """Build the telegram payload. Plain text (no parse_mode) — see
    send_telegram() for why. Emoji do the visual structuring instead of
    markdown bold/italic."""
    now_kst = datetime.now(timezone(timedelta(hours=9)))
    ts = now_kst.strftime("%m-%d %H:%M KST")
    errors = [r for r in results if not r.ok and r.severity == "error"]
    warnings = [r for r in results if not r.ok and r.severity == "warning"]

    if not errors and not warnings:
        # All OK — short heartbeat
        ok_lines = [f"💚 시스템 헬스체크 ({ts})", f"전체 {len(results)}개 항목 정상"]
        for r in results:
            ok_lines.append(f"  ✓ {r.name}: {r.msg}")
        return "\n".join(ok_lines)

    header = "🔴" if errors else "🟡"
    lines = [
        f"{header} 시스템 헬스체크 ({ts})",
        f"errors={len(errors)} warnings={len(warnings)}",
        "",
    ]
    for r in errors + warnings:
        marker = "❌" if r.severity == "error" else "⚠️"
        lines.append(f"{marker} [{r.name}]")
        lines.append(f"  {r.msg}")
        lines.append("")

    # Also show the OK items in compact form so user can see what IS working
    ok_items = [r.name for r in results if r.ok]
    if ok_items:
        lines.append(f"정상: {', '.join(ok_items)}")

    return "\n".join(lines)


def main() -> int:
    load_dotenv()
    sb = db.client()

    checks = [
        check_signals_freshness,
        check_price_snapshots,
        check_ai_analysis,
        check_gemini_quota_remaining,
        check_alpaca_alive,
        check_watchlist_coverage,
        check_backtest_freshness,
        check_db_footprint,
    ]

    results: list[CheckResult] = []
    for fn in checks:
        try:
            # check_alpaca_alive doesn't take sb; others do. Try sb first then no-arg.
            try:
                r = fn(sb)  # type: ignore[arg-type]
            except TypeError:
                r = fn()  # type: ignore[call-arg]
        except Exception as e:
            # Last-resort guard: any check that explodes still gives us a row.
            r = CheckResult(fn.__name__, False, f"check crashed: {e}", "error")
        results.append(r)

    # Log to stdout for the GH Actions log archive
    print(f"=== health_check @ {datetime.now(timezone.utc).isoformat()} ===")
    for r in results:
        marker = "✅" if r.ok else ("⚠️" if r.severity == "warning" else "❌")
        print(f"  {marker} {r.name}: {r.msg}")

    msg = _format_message(results)
    print("\n--- telegram payload ---")
    print(msg)
    print("------------------------\n")
    sent = send_telegram(msg)
    print(f"telegram sent: {sent}")

    # Exit code: non-zero only on actual errors so a workflow failure email
    # also fires when something's truly broken. Warnings exit 0.
    has_error = any(not r.ok and r.severity == "error" for r in results)
    return 1 if has_error else 0


if __name__ == "__main__":
    sys.exit(main())
