import { NextRequest, NextResponse } from "next/server";
import { getLatestPriceSnapshot } from "@/lib/marketData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/snapshot?symbols=AAPL,MSFT — batched real-time snapshots.
// Regular session: Alpaca IEX. Pre/after/closed: Yahoo extended hours
// (per symbol, fail-soft to IEX). Called only on user-triggered refresh
// — auto-polling is intentionally off to avoid Yahoo rate-limiting the
// Vercel datacenter IP across 20+ tickers.
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("symbols") ?? "").trim();
  if (!raw) return NextResponse.json({ snapshots: [] });

  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s))
    .slice(0, 50);

  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        return await getLatestPriceSnapshot(sym);
      } catch (err) {
        return { symbol: sym, error: (err as Error).message };
      }
    }),
  );
  return NextResponse.json({ snapshots: results });
}

