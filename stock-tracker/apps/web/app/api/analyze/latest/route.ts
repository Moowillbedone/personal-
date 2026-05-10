// GET /api/analyze/latest?symbol=AAPL[&maxAgeHours=24]
//
// Returns the most recent ai_analysis row for a symbol, or null if none
// within the lookback window. Pure DB lookup — does NOT trigger a fresh
// Gemini call. Used by the trade page to surface a recent verdict the
// moment a user selects a symbol, so they don't have to re-run analysis
// to see "what did AI say last time."
//
// If you want a fresh analysis, hit /api/analyze (POST) instead.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = sp.get("symbol")?.trim().toUpperCase();
  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  const maxAgeHours = Math.max(
    1,
    Math.min(168, Number(sp.get("maxAgeHours") ?? "24") || 24),
  );
  const cutoff = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("ai_analysis")
    .select("*")
    .eq("symbol", symbol)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ analysis: data ?? null });
}
