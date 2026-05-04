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
}

interface AlpacaSnapshotRaw {
  latestTrade?: { p: number; t: string };
  latestQuote?: { ap: number; bp: number; t: string };
  dailyBar?: { o: number; h: number; l: number; c: number; v: number; t: string };
  prevDailyBar?: { o: number; h: number; l: number; c: number; v: number; t: string };
}

function classifySession(tradeTs: string | null): "pre" | "regular" | "after" | "closed" {
  if (!tradeTs) return "closed";
  const d = new Date(tradeTs);
  // Convert UTC -> ET. ET = UTC-5 (standard) or UTC-4 (daylight). Approximate
  // with the runtime's view of America/New_York via Intl.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const mins = hour * 60 + minute;
  // Pre: 04:00 - 09:30 ET, Regular: 09:30 - 16:00, After: 16:00 - 20:00, else closed
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
    session: classifySession(lastTradeTs),
    prevClose,
    todayOpen,
    todayHigh,
    todayLow,
    todayClose,
    todayVolume,
    changePct,
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

export async function getRecentNews(symbol: string, limit = 10): Promise<NewsItem[]> {
  const sym = symbol.toUpperCase();
  const r = await fetch(
    `${DATA_BASE}/news?symbols=${encodeURIComponent(sym)}&limit=${limit}&sort=desc`,
    { headers: headers(), cache: "no-store" },
  );
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

export interface RecentBars {
  fiveMin: Array<{ ts: string; o: number; h: number; l: number; c: number; v: number }>;
  daily: Array<{ ts: string; o: number; h: number; l: number; c: number; v: number }>;
}

export async function getRecentBars(symbol: string): Promise<RecentBars> {
  const sym = symbol.toUpperCase();
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 3600 * 1000);

  const params5m = new URLSearchParams({
    timeframe: "5Min",
    start: fiveDaysAgo.toISOString().replace(/\.\d{3}Z$/, "Z"),
    end: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    limit: "200",
    feed: "iex",
    adjustment: "raw",
  });
  const params1d = new URLSearchParams({
    timeframe: "1Day",
    start: sixtyDaysAgo.toISOString().replace(/\.\d{3}Z$/, "Z"),
    end: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    limit: "60",
    feed: "iex",
    adjustment: "raw",
  });

  const [r5, rd] = await Promise.all([
    fetch(`${DATA_BASE}/stocks/${encodeURIComponent(sym)}/bars?${params5m}`, {
      headers: headers(),
      cache: "no-store",
    }),
    fetch(`${DATA_BASE}/stocks/${encodeURIComponent(sym)}/bars?${params1d}`, {
      headers: headers(),
      cache: "no-store",
    }),
  ]);

  const fiveMin = r5.ok
    ? ((await r5.json()) as { bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> }).bars ?? []
    : [];
  const daily = rd.ok
    ? ((await rd.json()) as { bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> }).bars ?? []
    : [];

  return {
    fiveMin: fiveMin.map((b) => ({ ts: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })),
    daily: daily.map((b) => ({ ts: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })),
  };
}
