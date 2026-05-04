import { NextRequest, NextResponse } from "next/server";
import { getSnapshot } from "@/lib/alpaca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/snapshot?symbols=AAPL,MSFT — batched real-time snapshots
// (pre-market / regular / after-hours all derived from Alpaca latestTrade).
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
        return await getSnapshot(sym);
      } catch (err) {
        return { symbol: sym, error: (err as Error).message };
      }
    }),
  );
  return NextResponse.json({ snapshots: results });
}
