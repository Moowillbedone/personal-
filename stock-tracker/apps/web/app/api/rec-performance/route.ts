// Recommendation-linked fill markouts, not realized account P&L.
// Only direct same-instrument fills on the verdict's NY date are comparable.
// Derivative / inverse ETF returns require their own prices and are excluded.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fillMarkout, finiteNumber, newYorkDate } from "@/lib/performanceAudit";

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
  recommendationId: string;
  measurementEligible: boolean;
  exclusionReason: string | null;
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
  /** Gross fill-to-horizon directional price change; not realized account P&L. */
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
      { count: "exact" },
    )
    .not("ai_analysis_id", "is", null)
    .gte("ts", since)
    .order("ts", { ascending: false })
    .limit(2000);
  if (mode) q = q.eq("mode", mode);

  const { data, error, count: matchingTrades } = await q;
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
    const rawPrice = a.context?.last_price;
    const verdictPrice = rawPrice != null && Number.isFinite(Number(rawPrice)) && Number(rawPrice) > 0 ? Number(rawPrice) : null;
    const validTiming = Number.isFinite(entryLagHours) && entryLagHours >= 0 && newYorkDate(r.ts) === newYorkDate(a.created_at);
    const measurementEligible = sameInstrument && validTiming && verdictPrice != null && Number(r.price) > 0 && Number.isFinite(Number(r.price));
    const exclusionReason = !sameInstrument ? "different_instrument" : !validTiming ? "incomparable_entry_time" : !measurementEligible ? "missing_price" : null;
    const slippagePct = sameInstrument
      ? adverseSlippage(r.action, verdictPrice, Number(r.price))
      : null;
    trades.push({
      tradeId: r.id,
      recommendationId: r.ai_analysis_id,
      measurementEligible,
      exclusionReason,
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
      aligned: measurementEligible ? isAligned(a.verdict, r.action) : null,
      aligned1d: measurementEligible ? fillMarkout(r.action, a.realized_1d, verdictPrice, Number(r.price)) : null,
      aligned3d: measurementEligible ? fillMarkout(r.action, a.realized_3d, verdictPrice, Number(r.price)) : null,
      aligned5d: measurementEligible ? fillMarkout(r.action, a.realized_5d, verdictPrice, Number(r.price)) : null,
      entryLagHours: isFinite(entryLagHours) ? entryLagHours : null,
      verdictPrice: verdictPrice != null ? Number(verdictPrice) : null,
      slippagePct,
    });
  }

  // ─── aggregate summary ─────────────────────────────────────────────────
  const realCount = trades.filter((t) => t.mode === "real").length;
  const distinctRecs = new Set(trades.map((r) => r.recommendationId)).size;
  // One equally weighted diagnostic per recommendation/action/mode. Multiple
  // fills of one call must not make that call look like independent evidence.
  const groups = new Map<string, RecTrade[]>();
  for (const trade of trades) {
    const key = `${trade.recommendationId}|${trade.action}|${trade.mode}`;
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  const observations = [...groups.values()].map(fills => ({
    aligned: fills.find(t => t.aligned != null)?.aligned ?? null,
    aligned1d: mean(fills.map(t => t.aligned1d).filter(finiteNumber)),
    aligned3d: mean(fills.map(t => t.aligned3d).filter(finiteNumber)),
    aligned5d: mean(fills.map(t => t.aligned5d).filter(finiteNumber)),
  }));

  // Alignment only defined for directional verdicts (buy/sell).
  const directional = observations.filter((t) => t.aligned !== null);
  const alignedCount = directional.filter((t) => t.aligned === true).length;
  const alignmentRate = directional.length
    ? alignedCount / directional.length
    : null;

  const measured1d = observations
    .map((t) => t.aligned1d)
    .filter(finiteNumber);
  const measured3d = observations
    .map((t) => t.aligned3d)
    .filter(finiteNumber);
  const measured5d = observations
    .map((t) => t.aligned5d)
    .filter(finiteNumber);

  const hits1d = measured1d.filter((v) => v > 0).length;
  const lags = trades
    .map((t) => t.entryLagHours)
    .filter((v): v is number => v != null && v >= 0);
  const slippages = trades
    .map((t) => t.slippagePct)
    .filter(finiteNumber);
  const derivativeTradeCount = trades.filter((t) => t.underlying != null).length;

  return NextResponse.json({
    lookbackDays: lookback,
    asOf: new Date().toISOString(),
    trades,
    aggregationTruncated: matchingTrades != null && matchingTrades > rows.length,
    matchingTrades,
    methodology: "Gross fill-to-reference-horizon markout, not realized P&L. SELL is avoided movement, not short profit. Same symbol and NY entry date only. Excludes derivative/inverse instruments, fees, spread, FX and tax. One observation per recommendation/action/mode; observations may still correlate.",
    summary: {
      recTradeCount: trades.length,
      realCount,
      distinctRecs,
      alignmentRate,
      measuredCount: measured1d.length,
      measuredCount3d: measured3d.length,
      measuredCount5d: measured5d.length,
      excludedTradeCount: trades.filter(t => !t.measurementEligible).length,
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
