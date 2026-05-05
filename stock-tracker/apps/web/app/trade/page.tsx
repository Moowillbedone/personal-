"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  error?: string;
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
}

interface PositionSetting {
  symbol: string;
  strategy: "lump_sum" | "dca";
  total_budget_krw: number | null;
  dca_per_day_krw: number | null;
  dca_total_days: number | null;
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

  // selection
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSnap, setSelectedSnap] = useState<Snapshot | null>(null);

  // analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

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

  // ── poll snapshots for watchlist + selection (every 60s)
  const loadSnapshots = useCallback(async () => {
    const symbols = new Set(watchlist.map((w) => w.symbol));
    if (selected) symbols.add(selected);
    if (symbols.size === 0) return;
    const list = Array.from(symbols).join(",");
    const r = await fetch(`/api/snapshot?symbols=${encodeURIComponent(list)}`);
    const data = (await r.json()) as { snapshots?: Snapshot[] };
    const map: Record<string, Snapshot> = {};
    for (const s of data.snapshots ?? []) map[s.symbol] = s;
    setSnapshots(map);
    if (selected && map[selected]) setSelectedSnap(map[selected]);
  }, [watchlist, selected]);

  useEffect(() => {
    loadSnapshots();
    const id = setInterval(loadSnapshots, 60_000);
    return () => clearInterval(id);
  }, [loadSnapshots]);

  // ── load position settings when selection changes
  useEffect(() => {
    if (!selected) {
      setPosition(null);
      return;
    }
    setResult(null);
    setAnalysisError(null);
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
        body: JSON.stringify({ symbol: selected, position: positionPayload }),
      });
      const data = (await r.json()) as AnalyzeResponse | { error: string };
      if ("error" in data) {
        setAnalysisError(data.error);
      } else {
        setResult(data);
        if (data.snapshot) setSelectedSnap(data.snapshot);
      }
    } catch (err) {
      setAnalysisError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  const isInWatchlist = useMemo(
    () => (selected ? watchlist.some((w) => w.symbol === selected) : false),
    [selected, watchlist],
  );

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      {/* LEFT: search + watchlist */}
      <aside className="space-y-4">
        <section>
          <h2 className="text-xs uppercase text-neutral-400 mb-2">티커 검색</h2>
          <input
            type="text"
            placeholder="AAPL, microsoft, ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-sky-600"
          />
          {searching && <p className="text-xs text-neutral-500 mt-1">검색 중…</p>}
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
          <h2 className="text-xs uppercase text-neutral-400 mb-2">즐겨찾기</h2>
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
                      <div className="text-xs text-neutral-500">
                        {s ? SESSION_LABEL[s.session] : "—"}
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

            {/* Analyze button */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={analyze}
                disabled={analyzing}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white rounded text-sm font-semibold"
              >
                {analyzing ? "분석 중…" : "📊 매수/매도 근거 분석"}
              </button>
              {result?.cached && (
                <span className="text-xs text-neutral-500">(5분 캐시 결과)</span>
              )}
            </div>

            {analysisError && (
              <div className="mb-6 border border-rose-800 bg-rose-950/50 text-rose-200 rounded p-3 text-sm">
                {analysisError}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* short-term verdict (1d ~ 1w) */}
                <div className="border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase tracking-wider text-neutral-500">단타 (1일 ~ 1주)</span>
                      <span
                        className={`px-3 py-1 border rounded text-sm font-semibold ${VERDICT_STYLE[result.analysis.verdict]}`}
                      >
                        {VERDICT_LABEL[result.analysis.verdict]}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500">
                      신뢰도 {(result.analysis.confidence * 100).toFixed(0)}% ·{" "}
                      {result.analysis.model} ·{" "}
                      {new Date(result.analysis.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">{result.analysis.summary}</p>
                </div>

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
                      {result.news.slice(0, 20).map((n, i) => (
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
