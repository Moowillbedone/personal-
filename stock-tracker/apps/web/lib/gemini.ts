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
const COOLDOWN_SHORT_MS = 75 * 1000;       // per-minute quotas (TPM, RPM)
const COOLDOWN_LONG_MS = 60 * 60 * 1000;   // per-day quotas (RPD), unknown
const modelCooldownUntil = new Map<string, number>();

function isModelCooled(model: string): boolean {
  const until = modelCooldownUntil.get(model);
  if (until == null) return false;
  if (Date.now() < until) return true;
  modelCooldownUntil.delete(model);
  return false;
}

function markModelCooled(model: string, errorBody: string | undefined): void {
  // PerMinute clears in ~60s; PerDay needs hours. Default to long if we
  // can't parse — safer to over-cooldown than to keep hammering a depleted
  // daily bucket.
  const isPerMinute = errorBody != null && /PerMinute/i.test(errorBody);
  const ms = isPerMinute ? COOLDOWN_SHORT_MS : COOLDOWN_LONG_MS;
  modelCooldownUntil.set(model, Date.now() + ms);
  console.log(
    `gemini_cooldown model=${model} ms=${ms} kind=${isPerMinute ? "per-minute" : "per-day-or-unknown"}`,
  );
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

export interface GeminiVerdict {
  // Short-term (single-day to 1-week swing/day trade) — kept as top-level
  // fields for backwards compatibility with existing DB rows.
  verdict: Verdict;
  confidence: number;
  summary: string;
  bull_points: string[];
  bear_points: string[];
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
        required: ["verdict", "confidence", "summary", "bull_points", "bear_points", "horizons"],
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
    // Preserve enough body to capture QuotaFailure.details on 429 (the
    // "PerMinute" vs "PerDay" marker we use for adaptive cooldown lives
    // ~600 bytes deep in the JSON). 1200 is generous but bounded.
    const err = new Error(`gemini ${r.status} (${model}): ${t.slice(0, 1200)}`);
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
    throw new Error(
      lastErr?.message?.includes("503")
        ? "Gemini 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요."
        : lastErr?.message ?? "gemini call failed",
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
