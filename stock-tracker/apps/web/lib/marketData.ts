// Session-aware orchestrator for snapshots and intraday bars.
//
// During regular hours we use Alpaca IEX directly — it's real-time and the
// existing pipeline. During pre-market / after-hours / closed we layer
// Yahoo's v8 chart on top to get extended-hours prices and 5-min bars,
// because IEX has almost no extended-hours volume and reports the regular
// session close as "latest trade" (which makes Gemini analyze stale data).
//
// Yahoo is fail-soft: if it returns null (rate-limited, blocked, slow),
// we transparently fall back to IEX. Caching is shared via yahoo.ts so a
// single fetch serves both /api/analyze and /api/snapshot.

import {
  getSnapshot as getIexSnapshot,
  getRecentBars as getIexRecentBars,
  currentMarketSession,
  type Snapshot,
  type RecentBars,
  type Bar,
} from "./alpaca";
import { getYahooChartCached, type YahooChartResult } from "./yahoo";

function augmentWithYahoo(iex: Snapshot, yahoo: YahooChartResult | null): Snapshot {
  if (!yahoo || yahoo.lastPrice == null) return iex;
  // Prefer IEX's prevClose (it's the official prior daily bar). Fall back
  // to Yahoo's only if IEX didn't return one.
  const prevClose = iex.prevClose ?? yahoo.prevClose;
  const changePct =
    prevClose != null && prevClose !== 0
      ? (yahoo.lastPrice - prevClose) / prevClose
      : null;
  return {
    ...iex,
    lastPrice: yahoo.lastPrice,
    lastTradeTs: yahoo.lastTradeTs ?? iex.lastTradeTs,
    prevClose,
    changePct,
    priceSource: "yahoo",
  };
}

/**
 * Snapshot for the analyzed (primary) symbol — uses 5d range so the same
 * Yahoo response can populate getPrimaryRecentBars's 5-min bars.
 */
export async function getPrimarySnapshot(symbol: string): Promise<Snapshot> {
  const iex = await getIexSnapshot(symbol);
  if (iex.session === "regular") return iex;
  const yahoo = await getYahooChartCached(symbol, {
    interval: "5m",
    range: "5d",
    includePrePost: true,
  });
  return augmentWithYahoo(iex, yahoo);
}

/**
 * Recent bars with extended-hours awareness. Daily bars stay IEX (used for
 * SMA/RSI/52w — closing prices from IEX are essentially the consolidated
 * close because all exchanges align at the closing auction). 5-min bars
 * switch to Yahoo (with includePrePost) outside regular hours so Gemini
 * sees the actual pre/after price action.
 */
export async function getPrimaryRecentBars(symbol: string): Promise<RecentBars> {
  const session = currentMarketSession();
  const iexPromise = getIexRecentBars(symbol);

  if (session === "regular") {
    return iexPromise;
  }

  const [iex, yahoo] = await Promise.all([
    iexPromise,
    getYahooChartCached(symbol, {
      interval: "5m",
      range: "5d",
      includePrePost: true,
    }),
  ]);
  if (!yahoo || yahoo.bars.length === 0) {
    return iex;
  }

  const fiveMin: Bar[] = yahoo.bars.map((b) => ({
    ts: b.ts,
    o: b.o,
    h: b.h,
    l: b.l,
    c: b.c,
    v: b.v,
  }));

  return { fiveMin, daily: iex.daily };
}

/**
 * Lightweight snapshot for the watchlist batch — same Yahoo augmentation
 * but with range=1d so the per-symbol payload stays small (~10KB) when
 * refreshing 20+ tickers at once.
 */
export async function getLatestPriceSnapshot(symbol: string): Promise<Snapshot> {
  const iex = await getIexSnapshot(symbol);
  if (iex.session === "regular") return iex;
  const yahoo = await getYahooChartCached(symbol, {
    interval: "5m",
    range: "1d",
    includePrePost: true,
  });
  return augmentWithYahoo(iex, yahoo);
}
