"""Twice-daily AI scan: call /api/analyze on the union of watchlist symbols
and the top-conviction signals_24h, then telegram-digest the resulting
BUY / SELL / HOLD verdicts.

Why: until now AI verdicts only existed when the user manually clicked
"분석" on a single ticker. There was no proactive "AI says BUY today"
output, so the trade journal couldn't link to anything and we couldn't
measure AI-recommendation accuracy. This worker fills the gap.

Cost & graceful degradation:
  - Each /api/analyze call is one gemini-2.5-flash request. No fallback
    model (gemini-flash-latest aliases to a 20-RPD preview — see
    apps/web/lib/gemini.ts comments). The route caches per symbol for
    5 minutes.
  - Free Gemini quota is 250 RPD on primary — sized so 60 × 3 = 180
    calls/day fits inside the budget with manual-click headroom
    (~20-30 calls/day) and 20% safety margin.
  - When quota IS exhausted (e.g., user clicked /api/analyze many times
    earlier in the PT day, or RPM ceiling hit by a parallel run), the
    scan flips to *stale-only mode*: instead of bombarding Gemini with
    retries, we pull each remaining symbol's last verdict from
    ai_analysis (≤24h old) and ship that with a "(N시간 전 · cached)"
    marker. Quality is preserved — those cached verdicts were generated
    by the same top-tier model chain a few hours ago. The user gets a
    COMPLETE digest instead of the old "부분 결과 — 조기 중단" banner.

Schedule (cron-job.org → workflow_dispatch, weekdays only):
  - 13:00 UTC = ET 09:00 = KST 22:00 (regular open in 30m)  ← primary
  - 21:00 UTC = ET 17:00 = KST 06:00 (after-hours done, next-day plan)
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

# Target scan size per run.
#
# CRITICAL DISCOVERY (2026-05-20): live 429 body inspection revealed that
# this project's gemini-2.5-flash FREE-TIER RPD is **20**, not the 250
# documented in Google's general docs:
#
#   "Quota exceeded for metric:
#    generativelanguage.googleapis.com/generate_content_free_tier_requests,
#    limit: 20, model: gemini-2.5-flash"
#   quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier
#
# Why 20 and not 250 — uncertain. Possibilities (any can apply):
#   a) Google reduced free RPD across projects (recent change)
#   b) Newer / unbilled projects get a smaller starting bucket
#   c) gemini-2.5-flash entered a different free-tier category
# What matters: our actual ceiling is 20 RPD, period.
#
# With 20 RPD as the hard limit, sizing options:
#   watchlist (6) × 3 scans = 18 calls/day = 90% (2 calls margin)
#   watchlist (6) × 2 scans = 12 calls/day = 60% (manual-click room)
#   watchlist (6) × 1 scan  =  6 calls/day = 30%
#
# Default = 6 (watchlist-only on every scan). signals_24h selection is
# effectively disabled at this RPD. To restore richer coverage:
#   - User enables Gemini billing → RPD jumps to 10K+ → bump back to 60
#   - OR override AI_SCAN_BUDGET env (will exhaust quota mid-day; stale-
#     fallback will fill remaining symbols from ai_analysis cache)
#
# Composition (priority order, unchanged):
#   1. watchlist (all)              — user's active focus
#   2. signals_24h by conviction    — fill remainder up to SCAN_BUDGET
SCAN_BUDGET = int(os.getenv("AI_SCAN_BUDGET", "6"))

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

# Pause between calls. Sized to stay under Gemini's INPUT-TOKENS-PER-MINUTE
# (TPM) ceiling, which turns out to be the actual binding constraint — NOT
# the RPM count. Free tier TPM = 250,000 input tokens/min per model.
#
# Our prompt is dense (17 sections: price/tech/macro/options/earnings/
# ratings/float+short/SEC 8-K/insider/own signals/news/watchlist) and
# typically runs ~30-50K input tokens per call.
#
# Math:
#   250K TPM ÷ 40K avg-per-call ≈ 6.25 calls/min max
#   60s ÷ 6.25 = 9.6s/call minimum spacing
#   15s gives ~4 calls/min × 40K = 160K TPM (safe margin)
#
# Was 7s — that gave ~8-9 calls/min × 40K = 320-360K TPM, blowing through
# the 250K ceiling and triggering 429 InputTokensPerMinute mid-scan.
# Symptom: digests came back with "ℹ️ N건 캐시 재사용" header banner
# because the worker hit 3 consecutive 429s and flipped to stale-only mode.
# Diagnosed 2026-05-19 from the 429 response body's QuotaFailure details
# (quotaId: GenerateContentInputTokensPerModelPerMinute-FreeTier).
#
# Cost: ~15s × 25 symbols = 6.25 min/scan, plus the analyze route's own
# data-fetch time (~5-20s per call). Total ~10-15 min per scan, still
# well within the 75-min workflow timeout.
#
# RPM(요청/분) is also 10/min on free tier, which is satisfied (we do ~4/min)
# RPD(요청/일) is 250/model, also satisfied (75/day from scans)
INTER_CALL_DELAY_SEC = 15

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


# How far back we'll reach into ai_analysis when a fresh Gemini call fails.
# Verdicts older than this are dropped silently — too stale to publish in
# what's labeled "AI 일일 추천."
#
# 24h is the sweet spot:
#   - Watchlist symbols get analyzed in every 8-hour scan, so a stale fall-
#     back is at most ~8h old (≪ 24h) under normal cadence
#   - Across an entire quota-burned PT day, the oldest still-valid verdict
#     was generated this morning's KST 17:00 scan = ~7h ago — well inside
#     the window
#   - Beyond 24h, market context (overnight earnings, gap moves, macro
#     releases) has shifted enough that the verdict is misleading
STALE_FALLBACK_MAX_AGE_HOURS = 24


def fetch_stale_verdict(sb, symbol: str) -> dict | None:
    """Look up the most recent ai_analysis row for `symbol` within the
    stale-fallback window. Returns a dict shaped like /api/analyze's
    `analysis` response + a `created_at` timestamp, or None.

    Used as fallback when Gemini quota is exhausted: we'd rather ship the
    last fresh-quality verdict (generated maybe a few hours ago, still
    high-quality because it came from the same gemini-2.5-flash chain)
    than abort the scan and show "부분 결과" banner. Quality > recency
    when the alternative is no data at all.
    """
    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=STALE_FALLBACK_MAX_AGE_HOURS)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        res = (
            sb.table("ai_analysis")
            .select("symbol,verdict,confidence,summary,created_at")
            .eq("symbol", symbol)
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as e:
        print(f"    stale lookup({symbol}) failed: {e}", file=sys.stderr)
        return None
    rows = res.data or []
    if not rows:
        return None
    row = rows[0]
    return {
        "verdict": row.get("verdict") or "hold",
        "confidence": row.get("confidence") or 0,
        "summary": row.get("summary") or "",
        "created_at": row.get("created_at"),
    }


def _stale_age_label(created_at_iso: str | None) -> str:
    """Render a short relative-time label, e.g. '3시간 전' or '어제'.
    Empty string if input is missing or unparseable."""
    if not created_at_iso:
        return ""
    try:
        # ai_analysis.created_at is timestamptz; Supabase returns ISO-8601
        # with timezone. Python's fromisoformat handles +HH:MM and Z (3.11+).
        ts = datetime.fromisoformat(created_at_iso.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return ""
    delta = datetime.now(timezone.utc) - ts
    hours = int(delta.total_seconds() // 3600)
    if hours < 1:
        return "방금 전"
    if hours < 24:
        return f"{hours}시간 전"
    days = hours // 24
    return f"{days}일 전"


# Per-summary cap. The AI summary is usually 200-400 chars in Korean;
# 280 fits 3-4 telegram lines and reads as a complete thought rather
# than a sentence trailing into "...". The packer below splits into
# multiple messages if the total overshoots telegram's 4096-char limit.
SUMMARY_CHAR_CAP = 280

# Telegram hard cap is 4096; we leave a little headroom for markdown
# formatting overhead and a safe truncation point.
TG_MSG_CHAR_CAP = 3900


def _md_safe(text: str) -> str:
    """Strip/escape Telegram Markdown special chars from free-form text.

    Telegram Markdown treats unmatched `*`, `_`, `` ` ``, `[`, `]` as
    formatting tokens. AI-generated summaries occasionally contain a
    bare `*` (e.g., "$AAPL*콜옵션*") that opens a bold entity without
    closing it. When such a summary lands past the 4000-byte message
    cap, the parser reports 'Can't find end of the entity' → 400 error
    → entire digest fails to send (ai-scan workflow then exits non-zero
    even though all Gemini work succeeded).

    Safest fix is to neutralize the formatting metachars in user-content
    text. We keep the dedicated formatting (`*BOLD*`, `_italic_`) that
    our format strings emit; only the AI-generated body text is sanitized.

    Diagnosed 2026-05-19 from the 05-18 16:31 KST scan run that failed
    with "Bad Request: can't parse entities" at byte offset 4032.
    """
    if not text:
        return ""
    # Telegram Markdown metachars: `*` (bold), `_` (italic), `[` (link),
    # `` ` `` (code). Strip them to avoid unmatched-entity errors.
    return (
        text.replace("*", "·")
            .replace("_", " ")
            .replace("`", "'")
            .replace("[", "(")
            .replace("]", ")")
    )


def _format_entry(v: dict) -> str:
    """One BUY/SELL entry block — symbol header + summary if present.

    If the verdict came from the stale-fallback path (Gemini quota was
    exhausted, we reused the last fresh ai_analysis row), append a
    "(N시간 전)" marker so the user knows the verdict isn't from this
    minute's data. Quality is unchanged — the verdict was generated by
    the same quality-first model chain a few hours ago.
    """
    sym = v.get("symbol", "?")
    conf = int(round(float(v.get("confidence") or 0) * 100))
    summary = _md_safe((v.get("summary") or "").strip())
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
    if v.get("stale"):
        age = _stale_age_label(v.get("created_at"))
        line += f"  _({age} · cached)_" if age else "  _(cached)_"
    if summary:
        line += f"\n  _{summary}_"
    return line


def _build_blocks(
    verdicts: list[dict],
    total_scanned: int,
    watchlist_n: int,
    signals_n: int,
    signals_selected: int = 0,
    stale_count: int = 0,
    missing_count: int = 0,
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
    if stale_count > 0:
        # Informational only — quality is preserved (cached verdicts came
        # from the same gemini-2.5-flash chain, just generated earlier).
        # No "부분 결과" framing because the digest IS complete.
        header_lines.append(
            f"ℹ️ {stale_count}건은 Gemini 한도 보호 차원에서 최근 캐시 verdict 재사용 "
            "(각 항목에 시점 표시)."
        )
    if missing_count > 0:
        # Symbols that had neither a fresh call success nor a cached verdict
        # within 24h. Rare — only happens for brand-new signal symbols when
        # quota is exhausted.
        header_lines.append(
            f"⚠️ {missing_count}건은 신규 종목 + Gemini 한도로 verdict 생성 실패. "
            "다음 스캔 (KST 16:00 PT-자정 quota 리셋) 자동 재시도."
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
    stale_count: int = 0,
    missing_count: int = 0,
) -> list[str]:
    """Returns a list of telegram-sized messages (1 normal, 2-3 if dense)."""
    blocks = _build_blocks(
        verdicts,
        total_scanned,
        watchlist_n,
        signals_n,
        signals_selected,
        stale_count,
        missing_count,
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


def _pt_day_quota_used(sb) -> int:
    """Count ai_analysis rows inserted since the current PT midnight.

    Each row = one SUCCESSFUL gemini-2.5-flash call (the analyze route
    inserts on success only). Gemini free-tier RPD resets at PT midnight
    (PDT during May-Nov = UTC 07:00 = KST 16:00; PST in winter = UTC 08:00).

    This is our self-protection signal: if we've already consumed close
    to the 20-RPD ceiling earlier in the day, the scan should auto-shrink
    its budget (or skip the Gemini calls entirely) so it doesn't blow
    through whatever's left and leave the next scan with zero quota.
    """
    from datetime import datetime, timezone, timedelta as td
    now = datetime.now(timezone.utc)
    # PDT midnight in UTC = 07:00. Approximate (don't need exactness — being
    # off by 1h just means our count window is 1h short, which is conservative).
    pt_midnight = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now < pt_midnight:
        pt_midnight -= td(days=1)
    cutoff = pt_midnight.strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        res = (
            sb.table("ai_analysis")
            .select("id", count="exact")
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        return int(res.count or 0)
    except Exception as e:
        print(f"  quota usage lookup failed: {e}", file=sys.stderr)
        return 0  # fail-open: don't block the scan on a DB hiccup


# Hard free-tier RPD ceiling for gemini-2.5-flash on this project
# (live-verified 2026-05-20 via 429 body: "limit: 20").
GEMINI_FREE_RPD = int(os.getenv("GEMINI_FREE_RPD", "20"))

# Margin to preserve for user manual /api/analyze clicks during the day.
# User reported typical usage is 1-2 clicks/day, so 3 gives a 50% headroom.
MANUAL_CLICK_RESERVE = int(os.getenv("AI_SCAN_MANUAL_RESERVE", "3"))


def main() -> int:
    load_dotenv()
    sb = db.client()

    targets, watchlist, signals, signals_selected = collect_target_symbols(sb)

    # ─── Self-protecting budget ────────────────────────────────────────────
    # Check actual PT-day Gemini consumption from ai_analysis and shrink
    # this scan's budget so we never exceed GEMINI_FREE_RPD - MANUAL_RESERVE,
    # regardless of how SCAN_BUDGET is configured. This is the safety net
    # that prevents a misconfigured SCAN_BUDGET (or yesterday's lingering
    # bad config) from blowing through quota and starving the next scan.
    used = _pt_day_quota_used(sb)
    available = GEMINI_FREE_RPD - MANUAL_CLICK_RESERVE - used
    if available <= 0:
        print(
            f"ai_scan: quota guard — {used}/{GEMINI_FREE_RPD} already used "
            f"this PT day, {MANUAL_CLICK_RESERVE} reserved for manual clicks. "
            f"Entering stale-only mode for this entire scan to preserve "
            f"remaining quota for user clicks and the next scheduled scan.",
            file=sys.stderr,
        )
        effective_budget = 0
    elif available < len(targets):
        print(
            f"ai_scan: quota guard — {used}/{GEMINI_FREE_RPD} already used, "
            f"shrinking this scan's fresh-call budget from {len(targets)} "
            f"to {available} (rest will be served from ai_analysis cache).",
            file=sys.stderr,
        )
        effective_budget = available
    else:
        effective_budget = len(targets)

    print(
        f"ai_scan: {len(targets)} target symbols "
        f"(watchlist={len(watchlist)} + {signals_selected} of {len(signals)} "
        f"signals_24h by conviction score, budget={SCAN_BUDGET}, "
        f"effective_fresh_budget={effective_budget}, "
        f"pt_day_used={used}/{GEMINI_FREE_RPD})"
    )

    if not targets:
        print("ai_scan: no symbols to scan, exiting")
        return 0

    # Quota-aware degraded mode: when Gemini's free quota is exhausted,
    # additional /api/analyze calls just burn 429-retry slots and contribute
    # nothing. After N consecutive fresh failures we flip into "stale-only"
    # mode for the rest of the scan: skip Gemini entirely, just pull each
    # remaining symbol's last fresh verdict from ai_analysis (≤24h old).
    #
    # 2026-05-20 tuning: bumped 3 → 5 + added a 75s recovery wait + probe
    # before committing to stale-only. The 22:00 KST scan that day hit a
    # transient per-minute 429 on the very first call (likely from a
    # debugging burst minutes earlier) and immediately flipped to stale-only,
    # producing fresh=0/stale=14/missing=11. Probing the same key 75s
    # later showed 200 OK — quota had recovered. The new logic gives that
    # recovery window a chance:
    #   1) On 5 consecutive failures, sleep RECOVERY_WAIT_SEC
    #   2) Probe one symbol fresh
    #   3) If probe succeeds, reset counter and keep going (transient burst)
    #   4) If probe fails too, then commit to stale-only for the rest
    CONSECUTIVE_FAIL_TO_DEGRADE = 5
    RECOVERY_WAIT_SEC = 75  # matches gemini.ts per-minute cooldown duration

    verdicts: list[dict] = []
    missing: list[str] = []  # no fresh AND no stale verdict — truly dropped
    consecutive_failures = 0
    # Enter stale-only mode immediately if quota guard says we have no budget.
    stale_only_mode = effective_budget == 0
    fresh_count = 0
    stale_count = 0
    started = time.time()

    for i, sym in enumerate(targets, 1):
        elapsed = int(time.time() - started)
        analysis: dict | None = None
        used_stale = False

        # Pre-emptive budget check: if we've already made effective_budget
        # fresh calls, switch to stale-only for the rest. This is the
        # belt-and-suspenders complement to the quota-guard at scan start.
        if fresh_count >= effective_budget and not stale_only_mode:
            stale_only_mode = True
            remaining = len(targets) - i + 1
            print(
                f"  ⏹ reached effective_fresh_budget={effective_budget}; "
                f"remaining {remaining} symbols → stale-only (preserves "
                f"quota for manual clicks and next scan)",
                file=sys.stderr,
                flush=True,
            )

        if not stale_only_mode:
            print(
                f"  [{i}/{len(targets)}] analyze {sym} (elapsed {elapsed}s)",
                flush=True,
            )
            analysis = call_analyze(sym)
            if analysis:
                consecutive_failures = 0
            else:
                consecutive_failures += 1
                if consecutive_failures >= CONSECUTIVE_FAIL_TO_DEGRADE:
                    # Before giving up: a per-minute (TPM/RPM) 429 clears in
                    # ~60s while a per-day (RPD) 429 won't. Wait the cooldown
                    # window, then probe ONCE — if the probe succeeds we
                    # have transient burst, not real RPD exhaustion. Reset
                    # the counter and continue normally.
                    print(
                        f"  ⏸ {consecutive_failures} consecutive failures — "
                        f"waiting {RECOVERY_WAIT_SEC}s for possible per-minute "
                        f"quota recovery before committing to stale-only mode",
                        file=sys.stderr,
                        flush=True,
                    )
                    time.sleep(RECOVERY_WAIT_SEC)
                    probe = call_analyze(sym)
                    if probe:
                        print(
                            f"  ✓ recovery probe on {sym} succeeded — quota was "
                            f"transient (RPM/TPM), continuing normally",
                            file=sys.stderr,
                            flush=True,
                        )
                        analysis = probe
                        consecutive_failures = 0
                    else:
                        stale_only_mode = True
                        remaining = len(targets) - i
                        print(
                            f"  ! recovery probe also failed — likely RPD "
                            f"exhaustion. Switching to stale-only mode for "
                            f"remaining {remaining} symbols to preserve next "
                            f"scan's quota; will pull cached verdicts from "
                            f"ai_analysis.",
                            file=sys.stderr,
                            flush=True,
                        )
        else:
            # In degraded mode: don't call Gemini at all. Just log briefly.
            print(
                f"  [{i}/{len(targets)}] stale-only {sym} (elapsed {elapsed}s)",
                flush=True,
            )

        # If no fresh result, fall back to most recent ai_analysis row.
        if not analysis:
            stale_row = fetch_stale_verdict(sb, sym)
            if stale_row:
                analysis = stale_row
                used_stale = True
            else:
                missing.append(sym)
                # Don't sleep — no API call was made.
                continue

        verdicts.append(
            {
                "symbol": sym,
                "verdict": analysis.get("verdict") or "hold",
                "confidence": analysis.get("confidence") or 0,
                "summary": analysis.get("summary") or "",
                "stale": used_stale,
                "created_at": analysis.get("created_at") if used_stale else None,
            }
        )
        if used_stale:
            stale_count += 1
        else:
            fresh_count += 1
            # Inter-call delay only applies after a real Gemini call.
            time.sleep(INTER_CALL_DELAY_SEC)

    counts = {"buy": 0, "sell": 0, "hold": 0}
    for v in verdicts:
        counts[(v.get("verdict") or "hold").lower()] = counts.get(
            (v.get("verdict") or "hold").lower(), 0
        ) + 1
    print(
        f"ai_scan: collected {len(verdicts)} verdicts "
        f"(buy={counts.get('buy', 0)}, sell={counts.get('sell', 0)}, "
        f"hold={counts.get('hold', 0)}); fresh={fresh_count}, "
        f"stale={stale_count}, missing={len(missing)}"
    )
    if missing:
        head = ", ".join(missing[:20])
        print(f"  missing (no fresh + no cache): {head}{'…' if len(missing) > 20 else ''}")

    if not verdicts:
        print("ai_scan: no verdicts to send, skipping telegram", file=sys.stderr)
        return 1

    messages = format_digest(
        verdicts,
        total_scanned=len(targets),
        watchlist_n=len(watchlist),
        signals_n=len(signals),
        signals_selected=signals_selected,
        stale_count=stale_count,
        missing_count=len(missing),
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
