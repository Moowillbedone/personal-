// GET /api/ai-stats?lookback=30
//
// Aggregates AI verdict accuracy over a rolling window. For each verdict
// (BUY / SELL / HOLD), computes count, mean realized 1d/3d/5d/30d, and a
// directional win rate:
//
//   BUY  wins when realized > 0
//   SELL wins when realized < 0
//   HOLD wins when |realized| < 1% (price stayed flat as predicted)
//
// Confidence bins are descriptive model-score groups, not probability calibration.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { finiteNumber, firstPerSymbolSession } from "@/lib/performanceAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Verdict = "buy" | "sell" | "hold";

interface Row {
  symbol: string;
  created_at: string;
  verdict: Verdict;
  confidence: number;
  realized_1d: number | null;
  realized_3d: number | null;
  realized_5d: number | null;
  realized_30d: number | null;
}

interface VerdictStats {
  measured1d: number;
  measured3d: number;
  measured5d: number;
  measured30d: number;
  count: number;
  mean1d: number | null;
  mean3d: number | null;
  mean5d: number | null;
  mean30d: number | null;
  /** Directional win rate at 1d horizon — interpretation depends on verdict. */
  winRate1d: number | null;
  /** Descriptive mean/stddev only; not portfolio Sharpe or evidence of edge. */
  sharpe1d: number | null;
}

interface CalibrationBin {
  confidenceMin: number;
  confidenceMax: number;
  count: number;
  meanReturn1d: number | null;
  winRate1d: number | null;
}

function mean(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function isWin(v: number, verdict: Verdict): boolean {
  if (verdict === "buy") return v > 0;
  if (verdict === "sell") return v < 0;
  return Math.abs(v) < 0.01;
}

function computeVerdict(rows: Row[], verdict: Verdict): VerdictStats {
  if (rows.length === 0) {
    return {
      count: 0,
      measured1d: 0, measured3d: 0, measured5d: 0, measured30d: 0,
      mean1d: null,
      mean3d: null,
      mean5d: null,
      mean30d: null,
      winRate1d: null,
      sharpe1d: null,
    };
  }
  const r1 = rows.map((r) => r.realized_1d).filter(finiteNumber);
  const r3 = rows.map((r) => r.realized_3d).filter(finiteNumber);
  const r5 = rows.map((r) => r.realized_5d).filter(finiteNumber);
  const r30 = rows.map((r) => r.realized_30d).filter(finiteNumber);

  const wins = r1.filter((v) => isWin(v, verdict)).length;
  const winRate1d = r1.length ? wins / r1.length : null;

  const m1 = mean(r1);
  let sharpe1d: number | null = null;
  if (m1 != null && r1.length > 1) {
    const variance =
      r1.reduce((a, v) => a + (v - m1) * (v - m1), 0) / (r1.length - 1);
    const sd = Math.sqrt(variance);
    sharpe1d = sd > 0 ? m1 / sd : null;
  }

  return {
    count: rows.length,
    measured1d: r1.length, measured3d: r3.length, measured5d: r5.length, measured30d: r30.length,
    mean1d: m1,
    mean3d: mean(r3),
    mean5d: mean(r5),
    mean30d: mean(r30),
    winRate1d,
    sharpe1d,
  };
}

export async function GET(req: NextRequest) {
  const lookback = Math.max(
    7,
    Math.min(365, Number(req.nextUrl.searchParams.get("lookback") ?? "30") || 30),
  );
  const since = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString();

  const { data, error, count: matchingMeasured } = await supabaseAdmin
    .from("ai_analysis")
    .select(
      "symbol, created_at, verdict, confidence, realized_1d, realized_3d, realized_5d, realized_30d",
      { count: "exact" },
    )
    .gte("created_at", since)
    .not("realized_1d", "is", null)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rawRows = (data ?? []).filter((r): r is Row => {
    const v = (r as Row).verdict;
    return v === "buy" || v === "sell" || v === "hold";
  }) as Row[];

  const rows = firstPerSymbolSession(rawRows, r => r.symbol, r => r.created_at, r => r.verdict);

  // Total verdicts in window (including unmeasured) — surfaces backfill lag.
  const { count: totalAnalyses } = await supabaseAdmin
    .from("ai_analysis")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  const buckets: Record<Verdict, Row[]> = { buy: [], sell: [], hold: [] };
  for (const r of rows) buckets[r.verdict].push(r);

  const byVerdict: Record<Verdict, VerdictStats> = {
    buy: computeVerdict(buckets.buy, "buy"),
    sell: computeVerdict(buckets.sell, "sell"),
    hold: computeVerdict(buckets.hold, "hold"),
  };

  // Confidence calibration for BUY only — the highest-stakes verdict.
  // Group uncalibrated model scores. Small or correlated samples cannot
  // establish calibration, even when the observed rates are monotonic.
  const binBounds: Array<[number, number]> = [
    [0, 0.5],
    [0.5, 0.7],
    [0.7, 0.85],
    [0.85, 1.01],
  ];
  const calibrationBuy: CalibrationBin[] = binBounds.map(([lo, hi]) => {
    const inBin = buckets.buy.filter(
      (r) => r.confidence >= lo && r.confidence < hi,
    );
    const r1 = inBin
      .map((r) => r.realized_1d)
      .filter(finiteNumber);
    const wins = r1.filter((v) => v > 0).length;
    return {
      confidenceMin: lo,
      confidenceMax: hi,
      count: inBin.length,
      meanReturn1d: mean(r1),
      winRate1d: r1.length ? wins / r1.length : null,
    };
  });

  return NextResponse.json(
    {
      lookbackDays: lookback,
      asOf: new Date().toISOString(),
      totalAnalysesInWindow: totalAnalyses ?? rows.length,
      measuredAnalyses: rows.length,
      rawMeasuredAnalyses: rawRows.length,
      matchingMeasuredAnalyses: matchingMeasured,
      aggregationTruncated: matchingMeasured != null && matchingMeasured > (data ?? []).length,
      repeatedObservationsRemoved: rawRows.length - rows.length,
      methodology: "Descriptive price direction by verdict; first observation per symbol / NY date / verdict. Confidence is an uncalibrated model score, not a probability. HOLD within 1% is only a descriptive band. Outcomes overlap; no predictive edge is established.",
      byVerdict,
      confidenceCalibrationBuy: calibrationBuy,
    },
    {
      // CDN-cache this aggregate for 30 min (Vercel edge honors s-maxage even
      // with dynamic="force-dynamic" once we set the header explicitly). This
      // is the #1 Supabase-egress reduction: ai-stats pulls up to 10k
      // ai_analysis rows, and /stats refetches it on every open + lookback
      // toggle. The numbers (AI verdict accuracy over a rolling 30d window)
      // don't change minute-to-minute, so a 30-min stale window is invisible
      // to the user. CRITICAL: this endpoint depends ONLY on ai_analysis +
      // worker-measured returns — NOT on the user's trade_log — so caching it
      // has zero effect on how fast a new buy/sell or bulk-backfill shows up
      // (those drive /api/trades/positions + /api/rec-performance, both left
      // uncached). stale-while-revalidate serves the old copy instantly while
      // refreshing in the background after expiry.
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
