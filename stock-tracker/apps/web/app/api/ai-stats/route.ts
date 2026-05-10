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
// Plus a confidence-calibration table for BUY: bin verdicts by confidence
// and check whether higher-confidence calls actually win more often. A
// well-calibrated model has ascending win rates across bins; a model where
// 0.85+ confidence wins 50% is overconfident and should be discounted.
//
// Drives the /stats "AI verdict 정확도" section.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Verdict = "buy" | "sell" | "hold";

interface Row {
  verdict: Verdict;
  confidence: number;
  realized_1d: number | null;
  realized_3d: number | null;
  realized_5d: number | null;
  realized_30d: number | null;
}

interface VerdictStats {
  count: number;
  mean1d: number | null;
  mean3d: number | null;
  mean5d: number | null;
  mean30d: number | null;
  /** Directional win rate at 1d horizon — interpretation depends on verdict. */
  winRate1d: number | null;
  /** Sharpe-ish: mean / stddev of realized_1d. Comparable across verdicts only. */
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
      mean1d: null,
      mean3d: null,
      mean5d: null,
      mean30d: null,
      winRate1d: null,
      sharpe1d: null,
    };
  }
  const r1 = rows.map((r) => r.realized_1d).filter((v): v is number => v != null);
  const r3 = rows.map((r) => r.realized_3d).filter((v): v is number => v != null);
  const r5 = rows.map((r) => r.realized_5d).filter((v): v is number => v != null);
  const r30 = rows.map((r) => r.realized_30d).filter((v): v is number => v != null);

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

  const { data, error } = await supabaseAdmin
    .from("ai_analysis")
    .select(
      "verdict, confidence, realized_1d, realized_3d, realized_5d, realized_30d",
    )
    .gte("created_at", since)
    .not("realized_1d", "is", null)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).filter((r): r is Row => {
    const v = (r as Row).verdict;
    return v === "buy" || v === "sell" || v === "hold";
  }) as Row[];

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
  // 4 bins covering the typical confidence range. A well-calibrated AI
  // produces strictly ascending win rates across bins.
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
      .filter((v): v is number => v != null);
    const wins = r1.filter((v) => v > 0).length;
    return {
      confidenceMin: lo,
      confidenceMax: hi,
      count: inBin.length,
      meanReturn1d: mean(r1),
      winRate1d: r1.length ? wins / r1.length : null,
    };
  });

  return NextResponse.json({
    lookbackDays: lookback,
    asOf: new Date().toISOString(),
    totalAnalysesInWindow: totalAnalyses ?? rows.length,
    measuredAnalyses: rows.length,
    byVerdict,
    confidenceCalibrationBuy: calibrationBuy,
  });
}
