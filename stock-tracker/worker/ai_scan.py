"""Twice-daily AI scan: call /api/analyze on the union of watchlist symbols
and any symbols that fired a signal in the last 24h, then telegram-digest
the resulting BUY / SELL / HOLD verdicts.

Why: until now AI verdicts only existed when the user manually clicked
"분석" on a single ticker. There was no proactive "AI says BUY today"
output, so the trade journal couldn't link to anything and we couldn't
measure AI-recommendation accuracy. This worker fills the gap.

Cost: each /api/analyze call is one Gemini-2.5-flash request. The route
already caches results for 5 minutes per symbol, so back-to-back scan
runs on the same ticker are free. Free Gemini quota is ~250 RPD per
model with a 4-model fallback chain, so 40 symbols × 2 runs/day stays
well within budget.

Schedule (GH Actions cron, .github/workflows/stock-tracker-ai-scan.yml):
  - 13:00 UTC = ET 09:00 = KST 22:00 (premarket close, before regular open)
  - 21:00 UTC = ET 17:00 = KST 06:00 (after-hours done, next-day planning)
Both weekdays only.
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

from lib import db

# Cap how many symbols we analyze per run. 100 covers the projected max
# watchlist size; at ~32s/call (analyze maxDuration 60s, typical 25-35s,
# plus 2s inter-call delay) the worst-case run is ~55 min, comfortably
# under the 75-min workflow timeout. Daily quota: 100 × 2 runs = 200 Gemini
# calls — fits inside the free 250 RPD per model with a 4-model fallback
# chain (~1000 RPD effective).
MAX_SYMBOLS_PER_RUN = int(os.getenv("AI_SCAN_MAX_SYMBOLS", "100"))

# Per-call HTTP timeout. The /api/analyze route's maxDuration is 60s on
# Vercel; the buffer here gives us a clean error rather than a half-read
# response if Vercel kills the request.
ANALYZE_TIMEOUT_SEC = 75

# Brief pause between calls so we don't hammer downstream APIs (Alpaca,
# Yahoo, Finnhub, FRED) all at once when the route fans out.
INTER_CALL_DELAY_SEC = 2

# Per-bucket safety cap. Set very high so in practice every analyzed
# symbol appears in the digest with its full reasoning — the per-message
# 3900-char cap + pack_messages() will just produce more telegram messages
# if needed. User explicitly wants no silent truncation; messages get
# split across 2-5 telegrams rather than dropping content.
DIGEST_MAX_PER_BUCKET = 200

DEFAULT_FRONT_URL = "https://stock-tracker-khaki-mu.vercel.app"
# `os.getenv(key, default)` only returns `default` when the key is unset,
# NOT when it's set to an empty string. GH Actions sets every env var even
# when its source secret is missing (yields ""), so we need an explicit
# `or` to fall back. Otherwise we end up POSTing to "/api/analyze" with
# no scheme and get "Invalid URL: No scheme supplied" on every call.
FRONT_URL = (os.getenv("FRONT_URL") or DEFAULT_FRONT_URL).rstrip("/")
TG_TOKEN = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
TG_CHAT_ID = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()


def collect_target_symbols(sb) -> tuple[list[str], set[str], set[str]]:
    """Returns (target_list, watchlist_set, signals_set).

    The two sets are returned alongside so the digest header can attribute
    counts to each source.
    """
    watchlist: set[str] = set()
    try:
        res = sb.table("watchlist").select("symbol").execute()
        watchlist = {r["symbol"].upper() for r in (res.data or []) if r.get("symbol")}
    except Exception as e:
        print(f"  watchlist fetch failed: {e}", file=sys.stderr)

    signals: set[str] = set()
    # Z suffix avoids the URL-encoding `+ → space` trap that silently
    # zeroed out realize.py's queries for ~5 days.
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    try:
        res = sb.table("signals").select("symbol").gte("ts", cutoff).execute()
        signals = {r["symbol"].upper() for r in (res.data or []) if r.get("symbol")}
    except Exception as e:
        print(f"  signals fetch failed: {e}", file=sys.stderr)

    targets = sorted(watchlist | signals)[:MAX_SYMBOLS_PER_RUN]
    return targets, watchlist, signals


def call_analyze(symbol: str) -> dict | None:
    """POST /api/analyze and return the `analysis` object (or None on failure)."""
    url = f"{FRONT_URL}/api/analyze"
    try:
        r = requests.post(url, json={"symbol": symbol}, timeout=ANALYZE_TIMEOUT_SEC)
        if r.status_code != 200:
            print(f"    HTTP {r.status_code}: {r.text[:200]}", file=sys.stderr)
            return None
        return r.json().get("analysis")
    except Exception as e:
        print(f"    analyze({symbol}) failed: {e}", file=sys.stderr)
        return None


# Per-summary cap. The AI summary is usually 200-400 chars in Korean;
# 280 fits 3-4 telegram lines and reads as a complete thought rather
# than a sentence trailing into "...". The packer below splits into
# multiple messages if the total overshoots telegram's 4096-char limit.
SUMMARY_CHAR_CAP = 280

# Telegram hard cap is 4096; we leave a little headroom for markdown
# formatting overhead and a safe truncation point.
TG_MSG_CHAR_CAP = 3900


def _format_entry(v: dict) -> str:
    """One BUY/SELL entry block — symbol header + summary if present."""
    sym = v.get("symbol", "?")
    conf = int(round(float(v.get("confidence") or 0) * 100))
    summary = (v.get("summary") or "").strip()
    if len(summary) > SUMMARY_CHAR_CAP:
        # Cut at the previous sentence boundary if there is one in the
        # last ~40 chars; otherwise hard-cut and append ellipsis.
        cut = summary[:SUMMARY_CHAR_CAP]
        last_period = max(cut.rfind(". "), cut.rfind("다. "), cut.rfind("다.\n"))
        if last_period > SUMMARY_CHAR_CAP - 40:
            summary = cut[: last_period + 2]
        else:
            summary = cut.rstrip() + "…"
    line = f"• *{sym}*  신뢰도 {conf}%"
    if summary:
        line += f"\n  _{summary}_"
    return line


def _build_blocks(
    verdicts: list[dict],
    total_scanned: int,
    watchlist_n: int,
    signals_n: int,
    aborted_early: bool = False,
) -> list[str]:
    """Emit a list of atomic content blocks. The packer never splits inside
    a block — keeps each BUY/SELL entry intact across message boundaries."""
    by_v: dict[str, list[dict]] = {"buy": [], "sell": [], "hold": []}
    for v in verdicts:
        bucket = (v.get("verdict") or "hold").lower()
        if bucket not in by_v:
            bucket = "hold"
        by_v[bucket].append(v)
    for k in by_v:
        by_v[k].sort(key=lambda x: float(x.get("confidence") or 0), reverse=True)

    now_kst = datetime.now(timezone(timedelta(hours=9)))
    header_lines = [
        f"🤖 *AI 일일 추천* ({now_kst.strftime('%Y-%m-%d %H:%M KST')})",
        f"스캔 종목: {total_scanned}건 "
        f"(watchlist {watchlist_n} ∪ signal-fired-24h {signals_n})",
    ]
    if aborted_early:
        header_lines.append(
            "⚠️ *부분 결과* — Gemini 무료 한도 소진으로 조기 중단. "
            "내일 PT 자정(KST 17:00) 한도 리셋 후 다음 스캔에서 전체 커버."
        )
    blocks: list[str] = ["\n".join(header_lines)]

    # All three buckets use the same per-entry block format now: symbol +
    # confidence + truncated summary. Section header is its own block so
    # the packer can split between header and entries if needed. No silent
    # drops — DIGEST_MAX_PER_BUCKET is a soft safety only.
    if by_v["buy"]:
        blocks.append(f"🟢 *BUY ({len(by_v['buy'])})*")
        for v in by_v["buy"][:DIGEST_MAX_PER_BUCKET]:
            blocks.append(_format_entry(v))

    if by_v["sell"]:
        blocks.append(f"🔴 *SELL ({len(by_v['sell'])})*")
        for v in by_v["sell"][:DIGEST_MAX_PER_BUCKET]:
            blocks.append(_format_entry(v))

    if by_v["hold"]:
        # HOLD is the "no clear edge" bucket — per-entry summaries would
        # bloat the digest without adding decision value. Compact format:
        # `TICKER(conf%)` tokens wrapped at ~60 chars/line, sorted by
        # confidence descending (same as BUY/SELL).
        hold_lines = [f"🟡 *HOLD ({len(by_v['hold'])})*"]
        entries: list[str] = []
        for v in by_v["hold"][:DIGEST_MAX_PER_BUCKET]:
            sym = v.get("symbol", "?")
            conf = int(round(float(v.get("confidence") or 0) * 100))
            entries.append(f"{sym}({conf}%)")
        line_buf: list[str] = []
        line_chars = 0
        for e in entries:
            if line_chars + len(e) + 1 > 60 and line_buf:
                hold_lines.append("  " + " ".join(line_buf))
                line_buf = []
                line_chars = 0
            line_buf.append(e)
            line_chars += len(e) + 1
        if line_buf:
            hold_lines.append("  " + " ".join(line_buf))
        blocks.append("\n".join(hold_lines))

    blocks.append(f"[전체 분석 →]({FRONT_URL}/trade)")
    return blocks


def pack_messages(blocks: list[str], cap: int = TG_MSG_CHAR_CAP) -> list[str]:
    """Greedy-pack blocks into telegram-sized messages. Each block stays
    intact; messages are separated wherever adding the next block would
    overshoot. Header is naturally on the first message."""
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


def format_digest(
    verdicts: list[dict],
    total_scanned: int,
    watchlist_n: int,
    signals_n: int,
    aborted_early: bool = False,
) -> list[str]:
    """Returns a list of telegram-sized messages (1 normal, 2-3 if dense)."""
    blocks = _build_blocks(
        verdicts, total_scanned, watchlist_n, signals_n, aborted_early
    )
    return pack_messages(blocks)


def send_telegram(text: str) -> bool:
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
                "parse_mode": "Markdown",
                "disable_web_page_preview": True,
            },
            timeout=15,
        )
        if r.status_code >= 300:
            print(
                f"  telegram failed [{r.status_code}]: {r.text[:200]}",
                file=sys.stderr,
            )
            return False
        return True
    except Exception as e:
        print(f"  telegram exception: {e}", file=sys.stderr)
        return False


def main() -> int:
    load_dotenv()
    sb = db.client()

    targets, watchlist, signals = collect_target_symbols(sb)
    print(
        f"ai_scan: {len(targets)} target symbols "
        f"(watchlist={len(watchlist)}, signals_24h={len(signals)})"
    )

    if not targets:
        print("ai_scan: no symbols to scan, exiting")
        return 0

    # Quota-aware early abort: when Gemini's free quota is exhausted, every
    # subsequent call burns ~8 retry slots (4 models × 2 attempts) on 429s
    # and contributes nothing. Once we see N consecutive failures we give
    # up on the rest of the scan and send whatever we got. Prevents one
    # bad day from cascading into "all 4 models locked out till tomorrow."
    EARLY_ABORT_CONSECUTIVE_FAILURES = 5

    verdicts: list[dict] = []
    failed: list[str] = []
    consecutive_failures = 0
    aborted_early = False
    started = time.time()

    for i, sym in enumerate(targets, 1):
        elapsed = int(time.time() - started)
        print(f"  [{i}/{len(targets)}] analyze {sym} (elapsed {elapsed}s)", flush=True)
        analysis = call_analyze(sym)
        if not analysis:
            failed.append(sym)
            consecutive_failures += 1
            if consecutive_failures >= EARLY_ABORT_CONSECUTIVE_FAILURES:
                aborted_early = True
                skipped = len(targets) - i
                print(
                    f"  ! {consecutive_failures} consecutive failures — likely Gemini quota "
                    f"exhausted; aborting remaining {skipped} symbols to preserve future runs",
                    file=sys.stderr,
                )
                break
            continue
        consecutive_failures = 0  # reset on any success
        verdicts.append(
            {
                "symbol": sym,
                "verdict": analysis.get("verdict") or "hold",
                "confidence": analysis.get("confidence") or 0,
                "summary": analysis.get("summary") or "",
            }
        )
        time.sleep(INTER_CALL_DELAY_SEC)

    counts = {"buy": 0, "sell": 0, "hold": 0}
    for v in verdicts:
        counts[(v.get("verdict") or "hold").lower()] = counts.get(
            (v.get("verdict") or "hold").lower(), 0
        ) + 1
    print(
        f"ai_scan: collected {len(verdicts)} verdicts "
        f"(buy={counts.get('buy', 0)}, sell={counts.get('sell', 0)}, "
        f"hold={counts.get('hold', 0)}), failed={len(failed)}"
    )
    if failed:
        head = ", ".join(failed[:20])
        print(f"  failed: {head}{'…' if len(failed) > 20 else ''}")

    if not verdicts:
        print("ai_scan: no verdicts to send, skipping telegram", file=sys.stderr)
        return 1

    messages = format_digest(
        verdicts,
        total_scanned=len(targets),
        watchlist_n=len(watchlist),
        signals_n=len(signals),
        aborted_early=aborted_early,
    )
    sent_ok = 0
    for i, msg in enumerate(messages, 1):
        ok = send_telegram(msg)
        if ok:
            sent_ok += 1
        print(
            f"ai_scan: telegram msg {i}/{len(messages)} sent={ok} ({len(msg)} chars)"
        )
        # Brief gap between messages so they arrive in order on slow networks.
        if i < len(messages):
            time.sleep(1)
    return 0 if sent_ok == len(messages) else 1


if __name__ == "__main__":
    sys.exit(main())
