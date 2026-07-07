"""Twice-daily AI scan → high-conviction telegram digest (2026-07 개편).

Two-stage funnel over the NASDAQ-100 (+watchlist):
  1. CHEAP mechanical pre-filter (no LLM cost):
       - momentum screen: NDX-100 daily bars → relative volume ≥ threshold,
         positive last-session return, above/below SMA20 weighting
       - strong-sector screen: /api/sector-strength top sectors' highest
         dollar-volume names ∩ NDX-100 (돈이 몰리는 섹터의 주도주)
       - top-conviction signals_24h ∩ NDX-100
       - watchlist (always, user's active focus)
     → ~15-20 candidates max.
  2. Gemini deep analysis per candidate via /api/analyze (options call/put
     skew, insider, news, technicals, sector ctx — 17 sections) → verdict +
     confidence + trade_plan (진입존/목표1·2/손절/기간, ATR-검증됨).

Digest gates (only conviction survives; the rest collapses to one line):
  🎯 강한 매수  buy  & conf ≥ CONF_STRONG (0.70)
  🟢 매수 후보  buy  & conf ≥ CONF_BUY    (0.55)
  🔴 매도/정리  sell & conf ≥ CONF_SELL   (0.55)
  🟡 관망       everything else — symbols only, one line
Market regime (𝑓 /api/regime) heads the digest; in risk_off both buy
thresholds are raised +0.10 (하락추세에선 더 확실한 것만).

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

from lib import alpaca, db

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

# ── Conviction-funnel knobs (2026-07 개편) ──────────────────────────────────
# Momentum screen: last-session relative volume floor + how many top-scoring
# NDX names advance to Gemini.
MIN_RELVOL = float(os.getenv("AI_SCAN_MIN_RELVOL", "1.3"))
MOMO_TOP = int(os.getenv("AI_SCAN_MOMO_TOP", "8"))
# Strong-sector screen: top-N sectors by avgReturn from /api/sector-strength;
# their top dollar-volume names ∩ NDX advance (cap).
SECTOR_TOP = int(os.getenv("AI_SCAN_SECTOR_TOP", "4"))
SECTOR_SYMS_CAP = int(os.getenv("AI_SCAN_SECTOR_SYMS_CAP", "6"))
# Digest confidence gates. In risk_off regime the two buy gates get +0.10.
CONF_STRONG = float(os.getenv("AI_SCAN_CONF_STRONG", "0.70"))
CONF_BUY = float(os.getenv("AI_SCAN_CONF_BUY", "0.55"))
CONF_SELL = float(os.getenv("AI_SCAN_CONF_SELL", "0.55"))

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


def _fetch_regime() -> dict | None:
    """GET /api/regime — fail-soft (None on any error)."""
    try:
        r = requests.get(f"{FRONT_URL}/api/regime", timeout=30)
        if r.status_code != 200:
            return None
        d = r.json()
        return d if d.get("regime") else None
    except Exception:
        return None


def _fetch_strong_sectors() -> list[dict]:
    """GET /api/sector-strength → top SECTOR_TOP sectors (already sorted by
    avgReturn desc server-side). Fail-soft (empty list)."""
    try:
        r = requests.get(f"{FRONT_URL}/api/sector-strength", timeout=60)
        if r.status_code != 200:
            return []
        sectors = (r.json() or {}).get("sectors") or []
        out = [s for s in sectors if s.get("avgReturn") is not None][:SECTOR_TOP]
        return out
    except Exception:
        return []


def _score_ndx_momentum(ndx: set[str]) -> dict[str, dict]:
    """Last-session momentum/relative-volume screen over the NDX-100 proxy.

    One batched Alpaca daily-bars fetch. Note the ~15min free-tier delay
    means "today" is the last COMPLETED session during pre-market scans —
    intentional: we're ranking where money flowed in the latest session.
    Returns {sym: {ret1, rel_vol, above_sma20, score}}.
    """
    out: dict[str, dict] = {}
    if not ndx:
        return out
    try:
        frames = alpaca.fetch_recent_bars(sorted(ndx), interval="1d", lookback="35d")
    except Exception as e:
        print(f"  ndx momentum bars fetch failed: {e}", file=sys.stderr)
        return out
    for sym, df in frames.items():
        try:
            if df is None or len(df) < 21:
                continue
            closes = df["Close"]
            vols = df["Volume"]
            last_close = float(closes.iloc[-1])
            prev_close = float(closes.iloc[-2])
            if prev_close <= 0 or last_close <= 0:
                continue
            ret1 = last_close / prev_close - 1
            avg20 = float(vols.iloc[-21:-1].mean())
            rel_vol = float(vols.iloc[-1]) / avg20 if avg20 > 0 else 0.0
            sma20 = float(closes.iloc[-20:].mean())
            above = last_close > sma20
            score = rel_vol * max(ret1, 0.0) * (1.2 if above else 0.8)
            out[sym] = {
                "ret1": ret1,
                "rel_vol": rel_vol,
                "above_sma20": above,
                "score": score,
            }
        except Exception:
            continue
    return out


def collect_conviction_targets(
    sb,
) -> tuple[list[str], dict[str, list[str]], dict[str, int]]:
    """Two-stage funnel, stage 1 (cheap): assemble the candidate list that
    advances to Gemini. Returns (targets, tags_by_symbol, source_counts).

    Sources (in priority order, dedup by first tag):
      1. watchlist — always analyzed (user's active focus; not NDX-gated)
      2. NDX momentum screen — rel_vol ≥ MIN_RELVOL and positive last-session
         return, top MOMO_TOP by rel_vol × return score
      3. strong sectors' top dollar-volume names ∩ NDX (≤ SECTOR_SYMS_CAP)
      4. signals_24h ∩ NDX by conviction score — fills up to SCAN_BUDGET
    """
    tags: dict[str, list[str]] = {}
    counts = {"watchlist": 0, "momentum": 0, "sector": 0, "signal": 0}

    def add(sym: str, tag: str, bucket: str) -> None:
        if sym not in tags:
            tags[sym] = []
            counts[bucket] += 1
        tags[sym].append(tag)

    # 1) watchlist
    watchlist: set[str] = set()
    try:
        res = sb.table("watchlist").select("symbol").execute()
        watchlist = {r["symbol"].upper() for r in (res.data or []) if r.get("symbol")}
    except Exception as e:
        print(f"  watchlist fetch failed: {e}", file=sys.stderr)
    for sym in sorted(watchlist):
        add(sym, "관심종목", "watchlist")

    # NDX-100 proxy set — gate for every non-watchlist source.
    try:
        ndx = db.get_nasdaq_top100(sb)
    except Exception as e:
        print(f"  ndx fetch failed: {e}", file=sys.stderr)
        ndx = set()

    # 2) momentum screen
    momo = _score_ndx_momentum(ndx)
    ranked = sorted(
        (
            (sym, m)
            for sym, m in momo.items()
            if m["rel_vol"] >= MIN_RELVOL and m["ret1"] > 0
        ),
        key=lambda kv: kv[1]["score"],
        reverse=True,
    )[:MOMO_TOP]
    for sym, m in ranked:
        add(
            sym,
            f"모멘텀 vol×{m['rel_vol']:.1f} {m['ret1']*100:+.1f}%",
            "momentum",
        )

    # 3) strong sectors' leaders ∩ NDX
    sector_added = 0
    for sec in _fetch_strong_sectors():
        label = sec.get("labelKo") or sec.get("key") or "?"
        for row in (sec.get("topByDollarVolume") or [])[:5]:
            sym = (row.get("symbol") or "").upper()
            if not sym or sym not in ndx:
                continue
            if sector_added >= SECTOR_SYMS_CAP:
                break
            before = sym in tags
            add(sym, f"강세섹터 {label}", "sector")
            if not before:
                sector_added += 1
        if sector_added >= SECTOR_SYMS_CAP:
            break

    # 4) signals_24h ∩ NDX conviction fill
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    raw_signals: list[dict] = []
    try:
        res = (
            sb.table("signals")
            .select("symbol,signal_type,volume_ratio,pct_change,recent_news_count,ts")
            .gte("ts", cutoff)
            .execute()
        )
        raw_signals = res.data or []
    except Exception as e:
        print(f"  signals fetch failed: {e}", file=sys.stderr)
    best: dict[str, tuple[float, dict]] = {}
    for r in raw_signals:
        sym = (r.get("symbol") or "").upper()
        if not sym or sym not in ndx or sym in tags:
            continue
        s = _conviction_score(r)
        if s > best.get(sym, (-1.0, {}))[0]:
            best[sym] = (s, r)
    remaining = max(0, SCAN_BUDGET - len(tags))
    for sym, (_, r) in sorted(best.items(), key=lambda kv: kv[1][0], reverse=True)[
        :remaining
    ]:
        add(sym, f"시그널 {r.get('signal_type', '?')}", "signal")

    targets = list(tags.keys())[:MAX_SYMBOLS_PER_RUN]
    return targets, tags, counts


# Failure-reason taxonomy. Returned alongside None when call_analyze fails,
# so the digest can show users *why* a verdict is missing instead of
# blanket-labeling everything as "Gemini 한도". Misleading copy was the user
# complaint that motivated this split (2026-05-21).
#
#   "quota_429"  — Gemini quota 429. Almost always per-minute TPM (recovers
#                  in ~75-90s); a true per-day RPD ceiling is rare.
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
    # "gemini 429 (model): ...". In practice this is almost always the
    # per-minute TPM quota (quotaId GenerateContentInputTokensPerModelPerMinute
    # -FreeTier), NOT per-day RPD — it recovers within ~75-90s, so the scan
    # loop breathers + retries the symbol rather than treating it as terminal.
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
# Quota 429s are NOT retried *here* — instead the scan loop takes a per-minute
# breather and retries the symbol once the rolling token window clears (a real
# per-DAY RPD 429 is rare with the 3-model chain; the common case is TPM).
# 90초로 늘림 (이전 8초). gemini.ts의 PerMinute 쿨다운이 75초라
# 8초 후 retry하면 모델이 여전히 쿨다운 상태 → "gemini call failed" 즉시 반환.
# 90초 wait면 쿨다운 끝난 후 진짜 retry 가능. 2026-05-22 사례 (17:00 scan
# 모든 retry가 쿨다운 중 fast fail로 끝남) 직접 fix.
TRANSIENT_RETRY_WAIT_SEC = int(os.getenv("AI_SCAN_TRANSIENT_RETRY_WAIT", "90"))

# The binding free-tier limit in practice is per-minute TPM (input tokens /
# min / model — quotaId GenerateContentInputTokensPerModelPerMinute-FreeTier,
# confirmed from a real 429 body 2026-05-19), NOT per-day RPD. Proven again
# 2026-05-30: after a 75s pause, 4 consecutive symbols succeeded — a per-DAY
# ceiling cannot replenish in 75s. So when a call trips quota/cooldown we
# sleep for the rolling window to clear and RETRY THE SAME SYMBOL once (see
# the scan loop). 90s > gemini.ts's 75s per-minute cooldown so the model is
# actually un-cooled by the time we retry. Capped via MAX_QUOTA_BREATHERS so a
# genuine per-DAY exhaustion (rare) can't make us sleep through the whole list.
# Budget raised 3→8 on 2026-05-30: at SCAN_BUDGET 25 the per-minute window
# trips ~every 4 calls, so 3 breathers ran out by symbol 7 and the trailing 13
# symbols rapid-fast-failed as [all_models_cooldown] (the 05-29 22:00 / 05-30
# 02:33 scans lost 17/25 verdicts exactly this way).
QUOTA_BREATHER_SEC = int(os.getenv("AI_SCAN_QUOTA_BREATHER", "90"))
MAX_QUOTA_BREATHERS = int(os.getenv("AI_SCAN_MAX_QUOTA_BREATHERS", "8"))


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


def _plan_of(analysis: dict) -> dict | None:
    """Extract the validated trade_plan from an analysis row (context jsonb).
    None for legacy rows or plans that failed server-side validation."""
    ctx = analysis.get("context") or {}
    tp = ctx.get("trade_plan")
    if not isinstance(tp, dict):
        return None
    for k in ("entry_low", "entry_high", "stop", "target_1", "target_2"):
        v = tp.get(k)
        if not isinstance(v, (int, float)):
            return None
    return tp


def _plan_line(tp: dict, verdict: str) -> str:
    """One-line 언제 사고/팔지: 진입존 · 목표 · 손절 · 기간 (기초자산 USD)."""
    zone = "진입" if verdict == "buy" else ("정리존" if verdict == "sell" else "진입대기")
    horizon = tp.get("horizon_days")
    h = f" · ⏳ ~{int(horizon)}일" if isinstance(horizon, (int, float)) else ""
    return (
        f"📍 {zone} {tp['entry_low']:.2f}~{tp['entry_high']:.2f}"
        f" · 🎯 {tp['target_1']:.2f}/{tp['target_2']:.2f}"
        f" · 🛑 {tp['stop']:.2f}{h}"
    )


def _trim_summary(text: str, cap: int = SUMMARY_CHAR_CAP) -> str:
    summary = _md_safe((text or "").strip())
    if len(summary) <= cap:
        return summary
    cut = summary[:cap]
    last_period = max(cut.rfind(". "), cut.rfind("다. "), cut.rfind("다.\n"))
    if last_period > cap - 40:
        return cut[: last_period + 2]
    return cut.rstrip() + "…"


def _format_pick(v: dict, full: bool) -> str:
    """One conviction pick. full=True adds the summary paragraph + plan note;
    compact picks keep symbol/confidence/tags + the plan line only."""
    sym = v.get("symbol", "?")
    conf = int(round(float(v.get("confidence") or 0) * 100))
    tag_str = " · ".join(_md_safe(t) for t in (v.get("tags") or [])[:2])
    lines = [f"• *{sym}*  신뢰 {conf}%" + (f" · {tag_str}" if tag_str else "")]
    if full:
        summary = _trim_summary(v.get("summary") or "")
        if summary:
            lines.append(f"  _{summary}_")
    tp = v.get("plan")
    if tp:
        lines.append(f"  {_plan_line(tp, (v.get('verdict') or 'buy').lower())}")
        note = _md_safe(str(tp.get("note") or "").strip())
        if full and note:
            lines.append(f"  💡 {note[:140]}")
    return "\n".join(lines)


def _reason_label(reason: str) -> str:
    """Korean human-readable label per FAIL_REASON_* constant. Single source
    of truth so any header that breaks down by reason uses identical copy."""
    return {
        FAIL_REASON_QUOTA: "Gemini 분당 토큰 한도(TPM, 일시적)",
        FAIL_REASON_COOLDOWN: "Gemini 분당 호출 한도·쿨다운 (일시적)",
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


REGIME_LABEL = {
    "risk_on": "🟢 상승추세 (risk-on)",
    "neutral": "🟡 중립·박스",
    "risk_off": "🔴 하락추세 (risk-off) — 매수 기준 +10%p 강화",
}


def _build_blocks(
    verdicts: list[dict],
    total_scanned: int,
    counts: dict[str, int],
    regime: dict | None,
    missing_list: list[dict] | None = None,
) -> list[str]:
    """Conviction-tiered digest blocks (2026-07 개편). Only high-conviction
    picks get full entries; everything else collapses. The packer never
    splits inside a block."""
    missing_list = missing_list or []

    # Regime-adjusted gates: in a confirmed downtrend only the very best
    # longs are worth the user's attention (같은 철학: 대시보드 물타기 게이트).
    regime_key = (regime or {}).get("regime")
    bump = 0.10 if regime_key == "risk_off" else 0.0
    strong_gate = CONF_STRONG + bump
    buy_gate = CONF_BUY + bump

    strong: list[dict] = []
    buys: list[dict] = []
    sells: list[dict] = []
    watch: list[dict] = []
    for v in verdicts:
        vd = (v.get("verdict") or "hold").lower()
        conf = float(v.get("confidence") or 0)
        if vd == "buy" and conf >= strong_gate:
            strong.append(v)
        elif vd == "buy" and conf >= buy_gate:
            buys.append(v)
        elif vd == "sell" and conf >= CONF_SELL:
            sells.append(v)
        else:
            watch.append(v)
    for lst in (strong, buys, sells, watch):
        lst.sort(key=lambda x: float(x.get("confidence") or 0), reverse=True)

    now_kst = datetime.now(timezone(timedelta(hours=9)))
    header_lines = [
        f"🤖 *AI 매수/매도 추천* ({now_kst.strftime('%Y-%m-%d %H:%M KST')})",
    ]
    if regime:
        vix = regime.get("vix")
        p50 = regime.get("pctFromSma50")
        extra = []
        if isinstance(p50, (int, float)):
            extra.append(f"QQQ {p50*100:+.1f}% vs 50일선")
        if isinstance(vix, (int, float)):
            extra.append(f"VIX {vix:.1f}")
        suffix = f" · {' · '.join(extra)}" if extra else ""
        header_lines.append(
            f"레짐: {REGIME_LABEL.get(regime_key, regime_key or '?')}{suffix}"
        )
    src = (
        f"관심 {counts.get('watchlist', 0)} · 모멘텀 {counts.get('momentum', 0)} · "
        f"강세섹터 {counts.get('sector', 0)} · 시그널 {counts.get('signal', 0)}"
    )
    header_lines.append(f"스캔 {total_scanned}종목 (NDX-100 필터 · {src})")
    if missing_list:
        miss_counts: dict[str, int] = {}
        for m in missing_list:
            miss_counts[m["reason"]] = miss_counts.get(m["reason"], 0) + 1
        symbols_str = ", ".join(m["symbol"] for m in missing_list)
        header_lines.append(
            f"⚠️ {len(missing_list)}건 분석 실패 ({symbols_str}) — "
            f"{_format_reason_breakdown(miss_counts)}. 다음 스캔에서 재시도."
        )
    blocks: list[str] = ["\n".join(header_lines)]

    if not strong and not buys:
        blocks.append(
            "🚫 *오늘 확실한 매수 후보 없음* — 신규 진입 대신 현금/기존 플랜 유지. "
            "기준 미달 종목은 관망 목록 참고."
        )
    if strong:
        blocks.append(f"🎯 *강한 매수 ({len(strong)})* — 신뢰 {int(strong_gate*100)}%+")
        for v in strong[:DIGEST_MAX_PER_BUCKET]:
            blocks.append(_format_pick(v, full=True))
    if buys:
        blocks.append(f"🟢 *매수 후보 ({len(buys)})*")
        for v in buys[:DIGEST_MAX_PER_BUCKET]:
            blocks.append(_format_pick(v, full=False))
    if sells:
        blocks.append(f"🔴 *매도/정리 ({len(sells)})* — 보유 중이면 플랜 확인")
        for v in sells[:DIGEST_MAX_PER_BUCKET]:
            blocks.append(_format_pick(v, full=False))

    if watch:
        # 관망: symbols+conf only, wrapped — 수십 개를 나열하지 않는 게 목적.
        entries = [
            f"{v.get('symbol', '?')}({int(round(float(v.get('confidence') or 0) * 100))}%)"
            for v in watch[:DIGEST_MAX_PER_BUCKET]
        ]
        watch_lines = [f"🟡 *관망 ({len(watch)})*"]
        buf: list[str] = []
        chars = 0
        for e in entries:
            if chars + len(e) + 1 > 60 and buf:
                watch_lines.append("  " + " ".join(buf))
                buf = []
                chars = 0
            buf.append(e)
            chars += len(e) + 1
        if buf:
            watch_lines.append("  " + " ".join(buf))
        blocks.append("\n".join(watch_lines))

    blocks.append(
        f"가격은 기초자산 USD 기준 — 2배 ETF 실행 시 손익 ≈ 2배."
        f"\n[전체 분석 →]({FRONT_URL}/trade)"
    )
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
    counts: dict[str, int],
    regime: dict | None,
    missing_list: list[dict] | None = None,
) -> list[str]:
    """Returns a list of telegram-sized messages (1 normal, 2-3 if dense)."""
    blocks = _build_blocks(
        verdicts,
        total_scanned,
        counts,
        regime,
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

    targets, tags, counts = collect_conviction_targets(sb)
    regime = _fetch_regime()

    print(
        f"ai_scan: {len(targets)} candidates "
        f"(watchlist={counts['watchlist']} momentum={counts['momentum']} "
        f"sector={counts['sector']} signal={counts['signal']}, "
        f"budget={SCAN_BUDGET}, regime={(regime or {}).get('regime', '?')})"
    )
    for sym in targets:
        print(f"    {sym}: {', '.join(tags.get(sym, []))}")

    if not targets:
        print("ai_scan: no symbols to scan, exiting")
        return 0

    # Always-fresh: every target gets a live /api/analyze call (3-model
    # Gemini chain). No quota guard, no stale-only mode, no cache reuse —
    # genuine per-DAY (RPD) exhaustion is rare (flash-lite tier ~1,000 RPD);
    # the limit hit in practice is per-minute TPM, absorbed by the scan loop's
    # breather + same-symbol retry. A 24h-old verdict is misleading for twice-daily
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

        # Per-minute TPM/cooldown trips recover within ~75-90s. When one trips,
        # take a breather to let the rolling token window clear, then RETRY THE
        # SAME SYMBOL once instead of dropping it. This recovers both the symbol
        # that tripped the limit AND stops the rest of the list from rapid-fast-
        # failing: the failure path skips INTER_CALL_DELAY, so without a pause
        # the trailing symbols fire ~2s apart and every one bounces off the
        # still-cooled chain as [all_models_cooldown] (that lost 13 symbols on
        # the 05-29 22:00 / 05-30 02:33 scans). Capped via MAX_QUOTA_BREATHERS.
        if (
            not analysis
            and fail_reason in (FAIL_REASON_QUOTA, FAIL_REASON_COOLDOWN)
            and breathers_used < MAX_QUOTA_BREATHERS
        ):
            breathers_used += 1
            print(
                f"    quota/cooldown on {sym} — breather {breathers_used}/"
                f"{MAX_QUOTA_BREATHERS}, sleeping {QUOTA_BREATHER_SEC}s for the "
                f"per-minute window to clear, then retrying {sym}",
                file=sys.stderr,
            )
            time.sleep(QUOTA_BREATHER_SEC)
            analysis, fail_reason = call_analyze(sym)
            if analysis:
                print(f"    ✓ post-breather retry on {sym} succeeded", file=sys.stderr)

        if not analysis:
            reason = fail_reason or FAIL_REASON_UNKNOWN
            fail_reason_counts[reason] = fail_reason_counts.get(reason, 0) + 1
            missing.append({"symbol": sym, "reason": reason})
            continue  # no successful verdict → no normal inter-call delay

        verdicts.append(
            {
                "symbol": sym,
                "verdict": analysis.get("verdict") or "hold",
                "confidence": analysis.get("confidence") or 0,
                "summary": analysis.get("summary") or "",
                "plan": _plan_of(analysis),
                "tags": tags.get(sym, []),
            }
        )
        fresh_count += 1
        # Space calls out to stay under the primary model's per-minute
        # input-token (TPM) ceiling; the chain absorbs the rest.
        time.sleep(INTER_CALL_DELAY_SEC)

    # NOTE: distinct name — `counts` (funnel source breakdown from
    # collect_conviction_targets) is still needed by format_digest below;
    # shadowing it here zeroed the digest header's source line.
    verdict_counts = {"buy": 0, "sell": 0, "hold": 0}
    for v in verdicts:
        b = (v.get("verdict") or "hold").lower()
        verdict_counts[b] = verdict_counts.get(b, 0) + 1
    print(
        f"ai_scan: collected {len(verdicts)} verdicts "
        f"(buy={verdict_counts.get('buy', 0)}, sell={verdict_counts.get('sell', 0)}, "
        f"hold={verdict_counts.get('hold', 0)}); fresh={fresh_count}, "
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
        counts=counts,
        regime=regime,
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
