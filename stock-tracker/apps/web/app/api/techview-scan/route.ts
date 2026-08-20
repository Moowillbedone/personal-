// GET /api/techview-scan
//
// Tech View 탭의 "터치 셋업 스캐너" — NASDAQ-100 + NYSE-100 중 핵심 라인(주봉 빗각 /
// 피보나치)에 터치했거나 근접한 종목. The verdict is precomputed daily by the worker
// (sma200_scan.py → worker/lib/techview.py) into public.sma200, so this route is a
// PURE table read — no per-request bar fetch. Everything is as-of tech_at, so the
// price shown is the one the levels were computed against (consistent snapshot).

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Rec {
  symbol: string;
  sector: string | null;
  tech_setup: string | null;
  tech_price: number | null;
  tech_nearest_label: string | null;
  tech_nearest_dist: number | null;
  tech_target_upside: number | null;
  tech_note: string | null;
  tech_at: string | null;
}

// Only these are worth listing — 'extended'/'no_structure' are the "not now" bucket.
const SHOWN = ["touch_confirmed", "touch_pending", "at_level", "approaching"] as const;
const RANK: Record<string, number> = {
  touch_confirmed: 0,
  touch_pending: 1,
  at_level: 2,
  approaching: 3,
};

const NOT_READY = NextResponse.json({
  ready: false,
  updatedAt: null,
  counts: {},
  rows: [],
});

export async function GET() {
  const { data, error } = await supabase
    .from("sma200")
    .select(
      "symbol, sector, tech_setup, tech_price, tech_nearest_label, tech_nearest_dist, tech_target_upside, tech_note, tech_at",
    );

  if (error) {
    // migration 018 not applied yet (or table missing) → calm placeholder.
    const msg = (error.message || "").toLowerCase();
    if (
      error.code === "42703" ||
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      msg.includes("tech_") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist")
    ) {
      return NOT_READY;
    }
    return NextResponse.json(
      { error: `techview-scan read failed: ${error.message}` },
      { status: 500 },
    );
  }

  const records = ((data ?? []) as Rec[]).filter((r) => r.tech_setup != null);
  if (records.length === 0) return NOT_READY;

  const counts: Record<string, number> = {};
  for (const r of records) {
    if (r.tech_setup) counts[r.tech_setup] = (counts[r.tech_setup] ?? 0) + 1;
  }

  // Ranking within a tier: 빗각(weekly channel) touches first. Backtest
  // (30 symbols, 5y, walk-forward) showed 빗각 touches carried the only positive
  // cross-sectional excess (+0.20/+0.03/+0.73% at 5/10/20d) while 피보-only
  // touches were negative (−0.23/−0.47/−0.62%), and under stop/target rules
  // 빗각 expectancy was ~2x 피보 (+1.09% vs +0.56% at −5%/+10%). Confluence is
  // deliberately NOT used — it ranked inversely to forward returns.
  const isDiagonal = (note: string | null): number => (note?.startsWith("빗각") ? 1 : 0);

  const rows = records
    .filter((r) => (SHOWN as readonly string[]).includes(r.tech_setup ?? ""))
    .sort(
      (a, b) =>
        (RANK[a.tech_setup ?? ""] ?? 9) - (RANK[b.tech_setup ?? ""] ?? 9) ||
        isDiagonal(b.tech_note) - isDiagonal(a.tech_note) ||
        Math.abs(a.tech_nearest_dist ?? 99) - Math.abs(b.tech_nearest_dist ?? 99),
    )
    .map((r) => ({
      symbol: r.symbol,
      sector: r.sector,
      price: r.tech_price,
      setup: r.tech_setup,
      nearestLabel: r.tech_nearest_label,
      nearestDistPct: r.tech_nearest_dist,
      targetUpsidePct: r.tech_target_upside,
      note: r.tech_note,
    }));

  const updatedAt = records.reduce<string | null>(
    (max, r) => (r.tech_at && (!max || r.tech_at > max) ? r.tech_at : max),
    null,
  );

  return NextResponse.json({
    ready: true,
    updatedAt,
    universe: records.length,
    counts,
    rows,
  });
}
