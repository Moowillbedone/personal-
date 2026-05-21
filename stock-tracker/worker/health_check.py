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
GEMINI_FREE_RPD = int(os.getenv("GEMINI_FREE_RPD", "20"))

# Per-check thresholds (env-overridable so we can tune without redeploying).
SIGNALS_STALE_HOURS = int(os.getenv("HC_SIGNALS_STALE_H", "24"))
PRICE_BARS_STALE_HOURS = int(os.getenv("HC_PRICE_STALE_H", "6"))
AI_ANALYSIS_STALE_HOURS = int(os.getenv("HC_AI_STALE_H", "30"))
QUOTA_WARN_THRESHOLD = int(os.getenv("HC_QUOTA_WARN", "17"))
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
    is_trading_day = _is_us_weekday()

    if age_h > PRICE_BARS_STALE_HOURS and is_trading_day:
        return CheckResult(
            "price_snapshots",
            False,
            f"마지막 bar {age_h:.1f}h 전 (>{PRICE_BARS_STALE_HOURS}h). "
            f"poll worker dead 또는 Alpaca outage 의심. "
            f"`gh run list --workflow=stock-tracker-poll.yml` 로 워커 상태 확인.",
            "error",
        )
    return CheckResult(
        "price_snapshots", True, f"최근 bar {age_h:.1f}h 전 정상", "info"
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
    """라이브 호출로 Alpaca가 fresh bar 주는지 검증."""
    try:
        bars = alpaca.fetch_recent_bars(["AAPL"], interval="5m", lookback="1d")
        df = bars.get("AAPL")
    except Exception as e:
        return CheckResult("alpaca", False, f"호출 실패: {e}", "error")

    if df is None or df.empty:
        return CheckResult("alpaca", False, "AAPL bars 0건 반환 — Alpaca 정책 변경 의심", "error")

    last = df.index[-1]
    age_m = (datetime.now(timezone.utc) - last.to_pydatetime()).total_seconds() / 60
    is_trading_day = _is_us_weekday()
    if age_m > ALPACA_LATEST_BAR_STALE_MIN and is_trading_day:
        return CheckResult(
            "alpaca",
            False,
            f"AAPL last bar {age_m:.0f}m 전 (>{ALPACA_LATEST_BAR_STALE_MIN}m). "
            f"Alpaca delay 또는 outage. lib/alpaca.py의 end/feed 파라미터 점검.",
            "warning",
        )
    return CheckResult("alpaca", True, f"AAPL last bar {age_m:.0f}m 전 정상", "info")


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
