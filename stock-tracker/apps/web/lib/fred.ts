// FRED macroeconomic series fetcher.
// Optional — set FRED_API_KEY in env. If unset, all functions return null.
// Free key: https://fred.stlouisfed.org/docs/api/api_key.html

const BASE = "https://api.stlouisfed.org/fred";

export interface SeriesPoint {
  date: string;
  value: number | null;
}

export interface MacroSnapshot {
  tenYearYield: SeriesPoint | null;       // DGS10
  twoYearYield: SeriesPoint | null;       // DGS2
  dxy: SeriesPoint | null;                // DTWEXBGS (broad USD index)
  vix: SeriesPoint | null;                // VIXCLS
  cpi: SeriesPoint | null;                // CPIAUCSL (most-recent monthly)
  unemployment: SeriesPoint | null;       // UNRATE
}

async function latest(seriesId: string, apiKey: string): Promise<SeriesPoint | null> {
  try {
    const url = `${BASE}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const data = (await r.json()) as { observations?: { date: string; value: string }[] };
    const o = data.observations?.[0];
    if (!o) return null;
    const num = o.value === "." ? null : Number(o.value);
    return { date: o.date, value: Number.isFinite(num as number) ? (num as number) : null };
  } catch {
    return null;
  }
}

export function isFredEnabled(): boolean {
  return !!process.env.FRED_API_KEY;
}

export async function getMacroSnapshot(): Promise<MacroSnapshot | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  const [t10, t2, dxy, vix, cpi, ur] = await Promise.all([
    latest("DGS10", key),
    latest("DGS2", key),
    latest("DTWEXBGS", key),
    latest("VIXCLS", key),
    latest("CPIAUCSL", key),
    latest("UNRATE", key),
  ]);
  return {
    tenYearYield: t10,
    twoYearYield: t2,
    dxy,
    vix,
    cpi,
    unemployment: ur,
  };
}
