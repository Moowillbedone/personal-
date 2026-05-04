import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/positions?symbol=AAPL — fetch sizing config for a symbol
export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "missing symbol" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("position_settings")
    .select("*")
    .eq("symbol", symbol)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ setting: data ?? null });
}

interface PositionBody {
  symbol?: string;
  strategy?: "lump_sum" | "dca";
  total_budget_krw?: number | null;
  dca_per_day_krw?: number | null;
  dca_total_days?: number | null;
}

// POST /api/positions  body: { symbol, strategy, total_budget_krw?, dca_per_day_krw?, dca_total_days? }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PositionBody | null;
  const symbol = body?.symbol?.trim().toUpperCase();
  if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  if (body?.strategy !== "lump_sum" && body?.strategy !== "dca") {
    return NextResponse.json({ error: "invalid strategy" }, { status: 400 });
  }
  const row = {
    symbol,
    strategy: body.strategy,
    total_budget_krw: body.total_budget_krw ?? null,
    dca_per_day_krw: body.dca_per_day_krw ?? null,
    dca_total_days: body.dca_total_days ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("position_settings")
    .upsert(row, { onConflict: "symbol" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
