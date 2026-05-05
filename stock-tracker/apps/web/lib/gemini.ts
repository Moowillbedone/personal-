// Server-side Gemini client. Free tier: gemini-2.5-flash via Google AI Studio.
// https://ai.google.dev/gemini-api/docs/quickstart
//
// Resilience: when the primary model returns 503 (capacity) or 429 (rate
// limit), retry with exponential backoff and fall back to alternate models.
// 4xx auth/validation errors fail immediately — no point retrying.

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Fallback chain: try primary first, then progressively cheaper/lighter models.
// Skips duplicates if primary is already in the list.
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
const MODEL_CHAIN = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter((m) => m !== PRIMARY_MODEL)];

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS_PER_MODEL = 2;

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
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        text = await callOnce(model, apiKey, prompt);
        break outer; // success
      } catch (e) {
        lastErr = e as Error;
        const status = (e as Error & { status?: number }).status;
        // Auth / validation / unknown model — don't retry, jump to next model
        if (status && !RETRYABLE_STATUS.has(status)) break;
        // Retryable: backoff before next attempt within the same model
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
