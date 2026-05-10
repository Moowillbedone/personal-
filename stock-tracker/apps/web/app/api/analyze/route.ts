import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getSnapshots,
  getRecentNews,
  getOptionsContext,
  getCorporateActions,
  type Snapshot,
  type NewsItem,
  type Bar,
  type OptionsContext,
  type CorporateActionsItem,
} from "@/lib/alpaca";
import { getPrimarySnapshot, getPrimaryRecentBars } from "@/lib/marketData";
import { generateVerdict, ACTIVE_MODEL } from "@/lib/gemini";
import { computeAll, type IndicatorBundle } from "@/lib/indicators";
import { getSectorInfo, MARKET_TICKERS, type SectorInfo } from "@/lib/sectorMap";
import { fetchTickerNews, fetchMacroNews, type HeadlineItem } from "@/lib/macroNews";
import { fetchRecent8K, type FilingItem } from "@/lib/sec";
import { getInsiderSummary, type InsiderSummary } from "@/lib/secInsider";
import { getMacroSnapshot, isFredEnabled, type MacroSnapshot } from "@/lib/fred";
import { getFinnhubBundle, isFinnhubEnabled, type FinnhubBundle } from "@/lib/finnhub";
import { getOwnSignalsFor, getWatchlistSymbols, type OwnSignalSummary } from "@/lib/signalsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // analysis can take up to ~30s

const CACHE_TTL_MS = 5 * 60 * 1000;

interface PositionInput {
  strategy?: "lump_sum" | "dca";
  total_budget_krw?: number | null;
  dca_per_day_krw?: number | null;
  dca_total_days?: number | null;
}

interface AnalyzeBody {
  symbol?: string;
  position?: PositionInput;
}

// Wrapper that never rejects — returns null on failure. Keeps Promise.all happy.
function softly<T>(p: Promise<T>): Promise<T | null> {
  return p.then(
    (v) => v,
    () => null,
  );
}

interface CombinedNewsItem {
  source: string;
  headline: string;
  url: string;
  createdAt: string;
  summary?: string;
}

/**
 * Round-robin diversification by source. The first pass takes one item from
 * each unique source (in input order, so premium outlets come first), the
 * next pass takes the second item from each, etc. This guarantees the user
 * sees 6+ distinct outlets in the first ~10 entries instead of all-Benzinga.
 */
function diversifyNews(
  items: CombinedNewsItem[],
  opts: { perSourceMax: number; total: number },
): CombinedNewsItem[] {
  const bySource = new Map<string, CombinedNewsItem[]>();
  const seen = new Set<string>(); // dedupe by url
  const sourceOrder: string[] = [];
  for (const it of items) {
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    if (!bySource.has(it.source)) {
      bySource.set(it.source, []);
      sourceOrder.push(it.source);
    }
    const arr = bySource.get(it.source)!;
    if (arr.length < opts.perSourceMax) arr.push(it);
  }
  const out: CombinedNewsItem[] = [];
  let pulled = true;
  let round = 0;
  while (pulled && out.length < opts.total) {
    pulled = false;
    for (const src of sourceOrder) {
      const arr = bySource.get(src)!;
      if (round < arr.length) {
        out.push(arr[round]);
        pulled = true;
        if (out.length >= opts.total) break;
      }
    }
    round++;
  }
  return out;
}

function countSources(items: CombinedNewsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const it of items) counts[it.source] = (counts[it.source] ?? 0) + 1;
  return counts;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AnalyzeBody | null;
    const symbol = body?.symbol?.trim().toUpperCase();
    if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
    }

    // 1) Cache lookup
    const cutoffIso = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    const { data: cached } = await supabaseAdmin
      .from("ai_analysis")
      .select("*")
      .eq("symbol", symbol)
      .gte("created_at", cutoffIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let verdictRow = cached;
    let snapshot: Snapshot | null = null;
    let newsCombined: Array<{ source: string; headline: string; url: string; createdAt: string; summary?: string }> = [];

    if (!verdictRow) {
      // 2) Pull EVERYTHING in parallel — each source is fail-soft.
      const sectorInfo = getSectorInfo(symbol);
      const sectorSymbols = sectorInfo
        ? [sectorInfo.etf, ...sectorInfo.peers.filter((p) => p !== symbol)]
        : [];

      const [
        snap,
        bars,
        alpacaNews,
        macroHeadlines,
        tickerHeadlines,
        secFilings,
        marketSnaps,
        sectorSnaps,
        fredMacro,
        finnhub,
        corpActions,
        ownSignals,
        watchlistSyms,
        insider,
      ] = await Promise.all([
        getPrimarySnapshot(symbol),
        softly(getPrimaryRecentBars(symbol)),
        softly(getRecentNews(symbol, 25)),
        softly(fetchMacroNews(2)),
        softly(fetchTickerNews(symbol, 2)),
        softly(fetchRecent8K(symbol, 5)),
        softly(getSnapshots(MARKET_TICKERS)),
        sectorSymbols.length > 0 ? softly(getSnapshots(sectorSymbols)) : Promise.resolve(null),
        softly(getMacroSnapshot()),
        softly(getFinnhubBundle(symbol)),
        softly(getCorporateActions(symbol)),
        softly(getOwnSignalsFor(symbol, 30)),
        softly(getWatchlistSymbols()),
        softly(getInsiderSummary(symbol, 90)),
      ]);

      snapshot = snap;
      const optionsCtx = await softly(getOptionsContext(symbol, snap.lastPrice));

      // Optional: snapshots for the rest of the user's watchlist (excluding this symbol).
      const otherWatch = (watchlistSyms ?? []).filter((s) => s !== symbol).slice(0, 12);
      const watchSnaps =
        otherWatch.length > 0 ? await softly(getSnapshots(otherWatch)) : null;

      // Compute technical indicators from daily bars
      const dailyBars: Bar[] = bars?.daily ?? [];
      const indicators = dailyBars.length > 0 ? computeAll(dailyBars) : null;

      // Build a unified news list and DIVERSIFY: premium outlets (Reuters/
      // Bloomberg/CNBC/WSJ/FT/MarketWatch) first, then Alpaca (Benzinga/Zacks).
      // Cap each source at 3 entries so a single outlet can't dominate the
      // "참고 뉴스" panel — the user wants source variety in the citations.
      newsCombined = diversifyNews([
        ...(tickerHeadlines ?? []).map((h) => ({
          source: h.source,
          headline: h.headline,
          url: h.link,
          createdAt: h.publishedAt,
        })),
        ...(macroHeadlines ?? []).map((h) => ({
          source: h.source,
          headline: h.headline,
          url: h.link,
          createdAt: h.publishedAt,
        })),
        ...(alpacaNews ?? []).map((n) => ({
          source: n.source,
          headline: n.headline,
          url: n.url,
          createdAt: n.createdAt,
          summary: n.summary,
        })),
      ], { perSourceMax: 3, total: 30 });

      const prompt = buildPrompt({
        symbol,
        snap,
        indicators,
        bars,
        alpacaNews: alpacaNews ?? [],
        macroHeadlines: macroHeadlines ?? [],
        tickerHeadlines: tickerHeadlines ?? [],
        secFilings: secFilings ?? [],
        marketSnaps: marketSnaps ?? {},
        sectorInfo,
        sectorSnaps: sectorSnaps ?? {},
        fredMacro: fredMacro ?? null,
        finnhub: finnhub ?? null,
        optionsCtx: optionsCtx ?? null,
        corpActions: corpActions ?? [],
        ownSignals: ownSignals ?? null,
        watchSnaps: watchSnaps ?? {},
        insider: insider ?? null,
      });

      const verdict = await generateVerdict(prompt);

      // 3) Persist
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("ai_analysis")
        .insert({
          symbol,
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          summary: verdict.summary,
          bull_points: verdict.bull_points,
          bear_points: verdict.bear_points,
          horizons: verdict.horizons,
          context: {
            last_price: snap.lastPrice,
            prev_close: snap.prevClose,
            change_pct: snap.changePct,
            session: snap.session,
            sources: {
              alpaca_news: (alpacaNews ?? []).length,
              premium_ticker_news: (tickerHeadlines ?? []).length,
              macro_news: (macroHeadlines ?? []).length,
              sec_8k: (secFilings ?? []).length,
              market_etfs: Object.keys(marketSnaps ?? {}).length,
              sector_peers: Object.keys(sectorSnaps ?? {}).length,
              fred: fredMacro ? "ok" : "skipped",
              finnhub: finnhub ? "ok" : "skipped",
              options: optionsCtx ? "ok" : "skipped",
              own_signals: ownSignals?.total ?? 0,
            },
            indicators_summary: indicators
              ? {
                  rsi14: indicators.rsi14,
                  sma20: indicators.sma20,
                  sma50: indicators.sma50,
                  sma200: indicators.sma200,
                  fiftyTwoWeek: indicators.fiftyTwoWeek,
                }
              : null,
          },
          model: ACTIVE_MODEL,
        })
        .select("*")
        .single();
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      verdictRow = inserted;
    } else {
      // For cached responses, attach a fresh snapshot + fresh news so the UI
      // still shows current price and citations even when the verdict itself
      // is reused. News fetches are fast (<2s) so this doesn't hurt much.
      const [freshSnap, freshAlpaca, freshTicker, freshMacro] = await Promise.all([
        getPrimarySnapshot(symbol).catch(() => null),
        softly(getRecentNews(symbol, 25)),
        softly(fetchTickerNews(symbol, 2)),
        softly(fetchMacroNews(2)),
      ]);
      snapshot = freshSnap;
      newsCombined = diversifyNews([
        ...(freshTicker ?? []).map((h) => ({ source: h.source, headline: h.headline, url: h.link, createdAt: h.publishedAt })),
        ...(freshMacro ?? []).map((h) => ({ source: h.source, headline: h.headline, url: h.link, createdAt: h.publishedAt })),
        ...(freshAlpaca ?? []).map((n) => ({ source: n.source, headline: n.headline, url: n.url, createdAt: n.createdAt, summary: n.summary })),
      ], { perSourceMax: 3, total: 30 });
    }

    const sizing = computeSizing(verdictRow.verdict, Number(verdictRow.confidence), body?.position);

    return NextResponse.json({
      cached: !!cached,
      analysis: verdictRow,
      snapshot,
      news: newsCombined.slice(0, 20),
      sources_used: countSources(newsCombined),
      sizing,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? "analyze failed" }, { status: 500 });
  }
}

// ─── prompt builder ─────────────────────────────────────────────────────────

interface PromptInputs {
  symbol: string;
  snap: Snapshot;
  indicators: IndicatorBundle | null;
  bars: { fiveMin: Bar[]; daily: Bar[] } | null;
  alpacaNews: NewsItem[];
  macroHeadlines: HeadlineItem[];
  tickerHeadlines: HeadlineItem[];
  secFilings: FilingItem[];
  marketSnaps: Record<string, Snapshot>;
  sectorInfo: SectorInfo | null;
  sectorSnaps: Record<string, Snapshot>;
  fredMacro: MacroSnapshot | null;
  finnhub: FinnhubBundle | null;
  optionsCtx: OptionsContext | null;
  corpActions: CorporateActionsItem[];
  ownSignals: OwnSignalSummary | null;
  watchSnaps: Record<string, Snapshot>;
  insider: InsiderSummary | null;
}

function pct(v: number | null | undefined): string {
  if (v == null) return "?";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}
function num(v: number | null | undefined, dp = 2): string {
  if (v == null) return "?";
  return v.toFixed(dp);
}

function snapLine(sym: string, s: Snapshot | undefined): string {
  if (!s) return `${sym}: (no data)`;
  return `${sym}=${num(s.lastPrice)} (${pct(s.changePct)})`;
}

// Tells Gemini where the lastPrice came from so it can weight its confidence
// appropriately. Extended-hours prices are real but thinly traded; IEX
// during non-regular sessions means Yahoo failed and the price is stale.
function sessionDisclosure(
  session: Snapshot["session"],
  source: Snapshot["priceSource"],
): string {
  if (session === "regular") {
    return "정규장 실시간 IEX 피드. 가격·5분봉 모두 최신.";
  }
  if (source === "yahoo") {
    if (session === "pre")
      return "프리마켓 — 가격은 Yahoo 익스텐디드 호가 기반. 거래량이 정규장보다 훨씬 적어 슬리피지 큼, 단일 신호로 단정 금지.";
    if (session === "after")
      return "애프터마켓 — 가격은 Yahoo 익스텐디드 호가 기반. 거래량이 정규장보다 훨씬 적어 슬리피지 큼, 단일 신호로 단정 금지.";
    return "장마감 — Yahoo가 본 가장 최근 거래 가격(익스텐디드 또는 정규장 종가). 실시간 아님.";
  }
  // source === 'iex' but non-regular: Yahoo failed, IEX is showing the
  // last regular session trade. Warn Gemini explicitly.
  const label =
    session === "pre" ? "프리장" : session === "after" ? "애프터장" : "장마감";
  return `${label} 시간대지만 익스텐디드 데이터 소스 실패 — 표시된 가격은 직전 정규장 IEX 종가로 stale 가능성 높음. 가격 단정 금지, 추세·뉴스 위주로 판단.`;
}

function buildPrompt(p: PromptInputs): string {
  const { symbol, snap, indicators, bars, alpacaNews, macroHeadlines, tickerHeadlines, secFilings, marketSnaps, sectorInfo, sectorSnaps, fredMacro, finnhub, optionsCtx, corpActions, ownSignals, watchSnaps, insider } = p;

  const fiveMinTail = (bars?.fiveMin ?? []).slice(-40).map(
    (b) => `${b.ts.slice(11, 16)} c=${b.c.toFixed(2)} v=${b.v}`,
  );
  const dailyTail = (bars?.daily ?? []).slice(-30).map(
    (b) => `${b.ts.slice(0, 10)} o=${b.o.toFixed(2)} c=${b.c.toFixed(2)} v=${b.v}`,
  );

  const sections: string[] = [];

  sections.push(`# ${symbol} 분석 — 한국어 단타 트레이딩 의견 요청`);

  // 1) Snapshot
  sections.push([
    "## 1) 현재 스냅샷",
    `- 가격: ${num(snap.lastPrice)} (${snap.session}) · 전일종가 ${num(snap.prevClose)} · 변동률 ${pct(snap.changePct)}`,
    `- 오늘 OHLC: O=${num(snap.todayOpen)} H=${num(snap.todayHigh)} L=${num(snap.todayLow)} V=${snap.todayVolume?.toLocaleString() ?? "?"}`,
    `- 데이터 소스: ${sessionDisclosure(snap.session, snap.priceSource)}`,
  ].join("\n"));

  // 2) Indicators
  if (indicators) {
    const m = indicators.macd;
    const bb = indicators.bollinger;
    const w = indicators.fiftyTwoWeek;
    sections.push([
      "## 2) 기술 지표 (일봉 기준)",
      `- RSI(14)=${num(indicators.rsi14, 1)} · ATR(14)=${num(indicators.atr14, 2)}`,
      `- SMA20=${num(indicators.sma20)} · SMA50=${num(indicators.sma50)} · SMA200=${num(indicators.sma200)}`,
      m ? `- MACD: line=${num(m.macd, 3)} signal=${num(m.signal, 3)} hist=${num(m.hist, 3)}` : "",
      bb ? `- Bollinger(20,2): upper=${num(bb.upper)} mid=${num(bb.mid)} lower=${num(bb.lower)} %B=${num(bb.pctB, 2)}` : "",
      w ? `- 52주 고=${num(w.high)} 저=${num(w.low)} · 고대비 ${pct(w.pctFromHigh)} · 저대비 ${pct(w.pctFromLow)}` : "",
      indicators.volume.todayRatio20 != null
        ? `- 오늘 거래량 / 20일 평균 = ${num(indicators.volume.todayRatio20, 2)}배`
        : "",
    ].filter(Boolean).join("\n"));
  }

  // 3) Recent bars
  if (fiveMinTail.length > 0 || dailyTail.length > 0) {
    sections.push([
      "## 3) 최근 봉 데이터",
      "### 5분봉 (최근 40개)",
      fiveMinTail.join("\n") || "(none)",
      "### 일봉 (최근 30개)",
      dailyTail.join("\n") || "(none)",
    ].join("\n"));
  }

  // 4) Market context
  if (Object.keys(marketSnaps).length > 0) {
    sections.push([
      "## 4) 시장 컨텍스트 (주요 ETF/벤치마크)",
      MARKET_TICKERS.map((t) => snapLine(t, marketSnaps[t])).join(" · "),
    ].join("\n"));
  }

  // 5) Sector + peers
  if (sectorInfo && Object.keys(sectorSnaps).length > 0) {
    sections.push([
      `## 5) 섹터 컨텍스트 — ${sectorInfo.sector}`,
      `섹터 ETF: ${snapLine(sectorInfo.etf, sectorSnaps[sectorInfo.etf])}`,
      `동종 비교: ${sectorInfo.peers.filter((p) => p !== symbol).map((t) => snapLine(t, sectorSnaps[t])).join(" · ")}`,
    ].join("\n"));
  }

  // 6) FRED macro
  if (fredMacro) {
    sections.push([
      "## 6) 매크로 지표 (FRED)",
      `- 10Y yield=${num(fredMacro.tenYearYield?.value, 2)}% (${fredMacro.tenYearYield?.date ?? "?"})`,
      `- 2Y yield=${num(fredMacro.twoYearYield?.value, 2)}%`,
      `- DXY (broad USD)=${num(fredMacro.dxy?.value, 2)}`,
      `- VIX=${num(fredMacro.vix?.value, 2)}`,
      `- CPI (most recent)=${num(fredMacro.cpi?.value, 1)}`,
      `- 실업률=${num(fredMacro.unemployment?.value, 1)}%`,
    ].join("\n"));
  }

  // 7) Options
  if (optionsCtx) {
    const lines: string[] = [
      "## 7) 옵션 시장 컨텍스트",
      `- 가장 가까운 만기: ${optionsCtx.expiry}`,
      `- ATM IV: 콜=${num(optionsCtx.atmCallIv, 3)} · 풋=${num(optionsCtx.atmPutIv, 3)} · 평균=${num(optionsCtx.atmIv, 3)}`,
      `- Put/Call 거래량 비율 = ${num(optionsCtx.putCallVolumeRatio, 2)} (콜 ${optionsCtx.totalCallVolume.toLocaleString()} vs 풋 ${optionsCtx.totalPutVolume.toLocaleString()})`,
    ];

    // 7.5) Unusual options activity — top 5 calls + top 5 puts by volume.
    // volRatio = today's vol / median(same-side same-expiry) — outlier flag.
    // notional ≥ $100K is the rough cutoff for "smart money sized" trades;
    // anything below is retail-noise on free Alpaca data and we skip it.
    const fmtUsd = (v: number): string => {
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
      if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    };
    const fmtUnusual = (o: typeof optionsCtx.topCalls[number]): string => {
      const dist = (o.distFromSpotPct * 100).toFixed(1);
      const distLabel = o.distFromSpotPct >= 0 ? `+${dist}%` : `${dist}%`;
      return (
        `  · $${o.strike} ${o.type === "call" ? "C" : "P"} ${o.expiry} (D-${o.daysToExpiry}, ` +
        `${distLabel} from spot) · vol=${o.volume.toLocaleString()} ` +
        `(${o.volRatio.toFixed(1)}× median) · ` +
        `mid=$${o.midPrice.toFixed(2)} · notional=${fmtUsd(o.notionalUsd)}`
      );
    };
    const sigCalls = optionsCtx.topCalls.filter((o) => o.notionalUsd >= 100_000);
    const sigPuts = optionsCtx.topPuts.filter((o) => o.notionalUsd >= 100_000);
    if (sigCalls.length > 0 || sigPuts.length > 0) {
      lines.push("- 비정상 옵션 거래량 (notional ≥ $100K, 가장 가까운 만기):");
      if (sigCalls.length > 0) {
        lines.push(`  📈 콜 top ${sigCalls.length}:`);
        sigCalls.forEach((o) => lines.push(fmtUnusual(o)));
      }
      if (sigPuts.length > 0) {
        lines.push(`  📉 풋 top ${sigPuts.length}:`);
        sigPuts.forEach((o) => lines.push(fmtUnusual(o)));
      }
    }
    sections.push(lines.join("\n"));
  }

  // 8) Earnings + analyst (Finnhub)
  if (finnhub) {
    const lines: string[] = ["## 8) 어닝 + 애널리스트 컨센서스"];
    if (finnhub.nextEarnings) {
      lines.push(`- 다음 어닝: ${finnhub.nextEarnings.date} (D-${finnhub.nextEarnings.daysUntil}, ${finnhub.nextEarnings.hour || "시간 미정"}, EPS 추정 ${num(finnhub.nextEarnings.estimate, 2)})`);
    }
    if (finnhub.recentSurprises.length > 0) {
      lines.push("- 최근 4분기 어닝 (실적 vs 추정 vs 서프라이즈%):");
      for (const s of finnhub.recentSurprises) {
        lines.push(`  · ${s.period}: ${num(s.actual, 2)} vs ${num(s.estimate, 2)} (${pct((s.surprisePct ?? 0) / 100)})`);
      }
    }
    if (finnhub.consensus) {
      const c = finnhub.consensus;
      const total = c.strongBuy + c.buy + c.hold + c.sell + c.strongSell;
      lines.push(`- 애널리스트 ${total}명 (${c.period}): SB=${c.strongBuy} B=${c.buy} H=${c.hold} S=${c.sell} SS=${c.strongSell}`);
    }
    if (finnhub.priceTarget) {
      const t = finnhub.priceTarget;
      lines.push(`- 가격 목표: 평균 ${num(t.targetMean)} (고 ${num(t.targetHigh)} / 저 ${num(t.targetLow)}, 분석가 ${t.numberOfAnalysts ?? "?"}명)`);
    }
    if (lines.length > 1) sections.push(lines.join("\n"));
  }

  // 8.5) Short interest + float (Finnhub metrics) — squeeze setup detection.
  // Small float + high short% + low days-to-cover = short squeeze candidate.
  // Large float + low short% = no squeeze risk regardless of how bullish news.
  if (finnhub?.metrics) {
    const m = finnhub.metrics;
    const fmtShares = (n: number | null): string => {
      if (n == null) return "?";
      if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
      if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
      if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
      return `${n}`;
    };
    const lines: string[] = ["## 8.5) Float + 공매도 (squeeze 후보 평가)"];
    if (m.floatShares != null) {
      const floatRatio =
        m.sharesOutstanding != null && m.sharesOutstanding > 0
          ? ` (Outstanding ${fmtShares(m.sharesOutstanding)}의 ${((m.floatShares / m.sharesOutstanding) * 100).toFixed(0)}%)`
          : "";
      lines.push(`- Float: ${fmtShares(m.floatShares)}주${floatRatio}`);
    } else if (m.sharesOutstanding != null) {
      lines.push(`- Outstanding: ${fmtShares(m.sharesOutstanding)}주 (Float 미보고)`);
    }
    if (m.shortInterest != null) {
      const sof =
        m.shortPercentOfFloat != null
          ? ` (Float의 ${(m.shortPercentOfFloat * 100).toFixed(1)}%)`
          : "";
      lines.push(`- Short Interest: ${fmtShares(m.shortInterest)}주${sof}`);
    }
    if (m.daysToCover != null) {
      lines.push(`- Days-to-Cover: ${m.daysToCover.toFixed(1)}일 (= short / 평균 일거래량)`);
    }
    if (lines.length > 1) sections.push(lines.join("\n"));
  }

  // 9) SEC 8-K
  if (secFilings.length > 0) {
    sections.push([
      "## 9) 최근 SEC 8-K 공시 (중대 사건)",
      ...secFilings.slice(0, 5).map((f) => `- ${f.filedAt}: ${f.description}`),
    ].join("\n"));
  }

  // 10) Corporate actions
  if (corpActions.length > 0) {
    sections.push([
      "## 10) 기업 행동 (배당·분할·어닝 일정 — 최근/예정)",
      ...corpActions.slice(0, 8).map((a) => `- ${a.date} [${a.type}] ${a.description.slice(0, 120)}`),
    ].join("\n"));
  }

  // 10.5) Insider transactions (SEC Form 4) — strongest "smart money" signal
  // available. CEO/CFO open-market purchases especially. Filtered to P/S
  // codes only (no awards / option exercises / gifts).
  if (insider && insider.transactions.length > 0) {
    const fmtUsd = (v: number): string => {
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
      if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
      return `$${v.toFixed(0)}`;
    };
    const netLabel = insider.netUsd >= 0 ? "순매수" : "순매도";
    const lines = [
      `## 10.5) 인사이더 거래 (SEC Form 4, 지난 ${insider.windowDays}일)`,
      `- 총 거래 ${insider.transactions.length}건 · 인사이더 ${insider.uniqueInsiders}명`,
      `- 매수 ${fmtUsd(insider.totalBoughtUsd)} / 매도 ${fmtUsd(insider.totalSoldUsd)} → ${netLabel} ${fmtUsd(Math.abs(insider.netUsd))}`,
      "- 최근 거래 (오픈마켓 P/S만, 옵션 행사·award·gift 제외):",
      ...insider.transactions.slice(0, 8).map((t) => {
        const role = t.role || (t.isTenPercentOwner ? "10% Owner" : "");
        const arrow = t.action === "buy" ? "🟢 BUY" : "🔴 SELL";
        return `  · ${t.tradedAt} [${arrow}] ${t.insiderName}${role ? ` (${role})` : ""} — ${t.shares.toLocaleString()}주 @ $${t.pricePerShare.toFixed(2)} = ${fmtUsd(t.notionalUsd)}`;
      }),
    ];
    sections.push(lines.join("\n"));
  }

  // 11) Own signals
  if (ownSignals && ownSignals.total > 0) {
    const t = ownSignals.byType;
    const lines = [
      "## 11) 자체 시그널 트래커 (지난 30일, 본인 운영 중)",
      `- 총 ${ownSignals.total}건: gap_up ${t.gap_up ?? 0} / gap_down ${t.gap_down ?? 0} / volume_spike ${t.volume_spike ?? 0}`,
      `- 백테스트 평균 기대수익 (analogue prior): 1d=${pct(ownSignals.meanExpected1d)} · 3d=${pct(ownSignals.meanExpected3d)} · 5d=${pct(ownSignals.meanExpected5d)}`,
    ];
    // Realized returns (actual measurement) — only present for signals ≥7 days old.
    // This is the truth signal; weight it more than the analogue priors.
    if (ownSignals.realizedSampleSize > 0) {
      const wr = ownSignals.winRate1d;
      lines.push(
        `- 실제 측정 결과 (n=${ownSignals.realizedSampleSize}): 1일 승률 ${
          wr != null ? `${(wr * 100).toFixed(0)}%` : "?"
        } · 평균 1d=${pct(ownSignals.meanRealized1d)} · 3d=${pct(ownSignals.meanRealized3d)} · 5d=${pct(ownSignals.meanRealized5d)}`,
      );
    } else {
      lines.push("- 실제 측정 결과: 아직 측정 가능한 시그널 없음 (모두 7일 미만)");
    }
    lines.push(
      ...ownSignals.recent
        .slice(0, 5)
        .map((s) => {
          const newsTag =
            s.recent_news_count == null
              ? ""
              : s.recent_news_count > 0
                ? ` 📰×${s.recent_news_count}`
                : " 📭";
          return `  · ${s.ts.slice(0, 16)} ${s.signal_type} ${pct(s.pct_change)} vol×${s.volume_ratio.toFixed(1)} (${s.session})${newsTag}${
            s.realized_1d != null ? ` → 실제 1d=${pct(s.realized_1d)}` : ""
          }`;
        }),
    );
    sections.push(lines.join("\n"));
  }

  // 12) Watchlist context
  if (Object.keys(watchSnaps).length > 0) {
    const lines = Object.values(watchSnaps).map((s) => snapLine(s.symbol, s));
    sections.push([
      "## 12) 본인 관심종목 현황 (포트폴리오 컨텍스트)",
      lines.join(" · "),
    ].join("\n"));
  }

  // 13) Premium financial news (ticker-specific)
  if (tickerHeadlines.length > 0) {
    sections.push([
      `## 13) ${symbol} 관련 프리미엄 매체 헤드라인 (Reuters/Bloomberg/CNBC/WSJ/FT/MarketWatch)`,
      ...tickerHeadlines.slice(0, 12).map((h, i) => `${i + 1}. [${h.source}] ${h.headline} (${h.publishedAt.slice(0, 10)})`),
    ].join("\n"));
  }

  // 14) Alpaca news
  if (alpacaNews.length > 0) {
    sections.push([
      `## 14) Alpaca 뉴스 (총 ${alpacaNews.length}건)`,
      ...alpacaNews.slice(0, 15).map((n, i) =>
        `${i + 1}. [${n.source}] ${n.headline}${n.summary ? ` — ${n.summary.slice(0, 160)}` : ""} (${n.createdAt.slice(0, 10)})`,
      ),
    ].join("\n"));
  }

  // 15) Macro / global news
  if (macroHeadlines.length > 0) {
    sections.push([
      "## 15) 매크로·글로벌 헤드라인 (Reuters/Bloomberg/CNBC/WSJ/FT)",
      ...macroHeadlines.slice(0, 15).map((h, i) => `${i + 1}. [${h.source}] ${h.headline} (${h.publishedAt.slice(0, 10)})`),
    ].join("\n"));
  }

  sections.push([
    "## 분석 지침",
    "",
    "### 다중 시계 분석 — 4개 시간 프레임 모두 분석",
    "**중요: 단타·중기·장기 시계마다 verdict가 다를 수 있음. 각각 독립적으로 판단.**",
    "",
    "1. **단타 (top-level verdict/summary/bull_points/bear_points)** — 1일 ~ 1주",
    "   - 5분봉·당일 OHLC·옵션 IV/PCR·당일 매크로 뉴스 가중",
    "   - 어닝 D-3 이내면 베팅 위험 명시",
    "",
    "2. **horizons.three_month** — 3개월",
    "   - 일봉 추세·SMA50·다음 어닝 결과 예측·현 매크로 사이클 (금리 기조)",
    "   - 다음 어닝이 이 기간에 포함되면 어닝 surprise 가능성 평가",
    "",
    "3. **horizons.six_month** — 6개월",
    "   - SMA200·52주 거리·섹터 사이클·연준 정책 방향성",
    "   - 매크로 헤드라인(트럼프 정책·관세·전쟁)의 6개월 영향 평가",
    "",
    "4. **horizons.one_year** — 1년",
    "   - 펀더멘털·애널리스트 컨센서스·가격 목표·산업 구조 변화",
    "   - 단기 노이즈 무시하고 1년 내 랠리/조정 가능성을 판단",
    "",
    "### 공통 규칙",
    "- 모든 verdict는 'buy' | 'hold' | 'sell' 중 하나",
    "- summary / key_points는 한국어. 수치·출처 인용 (예: 'Reuters에 따르면', 'RSI 72로 과매수').",
    "- bull_points / bear_points는 단타용 (각 2-4개)",
    "- 각 horizon의 key_points는 2-3개씩",
    "- 매크로 뉴스(트럼프·전쟁·금리)와 종목 뉴스 충돌 시 시계가 길수록 매크로 가중 ↑",
    "- §10.5 인사이더 거래는 **smart money 직접 신호**. CEO/CFO/CFO/Director의 BUY는 강한 강세 (자기 돈으로 매수 = 가장 정직한 conviction); SELL은 mixed (분산투자·세금·10b5-1 plan일 수도). 순매수 > $1M = 3개월 horizon에 강한 강세 가중. 순매도 > $5M + 10% Owner 매도 = 약세 가중. award/option exercise는 이미 §10.5에서 제외된 상태",
    "- §7 비정상 옵션 거래량은 **단기 (1-7일) 방향성 시그널**. 큰 notional ($1M+) 콜 매수가 OTM (+5% 이상)에 몰리면 = 강세 베팅 / 풋 OTM (-5% 이하)에 몰리면 = 약세 또는 헤지. volRatio 5×+ 는 명확한 outlier. DTE < 14일이면 catalyst (어닝·공시) 기대 신호. 단, 단일 strike 한 줄로 강한 결론 X — 콜·풋 양쪽 패턴 합쳐 판단",
    "- §8.5 Float + 공매도는 squeeze setup 평가용. Float < 50M주 + Short% > 20% + Days-to-Cover > 5일 = 강한 squeeze 후보 (어닝/뉴스 catalyst 시 폭발적). Float > 1B + Short% < 5% = squeeze 위험 거의 없음 (대형주 보통 케이스). 약세 가설일 때도 short% 매우 높으면 short squeeze risk로 신중함 명시",
    "- 본인 시그널 트래커는 단타에 인용. 특히 §11의 '실제 측정 결과' (realized)는 **truth signal**, 'analogue prior' (expected)보다 가중 ↑. 둘이 크게 차이 나면 (e.g. expected +1% but realized -0.5%) → 시그널 약함을 명시할 것",
    "- §11 시그널 행 끝의 📰×N = 시그널 발동 ±30분 내 뉴스 N건 / 📭 = 뉴스 없음 (catalyst 없는 갭은 노이즈일 확률 높음). 📭 시그널 비중 높으면 시그널 자체 신뢰도 ↓로 평가",
    "- confidence: 0.5 미만은 hold, 0.7 이상은 다중 근거가 일치할 때만",
    "- JSON 스키마에 정확히 맞춰 응답",
  ].join("\n"));

  return sections.join("\n\n");
}

// ─── sizing logic (unchanged from previous) ────────────────────────────────

function computeSizing(
  verdict: string,
  confidence: number,
  pos: PositionInput | undefined,
): {
  action: "buy" | "hold" | "sell";
  weight: number;
  amount_krw: number;
  rationale: string;
} {
  const w = Math.round(confidence * 100) / 100;
  let amount = 0;
  let rationale = "";

  if (!pos || (!pos.total_budget_krw && !pos.dca_per_day_krw)) {
    return {
      action: verdict as "buy" | "hold" | "sell",
      weight: 0,
      amount_krw: 0,
      rationale: "포지션 설정이 없어 권장 금액을 계산할 수 없음.",
    };
  }

  if (verdict === "buy") {
    if (pos.strategy === "lump_sum" && pos.total_budget_krw) {
      amount = Math.round(pos.total_budget_krw * w);
      rationale = `거치식 예산 ${pos.total_budget_krw.toLocaleString()}원의 ${(w * 100).toFixed(0)}% (신뢰도 ${(confidence * 100).toFixed(0)}%) 즉시 매수 권장.`;
    } else if (pos.strategy === "dca" && pos.dca_per_day_krw) {
      const mult = Math.min(1 + w * 2, 3);
      amount = Math.round(pos.dca_per_day_krw * mult);
      rationale = `DCA 일 ${pos.dca_per_day_krw.toLocaleString()}원 × ${mult.toFixed(2)}배 (강세 가중) 매수 권장.`;
    }
  } else if (verdict === "hold") {
    if (pos.strategy === "dca" && pos.dca_per_day_krw) {
      amount = pos.dca_per_day_krw;
      rationale = `관망 구간 — DCA 평소 슬라이스 ${pos.dca_per_day_krw.toLocaleString()}원만 유지.`;
    } else {
      amount = 0;
      rationale = "관망 — 거치식은 신호가 약해 진입 보류.";
    }
  } else if (verdict === "sell") {
    if (pos.strategy === "lump_sum" && pos.total_budget_krw) {
      amount = Math.round(pos.total_budget_krw * w);
      rationale = `매도 신호 — 보유 포지션 중 ${(w * 100).toFixed(0)}% 익절/손절 권장.`;
    } else if (pos.strategy === "dca" && pos.dca_per_day_krw) {
      amount = 0;
      rationale = `매도 신호 — 오늘 DCA 매수 0원, 기존 보유분 점진 매도 검토.`;
    }
  }

  return {
    action: verdict as "buy" | "hold" | "sell",
    weight: w,
    amount_krw: amount,
    rationale,
  };
}
