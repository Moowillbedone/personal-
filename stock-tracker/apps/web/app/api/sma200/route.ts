// GET /api/sma200
//
// "200일선 터치 스캐너" — of the NASDAQ-100 + NYSE-100 universe (~200 names),
// which are sitting RIGHT ON their 200-period line?
//
//   위 터치 (above)  = 현재가가 SMA200 바로 위 (0 ~ +band%)  → 매수 후보
//                      (장기 추세선 위에서 지지받는 그림)
//   아래 터치 (below) = 현재가가 SMA200 바로 아래 (−band% ~ 0) → 장기 주의
//                      (추세선 아래로 눌린 그림 — 반등 매수는 가능하나 조심)
//
// Daily(일봉) and weekly(주봉) SMA200 are BOTH precomputed once a day by the
// worker (sma200_scan.py) into public.sma200 — computing 200-bar averages for
// 200 symbols per request is the exact Alpaca fetch storm we removed. This
// route only reads that tiny table + one live snapshot batch per symbol, so it
// stays cheap. lastPrice is session-aware (pre/regular/after), so the touch
// read reflects whichever session Korea is currently in.

import { NextResponse } from "next/server";
import { getSnapshots, currentMarketSession } from "@/lib/alpaca";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK = 100; // Alpaca multi-symbol snapshot cap
const DEFAULT_BAND = 0.03; // ±3% counts as "touching" the 200-line
const MIN_BAND = 0.005;
const MAX_BAND = 0.1;

interface Row {
  symbol: string;
  price: number;
  sma200: number;
  distPct: number; // (price − sma) / sma, signed
  changePct: number | null;
}

interface Sma200Record {
  symbol: string;
  sma200_daily: number | null;
  sma200_weekly: number | null;
  updated_at: string;
}

function classify(
  records: Sma200Record[],
  prices: Record<string, { price: number; changePct: number | null }>,
  field: "sma200_daily" | "sma200_weekly",
  band: number
): { above: Row[]; below: Row[] } {
  const above: Row[] = [];
  const below: Row[] = [];
  for (const rec of records) {
    const sma = rec[field];
    const live = prices[rec.symbol];
    if (sma == null || !(sma > 0) || !live || !(live.price > 0)) continue;
    const distPct = (live.price - sma) / sma;
    if (Math.abs(distPct) > band) continue; // not near the line
    const row: Row = {
      symbol: rec.symbol,
      price: Number(live.price.toFixed(2)),
      sma200: Number(sma.toFixed(2)),
      distPct: Number((distPct * 100).toFixed(2)), // percent
      // changePct arrives as a FRACTION from the snapshot (0.018 = +1.8%);
      // emit it as percent to match distPct's convention (panel just appends %).
      changePct:
        live.changePct == null ? null : Number((live.changePct * 100).toFixed(2)),
    };
    (distPct >= 0 ? above : below).push(row);
  }
  // Closest to the line first (smallest absolute distance).
  above.sort((a, b) => Math.abs(a.distPct) - Math.abs(b.distPct));
  below.sort((a, b) => Math.abs(a.distPct) - Math.abs(b.distPct));
  return { above, below };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bandParam = Number(url.searchParams.get("band"));
  const band =
    Number.isFinite(bandParam) && bandParam > 0
      ? Math.min(MAX_BAND, Math.max(MIN_BAND, bandParam))
      : DEFAULT_BAND;

  const { data, error } = await supabase
    .from("sma200")
    .select("symbol, sma200_daily, sma200_weekly, updated_at");

  const session = currentMarketSession();

  if (error) {
    // Migration 012 not yet applied → relation missing. PostgREST reports this
    // as PGRST205 ("Could not find the table … in the schema cache") rather
    // than the raw Postgres 42P01, so match both (plus a message fallback).
    // Treat as "not ready" → dashboard shows a calm placeholder, not a 500.
    const msg = (error.message || "").toLowerCase();
    const tableMissing =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      msg.includes("schema cache") ||
      msg.includes("does not exist");
    if (tableMissing) {
      return NextResponse.json({
        session,
        band,
        ready: false,
        updatedAt: null,
        daily: { above: [], below: [] },
        weekly: { above: [], below: [] },
      });
    }
    return NextResponse.json(
      { error: `sma200 read failed: ${error.message}` },
      { status: 500 }
    );
  }

  const records = (data ?? []) as Sma200Record[];

  if (records.length === 0) {
    // Table not yet populated (worker hasn't run since the migration).
    return NextResponse.json({
      session,
      band,
      ready: false,
      updatedAt: null,
      daily: { above: [], below: [] },
      weekly: { above: [], below: [] },
    });
  }

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

  const daily = classify(records, prices, "sma200_daily", band);
  const weekly = classify(records, prices, "sma200_weekly", band);

  const updatedAt = records.reduce<string | null>((max, r) => {
    return !max || r.updated_at > max ? r.updated_at : max;
  }, null);

  // Distinguish a live-feed outage from a genuinely empty scan: getSnapshots
  // returns {} on an Alpaca error, which would otherwise render as an innocent
  // "해당 종목 없음" across all 227 names. If we have SMA rows but priced zero,
  // it's a feed problem, not a quiet market.
  const priced = Object.keys(prices).length;
  const degraded = priced === 0;

  return NextResponse.json({
    session,
    band,
    ready: true,
    degraded,
    priced,
    updatedAt,
    universe: records.length,
    daily,
    weekly,
  });
}
