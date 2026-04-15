"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import SparkLine from "@/components/SparkLine";
import { CoinData, StockData, NewsItem } from "@/lib/api";
import { getWatchlist } from "@/lib/store";

interface IndexData {
  symbol: string;
  name: string;
  nameKr: string;
  price: string;
  change: string;
  changePct: string;
  isUp: boolean;
  currency: string;
}

function formatPrice(price: number, currency: string = "$") {
  if (currency === "₩") return `${price.toLocaleString()}원`;
  if (price >= 1000) return `${currency}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `${currency}${price.toFixed(2)}`;
  return `${currency}${price.toFixed(4)}`;
}

const NEWS_PER_PAGE = 5;

export default function HomeClient({ initialCoins, stocks }: { initialCoins: CoinData[]; stocks: StockData[]; initialNews?: NewsItem[] }) {
  const [filter, setFilter] = useState<"all" | "reuters" | "investing" | "financialjuice">("all");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [newsCount, setNewsCount] = useState(NEWS_PER_PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  // 관심종목: 초기 로드 + 페이지 포커스/네비게이션 시 갱신
  useEffect(() => {
    const refresh = () => setWatchlist(getWatchlist());
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("watchlist-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("watchlist-changed", refresh);
    };
  }, []);

  // 실시간 지수 데이터
  useEffect(() => {
    async function loadIndices() {
      try {
        const res = await fetch("/api/indices");
        if (!res.ok) throw new Error("fail");
        const data = await res.json();
        setIndices(data.indices || []);
      } catch { /* ignore */ }
      setIndicesLoading(false);
    }
    loadIndices();
    const interval = setInterval(loadIndices, 120000); // 2분마다 갱신
    return () => clearInterval(interval);
  }, []);

  // 실시간 뉴스 (새 API에서 가져옴)
  interface LiveNewsItem {
    id: string;
    title: string;
    titleOriginal: string;
    summary: string;
    source: string;
    sourceCategory: "reuters" | "investing" | "financialjuice";
    time: string;
    pubDate: string;
    link: string;
    imageUrl: string | null;
  }
  const [liveNews, setLiveNews] = useState<LiveNewsItem[]>([]);
  const [liveNewsLoading, setLiveNewsLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) throw new Error("fail");
        const data = await res.json();
        setLiveNews(data.news || []);
      } catch { /* ignore */ }
      setLiveNewsLoading(false);
    }
    loadNews();
    const interval = setInterval(loadNews, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);

  // 뉴스 필터
  const filteredNews = filter === "all"
    ? liveNews
    : filter === "reuters"
    ? liveNews.filter(n => n.sourceCategory === "reuters")
    : filter === "investing"
    ? liveNews.filter(n => n.sourceCategory === "investing")
    : liveNews.filter(n => n.sourceCategory === "financialjuice");
  const displayedNews = filteredNews.slice(0, newsCount);
  const hasMore = newsCount < filteredNews.length;

  // Infinite scroll observer
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      setNewsCount((prev) => prev + NEWS_PER_PAGE);
      setLoadingMore(false);
    }, 300);
  }, [hasMore, loadingMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  // Reset news count on filter change
  useEffect(() => { setNewsCount(NEWS_PER_PAGE); }, [filter]);

  // Build watchlist items - 프리로드 + 동적 fetch 병합
  interface WatchItem {
    type: "stock" | "coin";
    symbol: string;
    name: string;
    price: string;
    change: number;
    sparkData: number[] | null;
    href: string;
  }
  const [dynamicWatchItems, setDynamicWatchItems] = useState<Record<string, WatchItem>>({});

  // 프리로드 데이터에 없는 watchlist 심볼을 동적으로 fetch
  useEffect(() => {
    const missing = watchlist.filter(sym => {
      const hasStock = stocks.some(s => s.symbol === sym);
      const hasCoin = initialCoins.some(c => c.id === sym || c.symbol === sym.toLowerCase());
      return !hasStock && !hasCoin && !dynamicWatchItems[sym];
    });
    if (missing.length === 0) return;

    missing.forEach(async (sym) => {
      try {
        const res = await fetch(`/api/stock-info/${encodeURIComponent(sym)}`);
        if (!res.ok) return;
        const data = await res.json();
        const isKr = /^\d{6}$/.test(sym);
        const currency = isKr ? "₩" : "$";
        const price = data.currentPrice || 0;
        const change = data.changePercent || 0;
        setDynamicWatchItems(prev => ({
          ...prev,
          [sym]: {
            type: "stock",
            symbol: sym,
            name: data.companyProfile?.description?.split(/[.,]/)[0]?.slice(0, 20) || data.yahooSymbol || sym,
            price: price > 0 ? formatPrice(price, currency) : "-",
            change,
            sparkData: null,
            href: `/stock/${sym}`,
          }
        }));
      } catch { /* ignore */ }
    });
  }, [watchlist, stocks, initialCoins, dynamicWatchItems]);

  const watchItems = watchlist.map((sym) => {
    const stock = stocks.find((s) => s.symbol === sym);
    if (stock) return { type: "stock" as const, symbol: stock.symbol, name: stock.name, price: formatPrice(stock.price, stock.currency), change: stock.change_percent, sparkData: null, href: `/stock/${stock.symbol}` };
    const coin = initialCoins.find((c) => c.id === sym || c.symbol === sym.toLowerCase());
    if (coin) return { type: "coin" as const, symbol: coin.symbol.toUpperCase(), name: coin.name, price: formatPrice(coin.current_price), change: coin.price_change_percentage_24h ?? 0, sparkData: coin.sparkline_in_7d?.price?.slice(-48) || null, href: `/stock/${coin.id}` };
    // 동적으로 가져온 데이터
    if (dynamicWatchItems[sym]) return dynamicWatchItems[sym];
    // 아직 로딩 중인 항목도 플레이스홀더로 표시
    return { type: "stock" as const, symbol: sym, name: sym, price: "...", change: 0, sparkData: null, href: `/stock/${sym}` };
  });

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일 ${["일", "월", "화", "수", "목", "금", "토"][today.getDay()]}요일`;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* FinPulse Brand Icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-lg shadow-accent/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 17L7 13L11 16L15 8L21 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="21" cy="12" r="2" fill="#22c55e"/>
              <path d="M3 21h18" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight">
              <span className="text-white">Fin</span><span className="text-accent">Pulse</span>
            </h1>
            <p className="text-[10px] text-dark-muted -mt-0.5">{dateStr}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/search" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </Link>
          <div className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
          </div>
        </div>
      </div>

      <div className="px-5 mt-3 space-y-5 fade-in">
        {/* Morning Brief - 실시간 지수 */}
        <div className="bg-gradient-to-br from-indigo-950 to-indigo-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-3 right-4 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
            <span className="text-[10px] text-green-400 font-medium">LIVE</span>
          </div>
          <p className="text-indigo-300 text-xs font-semibold mb-3">MARKET OVERVIEW</p>
          {indicesLoading ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-indigo-300">실시간 시세 불러오는 중...</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {indices.map((idx) => (
                <div key={idx.symbol} className="bg-white/5 rounded-xl px-2.5 py-2">
                  <p className="text-[10px] text-indigo-300 font-medium truncate">{idx.nameKr}</p>
                  <p className="text-xs font-bold mt-0.5">{idx.currency === "$" ? "$" : ""}{idx.price}{idx.currency === "₩" ? "" : ""}</p>
                  <p className={`text-[10px] font-semibold mt-0.5 ${idx.isUp ? "text-up" : "text-down"}`}>
                    {idx.changePct}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">관심 종목</h3>
            <Link href="/search" className="text-xs text-accent font-medium">+ 추가</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
            {watchItems.map((item) => (
              <Link key={item.symbol} href={item.href} className="min-w-[140px] bg-dark-card rounded-2xl p-4 border border-dark-border flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${item.change >= 0 ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>
                    {item.symbol.slice(0, 2)}
                  </div>
                  <span className="text-xs font-semibold">{item.symbol}</span>
                </div>
                <p className="font-bold text-sm">{item.price}</p>
                <p className={`text-xs mt-0.5 ${item.change >= 0 ? "text-up" : "text-down"}`}>{item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%</p>
                {item.sparkData && <div className="mt-2"><SparkLine data={item.sparkData} color={item.change >= 0 ? "#22c55e" : "#ef4444"} /></div>}
              </Link>
            ))}
            <Link href="/search" className="min-w-[60px] bg-dark-card rounded-2xl border border-dashed border-dark-border flex-shrink-0 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            </Link>
          </div>
        </div>

        {/* Global News */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm">글로벌 뉴스</h3>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
                <span className="text-[9px] text-dark-muted">실시간</span>
              </div>
            </div>
            <div className="flex gap-1">
              {(["all", "reuters", "investing", "financialjuice"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`text-[10px] px-2 py-1 rounded-full font-semibold transition ${filter === f ? "bg-accent text-white" : "bg-dark-card text-dark-muted"}`}>
                  {f === "all" ? "전체" : f === "reuters" ? "로이터" : f === "investing" ? "Investing" : "글로벌"}
                </button>
              ))}
            </div>
          </div>

          {liveNewsLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-dark-muted">뉴스 불러오는 중...</span>
            </div>
          ) : displayedNews.length === 0 ? (
            <div className="text-center py-8 text-dark-muted text-xs">뉴스를 불러오지 못했습니다</div>
          ) : (
            displayedNews.map((n) => {
              const newsUrl = `/news-view?title=${encodeURIComponent(n.title)}&titleOriginal=${encodeURIComponent(n.titleOriginal)}&source=${encodeURIComponent(n.source)}&time=${encodeURIComponent(n.time)}&link=${encodeURIComponent(n.link)}`;
              return (
                <Link key={n.id} href={newsUrl}
                  className="block bg-dark-card rounded-2xl p-4 border border-dark-border mb-3 active:bg-dark-border/50 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                      n.sourceCategory === "reuters" ? "bg-orange-500/20 text-orange-400" :
                      n.sourceCategory === "investing" ? "bg-cyan-500/20 text-cyan-400" :
                      "bg-accent/20 text-indigo-400"
                    }`}>
                      {n.source}
                    </span>
                    <span className="text-[10px] text-dark-muted truncate">{n.time}</span>
                  </div>
                  <h4 className="font-semibold text-sm leading-snug">{n.title}</h4>
                </Link>
              );
            })
          )}

          {/* Infinite scroll loader */}
          {hasMore && (
            <div ref={loaderRef} className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-dark-muted text-xs">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#4b5563" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/></svg>
                더 불러오는 중...
              </div>
            </div>
          )}
          {!hasMore && displayedNews.length > 0 && (
            <p className="text-center text-dark-muted text-[10px] py-4">오늘의 뉴스를 모두 확인했습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
