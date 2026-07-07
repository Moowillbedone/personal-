// GET/POST/DELETE /api/positions/override
//
// Manual average-cost override per symbol (see migration 011). Powers the
// dashboard 내 포지션 처방 "평단 수정" so a wrong derived average (incomplete
// journal) can be corrected and the prescription recomputed. Dashboard-scoped
// only — does not touch trade_log or /stats.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("position_overrides")
      .select("symbol,avg_cost,note,updated_at");
    if (error) throw error;
    return NextResponse.json({ overrides: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { symbol?: string; avg_cost?: number | string; note?: string }
      | null;
    const symbol = body?.symbol?.trim().toUpperCase();
    if (!symbol || !SYMBOL_RE.test(symbol)) {
      return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
    }
    const avgCost = Number(body?.avg_cost);
    if (!Number.isFinite(avgCost) || avgCost <= 0) {
      return NextResponse.json({ error: "avg_cost must be a positive number" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("position_overrides")
      .upsert(
        { symbol, avg_cost: avgCost, note: body?.note ?? null, updated_at: new Date().toISOString() },
        { onConflict: "symbol" },
      );
    if (error) throw error;
    return NextResponse.json({ ok: true, symbol, avg_cost: avgCost });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
    if (!symbol || !SYMBOL_RE.test(symbol)) {
      return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("position_overrides")
      .delete()
      .eq("symbol", symbol);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
