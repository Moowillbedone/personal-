// GET /api/pullback-scan
//
// Dashboard 눌림목 스캐너 — of the NASDAQ-100 + NYSE-100 universe, which names are
// (15분봉) 🟢 pullback (buyable) or 🟡 forming (watch/confirm)? The classification
// is recomputed every ~15 min during the US session by worker/pullback_intraday.py
// into public.sma200, so this route is a PURE table read — no per-request bar/
// snapshot fetch. Everything (price + 되돌림 + the 5-criterion verdict) is as-of the
// same moment (pullback_at) so the row is internally consistent — no live price
// overlaid on a stale verdict. Live/real-time is the Trade tab (/api/pullback).

import { NextResponse } from "next/server";
import { currentMarketSession } from "@/lib/alpaca";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PbClass = "pullback" | "forming" | "downtrend" | "no_uptrend";

interface Rec {
  symbol: string;
  sector: string | null;
  pullback_class: PbClass | null;
  pullback_retrace: number | null;
  pullback_grades: string | null;
  pullback_price: number | null; // price the verdict was computed on (15m close)
  pullback_at: string | null; // when the 15m classification was computed
}

interface Row {
  symbol: string;
  sector: string | null;
  price: number | null; // as-of pullback_at (NOT live)
  retrace: number | null; // percent
  grades: string | null;
}

function passCount(grades: string | null): number {
  if (!grades) return 0;
  return grades.split(",").filter((g) => g === "pass").length;
}

const NOT_READY = (session: string) =>
  NextResponse.json({
    session,
    ready: false,
    updatedAt: null,
    counts: { pullback: 0, forming: 0, downtrend: 0, no_uptrend: 0 },
    pullback: [],
    forming: [],
  });

export async function GET() {
  const session = currentMarketSession();

  const { data, error } = await supabase
    .from("sma200")
    .select(
      "symbol, sector, pullback_class, pullback_retrace, pullback_grades, pullback_price, pullback_at"
    );

  if (error) {
    // migration 015~017 (pullback columns) or the table not there yet → placeholder.
    const msg = (error.message || "").toLowerCase();
    if (
      error.code === "42703" ||
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      msg.includes("pullback") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist")
    ) {
      return NOT_READY(session);
    }
    return NextResponse.json(
      { error: `pullback-scan read failed: ${error.message}` },
      { status: 500 }
    );
  }

  const records = ((data ?? []) as Rec[]).filter((r) => r.pullback_class != null);
  if (records.length === 0) return NOT_READY(session);

  const counts = { pullback: 0, forming: 0, downtrend: 0, no_uptrend: 0 };
  for (const r of records) {
    if (r.pullback_class && r.pullback_class in counts) counts[r.pullback_class]++;
  }

  const toRow = (r: Rec): Row => ({
    symbol: r.symbol,
    sector: r.sector,
    price: r.pullback_price ?? null,
    retrace: r.pullback_retrace != null ? Number((r.pullback_retrace * 100).toFixed(0)) : null,
    grades: r.pullback_grades,
  });

  // Strongest first: more pass grades, then shallower retrace.
  const rank = (a: Rec, b: Rec) =>
    passCount(b.pullback_grades) - passCount(a.pullback_grades) ||
    (a.pullback_retrace ?? 1) - (b.pullback_retrace ?? 1);

  const buyish = records.filter(
    (r) => r.pullback_class === "pullback" || r.pullback_class === "forming"
  );
  const pullback = buyish.filter((r) => r.pullback_class === "pullback").sort(rank).map(toRow);
  const forming = buyish.filter((r) => r.pullback_class === "forming").sort(rank).map(toRow);

  const updatedAt = records.reduce<string | null>(
    (max, r) => (r.pullback_at && (!max || r.pullback_at > max) ? r.pullback_at : max),
    null
  );

  return NextResponse.json({
    session,
    ready: true,
    updatedAt,
    universe: records.length,
    counts,
    pullback,
    forming,
  });
}
