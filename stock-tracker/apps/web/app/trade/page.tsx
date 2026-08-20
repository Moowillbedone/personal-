"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BulkTradeEntry from "@/app/stats/BulkTradeEntry";

interface SearchHit {
  symbol: string;
  name: string | null;
  exchange: string | null;
}

interface Snapshot {
  symbol: string;
  lastPrice: number | null;
  lastTradeTs: string | null;
  session: "pre" | "regular" | "after" | "closed";
  prevClose: number | null;
  todayOpen: number | null;
  todayHigh: number | null;
  todayLow: number | null;
  todayClose: number | null;
  todayVolume: number | null;
  changePct: number | null;
  // Provenance of lastPrice:
  //   'iex'     = Alpaca free IEX (real-time regular, stale extended hours)
  //   'finnhub' = Finnhub /quote (primary fallback during extended hours)
  //   'yahoo'   = Yahoo v8 chart (secondary fallback)
  // Outside regular session, 'iex' means both Finnhub AND Yahoo failed —
  // that's the only case where the stale badge should fire.
  priceSource?: "iex" | "finnhub" | "yahoo";
  error?: string;
}

/**
 * True when the price shown is unexpectedly stale — i.e. we're inside
 * an active extended-hours window (pre or after) but neither Finnhub
 * nor Yahoo could deliver a fresh extended-hours price, so we're falling
 * back to the prior regular close. Closed session is intentionally
 * excluded: during overnight/weekend there are no trades by definition,
 * so the regular close IS the right answer and a "stale" badge would
 * mislead.
 */
function isStalePrice(s: Snapshot | undefined): boolean {
  if (!s) return false;
  if (s.session !== "pre" && s.session !== "after") return false;
  // priceSource undefined on legacy responses = treat as 'iex' (stale).
  return s.priceSource !== "yahoo" && s.priceSource !== "finnhub";
}

interface WatchlistItem {
  symbol: string;
  added_at: string;
  sort_order: number;
}

interface HorizonOpinion {
  verdict: "buy" | "hold" | "sell";
  confidence: number;
  summary: string;
  key_points: string[];
}

interface AiAnalysis {
  id: string;
  symbol: string;
  verdict: "buy" | "hold" | "sell";
  confidence: number;
  summary: string;
  bull_points: string[];
  bear_points: string[];
  horizons: {
    three_month?: HorizonOpinion;
    six_month?: HorizonOpinion;
    one_year?: HorizonOpinion;
  } | null;
  context: Record<string, unknown>;
  model: string;
  created_at: string;
}

interface NewsItem {
  // Alpaca news has numeric id; premium-outlet headlines (Reuters/Bloomberg/...) don't.
  id?: number;
  headline: string;
  summary?: string;
  source: string;
  url: string;
  createdAt: string;
}

interface Sizing {
  action: "buy" | "hold" | "sell";
  weight: number;
  amount_krw: number;
  rationale: string;
}

interface AnalyzeResponse {
  cached: boolean;
  analysis: AiAnalysis;
  snapshot: Snapshot | null;
  news: NewsItem[];
  sources_used?: Record<string, number>;
  sizing: Sizing;
  // Set when Gemini was unavailable and the server fell back to the most
  // recent stored analysis (opt-in via allowStale).
  stale?: boolean;
  stale_reason?: string;
  stale_age_hours?: number;
}

interface PositionSetting {
  symbol: string;
  strategy: "lump_sum" | "dca";
  total_budget_krw: number | null;
  dca_per_day_krw: number | null;
  dca_total_days: number | null;
}

interface Trade {
  id: string;
  symbol: string;
  action: "buy" | "sell";
  qty: number;
  price: number;
  mode: "paper" | "real";
  ts: string;
  notes: string | null;
  ai_analysis_id: string | null;
  /** Set when this trade is on a derivative (e.g. TSLL) of an analyzed
   *  underlying (TSLA). Null when trading the underlying directly. */
  underlying_symbol: string | null;
}

interface PositionDerived {
  symbol: string;
  mode: "paper" | "real";
  openQty: number;
  avgBuyPrice: number | null;
  costBasisOpen: number;
  realizedPnl: number;
  totalBuyQty: number;
  totalSellQty: number;
  tradeCount: number;
}

const SESSION_LABEL: Record<Snapshot["session"], string> = {
  pre: "프리마켓",
  regular: "정규장",
  after: "애프터마켓",
  closed: "장마감",
};

const VERDICT_STYLE: Record<AiAnalysis["verdict"], string> = {
  buy: "bg-emerald-900/40 text-emerald-200 border-emerald-700",
  hold: "bg-amber-900/40 text-amber-200 border-amber-700",
  sell: "bg-rose-900/40 text-rose-200 border-rose-700",
};

const VERDICT_LABEL: Record<AiAnalysis["verdict"], string> = {
  buy: "매수",
  hold: "관망",
  sell: "매도",
};

function fmtPct(v: number | null) {
  if (v == null) return "—";
  const s = (v * 100).toFixed(2);
  return `${v >= 0 ? "+" : ""}${s}%`;
}
function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}
function fmtKRW(n: number) {
  return `${Math.round(n).toLocaleString()}원`;
}

/** "1000000" → "1,000,000". Empty string passes through. */
function formatThousands(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString();
}

/** Strip everything but digits — used so user can type/paste "1,000,000" or "1000000". */
function stripNonDigits(s: string): string {
  return s.replace(/[^0-9]/g, "");
}

/** Color-code news source badges so premium outlets visually stand out. */
function sourceBadgeClass(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("reuters")) return "bg-orange-900/40 text-orange-300 border-orange-700";
  if (s.includes("bloomberg")) return "bg-fuchsia-900/40 text-fuchsia-300 border-fuchsia-700";
  if (s.includes("cnbc")) return "bg-red-900/40 text-red-300 border-red-700";
  if (s.includes("wsj") || s.includes("wall street")) return "bg-amber-900/40 text-amber-300 border-amber-700";
  if (s.includes("ft") || s.includes("financial times")) return "bg-pink-900/40 text-pink-300 border-pink-700";
  if (s.includes("marketwatch")) return "bg-indigo-900/40 text-indigo-300 border-indigo-700";
  if (s.includes("benzinga")) return "bg-emerald-900/40 text-emerald-300 border-emerald-700";
  if (s.includes("zacks")) return "bg-teal-900/40 text-teal-300 border-teal-700";
  if (s.includes("seeking")) return "bg-cyan-900/40 text-cyan-300 border-cyan-700";
  return "bg-neutral-800/60 text-neutral-300 border-neutral-700";
}

export default function TradePage() {
  // search
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  // watchlist
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsUpdatedAt, setSnapshotsUpdatedAt] = useState<Date | null>(null);

  // selection
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSnap, setSelectedSnap] = useState<Snapshot | null>(null);
  // Bumped after a bulk-trade insert to force the journal panel to reload
  // (it keys off this) and to refresh watchlist snapshots.
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  // Deep-link from the ticker detail page: /trade?symbol=AAPL pre-selects
  // AAPL on mount. The user goes "signal interesting → ticker page → one
  // click → trade page with that symbol loaded → click 분석".
  //
  // We read window.location.search directly inside a client-only useEffect
  // rather than via Next.js useSearchParams() — useSearchParams forces the
  // page out of static generation and triggers a "missing Suspense
  // boundary" build error, since the trade page is a single huge client
  // component. Direct window access only runs after hydration, so SSR
  // safety is preserved and there's nothing to pre-render here anyway.
  const initialSelectionApplied = useRef(false);
  useEffect(() => {
    if (initialSelectionApplied.current) return;
    initialSelectionApplied.current = true;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sym = params.get("symbol")?.trim().toUpperCase();
    if (sym && /^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym)) {
      setSelected(sym);
    }
  }, []);

  // analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  // Latest cached verdict shown as a banner above the analyze button
  // BEFORE user runs a fresh analysis. Pulled from ai_analysis history
  // (no Gemini call), so the user immediately sees "AI said BUY 3h ago"
  // without spending a fresh quota point.
  const [cachedVerdict, setCachedVerdict] = useState<AiAnalysis | null>(null);

  // 눌림목 분석 (pullback vs downtrend)
  const [pbLoading, setPbLoading] = useState(false);
  const [pbError, setPbError] = useState<string | null>(null);
  const [pbResult, setPbResult] = useState<PullbackResponse | null>(null);

  // position settings
  const [position, setPosition] = useState<PositionSetting | null>(null);
  const [posStrategy, setPosStrategy] = useState<"lump_sum" | "dca">("dca");
  const [posLumpKrw, setPosLumpKrw] = useState<string>("");
  const [posDcaPerDay, setPosDcaPerDay] = useState<string>("1000000");
  const [posDcaDays, setPosDcaDays] = useState<string>("30");

  // ── search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setHits([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = (await r.json()) as { results?: SearchHit[] };
        setHits(data.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  // ── load watchlist
  const loadWatchlist = useCallback(async () => {
    const r = await fetch("/api/watchlist");
    const data = (await r.json()) as { items?: WatchlistItem[] };
    setWatchlist(data.items ?? []);
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  // ── load snapshots for watchlist + selection.
  // No auto-polling: pre/after sessions hit Yahoo per symbol, and 20+
  // tickers polling every 60s would get the Vercel IP rate-limited fast.
  // User refreshes manually via the ↻ button in the watchlist header.
  // Auto-load still runs once on mount and whenever the watchlist or
  // selection changes (those are user-initiated actions).
  const loadSnapshots = useCallback(async () => {
    const symbols = new Set(watchlist.map((w) => w.symbol));
    if (selected) symbols.add(selected);
    if (symbols.size === 0) return;
    setSnapshotsLoading(true);
    try {
      const list = Array.from(symbols).join(",");
      const r = await fetch(`/api/snapshot?symbols=${encodeURIComponent(list)}`);
      const data = (await r.json()) as { snapshots?: Snapshot[] };
      const map: Record<string, Snapshot> = {};
      for (const s of data.snapshots ?? []) map[s.symbol] = s;
      setSnapshots(map);
      if (selected && map[selected]) setSelectedSnap(map[selected]);
      setSnapshotsUpdatedAt(new Date());
    } finally {
      setSnapshotsLoading(false);
    }
  }, [watchlist, selected]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // ── load position settings + cached verdict when selection changes
  useEffect(() => {
    if (!selected) {
      setPosition(null);
      setCachedVerdict(null);
      return;
    }
    setResult(null);
    setAnalysisError(null);
    setCachedVerdict(null);
    setPbResult(null);
    setPbError(null);
    (async () => {
      const r = await fetch(`/api/positions?symbol=${encodeURIComponent(selected)}`);
      const data = (await r.json()) as { setting?: PositionSetting | null };
      setPosition(data.setting ?? null);
      if (data.setting) {
        setPosStrategy(data.setting.strategy);
        setPosLumpKrw(data.setting.total_budget_krw?.toString() ?? "");
        setPosDcaPerDay(data.setting.dca_per_day_krw?.toString() ?? "1000000");
        setPosDcaDays(data.setting.dca_total_days?.toString() ?? "30");
      }
    })();
    // Fetch the latest cached verdict (within 24h) — pure DB lookup, no
    // Gemini cost. Surfaces "AI already said X" so user doesn't burn quota
    // re-analyzing what's still fresh.
    (async () => {
      try {
        const r = await fetch(
          `/api/analyze/latest?symbol=${encodeURIComponent(selected)}&maxAgeHours=24`,
        );
        const d = (await r.json()) as { analysis?: AiAnalysis | null };
        if (d.analysis) setCachedVerdict(d.analysis);
      } catch {
        // ignore — banner just stays hidden
      }
    })();
  }, [selected]);

  async function addToWatchlist(symbol: string) {
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    await loadWatchlist();
  }

  async function removeFromWatchlist(symbol: string) {
    await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
    await loadWatchlist();
  }

  async function savePosition() {
    if (!selected) return;
    const body: Record<string, unknown> = { symbol: selected, strategy: posStrategy };
    if (posStrategy === "lump_sum") {
      body.total_budget_krw = posLumpKrw ? Number(posLumpKrw) : null;
    } else {
      body.dca_per_day_krw = posDcaPerDay ? Number(posDcaPerDay) : null;
      body.dca_total_days = posDcaDays ? Number(posDcaDays) : null;
    }
    await fetch("/api/positions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const r = await fetch(`/api/positions?symbol=${encodeURIComponent(selected)}`);
    const data = (await r.json()) as { setting?: PositionSetting | null };
    setPosition(data.setting ?? null);
  }

  async function analyze() {
    if (!selected) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const positionPayload =
        posStrategy === "lump_sum"
          ? { strategy: posStrategy, total_budget_krw: posLumpKrw ? Number(posLumpKrw) : null }
          : {
              strategy: posStrategy,
              dca_per_day_krw: posDcaPerDay ? Number(posDcaPerDay) : null,
              dca_total_days: posDcaDays ? Number(posDcaDays) : null,
            };
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: selected, position: positionPayload, allowStale: true }),
      });
      // The analyze route can return non-JSON in two cases: a Vercel function
      // timeout/crash (plain "An error occurred…" text → "Unexpected token 'A'"
      // when blindly .json()'d) or an upstream 5xx HTML page. Read as text first
      // and parse defensively so the user gets a readable message instead of a
      // raw JSON-parse error, and the app never throws on a slow analysis.
      const raw = await r.text();
      let data: AnalyzeResponse | { error: string } | null = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!data) {
        setAnalysisError(
          r.status === 504 || r.status === 408
            ? "분석이 시간 내(약 30~60초) 완료되지 못했습니다. 잠시 후 다시 시도해 주세요."
            : `분석 서버 오류 (HTTP ${r.status}). 잠시 후 다시 시도해 주세요.`,
        );
      } else if ("error" in data) {
        setAnalysisError(data.error);
      } else {
        setResult(data);
        if (data.snapshot) setSelectedSnap(data.snapshot);
      }
    } catch (err) {
      // Network-level failure or client-side abort.
      setAnalysisError(
        `분석 요청이 실패했습니다: ${(err as Error).message}. 네트워크를 확인하고 다시 시도해 주세요.`,
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function runPullback() {
    if (!selected) return;
    setPbLoading(true);
    setPbError(null);
    try {
      const r = await fetch("/api/pullback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol: selected }),
      });
      const raw = await r.text();
      let data: PullbackResponse | { error: string } | null = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!data) {
        setPbError(
          r.status === 504 || r.status === 408
            ? "눌림목 분석이 시간 내(약 30~60초) 완료되지 못했습니다. 잠시 후 다시 시도해 주세요."
            : `분석 서버 오류 (HTTP ${r.status}). 잠시 후 다시 시도해 주세요.`,
        );
      } else if ("error" in data) {
        setPbError(data.error);
      } else {
        setPbResult(data);
      }
    } catch (err) {
      setPbError(`요청이 실패했습니다: ${(err as Error).message}.`);
    } finally {
      setPbLoading(false);
    }
  }

  const isInWatchlist = useMemo(
    () => (selected ? watchlist.some((w) => w.symbol === selected) : false),
    [selected, watchlist],
  );

  // Direct-ticker selection: let the user pick a ticker that isn't in the
  // `assets` search index yet (brand-new listings like SPCX on IPO day lag
  // the daily sync). The snapshot/analyze/bars APIs work for any valid
  // ticker regardless of the index, so this never blocks a real symbol.
  function selectTicker(sym: string) {
    setSelected(sym);
    setQuery("");
    setHits([]);
  }
  const directSym = query.trim().toUpperCase();
  const directValid = /^[A-Z][A-Z0-9.\-]{0,9}$/.test(directSym);
  const showDirect = directValid && !hits.some((h) => h.symbol === directSym);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Global market clock — shows the user the current US session in their local time. */}
      <MarketClock />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      {/* LEFT: search + watchlist */}
      <aside className="space-y-4">
        <section>
          <h2 className="text-xs uppercase text-neutral-400 mb-2">티커 검색</h2>
          <input
            type="text"
            placeholder="AAPL, SPCX, microsoft, ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter selects the typed ticker directly (works even if the
              // search index hasn't caught up to a new listing).
              if (e.key === "Enter" && directValid) selectTicker(directSym);
            }}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-sky-600"
          />
          {searching && <p className="text-xs text-neutral-500 mt-1">검색 중…</p>}
          {showDirect && (
            <button
              onClick={() => selectTicker(directSym)}
              className="mt-2 w-full text-left px-3 py-2 border border-sky-800 rounded bg-sky-950/40 hover:bg-sky-900/50 text-sm"
              title="검색 목록에 없어도 티커를 직접 선택해 분석/기록"
            >
              <span className="font-semibold text-sky-300">「{directSym}」</span>
              <span className="text-neutral-400"> 직접 선택 → (Enter) · 목록에 없어도 분석·기록 가능</span>
            </button>
          )}
          {hits.length > 0 && (
            <ul className="mt-2 border border-neutral-800 rounded divide-y divide-neutral-800 max-h-72 overflow-auto">
              {hits.map((h) => (
                <li
                  key={h.symbol}
                  className="px-3 py-2 hover:bg-neutral-900 cursor-pointer flex items-center justify-between"
                  onClick={() => {
                    setSelected(h.symbol);
                    setQuery("");
                    setHits([]);
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold text-sky-300">{h.symbol}</div>
                    <div className="text-xs text-neutral-500 truncate max-w-[240px]">
                      {h.name ?? "—"} · {h.exchange ?? "—"}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addToWatchlist(h.symbol);
                    }}
                    className="text-xs px-2 py-1 border border-neutral-700 rounded hover:border-amber-500 hover:text-amber-300"
                    title="즐겨찾기 추가"
                  >
                    ★
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2 gap-2">
            <h2 className="text-xs uppercase text-neutral-400">
              즐겨찾기{" "}
              <span className="text-neutral-500 normal-case">
                ({watchlist.length})
              </span>
            </h2>
            <div className="flex items-center gap-2">
              {snapshotsUpdatedAt && (
                <RelativeTime
                  ts={snapshotsUpdatedAt}
                  className="text-[10px] text-neutral-500"
                />
              )}
              <button
                onClick={loadSnapshots}
                disabled={snapshotsLoading || watchlist.length === 0}
                className="text-xs px-2 py-1 border border-neutral-700 rounded hover:border-sky-500 hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed"
                title="시세 새로고침 (Yahoo 익스텐디드 호가)"
              >
                {snapshotsLoading ? "⟳" : "↻"} 새로고침
              </button>
            </div>
          </div>
          {watchlist.length === 0 ? (
            <p className="text-xs text-neutral-500">즐겨찾기 없음. 검색해서 ★ 버튼으로 추가.</p>
          ) : (
            <ul className="border border-neutral-800 rounded divide-y divide-neutral-800">
              {watchlist.map((w) => {
                const s = snapshots[w.symbol];
                return (
                  <li
                    key={w.symbol}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between ${
                      selected === w.symbol ? "bg-neutral-900" : "hover:bg-neutral-900/60"
                    }`}
                    onClick={() => setSelected(w.symbol)}
                  >
                    <div>
                      <div className="text-sm font-semibold text-sky-300">{w.symbol}</div>
                      <div className="text-xs text-neutral-500 flex items-center gap-1">
                        <span>{s ? SESSION_LABEL[s.session] : "—"}</span>
                        {isStalePrice(s) && (
                          <span
                            className="px-1 py-px text-[9px] border border-amber-700 bg-amber-950/40 text-amber-300 rounded leading-none"
                            title="익스텐디드(Yahoo) 데이터 가져오기 실패 — 표시된 가격은 직전 정규장 종가입니다."
                          >
                            ⚠ stale
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{fmtMoney(s?.lastPrice ?? null)}</div>
                      <div
                        className={`text-xs ${
                          s?.changePct == null
                            ? "text-neutral-500"
                            : s.changePct >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                        }`}
                      >
                        {fmtPct(s?.changePct ?? null)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWatchlist(w.symbol);
                      }}
                      className="ml-2 text-xs text-neutral-600 hover:text-rose-400"
                      title="제거"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>

      {/* RIGHT: detail */}
      <section>
        {!selected ? (
          <div className="border border-dashed border-neutral-800 rounded-lg p-12 text-center text-neutral-500">
            왼쪽에서 검색하거나 즐겨찾기에서 종목을 선택하세요.
          </div>
        ) : (
          <>
            {/* price header */}
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{selected}</h1>
                <p className="text-xs text-neutral-500 mt-1">
                  {selectedSnap ? SESSION_LABEL[selectedSnap.session] : "—"}
                  {selectedSnap?.lastTradeTs && (
                    <> · 최근 체결 {new Date(selectedSnap.lastTradeTs).toLocaleString()}</>
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold">
                  {fmtMoney(selectedSnap?.lastPrice ?? null)}
                </div>
                <div
                  className={`text-sm ${
                    selectedSnap?.changePct == null
                      ? "text-neutral-500"
                      : selectedSnap.changePct >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                  }`}
                >
                  {fmtPct(selectedSnap?.changePct ?? null)} (전일 종가 대비)
                </div>
              </div>
              <button
                onClick={() =>
                  isInWatchlist
                    ? removeFromWatchlist(selected)
                    : addToWatchlist(selected)
                }
                className={`px-3 py-1.5 text-sm rounded border ${
                  isInWatchlist
                    ? "border-amber-500 text-amber-300"
                    : "border-neutral-700 text-neutral-300 hover:border-amber-500 hover:text-amber-300"
                }`}
              >
                {isInWatchlist ? "★ 즐겨찾기 해제" : "☆ 즐겨찾기"}
              </button>
            </div>

            {/* AI verdict banner — shows the most recent AI call (within 24h)
                without spending a fresh quota point. Hidden once the user
                runs a new analysis (then `result` takes over below). */}
            {!result && cachedVerdict && (
              <VerdictBanner verdict={cachedVerdict} />
            )}

            {/* OHLC + sessions */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6 text-xs">
              <Stat label="전일 종가" value={fmtMoney(selectedSnap?.prevClose ?? null)} />
              <Stat label="시가" value={fmtMoney(selectedSnap?.todayOpen ?? null)} />
              <Stat label="고가" value={fmtMoney(selectedSnap?.todayHigh ?? null)} />
              <Stat label="저가" value={fmtMoney(selectedSnap?.todayLow ?? null)} />
              <Stat
                label="거래량"
                value={selectedSnap?.todayVolume?.toLocaleString() ?? "—"}
              />
            </div>

            {/* Position settings */}
            <div className="border border-neutral-800 rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">포지션 설정</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={posStrategy === "lump_sum"}
                    onChange={() => setPosStrategy("lump_sum")}
                  />
                  거치식
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={posStrategy === "dca"}
                    onChange={() => setPosStrategy("dca")}
                  />
                  DCA
                </label>
              </div>
              {posStrategy === "lump_sum" ? (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <span className="text-neutral-500">총 예산 (KRW):</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatThousands(posLumpKrw)}
                      onChange={(e) => setPosLumpKrw(stripNonDigits(e.target.value))}
                      className="w-40 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-right"
                      placeholder="10,000,000"
                    />
                  </label>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-2">
                    <span className="text-neutral-500">일 매수액 (KRW):</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatThousands(posDcaPerDay)}
                      onChange={(e) => setPosDcaPerDay(stripNonDigits(e.target.value))}
                      className="w-32 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-right"
                      placeholder="1,000,000"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-neutral-500">기간 (일):</span>
                    <input
                      type="number"
                      value={posDcaDays}
                      onChange={(e) => setPosDcaDays(e.target.value)}
                      className="w-24 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-right"
                    />
                  </label>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={savePosition}
                  className="text-xs px-3 py-1.5 border border-neutral-700 rounded hover:border-sky-500 hover:text-sky-300"
                >
                  저장
                </button>
                {position && (
                  <span className="text-xs text-neutral-500">
                    저장됨: {position.strategy === "lump_sum" ? "거치식" : "DCA"}
                  </span>
                )}
              </div>
            </div>

            {/* Trade journal — log buys/sells, see realized P&L per symbol.
                key includes journalRefreshKey so a bulk insert below forces a reload. */}
            <TradeJournalPanel
              key={`${selected}-${journalRefreshKey}`}
              symbol={selected}
              currentPrice={selectedSnap?.lastPrice ?? null}
              aiAnalysisId={result?.analysis.id ?? null}
            />

            {/* Analyze buttons */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <button
                onClick={analyze}
                disabled={analyzing}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white rounded text-sm font-semibold"
              >
                {analyzing ? "분석 중…" : "📊 매수/매도 근거 분석"}
              </button>
              <button
                onClick={runPullback}
                disabled={pbLoading}
                title="상승추세 내 건강한 눌림인지, 추세 전환(하락)인지 5기준으로 판별"
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-sm font-semibold"
              >
                {pbLoading ? "눌림목 분석 중…" : "🎯 눌림목 분석"}
              </button>
              <Link
                href={`/techview?symbol=${selected}`}
                title="주봉 고고저 빗각 + 갭/피보나치 되돌림 + 라인 터치 기준 기술분석"
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-sm font-semibold"
              >
                📐 기술분석
              </Link>
              {result?.cached && !result?.stale && (
                <span className="text-xs text-neutral-500">(5분 캐시 결과)</span>
              )}
            </div>

            {pbError && (
              <div className="mb-6 border border-rose-800 bg-rose-950/50 text-rose-200 rounded p-3 text-sm">
                {pbError}
              </div>
            )}
            {pbResult && (
              <div className="mb-6">
                <PullbackCard r={pbResult} />
              </div>
            )}

            {analysisError && (
              <div className="mb-6 border border-rose-800 bg-rose-950/50 text-rose-200 rounded p-3 text-sm">
                {analysisError}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {result.stale && (
                  <div className="border border-amber-800 bg-amber-950/50 text-amber-200 rounded p-3 text-sm">
                    ⚠️ Gemini 호출 한도(rate-limit)로 새 분석을 받지 못해
                    {typeof result.stale_age_hours === "number"
                      ? ` 약 ${result.stale_age_hours}시간 전`
                      : " 직전"}{" "}
                    분석을 표시합니다. 잠시 후 다시 시도하면 최신 분석이 생성됩니다.
                  </div>
                )}
                {/* Prominent verdict callout — the BUY/SELL/HOLD call is now
                    the visual headline, not a side-label. */}
                <VerdictBanner verdict={result.analysis} fresh={!result.stale} />
                {result.analysis.summary && (
                  <div className="border border-neutral-800 rounded-lg p-4">
                    <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                      단타 (1일 ~ 1주) · 요약
                    </div>
                    <p className="text-sm leading-relaxed">{result.analysis.summary}</p>
                  </div>
                )}

                {/* 매매 플랜 — 언제 사고 언제 팔지 (context.trade_plan, ATR 검증 통과분) */}
                <TradePlanCard analysis={result.analysis} />

                {/* long-term horizons (3m / 6m / 1y) */}
                {result.analysis.horizons && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {([
                      ["three_month", "3개월"],
                      ["six_month", "6개월"],
                      ["one_year", "1년"],
                    ] as const).map(([key, label]) => {
                      const h = result.analysis.horizons?.[key];
                      if (!h) return null;
                      return (
                        <div key={key} className="border border-neutral-800 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs uppercase tracking-wider text-neutral-500">{label}</span>
                            <span className={`px-2 py-0.5 border rounded text-xs font-semibold ${VERDICT_STYLE[h.verdict]}`}>
                              {VERDICT_LABEL[h.verdict]}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">신뢰도 {(h.confidence * 100).toFixed(0)}%</div>
                          {h.summary && (
                            <p className="mt-2 text-xs leading-relaxed text-neutral-200">{h.summary}</p>
                          )}
                          {h.key_points.length > 0 && (
                            <ul className="mt-2 text-xs space-y-0.5 list-disc list-inside text-neutral-300">
                              {h.key_points.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* bull / bear */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-emerald-900/50 bg-emerald-950/20 rounded-lg p-4">
                    <h3 className="text-xs uppercase text-emerald-400 mb-2">강세 근거</h3>
                    <ul className="text-sm space-y-1 list-disc list-inside text-neutral-200">
                      {result.analysis.bull_points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="border border-rose-900/50 bg-rose-950/20 rounded-lg p-4">
                    <h3 className="text-xs uppercase text-rose-400 mb-2">약세 근거</h3>
                    <ul className="text-sm space-y-1 list-disc list-inside text-neutral-200">
                      {result.analysis.bear_points.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* sizing */}
                <div className="border border-sky-900/50 bg-sky-950/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs uppercase text-sky-400">권장 사이징</h3>
                    <details className="group relative">
                      <summary className="cursor-pointer list-none text-xs text-neutral-500 hover:text-sky-300 select-none">
                        ⓘ 계산 규칙
                      </summary>
                      <div className="absolute right-0 top-6 z-10 w-[420px] max-w-[80vw] rounded-md border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-300 shadow-lg">
                        <p className="text-neutral-200 mb-2">
                          AI 신뢰도 <span className="text-sky-300">w</span> (0~1) × 포지션 설정 조합 룰. AI는 판정·신뢰도만 정하고, 금액 계산은 고정 공식.
                        </p>
                        <table className="w-full text-[11px] border border-neutral-800">
                          <thead className="bg-neutral-900 text-neutral-400">
                            <tr>
                              <th className="px-1.5 py-1 text-left">판정</th>
                              <th className="px-1.5 py-1 text-left">거치식 (예산 X)</th>
                              <th className="px-1.5 py-1 text-left">DCA (일 매수액 Y)</th>
                            </tr>
                          </thead>
                          <tbody className="text-neutral-300">
                            <tr className="border-t border-neutral-800">
                              <td className="px-1.5 py-1 text-emerald-300">매수</td>
                              <td className="px-1.5 py-1">X × w</td>
                              <td className="px-1.5 py-1">Y × min(1 + 2w, 3)</td>
                            </tr>
                            <tr className="border-t border-neutral-800">
                              <td className="px-1.5 py-1 text-amber-300">관망</td>
                              <td className="px-1.5 py-1">0 (보류)</td>
                              <td className="px-1.5 py-1">Y (평소 슬라이스)</td>
                            </tr>
                            <tr className="border-t border-neutral-800">
                              <td className="px-1.5 py-1 text-rose-300">매도</td>
                              <td className="px-1.5 py-1">X × w (보유분 익절/손절)</td>
                              <td className="px-1.5 py-1">0 (오늘 매수 X)</td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="mt-2 text-neutral-400">
                          <div className="text-neutral-300 font-semibold mb-0.5">DCA 매수 배수 예시</div>
                          <div>w=0.50 → 2.0× · w=0.75 → 2.5× · w=1.00 → 3.0× (cap)</div>
                        </div>
                        <p className="mt-2 text-neutral-500 leading-relaxed">
                          평소 DCA로 사고 있는 양에 가중을 더해 "신호 강할 때 평소보다 많이"
                          사도록 설계된 룰. 거치식은 반대로 매수 신호가 없으면 0원으로 진입 보류.
                        </p>
                      </div>
                    </details>
                  </div>
                  <div className="text-sm">
                    <div className="text-2xl font-semibold">
                      {fmtKRW(result.sizing.amount_krw)}
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">
                      가중치 {(result.sizing.weight * 100).toFixed(0)}%
                    </div>
                    <p className="mt-2 text-neutral-300">{result.sizing.rationale}</p>
                  </div>
                </div>

                {/* news */}
                {result.news.length > 0 && (
                  <div className="border border-neutral-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <h3 className="text-xs uppercase text-neutral-400">
                        참고 뉴스 (총 {result.news.length}건)
                      </h3>
                      {result.sources_used && Object.keys(result.sources_used).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(result.sources_used)
                            .sort((a, b) => b[1] - a[1])
                            .map(([src, n]) => (
                              <span
                                key={src}
                                className={`px-1.5 py-0.5 text-[10px] border rounded ${sourceBadgeClass(src)}`}
                              >
                                {src} {n}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    <ul className="text-sm space-y-2">
                      {[...result.news]
                        .sort((a, b) =>
                          (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
                        )
                        .slice(0, 20)
                        .map((n, i) => (
                        <li key={n.id ?? `${n.source}-${n.url}-${i}`} className="flex items-start gap-2">
                          <span
                            className={`shrink-0 px-1.5 py-0.5 text-[10px] border rounded mt-0.5 ${sourceBadgeClass(n.source)}`}
                          >
                            {n.source}
                          </span>
                          <a
                            href={n.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-300 hover:underline leading-snug"
                          >
                            {n.headline}
                          </a>
                          <span className="text-xs text-neutral-600 ml-auto shrink-0">
                            {n.createdAt.slice(0, 10)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-neutral-600 pt-2">
                  정보 제공 목적이며 투자 자문이 아닙니다. 모든 매수·매도 결정과 손익은 본인 책임입니다.
                </p>
              </div>
            )}
          </>
        )}
      </section>
      </div>

      {/* Bulk trade backfill — moved here from the (now hidden) Stats tab so
          all trade recording lives on one page. onDone reloads the current
          symbol's journal + watchlist snapshots. */}
      <div className="mt-8">
        <BulkTradeEntry
          onDone={() => {
            setJournalRefreshKey((k) => k + 1);
            loadWatchlist();
            loadSnapshots();
          }}
        />
      </div>
    </div>
  );
}

/**
 * Big colored AI verdict callout. Two visual modes:
 *   - cached (fresh=false): "AI 추천 — 24h 내 분석" + age badge
 *   - fresh  (fresh=true):  "🤖 AI 단타 추천" + larger emphasis
 *
 * The verdict color and large label make this the primary visual element
 * of the detail view so the user can answer "what did AI say?" at a glance.
 */
function VerdictBanner({ verdict, fresh = false }: { verdict: AiAnalysis; fresh?: boolean }) {
  const v = verdict.verdict;
  const conf = Math.round(verdict.confidence * 100);
  const ageMin = Math.max(0, Math.floor((Date.now() - new Date(verdict.created_at).getTime()) / 60000));
  const ageLabel =
    ageMin < 1 ? "방금" : ageMin < 60 ? `${ageMin}분 전` : `${Math.floor(ageMin / 60)}시간 전`;
  const bgClass =
    v === "buy"
      ? "border-emerald-700 bg-emerald-950/40"
      : v === "sell"
        ? "border-rose-700 bg-rose-950/40"
        : "border-amber-700 bg-amber-950/30";
  const textClass =
    v === "buy" ? "text-emerald-300" : v === "sell" ? "text-rose-300" : "text-amber-300";
  const emoji = v === "buy" ? "🟢" : v === "sell" ? "🔴" : "🟡";
  return (
    <div className={`border-2 rounded-lg p-4 ${bgClass}`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-neutral-400">
            🤖 AI 단타 추천{!fresh && ` · ${ageLabel} 분석`}
          </span>
        </div>
        <span className="text-xs text-neutral-500">
          {verdict.model}
          {fresh && " · 방금 분석"}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-4 flex-wrap">
        <div className={`text-4xl font-bold ${textClass}`}>
          {emoji} {VERDICT_LABEL[v]}
        </div>
        <div className="text-sm text-neutral-400">
          신뢰도 <span className={`text-lg font-semibold ${textClass}`}>{conf}%</span>
        </div>
      </div>
      {!fresh && verdict.summary && (
        <p className="mt-2 text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
          {verdict.summary}
        </p>
      )}
      {!fresh && (verdict.bull_points?.length || verdict.bear_points?.length) ? (
        <details className="mt-3 group">
          <summary className="text-[11px] text-neutral-500 cursor-pointer hover:text-neutral-300 select-none list-none">
            ▸ 강세/약세 근거 보기
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {verdict.bull_points?.length ? (
              <div className="border border-emerald-900/50 bg-emerald-950/10 rounded p-2">
                <div className="text-[10px] uppercase text-emerald-400 mb-1">강세 근거</div>
                <ul className="text-xs space-y-0.5 list-disc list-inside text-neutral-200">
                  {verdict.bull_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            ) : null}
            {verdict.bear_points?.length ? (
              <div className="border border-rose-900/50 bg-rose-950/10 rounded p-2">
                <div className="text-[10px] uppercase text-rose-400 mb-1">약세 근거</div>
                <ul className="text-xs space-y-0.5 list-disc list-inside text-neutral-200">
                  {verdict.bear_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

// "언제 사고 언제 팔지" — analyze가 검증까지 마친 trade_plan을 렌더.
// 플랜이 없는(구버전) 분석 행에선 아무것도 그리지 않음.
interface TradePlanShape {
  entry_low: number;
  entry_high: number;
  stop: number;
  target_1: number;
  target_2: number;
  horizon_days: number;
  note: string;
}
function readTradePlan(analysis: AiAnalysis): TradePlanShape | null {
  const raw = (analysis.context as { trade_plan?: unknown } | null)?.trade_plan;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<TradePlanShape>;
  const nums = [p.entry_low, p.entry_high, p.stop, p.target_1, p.target_2];
  if (nums.some((v) => typeof v !== "number" || !isFinite(v))) return null;
  return p as TradePlanShape;
}

function TradePlanCard({ analysis }: { analysis: AiAnalysis }) {
  const plan = readTradePlan(analysis);
  if (!plan) return null;
  const v = analysis.verdict;
  const frame =
    v === "buy"
      ? "border-emerald-800 bg-emerald-950/30"
      : v === "sell"
        ? "border-rose-800 bg-rose-950/30"
        : "border-neutral-800 bg-neutral-900/30";
  const entryLabel = v === "buy" ? "진입 존" : v === "sell" ? "반등 매도 존" : "진입 대기 존";
  return (
    <div className={`border rounded-lg p-4 ${frame}`}>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
        📋 매매 플랜 — 언제 사고 언제 팔지 (기초자산 가격 기준)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
        <div>
          <div className="text-xs text-neutral-500">📍 {entryLabel}</div>
          <div className="font-semibold text-sky-300">
            ${plan.entry_low.toFixed(2)} ~ ${plan.entry_high.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">🎯 목표 (1차 / 2차)</div>
          <div className="font-semibold text-emerald-400">
            ${plan.target_1.toFixed(2)} / ${plan.target_2.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">🛑 손절</div>
          <div className="font-semibold text-rose-400">${plan.stop.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">⏳ 예상 보유</div>
          <div className="font-semibold text-neutral-200">~{plan.horizon_days} 거래일</div>
        </div>
      </div>
      {plan.note && (
        <p className="mt-3 text-xs text-neutral-400 leading-relaxed">💡 {plan.note}</p>
      )}
      <p className="mt-2 text-[11px] text-neutral-600">
        2배 레버리지 ETF로 실행 시 손익률은 위 % 거리의 약 2배로 움직입니다.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-800 rounded p-2">
      <div className="text-neutral-500">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}

/**
 * Per-symbol trade journal: log a buy/sell, see derived position + realized
 * P&L, and a recent-trades table. Loads its own data on mount and after
 * every mutation so the parent doesn't need to know about trade state.
 */
function TradeJournalPanel({
  symbol,
  currentPrice,
  aiAnalysisId,
}: {
  symbol: string;
  currentPrice: number | null;
  aiAnalysisId: string | null;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  // User trades real money on leveraged ETFs as the default workflow.
  // No paper mode UI (always "real") and the derivative toggle defaults on.
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Leveraged-derivative recording: when "다른 종목으로 매매" is on, the
  // user enters the actually-traded ticker (e.g. TSLL) here while the
  // panel's `symbol` (e.g. TSLA) becomes the underlying. Defaults on
  // because the user's typical flow is small-cap real money on 2x ETFs.
  const [useDerivative, setUseDerivative] = useState(true);
  const [derivTicker, setDerivTicker] = useState("");
  const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

  // Fetch trades for the panel: include trades where this symbol is the
  // traded instrument OR the underlying. That way "TSLA detail page"
  // surfaces both direct-TSLA trades and TSLL-on-TSLA leverage trades.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [byTraded, byUnderlying] = await Promise.all([
        fetch(`/api/trades?symbol=${encodeURIComponent(symbol)}&limit=50`).then(
          (r) => r.json() as Promise<{ trades?: Trade[] }>,
        ),
        fetch(
          `/api/trades?underlying_symbol=${encodeURIComponent(symbol)}&limit=50`,
        ).then((r) => r.json() as Promise<{ trades?: Trade[] }>),
      ]);
      // Dedupe by trade id; sort by ts desc.
      const map = new Map<string, Trade>();
      for (const t of byTraded.trades ?? []) map.set(t.id, t);
      for (const t of byUnderlying.trades ?? []) map.set(t.id, t);
      const merged = Array.from(map.values()).sort((a, b) =>
        a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0,
      );
      setTrades(merged);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  // Compute per-instrument positions. When the user trades a derivative
  // (TSLL) on a TSLA-thesis, the panel for TSLA shows BOTH a direct-TSLA
  // position (if any) and a TSLL position — never mixed in the same
  // weighted-avg, since $442 TSLA and $16 TSLL aren't fungible quantities.
  const positionsByInstrument = useMemo(() => {
    const bySym = new Map<string, Trade[]>();
    for (const t of trades) {
      const arr = bySym.get(t.symbol);
      if (arr) arr.push(t);
      else bySym.set(t.symbol, [t]);
    }
    const out: Array<{
      symbol: string;
      underlying: string | null;
      paper: PositionDerived;
      real: PositionDerived;
    }> = [];
    for (const [sym, group] of bySym) {
      const der = derivePositions(group);
      out.push({
        symbol: sym,
        // All trades for one symbol share the same underlying (or null).
        underlying: group[0]?.underlying_symbol ?? null,
        paper: der.paper,
        real: der.real,
      });
    }
    // Put the panel's own symbol first; derivatives after.
    out.sort((a, b) => {
      if (a.symbol === symbol) return -1;
      if (b.symbol === symbol) return 1;
      return a.symbol.localeCompare(b.symbol);
    });
    return out;
  }, [trades, symbol]);

  async function submit() {
    const qtyN = Number(qty);
    const priceN = Number(price);
    if (!isFinite(qtyN) || qtyN <= 0) {
      setError("수량은 0보다 커야 합니다");
      return;
    }
    if (!isFinite(priceN) || priceN <= 0) {
      setError("가격은 0보다 커야 합니다");
      return;
    }
    // Derivative-mode: validate the alternate ticker before submit.
    // When equal to underlying or empty, treat as direct (no underlying flag).
    let tradedSymbol = symbol;
    let underlyingForBody: string | null = null;
    if (useDerivative) {
      const t = derivTicker.trim().toUpperCase();
      if (!t || !SYMBOL_RE.test(t)) {
        setError("거래 종목 티커가 올바르지 않습니다 (예: TSLL)");
        return;
      }
      if (t === symbol) {
        setError("거래 종목이 기초자산과 같습니다 — 토글을 꺼주세요");
        return;
      }
      tradedSymbol = t;
      underlyingForBody = symbol;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: tradedSymbol,
          action,
          qty: qtyN,
          price: priceN,
          mode: "real", // user trades real money only; no paper mode
          notes: notes.trim() || null,
          ai_analysis_id: aiAnalysisId,
          underlying_symbol: underlyingForBody,
        }),
      });
      const d = (await r.json()) as { trade?: Trade; error?: string };
      if (d.error) {
        setError(d.error);
        return;
      }
      // Clear inputs for the next entry; keep action/derivative settings
      // since the user's workflow often involves repeat trades.
      setQty("");
      setPrice("");
      setNotes("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 거래 기록을 삭제할까요? (P&L 재계산됨)")) return;
    await fetch(`/api/trades?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="border border-neutral-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-semibold">📝 매매 기록</h2>
        {aiAnalysisId && (
          <span className="text-[11px] text-neutral-500">최근 AI 분석에 연결됨</span>
        )}
      </div>

      {/* Position summary — one row per traded instrument. Direct trades
          on `symbol` show first; derivatives (different `symbol` with
          underlying = panel symbol) follow with a tag indicating link.
          Paper-mode summary hidden when zero paper trades (user is on
          real money only — no need to clutter the panel). */}
      {positionsByInstrument.length === 0 ? (
        <div className="border border-neutral-800 rounded p-2.5 text-xs text-neutral-500 mb-3">
          이 종목 기록 없음
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {positionsByInstrument.map((inst) => {
            const isDerivative = inst.symbol !== symbol;
            // Only show "current price" mark-to-market for the panel's own
            // symbol; we don't have the derivative's live snapshot here.
            const px = isDerivative ? null : currentPrice;
            const hasPaper = inst.paper.tradeCount > 0;
            return (
              <div key={inst.symbol}>
                <div className="flex items-center gap-2 mb-1 text-[11px] text-neutral-400">
                  <span className="font-semibold text-neutral-200">
                    {inst.symbol}
                  </span>
                  {isDerivative && (
                    <span
                      className="px-1 py-px text-[9px] border border-violet-700 bg-violet-950/40 text-violet-300 rounded"
                      title={`기초자산: ${inst.underlying ?? symbol}`}
                    >
                      ⇢ {inst.underlying ?? symbol}
                    </span>
                  )}
                </div>
                <div
                  className={`grid grid-cols-1 gap-2 text-xs ${
                    hasPaper ? "md:grid-cols-2" : ""
                  }`}
                >
                  {hasPaper && (
                    <PositionSummary
                      label="📄 페이퍼 (legacy)"
                      pos={inst.paper}
                      currentPrice={px}
                    />
                  )}
                  <PositionSummary
                    label="💵 실전"
                    pos={inst.real}
                    currentPrice={px}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Always-open record form. The two original buttons (+ 매수 / − 매도)
          were removed — user trades real money only, and a single inline
          form with a buy/sell radio is faster for frequent recording.
          Default state: real-mode + derivative-ticker entry (user's typical
          2× leveraged ETF workflow). */}
      <div className="border border-neutral-800 rounded p-3 bg-neutral-950/40">
        <div className="flex flex-wrap items-center gap-3 text-xs mb-2">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={action === "buy"}
              onChange={() => setAction("buy")}
            />
            <span className="text-emerald-300 font-semibold">매수</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={action === "sell"}
              onChange={() => setAction("sell")}
            />
            <span className="text-rose-300 font-semibold">매도</span>
          </label>
        </div>

        {/* Derivative / leveraged ETF toggle. Default ON since user's
            typical workflow trades 2× ETFs (e.g. TSLL) on the analyzed
            underlying (TSLA). When ON, qty/price reflect the leverage
            ticker; the trade row stores symbol=TSLL underlying=TSLA. */}
        <div className="flex flex-wrap items-center gap-3 text-xs mb-2 pb-2 border-b border-neutral-800/60">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={useDerivative}
              onChange={() => {
                setUseDerivative(true);
                setPrice(""); // leverage price differs from underlying
              }}
            />
            다른 종목으로 매매 (레버리지 등)
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={!useDerivative}
              onChange={() => {
                setUseDerivative(false);
                if (currentPrice != null) setPrice(currentPrice.toFixed(2));
              }}
            />
            {symbol} 직접 매매
          </label>
          {useDerivative && (
            <label className="flex items-center gap-1 ml-1">
              <span className="text-neutral-500">거래 티커:</span>
              <input
                type="text"
                value={derivTicker}
                onChange={(e) => setDerivTicker(e.target.value.toUpperCase())}
                className="w-24 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 uppercase"
                placeholder="TSLL"
                maxLength={10}
              />
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2 text-xs">
          <label className="flex flex-col">
            <span className="text-neutral-500 mb-0.5">
              수량 (주식{useDerivative ? `, ${derivTicker || "?"}` : ""})
            </span>
            <input
              type="number"
              step="any"
              min="0"
              value={qty}
              // Strip leading '-' so the user cannot enter negative qty
              // even by paste or keyboard. Shares can't be negative.
              onChange={(e) => setQty(e.target.value.replace(/^-+/, ""))}
              onKeyDown={(e) => {
                if (e.key === "-") e.preventDefault();
              }}
              className="w-28 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-right"
              placeholder="10"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-neutral-500 mb-0.5">
              가격 ($
              {useDerivative
                ? `, ${derivTicker || "거래 티커"} 기준`
                : ""}
              )
            </span>
            <input
              type="number"
              step="any"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/^-+/, ""))}
              onKeyDown={(e) => {
                if (e.key === "-") e.preventDefault();
              }}
              className="w-28 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-right"
              placeholder={
                useDerivative
                  ? "16.81"
                  : currentPrice?.toFixed(2) ?? "0.00"
              }
            />
          </label>
          <label className="flex flex-col flex-1 min-w-[180px]">
            <span className="text-neutral-500 mb-0.5">메모 (선택)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
              placeholder="갭상승 시그널 보고 진입"
            />
          </label>
          <button
            onClick={submit}
            disabled={submitting}
            className={`px-3 py-1.5 text-xs rounded font-semibold disabled:opacity-50 ${
              action === "buy"
                ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                : "bg-rose-700 hover:bg-rose-600 text-white"
            }`}
          >
            {submitting ? "저장 중…" : action === "buy" ? "매수 저장" : "매도 저장"}
          </button>
        </div>
        {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}
      </div>

      {/* Recent trades table */}
      {loading ? (
        <p className="text-xs text-neutral-500">로딩 중…</p>
      ) : trades.length === 0 ? (
        <p className="text-xs text-neutral-500">
          이 종목 거래 기록 없음. 위 폼에서 첫 매수/매도를 기록하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="text-left py-1.5 pr-2">시각</th>
                <th className="text-left py-1.5 pr-2">구분</th>
                <th className="text-left py-1.5 pr-2">티커</th>
                <th className="text-right py-1.5 px-2">수량</th>
                <th className="text-right py-1.5 px-2">가격</th>
                <th className="text-right py-1.5 px-2">금액</th>
                <th className="text-left py-1.5 pl-2">모드</th>
                <th className="text-left py-1.5 pl-2">메모</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-neutral-900 hover:bg-neutral-900/40">
                  <td className="py-1.5 pr-2 text-neutral-400">
                    {new Date(t.ts).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td
                    className={`py-1.5 pr-2 font-semibold ${
                      t.action === "buy" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {t.action === "buy" ? "매수" : "매도"}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="text-sky-300 font-semibold">{t.symbol}</span>
                    {t.underlying_symbol && t.underlying_symbol !== t.symbol && (
                      <span
                        className="ml-1 px-1 py-px text-[9px] border border-violet-700 bg-violet-950/40 text-violet-300 rounded"
                        title={`기초자산: ${t.underlying_symbol}`}
                      >
                        ⇢ {t.underlying_symbol}
                      </span>
                    )}
                  </td>
                  <td className="text-right py-1.5 px-2 text-neutral-200">{t.qty}</td>
                  <td className="text-right py-1.5 px-2 text-neutral-200">
                    ${t.price.toFixed(2)}
                  </td>
                  <td className="text-right py-1.5 px-2 text-neutral-300">
                    ${(t.qty * t.price).toFixed(2)}
                  </td>
                  <td className="py-1.5 pl-2 text-neutral-500">
                    {t.mode === "paper" ? "모의" : "실전"}
                  </td>
                  <td className="py-1.5 pl-2 text-neutral-400 max-w-[200px] truncate">
                    {t.notes ?? ""}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => remove(t.id)}
                      className="text-neutral-700 hover:text-rose-400"
                      title="삭제"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PositionSummary({
  label,
  pos,
  currentPrice,
}: {
  label: string;
  pos: PositionDerived;
  currentPrice: number | null;
}) {
  if (pos.tradeCount === 0) {
    return (
      <div className="border border-neutral-800 rounded p-2.5 text-neutral-500">
        <div className="text-[10px] uppercase mb-1">{label}</div>
        <div className="text-xs">기록 없음</div>
      </div>
    );
  }
  const unrealized =
    pos.openQty > 0 && pos.avgBuyPrice != null && currentPrice != null
      ? pos.openQty * (currentPrice - pos.avgBuyPrice)
      : null;
  const totalPnl = pos.realizedPnl + (unrealized ?? 0);
  return (
    <div className="border border-neutral-800 rounded p-2.5">
      <div className="text-[10px] uppercase text-neutral-500 mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <span className="text-neutral-500">보유 수량</span>
        <span className="text-right text-neutral-200 font-semibold">
          {pos.openQty.toFixed(pos.openQty < 1 ? 4 : 2)}
        </span>
        <span className="text-neutral-500">평균 매수가</span>
        <span className="text-right text-neutral-200">
          {pos.avgBuyPrice != null ? `$${pos.avgBuyPrice.toFixed(2)}` : "—"}
        </span>
        <span className="text-neutral-500">실현 손익</span>
        <span
          className={`text-right font-semibold ${
            pos.realizedPnl > 0
              ? "text-emerald-400"
              : pos.realizedPnl < 0
                ? "text-rose-400"
                : "text-neutral-300"
          }`}
        >
          {pos.realizedPnl >= 0 ? "+" : ""}${pos.realizedPnl.toFixed(2)}
        </span>
        {unrealized != null && (
          <>
            <span className="text-neutral-500">평가 손익</span>
            <span
              className={`text-right ${
                unrealized > 0
                  ? "text-emerald-400"
                  : unrealized < 0
                    ? "text-rose-400"
                    : "text-neutral-300"
              }`}
            >
              {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}
            </span>
            <span className="text-neutral-500">총 손익</span>
            <span
              className={`text-right font-semibold ${
                totalPnl > 0
                  ? "text-emerald-400"
                  : totalPnl < 0
                    ? "text-rose-400"
                    : "text-neutral-300"
              }`}
            >
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** Same weighted-avg math as lib/trades.ts, but client-side for a single symbol. */
function derivePositions(trades: Trade[]): {
  paper: PositionDerived;
  real: PositionDerived;
} {
  const empty = (mode: "paper" | "real"): PositionDerived => ({
    symbol: trades[0]?.symbol ?? "",
    mode,
    openQty: 0,
    avgBuyPrice: null,
    costBasisOpen: 0,
    realizedPnl: 0,
    totalBuyQty: 0,
    totalSellQty: 0,
    tradeCount: 0,
  });
  const out = { paper: empty("paper"), real: empty("real") };
  const acc = { paper: { buyQty: 0, buyCost: 0, sellQty: 0, sellRev: 0 }, real: { buyQty: 0, buyCost: 0, sellQty: 0, sellRev: 0 } };
  for (const t of trades) {
    const a = acc[t.mode];
    out[t.mode].tradeCount += 1;
    if (t.action === "buy") {
      a.buyQty += t.qty;
      a.buyCost += t.qty * t.price;
    } else {
      a.sellQty += t.qty;
      a.sellRev += t.qty * t.price;
    }
  }
  for (const k of ["paper", "real"] as const) {
    const a = acc[k];
    const avg = a.buyQty > 0 ? a.buyCost / a.buyQty : null;
    out[k].totalBuyQty = a.buyQty;
    out[k].totalSellQty = a.sellQty;
    out[k].openQty = a.buyQty - a.sellQty;
    out[k].avgBuyPrice = avg;
    out[k].costBasisOpen = avg != null ? Math.max(0, out[k].openQty) * avg : 0;
    out[k].realizedPnl = avg != null ? a.sellRev - avg * a.sellQty : 0;
  }
  return out;
}

/**
 * Live-updating relative timestamp ("방금", "12초 전", "5분 전") for the
 * watchlist refresh indicator. Re-renders every 10s so it doesn't lie.
 */
function RelativeTime({ ts, className }: { ts: Date; className?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  const elapsedSec = Math.max(0, Math.floor((Date.now() - ts.getTime()) / 1000));
  let label: string;
  if (elapsedSec < 5) label = "방금";
  else if (elapsedSec < 60) label = `${elapsedSec}초 전`;
  else if (elapsedSec < 3600) label = `${Math.floor(elapsedSec / 60)}분 전`;
  else label = `${Math.floor(elapsedSec / 3600)}시간 전`;
  return <span className={className}>업데이트: {label}</span>;
}

/**
 * Compute the current US market session by NY wall-clock time.
 * Mirrors lib/alpaca.ts#currentMarketSession but runs in the browser
 * so the badge updates every second without a server roundtrip.
 */
function computeSession(now: Date): "pre" | "regular" | "after" | "closed" {
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

/** Minutes until the next session boundary, for the countdown text. */
function nextBoundaryMinutes(now: Date, session: ReturnType<typeof computeSession>): { label: string; minsUntil: number } | null {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const mins = hour * 60 + minute;
  const targets: Array<{ at: number; label: string }> = [
    { at: 4 * 60, label: "프리마켓 시작" },
    { at: 9 * 60 + 30, label: "정규장 개장" },
    { at: 16 * 60, label: "정규장 마감" },
    { at: 20 * 60, label: "애프터마켓 마감" },
  ];
  for (const t of targets) {
    if (mins < t.at) {
      return { label: t.label, minsUntil: t.at - mins };
    }
  }
  // Past 20:00 ET — next event is tomorrow's pre-market open
  return { label: "프리마켓 시작 (다음 영업일)", minsUntil: 24 * 60 - mins + 4 * 60 };
}

const SESSION_BADGE: Record<ReturnType<typeof computeSession>, { label: string; cls: string; emoji: string }> = {
  pre:     { label: "프리마켓",   cls: "bg-amber-900/40 text-amber-200 border-amber-700",     emoji: "🌅" },
  regular: { label: "정규장",     cls: "bg-emerald-900/40 text-emerald-200 border-emerald-700", emoji: "🇺🇸" },
  after:   { label: "애프터마켓", cls: "bg-violet-900/40 text-violet-200 border-violet-700",   emoji: "🌙" },
  closed:  { label: "장마감",     cls: "bg-neutral-800/60 text-neutral-400 border-neutral-700", emoji: "💤" },
};

function MarketClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const session = computeSession(now);
  const boundary = nextBoundaryMinutes(now, session);
  const kst = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
  const et = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const badge = SESSION_BADGE[session];
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-5 border border-neutral-800 rounded-lg px-4 py-2.5 bg-neutral-900/40">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`px-2.5 py-1 text-xs border rounded font-semibold ${badge.cls}`}>
          {badge.emoji} 미국 {badge.label}
        </span>
        {boundary && (
          <span className="text-xs text-neutral-500">
            다음: {boundary.label} ({Math.floor(boundary.minsUntil / 60)}시간 {boundary.minsUntil % 60}분 남음)
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
        <span>KST {kst}</span>
        <span className="text-neutral-700">·</span>
        <span>ET {et}</span>
      </div>
    </div>
  );
}

// ─── 눌림목(pullback) analysis card ──────────────────────────────────────────

type PbGrade = "pass" | "warn" | "fail";
interface PbCriterion { grade: PbGrade; detail: string }
interface PbSupport { label: string; level: number; distPct: number }
interface PbPlan {
  entryLow: number;
  entryHigh: number;
  stop: number;
  target1: number;
  target2: number;
  rr: number | null;
}
interface PbFacts {
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  atr14: number | null;
  swingHigh: number;
  swingHighAgo: number;
  legLow: number;
  pullbackLow: number;
  retracePct: number | null;
  retraceDepth: number | null;
  extended: boolean;
  brokeLow: boolean;
  lowerHigh: boolean;
  volRatio: number | null;
  downUpVolRatio: number | null;
  distributionDays: number;
  supports: PbSupport[];
  confluence: number;
  nearestSupport: number | null;
  criteria: {
    trend: PbCriterion;
    volume: PbCriterion;
    structure: PbCriterion;
    support: PbCriterion;
    confirmation: PbCriterion;
  };
  classification: PbClass;
  plan: PbPlan | null;
}
type PbClass = "pullback" | "forming" | "downtrend" | "no_uptrend";
interface PbAi {
  classification: PbClass;
  confidence: number;
  headline: string;
  summary: string;
  action: string;
  operative_tf: string;
  cautions: string[];
}
interface PbTimeframe {
  key: string;
  label: string;
  bars: number;
  facts: PbFacts | null;
}
interface PullbackResponse {
  symbol: string;
  session: string | null;
  price: number;
  earnings: { date: string; daysUntil: number } | null;
  timeframes: PbTimeframe[];
  ai: PbAi;
  plan: PbPlan | null;
}

const PB_CLASS_META: Record<PbClass, { label: string; cls: string; buyable: boolean }> = {
  pullback: { label: "🟢 눌림목 지지 확인 · 진입 가능", cls: "border-emerald-700 bg-emerald-950/40 text-emerald-200", buyable: true },
  forming: { label: "🟡 눌림목 형성 중 · 확인 대기", cls: "border-amber-700 bg-amber-950/40 text-amber-200", buyable: true },
  downtrend: { label: "🔴 하락 전환 의심 · 회피", cls: "border-rose-700 bg-rose-950/40 text-rose-200", buyable: false },
  no_uptrend: { label: "⚪ 상승추세 아님 · 눌림 아님", cls: "border-neutral-600 bg-neutral-900/60 text-neutral-300", buyable: false },
};

const PB_GRADE_META: Record<PbGrade, { icon: string; cls: string }> = {
  pass: { icon: "✅", cls: "text-emerald-400" },
  warn: { icon: "⚠️", cls: "text-amber-400" },
  fail: { icon: "❌", cls: "text-rose-400" },
};

const PB_CRITERIA: [keyof PbFacts["criteria"], string][] = [
  ["trend", "0 · 추세 (상승추세인가?)"],
  ["volume", "1 · 거래량 (마름 vs 붙음)"],
  ["structure", "2 · 저점 구조 (되돌림·저점유지)"],
  ["support", "3 · 지지 밀집 (의미있는 자리?)"],
  ["confirmation", "4 · 확인 캔들 (반응 왔나?)"],
];

const PB_CLASS_DOT: Record<PbClass, string> = {
  pullback: "bg-emerald-400",
  forming: "bg-amber-400",
  downtrend: "bg-rose-400",
  no_uptrend: "bg-neutral-500",
};
const PB_CLASS_SHORT: Record<PbClass, string> = {
  pullback: "지지",
  forming: "대기",
  downtrend: "하락",
  no_uptrend: "무추세",
};

function PullbackCard({ r }: { r: PullbackResponse }) {
  const meta = PB_CLASS_META[r.ai.classification] ?? PB_CLASS_META.forming;
  const avail = r.timeframes.filter((t) => t.facts);
  // Default selected TF: the AI's operative one, else prefer swing TFs.
  const opTf = r.timeframes.find((t) => t.label === r.ai.operative_tf && t.facts);
  const prefer = ["1h", "4h", "1d", "15m", "1m"];
  const fallbackTf = prefer.map((k) => avail.find((t) => t.key === k)).find(Boolean) ?? avail[0];
  const [selKey, setSelKey] = useState<string>((opTf ?? fallbackTf)?.key ?? "");
  const sel = r.timeframes.find((t) => t.key === selKey && t.facts) ?? avail[0] ?? null;
  const f = sel?.facts ?? null;
  const retr = f?.retraceDepth != null ? `${(f.retraceDepth * 100).toFixed(0)}%` : "?";
  // Plan + its actionability follow the SELECTED timeframe, so entry/stop/target/
  // R:R change per TF (they differ by TF and that's the point). For the operative
  // TF we prefer the AI-refined plan (r.plan); other TFs show their own mechanical
  // (ATR/structure) baseline from facts.plan.
  const isOpSel = !!sel && sel.label === r.ai.operative_tf;
  const plan = isOpSel && r.plan ? r.plan : f?.plan ?? null;
  const selMeta = f ? PB_CLASS_META[f.classification] ?? meta : meta;

  return (
    <section className="border border-neutral-800 rounded-lg bg-neutral-950 overflow-hidden">
      {/* verdict header */}
      <div className={`border-b p-4 ${meta.cls}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-bold">{meta.label}</span>
          <span className="text-xs opacity-80">신뢰도 {(r.ai.confidence * 100).toFixed(0)}%</span>
        </div>
        {r.ai.headline && <p className="text-sm mt-1 font-semibold">{r.ai.headline}</p>}
        <p className="text-xs mt-1 opacity-80">기준 타임프레임: {r.ai.operative_tf}</p>
        {r.earnings && r.earnings.daysUntil <= 7 && (
          <p className="text-xs mt-1 text-amber-300">⚠️ 어닝 D-{r.earnings.daysUntil} ({r.earnings.date}) — 눌림이 어닝 도박이 될 수 있음</p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {r.ai.summary && <p className="text-sm leading-relaxed text-neutral-200">{r.ai.summary}</p>}

        {/* action callout */}
        {r.ai.action && (
          <div className="rounded border border-sky-800 bg-sky-950/40 px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider text-sky-400">지금 할 일</span>
            <p className="text-sm text-sky-100 mt-0.5">{r.ai.action}</p>
          </div>
        )}

        {/* timeframe strip — per-TF mechanical verdict; click to inspect */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
            타임프레임별 판정 (클릭해 상세 보기)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.timeframes.map((t) => {
              const isSel = t.key === sel?.key;
              const isOp = t.label === r.ai.operative_tf;
              if (!t.facts) {
                return (
                  <span key={t.key} className="text-xs px-2 py-1 border border-neutral-800 rounded text-neutral-600">
                    {t.label} · 데이터부족
                  </span>
                );
              }
              const cls = t.facts.classification;
              return (
                <button
                  key={t.key}
                  onClick={() => setSelKey(t.key)}
                  className={`text-xs px-2 py-1 border rounded flex items-center gap-1.5 ${
                    isSel ? "border-neutral-400 bg-neutral-800 text-neutral-100" : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${PB_CLASS_DOT[cls]}`} />
                  {isOp && <span className="text-sky-400">★</span>}
                  {t.label} · {PB_CLASS_SHORT[cls]}
                </button>
              );
            })}
          </div>
        </div>

        {/* selected TF: 5-criterion checklist (mechanical) */}
        {f && (
          <>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
                {sel?.label} · 5기준 체크리스트 (실측)
              </div>
              <ul className="space-y-1.5">
                {PB_CRITERIA.map(([k, label]) => {
                  const cr = f.criteria[k];
                  const g = PB_GRADE_META[cr.grade];
                  return (
                    <li key={k} className="flex gap-2 text-sm">
                      <span className={`shrink-0 ${g.cls}`}>{g.icon}</span>
                      <span className="min-w-0">
                        <span className="font-semibold text-neutral-300">{label}</span>
                        <span className="text-neutral-400"> — {cr.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <PbStat label="직전 고점" value={`$${f.swingHigh}`} />
              <PbStat label="직전 저점" value={`$${f.legLow}`} />
              <PbStat label="되돌림 깊이" value={retr} />
              <PbStat label="분산일(조정중)" value={`${f.distributionDays}`} />
            </div>

            {f.supports.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">지지 밀집 (현재가 -3%~+0.5%)</div>
                <div className="flex flex-wrap gap-1.5">
                  {f.supports.map((s) => (
                    <span key={s.label} className="text-xs px-2 py-0.5 border border-neutral-700 rounded bg-neutral-900">
                      {s.label} <span className="text-neutral-400">${s.level} ({s.distPct >= 0 ? "+" : ""}{s.distPct}%)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* plan — follows the SELECTED timeframe */}
        {f && (
          plan ? (
            <div className={`rounded border p-3 ${selMeta.buyable ? "border-neutral-700 bg-neutral-900/50" : "border-neutral-800 bg-neutral-900/30 opacity-70"}`}>
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
                매매 플랜 · {sel?.label} 기준{isOpSel ? " · AI 추천 TF" : ""} {selMeta.buyable ? "" : "(이 TF는 진입 부적합 — 참고만)"}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <PbStat label="진입" value={`$${plan.entryLow}~${plan.entryHigh}`} />
                <PbStat label="손절" value={`$${plan.stop}`} tone="rose" />
                <PbStat label="목표1 / 2" value={`$${plan.target1} / $${plan.target2}`} tone="emerald" />
                <PbStat label="손익비 R:R" value={plan.rr != null ? `${plan.rr}` : "—"} />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
                {sel?.label} 기준{isOpSel ? "(AI 조정값)" : "(해당 TF ATR·구조 기계 산출)"} — 진입: 현재가~인근 지지 · 손절: 눌림 저점 아래(ATR 버퍼) · 목표1: 직전 고점 · 목표2: 상승폭 연장. <b className="text-neutral-400">타임프레임을 바꾸면 값이 달라집니다.</b>
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-600 py-1">{sel?.label} 매매 플랜 산출 불가 (ATR/구조 데이터 부족)</p>
          )
        )}

        {/* cautions */}
        {r.ai.cautions && r.ai.cautions.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">주의</div>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-neutral-400">
              {r.ai.cautions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-neutral-600 leading-relaxed">
          각 타임프레임의 체크리스트는 해당 봉 데이터로 기계적으로 계산된 실측치이며(별 ★ = AI가 고른 기준 TF),
          판정·플랜은 AI가 타임프레임을 종합한 참고 의견입니다. &ldquo;형성 중&rdquo;은 확인 캔들 전까지 진입을
          미루라는 뜻입니다. 분/시간봉은 통합 테이프 기준 약 15분 지연됩니다. 최종 매매 판단·책임은 본인에게 있습니다.
        </p>
      </div>
    </section>
  );
}

function PbStat({ label, value, tone }: { label: string; value: string; tone?: "rose" | "emerald" }) {
  const c = tone === "rose" ? "text-rose-300" : tone === "emerald" ? "text-emerald-300" : "text-neutral-200";
  return (
    <div className="border border-neutral-800 rounded px-2 py-1.5">
      <div className="text-[10px] text-neutral-500">{label}</div>
      <div className={`font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
