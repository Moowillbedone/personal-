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
  insertTrade,
  getTradesForSymbol,
  getTradesByUnderlying,
  getAllTrades,
  deleteTrade,
  type TradeAction,
  type TradeMode,
} from "@/lib/trades";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auto-link window: when the user records a trade without explicitly passing
// ai_analysis_id, look back this far for a verdict on the same symbol and
// link it. 24h matches the daily AI-scan cadence — if it's older than this,
// it's probably stale enough that linking would be misleading.
const AUTOLINK_LOOKBACK_HOURS = 24;

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

interface PostBody {
  symbol?: string;
  action?: TradeAction;
  qty?: number | string;
  price?: number | string;
  mode?: TradeMode;
  ts?: string;
  notes?: string;
  ai_analysis_id?: string;
  signal_id?: string;
  /** Analyzed/underlying symbol when trading a derivative — see lib/trades.ts. */
  underlying_symbol?: string;
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const symbol = body.symbol?.trim().toUpperCase();
  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  if (body.action !== "buy" && body.action !== "sell") {
    return NextResponse.json({ error: "action must be buy or sell" }, { status: 400 });
  }
  const qty = Number(body.qty);
  const price = Number(body.price);
  if (!isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "qty must be > 0" }, { status: 400 });
  }
  if (!isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "price must be > 0" }, { status: 400 });
  }
  const mode = body.mode === "real" ? "real" : "paper";

  // Optional underlying — when present, validate and treat as the asset the
  // AI/signal pipeline analyzed (e.g. TSLA), even though `symbol` is the
  // actually-traded derivative (e.g. TSLL). When equal to symbol or empty,
  // store as null since it adds no new info.
  let underlyingSymbol: string | null = null;
  const rawUnderlying = body.underlying_symbol?.trim().toUpperCase();
  if (rawUnderlying && rawUnderlying !== symbol) {
    if (!SYMBOL_RE.test(rawUnderlying)) {
      return NextResponse.json(
        { error: "invalid underlying_symbol" },
        { status: 400 },
      );
    }
    underlyingSymbol = rawUnderlying;
  }

  // Auto-link to the most recent AI analysis if the caller didn't supply one.
  // CRITICAL: when underlying_symbol is set, look up the analysis on the
  // UNDERLYING (TSLA), not the traded derivative (TSLL) — the AI never
  // analyzed the leveraged ETF, only the underlying asset.
  let aiAnalysisId = body.ai_analysis_id ?? null;
  if (!aiAnalysisId) {
    const lookupSymbol = underlyingSymbol ?? symbol;
    const cutoff = new Date(
      Date.now() - AUTOLINK_LOOKBACK_HOURS * 3600 * 1000,
    ).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("ai_analysis")
      .select("id")
      .eq("symbol", lookupSymbol)
      .gte("created_at", cutoff)
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
      ts: body.ts,
      notes: body.notes ?? null,
      ai_analysis_id: aiAnalysisId,
      signal_id: body.signal_id ?? null,
      underlying_symbol: underlyingSymbol,
    });
    return NextResponse.json({ trade });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
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
