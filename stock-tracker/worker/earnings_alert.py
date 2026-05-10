"""Daily earnings calendar alert for watchlist symbols.

Why: missing an earnings date on a held position is a common avoidable
loss — IV crush + post-print gap can make a "fine" thesis a -10% day.
Alpaca news catches the after-the-fact print but doesn't give heads-up
to size-down or close before. Finnhub's earnings calendar has the
forward dates and EPS estimates for free.

Schedule: daily at KST 22:00 (UTC 13:00 = ET 09:00, before regular open).
This timing catches:
  - "today AMC" earnings: 4-6 hours of warning to position
  - "tomorrow BMO" earnings: full day to research
  - "this week" preview: 2-7 day lead time

Output (telegram digest):
  - 🚨 Today (D-day): symbols with earnings today, marked BMO/AMC
  - ⏰ Tomorrow (D+1): heads up
  - 📆 This week (D+2 to D+7): preview list

Sends nothing if no watchlist symbols have earnings in the 7-day window
(avoid noise weeks).
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

from lib import db

# Telegram hard cap is 4096; leave headroom for markdown overhead and a safe
# truncation point. Same value used in ai_scan.py.
TG_MSG_CHAR_CAP = 3900

# Same gotcha as ai_scan.py: GH Actions sets every env var declared in
# the workflow even if the source secret is missing (yields ""), so we
# need an explicit `or` for fallback.
FINNHUB_KEY = (os.getenv("FINNHUB_API_KEY") or "").strip()
TG_TOKEN = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
TG_CHAT_ID = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()
FRONT_URL = (
    os.getenv("FRONT_URL") or "https://stock-tracker-khaki-mu.vercel.app"
).rstrip("/")

# 7 trading days ≈ 7 calendar days; covers a normal earnings week's
# heads-up. Larger windows just dilute the digest with names too far
# out to meaningfully prep for.
LOOKBACK_DAYS = 7


def fetch_earnings_calendar(start_iso: str, end_iso: str) -> list[dict]:
    """Bulk fetch — one API call returns ALL earnings in window. Filter to
    watchlist locally. Far cheaper than N per-symbol calls.
    """
    if not FINNHUB_KEY:
        print("earnings_alert: FINNHUB_API_KEY not set — cannot fetch", file=sys.stderr)
        return []
    url = f"https://finnhub.io/api/v1/calendar/earnings?from={start_iso}&to={end_iso}&token={FINNHUB_KEY}"
    try:
        r = requests.get(url, timeout=15)
        if r.status_code != 200:
            print(
                f"earnings_alert: finnhub HTTP {r.status_code}: {r.text[:200]}",
                file=sys.stderr,
            )
            return []
        return r.json().get("earningsCalendar") or []
    except Exception as e:
        print(f"earnings_alert: fetch failed — {e}", file=sys.stderr)
        return []


def fmt_hour(hour: str) -> str:
    """Finnhub hint: 'bmo' = before market open, 'amc' = after market close,
    'dmh' = during market hours, '' = unknown."""
    h = (hour or "").lower()
    if h == "bmo":
        return "🌅 BMO (장전)"
    if h == "amc":
        return "🌙 AMC (장후)"
    if h == "dmh":
        return "⏱ DMH (장중)"
    return "시간 미정"


def fmt_eps(est: float | None) -> str:
    if est is None:
        return "EPS 추정 없음"
    sign = "-" if est < 0 else ""
    return f"EPS 추정 {sign}${abs(est):.2f}"


def send_telegram(text: str) -> bool:
    if not TG_TOKEN or not TG_CHAT_ID:
        print(
            "earnings_alert: TELEGRAM creds missing — printing digest instead\n"
            f"---\n{text}\n---",
            file=sys.stderr,
        )
        return False
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    try:
        r = requests.post(
            url,
            json={
                "chat_id": TG_CHAT_ID,
                "text": text,
                "parse_mode": "Markdown",
                "disable_web_page_preview": True,
            },
            timeout=15,
        )
        if r.status_code >= 300:
            print(
                f"earnings_alert: telegram HTTP {r.status_code}: {r.text[:200]}",
                file=sys.stderr,
            )
            return False
        return True
    except Exception as e:
        print(f"earnings_alert: telegram exception — {e}", file=sys.stderr)
        return False


def main() -> int:
    load_dotenv()
    sb = db.client()

    # Watchlist
    try:
        res = sb.table("watchlist").select("symbol").execute()
        watchlist = {
            r["symbol"].upper() for r in (res.data or []) if r.get("symbol")
        }
    except Exception as e:
        print(f"earnings_alert: watchlist fetch failed — {e}", file=sys.stderr)
        return 1

    if not watchlist:
        print("earnings_alert: empty watchlist, exiting")
        return 0

    today = datetime.now(timezone.utc).date()
    end = today + timedelta(days=LOOKBACK_DAYS)
    cal = fetch_earnings_calendar(today.isoformat(), end.isoformat())
    print(
        f"earnings_alert: {len(cal)} earnings in {LOOKBACK_DAYS}d window, "
        f"watchlist={len(watchlist)}"
    )

    relevant = [
        c for c in cal if (c.get("symbol") or "").upper() in watchlist
    ]
    if not relevant:
        print("earnings_alert: no upcoming watchlist earnings — skipping send")
        return 0

    today_iso = today.isoformat()
    tomorrow_iso = (today + timedelta(days=1)).isoformat()

    today_evts = [c for c in relevant if c.get("date") == today_iso]
    tomorrow_evts = [c for c in relevant if c.get("date") == tomorrow_iso]
    later_evts = [
        c for c in relevant if c.get("date") not in (today_iso, tomorrow_iso)
    ]
    later_evts.sort(key=lambda c: c.get("date", ""))

    now_kst = datetime.now(timezone(timedelta(hours=9)))

    # Atomic content blocks. The packer below merges them into telegram-sized
    # messages without splitting any single block — keeps each event entry
    # intact across message boundaries. With 100-symbol watchlists the
    # this-week section can easily blow past 4096 chars; this is the
    # defensive split.
    blocks: list[str] = [
        f"📅 *어닝 캘린더 알림* ({now_kst.strftime('%Y-%m-%d %H:%M KST')})\n"
        f"watchlist {len(watchlist)}종목 중 7일 내 어닝 {len(relevant)}건"
    ]

    if today_evts:
        today_lines = ["🚨 *오늘 어닝 (D-day)*"]
        for c in today_evts:
            sym = (c.get("symbol") or "?").upper()
            today_lines.append(
                f"• *{sym}*  {fmt_hour(c.get('hour') or '')}  {fmt_eps(c.get('epsEstimate'))}"
            )
            today_lines.append(f"  [→ AI 분석]({FRONT_URL}/trade?symbol={sym})")
        blocks.append("\n".join(today_lines))

    if tomorrow_evts:
        tom_lines = ["⏰ *내일 어닝 (D+1)*"]
        for c in tomorrow_evts:
            sym = (c.get("symbol") or "?").upper()
            tom_lines.append(
                f"• *{sym}*  {fmt_hour(c.get('hour') or '')}  {fmt_eps(c.get('epsEstimate'))}"
            )
            tom_lines.append(f"  [→ AI 분석]({FRONT_URL}/trade?symbol={sym})")
        blocks.append("\n".join(tom_lines))

    if later_evts:
        later_lines = [
            f"📆 *이번 주 미리보기 (D+2 ~ D+{LOOKBACK_DAYS}, {len(later_evts)}건)*"
        ]
        for c in later_evts:
            sym = (c.get("symbol") or "?").upper()
            d = c.get("date") or ""
            hour = (c.get("hour") or "").upper()
            hour_str = f" ({hour})" if hour else ""
            est = c.get("epsEstimate")
            est_str = f" · EPS ${est:.2f}" if est is not None else ""
            later_lines.append(f"• {d}: *{sym}*{hour_str}{est_str}")
        blocks.append("\n".join(later_lines))

    blocks.append(f"[전체 워치리스트 →]({FRONT_URL}/trade)")

    messages = pack_messages(blocks)
    print(
        f"earnings_alert: today={len(today_evts)} tomorrow={len(tomorrow_evts)} "
        f"later={len(later_evts)} → {len(messages)} telegram messages"
    )
    sent_ok = 0
    for i, msg in enumerate(messages, 1):
        ok = send_telegram(msg)
        if ok:
            sent_ok += 1
        print(
            f"earnings_alert: msg {i}/{len(messages)} sent={ok} ({len(msg)} chars)"
        )
        if i < len(messages):
            time.sleep(1)
    return 0 if sent_ok == len(messages) else 1


def pack_messages(blocks: list[str], cap: int = TG_MSG_CHAR_CAP) -> list[str]:
    """Greedy-pack atomic blocks into telegram-sized messages. A block is
    never split — exceeding `cap` mid-block just bumps that block to the
    next message. Mirrors the same helper in ai_scan.py.
    """
    msgs: list[str] = []
    current: list[str] = []
    current_len = 0
    for block in blocks:
        block_len = len(block) + 2  # the "\n\n" separator
        if current and current_len + block_len > cap:
            msgs.append("\n\n".join(current))
            current = []
            current_len = 0
        current.append(block)
        current_len += block_len
    if current:
        msgs.append("\n\n".join(current))
    return msgs


if __name__ == "__main__":
    sys.exit(main())
