"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

interface SearchResult {
  symbol: string;
  name: string;
  type: "stock" | "coin";
  exchange: string;
  exchDisp: string;
}

// Popular Korean & US stocks and coins for trending display
const TRENDING = [
  { symbol: "NVDA", name: "NVIDIA Corp", type: "stock" as const, change: 3.24, href: "/stock/NVDA" },
  { symbol: "BTC", name: "Bitcoin", type: "coin" as const, change: 1.87, href: "/stock/bitcoin" },
  { symbol: "005930", name: "삼성전자", type: "stock" as const, change: -1.12, href: "/stock/005930" },
  { symbol: "TSLA", name: "Tesla Inc", type: "coin" as const, change: -2.15, href: "/stock/TSLA" },
  { symbol: "ETH", name: "Ethereum", type: "coin" as const, change: 2.34, href: "/stock/ethereum" },
  { symbol: "AAPL", name: "Apple Inc", type: "stock" as const, change: 0.52, href: "/stock/AAPL" },
  { symbol: "000660", name: "SK하이닉스", type: "stock" as const, change: 2.84, href: "/stock/000660" },
  { symbol: "SOL", name: "Solana", type: "coin" as const, change: -0.92, href: "/stock/solana" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchApi = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.quotes || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => searchApi(query), 400);
    return () => clearTimeout(timer);
  }, [query, searchApi]);

  function getHref(item: SearchResult) {
    const sym = item.symbol.replace(".KS", "").replace(".KQ", "");
    if (item.type === "coin") {
      const coinMap: Record<string, string> = { "BTC-USD": "bitcoin", "ETH-USD": "ethereum", "SOL-USD": "solana", "XRP-USD": "ripple", "DOGE-USD": "dogecoin", "ADA-USD": "cardano" };
      return `/stock/${coinMap[item.symbol] || sym}`;
    }
    return `/stock/${sym}`;
  }

  return (
    <>
      <div className="min-h-screen pb-24">
        <div className="px-5 pt-12">
          <div className="flex items-center gap-3 mb-5">
            <Link href="/" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            </Link>
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="종목명, 티커, 코인 검색 (예: AAPL, 삼성전자)"
                autoFocus
                className="w-full bg-dark-card border border-dark-border rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-3 top-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          </div>

          {searched ? (
            <div className="space-y-2 fade-in">
              {loading && (
                <div className="flex justify-center py-8">
                  <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#4b5563" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/></svg>
                </div>
              )}
              {!loading && results.length === 0 && <p className="text-dark-muted text-sm text-center py-8">검색 결과가 없습니다</p>}
              {!loading && results.map((r) => (
                <Link key={r.symbol} href={getHref(r)} className="flex items-center justify-between bg-dark-card rounded-xl p-3 border border-dark-border active:bg-dark-border/50 transition">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${r.type === "coin" ? "bg-amber-500/20 text-amber-400" : "bg-accent/20 text-indigo-400"}`}>
                      {r.symbol.replace(".KS", "").replace(".KQ", "").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.symbol.replace(".KS", "").replace(".KQ", "")}</p>
                      <p className="text-[10px] text-dark-muted">{r.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.type === "coin" ? "bg-amber-500/10 text-amber-400" : "bg-accent/10 text-indigo-400"}`}>
                      {r.type === "coin" ? "코인" : r.exchDisp || "주식"}
                    </span>
                  </div>
                </Link>
              ))}
              {!loading && results.length > 0 && (
                <p className="text-center text-dark-muted text-[10px] py-2">Yahoo Finance 제공 · 실시간 검색</p>
              )}
            </div>
          ) : (
            <div className="fade-in">
              <p className="text-xs text-dark-muted mb-3 font-medium">인기 검색어</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["NVDA", "비트코인", "삼성전자", "TSLA", "이더리움", "AAPL", "SK하이닉스", "META"].map((t) => (
                  <button key={t} onClick={() => setQuery(t)} className="px-3 py-1.5 bg-dark-card rounded-full text-xs border border-dark-border hover:border-accent transition">{t}</button>
                ))}
              </div>
              <p className="text-xs text-dark-muted mb-3 font-medium">인기 종목</p>
              <div className="space-y-2">
                {TRENDING.map((t, i) => (
                  <Link key={t.symbol} href={t.href} className="flex items-center justify-between bg-dark-card rounded-xl p-3 border border-dark-border active:bg-dark-border/50 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-dark-muted text-xs w-5 text-center font-medium">{i + 1}</span>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold ${t.change >= 0 ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>
                        {t.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{t.symbol}</span>
                        <span className="text-[10px] text-dark-muted ml-2">{t.name}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${t.change >= 0 ? "text-up" : "text-down"}`}>{t.change >= 0 ? "+" : ""}{t.change.toFixed(2)}%</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
