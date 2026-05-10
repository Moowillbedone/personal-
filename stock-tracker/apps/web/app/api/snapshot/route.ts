import { NextRequest, NextResponse } from "next/server";
import { getLatestPriceSnapshot } from "@/lib/marketData";
import { currentMarketSession } from "@/lib/alpaca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Symbols per refresh request. 100 covers projected max watchlist size.
// Regular session: hit all in parallel (Alpaca free is 200 req/min, easily
// handles 100 batched IEX snapshots in one HTTP call). Non-regular: throttle
// because each symbol fans out to a per-symbol Yahoo chart fetch and 100
// parallel Yahoo calls from a Vercel data-center IP gets blocked instantly.
const MAX_SYMBOLS = 100;
const NON_REGULAR_BATCH_SIZE = 5;
const NON_REGULAR_BATCH_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// GET /api/snapshot?symbols=AAPL,MSFT — batched real-time snapshots.
// Regular session: Alpaca IEX (parallel). Pre/after/closed: Yahoo extended
// hours per symbol, throttled in batches of 5 with a 250ms gap to stay
// below Yahoo's IP-based block thresholds. Called only on user-triggered
// refresh — auto-polling is intentionally off.
export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("symbols") ?? "").trim();
  if (!raw) return NextResponse.json({ snapshots: [] });

  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s))
    .slice(0, MAX_SYMBOLS);

  const session = currentMarketSession();

  const fetchOne = async (sym: string) => {
    try {
      return await getLatestPriceSnapshot(sym);
    } catch (err) {
      return { symbol: sym, error: (err as Error).message };
    }
  };

  // Regular session: full parallelism, single batched IEX call deep inside.
  // Worst-case latency ~2s for 100 symbols.
  if (session === "regular") {
    const results = await Promise.all(symbols.map(fetchOne));
    return NextResponse.json({ snapshots: results });
  }

  // Non-regular session: each symbol triggers its own Yahoo chart fetch.
  // Batched + throttled so 100 symbols become 20 batches × ~250ms = ~5s
  // total — slow enough to stay polite to Yahoo, fast enough that the
  // refresh button still feels snappy.
  const results: Awaited<ReturnType<typeof fetchOne>>[] = [];
  for (let i = 0; i < symbols.length; i += NON_REGULAR_BATCH_SIZE) {
    const batch = symbols.slice(i, i + NON_REGULAR_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchOne));
    results.push(...batchResults);
    // Gap between batches; skip on the last batch.
    if (i + NON_REGULAR_BATCH_SIZE < symbols.length) {
      await sleep(NON_REGULAR_BATCH_DELAY_MS);
    }
  }
  return NextResponse.json({ snapshots: results });
}
