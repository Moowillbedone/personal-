// Trade journal helpers: insert + read trades, derive positions and P&L.
//
// Position math uses weighted-average cost basis, not FIFO/specific-lot.
// That's intentional — it keeps the math obvious enough that the user
// can sanity-check it in their head, and it's correct for the "did I
// make money" question this dashboard is meant to answer. If you ever
// need tax-grade lot accounting, swap the helpers in here without
// touching the API or UI.

import { supabaseAdmin } from "./supabaseAdmin";

export type TradeAction = "buy" | "sell";
export type TradeMode = "paper" | "real";

export interface Trade {
  id: string;
  symbol: string;
  action: TradeAction;
  qty: number;
  price: number;
  mode: TradeMode;
  ts: string;
  notes: string | null;
  ai_analysis_id: string | null;
  signal_id: string | null;
  /**
   * When the user trades a derivative (e.g. leveraged ETF TSLL) on top of
   * a signal/analysis on the underlying (TSLA), `symbol` carries the
   * actually-traded instrument and `underlying_symbol` carries the
   * analyzed asset. Null when trading the underlying directly.
   */
  underlying_symbol: string | null;
  created_at: string;
}

export interface NewTradeInput {
  symbol: string;
  action: TradeAction;
  qty: number;
  price: number;
  mode?: TradeMode;
  ts?: string; // ISO; defaults to now
  notes?: string | null;
  ai_analysis_id?: string | null;
  signal_id?: string | null;
  underlying_symbol?: string | null;
}

export async function insertTrade(t: NewTradeInput): Promise<Trade> {
  const { data, error } = await supabaseAdmin
    .from("trade_log")
    .insert({
      symbol: t.symbol.toUpperCase(),
      action: t.action,
      qty: t.qty,
      price: t.price,
      mode: t.mode ?? "paper",
      ts: t.ts ?? new Date().toISOString(),
      notes: t.notes ?? null,
      ai_analysis_id: t.ai_analysis_id ?? null,
      signal_id: t.signal_id ?? null,
      underlying_symbol: t.underlying_symbol
        ? t.underlying_symbol.toUpperCase()
        : null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertTrade: ${error.message}`);
  return data as Trade;
}

export async function getTradesForSymbol(
  symbol: string,
  opts: { mode?: TradeMode; limit?: number } = {},
): Promise<Trade[]> {
  let q = supabaseAdmin
    .from("trade_log")
    .select("*")
    .eq("symbol", symbol.toUpperCase())
    .order("ts", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.mode) q = q.eq("mode", opts.mode);
  const { data, error } = await q;
  if (error) throw new Error(`getTradesForSymbol: ${error.message}`);
  return (data ?? []) as Trade[];
}

/**
 * Trades where this symbol is the analyzed underlying (e.g. TSLA) but the
 * actual instrument traded is a derivative (e.g. TSLL). Used by the trade
 * page's TSLA detail view to surface "you traded TSLL on this analysis."
 */
export async function getTradesByUnderlying(
  underlying: string,
  opts: { mode?: TradeMode; limit?: number } = {},
): Promise<Trade[]> {
  let q = supabaseAdmin
    .from("trade_log")
    .select("*")
    .eq("underlying_symbol", underlying.toUpperCase())
    .order("ts", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.mode) q = q.eq("mode", opts.mode);
  const { data, error } = await q;
  if (error) throw new Error(`getTradesByUnderlying: ${error.message}`);
  return (data ?? []) as Trade[];
}

export async function getAllTrades(opts: {
  mode?: TradeMode;
  since?: string;
  limit?: number;
}): Promise<Trade[]> {
  let q = supabaseAdmin
    .from("trade_log")
    .select("*")
    .order("ts", { ascending: false })
    .limit(opts.limit ?? 1000);
  if (opts.mode) q = q.eq("mode", opts.mode);
  if (opts.since) q = q.gte("ts", opts.since);
  const { data, error } = await q;
  if (error) throw new Error(`getAllTrades: ${error.message}`);
  return (data ?? []) as Trade[];
}

export async function deleteTrade(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("trade_log").delete().eq("id", id);
  if (error) throw new Error(`deleteTrade: ${error.message}`);
}

// ─── position math ─────────────────────────────────────────────────────────

/**
 * Lightweight per-trade record bundled into Position for the stats page —
 * lets the user see the rationale they wrote at trade time without
 * round-tripping back to the trade page. Only includes trades that had a
 * non-empty note (silence speaks for itself).
 */
export interface PositionTradeNote {
  ts: string;            // ISO timestamp
  action: TradeAction;
  qty: number;
  price: number;
  note: string;          // trimmed, guaranteed non-empty
}

export interface Position {
  symbol: string;
  mode: TradeMode;
  /** Net shares held. Sum of buys minus sells. */
  openQty: number;
  /** Weighted-average cost across all buys (NOT reduced by sells). */
  avgBuyPrice: number | null;
  /** Total cost basis of currently-open shares = openQty × avgBuyPrice. */
  costBasisOpen: number;
  /** Realized P&L = sell_revenue - (avg_buy × sold_qty). */
  realizedPnl: number;
  /** Total qty bought across history (for context). */
  totalBuyQty: number;
  /** Total qty sold across history (for context). */
  totalSellQty: number;
  tradeCount: number;
  /** All non-empty notes from trades in this position, recent-first.
   *  Surfaced on /stats so the user can review entry/exit rationale. */
  notedTrades: PositionTradeNote[];
  // ─── live mark-to-market (filled by the API route, not computePosition) ───
  /** Latest price for the held symbol, or null if pricing failed. */
  currentPrice?: number | null;
  /** openQty × currentPrice. */
  marketValue?: number | null;
  /** marketValue − costBasisOpen. */
  unrealizedPnl?: number | null;
  /** unrealizedPnl / costBasisOpen. */
  unrealizedPct?: number | null;
  /** When the quote was taken (lastTradeTs). */
  priceAsOf?: string | null;
  /** true when the quote fell back to IEX during a non-regular session
   *  (i.e. it's a stale regular-close, not a live extended-hours price). */
  priceStale?: boolean;
}

/**
 * Reduce a list of trades for ONE (symbol, mode) into a Position.
 * Caller is responsible for filtering — this function trusts its input.
 */
export function computePosition(
  symbol: string,
  mode: TradeMode,
  trades: Trade[],
): Position {
  let totalBuyQty = 0;
  let totalBuyCost = 0;
  let totalSellQty = 0;
  let totalSellRevenue = 0;
  for (const t of trades) {
    if (t.action === "buy") {
      totalBuyQty += t.qty;
      totalBuyCost += t.qty * t.price;
    } else {
      totalSellQty += t.qty;
      totalSellRevenue += t.qty * t.price;
    }
  }
  const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : null;
  const realizedPnl =
    avgBuyPrice != null ? totalSellRevenue - avgBuyPrice * totalSellQty : 0;
  const openQty = totalBuyQty - totalSellQty;
  const costBasisOpen = avgBuyPrice != null ? Math.max(0, openQty) * avgBuyPrice : 0;

  // Collect only trades that carry a real note. Sorted recent-first so the
  // stats page shows the latest rationale at the top.
  const notedTrades: PositionTradeNote[] = trades
    .filter((t) => t.notes && t.notes.trim().length > 0)
    .map((t) => ({
      ts: t.ts,
      action: t.action,
      qty: t.qty,
      price: t.price,
      note: t.notes!.trim(),
    }))
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  return {
    symbol,
    mode,
    openQty,
    avgBuyPrice,
    costBasisOpen,
    realizedPnl,
    totalBuyQty,
    totalSellQty,
    tradeCount: trades.length,
    notedTrades,
  };
}

/**
 * Group trades by (symbol, mode) and produce one Position per group.
 * Symbols with zero open qty AND zero realized P&L are dropped — they're
 * just noise (e.g. a buy that was immediately reversed at the same price).
 */
export function aggregatePositions(trades: Trade[]): Position[] {
  const buckets = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = `${t.symbol}|${t.mode}`;
    const arr = buckets.get(key);
    if (arr) arr.push(t);
    else buckets.set(key, [t]);
  }
  const out: Position[] = [];
  for (const [key, group] of buckets) {
    const [symbol, mode] = key.split("|") as [string, TradeMode];
    const p = computePosition(symbol, mode, group);
    if (p.openQty === 0 && p.realizedPnl === 0) continue;
    out.push(p);
  }
  // Open positions first, then by abs(realized P&L) desc.
  out.sort((a, b) => {
    const aOpen = a.openQty > 0 ? 1 : 0;
    const bOpen = b.openQty > 0 ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl);
  });
  return out;
}

/** One vertex of the cumulative realized-P&L curve. */
export interface RealizedPoint {
  /** ISO timestamp of the sell event (or the leading baseline). */
  ts: string;
  /** Cumulative realized P&L up to and including this event. */
  cumulative: number;
}

/**
 * Chronological cumulative realized-P&L curve over the given trades.
 *
 * Realizes each sell against that symbol's weighted-average buy price taken
 * over the WHOLE set (identical basis to computePosition). Because
 *   Σ_sells (sellPrice − avgBuy) · qty  ≡  totalSellRevenue − avgBuy · totalSellQty,
 * the final cumulative value ties out exactly to the sum of per-symbol
 * realizedPnl — i.e. the curve's endpoint equals the headline 실현 손익.
 *
 * One point per sell event, with a leading 0 baseline so the curve starts
 * flat at zero. Returns [] when there are no realizing sells (nothing to plot).
 */
export function computeRealizedTimeline(trades: Trade[]): RealizedPoint[] {
  if (trades.length === 0) return [];

  // Per-symbol global average buy price (across the entire set).
  const buyQty = new Map<string, number>();
  const buyCost = new Map<string, number>();
  for (const t of trades) {
    if (t.action === "buy") {
      buyQty.set(t.symbol, (buyQty.get(t.symbol) ?? 0) + t.qty);
      buyCost.set(t.symbol, (buyCost.get(t.symbol) ?? 0) + t.qty * t.price);
    }
  }
  const avgBuy = (sym: string): number | null => {
    const q = buyQty.get(sym) ?? 0;
    return q > 0 ? (buyCost.get(sym) ?? 0) / q : null;
  };

  const sorted = [...trades].sort((a, b) =>
    a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0,
  );

  let cumulative = 0;
  const points: RealizedPoint[] = [
    // Baseline: 0 at the first trade so the curve opens flat at zero.
    { ts: sorted[0].ts, cumulative: 0 },
  ];
  for (const t of sorted) {
    if (t.action !== "sell") continue;
    const a = avgBuy(t.symbol);
    if (a == null) continue; // sold with no buy basis → contributes 0
    cumulative += (t.price - a) * t.qty;
    points.push({ ts: t.ts, cumulative });
  }

  return points.length > 1 ? points : [];
}

export interface PnlSummary {
  mode: TradeMode | "all";
  windowDays: number | null;
  tradeCount: number;
  realizedPnl: number;
  /** Closed positions: bought and fully sold. */
  closedPositionCount: number;
  /** Of closed positions, fraction that finished profitable. */
  winRate: number | null;
  // ─── live mark-to-market roll-ups (filled by the API route) ───
  /** Open positions (openQty > 0). */
  openPositionCount?: number;
  /** Of openPositionCount, how many got a live quote. */
  pricedPositionCount?: number;
  /** Σ costBasisOpen across open positions. */
  totalCostBasisOpen?: number;
  /** Σ marketValue across priced open positions, or null if none priced. */
  totalMarketValue?: number | null;
  /** Σ unrealizedPnl across priced open positions, or null if none priced. */
  totalUnrealizedPnl?: number | null;
  /** realizedPnl + totalUnrealizedPnl (when any unrealized is available). */
  totalPnl?: number | null;
}

/** Aggregate realized P&L across all trades in scope. */
export function summarizePnl(
  trades: Trade[],
  opts: { mode?: TradeMode; windowDays?: number } = {},
): PnlSummary {
  let realized = 0;
  let closedCount = 0;
  let wins = 0;
  const positions = aggregatePositions(trades);
  for (const p of positions) {
    realized += p.realizedPnl;
    if (p.openQty <= 0 && p.totalSellQty > 0) {
      closedCount += 1;
      if (p.realizedPnl > 0) wins += 1;
    }
  }
  return {
    mode: opts.mode ?? "all",
    windowDays: opts.windowDays ?? null,
    tradeCount: trades.length,
    realizedPnl: realized,
    closedPositionCount: closedCount,
    winRate: closedCount > 0 ? wins / closedCount : null,
  };
}
