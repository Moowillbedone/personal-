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
  type TradeMode,
} from "@/lib/trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  try {
    const trades = await getAllTrades({ mode, since, limit: 5000 });
    const positions = aggregatePositions(trades);
    const summary = summarizePnl(trades, {
      mode,
      windowDays: lookback ?? undefined,
    });
    return NextResponse.json({
      asOf: new Date().toISOString(),
      positions,
      summary,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
