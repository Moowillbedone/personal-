// Server-side Alpaca client for snapshots and news.
// Free IEX feed — covers pre/regular/after-hours via latestTrade + dailyBar deltas.

const DATA_BASE = "https://data.alpaca.markets/v2";

function headers() {
  const key = process.env.ALPACA_KEY_ID;
  const sec = process.env.ALPACA_SECRET;
  if (!key || !sec) {
    throw new Error("ALPACA_KEY_ID / ALPACA_SECRET not set");
  }
  return {
    "APCA-API-KEY-ID": key,
    "APCA-API-SECRET-KEY": sec,
    accept: "application/json",
  };
}

export interface Snapshot {
  symbol: string;
  // last trade in any session
  lastPrice: number | null;
  lastTradeTs: string | null;
  // session-attribution: where the lastPrice came from
  session: "pre" | "regular" | "after" | "closed";
  // daily-bar reference points
  prevClose: number | null;
  todayOpen: number | null;
  todayHigh: number | null;
  todayLow: number | null;
  todayClose: number | null;     // present after regular close
  todayVolume: number | null;
  // computed
  changePct: number | null;       // (lastPrice - prevClose) / prevClose
  // provenance: which feed produced lastPrice. 'iex' = Alpaca free IEX
  // (real-time during regular session, often stale during pre/after).
  // 'yahoo' = Yahoo Finance v8 chart (covers extended hours).
  priceSource?: "iex" | "yahoo";
}

interface AlpacaSnapshotRaw {
  latestTrade?: { p: number; t: string };
  latestQuote?: { ap: number; bp: number; t: string };
  dailyBar?: { o: number; h: number; l: number; c: number; v: number; t: string };
  prevDailyBar?: { o: number; h: number; l: number; c: number; v: number; t: string };
}

/**
 * Returns the CURRENT US market session based on the wall-clock NY time.
 * This is what the user sees on the page header and what we attribute
 * snapshot prices to — "what session is open right now", not "what session
 * was the last trade in" (which differs per ticker for low-volume names).
 *
 * Pre:     04:00 – 09:30 ET
 * Regular: 09:30 – 16:00 ET
 * After:   16:00 – 20:00 ET
 * Closed:  outside those windows + weekends
 */
export function currentMarketSession(now: Date = new Date()): "pre" | "regular" | "after" | "closed" {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const mins = hour * 60 + minute;
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return "pre";
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return "regular";
  if (mins >= 16 * 60 && mins < 20 * 60) return "after";
  return "closed";
}

export async function getSnapshot(symbol: string): Promise<Snapshot> {
  const sym = symbol.toUpperCase();
  const r = await fetch(
    `${DATA_BASE}/stocks/${encodeURIComponent(sym)}/snapshot?feed=iex`,
    { headers: headers(), cache: "no-store" },
  );
  if (!r.ok) {
    throw new Error(`alpaca snapshot ${sym}: ${r.status} ${await r.text()}`);
  }
  const raw = (await r.json()) as AlpacaSnapshotRaw;

  const lastPrice = raw.latestTrade?.p ?? raw.latestQuote?.ap ?? null;
  const lastTradeTs = raw.latestTrade?.t ?? raw.latestQuote?.t ?? null;
  const prevClose = raw.prevDailyBar?.c ?? null;
  const todayOpen = raw.dailyBar?.o ?? null;
  const todayHigh = raw.dailyBar?.h ?? null;
  const todayLow = raw.dailyBar?.l ?? null;
  const todayClose = raw.dailyBar?.c ?? null;
  const todayVolume = raw.dailyBar?.v ?? null;
  const changePct =
    lastPrice != null && prevClose != null && prevClose !== 0
      ? (lastPrice - prevClose) / prevClose
      : null;

  return {
    symbol: sym,
    lastPrice,
    lastTradeTs,
    session: currentMarketSession(),
    prevClose,
    todayOpen,
    todayHigh,
    todayLow,
    todayClose,
    todayVolume,
    changePct,
    priceSource: "iex",
  };
}

export interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  createdAt: string;
}

export async function getRecentNews(symbol: string, limit = 25): Promise<NewsItem[]> {
  const sym = symbol.toUpperCase();
  // Alpaca news lives at v1beta1 (public docs), not v2.
  const url = `https://data.alpaca.markets/v1beta1/news?symbols=${encodeURIComponent(sym)}&limit=${limit}&sort=desc`;
  const r = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!r.ok) {
    // News access varies by Alpaca plan; fail soft so analysis can continue without news.
    return [];
  }
  const data = (await r.json()) as { news?: Array<{ id: number; headline: string; summary: string; source: string; url: string; created_at: string }> };
  return (data.news ?? []).map((n) => ({
    id: n.id,
    headline: n.headline,
    summary: n.summary,
    source: n.source,
    url: n.url,
    createdAt: n.created_at,
  }));
}

export interface Bar {
  ts: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface RecentBars {
  fiveMin: Bar[];
  daily: Bar[];
}

async function fetchBars(symbol: string, timeframe: string, days: number, limit: number): Promise<Bar[]> {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 3600 * 1000);
  const params = new URLSearchParams({
    timeframe,
    start: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    end: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    limit: String(limit),
    feed: "iex",
    adjustment: "raw",
  });
  const r = await fetch(`${DATA_BASE}/stocks/${encodeURIComponent(symbol.toUpperCase())}/bars?${params}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!r.ok) return [];
  const data = (await r.json()) as { bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> };
  return (data.bars ?? []).map((b) => ({ ts: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
}

/**
 * Fetch a deeper history bundle: ~5 days of 5-min bars (intraday context)
 * + ~365 days of daily bars (52w high/low + indicators).
 */
export async function getRecentBars(symbol: string): Promise<RecentBars> {
  const [fiveMin, daily] = await Promise.all([
    fetchBars(symbol, "5Min", 5, 600),
    fetchBars(symbol, "1Day", 380, 380),
  ]);
  return { fiveMin, daily };
}

// ────────────────────────────────────────────────────────────────────────────
// Batch snapshots (multiple symbols in one HTTP call)
// ────────────────────────────────────────────────────────────────────────────

export async function getSnapshots(symbols: string[]): Promise<Record<string, Snapshot>> {
  const list = Array.from(new Set(symbols.map((s) => s.toUpperCase()))).filter(Boolean);
  if (list.length === 0) return {};
  const url = `${DATA_BASE}/stocks/snapshots?symbols=${encodeURIComponent(list.join(","))}&feed=iex`;
  const r = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!r.ok) return {};
  const raw = (await r.json()) as Record<string, AlpacaSnapshotRaw>;
  const out: Record<string, Snapshot> = {};
  for (const [sym, s] of Object.entries(raw)) {
    const lastPrice = s.latestTrade?.p ?? s.latestQuote?.ap ?? null;
    const lastTradeTs = s.latestTrade?.t ?? s.latestQuote?.t ?? null;
    const prevClose = s.prevDailyBar?.c ?? null;
    const changePct =
      lastPrice != null && prevClose != null && prevClose !== 0
        ? (lastPrice - prevClose) / prevClose
        : null;
    out[sym] = {
      symbol: sym,
      lastPrice,
      lastTradeTs,
      session: currentMarketSession(),
      prevClose,
      todayOpen: s.dailyBar?.o ?? null,
      todayHigh: s.dailyBar?.h ?? null,
      todayLow: s.dailyBar?.l ?? null,
      todayClose: s.dailyBar?.c ?? null,
      todayVolume: s.dailyBar?.v ?? null,
      changePct,
      priceSource: "iex",
    };
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Options snapshot — ATM IV + put-call volume ratio.
// Free Alpaca options data is OPRA-delayed; ok for context, not for execution.
// ────────────────────────────────────────────────────────────────────────────

export interface UnusualOption {
  type: "call" | "put";
  strike: number;
  expiry: string;            // YYYY-MM-DD
  daysToExpiry: number;
  volume: number;
  /** Mid-quote price per contract (USD), or last trade if quote unavailable. */
  midPrice: number;
  /** volume × midPrice × 100 (each contract = 100 shares). */
  notionalUsd: number;
  /** (strike - spot) / spot — positive = OTM call / ITM put, negative reversed. */
  distFromSpotPct: number;
  /** volume / median(volumes of same side, same expiry). 1 = typical, 5 = 5× outlier. */
  volRatio: number;
}

export interface OptionsContext {
  atmCallIv: number | null;
  atmPutIv: number | null;
  atmIv: number | null;          // mean of call/put ATM
  putCallVolumeRatio: number | null;
  totalCallVolume: number;
  totalPutVolume: number;
  expiry: string | null;
  /** Top calls by volume (max 5) — surfaces where bullish flow is concentrating. */
  topCalls: UnusualOption[];
  /** Top puts by volume (max 5) — bearish flow / hedging. */
  topPuts: UnusualOption[];
}

interface OptContractRaw {
  symbol: string;
  strike_price: string;
  expiration_date: string;
  type: "call" | "put";
}
interface OptSnapshotRaw {
  latestQuote?: { ap?: number; bp?: number };
  latestTrade?: { p?: number };
  impliedVolatility?: number;
  greeks?: { delta?: number };
  dailyBar?: { v?: number };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.max(0, Math.round((b - a) / (24 * 3600 * 1000)));
}

export async function getOptionsContext(symbol: string, underlyingPrice: number | null): Promise<OptionsContext | null> {
  if (underlyingPrice == null || underlyingPrice <= 0) return null;
  try {
    // 1) List nearest-expiry contracts in a ±15% strike band
    const sym = symbol.toUpperCase();
    const lo = (underlyingPrice * 0.85).toFixed(2);
    const hi = (underlyingPrice * 1.15).toFixed(2);
    const today = new Date().toISOString().slice(0, 10);
    const future = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const contractsUrl = `https://paper-api.alpaca.markets/v2/options/contracts?underlying_symbols=${sym}&status=active&expiration_date_gte=${today}&expiration_date_lte=${future}&strike_price_gte=${lo}&strike_price_lte=${hi}&limit=200`;
    const cRes = await fetch(contractsUrl, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!cRes.ok) return null;
    const cData = (await cRes.json()) as { option_contracts?: OptContractRaw[] };
    const contracts = cData.option_contracts ?? [];
    if (contracts.length === 0) return null;

    // Find nearest expiry
    const exps = Array.from(new Set(contracts.map((c) => c.expiration_date))).sort();
    const nearest = exps[0];
    const nearContracts = contracts.filter((c) => c.expiration_date === nearest);

    // Find ATM strike
    const strikes = Array.from(new Set(nearContracts.map((c) => Number(c.strike_price)))).sort((a, b) => a - b);
    const atmStrike = strikes.reduce((best, s) =>
      Math.abs(s - underlyingPrice) < Math.abs(best - underlyingPrice) ? s : best,
    strikes[0]);

    // 2) Snapshot all near-expiry contracts to get IV + volume
    const occSyms = nearContracts.map((c) => c.symbol);
    if (occSyms.length === 0) return null;
    const snapUrl = `https://data.alpaca.markets/v1beta1/options/snapshots/${sym}?feed=indicative&limit=200`;
    const sRes = await fetch(snapUrl, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!sRes.ok) return null;
    const sData = (await sRes.json()) as { snapshots?: Record<string, OptSnapshotRaw> };
    const snaps = sData.snapshots ?? {};

    let totalCallVol = 0;
    let totalPutVol = 0;
    let atmCallIv: number | null = null;
    let atmPutIv: number | null = null;

    // Per-contract enriched view used both for the existing aggregates and
    // for the new UnusualOption picks. Computing once avoids a second pass.
    interface EnrichedContract {
      type: "call" | "put";
      strike: number;
      expiry: string;
      volume: number;
      midPrice: number;
    }
    const enriched: EnrichedContract[] = [];

    for (const c of nearContracts) {
      const snap = snaps[c.symbol];
      if (!snap) continue;
      const v = snap.dailyBar?.v ?? 0;
      if (c.type === "call") totalCallVol += v;
      else totalPutVol += v;
      if (Number(c.strike_price) === atmStrike) {
        if (c.type === "call") atmCallIv = snap.impliedVolatility ?? null;
        else atmPutIv = snap.impliedVolatility ?? null;
      }
      // Mid quote when both legs available; fallback to last trade so we
      // still get a notional estimate for thinly-quoted contracts.
      const ap = snap.latestQuote?.ap;
      const bp = snap.latestQuote?.bp;
      const lastTrade = snap.latestTrade?.p;
      let midPrice = 0;
      if (ap != null && bp != null && ap > 0 && bp > 0) {
        midPrice = (ap + bp) / 2;
      } else if (lastTrade != null && lastTrade > 0) {
        midPrice = lastTrade;
      }
      if (v > 0) {
        enriched.push({
          type: c.type,
          strike: Number(c.strike_price),
          expiry: c.expiration_date,
          volume: v,
          midPrice,
        });
      }
    }

    const atmIv =
      atmCallIv != null && atmPutIv != null
        ? (atmCallIv + atmPutIv) / 2
        : atmCallIv ?? atmPutIv ?? null;

    // ─── Unusual options activity ────────────────────────────────────────
    // "Unusual" here = highest-volume strikes today, with a vol/median ratio
    // so the prompt can show how outlier the flow is. Without historical OI
    // we can't compare to a 20-day baseline; comparing to today's median of
    // same-side same-expiry contracts is the next-best proxy and works
    // well in practice — most strikes get crickets, the live ones stand out.
    const spot = underlyingPrice;  // narrow capture — early-return guarantees > 0
    const topToday = today;
    function pickTop(side: "call" | "put"): UnusualOption[] {
      const sameSide = enriched.filter((e) => e.type === side);
      if (sameSide.length === 0) return [];
      const med = median(sameSide.map((e) => e.volume));
      const denom = med > 0 ? med : 1;
      return sameSide
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5)
        .map((e) => ({
          type: e.type,
          strike: e.strike,
          expiry: e.expiry,
          daysToExpiry: daysBetween(topToday, e.expiry),
          volume: e.volume,
          midPrice: e.midPrice,
          notionalUsd: e.volume * e.midPrice * 100,
          distFromSpotPct: (e.strike - spot) / spot,
          volRatio: e.volume / denom,
        }));
    }

    return {
      atmCallIv,
      atmPutIv,
      atmIv,
      putCallVolumeRatio: totalCallVol > 0 ? totalPutVol / totalCallVol : null,
      totalCallVolume: totalCallVol,
      totalPutVolume: totalPutVol,
      expiry: nearest,
      topCalls: pickTop("call"),
      topPuts: pickTop("put"),
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Corporate actions — dividends + splits + earnings dates (from Alpaca)
// ────────────────────────────────────────────────────────────────────────────

export interface CorporateActionsItem {
  type: string;
  date: string;
  description: string;
}

export async function getCorporateActions(symbol: string): Promise<CorporateActionsItem[]> {
  try {
    const today = new Date();
    const past = new Date(today.getTime() - 90 * 24 * 3600 * 1000);
    const future = new Date(today.getTime() + 90 * 24 * 3600 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const url = `${DATA_BASE.replace("/v2", "")}/v1/corporate-actions?symbols=${encodeURIComponent(symbol.toUpperCase())}&start=${fmt(past)}&end=${fmt(future)}`;
    const r = await fetch(url, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const data = (await r.json()) as Record<string, unknown>;
    const out: CorporateActionsItem[] = [];
    const flatten = (obj: Record<string, unknown>) => {
      for (const [type, list] of Object.entries(obj)) {
        if (!Array.isArray(list)) continue;
        for (const it of list) {
          const item = it as Record<string, unknown>;
          out.push({
            type,
            date: String(item.ex_date ?? item.process_date ?? item.declaration_date ?? ""),
            description: JSON.stringify(item).slice(0, 200),
          });
        }
      }
    };
    if (data.corporate_actions && typeof data.corporate_actions === "object") {
      flatten(data.corporate_actions as Record<string, unknown>);
    } else {
      flatten(data);
    }
    return out.filter((o) => o.date).sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}
