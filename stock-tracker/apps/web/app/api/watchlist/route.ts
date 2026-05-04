import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/watchlist — list favorited tickers
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("watchlist")
    .select("symbol, added_at, sort_order")
    .order("sort_order", { ascending: true })
    .order("added_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// POST /api/watchlist  body: { symbol }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
  const symbol = body?.symbol?.trim().toUpperCase();
  if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("watchlist")
    .upsert({ symbol }, { onConflict: "symbol" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/watchlist?symbol=AAPL
export async function DELETE(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "missing symbol" }, { status: 400 });
  const { error } = await supabaseAdmin.from("watchlist").delete().eq("symbol", symbol);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
