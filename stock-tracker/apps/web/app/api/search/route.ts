import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/search?q=AA — symbol/name search across the assets table.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  const upper = q.toUpperCase();
  const limit = 20;

  // 1) Symbol prefix match (fast, exact-ish).
  const { data: bySymbol, error: e1 } = await supabaseAdmin
    .from("assets")
    .select("symbol, name, exchange")
    .like("symbol", `${upper}%`)
    .eq("tradable", true)
    .order("symbol")
    .limit(limit);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  // 2) If query is long enough, also fall back to name ILIKE search.
  let byName: Array<{ symbol: string; name: string | null; exchange: string | null }> = [];
  if (q.length >= 2 && (bySymbol?.length ?? 0) < limit) {
    const { data, error } = await supabaseAdmin
      .from("assets")
      .select("symbol, name, exchange")
      .ilike("name", `%${q}%`)
      .eq("tradable", true)
      .order("symbol")
      .limit(limit - (bySymbol?.length ?? 0));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    byName = data ?? [];
  }

  const seen = new Set<string>();
  const results: Array<{ symbol: string; name: string | null; exchange: string | null }> = [];
  for (const row of [...(bySymbol ?? []), ...byName]) {
    if (seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    results.push(row);
    if (results.length >= limit) break;
  }
  return NextResponse.json({ results });
}
