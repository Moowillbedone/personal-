// Reads context from our own Supabase (signals + watchlist) — never writes.
// Cross-references the user's existing signal tracker so the analyzer can
// cite "your tracker fired N gap_up signals on this name in the last 30d".

import { supabaseAdmin } from "./supabaseAdmin";

export interface OwnSignal {
  ts: string;
  signal_type: "gap_up" | "gap_down" | "volume_spike";
  pct_change: number;
  volume_ratio: number;
  session: "pre" | "regular" | "after";
  // Priors: average forward return of historically similar signals (predictive)
  expected_1d: number | null;
  expected_3d: number | null;
  expected_5d: number | null;
  sample_size: number | null;
  // Measurements: actual forward returns of THIS signal (only filled once
  // signal is ≥7 calendar days old and realize.py has run)
  realized_1d: number | null;
  realized_3d: number | null;
  realized_5d: number | null;
}

export interface OwnSignalSummary {
  total: number;
  byType: Record<string, number>;
  recent: OwnSignal[]; // up to 10 most-recent
  // Average expected (prior) returns across all signals on this symbol in window
  meanExpected1d: number | null;
  meanExpected3d: number | null;
  meanExpected5d: number | null;
  // Average REALIZED (actual) returns + win rate. Only computed over signals
  // old enough to have realized data (so n may be smaller than `total`).
  meanRealized1d: number | null;
  meanRealized3d: number | null;
  meanRealized5d: number | null;
  realizedSampleSize: number; // count of signals with realized_1d not null
  winRate1d: number | null; // fraction of realized signals with 1d > 0
}

export async function getOwnSignalsFor(symbol: string, days = 30): Promise<OwnSignalSummary> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const empty: OwnSignalSummary = {
    total: 0,
    byType: {},
    recent: [],
    meanExpected1d: null,
    meanExpected3d: null,
    meanExpected5d: null,
    meanRealized1d: null,
    meanRealized3d: null,
    meanRealized5d: null,
    realizedSampleSize: 0,
    winRate1d: null,
  };
  try {
    const { data, error } = await supabaseAdmin
      .from("signals")
      .select(
        "ts, signal_type, pct_change, volume_ratio, session, expected_1d, expected_3d, expected_5d, sample_size, realized_1d, realized_3d, realized_5d",
      )
      .eq("symbol", symbol.toUpperCase())
      .gte("ts", since)
      .order("ts", { ascending: false })
      .limit(50);
    if (error || !data) return empty;
    const rows = data as OwnSignal[];
    const byType: Record<string, number> = {};
    for (const r of rows) byType[r.signal_type] = (byType[r.signal_type] ?? 0) + 1;
    const mean = (key: keyof OwnSignal): number | null => {
      const vals = rows.map((r) => r[key] as number | null).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const realizedRows = rows.filter((r) => r.realized_1d != null);
    const wins = realizedRows.filter((r) => (r.realized_1d ?? 0) > 0).length;
    const winRate1d = realizedRows.length ? wins / realizedRows.length : null;
    return {
      total: rows.length,
      byType,
      recent: rows.slice(0, 10),
      meanExpected1d: mean("expected_1d"),
      meanExpected3d: mean("expected_3d"),
      meanExpected5d: mean("expected_5d"),
      meanRealized1d: mean("realized_1d"),
      meanRealized3d: mean("realized_3d"),
      meanRealized5d: mean("realized_5d"),
      realizedSampleSize: realizedRows.length,
      winRate1d,
    };
  } catch {
    return empty;
  }
}

export interface WatchlistContextItem {
  symbol: string;
  changePct: number | null;
}

/** Loads the user's current watchlist symbols (without prices). */
export async function getWatchlistSymbols(): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin.from("watchlist").select("symbol");
    return ((data ?? []) as { symbol: string }[]).map((r) => r.symbol);
  } catch {
    return [];
  }
}
