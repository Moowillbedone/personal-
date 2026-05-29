// GET /api/rec-performance?lookback=30[&mode=real|paper]
//
// The core question this whole tracker exists to answer: "when I act on a
// Telegram AI recommendation, do I actually make money?"
//
// Every trade the user logs is auto-linked to the AI verdict that prompted
// it (trade_log.ai_analysis_id, set within a 24h window — see /api/trades).
// 89% of real trades carry this link. This endpoint joins the two and
// measures, per acted-upon recommendation:
//
//   - 방향 일치 (alignment): did my action match the AI's verdict?
//       buy-on-BUY / sell-on-SELL = aligned; the inverse = contrarian.
//   - 결과 (outcome): the verdict's measured forward return, re-signed to
//       MY action's point of view —
//         I bought → +return is good (price rose after I bought)
//         I sold   → +return is bad  (price rose after I sold)
//       so `aligned1d > 0` always means "my action was right at 1d".
//   - 진입 지연 (entry lag): hours between the verdict and my trade — a
//       proxy for chasing (the longer the lag, the more the edge decays).
//
// realized_Nd is measured from the verdict's created_at, not my exact trade
// time. The user typically trades ~25min after the verdict, so it's a close
// proxy; the per-trade entry-lag column keeps that honest. Precise entry
// slippage is a later (P2) refinement.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Verdict = "buy" | "sell" | "hold";
type Action = "buy" | "sell";
type Mode = "paper" | "real";

interface JoinedRow {
  id: string;
  symbol: string;
  action: Action;
  qty: number;
  price: number;
  mode: Mode;
  ts: string;
  notes: string | null;
  ai_analysis_id: string;
  underlying_symbol: string | null;
  ai_analysis: {
    symbol: string;
    verdict: Verdict;
    confidence: number;
    created_at: string;
    realized_1d: number | null;
    realized_3d: number | null;
    realized_5d: number | null;
    /** JSONB; last_price is the symbol's price at verdict time. */
    context: { last_price?: number | null } | null;
  } | null;
}

interface RecTrade {
  tradeId: string;
  ts: string;
  symbol: string;
  action: Action;
  qty: number;
  price: number;
  mode: Mode;
  notes: string | null;
  /** Analyzed underlying when the traded instrument is a derivative
   *  (e.g. trade=AAPU, underlying=AAPL). Null = traded the underlying directly. */
  underlying: string | null;
  verdict: Verdict;
  confidence: number;
  verdictAt: string;
  /** true = acted with the verdict, false = against it, null = HOLD verdict. */
  aligned: boolean | null;
  /** Verdict's forward return, re-signed to my action (see header). */
  aligned1d: number | null;
  aligned3d: number | null;
  aligned5d: number | null;
  /** Hours between verdict and my trade. */
  entryLagHours: number | null;
  /** Symbol's price at verdict time (ai_analysis.context.last_price). */
  verdictPrice: number | null;
  /**
   * Adverse entry slippage vs the verdict price, as a fraction.
   * Positive = I traded at a WORSE price than the AI reference (chasing cost):
   *   buy  → paid more than ref;  sell → sold below ref.
   * Null when no verdict price, or when the traded instrument differs from the
   * analyzed symbol (derivative trade — prices not comparable).
   */
  slippagePct: number | null;
}

function mean(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

/** Re-sign a verdict's forward return to the user's action POV. */
function alignedReturn(action: Action, realized: number | null): number | null {
  if (realized == null) return null;
  return action === "buy" ? realized : -realized;
}

/** Did the action follow the verdict direction? null for HOLD (no direction). */
function isAligned(verdict: Verdict, action: Action): boolean | null {
  if (verdict === "hold") return null;
  return verdict === action;
}

/**
 * Adverse entry slippage vs the AI's reference price. Positive = worse entry
 * than the verdict price (chasing cost): a buy filled above the reference, or
 * a sell filled below it.
 */
function adverseSlippage(
  action: Action,
  refPrice: number | null | undefined,
  fillPrice: number,
): number | null {
  if (refPrice == null || !isFinite(refPrice) || refPrice <= 0) return null;
  if (!isFinite(fillPrice) || fillPrice <= 0) return null;
  return action === "buy"
    ? (fillPrice - refPrice) / refPrice
    : (refPrice - fillPrice) / refPrice;
}

export async function GET(req: NextRequest) {
  const lookback = Math.max(
    7,
    Math.min(365, Number(req.nextUrl.searchParams.get("lookback") ?? "30") || 30),
  );
  const modeRaw = req.nextUrl.searchParams.get("mode");
  const mode: Mode | undefined =
    modeRaw === "paper" || modeRaw === "real" ? modeRaw : undefined;
  const since = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString();

  let q = supabaseAdmin
    .from("trade_log")
    .select(
      "id, symbol, action, qty, price, mode, ts, notes, ai_analysis_id, underlying_symbol, " +
        "ai_analysis(symbol, verdict, confidence, created_at, realized_1d, realized_3d, realized_5d, context)",
    )
    .not("ai_analysis_id", "is", null)
    .gte("ts", since)
    .order("ts", { ascending: false })
    .limit(2000);
  if (mode) q = q.eq("mode", mode);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as JoinedRow[];

  const trades: RecTrade[] = [];
  for (const r of rows) {
    const a = r.ai_analysis;
    if (!a) continue; // verdict was deleted (FK set null) — skip
    const entryLagHours =
      (new Date(r.ts).getTime() - new Date(a.created_at).getTime()) / 3_600_000;
    // Slippage only makes sense when the traded instrument IS the analyzed
    // symbol. Derivative trades (underlying_symbol set, e.g. TSLL on a TSLA
    // verdict) compare apples to oranges — leave slippage null.
    const sameInstrument = !r.underlying_symbol && a.symbol === r.symbol;
    const verdictPrice = a.context?.last_price ?? null;
    const slippagePct = sameInstrument
      ? adverseSlippage(r.action, verdictPrice, Number(r.price))
      : null;
    trades.push({
      tradeId: r.id,
      ts: r.ts,
      symbol: r.symbol,
      action: r.action,
      qty: Number(r.qty),
      price: Number(r.price),
      mode: r.mode,
      notes: r.notes,
      underlying: r.underlying_symbol,
      verdict: a.verdict,
      confidence: Number(a.confidence),
      verdictAt: a.created_at,
      aligned: isAligned(a.verdict, r.action),
      aligned1d: alignedReturn(r.action, a.realized_1d),
      aligned3d: alignedReturn(r.action, a.realized_3d),
      aligned5d: alignedReturn(r.action, a.realized_5d),
      entryLagHours: isFinite(entryLagHours) ? entryLagHours : null,
      verdictPrice: verdictPrice != null ? Number(verdictPrice) : null,
      slippagePct,
    });
  }

  // ─── aggregate summary ─────────────────────────────────────────────────
  const realCount = trades.filter((t) => t.mode === "real").length;
  const distinctRecs = new Set(rows.map((r) => r.ai_analysis_id)).size;

  // Alignment only defined for directional verdicts (buy/sell).
  const directional = trades.filter((t) => t.aligned !== null);
  const alignedCount = directional.filter((t) => t.aligned === true).length;
  const alignmentRate = directional.length
    ? alignedCount / directional.length
    : null;

  const measured1d = trades
    .map((t) => t.aligned1d)
    .filter((v): v is number => v != null);
  const measured3d = trades
    .map((t) => t.aligned3d)
    .filter((v): v is number => v != null);
  const measured5d = trades
    .map((t) => t.aligned5d)
    .filter((v): v is number => v != null);

  const hits1d = measured1d.filter((v) => v > 0).length;
  const lags = trades
    .map((t) => t.entryLagHours)
    .filter((v): v is number => v != null && v >= 0);
  const slippages = trades
    .map((t) => t.slippagePct)
    .filter((v): v is number => v != null);
  const derivativeTradeCount = trades.filter((t) => t.underlying != null).length;

  return NextResponse.json({
    lookbackDays: lookback,
    asOf: new Date().toISOString(),
    trades,
    summary: {
      recTradeCount: trades.length,
      realCount,
      distinctRecs,
      alignmentRate,
      measuredCount: measured1d.length,
      hitRate1d: measured1d.length ? hits1d / measured1d.length : null,
      meanAligned1d: mean(measured1d),
      meanAligned3d: mean(measured3d),
      meanAligned5d: mean(measured5d),
      avgEntryLagHours: mean(lags),
      avgSlippagePct: mean(slippages),
      slippageMeasuredCount: slippages.length,
      derivativeTradeCount,
    },
  });
}
