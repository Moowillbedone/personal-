// Session-aware orchestrator for snapshots and intraday bars.
//
// During regular hours we use Alpaca IEX directly — it's real-time and the
// existing pipeline. During pre-market / after-hours / closed we need a
// different source because IEX has almost no extended-hours volume and
// reports the regular session close as "latest trade".
//
// Extended-hours price fallback chain (in order of attempt):
//   1. Finnhub /quote   — primary. Reliable from Vercel data-center IPs,
//                         covers extended hours, 60 req/min free tier.
//   2. Yahoo v8 chart   — secondary. Often blocked by Yahoo for data-center
//                         IPs but cheap to try when not blocked.
//   3. IEX (Alpaca)     — final. Last-trade snapshot (stale during pre/after).
//
// The price-source choice flows through to `Snapshot.priceSource` so the
// trade page stale badge only fires when we genuinely fell all the way
// through to IEX during a non-regular session.
//
// Intraday 5-min bars (for the analyze prompt) still use Yahoo because
// Finnhub's free tier doesn't expose intraday bars. If Yahoo's chart
// endpoint is blocked, those bars degrade to IEX (which has near-zero
// pre/after volume) — same as before this change.

import {
  getSnapshot as getIexSnapshot,
  getRecentBars as getIexRecentBars,
  currentMarketSession,
  type Snapshot,
  type RecentBars,
  type Bar,
} from "./alpaca";
import { getYahooChartCached } from "./yahoo";
import { getFinnhubQuote } from "./finnhub";

/**
 * Merge an extended-hours price into the IEX baseline snapshot. Tries
 * Finnhub first (most reliable from Vercel), then Yahoo (fast when not
 * blocked). Falls through to IEX if both are unavailable — caller's
 * stale-badge logic will surface that condition to the user.
 */
async function augmentExtendedHours(iex: Snapshot): Promise<Snapshot> {
  // 1) Finnhub /quote — primary.
  const fq = await getFinnhubQuote(iex.symbol);
  if (fq && fq.c > 0) {
    const prevClose = iex.prevClose ?? (fq.pc > 0 ? fq.pc : null);
    const changePct =
      prevClose != null && prevClose !== 0 ? (fq.c - prevClose) / prevClose : null;
    return {
      ...iex,
      lastPrice: fq.c,
      lastTradeTs:
        fq.t > 0 ? new Date(fq.t * 1000).toISOString() : iex.lastTradeTs,
      prevClose,
      changePct,
      priceSource: "finnhub",
    };
  }

  // 2) Yahoo v8 chart — secondary. May 429 from data-center IPs.
  const yahoo = await getYahooChartCached(iex.symbol, {
    interval: "5m",
    range: "1d",
    includePrePost: true,
  });
  if (yahoo && yahoo.lastPrice != null) {
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

  // 3) IEX baseline — both extended-hours sources unavailable. The Snapshot
  // already carries priceSource: 'iex' from getIexSnapshot, so callers can
  // detect the stale condition (session != regular && priceSource === iex).
  return iex;
}

/**
 * Snapshot for the analyzed (primary) symbol. Used by /api/analyze for
 * the prompt's "current price" line. The fan-out also pulls 5-min bars
 * via getPrimaryRecentBars; they share the Yahoo chart fetch via the
 * yahoo.ts in-process cache.
 */
export async function getPrimarySnapshot(symbol: string): Promise<Snapshot> {
  const iex = await getIexSnapshot(symbol);
  if (iex.session === "regular") return iex;
  return augmentExtendedHours(iex);
}

/**
 * Recent bars with extended-hours awareness. Daily bars stay IEX (closing
 * prices from IEX align with the consolidated close at the closing auction,
 * good enough for SMA/RSI/52w). 5-min bars switch to Yahoo (with
 * includePrePost) outside regular hours so Gemini sees pre/after action.
 * Finnhub doesn't help here — its free tier has no intraday bars.
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
 * Lightweight snapshot for the watchlist batch (/api/snapshot). Identical
 * extended-hours fallback path as getPrimarySnapshot.
 */
export async function getLatestPriceSnapshot(symbol: string): Promise<Snapshot> {
  const iex = await getIexSnapshot(symbol);
  if (iex.session === "regular") return iex;
  return augmentExtendedHours(iex);
}
