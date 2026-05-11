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

export type AnalystAction = "up" | "down" | "main" | "init";

export interface AnalystAction_Item {
  /** ISO date the rating was published. */
  date: string;
  /** Issuing firm — "Goldman Sachs", "Morgan Stanley", etc. */
  firm: string;
  /** "up" = upgrade, "down" = downgrade, "main" = reiterate, "init" = initiate. */
  action: AnalystAction;
  /** Rating before the change (empty for "init"). */
  fromGrade: string;
  /** Rating after — "Buy", "Strong Buy", "Hold", "Sell", etc. */
  toGrade: string;
}

export interface StockMetrics {
  /** Total market cap in USD (Finnhub returns millions; we normalize). */
  marketCap: number | null;
  sharesOutstanding: number | null;
  /** Free-float shares — non-restricted, available to public. */
  floatShares: number | null;
  /** Total shares sold short (latest reported, biweekly cadence). */
  shortInterest: number | null;
  /** 0..1 fraction. e.g. 0.18 = 18% of float is short. */
  shortPercentOfFloat: number | null;
  /** Days to cover = shares short / avg daily volume. */
  daysToCover: number | null;
}

export interface FinnhubBundle {
  consensus: AnalystConsensus | null;
  priceTarget: PriceTarget | null;
  recentSurprises: EarningsSurprise[];
  nextEarnings: NextEarnings | null;
  metrics: StockMetrics | null;
  /** Last ~30d of analyst rating actions (upgrades / downgrades / inits). */
  ratingActions: AnalystAction_Item[];
}

export function isFinnhubEnabled(): boolean {
  return !!process.env.FINNHUB_API_KEY;
}

// ─── /stock/quote (latest price, extended-hours aware) ─────────────────────
//
// Yahoo's v8 chart endpoint blocks Vercel data-center IPs aggressively
// during pre/after sessions, leaving the watchlist with stale-marked IEX
// closes. Finnhub's /quote returns a real-time `c` field that includes
// extended-hours trades for most US listings on the free tier — same
// usability without the rate-limit dance.

export interface FinnhubQuote {
  /** Current price (includes pre/post-market for supported US listings). */
  c: number;
  /** Today's high. */
  h: number;
  /** Today's low. */
  l: number;
  /** Today's open. */
  o: number;
  /** Previous close. */
  pc: number;
  /** Last update timestamp (Unix seconds). */
  t: number;
}

const quoteCache = new Map<string, { data: FinnhubQuote; ts: number }>();
const QUOTE_CACHE_TTL_MS = 30_000;

/**
 * Latest-price snapshot for a symbol. Cached for 30s in-process to keep
 * back-to-back watchlist refreshes well under Finnhub's 60-req/min free
 * limit. Returns null when the API key is unset, the request fails, or
 * the price comes back as 0 (Finnhub returns zeros for tickers that
 * aren't covered, e.g. some thin OTC names).
 */
export async function getFinnhubQuote(
  symbol: string,
): Promise<FinnhubQuote | null> {
  if (!isFinnhubEnabled()) return null;
  const key = symbol.toUpperCase();
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.ts < QUOTE_CACHE_TTL_MS) return hit.data;

  const data = await get<FinnhubQuote>(`/quote?symbol=${key}`);
  if (!data || typeof data.c !== "number" || data.c <= 0) return null;
  quoteCache.set(key, { data, ts: Date.now() });
  return data;
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

  // Finnhub `metric=all` returns ~100 fields; we only pull what we need.
  // Numbers come in millions of shares / millions of USD for share-related
  // fields, except shortInterest which is in absolute share count and the
  // ratio fields (already 0..1 or days). Documentation is sparse — these
  // mappings were verified against live AAPL / NVDA / TSLA responses.
  type MetricRaw = {
    metric?: {
      marketCapitalization?: number;
      shareOutstanding?: number;
      shareFloat?: number;
      shortInterest?: number;
      shortPercentOfFloat?: number;
      shortRatio?: number;
    };
  };

  // Lookback window for rating changes. 30d is short enough to capture
  // the "fresh upgrade momentum" effect (typically lives ~5 days post-
  // event) while giving enough sample size on dormant tickers.
  const RATING_LOOKBACK_DAYS = 30;

  const [recRaw, ptRaw, surpRaw, calRaw, metRaw, ratingsRaw] = await Promise.all([
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
    get<MetricRaw>(`/stock/metric?symbol=${sym}&metric=all`),
    (async () => {
      const today = new Date();
      const past = new Date(
        today.getTime() - RATING_LOOKBACK_DAYS * 24 * 3600 * 1000,
      );
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      return get<
        Array<{
          symbol: string;
          gradeTime: number;          // unix seconds
          fromGrade: string;
          toGrade: string;
          company: string;            // issuing firm
          action: AnalystAction;
        }>
      >(`/stock/upgrade-downgrade?symbol=${sym}&from=${fmt(past)}&to=${fmt(today)}`);
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

  // Stock metrics — float / shares / short interest. Free tier returns
  // most of these; shortInterest may be null on certain tickers (penny
  // stocks, ADRs) and we surface that gracefully as "not reported."
  let metrics: StockMetrics | null = null;
  if (metRaw?.metric) {
    const m = metRaw.metric;
    const m1 = (v: number | undefined) => (v != null ? v * 1_000_000 : null);
    metrics = {
      marketCap: m1(m.marketCapitalization),
      sharesOutstanding: m1(m.shareOutstanding),
      floatShares: m1(m.shareFloat),
      shortInterest: m.shortInterest ?? null,
      // Finnhub returns shortPercentOfFloat as a percent (e.g. 18.4),
      // we normalize to fraction (0.184) for consistency with our
      // other percent fields.
      shortPercentOfFloat:
        m.shortPercentOfFloat != null ? m.shortPercentOfFloat / 100 : null,
      daysToCover: m.shortRatio ?? null,
    };
  }

  // Rating actions: normalize timestamps to ISO date and sort recent-first.
  // Finnhub may return an empty array for low-coverage names (no error,
  // just []). We surface that as an empty list and the prompt skips the
  // section gracefully.
  const ratingActions: AnalystAction_Item[] = (ratingsRaw ?? [])
    .map((r) => ({
      date: new Date(r.gradeTime * 1000).toISOString().slice(0, 10),
      firm: r.company || "?",
      action: r.action,
      fromGrade: r.fromGrade || "",
      toGrade: r.toGrade || "",
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    consensus,
    priceTarget,
    recentSurprises,
    nextEarnings,
    metrics,
    ratingActions,
  };
}
