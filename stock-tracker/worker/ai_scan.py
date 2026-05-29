"""Twice-daily AI scan: call /api/analyze on the union of watchlist symbols
and the top-conviction signals_24h, then telegram-digest the resulting
BUY / SELL / HOLD verdicts.

Why: until now AI verdicts only existed when the user manually clicked
"분석" on a single ticker. There was no proactive "AI says BUY today"
output, so the trade journal couldn't link to anything and we couldn't
measure AI-recommendation accuracy. This worker fills the gap.

Always-fresh policy (2026-05-29):
  - Each /api/analyze call runs the 3-model Gemini chain
    (gemini-2.5-flash → flash-latest → flash-lite) defined in
    apps/web/lib/gemini.ts. When the primary 429s the route auto-falls
    back down the chain; the last tier (flash-lite, ~1,000 RPD) is a deep
    safety net, so real quota exhaustion is effectively impossible at our
    scan volume.
  - Because of that, this worker NO LONGER reuses cached ai_analysis
    verdicts. Every digest reflects a verdict generated from THIS run's
    live data — shipping a 24h-old "verdict" twice a day is misleading
    for both day- and swing-trading decisions.
  - If a symbol's call still fails (rare transient 5xx/timeout), it's
    listed under "verdict 생성 실패" with the reason and retried on the
    next scheduled scan — never silently backfilled from cache.

Schedule (cron-job.org → workflow_dispatch, weekdays only):
  - 08:00 UTC = ET 04:00 = KST 17:00 (pre-market session start)
  - 13:00 UTC = ET 09:00 = KST 22:00 (regular open in 30m)
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

# Target scan size per run: watchlist (all) + top conviction signals_24h
# to fill the remainder. Every target now gets a fresh /api/analyze call —
# the 3-model Gemini chain (see module docstring) absorbs quota via its
# flash-lite tier, so there's no per-day budget shrinking or cache reuse.
# SCAN_BUDGET just bounds how many symbols we cover per scan; the real cost
# is wall-clock time (~15s/call, see INTER_CALL_DELAY_SEC), well inside the
# workflow timeout.
#
# Composition (priority order):
#   1. watchlist (all)              — user's active focus
#   2. signals_24h by conviction    — fill remainder up to SCAN_BUDGET
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
# Symptom: mid-scan calls started failing with 429 once the worker hit the
# TPM ceiling, silently dropping those symbols from the digest.
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


# Failure-reason taxonomy. Returned alongside None when call_analyze fails,
# so the digest can show users *why* a verdict is missing instead of
# blanket-labeling everything as "Gemini 한도". Misleading copy was the user
# complaint that motivated this split (2026-05-21).
#
#   "quota_429"  — Gemini RPD/RPM/TPM ceiling. Quota actually exhausted.
#   "server_5xx" — Gemini 503/504 (server overload). Transient, not our fault.
#   "vercel_504" — analyze route timed out (60s maxDuration on Vercel).
#   "timeout"    — worker-side HTTP timeout (network slow / Vercel cold start).
#   "network"    — connection error to Vercel (DNS, TLS, refused).
#   "unknown"    — 4xx/5xx that doesn't match above patterns.
FAIL_REASON_QUOTA = "quota_429"
FAIL_REASON_COOLDOWN = "cooldown"
FAIL_REASON_5XX = "server_5xx"
FAIL_REASON_VERCEL_504 = "vercel_504"
FAIL_REASON_TIMEOUT = "timeout"
FAIL_REASON_NETWORK = "network"
FAIL_REASON_UNKNOWN = "unknown"


def _classify_failure(status: int | None, body: str) -> str:
    """Map an analyze-route failure to one of the FAIL_REASON_* constants.

    We inspect both the HTTP status from analyze (which is always 500 when
    Gemini fails) AND the embedded body string, because /api/analyze
    re-wraps Gemini's underlying error in its own 500 response with the
    original status code visible inside the message.
    """
    bod = (body or "").lower()
    if status == 504:
        return FAIL_REASON_VERCEL_504
    # All chain models were skipped on cooldown — gemini.ts emits an explicit
    # [all_models_cooldown] marker. This is a transient per-minute limit that
    # recovers within ~60-90s; the main loop takes a "breather" so the next
    # symbols can succeed. Checked BEFORE the generic 429 test because the
    # cooldown message also contains "rate-limit".
    if "all_models_cooldown" in bod or "쿨다운" in bod:
        return FAIL_REASON_COOLDOWN
    # The analyze route reflects Gemini's 429 inside the 500 wrapper as
    # "gemini 429 (model): ..." and the underlying RPD body has
    # "exceeded your current quota" / "quotaId: ...PerDay...".
    if "429" in bod or "exceeded your current quota" in bod or "rate-limit" in bod:
        return FAIL_REASON_QUOTA
    # Gemini server overload — our route translates this to the Korean
    # "Gemini 서버가 일시적으로 과부하 상태입니다" message before sending 500.
    if "과부하" in bod or "503" in bod or "overload" in bod or "unavailable" in bod:
        return FAIL_REASON_5XX
    return FAIL_REASON_UNKNOWN


# When Gemini returns 503 ("Gemini 서버가 일시적으로 과부하"), the burst
# usually clears within 30-60s. Without a retry, a 20-second Google
# datacenter blip would mark those symbols as missing for the whole scan
# even though quota was untouched — a needless "verdict 생성 실패" in the
# digest.
#
# Strategy: do ONE inline retry per symbol on 5xx/504 after a short sleep.
# Quota 429s and other reasons get NO retry (waste of quota / no recovery
# expected) — though with the 3-model chain a real RPD 429 is rare.
# 90초로 늘림 (이전 8초). gemini.ts의 PerMinute 쿨다운이 75초라
# 8초 후 retry하면 모델이 여전히 쿨다운 상태 → "gemini call failed" 즉시 반환.
# 90초 wait면 쿨다운 끝난 후 진짜 retry 가능. 2026-05-22 사례 (17:00 scan
# 모든 retry가 쿨다운 중 fast fail로 끝남) 직접 fix.
TRANSIENT_RETRY_WAIT_SEC = int(os.getenv("AI_SCAN_TRANSIENT_RETRY_WAIT", "90"))

# When a per-minute quota burst trips the whole Gemini chain into cooldown,
# the remaining symbols would otherwise rapid-fire (the main loop skips the
# inter-call delay on failure) and all fast-fail while the chain is still
# cooled. Instead, pause ONCE per occurrence to let the per-minute window
# clear, then continue — subsequent symbols then succeed. Capped via
# MAX_QUOTA_BREATHERS so a genuine per-DAY exhaustion doesn't make us sleep
# through the whole remaining list for nothing. (2026-05-30 fix: the 05-29
# 22:00 scan lost 14/16 remaining symbols when one burst at symbol 9 cooled
# all models for an hour and the rest rapid-fast-failed as "unknown".)
QUOTA_BREATHER_SEC = int(os.getenv("AI_SCAN_QUOTA_BREATHER", "75"))
MAX_QUOTA_BREATHERS = int(os.getenv("AI_SCAN_MAX_QUOTA_BREATHERS", "3"))


def _http_post_once(url: str, symbol: str) -> tuple[dict | None, str | None, int | None, str]:
    """Single POST attempt. Returns (analysis | None, fail_reason | None,
    http_status, body_snippet). Used by call_analyze for both initial + retry."""
    try:
        r = requests.post(url, json={"symbol": symbol}, timeout=ANALYZE_TIMEOUT_SEC)
    except requests.Timeout:
        return None, FAIL_REASON_TIMEOUT, None, ""
    except requests.RequestException as e:
        return None, FAIL_REASON_NETWORK, None, str(e)[:200]
    except Exception as e:
        return None, FAIL_REASON_UNKNOWN, None, str(e)[:200]

    if r.status_code == 200:
        try:
            return r.json().get("analysis"), None, 200, ""
        except Exception as e:
            return None, FAIL_REASON_UNKNOWN, 200, f"bad JSON: {e}"

    body = r.text[:500]
    return None, _classify_failure(r.status_code, body), r.status_code, body


def call_analyze(symbol: str) -> tuple[dict | None, str | None]:
    """POST /api/analyze with inline retry on transient 5xx.

    On success: (analysis, None)
    On failure: (None, one of FAIL_REASON_* constants)

    The caller uses fail_reason to bucket per-symbol outcomes so the digest
    header can show e.g. "1건은 신규 종목 + Gemini 한도 도달" vs
    "1건은 신규 종목 + Gemini 일시 서버 오류" with truthful copy.

    2026-05-22 added inline retry: when Gemini returns server_5xx, sleep
    TRANSIENT_RETRY_WAIT_SEC seconds and try once more before bubbling the
    failure. This keeps a transient blip (Google datacenter overload
    lasting 20-60s, 4-5 consecutive 5xx even though quota is wide open)
    from being recorded as a missing verdict.
    """
    url = f"{FRONT_URL}/api/analyze"
    analysis, reason, status, body = _http_post_once(url, symbol)

    # Transient로 회복 가능한 reason만 retry. quota_429는 즉시 fail (waste).
    # unknown 추가 (2026-05-22): 5xx 이후 같은 모델 cooldown 중 "gemini call
    # failed"가 unknown으로 분류되는데 실제론 cooldown 끝나면 회복 가능.
    # vercel_504 추가 (2026-05-28): analyze route 60s timeout. Gemini가
    # 일시적으로 느렸던 것이라 90s 후 재시도하면 대부분 회복 (5/28 17시
    # VST/NBIS가 504로 missing 됐던 케이스 fix).
    RETRYABLE = {FAIL_REASON_5XX, FAIL_REASON_UNKNOWN, FAIL_REASON_VERCEL_504}
    if analysis or reason not in RETRYABLE:
        if not analysis:
            print(f"    HTTP {status} reason={reason}: {body[:200]}", file=sys.stderr)
        return analysis, reason

    # Transient 5xx — single retry after short wait.
    print(
        f"    HTTP {status} reason={reason} on {symbol} — retrying once in "
        f"{TRANSIENT_RETRY_WAIT_SEC}s",
        file=sys.stderr,
    )
    time.sleep(TRANSIENT_RETRY_WAIT_SEC)
    analysis2, reason2, status2, body2 = _http_post_once(url, symbol)
    if analysis2:
        print(f"    ✓ retry on {symbol} succeeded", file=sys.stderr)
        return analysis2, None
    # Retry also failed — use the second attempt's reason (often same).
    print(
        f"    HTTP {status2} reason={reason2} (retry): {body2[:200]}", file=sys.stderr
    )
    return None, reason2


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
    """One BUY/SELL entry block — symbol header + summary if present."""
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
    if summary:
        line += f"\n  _{summary}_"
    return line


def _reason_label(reason: str) -> str:
    """Korean human-readable label per FAIL_REASON_* constant. Single source
    of truth so any header that breaks down by reason uses identical copy."""
    return {
        FAIL_REASON_QUOTA: "Gemini 일일 한도(RPD) 도달",
        FAIL_REASON_COOLDOWN: "Gemini 호출 한도·쿨다운 (일시적, 다음 스캔 재시도)",
        FAIL_REASON_5XX: "Gemini 서버 일시 오류 (5xx, 일시적)",
        FAIL_REASON_VERCEL_504: "Vercel 60s 타임아웃 (분석 처리 지연)",
        FAIL_REASON_TIMEOUT: "워커 HTTP 타임아웃 (네트워크)",
        FAIL_REASON_NETWORK: "네트워크 연결 오류",
        FAIL_REASON_UNKNOWN: "알 수 없는 오류",
    }.get(reason, reason)


def _format_reason_breakdown(counts: dict[str, int]) -> str:
    """Render a `{reason: n}` dict as `라벨1 N건 + 라벨2 M건` Korean copy."""
    if not counts:
        return ""
    parts = [f"{_reason_label(reason)} {n}건" for reason, n in counts.items() if n > 0]
    return " + ".join(parts)


def _build_blocks(
    verdicts: list[dict],
    total_scanned: int,
    watchlist_n: int,
    signals_n: int,
    signals_selected: int = 0,
    missing_list: list[dict] | None = None,
) -> list[str]:
    """Emit a list of atomic content blocks. The packer never splits inside
    a block — keeps each BUY/SELL entry intact across message boundaries.

    missing_list: [{symbol, reason}, ...] for symbols whose fresh /api/analyze
    call failed (rare transient). They're named in the header and retried on
    the next scan — never backfilled from cache.
    """
    missing_list = missing_list or []
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
    if missing_list:
        # Per-symbol breakdown when reasons differ; otherwise single bucket.
        miss_counts: dict[str, int] = {}
        for m in missing_list:
            miss_counts[m["reason"]] = miss_counts.get(m["reason"], 0) + 1
        reason_breakdown = _format_reason_breakdown(miss_counts)
        # 사용자 요청 — "외 N건" 축약 제거, 모든 티커 노출. missing은
        # SCAN_BUDGET(최대 25) 이내라 티커 전부 나열해도 telegram 4096자 한도
        # 안전 (25 × ~6자 = 150자).
        symbols_str = ", ".join(m["symbol"] for m in missing_list)
        header_lines.append(
            f"⚠️ {len(missing_list)}건 verdict 생성 실패 ({symbols_str}) — "
            f"{reason_breakdown}. 다음 스캔에서 자동 재시도."
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
    missing_list: list[dict] | None = None,
) -> list[str]:
    """Returns a list of telegram-sized messages (1 normal, 2-3 if dense)."""
    blocks = _build_blocks(
        verdicts,
        total_scanned,
        watchlist_n,
        signals_n,
        signals_selected,
        missing_list or [],
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

    # Always-fresh: every target gets a live /api/analyze call (3-model
    # Gemini chain). No quota guard, no stale-only mode, no cache reuse —
    # the chain's flash-lite tier (~1,000 RPD) makes real exhaustion a
    # non-issue, and a 24h-old verdict is misleading for twice-daily
    # trading decisions. call_analyze already does one inline retry on a
    # transient 5xx/504; anything that still fails is reported as missing
    # and picked up by the next scheduled scan.
    verdicts: list[dict] = []
    missing: list[dict] = []  # [{symbol, reason}, ...] — reason from call_analyze
    fail_reason_counts: dict[str, int] = {}
    fresh_count = 0
    breathers_used = 0  # quota/cooldown breathers taken this scan (capped)
    started = time.time()

    for i, sym in enumerate(targets, 1):
        elapsed = int(time.time() - started)
        print(
            f"  [{i}/{len(targets)}] analyze {sym} (elapsed {elapsed}s)",
            flush=True,
        )
        analysis, fail_reason = call_analyze(sym)
        if not analysis:
            reason = fail_reason or FAIL_REASON_UNKNOWN
            fail_reason_counts[reason] = fail_reason_counts.get(reason, 0) + 1
            missing.append({"symbol": sym, "reason": reason})
            # Per-minute quota/cooldown recovers within ~60-90s. Rather than
            # rapid-firing the rest of the list (which all fast-fail while the
            # chain is still cooled), pause once to let the window clear, then
            # keep going so later symbols succeed. Capped so a genuine per-day
            # exhaustion doesn't sleep through the whole remaining list.
            if (
                reason in (FAIL_REASON_QUOTA, FAIL_REASON_COOLDOWN)
                and breathers_used < MAX_QUOTA_BREATHERS
                and i < len(targets)
            ):
                breathers_used += 1
                print(
                    f"    quota/cooldown — breather {breathers_used}/"
                    f"{MAX_QUOTA_BREATHERS}, sleeping {QUOTA_BREATHER_SEC}s for "
                    f"per-minute window to clear",
                    file=sys.stderr,
                )
                time.sleep(QUOTA_BREATHER_SEC)
            continue  # no successful verdict → no normal inter-call delay

        verdicts.append(
            {
                "symbol": sym,
                "verdict": analysis.get("verdict") or "hold",
                "confidence": analysis.get("confidence") or 0,
                "summary": analysis.get("summary") or "",
            }
        )
        fresh_count += 1
        # Space calls out to stay under the primary model's per-minute
        # input-token (TPM) ceiling; the chain absorbs the rest.
        time.sleep(INTER_CALL_DELAY_SEC)

    counts = {"buy": 0, "sell": 0, "hold": 0}
    for v in verdicts:
        b = (v.get("verdict") or "hold").lower()
        counts[b] = counts.get(b, 0) + 1
    print(
        f"ai_scan: collected {len(verdicts)} verdicts "
        f"(buy={counts.get('buy', 0)}, sell={counts.get('sell', 0)}, "
        f"hold={counts.get('hold', 0)}); fresh={fresh_count}, "
        f"missing={len(missing)}"
    )
    if fail_reason_counts:
        print(f"  fail_reasons (fresh calls): {fail_reason_counts}")
    if missing:
        head = ", ".join(f"{m['symbol']}({m['reason']})" for m in missing[:20])
        print(f"  missing (call failed): {head}{'…' if len(missing) > 20 else ''}")

    if not verdicts:
        print("ai_scan: no verdicts to send, skipping telegram", file=sys.stderr)
        return 1

    messages = format_digest(
        verdicts,
        total_scanned=len(targets),
        watchlist_n=len(watchlist),
        signals_n=len(signals),
        signals_selected=signals_selected,
        missing_list=missing,
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
