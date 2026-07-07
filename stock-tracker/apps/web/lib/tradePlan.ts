// Trade-plan baseline + validation (2026-07 "언제 사고 언제 팔지").
//
// Pure functions — no I/O — so they can be unit-tested directly.
//
// Flow in /api/analyze:
//   1. mechanicalPlan() computes a classical ATR-based long-swing plan from
//      the latest price + indicators. This is both the prompt baseline shown
//      to Gemini and the fallback of last resort.
//   2. Gemini returns its own trade_plan (schema-enforced numbers).
//   3. sanitizeTradePlan() accepts Gemini's plan only if the numbers are
//      internally ordered and within sane distance of the live price;
//      otherwise it falls back to the mechanical plan. LLM numeric slips
//      (wrong scale, swapped fields, stale price anchoring) never reach the
//      UI or telegram.

import type { TradePlan } from "@/lib/gemini";

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Classical ATR-based swing plan around the current price.
 *   entry zone : shallow pullback (last − 0.5×ATR) up to ~last
 *   stop       : 1.5×ATR below last — below SMA20 too when SMA20 is tighter
 *   targets    : +1.5×ATR / +3×ATR (≈ 1R / 2R vs the stop)
 *   horizon    : 7 trading days (일~주 단위 스윙)
 */
export function mechanicalPlan(
  last: number | null | undefined,
  atr14: number | null | undefined,
  sma20: number | null | undefined,
): TradePlan | null {
  if (last == null || !isFinite(last) || last <= 0) return null;
  if (atr14 == null || !isFinite(atr14) || atr14 <= 0) return null;
  // ATR > 20% of price: the geometry would breach sanitize's own distance
  // bounds (stop < −30%, target_2 > +60%) — too volatile for a mechanical
  // swing plan; better no numbers than absurd ones (squeeze/meme regimes).
  if (atr14 > 0.2 * last) return null;
  const entryLow = Math.max(0.01, last - 0.5 * atr14);
  const entryHigh = last * 1.005;
  let stop = last - 1.5 * atr14;
  // If SMA20 sits inside the stop distance (price above it), cutting just
  // below SMA20 is the tighter, more classical invalidation line — but the
  // stop must stay strictly BELOW the entry zone (price hugging SMA20 with
  // a fat ATR would otherwise put the stop above entry_low).
  if (sma20 != null && isFinite(sma20) && sma20 < last && sma20 * 0.99 > stop) {
    stop = Math.min(sma20 * 0.99, entryLow - 0.01);
  }
  stop = Math.max(0.01, stop);
  const plan: TradePlan = {
    entry_low: round2(entryLow),
    entry_high: round2(entryHigh),
    stop: round2(stop),
    target_1: round2(last + 1.5 * atr14),
    target_2: round2(last + 3 * atr14),
    horizon_days: 7,
    note: "ATR 기반 기본 플랜 — 눌림 진입, 1R/2R 분할 익절, 종가 기준 손절.",
  };
  // The baseline must satisfy the same ordering invariant sanitize enforces
  // on Gemini plans (rounding ties, micro-ATR tickers where entry_high ≥
  // target_1, ...). An incoherent fallback is worse than none.
  if (
    !(
      plan.stop < plan.entry_low &&
      plan.entry_low <= plan.entry_high &&
      plan.entry_high < plan.target_1 &&
      plan.target_1 <= plan.target_2
    )
  ) {
    return null;
  }
  return plan;
}

/**
 * Accept an LLM-provided plan only if it is coherent; otherwise return the
 * fallback (mechanical) plan. Returns null only when both are unusable.
 *
 * Coherence checks vs the live price `last`:
 *   - all five prices finite & positive, horizon 1..30 (clamped)
 *   - ordering: stop < entry_low ≤ entry_high < target_1 ≤ target_2
 *   - entry zone within ±12% of last (a plan anchored to a stale/wrong price
 *     is worse than none)
 *   - stop within 30% below last (2x-ETF 사용자 기준 그 아래는 플랜이 아님)
 *   - target_2 within +60% of last (silly moonshot numbers rejected)
 */
export function sanitizeTradePlan(
  raw: Partial<TradePlan> | null | undefined,
  last: number | null | undefined,
  fallback: TradePlan | null,
): TradePlan | null {
  if (last == null || !isFinite(last) || last <= 0) return fallback;
  if (!raw) return fallback;

  const nums = [raw.entry_low, raw.entry_high, raw.stop, raw.target_1, raw.target_2];
  if (nums.some((v) => v == null || typeof v !== "number" || !isFinite(v) || v <= 0)) {
    return fallback;
  }
  const el = raw.entry_low as number;
  const eh = raw.entry_high as number;
  const st = raw.stop as number;
  const t1 = raw.target_1 as number;
  const t2 = raw.target_2 as number;

  const ordered = st < el && el <= eh && eh < t1 && t1 <= t2;
  const entryNearPrice = el >= last * 0.88 && eh <= last * 1.12;
  const stopSane = st >= last * 0.70;
  const targetSane = t2 <= last * 1.60;
  if (!ordered || !entryNearPrice || !stopSane || !targetSane) return fallback;

  const horizonRaw = Number(raw.horizon_days);
  const horizon = isFinite(horizonRaw) ? Math.min(30, Math.max(1, Math.round(horizonRaw))) : 7;

  return {
    entry_low: round2(el),
    entry_high: round2(eh),
    stop: round2(st),
    target_1: round2(t1),
    target_2: round2(t2),
    horizon_days: horizon,
    note: typeof raw.note === "string" ? raw.note.slice(0, 200) : "",
  };
}
