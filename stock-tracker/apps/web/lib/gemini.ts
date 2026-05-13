// Server-side Gemini client. Free tier via Google AI Studio.
// https://ai.google.dev/gemini-api/docs/quickstart
//
// Resilience: when a model returns 503 (capacity) or 429 (rate limit /
// quota), retry with exponential backoff and fall back to alternate
// models. 4xx auth/validation errors fail immediately — no point retrying.
//
// Quality-first policy: this prompt produces actual buy/sell verdicts the
// user trades on, so we never fall back to a lower-quality model. The
// chain is restricted to gemini-2.5-flash and gemini-flash-latest only —
// flash-latest is currently aliased to the same -flash generation, just
// drawing from a separate 250 RPD quota bucket. Combined 500 RPD covers
// the planned 3 scans/day × ~100 symbols = 300 calls/day with margin.
//
// Intentionally NOT in the chain:
//   gemini-2.5-flash-lite  (1000 RPD but noticeably lighter reasoning)
//   gemini-2.0-flash       (older generation)
// If both top-tier models exhaust, the analyze call throws and ai-scan's
// early-abort kicks in — the digest ships partial with the user-visible
// banner explaining why. Better a missing verdict than a low-quality one.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-flash-latest"];
const MODEL_CHAIN = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter((m) => m !== PRIMARY_MODEL)];

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS_PER_MODEL = 2;

// ─── Per-process model cooldown ────────────────────────────────────────────
// When a model 429s (RPM rate limit OR RPD daily quota — the response
// doesn't reliably distinguish), every subsequent /api/analyze call would
// otherwise also try it first and burn another 2 attempts before
// cascading. That's what blew through the daily quota across all models
// today. We mark a 429-returning model "cooled" for 1 hour and skip it
// entirely until then.
//
// 1h is the sweet spot: short enough that a transient 60s RPM cool-off
// recovers automatically before the next scan, long enough that a true
// RPD exhaustion doesn't keep hammering the model for the rest of the
// PT day. Module-level Map persists across /api/analyze invocations on
// the same warm Vercel function instance.
const MODEL_COOLDOWN_MS = 60 * 60 * 1000;
const modelCooldownUntil = new Map<string, number>();

function isModelCooled(model: string): boolean {
  const until = modelCooldownUntil.get(model);
  if (until == null) return false;
  if (Date.now() < until) return true;
  modelCooldownUntil.delete(model);
  return false;
}

function markModelCooled(model: string): void {
  modelCooldownUntil.set(model, Date.now() + MODEL_COOLDOWN_MS);
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
    const err = new Error(`gemini ${r.status} (${model}): ${t.slice(0, 300)}`);
    (err as Error & { status?: number }).status = r.status;
    throw err;
  }
  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
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
        // 429 specifically: mark this model cooled for 1h and immediately
        // fall through to the next model — don't waste an in-call retry
        // on something already rate-limited.
        if (status === 429) {
          markModelCooled(model);
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
