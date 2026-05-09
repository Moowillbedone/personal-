// Yahoo Finance v8 chart endpoint — used as a fallback during pre-market,
// after-hours, and closed sessions where Alpaca's free IEX feed has almost
// no extended-hours volume and returns the regular session close as
// "latestTrade", making prices look stale.
//
// Why v8/finance/chart instead of v7/finance/quote: v7 requires a cookie+crumb
// dance since 2023 (yfinance's complexity). v8 chart is unauthenticated and
// returns both the latest extended-hours bars and current price in one call.
//
// Yahoo aggressively rate-limits unfamiliar IPs (Vercel datacenter ranges
// included). Every call is fail-soft — caller falls back to IEX.

const YAHOO_BASE = "https://query1.finance.yahoo.com";

// Mimic a real browser. Yahoo blocks default fetch user-agents.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export interface YahooBar {
  ts: string; // ISO 8601
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface YahooChartResult {
  symbol: string;
  /** Most recent traded price across pre/regular/post (last non-null bar close). */
  lastPrice: number | null;
  lastTradeTs: string | null;
  /** Prior trading day's regular session close. */
  prevClose: number | null;
  /** All intraday bars in the requested range — already filtered for nulls. */
  bars: YahooBar[];
}

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
    error?: { description: string } | null;
  };
}

export interface ChartOptions {
  interval: string; // '1m' | '5m' | '15m' | '1h' | '1d'
  range: string; // '1d' | '5d' | '1mo' | '3mo' | '1y'
  includePrePost: boolean;
}

const DEFAULT_OPTS: ChartOptions = {
  interval: "5m",
  range: "5d",
  includePrePost: true,
};

// In-process cache shared across both /api/analyze and /api/snapshot so a
// single Yahoo fetch covers concurrent callers within the same Vercel
// invocation. Keyed by symbol + chart shape because callers ask for
// different ranges (analyze uses 5d, snapshot uses 1d).
const chartCache = new Map<string, Promise<YahooChartResult | null>>();
const CHART_CACHE_TTL_MS = 30_000;

export function getYahooChartCached(
  symbol: string,
  opts: Partial<ChartOptions> = {},
): Promise<YahooChartResult | null> {
  const o = { ...DEFAULT_OPTS, ...opts };
  const key = `${symbol.toUpperCase()}|${o.interval}|${o.range}|${o.includePrePost}`;
  const existing = chartCache.get(key);
  if (existing) return existing;
  const p = getYahooChart(symbol, o);
  chartCache.set(key, p);
  setTimeout(() => chartCache.delete(key), CHART_CACHE_TTL_MS);
  return p;
}

export async function getYahooChart(
  symbol: string,
  opts: Partial<ChartOptions> = {},
): Promise<YahooChartResult | null> {
  const o = { ...DEFAULT_OPTS, ...opts };
  try {
    const params = new URLSearchParams({
      interval: o.interval,
      range: o.range,
      includePrePost: String(o.includePrePost),
    });
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(
      symbol.toUpperCase(),
    )}?${params}`;
    const r = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as YahooChartResponse;
    if (data.chart.error) return null;
    const result = data.chart.result?.[0];
    if (!result) return null;

    const meta = result.meta ?? {};
    const ts = result.timestamp ?? [];
    const q = result.indicators.quote?.[0];
    if (!q) {
      return {
        symbol: symbol.toUpperCase(),
        lastPrice: meta.regularMarketPrice ?? null,
        lastTradeTs: meta.regularMarketTime
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : null,
        prevClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
        bars: [],
      };
    }

    const bars: YahooBar[] = [];
    let lastValidClose: number | null = null;
    let lastValidTs: string | null = null;

    for (let i = 0; i < ts.length; i++) {
      const oP = q.open[i];
      const hP = q.high[i];
      const lP = q.low[i];
      const cP = q.close[i];
      const vP = q.volume[i];
      // Yahoo emits null bars for non-trading minutes within range — skip them.
      if (oP == null || hP == null || lP == null || cP == null) continue;
      const iso = new Date(ts[i] * 1000).toISOString();
      bars.push({ ts: iso, o: oP, h: hP, l: lP, c: cP, v: vP ?? 0 });
      lastValidClose = cP;
      lastValidTs = iso;
    }

    return {
      symbol: symbol.toUpperCase(),
      lastPrice: lastValidClose ?? meta.regularMarketPrice ?? null,
      lastTradeTs: lastValidTs,
      prevClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
      bars,
    };
  } catch {
    return null;
  }
}
