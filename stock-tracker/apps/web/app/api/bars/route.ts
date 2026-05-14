// GET /api/bars?symbol=AAPL[&interval=1d&days=380]
//
// Caller-controlled OHLC bar fetch via Alpaca IEX. Used by the ticker
// detail page to render the chart with a configurable timeframe (default
// 1-year daily). Kept separate from /api/analyze's internal bar fetch
// because analyze always wants the fixed 5-day-5min + 1-year-daily
// bundle, whereas chart consumers want flexibility.
//
// This endpoint is read-only and pulls live from Alpaca on each call;
// no DB write, no caching layer. Vercel's edge / function caching at
// the response level handles any deduplication.

import { NextRequest, NextResponse } from "next/server";
import { fetchAlpacaBars } from "@/lib/alpaca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

// Map short interval codes to Alpaca's TitleCase timeframe values.
const TIMEFRAME_MAP: Record<string, string> = {
  "1m": "1Min",
  "5m": "5Min",
  "15m": "15Min",
  "1h": "1Hour",
  "1d": "1Day",
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = sp.get("symbol")?.trim().toUpperCase();
  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
  }
  const interval = (sp.get("interval") ?? "1d").toLowerCase();
  const tf = TIMEFRAME_MAP[interval];
  if (!tf) {
    return NextResponse.json(
      { error: `invalid interval (allowed: ${Object.keys(TIMEFRAME_MAP).join(", ")})` },
      { status: 400 },
    );
  }
  // Cap days at ~5 years for safety; default 380 ≈ 1 year of trading days.
  const days = Math.max(1, Math.min(1825, Number(sp.get("days") ?? "380") || 380));

  try {
    const bars = await fetchAlpacaBars(symbol, tf, days);
    return NextResponse.json({
      symbol,
      interval,
      days,
      bars: bars.map((b) => ({
        ts: b.ts,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "bars fetch failed" },
      { status: 500 },
    );
  }
}
