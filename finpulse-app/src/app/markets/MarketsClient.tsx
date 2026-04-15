"use client";
import { useState } from "react";
import Link from "next/link";
import { CoinData, StockData } from "@/lib/api";

export default function MarketsClient({ coins, stocks }: { coins: CoinData[]; stocks: StockData[] }) {
  const [tab, setTab] = useState<"stocks" | "coins" | "indices">("stocks");
  const usStocks = stocks.filter((s) => s.market === "NASDAQ" || s.market === "NYSE");
  const krStocks = stocks.filter((s) => s.market === "KOSPI" || s.market === "KOSDAQ");

  const indices = [
    { name: "S&P 500", market: "미국", price: "5,842.30", change: 0.82 },
    { name: "NASDAQ", market: "미국", price: "18,432.10", change: 1.23 },
    { name: "KOSPI", market: "한국", price: "2,648.20", change: -0.34 },
    { name: "KOSDAQ", market: "한국", price: "842.30", change: 0.56 },
    { name: "Nikkei 225", market: "일본", price: "38,920.50", change: 0.45 },
    { name: "항셍지수", market: "홍콩", price: "22,108.70", change: -1.12 },
    { name: "DAX", market: "독일", price: "18,234.50", change: 0.33 },
  ];

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3">
        <h1 className="text-lg font-bold">마켓</h1>
        <div className="flex gap-2 mt-3">
          {(["stocks", "coins", "indices"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-xs px-4 py-2 rounded-full font-medium transition ${tab === t ? "bg-accent text-white" : "bg-dark-border text-dark-muted"}`}>
              {t === "stocks" ? `주식 (${usStocks.length + krStocks.length})` : t === "coins" ? `코인 (${coins.length})` : "지수"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-3 space-y-2 fade-in">
        {tab === "stocks" && (
          <>
            <p className="text-xs text-dark-muted mb-2">🇺🇸 미국 주식 · {usStocks.length}종목</p>
            {usStocks.map((s) => (
              <Link key={s.symbol} href={`/stock/${s.symbol}`} className="flex items-center justify-between bg-dark-card rounded-xl p-4 border border-dark-border active:bg-dark-border/50 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${s.change_percent >= 0 ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>{s.symbol.slice(0, 2)}</div>
                  <div><p className="font-semibold text-sm">{s.symbol}</p><p className="text-[11px] text-dark-muted">{s.name}</p></div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">${s.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <span className={`text-xs ${s.change_percent >= 0 ? "text-up" : "text-down"}`}>{s.change_percent >= 0 ? "+" : ""}{s.change_percent.toFixed(2)}%</span>
                </div>
              </Link>
            ))}
            <p className="text-xs text-dark-muted mt-4 mb-2">🇰🇷 국내 주식 · {krStocks.length}종목</p>
            {krStocks.map((s) => (
              <Link key={s.symbol} href={`/stock/${s.symbol}`} className="flex items-center justify-between bg-dark-card rounded-xl p-4 border border-dark-border active:bg-dark-border/50 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${s.change_percent >= 0 ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>{s.name.slice(0, 2)}</div>
                  <div><p className="font-semibold text-sm">{s.name}</p><p className="text-[11px] text-dark-muted">{s.symbol}</p></div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{s.price.toLocaleString()}원</p>
                  <span className={`text-xs ${s.change_percent >= 0 ? "text-up" : "text-down"}`}>{s.change_percent >= 0 ? "+" : ""}{s.change_percent.toFixed(2)}%</span>
                </div>
              </Link>
            ))}
          </>
        )}
        {tab === "coins" && (
          <>
            <p className="text-xs text-dark-muted mb-2">시가총액 상위 · 실시간 (CoinGecko)</p>
            {coins.map((c) => (
              <Link key={c.id} href={`/stock/${c.id}`} className="flex items-center justify-between bg-dark-card rounded-xl p-4 border border-dark-border active:bg-dark-border/50 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${(c.price_change_percentage_24h ?? 0) >= 0 ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>{c.symbol.toUpperCase().slice(0, 3)}</div>
                  <div><p className="font-semibold text-sm">{c.name}</p><p className="text-[11px] text-dark-muted">{c.symbol.toUpperCase()}</p></div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">${c.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  <span className={`text-xs ${(c.price_change_percentage_24h ?? 0) >= 0 ? "text-up" : "text-down"}`}>{(c.price_change_percentage_24h ?? 0) >= 0 ? "+" : ""}{(c.price_change_percentage_24h ?? 0).toFixed(2)}%</span>
                </div>
              </Link>
            ))}
          </>
        )}
        {tab === "indices" && (
          <>
            <p className="text-xs text-dark-muted mb-2">주요 글로벌 지수</p>
            {indices.map((idx) => (
              <div key={idx.name} className="flex items-center justify-between bg-dark-card rounded-xl p-4 border border-dark-border">
                <div><p className="font-semibold text-sm">{idx.name}</p><p className="text-[11px] text-dark-muted">{idx.market}</p></div>
                <div className="text-right">
                  <p className="font-semibold text-sm">{idx.price}</p>
                  <span className={`text-xs ${idx.change >= 0 ? "text-up" : "text-down"}`}>{idx.change >= 0 ? "+" : ""}{idx.change}%</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
