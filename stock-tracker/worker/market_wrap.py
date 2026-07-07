"""장 마감 정리 리포트 — KST 06:00 (US close +1h), telegram.

What it contains (all MECHANICAL — zero Gemini calls, so this report can
never touch LLM quota):
  1. 레짐 & 시장:   /api/regime — QQQ vs SMAs, VIX, 오늘 등락
  2. 내 포지션:     /api/trades/positions — open real positions, 손익률,
                    간이 처방 라벨 (대시보드 규칙의 요약판, 레짐 게이트 포함)
  3. 오늘 추천 성과: 지난 24h의 buy/sell 추천(conf≥0.55)이 추천 시점 가격
                    대비 지금 어디 있나 — 적중률 포함 (책임 추적 루프)
  4. 강세 섹터 마감: /api/sector-strength 상위 3
  5. 내일 어닝:      포지션∪관심종목 중 오늘/내일 발표 예정 (Finnhub)

Cost profile (사용자 질문 "surpass 재발/Gemini 오버" 대응):
  - Gemini: 0 calls.
  - Supabase egress: positions ~20KB + picks query ~5KB + override ~1KB
    ≈ 30KB/day — 무료 한도(5GB/월)의 0.02%/월 수준.
  - Alpaca/FRED: via our own Vercel APIs, cached where it matters.

Scheduling: GitHub Actions native cron 21:00 UTC Mon-Fri (= KST 화~토
06:00). GH cron can drift 0~90min — acceptable for a morning report the
user reads at breakfast. If you later add a cron-job.org trigger for
precision, REMOVE the `schedule:` block from the workflow to avoid
duplicate sends (see ai-scan's 2026-05-19 duplicate-digest postmortem).
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

load_dotenv()  # before lib imports — see poll.py for why

from lib import db  # noqa: E402
# Reuse the digest's battle-tested telegram plumbing (markdown-safe escaping,
# 4096-char packing, send with error logging).
from ai_scan import _md_safe, pack_messages, send_telegram, FRONT_URL  # noqa: E402

# 간이 처방 임계값 — apps/web/lib/prescription.ts DEFAULT_RX의 요약판.
# (전체 트랜치/사이클 로직은 대시보드가 담당; 여기선 아침에 훑을 라벨만.)
TP1, TP2 = 0.10, 0.20
WATCH, AVG_DOWN, HARD_STOP = -0.10, -0.20, -0.30

PICK_CONF_MIN = float(os.getenv("WRAP_PICK_CONF_MIN", "0.55"))
PICK_LOOKBACK_H = int(os.getenv("WRAP_PICK_LOOKBACK_H", "24"))


def _get_json(path: str, timeout: int = 60) -> dict | None:
    try:
        r = requests.get(f"{FRONT_URL}{path}", timeout=timeout)
        if r.status_code != 200:
            print(f"  GET {path} -> {r.status_code}", file=sys.stderr)
            return None
        return r.json()
    except Exception as e:
        print(f"  GET {path} failed: {e}", file=sys.stderr)
        return None


def _fmt_pct(v: float | None, dp: int = 1) -> str:
    if v is None:
        return "—"
    return f"{v*100:+.{dp}f}%"


REGIME_LINE = {
    "risk_on": "🟢 상승추세 (risk-on)",
    "neutral": "🟡 중립·박스",
    "risk_off": "🔴 하락추세 (risk-off)",
}


def _rx_label(pct: float | None, regime: str | None) -> str:
    """대시보드 처방의 아침 요약 라벨."""
    if pct is None:
        return "시세 미확인"
    if pct >= TP2:
        return "🎯 2차 익절 구간"
    if pct >= TP1:
        return "🟢 1차 익절 구간"
    if pct <= HARD_STOP:
        return "🚨 손절 검토"
    if pct <= AVG_DOWN:
        if regime == "risk_on" or regime == "neutral":
            return "🟠 물타기 구간 (대시보드 확인)"
        return "⛔ 물타기 금지 (레짐)"
    if pct <= WATCH:
        return "👀 물타기 준비 구간"
    return "보유"


def section_positions(regime_key: str | None) -> tuple[list[str], set[str]]:
    """내 포지션 요약. Returns (lines, held_symbols)."""
    data = _get_json("/api/trades/positions?mode=real&lookback=3650", timeout=90)
    overrides: dict[str, float] = {}
    ovr = _get_json("/api/positions/override", timeout=30) or {}
    for o in ovr.get("overrides") or []:
        try:
            overrides[o["symbol"]] = float(o["avg_cost"])
        except (KeyError, TypeError, ValueError):
            continue

    held: set[str] = set()
    if not data:
        return ["  (포지션 조회 실패)"], held
    lines: list[str] = []
    for p in data.get("positions") or []:
        try:
            if p.get("mode") != "real" or float(p.get("openQty") or 0) <= 1e-9:
                continue
            sym = p["symbol"]
            held.add(sym)
            cur = p.get("currentPrice")
            avg = overrides.get(sym) or p.get("avgBuyPrice")
            pct = (
                float(cur) / float(avg) - 1
                if cur is not None and avg
                else (float(p["unrealizedPct"]) if p.get("unrealizedPct") is not None else None)
            )
            ov_tag = " (평단 수정)" if sym in overrides else ""
            lines.append(
                f"• *{sym}* {_fmt_pct(pct)}{ov_tag} — {_rx_label(pct, regime_key)}"
            )
        except (KeyError, TypeError, ValueError):
            continue
    if not lines:
        lines = ["  열린 포지션 없음"]
    return lines, held


def section_picks(sb) -> list[str]:
    """지난 24h 추천(buy/sell, conf≥0.55)의 추천가 대비 현재 성과."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=PICK_LOOKBACK_H)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    try:
        res = (
            sb.table("ai_analysis")
            .select("symbol,verdict,confidence,created_at,last_price:context->>last_price")
            .gte("created_at", cutoff)
            .in_("verdict", ["buy", "sell"])
            .gte("confidence", PICK_CONF_MIN)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"  picks query failed: {e}", file=sys.stderr)
        return ["  (추천 이력 조회 실패)"]

    # 심볼당 최신 추천 1건만 (같은 날 17시/22시 중 최근 것).
    latest: dict[str, dict] = {}
    for r in rows:
        sym = (r.get("symbol") or "").upper()
        if sym and sym not in latest:
            latest[sym] = r
    if not latest:
        return ["  지난 24시간 매수/매도 추천 없음"]

    snaps = _get_json(
        "/api/snapshot?symbols=" + ",".join(sorted(latest.keys())), timeout=90
    )
    price_now: dict[str, float] = {}
    for s in (snaps or {}).get("snapshots") or []:
        if s.get("lastPrice") is not None and not s.get("error"):
            price_now[s["symbol"]] = float(s["lastPrice"])

    lines: list[str] = []
    hits = 0
    measured = 0
    for sym, r in sorted(latest.items()):
        try:
            base = float(r.get("last_price") or 0)
        except (TypeError, ValueError):
            base = 0.0
        cur = price_now.get(sym)
        verdict = (r.get("verdict") or "").lower()
        conf = int(round(float(r.get("confidence") or 0) * 100))
        arrow = "🟢매수" if verdict == "buy" else "🔴매도"
        if base > 0 and cur is not None:
            move = cur / base - 1
            hit = move > 0 if verdict == "buy" else move < 0
            measured += 1
            hits += 1 if hit else 0
            mark = "✅" if hit else "❌"
            lines.append(f"• {arrow} *{sym}* ({conf}%) → {_fmt_pct(move)} {mark}")
        else:
            lines.append(f"• {arrow} *{sym}* ({conf}%) → 측정 불가")
    if measured:
        lines.append(f"적중 {hits}/{measured}")
    return lines


def section_sectors() -> list[str]:
    data = _get_json("/api/sector-strength", timeout=90)
    if not data:
        return ["  (섹터 조회 실패)"]
    out = []
    for s in (data.get("sectors") or [])[:3]:
        if s.get("avgReturn") is None:
            continue
        out.append(
            f"• {_md_safe(s.get('labelKo') or s.get('key') or '?')} "
            f"{_fmt_pct(s['avgReturn'])} · 거래대금 ${(s.get('totalDollarVolume') or 0)/1e9:.1f}B"
        )
    return out or ["  섹터 데이터 없음"]


def section_earnings(symbols: set[str]) -> list[str]:
    """오늘(미국 기준)~내일 어닝 — 포지션∪관심종목만. Fail-soft."""
    if not symbols or not (os.getenv("FINNHUB_API_KEY") or "").strip():
        return []
    try:
        from earnings_alert import fetch_earnings_calendar  # lazy: needs FINNHUB key

        now_et = datetime.now(timezone.utc) - timedelta(hours=5)
        start = now_et.date().isoformat()
        end = (now_et.date() + timedelta(days=1)).isoformat()
        cal = fetch_earnings_calendar(start, end)
    except Exception as e:
        print(f"  earnings fetch failed: {e}", file=sys.stderr)
        return []
    lines = []
    for item in cal:
        sym = (item.get("symbol") or "").upper()
        if sym in symbols:
            hour = {"bmo": "개장 전", "amc": "마감 후", "dmh": "장중"}.get(
                item.get("hour") or "", "시간 미정"
            )
            lines.append(f"• *{sym}* {item.get('date')} ({hour})")
    return lines


def main() -> int:
    sb = db.client()

    regime = _get_json("/api/regime", timeout=45) or {}
    regime_key = regime.get("regime")

    now_kst = datetime.now(timezone(timedelta(hours=9)))
    header = [f"🌙 *장 마감 리포트* ({now_kst.strftime('%m-%d %H:%M KST')})"]
    if regime_key:
        bits = [REGIME_LINE.get(regime_key, regime_key)]
        if isinstance(regime.get("ret5d"), (int, float)):
            bits.append(f"QQQ 5일 {_fmt_pct(regime['ret5d'])}")
        if isinstance(regime.get("vix"), (int, float)):
            bits.append(f"VIX {regime['vix']:.1f}")
        header.append("레짐: " + " · ".join(bits))
    blocks: list[str] = ["\n".join(header)]

    pos_lines, held = section_positions(regime_key)
    blocks.append("💼 *내 포지션*\n" + "\n".join(pos_lines))

    blocks.append("📊 *오늘 추천 성과 (24h)*\n" + "\n".join(section_picks(sb)))

    blocks.append("🔥 *오늘 강세 섹터*\n" + "\n".join(section_sectors()))

    # watchlist ∪ held for the earnings check
    watch: set[str] = set()
    try:
        res = sb.table("watchlist").select("symbol").execute()
        watch = {r["symbol"].upper() for r in (res.data or []) if r.get("symbol")}
    except Exception:
        pass
    earn = section_earnings(held | watch)
    if earn:
        blocks.append("📅 *오늘·내일 어닝 (보유/관심)*\n" + "\n".join(earn))

    blocks.append(f"[대시보드 →]({FRONT_URL}/)")

    sent_all = True
    for i, msg in enumerate(pack_messages(blocks), 1):
        ok = send_telegram(msg)
        sent_all = sent_all and ok
        print(f"market_wrap: telegram {i} sent={ok} ({len(msg)} chars)")
    return 0 if sent_all else 1


if __name__ == "__main__":
    sys.exit(main())
