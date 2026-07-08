// GET /api/sector-strength
//
// "강세 섹터" (leading sectors) — which sectors/themes is capital rotating
// into RIGHT NOW, and the highest-volume / highest-dollar-volume names inside
// each. Answers the user's question: "지금 자금이 돌고 거래량이 높은 강세
// 섹터가 어디인가?" (반도체? 우주?).
//
// HONEST METHODOLOGY (no fabrication — see lib/sectorBaskets.ts header):
//   strength  = mean today-return of the basket's CONSTITUENT stocks
//               (breadth-confirmed direction, not a single ETF print)
//   거래대금   = Σ (today consolidated-tape volume × last price) across constituents
//   거래량     = today's cumulative share volume per stock (consolidated tape)
//   상대거래량 = today's volume PROJECTED to a full-day pace (during the regular
//               session) ÷ the 20-session average daily volume. >1 means
//               unusually heavy participation ("자금이 몰린다"). Pre-market is
//               not comparable to a regular-session baseline → reported null.
//   뉴스       = a recent headline for the sector's most-active names, shown as
//               CONTEXT only ("왜 강세인지" 참고) — never an input to ranking.
//   Prices come from live Alpaca snapshots; VOLUME comes from the consolidated
//   daily-bars tape (getDailyVolumeStats), NOT the snapshot's dailyBar.v — that
//   field is IEX-only (~3% of the real tape) and would make 거래량/거래대금 and
//   any relative-volume ratio meaningless. Numerator and baseline are therefore
//   read from the SAME consolidated source (apples-to-apples). During regular
//   hours volume is ≈15-min delayed; when closed it reflects the last session.
//   The response says which via `session`.

import { NextResponse } from "next/server";
import {
  getSnapshots,
  getDailyVolumeStats,
  getNewsForSymbols,
  regularSessionElapsedFraction,
  currentMarketSession,
  type Snapshot,
} from "@/lib/alpaca";
import { SECTOR_BASKETS, allBasketSymbols } from "@/lib/sectorBaskets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK = 100;
// Floor the elapsed-session fraction so early-session projection (e.g. 09:35,
// ~1% elapsed) doesn't explode relative volume into nonsense. First ~hour is
// treated as at least 15% of the day.
const MIN_ELAPSED_FRAC = 0.15;

interface StockRow {
  symbol: string;
  price: number;
  changePct: number | null;
  volume: number;
  dollarVolume: number;
  /** Projected-full-day volume ÷ 20d avg. Null when no baseline / not comparable. */
  relVol: number | null;
  /**
   * Buy/sell pressure PROXY, −1..+1 (Money Flow Multiplier / close-location
   * value): ((c−l) − (h−c)) / (h−l) from today's OHLC. +1 = closed at the
   * high (buyers won the session), −1 = at the low (sellers won). This is
   * NOT tick-level order flow (free data can't classify each trade as
   * buy/sell) — it's the textbook accumulation/distribution read of "did the
   * session's heavy volume push price up into the range or down out of it".
   * Null when no usable range (illiquid) or pre-market (today's H/L not formed
   * yet, so it'd mix a pre-market price with yesterday's range).
   */
  pressure: number | null;
}

interface Headline {
  headline: string;
  source: string;
  url: string;
  createdAt: string;
}

interface SectorRow {
  key: string;
  labelKo: string;
  labelEn: string;
  etf: string | null;
  kind: "sector" | "theme";
  avgReturn: number | null;
  etfReturn: number | null;
  breadthUp: number;
  breadthTotal: number;
  totalDollarVolume: number;
  /** Dollar-weighted sector relative volume. Null when no baseline / pre-market. */
  relVol: number | null;
  pricedCount: number;
  topByVolume: StockRow[];
  topByDollarVolume: StockRow[];
  /** Context headline for the sector's most-active names (not a ranking input). */
  headline: Headline | null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/**
 * Money Flow Multiplier (close-location value) — where a session closed within
 * its range. See StockRow.pressure. Range −1..+1.
 *
 * During pre-market today's H/L isn't formed yet, so we read the PREVIOUS
 * completed session (prevHigh/prevLow/prevClose) — "어제 마감 수급" — which is
 * meaningful context for the user's evening (KST) viewing. Regular/after/closed
 * use today's OHLC. Null when the chosen session has no usable range.
 */
function closePressure(
  s: Snapshot,
  session: "pre" | "regular" | "after" | "closed",
): number | null {
  let h: number | null;
  let l: number | null;
  let c: number | null;
  if (session === "pre") {
    h = s.prevHigh;
    l = s.prevLow;
    c = s.prevClose;
  } else {
    h = s.todayHigh;
    l = s.todayLow;
    // Prefer the official regular close once set; otherwise the live price.
    c = s.todayClose ?? s.lastPrice;
  }
  if (h == null || l == null || c == null) return null;
  if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
  const range = h - l;
  if (range <= 0) return null;
  // Clamp: an after-hours lastPrice can sit outside the regular H/L.
  const cc = Math.min(h, Math.max(l, c));
  return (cc - l - (h - cc)) / range; // −1..+1
}

export async function GET() {
  const session = currentMarketSession();
  const symbols = allBasketSymbols();
  const constituents = Array.from(
    new Set(SECTOR_BASKETS.flatMap((b) => b.constituents.map((s) => s.toUpperCase()))),
  );

  // Volume projection multiplier: scale today's partial volume to a full-day
  // pace so it's comparable to the full-day average baseline.
  //   regular  → 1 / max(elapsedFraction, floor)
  //   after/closed → 1 (today's session is complete)
  //   pre      → null (pre-market volume isn't comparable to a regular baseline)
  let volFactor: number | null;
  if (session === "regular") {
    volFactor = 1 / Math.max(regularSessionElapsedFraction(), MIN_ELAPSED_FRAC);
  } else if (session === "after" || session === "closed") {
    volFactor = 1;
  } else {
    volFactor = null; // pre
  }
  const projected = session === "regular";

  // Snapshots (price/change) + consolidated daily-volume stats (latest + 20d
  // baseline) in parallel. Volume always comes from volStats, never the
  // IEX-only snapshot dailyBar.v.
  const [snapMaps, volStats] = await Promise.all([
    Promise.all(chunk(symbols, CHUNK).map((c) => getSnapshots(c))),
    getDailyVolumeStats(constituents, 20),
  ]);
  const snap: Record<string, Snapshot> = Object.assign({}, ...snapMaps);

  const buildRow = (sym: string): StockRow | null => {
    const key = sym.toUpperCase();
    const s = snap[key];
    if (!s) return null;
    const price = s.lastPrice;
    if (price == null || !isFinite(price) || price <= 0) return null;
    // Volume from the consolidated tape, NOT s.todayVolume (IEX-only ~3%).
    const stat = volStats[key];
    const volume = stat?.latest ?? null;
    if (volume == null || !isFinite(volume) || volume <= 0) return null;
    const base = stat?.avg ?? null;
    const relVol =
      volFactor != null && base != null && base > 0 ? (volume * volFactor) / base : null;
    return {
      symbol: key,
      price,
      changePct: s.changePct ?? null,
      volume,
      dollarVolume: volume * price,
      relVol,
      pressure: closePressure(s, session),
    };
  };

  const sectors: SectorRow[] = SECTOR_BASKETS.map((b) => {
    // Volume-bearing rows (price + consolidated volume) drive the TOP-N
    // volume/dollar lists and totalDollarVolume.
    const rows: StockRow[] = [];
    for (const sym of b.constituents) {
      const row = buildRow(sym);
      if (row) rows.push(row);
    }
    // Strength & breadth are computed from SNAPSHOTS (price only) over every
    // constituent — NOT from `rows`. Volume comes from a separate best-effort
    // fetch (getDailyVolumeStats drops chunks on timeout); deriving the ranking
    // signal from rows would let a volume hiccup silently distort strength.
    const returns: number[] = [];
    for (const sym of b.constituents) {
      const cp = snap[sym.toUpperCase()]?.changePct;
      if (cp != null && isFinite(cp)) returns.push(cp);
    }
    const breadthUp = returns.filter((v) => v > 0).length;
    const totalDollarVolume = rows.reduce((a, r) => a + r.dollarVolume, 0);
    const etfReturn = b.etf ? snap[b.etf.toUpperCase()]?.changePct ?? null : null;

    // Dollar-weighted sector relative volume: Σ projected $vol ÷ Σ baseline $vol,
    // over constituents that have a baseline. Both legs use consolidated-tape
    // volume (volStats). Robust to one tiny name.
    let projTodayDollar = 0;
    let baseDollar = 0;
    if (volFactor != null) {
      for (const sym of b.constituents) {
        const key = sym.toUpperCase();
        const s = snap[key];
        const stat = volStats[key];
        if (!s || s.lastPrice == null) continue;
        const vol = stat?.latest;
        const base = stat?.avg;
        if (vol == null || vol <= 0 || base == null || base <= 0) continue;
        projTodayDollar += vol * volFactor * s.lastPrice;
        baseDollar += base * s.lastPrice;
      }
    }
    const relVol = baseDollar > 0 ? projTodayDollar / baseDollar : null;

    return {
      key: b.key,
      labelKo: b.labelKo,
      labelEn: b.labelEn,
      etf: b.etf ?? null,
      kind: b.kind,
      avgReturn: mean(returns),
      etfReturn: etfReturn != null && isFinite(etfReturn) ? etfReturn : null,
      breadthUp,
      breadthTotal: returns.length,
      totalDollarVolume,
      relVol,
      // Constituents evaluated for strength (= breadthTotal): those with a
      // live price. Volume-only data gaps don't reduce this.
      pricedCount: returns.length,
      topByVolume: [...rows].sort((a, b) => b.volume - a.volume).slice(0, 5),
      topByDollarVolume: [...rows].sort((a, b) => b.dollarVolume - a.dollarVolume).slice(0, 5),
      headline: null,
    };
  });

  // Rank by strength (mean constituent return). Unpriced baskets sink.
  sectors.sort((a, b) => {
    if (a.avgReturn == null) return 1;
    if (b.avgReturn == null) return -1;
    return b.avgReturn - a.avgReturn;
  });

  // ─── Context headlines (best-effort, single call, never blocks ranking) ──
  // For each sector, gather its 2 most-active (dollar-volume) names, fetch
  // recent news across the union, then assign each sector the freshest article
  // tagged with one of its names.
  try {
    const candidatesBySector = new Map<string, Set<string>>();
    const newsSymbols = new Set<string>();
    for (const s of sectors) {
      const top = s.topByDollarVolume.slice(0, 2).map((r) => r.symbol);
      candidatesBySector.set(s.key, new Set(top));
      top.forEach((t) => newsSymbols.add(t));
    }
    if (newsSymbols.size > 0) {
      const news = await getNewsForSymbols(Array.from(newsSymbols), 50);
      // news is sorted desc (newest first) by the API.
      for (const s of sectors) {
        const cand = candidatesBySector.get(s.key);
        if (!cand) continue;
        const hit = news.find((n) => n.symbols.some((sym) => cand.has(sym.toUpperCase())));
        if (hit) {
          s.headline = {
            headline: hit.headline,
            source: hit.source,
            url: hit.url,
            createdAt: hit.createdAt,
          };
        }
      }
    }
  } catch {
    // headlines are optional context — ignore failures
  }

  return NextResponse.json({
    asOf: new Date().toISOString(),
    session,
    /** True when relVol was projected from a partial (mid-regular-session) day. */
    relVolProjected: projected,
    sectorCount: sectors.length,
    sectors,
  });
}
