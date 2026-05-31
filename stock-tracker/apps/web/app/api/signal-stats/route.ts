// GET /api/signal-stats?lookback=30
//
// Aggregates the user's own signal-tracker performance over a rolling window.
// Pulls every signal from the last N days where realized_1d is populated
// (i.e. signal is at least 7 calendar days old and the realize.py worker
// has filled in the actual forward returns) and computes:
//
//   - overall: count, win rate, mean/median realized 1d, sharpe, mean 3d/5d
//   - byType: same metrics grouped by signal_type (gap_up/gap_down/volume_spike)
//   - byTypeAndSession: nested breakdown by (type, session)
//
// This is the "is my system actually finding edge?" measurement endpoint.
// Without it, we have no way to tell whether gap_up signals make money or
// just generate noise.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  signal_type: "gap_up" | "gap_down" | "volume_spike";
  session: "pre" | "regular" | "after";
  realized_1d: number | null;
  realized_3d: number | null;
  realized_5d: number | null;
  recent_news_count: number | null;
}

interface Stats {
  count: number;
  winRate1d: number | null; // fraction of signals with realized_1d > 0
  mean1d: number | null;
  median1d: number | null;
  mean3d: number | null;
  mean5d: number | null;
  /** Mean / stddev of realized_1d. NOT annualized — comparable across signal types only. */
  sharpe1d: number | null;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}

function compute(rows: Row[]): Stats {
  if (rows.length === 0) {
    return {
      count: 0,
      winRate1d: null,
      mean1d: null,
      median1d: null,
      mean3d: null,
      mean5d: null,
      sharpe1d: null,
    };
  }
  const r1 = rows.map((r) => r.realized_1d).filter((v): v is number => v != null);
  const r3 = rows.map((r) => r.realized_3d).filter((v): v is number => v != null);
  const r5 = rows.map((r) => r.realized_5d).filter((v): v is number => v != null);

  const mean = (arr: number[]): number | null =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const wins = r1.filter((v) => v > 0).length;
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
    winRate1d,
    mean1d: m1,
    median1d: median([...r1].sort((a, b) => a - b)),
    mean3d: mean(r3),
    mean5d: mean(r5),
    sharpe1d,
  };
}

export async function GET(req: NextRequest) {
  const lookback = Math.max(
    7,
    Math.min(365, Number(req.nextUrl.searchParams.get("lookback") ?? "30") || 30),
  );
  const since = new Date(Date.now() - lookback * 24 * 3600 * 1000).toISOString();

  // Pull only what we need; partial index on (signal_type, session, ts desc)
  // where realized_1d not null makes this fast even with months of data.
  const { data, error } = await supabaseAdmin
    .from("signals")
    .select(
      "signal_type, session, realized_1d, realized_3d, realized_5d, recent_news_count",
    )
    .gte("ts", since)
    .not("realized_1d", "is", null)
    .order("ts", { ascending: false })
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];

  // Total signal volume in the window (including ones not yet measured) so
  // the UI can show "X of Y signals measured" — surfaces backfill lag.
  const { count: totalRecent } = await supabaseAdmin
    .from("signals")
    .select("id", { count: "exact", head: true })
    .gte("ts", since);

  const byType: Record<string, Stats> = {};
  const byTypeAndSession: Record<string, Record<string, Stats>> = {};
  // News-correlation comparison: for each signal type, split rows by
  // whether news fired in the surrounding window. Only includes rows where
  // recent_news_count is not null (signals that pre-date the news enrichment
  // feature have null and are excluded — apples-to-apples comparison).
  const byTypeAndNews: Record<string, { withNews: Stats; noNews: Stats }> = {};

  const typeBuckets: Record<string, Row[]> = {};
  for (const r of rows) {
    typeBuckets[r.signal_type] = typeBuckets[r.signal_type] ?? [];
    typeBuckets[r.signal_type].push(r);
  }
  for (const [type, bucket] of Object.entries(typeBuckets)) {
    byType[type] = compute(bucket);
    byTypeAndSession[type] = {};
    const sessBuckets: Record<string, Row[]> = {};
    for (const r of bucket) {
      sessBuckets[r.session] = sessBuckets[r.session] ?? [];
      sessBuckets[r.session].push(r);
    }
    for (const [sess, sBucket] of Object.entries(sessBuckets)) {
      byTypeAndSession[type][sess] = compute(sBucket);
    }
    const withNews = bucket.filter(
      (r) => r.recent_news_count != null && r.recent_news_count > 0,
    );
    const noNews = bucket.filter(
      (r) => r.recent_news_count != null && r.recent_news_count === 0,
    );
    byTypeAndNews[type] = {
      withNews: compute(withNews),
      noNews: compute(noNews),
    };
  }

  // News-enrichment coverage diagnostic — surfaces "how much of the data
  // has been enriched yet" so the UI can warn before the comparison is
  // statistically meaningful.
  const enrichedCount = rows.filter((r) => r.recent_news_count != null).length;

  return NextResponse.json(
    {
      lookbackDays: lookback,
      asOf: new Date().toISOString(),
      totalSignalsInWindow: totalRecent ?? rows.length,
      measuredSignals: rows.length,
      newsEnrichedSignals: enrichedCount,
      overall: compute(rows),
      byType,
      byTypeAndSession,
      byTypeAndNews,
    },
    {
      // CDN-cache for 30 min — same rationale as /api/ai-stats. This endpoint
      // pulls up to 10k `signals` rows (the table grows continuously from
      // poll.py) and /stats refetches on every open + lookback toggle, making
      // it a top egress source. It aggregates ONLY the signals table (worker-
      // measured forward returns) — independent of the user's trade_log — so a
      // 30-min stale window never delays a trade or bulk-backfill from showing.
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=600",
      },
    },
  );
}
