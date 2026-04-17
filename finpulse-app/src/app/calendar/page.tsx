"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { getWatchlist } from "@/lib/store";

interface EarningsEntry {
  symbol: string;
  name: string;
  date: string;
  timeLabel: string;
  kstDateTime: string;
  market: "US" | "KR";
  marketCap: string;
  fiscalQuarter: string;
  epsForecast: string;
  lastYearEps: string;
  noOfEstimates: number;
}

interface QuarterlyFinancialRow {
  quarter: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  ebitda: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
}

function formatBigNumber(n: number | null): string {
  if (n === null || n === 0) return "-";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function CalendarPage() {
  const [entries, setEntries] = useState<EarningsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"favorites" | "all" | "US" | "KR">("all");
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [quarterlyData, setQuarterlyData] = useState<Record<string, QuarterlyFinancialRow[]>>({});
  const [displayCount, setDisplayCount] = useState(30);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const loaderRef = useRef<HTMLDivElement>(null);

  // 즐겨찾기 로드
  useEffect(() => {
    setWatchlist(getWatchlist());
  }, []);

  // 1년치 데이터 로드 (weeks=52)
  useEffect(() => {
    fetch("/api/earnings-calendar?weeks=52")
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setEntries(data.entries || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 무한 스크롤
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) setDisplayCount(prev => prev + 20);
    }, { threshold: 0.5 });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, []);

  // 종목 클릭 → 확장
  const handleExpand = useCallback((symbol: string) => {
    if (expandedSymbol === symbol) { setExpandedSymbol(null); return; }
    setExpandedSymbol(symbol);
    if (!quarterlyData[symbol]) {
      fetch(`/api/stock-info/${encodeURIComponent(symbol)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.quarterlyFinancials) {
            setQuarterlyData(prev => ({ ...prev, [symbol]: data.quarterlyFinancials }));
          }
        })
        .catch(() => {});
    }
  }, [expandedSymbol, quarterlyData]);

  // 필터링
  const filtered = filter === "favorites"
    ? entries.filter(e => watchlist.includes(e.symbol))
    : filter === "all"
    ? entries
    : entries.filter(e => e.market === filter);
  const displayed = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  // 화면에 보이는 종목만 프리로드 (displayed 기준, 최대 10개)
  useEffect(() => {
    if (displayed.length === 0) return;
    const seen = new Set<string>();
    const toLoad = displayed.filter(e => {
      if (seen.has(e.symbol) || quarterlyData[e.symbol]) return false;
      seen.add(e.symbol);
      return true;
    }).slice(0, 10);
    if (toLoad.length === 0) return;

    Promise.all(
      toLoad.map(e =>
        fetch(`/api/stock-info/${encodeURIComponent(e.symbol)}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => data?.quarterlyFinancials ? { symbol: e.symbol, qf: data.quarterlyFinancials } : null)
          .catch(() => null)
      )
    ).then(results => {
      const update: Record<string, QuarterlyFinancialRow[]> = {};
      for (const r of results) { if (r) update[r.symbol] = r.qf; }
      if (Object.keys(update).length > 0) {
        setQuarterlyData(prev => ({ ...prev, ...update }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayCount, entries.length, filter]);

  // 날짜별 그룹핑
  const groups: { date: string; label: string; entries: EarningsEntry[] }[] = [];
  let lastDate = "";
  for (const entry of displayed) {
    if (entry.date !== lastDate) {
      lastDate = entry.date;
      const d = new Date(entry.date + "T12:00:00");
      const days = ["일", "월", "화", "수", "목", "금", "토"];
      const today = new Date();
      const isToday = entry.date === today.toISOString().slice(0, 10);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = entry.date === tomorrow.toISOString().slice(0, 10);
      const label = isToday
        ? `오늘 (${d.getMonth() + 1}/${d.getDate()} ${days[d.getDay()]})`
        : isTomorrow
        ? `내일 (${d.getMonth() + 1}/${d.getDate()} ${days[d.getDay()]})`
        : `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
      groups.push({ date: entry.date, label, entries: [] });
    }
    groups[groups.length - 1].entries.push(entry);
  }

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold">실적 발표 일정</h1>
            <p className="text-[10px] text-dark-muted">다가올 실적 발표일 · 한국시간(KST) 기준</p>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400 live-dot" />
            <span className="text-[9px] text-dark-muted">실시간</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {(["favorites", "all", "US", "KR"] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setDisplayCount(30); }}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold transition ${filter === f ? "bg-accent text-white" : "bg-dark-border/50 text-dark-muted"}`}
            >
              {f === "favorites" ? `⭐ 즐겨찾기${watchlist.length > 0 ? ` (${watchlist.length})` : ""}` : f === "all" ? "전체" : f === "US" ? "🇺🇸 미국" : "🇰🇷 한국"}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-dark-muted self-center">{filtered.length}건</span>
        </div>
      </div>

      <div className="px-5 mt-4 fade-in">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-dark-muted">실적 일정 로딩 중...</span>
          </div>
        ) : filter === "favorites" && watchlist.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-muted text-sm">즐겨찾기에 추가된 종목이 없습니다</p>
            <p className="text-[10px] text-dark-muted mt-1">종목 상세 페이지에서 ⭐ 버튼을 눌러 추가하세요</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-dark-muted text-sm">
            {filter === "favorites" ? "즐겨찾기 종목 중 예정된 실적 발표가 없습니다" : "해당 기간에 실적 발표 일정이 없습니다"}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.date}>
                <div className="sticky top-[128px] z-10 bg-dark-bg/95 backdrop-blur-sm py-1.5 -mx-1 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <h2 className="text-xs font-bold text-white">{group.label}</h2>
                    <span className="text-[9px] text-dark-muted">{group.entries.length}건</span>
                  </div>
                </div>

                <div className="space-y-2 mt-2">
                  {group.entries.map((entry, idx) => (
                    <div key={`${entry.symbol}-${idx}`}>
                      <button
                        onClick={() => handleExpand(entry.symbol)}
                        className="w-full text-left bg-dark-card rounded-xl border border-dark-border p-3 active:bg-dark-border/50 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold ${entry.market === "KR" ? "bg-blue-500/20 text-blue-400" : "bg-accent/20 text-accent"}`}>
                              {entry.market === "KR" ? "🇰🇷" : entry.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold">{entry.symbol}</span>
                                {watchlist.includes(entry.symbol) && <span className="text-[9px]">⭐</span>}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                  entry.timeLabel === "장전" ? "bg-amber-500/20 text-amber-400" :
                                  entry.timeLabel === "장후" ? "bg-purple-500/20 text-purple-400" :
                                  "bg-dark-border text-dark-muted"
                                }`}>
                                  {entry.timeLabel}
                                </span>
                              </div>
                              <p className="text-[10px] text-dark-muted">{entry.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-semibold text-accent">{entry.kstDateTime}</p>
                            {entry.fiscalQuarter && (
                              <p className="text-[9px] text-dark-muted">{entry.fiscalQuarter}</p>
                            )}
                          </div>
                        </div>

                        {/* 실적 예측 + 직전 실적 */}
                        <EarningsMetrics entry={entry} qd={quarterlyData[entry.symbol]} />
                      </button>

                      {/* 확장: 분기별 실적 (최신순) */}
                      {expandedSymbol === entry.symbol && (
                        <div className="bg-dark-card/50 border border-dark-border border-t-0 rounded-b-xl p-3 -mt-1">
                          {quarterlyData[entry.symbol] ? (
                            <div>
                              <p className="text-[10px] text-dark-muted font-semibold mb-2">과거 분기별 실적 (최신순)</p>
                              <div className="grid grid-cols-4 gap-1 text-[9px]">
                                <div className="text-dark-muted font-semibold">분기</div>
                                <div className="text-dark-muted font-semibold text-right">매출</div>
                                <div className="text-dark-muted font-semibold text-right">순이익</div>
                                <div className="text-dark-muted font-semibold text-right">EPS</div>
                                {quarterlyData[entry.symbol].map((q, i) => (
                                  <div key={i} className="contents">
                                    <div className="text-dark-muted py-0.5">{q.quarter}</div>
                                    <div className="text-right py-0.5 font-semibold">{formatBigNumber(q.revenue)}</div>
                                    <div className={`text-right py-0.5 font-semibold ${(q.netIncome || 0) >= 0 ? "text-up" : "text-down"}`}>{formatBigNumber(q.netIncome)}</div>
                                    <div className="text-right py-0.5 font-semibold">{q.eps ? `$${q.eps.toFixed(2)}` : "-"}</div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-2 p-2 bg-accent/10 rounded-lg">
                                <p className="text-[10px] text-accent font-semibold">
                                  {entry.fiscalQuarter} 실적은 {entry.kstDateTime}에 발표됩니다
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 py-2">
                              <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                              <span className="text-[10px] text-dark-muted">실적 데이터 로딩 중...</span>
                            </div>
                          )}

                          <Link
                            href={`/stock/${entry.symbol}`}
                            className="block mt-2 text-center text-[10px] text-accent font-semibold py-1.5 bg-accent/10 rounded-lg"
                          >
                            {entry.symbol} 상세 페이지 보기 →
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <div ref={loaderRef} className="flex justify-center py-6">
            <div className="flex items-center gap-2 text-dark-muted text-xs">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#4b5563" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/></svg>
              더 불러오는 중...
            </div>
          </div>
        )}
        {!hasMore && displayed.length > 0 && (
          <p className="text-center text-dark-muted text-[10px] py-6">표시할 일정이 더 없습니다</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

// 실적 예측 + 직전 실적 표시 컴포넌트
function EarningsMetrics({ entry, qd }: { entry: EarningsEntry; qd?: QuarterlyFinancialRow[] }) {
  // qd[0] = 가장 최근 발표된 분기 (직전 분기)
  const prevQ = qd?.[0];
  const hasForecast = entry.epsForecast !== "-";
  const hasPrev = prevQ && (prevQ.eps !== null || prevQ.revenue !== null);

  if (!hasForecast && !hasPrev) return null;

  // 매출 예측: 직전 2분기 추세 기반
  let revForecast: string | null = null;
  if (qd && qd.length >= 2 && qd[0]?.revenue && qd[1]?.revenue && qd[1].revenue > 0) {
    const growth = (qd[0].revenue - qd[1].revenue) / Math.abs(qd[1].revenue);
    const est = qd[0].revenue * (1 + growth);
    revForecast = formatBigNumber(est);
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pt-2 border-t border-dark-border/30">
      {/* 왼쪽: 예측 */}
      <div>
        <p className="text-[8px] text-dark-muted mb-0.5">예측</p>
        <div className="flex items-center gap-2">
          {hasForecast && (
            <div>
              <span className="text-[8px] text-dark-muted">EPS </span>
              <span className="text-[11px] font-bold text-accent">{entry.epsForecast}</span>
            </div>
          )}
          {revForecast && (
            <div>
              <span className="text-[8px] text-dark-muted">매출 </span>
              <span className="text-[11px] font-bold text-accent">{revForecast}</span>
            </div>
          )}
        </div>
      </div>
      {/* 오른쪽: 직전 분기 실적 */}
      {hasPrev && (
        <div>
          <p className="text-[8px] text-dark-muted mb-0.5">직전 ({prevQ.quarter})</p>
          <div className="flex items-center gap-2">
            {prevQ.eps !== null && (
              <div>
                <span className="text-[8px] text-dark-muted">EPS </span>
                <span className="text-[11px] font-bold">${prevQ.eps.toFixed(2)}</span>
              </div>
            )}
            {prevQ.revenue !== null && (
              <div>
                <span className="text-[8px] text-dark-muted">매출 </span>
                <span className="text-[11px] font-bold">{formatBigNumber(prevQ.revenue)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
