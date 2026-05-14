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

# Hard safety cap on scan size. Real per-scan size is controlled by
# SCAN_BUDGET below — this just protects against runaway list growth.
MAX_SYMBOLS_PER_RUN = int(os.getenv("AI_SCAN_MAX_SYMBOLS", "100"))

# Target scan size per run. Sized so 3 runs/day stay comfortably inside
# the free Gemini quota (250 RPD primary + 250 RPD fallback = 500 RPD;
# 25 × 3 = 75 calls/day = 15% of budget) WITH the quality-only model
# chain (no fallback to lighter models). Composition:
#   watchlist (all)               + 0 to len(watchlist) symbols
#   top signals_24h by conviction + the rest, up to SCAN_BUDGET total
# If watchlist alone exceeds SCAN_BUDGET, watchlist symbols still all
# get analyzed (the per-scan ceiling is MAX_SYMBOLS_PER_RUN above).
SCAN_BUDGET = int(os.getenv("AI_SCAN_BUDGET", "25"))

# Conviction-score weights for signal-24h selection. Computed per signal
# row as:
#   score = volume_ratio × |pct_change| × news_factor
# - volume_ratio captures how outlier today's bar is vs the rolling avg
#   (volume_spike's defining metric, also strong on gap+vol confirmations)
# - |pct_change| captures gap magnitude (works for gap_up and gap_down)
# - news_factor is a modest catalyst bonus — 1.2× not 1.5× because we
#   don't have measured proof that news-confirmed signals outperform
#   non-news ones yet (the comparison is starting to populate as
#   realized_* backfill catches up). Re-tune from /stats data later.
#
# Dollar volume is NOT in the score: signals don't store the raw bar
# volume so we can't compute price × volume per row. The signal
# detector's MIN_DOLLAR_VOL gate ($1M default) already ensures every
# row in the pool meets the liquidity baseline.
NEWS_FACTOR = float(os.getenv("AI_SCAN_NEWS_FACTOR", "1.2"))

# Per-call HTTP timeout. The /api/analyze route's maxDuration is 60s on
# Vercel; the buffer here gives us a clean error rather than a half-read
# response if Vercel kills the request.
ANALYZE_TIMEOUT_SEC = 75

# Pause between calls. Sized to stay under Gemini's per-model RPM ceiling
# even when signals_24h pushes the target list to 80-100 symbols. The
# primary model (gemini-2.5-flash) caps at 10 RPM on free tier, so we
# need ≥ 6s/call (= 10 RPM). 7s adds a safety margin against:
#   - clock drift between worker and Google's rate-limit window
#   - the gemini.ts retry-on-429 logic firing twice in quick succession
#   - parallel watchlist refresh + analyze button activity from the user
# Cost: ~12s × 90 symbols ≈ 11min/run, comfortably within the 75min
# workflow timeout. Was 2s, which routinely tripped the 10 RPM ceiling
# and cascaded into the 5-consecutive-fail early-abort.
INTER_CALL_DELAY_SEC = 7

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


def _conviction_score(row: dict) -> float:
    """Score a signals-table row for conviction. Higher = more worth analyzing.

    Inputs:
      volume_ratio       — multiplier vs 20-bar avg (volume_spike strength)
      pct_change         — fractional move vs prev close (gap magnitude, signed)
      recent_news_count  — int (≥1 means catalyst present; null treated as 0)

    Formula: volume_ratio × |pct_change| × (NEWS_FACTOR if news else 1.0)
    """
    try:
        vr = float(row.get("volume_ratio") or 0)
        pc = abs(float(row.get("pct_change") or 0))
    except (TypeError, ValueError):
        return 0.0
    news_count = row.get("recent_news_count") or 0
    news_factor = NEWS_FACTOR if news_count > 0 else 1.0
    return vr * pc * news_factor


def collect_target_symbols(
    sb,
) -> tuple[list[str], set[str], set[str], int]:
    """Returns (target_list, watchlist_set, signals_set_all, signals_selected_count).

    Composition of target_list:
      1. ALL watchlist symbols (priority — these are user's active focus)
      2. signals_24h symbols ranked by conviction score, descending, taking
         enough to fill up to SCAN_BUDGET total
    Hard cap at MAX_SYMBOLS_PER_RUN for runaway protection.

    signals_set_all is the full 24h signal-fired set (used for digest header
    attribution: "X of Y signals selected"). signals_selected_count is the
    count actually included in target_list after conviction filtering.
    """
    watchlist: set[str] = set()
    try:
        res = sb.table("watchlist").select("symbol").execute()
        watchlist = {r["symbol"].upper() for r in (res.data or []) if r.get("symbol")}
    except Exception as e:
        print(f"  watchlist fetch failed: {e}", file=sys.stderr)

    # Pull signals_24h with full metadata for scoring. Z suffix avoids the
    # `+00:00 → space` URL-encoding trap that bit realize.py earlier.
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    raw_signals: list[dict] = []
    try:
        res = (
            sb.table("signals")
            .select("symbol,volume_ratio,pct_change,recent_news_count,ts")
            .gte("ts", cutoff)
            .execute()
        )
        raw_signals = res.data or []
    except Exception as e:
        print(f"  signals fetch failed: {e}", file=sys.stderr)

    # All distinct symbols in the 24h signal window (used for stats display).
    signals_set_all: set[str] = {
        (r.get("symbol") or "").upper() for r in raw_signals if r.get("symbol")
    }
    signals_set_all.discard("")

    # For each symbol, keep its BEST conviction score across however many
    # signals fired on it in 24h. Exclude symbols already in watchlist
    # (those get analyzed unconditionally, no need to score them).
    best_score: dict[str, float] = {}
    for r in raw_signals:
        sym = (r.get("symbol") or "").upper()
        if not sym or sym in watchlist:
            continue
        s = _conviction_score(r)
        if s > best_score.get(sym, -1.0):
            best_score[sym] = s

    # Build target list: watchlist (alphabetical for determinism) + top-N
    # signals by conviction score. Top-N count = SCAN_BUDGET - watchlist_size.
    wl_sorted = sorted(watchlist)
    remaining = max(0, SCAN_BUDGET - len(wl_sorted))
    ranked_signals = sorted(
        best_score.items(), key=lambda kv: kv[1], reverse=True
    )[:remaining]
    selected_signals = [sym for sym, _ in ranked_signals]
    targets = (wl_sorted + selected_signals)[:MAX_SYMBOLS_PER_RUN]
    return targets, watchlist, signals_set_all, len(selected_signals)


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
    signals_selected: int = 0,
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
    # Header explains exactly which symbols were picked: all watchlist, plus
    # the top-N conviction-ranked signals_24h. Lets the user verify nothing
    # important was silently filtered out.
    selection_summary = (
        f"watchlist {watchlist_n} + 시그널 24h {signals_n}건 중 conviction 상위 "
        f"{signals_selected}건"
        if signals_n > 0
        else f"watchlist {watchlist_n}"
    )
    header_lines = [
        f"🤖 *AI 일일 추천* ({now_kst.strftime('%Y-%m-%d %H:%M KST')})",
        f"스캔 종목: {total_scanned}건 ({selection_summary})",
    ]
    if aborted_early:
        header_lines.append(
            "⚠️ *부분 결과* — Gemini 한도 도달로 조기 중단 (분당 RPM 또는 일일 RPD). "
            "다음 스캔 (또는 다음날 PT 자정 = KST 16:00 리셋 후) 자동 재시도."
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
    signals_selected: int = 0,
    aborted_early: bool = False,
) -> list[str]:
    """Returns a list of telegram-sized messages (1 normal, 2-3 if dense)."""
    blocks = _build_blocks(
        verdicts,
        total_scanned,
        watchlist_n,
        signals_n,
        signals_selected,
        aborted_early,
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

    targets, watchlist, signals, signals_selected = collect_target_symbols(sb)
    print(
        f"ai_scan: {len(targets)} target symbols "
        f"(watchlist={len(watchlist)} + {signals_selected} of {len(signals)} "
        f"signals_24h by conviction score, budget={SCAN_BUDGET})"
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
        signals_selected=signals_selected,
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
