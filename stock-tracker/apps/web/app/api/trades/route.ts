// /api/trades — record / query the trade journal.
//
//   POST   /api/trades                         — log a new trade
//   GET    /api/trades?symbol=AAPL[&mode=paper]  — fetch history (per-symbol)
//   GET    /api/trades?since=ISO[&mode=...]      — fetch history (time-windowed)
//   DELETE /api/trades?id=UUID                 — remove an erroneously logged trade
//
// The endpoint is intentionally thin — all position math lives in
// lib/trades.ts so /api/trades/positions can reuse it without duplication.

import { NextRequest, NextResponse } from "next/server";
import {
  getTradesForSymbol,
  getTradesByUnderlying,
  getAllTrades,
  deleteTrade,
  type TradeMode,
} from "@/lib/trades";
import { recordTrade, type TradeInputBody } from "@/lib/recordTrade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: TradeInputBody;
  try {
    body = (await req.json()) as TradeInputBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // Validation, AI-analysis auto-link, and insert all live in recordTrade so
  // this route and /api/trades/bulk can't drift apart.
  const result = await recordTrade(body);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ trade: result.trade });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = sp.get("symbol")?.trim().toUpperCase();
  const underlyingSymbol = sp.get("underlying_symbol")?.trim().toUpperCase();
  const modeRaw = sp.get("mode");
  const mode: TradeMode | undefined =
    modeRaw === "paper" || modeRaw === "real" ? modeRaw : undefined;
  const since = sp.get("since") ?? undefined;
  const limit = Math.min(1000, Math.max(1, Number(sp.get("limit") ?? "100") || 100));

  try {
    let trades;
    if (underlyingSymbol) {
      trades = await getTradesByUnderlying(underlyingSymbol, { mode, limit });
    } else if (symbol) {
      trades = await getTradesForSymbol(symbol, { mode, limit });
    } else {
      trades = await getAllTrades({ mode, since, limit });
    }
    return NextResponse.json({ trades });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    await deleteTrade(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
