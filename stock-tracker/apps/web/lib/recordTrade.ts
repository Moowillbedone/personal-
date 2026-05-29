// Shared trade-recording pipeline: validate → auto-link AI analysis → insert.
//
// Extracted from the /api/trades POST handler so the single-trade route and
// the bulk-backfill route (/api/trades/bulk) share ONE source of truth for
// validation, normalization, and the AI-analysis auto-link. Keeping this in
// one place means a fix to the symbol regex or the link window can't drift
// between the two endpoints.

import { insertTrade, type Trade, type TradeAction, type TradeMode } from "./trades";
import { supabaseAdmin } from "./supabaseAdmin";

export const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

// Auto-link window: when the caller doesn't pass ai_analysis_id, look this far
// back (relative to the TRADE's timestamp, not "now") for a verdict on the
// same symbol and link it. Anchoring on the trade's own ts is what makes
// backfilled trades link to the analysis that actually preceded them, instead
// of whatever happens to be the most recent verdict today.
const AUTOLINK_LOOKBACK_HOURS = 24;

export interface TradeInputBody {
  symbol?: string;
  action?: TradeAction;
  qty?: number | string;
  price?: number | string;
  mode?: TradeMode;
  ts?: string;
  notes?: string | null;
  ai_analysis_id?: string | null;
  signal_id?: string | null;
  /** Analyzed/underlying symbol when trading a derivative — see lib/trades.ts. */
  underlying_symbol?: string | null;
}

export interface RecordResult {
  trade?: Trade;
  error?: string;
  /** HTTP-style status so the route can pass it straight through. */
  status: number;
}

/**
 * Validate + normalize a single trade input, auto-link the most recent AI
 * analysis (within 24h BEFORE the trade), and insert it. Returns a result
 * carrying either the inserted trade or an error + status code. Never throws.
 */
export async function recordTrade(body: TradeInputBody): Promise<RecordResult> {
  const symbol = body.symbol?.trim().toUpperCase();
  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return { error: "invalid symbol", status: 400 };
  }
  if (body.action !== "buy" && body.action !== "sell") {
    return { error: "action must be buy or sell", status: 400 };
  }
  const qty = Number(body.qty);
  const price = Number(body.price);
  if (!isFinite(qty) || qty <= 0) {
    return { error: "qty must be > 0", status: 400 };
  }
  if (!isFinite(price) || price <= 0) {
    return { error: "price must be > 0", status: 400 };
  }
  // Default to real: the user trades real money only (no paper-mode UI).
  // Explicit mode:"paper" is still honored for back-compat.
  const mode: TradeMode = body.mode === "paper" ? "paper" : "real";

  // Optional underlying — the asset the AI/signal pipeline analyzed (e.g. TSLA)
  // when `symbol` is the actually-traded derivative (e.g. TSLL). When equal to
  // symbol or empty, store null since it adds no new info.
  let underlyingSymbol: string | null = null;
  const rawUnderlying = body.underlying_symbol?.trim().toUpperCase();
  if (rawUnderlying && rawUnderlying !== symbol) {
    if (!SYMBOL_RE.test(rawUnderlying)) {
      return { error: "invalid underlying_symbol", status: 400 };
    }
    underlyingSymbol = rawUnderlying;
  }

  // Validate the timestamp up front so a bad date can't silently fall back to
  // "now" (which would misdate a backfill). Empty/undefined → now (live trade).
  let tsIso: string | undefined;
  if (body.ts != null && body.ts !== "") {
    const d = new Date(body.ts);
    if (isNaN(d.getTime())) {
      return { error: "invalid ts (timestamp)", status: 400 };
    }
    tsIso = d.toISOString();
  }

  // Auto-link to the most recent AI analysis in the 24h window ending at the
  // trade's timestamp, if the caller didn't supply one. CRITICAL: when
  // underlying_symbol is set, look up the analysis on the UNDERLYING (TSLA),
  // not the traded derivative (TSLL) — the AI only analyzed the underlying.
  let aiAnalysisId = body.ai_analysis_id ?? null;
  if (!aiAnalysisId) {
    const lookupSymbol = underlyingSymbol ?? symbol;
    const anchor = tsIso ? new Date(tsIso) : new Date();
    const lo = new Date(
      anchor.getTime() - AUTOLINK_LOOKBACK_HOURS * 3600 * 1000,
    ).toISOString();
    const hi = anchor.toISOString();
    const { data: recent } = await supabaseAdmin
      .from("ai_analysis")
      .select("id")
      .eq("symbol", lookupSymbol)
      .gte("created_at", lo)
      .lte("created_at", hi)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.id) aiAnalysisId = recent.id as string;
  }

  try {
    const trade = await insertTrade({
      symbol,
      action: body.action,
      qty,
      price,
      mode,
      ts: tsIso,
      notes: body.notes ?? null,
      ai_analysis_id: aiAnalysisId,
      signal_id: body.signal_id ?? null,
      underlying_symbol: underlyingSymbol,
    });
    return { trade, status: 200 };
  } catch (err) {
    return { error: (err as Error).message, status: 500 };
  }
}
