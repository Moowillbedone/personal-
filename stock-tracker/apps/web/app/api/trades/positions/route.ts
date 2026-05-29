// GET /api/trades/positions[?mode=paper|real]
//
// Returns derived positions (one per symbol × mode) plus a P&L summary
// over the trade window. Used by:
//   - /trade sidebar    → "내 포지션" panel
//   - /stats page        → "내 매매 성과" section

import { NextRequest, NextResponse } from "next/server";
import {
  getAllTrades,
  aggregatePositions,
  summarizePnl,
  computeRealizedTimeline,
  type Position,
  type TradeMode,
} from "@/lib/trades";
import { getLatestPriceSnapshot } from "@/lib/marketData";
import { currentMarketSession } from "@/lib/alpaca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap live-pricing fan-out. The user holds well under this; the cap just
// protects the endpoint from a pathological history with hundreds of names.
const MAX_PRICED_POSITIONS = 60;

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
    const trades = await getAllTrades({ mode, since, limit: 5000 });
    const positions = aggregatePositions(trades);
    const summary = summarizePnl(trades, {
      mode,
      windowDays: lookback ?? undefined,
    });
    // Cumulative realized-P&L curve (ties out to summary.realizedPnl).
    const realizedTimeline = computeRealizedTimeline(trades);

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
      summary.totalMarketValue = pricedCount > 0 ? totalMarketValue : null;
      summary.totalUnrealizedPnl = pricedCount > 0 ? totalUnrealized : null;
      summary.totalPnl =
        pricedCount > 0 ? summary.realizedPnl + totalUnrealized : null;
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
  positions: Position[],
  session: "pre" | "regular" | "after" | "closed",
): Promise<void> {
  const apply = (p: Position, price: number | null, asOf: string | null, stale: boolean) => {
    if (price == null || !isFinite(price) || price <= 0) return;
    const marketValue = p.openQty * price;
    p.currentPrice = price;
    p.marketValue = marketValue;
    p.unrealizedPnl = marketValue - p.costBasisOpen;
    p.unrealizedPct =
      p.costBasisOpen > 0 ? (marketValue - p.costBasisOpen) / p.costBasisOpen : null;
    p.priceAsOf = asOf;
    p.priceStale = stale;
  };

  const priceOne = async (p: Position) => {
    try {
      const snap = await getLatestPriceSnapshot(p.symbol);
      const stale = session !== "regular" && snap.priceSource === "iex";
      apply(p, snap.lastPrice, snap.lastTradeTs, stale);
    } catch {
      // leave unpriced
    }
  };

  if (session === "regular") {
    await Promise.all(positions.map(priceOne));
  } else {
    for (const p of positions) await priceOne(p);
  }
}
