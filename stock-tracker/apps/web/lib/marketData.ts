// Source selection is based on observation timestamps, not provider identity.
// A successful fallback response may still contain yesterday's closing price.
import {
  getSnapshot, getRecentBars, currentMarketSession,
  type Snapshot, type RecentBars,
} from "./alpaca";
import { getYahooChartCached } from "./yahoo";
import { getFinnhubQuote } from "./finnhub";
import { snapshotQuality } from "./dataQuality";

export function preferNewerSnapshot(baseline: Snapshot, candidate: Snapshot, now = new Date()): Snapshot {
  const time = candidate.lastTradeTs ? Date.parse(candidate.lastTradeTs) : NaN;
  const before = baseline.lastTradeTs ? Date.parse(baseline.lastTradeTs) : NaN;
  const baselineValid = Number.isFinite(before) && before <= now.getTime() + 60_000 &&
    baseline.lastPrice != null && Number.isFinite(baseline.lastPrice) && baseline.lastPrice > 0;
  if (candidate.lastPrice == null || !Number.isFinite(candidate.lastPrice) || candidate.lastPrice <= 0 ||
      !Number.isFinite(time) || time > now.getTime() + 60_000 ||
      (baselineValid && time <= before)) return baseline;
  return candidate;
}

async function augmentSnapshot(baseline: Snapshot): Promise<Snapshot> {
  const [fq, yahoo] = await Promise.all([
    getFinnhubQuote(baseline.symbol),
    getYahooChartCached(baseline.symbol, { interval: "5m", range: "1d", includePrePost: true }),
  ]);
  let selected = baseline;
  if (fq) selected = preferNewerSnapshot(selected, {
    ...baseline, lastPrice: fq.c,
    lastTradeTs: Number.isFinite(fq.t) && fq.t > 0 ? new Date(fq.t * 1000).toISOString() : null,
    prevClose: fq.pc > 0 ? fq.pc : baseline.prevClose,
    priceSource: "finnhub", priceType: "trade",
  });
  if (yahoo) selected = preferNewerSnapshot(selected, {
    ...baseline, lastPrice: yahoo.lastPrice, lastTradeTs: yahoo.lastTradeTs,
    prevClose: yahoo.prevClose ?? baseline.prevClose,
    priceSource: "yahoo", priceType: "bar_close",
  });
  return {
    ...selected,
    changePct: selected.lastPrice != null && selected.prevClose != null && selected.prevClose > 0
      ? (selected.lastPrice - selected.prevClose) / selected.prevClose : null,
    dataQuality: snapshotQuality(selected.lastTradeTs, selected.lastPrice, selected.session),
  };
}

export async function getPrimarySnapshot(symbol: string): Promise<Snapshot> {
  const baseline = await getSnapshot(symbol);
  if (baseline.session === "regular" && baseline.dataQuality?.status === "fresh") return baseline;
  return augmentSnapshot(baseline);
}

export async function getPrimaryRecentBars(symbol: string): Promise<RecentBars> {
  const baseline = getRecentBars(symbol);
  if (currentMarketSession() === "regular") return baseline;
  const [bars, yahoo] = await Promise.all([
    baseline,
    getYahooChartCached(symbol, { interval: "5m", range: "5d", includePrePost: true }),
  ]);
  const yahooTs = Date.parse(yahoo?.bars.at(-1)?.ts ?? "");
  const alpacaTs = Date.parse(bars.fiveMin.at(-1)?.ts ?? "");
  if (!yahoo || !Number.isFinite(yahooTs) || (Number.isFinite(alpacaTs) && yahooTs <= alpacaTs)) return bars;
  return { fiveMin: yahoo.bars, daily: bars.daily };
}

export const getLatestPriceSnapshot = getPrimarySnapshot;
