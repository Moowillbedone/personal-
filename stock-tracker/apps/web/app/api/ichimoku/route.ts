// GET /api/ichimoku
//
// "일목균형표 선행스팬 B 터치 스캐너" — of the NASDAQ-100 + NYSE-100 universe,
// which names are sitting RIGHT ON their Ichimoku Leading Span B (선행스팬 B)?
//
//   위 터치 (above)  = 현재가가 스팬B 바로 위 (0 ~ +band%)  → 지지 후보
//   아래 터치 (below) = 현재가가 스팬B 바로 아래 (−band% ~ 0) → 저항·주의
//
// Span B is the (52-high + 52-low)/2 line, projected 26 bars forward — the
// value drawn under TODAY's price was computed 26 bars ago, so it's the cloud
// level price actually touches now. It's a longer-period, stickier 매물대 than
// Span A, hence the reliability focus. Span A is also returned so we can report
// cloud position (price above / in / below the 구름) — Span B being the cloud
// FLOOR (bullish structure) vs CEILING (bearish) changes how a touch reads.
//
// Both spans are precomputed daily by the worker (sma200_scan.py) from bars it
// already fetches — this route only reads the table + one live snapshot batch.

import { NextResponse } from "next/server";
import { getSnapshots, currentMarketSession } from "@/lib/alpaca";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK = 100;
const DEFAULT_BAND = 0.03; // ±3% counts as "touching" Span B
const MIN_BAND = 0.005;
const MAX_BAND = 0.1;

type Cloud = "above" | "in" | "below" | null;

interface Row {
  symbol: string;
  sector: string | null;
  price: number;
  spanB: number;
  spanA: number | null;
  distPct: number; // (price − spanB) / spanB, signed percent
  changePct: number | null;
  cloud: Cloud; // price vs the whole Kumo (min/max of A,B)
}

interface IchiRecord {
  symbol: string;
  sector: string | null;
  spana_daily: number | null;
  spanb_daily: number | null;
  spana_weekly: number | null;
  spanb_weekly: number | null;
  updated_at: string;
}

function cloudPos(price: number, a: number | null, b: number): Cloud {
  if (a == null) return price > b ? "above" : "below"; // no Span A → single-line read
  const top = Math.max(a, b);
  const bot = Math.min(a, b);
  if (price > top) return "above";
  if (price < bot) return "below";
  return "in";
}

function classify(
  records: IchiRecord[],
  prices: Record<string, { price: number; changePct: number | null }>,
  aField: "spana_daily" | "spana_weekly",
  bField: "spanb_daily" | "spanb_weekly",
  band: number
): { above: Row[]; below: Row[] } {
  const above: Row[] = [];
  const below: Row[] = [];
  for (const rec of records) {
    const b = rec[bField];
    const a = rec[aField];
    const live = prices[rec.symbol];
    if (b == null || !(b > 0) || !live || !(live.price > 0)) continue;
    const distPct = (live.price - b) / b;
    if (Math.abs(distPct) > band) continue;
    const row: Row = {
      symbol: rec.symbol,
      sector: rec.sector ?? null,
      price: Number(live.price.toFixed(2)),
      spanB: Number(b.toFixed(2)),
      spanA: a != null ? Number(a.toFixed(2)) : null,
      distPct: Number((distPct * 100).toFixed(2)),
      changePct:
        live.changePct == null ? null : Number((live.changePct * 100).toFixed(2)),
      cloud: cloudPos(live.price, a, b),
    };
    (distPct >= 0 ? above : below).push(row);
  }
  above.sort((x, y) => Math.abs(x.distPct) - Math.abs(y.distPct));
  below.sort((x, y) => Math.abs(x.distPct) - Math.abs(y.distPct));
  return { above, below };
}

const NOT_READY = (session: string, band: number) =>
  NextResponse.json({
    session,
    band,
    ready: false,
    updatedAt: null,
    daily: { above: [], below: [] },
    weekly: { above: [], below: [] },
  });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bandParam = Number(url.searchParams.get("band"));
  const band =
    Number.isFinite(bandParam) && bandParam > 0
      ? Math.min(MAX_BAND, Math.max(MIN_BAND, bandParam))
      : DEFAULT_BAND;

  const session = currentMarketSession();

  let { data, error } = await supabase
    .from("sma200")
    .select(
      "symbol, sector, spana_daily, spanb_daily, spana_weekly, spanb_weekly, updated_at"
    );

  // sector column (migration 013) missing → retry without it; the span columns
  // are what this route needs.
  if (
    error &&
    error.code === "42703" &&
    (error.message || "").toLowerCase().includes("sector")
  ) {
    ({ data, error } = await supabase
      .from("sma200")
      .select(
        "symbol, spana_daily, spanb_daily, spana_weekly, spanb_weekly, updated_at"
      ));
  }

  if (error) {
    // Span columns (014) or the table (012) not there yet → calm placeholder,
    // not a 500. 42703 = missing column, 42P01/PGRST205 = missing table.
    const msg = (error.message || "").toLowerCase();
    if (
      error.code === "42703" ||
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      msg.includes("span") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist")
    ) {
      return NOT_READY(session, band);
    }
    return NextResponse.json(
      { error: `ichimoku read failed: ${error.message}` },
      { status: 500 }
    );
  }

  const records = (data ?? []) as IchiRecord[];
  if (records.length === 0) return NOT_READY(session, band);

  const symbols = records.map((r) => r.symbol);
  const prices: Record<string, { price: number; changePct: number | null }> = {};
  for (let i = 0; i < symbols.length; i += CHUNK) {
    const snaps = await getSnapshots(symbols.slice(i, i + CHUNK));
    for (const [sym, s] of Object.entries(snaps)) {
      if (s.lastPrice != null) {
        prices[sym] = { price: s.lastPrice, changePct: s.changePct };
      }
    }
  }

  const daily = classify(records, prices, "spana_daily", "spanb_daily", band);
  const weekly = classify(records, prices, "spana_weekly", "spanb_weekly", band);

  const updatedAt = records.reduce<string | null>(
    (max, r) => (!max || r.updated_at > max ? r.updated_at : max),
    null
  );

  const priced = Object.keys(prices).length;
  // Per-timeframe counts: daily Span B needs ~78 daily bars, weekly needs ~78
  // WEEKLY bars (~1.5y), so a mid-life listing can have one and not the other.
  // Report both so the panel shows the count that matches the active tab
  // instead of the union (which would overstate the weekly pool).
  const universeDaily = records.filter((r) => r.spanb_daily != null).length;
  const universeWeekly = records.filter((r) => r.spanb_weekly != null).length;

  return NextResponse.json({
    session,
    band,
    ready: true,
    degraded: priced === 0,
    priced,
    updatedAt,
    universeDaily,
    universeWeekly,
    daily,
    weekly,
  });
}
