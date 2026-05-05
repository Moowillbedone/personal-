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
  expected_1d: number | null;
  expected_3d: number | null;
  expected_5d: number | null;
  sample_size: number | null;
}

export interface OwnSignalSummary {
  total: number;
  byType: Record<string, number>;
  recent: OwnSignal[]; // up to 10 most-recent
  // Average expected returns across all signals on this symbol in window
  meanExpected1d: number | null;
  meanExpected3d: number | null;
  meanExpected5d: number | null;
}

export async function getOwnSignalsFor(symbol: string, days = 30): Promise<OwnSignalSummary> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  try {
    const { data, error } = await supabaseAdmin
      .from("signals")
      .select("ts, signal_type, pct_change, volume_ratio, session, expected_1d, expected_3d, expected_5d, sample_size")
      .eq("symbol", symbol.toUpperCase())
      .gte("ts", since)
      .order("ts", { ascending: false })
      .limit(50);
    if (error || !data) {
      return { total: 0, byType: {}, recent: [], meanExpected1d: null, meanExpected3d: null, meanExpected5d: null };
    }
    const rows = data as OwnSignal[];
    const byType: Record<string, number> = {};
    for (const r of rows) byType[r.signal_type] = (byType[r.signal_type] ?? 0) + 1;
    const mean = (key: keyof OwnSignal): number | null => {
      const vals = rows.map((r) => r[key] as number | null).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      total: rows.length,
      byType,
      recent: rows.slice(0, 10),
      meanExpected1d: mean("expected_1d"),
      meanExpected3d: mean("expected_3d"),
      meanExpected5d: mean("expected_5d"),
    };
  } catch {
    return { total: 0, byType: {}, recent: [], meanExpected1d: null, meanExpected3d: null, meanExpected5d: null };
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
