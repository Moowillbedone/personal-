// Finnhub fetcher — analyst consensus + earnings calendar + earnings surprises.
// Optional — set FINNHUB_API_KEY in env. If unset, all functions return null.
// Free key: https://finnhub.io/register (60 calls/min)

const BASE = "https://finnhub.io/api/v1";

export interface AnalystConsensus {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;     // "YYYY-MM"
}

export interface PriceTarget {
  targetMean: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  numberOfAnalysts: number | null;
  lastUpdated: string | null;
}

export interface EarningsSurprise {
  period: string;
  actual: number | null;
  estimate: number | null;
  surprisePct: number | null;
}

export interface NextEarnings {
  date: string;       // YYYY-MM-DD
  hour: string;       // 'bmo' | 'amc' | ''
  estimate: number | null;
  daysUntil: number;
}

export interface FinnhubBundle {
  consensus: AnalystConsensus | null;
  priceTarget: PriceTarget | null;
  recentSurprises: EarningsSurprise[];
  nextEarnings: NextEarnings | null;
}

export function isFinnhubEnabled(): boolean {
  return !!process.env.FINNHUB_API_KEY;
}

async function get<T>(path: string): Promise<T | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${BASE}${path}${sep}token=${key}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function getFinnhubBundle(symbol: string): Promise<FinnhubBundle | null> {
  if (!isFinnhubEnabled()) return null;
  const sym = symbol.toUpperCase();

  const [recRaw, ptRaw, surpRaw, calRaw] = await Promise.all([
    get<Array<{ buy: number; hold: number; sell: number; strongBuy: number; strongSell: number; period: string }>>(
      `/stock/recommendation?symbol=${sym}`,
    ),
    get<{ targetMean?: number; targetHigh?: number; targetLow?: number; numberOfAnalysts?: number; lastUpdated?: string }>(
      `/stock/price-target?symbol=${sym}`,
    ),
    get<Array<{ period: string; actual: number; estimate: number; surprisePercent: number }>>(
      `/stock/earnings?symbol=${sym}&limit=4`,
    ),
    (async () => {
      const today = new Date();
      const future = new Date(today.getTime() + 90 * 24 * 3600 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      return get<{ earningsCalendar?: Array<{ symbol: string; date: string; hour: string; epsEstimate: number | null }> }>(
        `/calendar/earnings?from=${fmt(today)}&to=${fmt(future)}&symbol=${sym}`,
      );
    })(),
  ]);

  const consensus: AnalystConsensus | null = recRaw && recRaw.length
    ? {
        buy: recRaw[0].buy,
        hold: recRaw[0].hold,
        sell: recRaw[0].sell,
        strongBuy: recRaw[0].strongBuy,
        strongSell: recRaw[0].strongSell,
        period: recRaw[0].period,
      }
    : null;

  const priceTarget: PriceTarget | null = ptRaw
    ? {
        targetMean: ptRaw.targetMean ?? null,
        targetHigh: ptRaw.targetHigh ?? null,
        targetLow: ptRaw.targetLow ?? null,
        numberOfAnalysts: ptRaw.numberOfAnalysts ?? null,
        lastUpdated: ptRaw.lastUpdated ?? null,
      }
    : null;

  const recentSurprises: EarningsSurprise[] = (surpRaw ?? []).map((s) => ({
    period: s.period,
    actual: s.actual ?? null,
    estimate: s.estimate ?? null,
    surprisePct: s.surprisePercent ?? null,
  }));

  let nextEarnings: NextEarnings | null = null;
  const cal = calRaw?.earningsCalendar?.find((c) => c.symbol.toUpperCase() === sym);
  if (cal) {
    const d = new Date(cal.date);
    const days = Math.round((d.getTime() - Date.now()) / (24 * 3600 * 1000));
    nextEarnings = {
      date: cal.date,
      hour: cal.hour ?? "",
      estimate: cal.epsEstimate ?? null,
      daysUntil: days,
    };
  }

  return { consensus, priceTarget, recentSurprises, nextEarnings };
}
