// Server-side Gemini client. Free tier via Google AI Studio.
// https://ai.google.dev/gemini-api/docs/quickstart
//
// Resilience: when a model returns 503 (capacity) or 429 (rate limit /
// quota), retry with exponential backoff and fall back to alternate
// models. 4xx auth/validation errors fail immediately — no point retrying.
//
// Quality-first policy: this prompt produces actual buy/sell verdicts the
// user trades on, so we never fall back to a lower-quality model.
//
// Model chain (2026-05-19 live-audited):
//   PRIMARY: gemini-2.5-flash      (250 RPD on free tier — comfortable)
//   FALLBACK: (none)
//
// Earlier we used gemini-flash-latest as fallback assuming it had its own
// 250 RPD bucket. Direct probe showed it exhausts after ~5-10 daily calls
// (the "-latest" alias points to a preview model with a much smaller free
// quota bucket — somewhere around 10-25 RPD). Result: as soon as primary
// hit a transient TPM blip, every subsequent call cascaded to flash-latest,
// burned its tiny daily quota in minutes, then both were locked out and
// ai_scan flipped to stale-only mode for hours. That's the user-visible
// "ℹ️ N건 캐시 재사용" banner cascade.
//
// With pacing fixed (INTER_CALL_DELAY=15s respects 250K TPM ceiling) and
// per-scan cap at 25 symbols × 3 scans = 75 calls/day, primary alone
// stays well under 250 RPD even with user manual clicks. Transient 429s
// get a 75s cooldown via the smart-classifier and recover within the
// next call.
//
// Model chain (2026-05-28 최종 — 사용자 승인):
//   1. gemini-2.5-flash      (20 RPD, 최고 품질) — primary, 매 호출 먼저 시도
//   2. gemini-flash-latest   (별도 quota bucket) — primary 소진 시
//   3. gemini-2.5-flash-lite (1,000 RPD, 중품질) — 최후 안전망
//
// 동작: 매 호출은 항상 primary(고품질)부터. primary가 429(20 RPD 소진)면
// flash-latest, 그것도 막히면 lite로 폴백. 즉 하루 첫 ~40개(2.5-flash +
// flash-latest)는 최고 품질, 그 이후만 lite. 평소 운영(25×2=50 calls/day)
// 에선 대부분 고품질 모델이 처리하고 lite는 진짜 안전망 역할.
//
// lite를 최후 fallback에 둔 이유: 2025-12-07 Google이 free tier 2.5-flash를
// 250→20 RPD로 80% 축소. lite만 1,000 RPD 유지. lite가 chain 맨 뒤에
// 있으면 quota 소진으로 인한 verdict 실패(missing/stale)가 사실상 0이 됨
// (1,000 RPD는 우리 사용량의 20배). 옛 5/11-15 정상 시기 매일 70-90건
// 처리했던 게 바로 이 lite 포함 chain 덕분이었음.
//
// 품질 영향 최소: 평소엔 2.5-flash로 고품질 유지. lite는 2.5-flash +
// flash-latest 둘 다 소진된 극단에서만 발동.
//
// 2026-05-30 운영 진단 (22:00 KST 스캔 16/25 실패 사례):
//   - 실패의 본질은 RPD(일일) 소진이 아니라 "분당(per-minute) 버스트 429".
//     동일 키로 같은 날 ~4h 뒤 직접 probe 시 3개 모델 모두 200 정상 →
//     일일 한도였다면 PT 자정까지 안 풀렸을 것. 즉 분당 한도였다.
//   - 증폭된 원인(버그): per-minute 429를 markModelCooled가 per-day로
//     오분류 → 3개 모델 전부 1h 쿨다운 → 스캔 나머지가 요청조차 못 보내고
//     fast-fail("gemini call failed" → 워커가 "unknown" 집계 → 90s retry
//     14회 = 27분 전멸). 아래 markModelCooled가 retryDelay/PerDay/PerMinute를
//     구분하고, 미분류 시 1h가 아닌 90s만 쿨다운하도록 고침. generateVerdict는
//     all-cooled 시 분류 가능한 메시지를 던지도록 고침.
//   - 미해결 가설: free tier 한도가 모델별이 아니라 프로젝트 공유일 수 있음
//     (그렇다면 3-chain이 쿼터를 늘려주지 못함). 다음 429 발생 시
//     gemini_429_body 로그의 quotaId로 확정할 것.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS: string[] = ["gemini-flash-latest", "gemini-2.5-flash-lite"];
const MODEL_CHAIN = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter((m) => m !== PRIMARY_MODEL)];

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS_PER_MODEL = 2;

// ─── Per-process model cooldown ────────────────────────────────────────────
// When a model 429s, every subsequent /api/analyze call would otherwise
// also try it first and burn another 2 attempts before cascading. We mark
// a 429-returning model "cooled" and skip it entirely until cooldown ends.
//
// The 429 response carries QuotaFailure details that identify *which*
// quota was hit — e.g.:
//   GenerateContentInputTokensPerModelPerMinute-FreeTier  (250K TPM)
//   GenerateContentRequestsPerMinutePerModel-FreeTier     (10 RPM)
//   GenerateContentRequestsPerDayPerModel-FreeTier        (250 RPD)
//
// Per-minute quotas (TPM, RPM) clear in ~60s, so we set a short cooldown
// (75s gives a safety margin). Per-day quotas only clear at PT midnight,
// so we set the longer 1h cooldown (worker will keep checking).
//
// Diagnosed 2026-05-19: the binding constraint for our 17-section prompt
// is TPM (~30-50K input tokens per call × ~9 calls/min on the old 7s
// pacing = 300-450K TPM, blowing past 250K). Bumped delay to 15s and
// added this smart cooldown so transient TPM hits don't lock the model
// for a full hour.
const COOLDOWN_SHORT_MS = 75 * 1000;        // per-minute quotas (TPM, RPM): clear ~60s
const COOLDOWN_DAY_MS = 30 * 60 * 1000;     // per-day quotas (RPD): re-check every 30m
const COOLDOWN_UNKNOWN_MS = 90 * 1000;      // unclassifiable: favor recovery, not lockout
const COOLDOWN_MAX_MS = 5 * 60 * 1000;      // cap any server-hinted retryDelay
const modelCooldownUntil = new Map<string, number>();

function isModelCooled(model: string): boolean {
  const until = modelCooldownUntil.get(model);
  if (until == null) return false;
  if (Date.now() < until) return true;
  modelCooldownUntil.delete(model);
  return false;
}

// Parse Gemini's own retry hint (RetryInfo.retryDelay, e.g. `"retryDelay": "26s"`)
// out of a 429 body. It's authoritative and accompanies virtually every
// per-minute (TPM/RPM) 429 — honoring it beats guessing. Returns ms or null.
function parseRetryDelayMs(body: string | undefined): number | null {
  if (!body) return null;
  const m = body.match(/"?retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s"?/i);
  if (!m) return null;
  const secs = Number(m[1]);
  return Number.isFinite(secs) ? Math.round(secs * 1000) : null;
}

function markModelCooled(model: string, errorBody: string | undefined): void {
  // Pick a cooldown that matches WHICH quota was actually hit. Getting this
  // wrong is expensive: a per-minute burst mis-tagged as per-day used to lock
  // all 3 models for a full hour, fast-failing the rest of a scan (observed
  // 2026-05-29 — one burst at symbol 9 cost 14/16 remaining symbols).
  const body = errorBody ?? "";
  let ms: number;
  let kind: string;
  const hinted = parseRetryDelayMs(body);
  if (hinted != null) {
    // Server told us exactly how long to wait — trust it (clamped to a sane
    // floor/ceiling so a bogus value can't lock us out or hammer instantly).
    ms = Math.min(Math.max(hinted + 2000, COOLDOWN_SHORT_MS), COOLDOWN_MAX_MS);
    kind = `retryDelay~${Math.round(hinted / 1000)}s`;
  } else if (/PerDay|RequestsPerDay/i.test(body)) {
    ms = COOLDOWN_DAY_MS;
    kind = "per-day";
  } else if (/PerMinute|TokensPerMin|RequestsPerMin/i.test(body)) {
    ms = COOLDOWN_SHORT_MS;
    kind = "per-minute";
  } else {
    // Unclassifiable 429. Favor recovery with a short cooldown: our observed
    // 429s recover within minutes (same-day), so a long lockout does far more
    // harm (poisons a whole scan) than a short one (one extra retry next call).
    ms = COOLDOWN_UNKNOWN_MS;
    kind = "unknown-short";
  }
  modelCooldownUntil.set(model, Date.now() + ms);
  console.log(`gemini_cooldown model=${model} ms=${ms} kind=${kind}`);
}

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export type Verdict = "buy" | "hold" | "sell";

export interface HorizonOpinion {
  verdict: Verdict;
  confidence: number;
  summary: string;
  key_points: string[];
}

// Actionable price plan — "언제 사고 언제 팔지" (2026-07). Always framed for
// a LONG swing position on THIS symbol's price:
//   buy  → enter in [entry_low, entry_high], take profit at targets, cut at stop
//   hold → wait; entry zone = the pullback level that would justify entering
//   sell → no new entry; holders exit into strength / cut below stop
// The analyze route computes an ATR-based mechanical baseline, feeds it to
// Gemini, then VALIDATES Gemini's numbers (ordering + sane ranges) and falls
// back to the baseline if they're off — LLM numeric sloppiness never reaches
// the UI or telegram.
export interface TradePlan {
  entry_low: number;
  entry_high: number;
  stop: number;
  target_1: number;
  target_2: number;
  horizon_days: number;
  note: string; // 진입/청산 조건 한 줄 (한국어)
}

export interface GeminiVerdict {
  // Short-term (single-day to 1-week swing/day trade) — kept as top-level
  // fields for backwards compatibility with existing DB rows.
  verdict: Verdict;
  confidence: number;
  summary: string;
  bull_points: string[];
  bear_points: string[];
  trade_plan: TradePlan;
  // Multi-horizon long-term opinions
  horizons: {
    three_month: HorizonOpinion;
    six_month: HorizonOpinion;
    one_year: HorizonOpinion;
  };
}

const HORIZON_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["buy", "hold", "sell"] },
    confidence: { type: "NUMBER" },
    summary: { type: "STRING" },
    key_points: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["verdict", "confidence", "summary", "key_points"],
} as const;

const TRADE_PLAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    entry_low: { type: "NUMBER" },
    entry_high: { type: "NUMBER" },
    stop: { type: "NUMBER" },
    target_1: { type: "NUMBER" },
    target_2: { type: "NUMBER" },
    horizon_days: { type: "NUMBER" },
    note: { type: "STRING" },
  },
  required: ["entry_low", "entry_high", "stop", "target_1", "target_2", "horizon_days", "note"],
} as const;

async function callOnce(model: string, apiKey: string, prompt: string): Promise<string> {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          verdict: { type: "STRING", enum: ["buy", "hold", "sell"] },
          confidence: { type: "NUMBER" },
          summary: { type: "STRING" },
          bull_points: { type: "ARRAY", items: { type: "STRING" } },
          bear_points: { type: "ARRAY", items: { type: "STRING" } },
          trade_plan: TRADE_PLAN_SCHEMA,
          horizons: {
            type: "OBJECT",
            properties: {
              three_month: HORIZON_SCHEMA,
              six_month: HORIZON_SCHEMA,
              one_year: HORIZON_SCHEMA,
            },
            required: ["three_month", "six_month", "one_year"],
          },
        },
        required: ["verdict", "confidence", "summary", "bull_points", "bear_points", "trade_plan", "horizons"],
      },
    },
  };

  const r = await fetch(`${endpointFor(model)}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) {
    const t = await r.text();
    // Preserve enough body to capture QuotaFailure.details on 429. The
    // quotaId ("PerMinute" vs "PerDay" marker) lives ~600 bytes deep; the
    // RetryInfo.retryDelay hint can sit deeper still. 2000 captures both.
    const err = new Error(`gemini ${r.status} (${model}): ${t.slice(0, 2000)}`);
    (err as Error & { status?: number }).status = r.status;
    throw err;
  }
  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
      thoughtsTokenCount?: number;
    };
  };
  // Log token usage so we can audit input-TPM consumption. The free-tier
  // 250K input-tokens-per-minute ceiling is the actual binding constraint
  // for ai_scan throughput (NOT the 10 RPM request-count limit). When
  // pacing or prompt-size changes, grep Vercel logs for "gemini_usage" to
  // verify we're still under TPM.
  const usage = data.usageMetadata;
  if (usage) {
    console.log(
      `gemini_usage model=${model} prompt=${usage.promptTokenCount ?? 0} ` +
        `output=${usage.candidatesTokenCount ?? 0} thoughts=${usage.thoughtsTokenCount ?? 0} ` +
        `total=${usage.totalTokenCount ?? 0}`,
    );
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`gemini (${model}): empty response`);
  return text;
}

export async function generateVerdict(prompt: string): Promise<GeminiVerdict> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  let lastErr: Error | null = null;
  let text: string | null = null;

  outer: for (const model of MODEL_CHAIN) {
    // Skip models that recently 429'd — assume they're still capped and
    // jump straight to the next available model. Avoids the 8-attempts-
    // per-failed-call cascade that ate today's whole quota budget.
    if (isModelCooled(model)) {
      continue;
    }
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        text = await callOnce(model, apiKey, prompt);
        break outer; // success
      } catch (e) {
        lastErr = e as Error;
        const status = (e as Error & { status?: number }).status;
        // Auth / validation / unknown model — don't retry, jump to next model
        if (status && !RETRYABLE_STATUS.has(status)) break;
        // 429: pick cooldown duration based on which quota was hit.
        // Per-minute quotas (TPM/RPM) clear fast (75s). Per-day (RPD) needs
        // hours. The 429 error body carries QuotaFailure details we parse
        // for "PerMinute" vs "PerDay" markers.
        if (status === 429) {
          // Log full body so we can debug regex misses. Cooldown classifier
          // saw "per-day-or-unknown" in production but our SCAN_BUDGET math
          // suggests we shouldn't be hitting RPD — body inspection will
          // tell us if it's actually RPM/TPM with different format, or a
          // different quota name we don't recognize.
          console.log(`gemini_429_body model=${model} body=${(e as Error).message.slice(0, 2500)}`);
          markModelCooled(model, (e as Error).message);
          break;
        }
        // Other retryable (5xx): backoff before next attempt within same model
        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          await sleep(800 * attempt + Math.floor(Math.random() * 400));
        }
      }
    }
  }

  if (!text) {
    // No model produced text. Distinguish two very different causes so
    // callers (ai_scan worker, manual UI) can react correctly:
    if (!lastErr) {
      // Every model was SKIPPED on cooldown — no request was even sent.
      // The old bare "gemini call failed" got classified "unknown" by the
      // worker, which then wasted a 90s retry per symbol (the 27-min,
      // all-fail scan on 2026-05-29). Emit explicit rate-limit markers so
      // it's classified as a transient limit (no pointless retry) and the
      // UI shows a meaningful message instead of a bare "gemini error".
      throw new Error(
        "Gemini 모든 모델이 요청 한도(rate-limit)로 일시 쿨다운 중입니다. " +
          "잠시 후 자동 재시도됩니다. [all_models_cooldown]",
      );
    }
    throw new Error(
      lastErr.message?.includes("503")
        ? "Gemini 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요."
        : lastErr.message ?? "gemini call failed",
    );
  }

  let parsed: GeminiVerdict;
  try {
    parsed = JSON.parse(text) as GeminiVerdict;
  } catch {
    throw new Error(`gemini: invalid JSON response: ${text.slice(0, 200)}`);
  }
  parsed.confidence = clamp01(Number(parsed.confidence) || 0);
  if (!isVerdict(parsed.verdict)) parsed.verdict = "hold";
  parsed.bull_points = parsed.bull_points ?? [];
  parsed.bear_points = parsed.bear_points ?? [];

  // Normalize each horizon
  for (const k of ["three_month", "six_month", "one_year"] as const) {
    const h = parsed.horizons?.[k];
    if (!h || !isVerdict(h.verdict)) {
      parsed.horizons = parsed.horizons ?? ({} as GeminiVerdict["horizons"]);
      parsed.horizons[k] = { verdict: "hold", confidence: 0, summary: "", key_points: [] };
    } else {
      h.confidence = clamp01(Number(h.confidence) || 0);
      h.key_points = h.key_points ?? [];
      h.summary = h.summary ?? "";
    }
  }
  return parsed;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function isVerdict(v: unknown): v is Verdict {
  return v === "buy" || v === "hold" || v === "sell";
}

export const ACTIVE_MODEL = PRIMARY_MODEL;
