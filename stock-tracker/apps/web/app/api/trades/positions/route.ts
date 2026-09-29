// GET /api/trades/positions[?mode=paper|real]
//
// Returns derived positions (one per symbol × mode) plus a P&L summary
// over the trade window. Used by:
//   - /trade sidebar    → "내 포지션" panel
//   - /stats page        → "내 매매 성과" section

import { NextRequest, NextResponse } from "next/server";
import {
  aggregatePositions,
  summarizePnl,
  computeRealizedTimeline,
  type Position,
  type TradeMode,
  type Trade,
} from "@/lib/trades";
import { getLatestPriceSnapshot } from "@/lib/marketData";
import { currentMarketSession } from "@/lib/alpaca";
import { snapshotQuality, type DataQuality } from "@/lib/dataQuality";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap live-pricing fan-out. The user holds well under this; the cap just
// protects the endpoint from a pathological history with hundreds of names.
const MAX_PRICED_POSITIONS = 60;

/** Cost basis needs the complete ledger, including buys before lookback.
 * Supabase can enforce a row ceiling lower than .limit(); use small pages,
 * verify exact counts and refuse a partial ledger rather than invent P&L. */
async function completeHistory(mode: TradeMode | undefined): Promise<Trade[]> {
  const snapshotAt = new Date().toISOString();
  const trades: Trade[] = [];
  const pageSize = 500;
  const maxRows = 100_000;
  let expectedCount: number | null = null;
  while (true) {
    let query = supabaseAdmin.from("trade_log").select("*", { count: "exact" })
      .lte("created_at", snapshotAt)
      .order("ts", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(trades.length, trades.length + pageSize - 1);
    if (mode) query = query.eq("mode", mode);
    const { data, count, error } = await query;
    if (error) throw new Error(`거래 이력 조회 실패: ${error.message}`);
    if (count == null || count > maxRows) throw new Error("전체 거래 이력을 확인할 수 없어 손익 계산을 중단했습니다.");
    if (expectedCount != null && expectedCount !== count) throw new Error("조회 중 거래 이력이 변경되었습니다. 다시 불러와 주세요.");
    expectedCount = count;
    trades.push(...((data ?? []) as Trade[]));
    if (trades.length === expectedCount) return trades;
    if (!data?.length || trades.length > expectedCount) throw new Error("거래 이력이 일부 누락되어 손익 계산을 중단했습니다.");
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const modeRaw = sp.get("mode");
  const mode: TradeMode | undefined =
    modeRaw === "paper" || modeRaw === "real" ? modeRaw : undefined;
  const lookback = sp.get("lookback")
    ? Math.max(1, Math.min(3650, Number(sp.get("lookback")) || 90))
    : null;
  const since = lookback
    ? new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString()
    : undefined;
  // Live mark-to-market is on by default; ?prices=0 opts out (faster load).
  const withPrices = sp.get("prices") !== "0";

  try {
    const trades = await completeHistory(mode);
    const positions = aggregatePositions(trades);
    const summary = summarizePnl(trades, {
      mode,
      windowDays: lookback ?? undefined,
      since,
    });
    // Cumulative realized-P&L curve (ties out to summary.realizedPnl).
    const realizedTimeline = computeRealizedTimeline(trades, since);

    // ─── live mark-to-market on open positions ──────────────────────────
    const openPositions = positions.filter((p) => p.openQty > 0);
    summary.openPositionCount = openPositions.length;
    summary.totalCostBasisOpen = openPositions.reduce(
      (a, p) => a + p.costBasisOpen,
      0,
    );

    if (withPrices && openPositions.length > 0) {
      const session = currentMarketSession();
      const toPrice = openPositions.slice(0, MAX_PRICED_POSITIONS);
      await enrichWithPrices(toPrice, session);

      let pricedCount = 0;
      let totalMarketValue = 0;
      let totalUnrealized = 0;
      for (const p of openPositions) {
        if (p.currentPrice != null && p.marketValue != null) {
          pricedCount += 1;
          totalMarketValue += p.marketValue;
          totalUnrealized += p.unrealizedPnl ?? 0;
        }
      }
      summary.pricedPositionCount = pricedCount;
      const completePricing = pricedCount === openPositions.length;
      summary.totalMarketValue = completePricing ? totalMarketValue : null;
      summary.totalUnrealizedPnl = completePricing ? totalUnrealized : null;
      // With a lookback, current unrealized P&L is not the change in value
      // during that period. Expose components, never add unlike horizons.
      summary.totalPnl = completePricing && !since ? summary.realizedPnl + totalUnrealized : null;
    } else {
      summary.pricedPositionCount = 0;
      summary.totalMarketValue = null;
      summary.totalUnrealizedPnl = null;
      summary.totalPnl = null;
    }

    return NextResponse.json({
      asOf: new Date().toISOString(),
      positions,
      summary,
      realizedTimeline,
      historyComplete: true,
      historyTradeCount: trades.length,
      pricingComplete: summary.pricedPositionCount === openPositions.length,
      methodology: "Full-history chronological average cost. Realized events are filtered by the selected window; open positions are current. Fees, tax, FX and broker reconciliation are not included. Current unrealized P&L is not period investment return.",
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * Fetch a live quote per open position and fold mark-to-market fields onto
 * each (mutates in place). Quotes are best-effort: a failure leaves the
 * position's price fields undefined so the UI shows "—" rather than erroring.
 * Regular session → all in parallel (Alpaca IEX is cheap). Non-regular →
 * sequential to respect Finnhub/Yahoo per-symbol rate limits.
 */
async function enrichWithPrices(
  positions: Array<Position & { priceDataQuality?: DataQuality }>,
  session: "pre" | "regular" | "after" | "closed",
): Promise<void> {
  const apply = (p: Position & { priceDataQuality?: DataQuality }, price: number | null, quality: DataQuality) => {
    p.priceAsOf = quality.asOf;
    p.priceStale = quality.status !== "fresh";
    p.priceDataQuality = quality;
    p.currentPrice = null;
    p.marketValue = null;
    p.unrealizedPnl = null;
    p.unrealizedPct = null;
    // A source name is not a freshness guarantee. Closed-session observations
    // and stale/invalid quotes remain visible as metadata, never current P&L.
    if (quality.status !== "fresh" || price == null || !Number.isFinite(price) || price <= 0) return;
    const marketValue = p.openQty * price;
    p.currentPrice = price;
    p.marketValue = marketValue;
    p.unrealizedPnl = marketValue - p.costBasisOpen;
    p.unrealizedPct =
      p.costBasisOpen > 0 ? (marketValue - p.costBasisOpen) / p.costBasisOpen : null;
  };

  const priceOne = async (p: Position & { priceDataQuality?: DataQuality }) => {
    try {
      const snap = await getLatestPriceSnapshot(p.symbol);
      // Recheck at use time in case fetching a fallback took a long time.
      const quality = snapshotQuality(snap.lastTradeTs, snap.lastPrice, session);
      if (snap.dataQuality && snap.dataQuality.status !== "fresh") {
        if (quality.status === "fresh") quality.status = snap.dataQuality.status;
        quality.reasons = Array.from(new Set([...quality.reasons, ...snap.dataQuality.reasons]));
      }
      apply(p, snap.lastPrice, quality);
    } catch {
      const quality = snapshotQuality(null, null, session);
      quality.reasons.push("가격 공급자 응답을 확인하지 못했습니다.");
      apply(p, null, quality);
    }
  };

  if (session === "regular") {
    await Promise.all(positions.map(priceOne));
  } else {
    for (const p of positions) await priceOne(p);
  }
}
