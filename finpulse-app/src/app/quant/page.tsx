"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { STRATEGIES, generateSignals, type OHLCV } from "@/lib/quant";
import { getDefaultParams } from "@/lib/backtest";
import { getPortfolio, getPortfolioStats, type Portfolio } from "@/lib/portfolio-store";
import { getWatchlist } from "@/lib/store";

const KNOWN_NAMES: Record<string, string> = {
  AAPL: "Apple", NVDA: "NVIDIA", MSFT: "Microsoft", TSLA: "Tesla",
  GOOG: "Google", AMZN: "Amazon", META: "Meta", NFLX: "Netflix",
  AMD: "AMD", INTC: "Intel", "005930": "삼성전자", "000660": "SK하이닉스",
  "035420": "NAVER", "035720": "카카오", bitcoin: "Bitcoin", ethereum: "Ethereum",
};

interface SignalSummary {
  symbol: string;
  name: string;
  price: number;
  signals: { strategy: string; type: "buy" | "sell"; strength: string }[];
  consensus: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
}

export default function QuantPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [signalSummaries, setSignalSummaries] = useState<SignalSummary[]>([]);
  const [signalLoading, setSignalLoading] = useState(true);

  useEffect(() => {
    setPortfolio(getPortfolio());
  }, []);

  // 즐겨찾기 종목에 대해 모든 전략의 시그널을 분석
  const loadSignalSummaries = useCallback(async () => {
    const wl = getWatchlist();
    if (wl.length === 0) { setSignalLoading(false); return; }

    const summaries: SignalSummary[] = [];
    for (const sym of wl.slice(0, 8)) {
      try {
        const res = await fetch(`/api/chart/${encodeURIComponent(sym)}?range=3mo&interval=1d`);
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.candles?.length) continue;

        const candles: OHLCV[] = data.candles;
        const lastPrice = candles[candles.length - 1].close;
        const stratSignals: SignalSummary["signals"] = [];

        for (const strat of STRATEGIES) {
          const params = getDefaultParams(strat.id);
          const sigs = generateSignals(strat.id, candles, params);
          // 최근 5일 이내 시그널만
          const recent = sigs.filter(s => {
            const daysDiff = (candles[candles.length - 1].time - s.time) / 86400;
            return daysDiff <= 5;
          });
          if (recent.length > 0) {
            const last = recent[recent.length - 1];
            stratSignals.push({ strategy: strat.name, type: last.type, strength: last.strength });
          }
        }

        // 컨센서스 결정
        const buys = stratSignals.filter(s => s.type === "buy").length;
        const sells = stratSignals.filter(s => s.type === "sell").length;
        let consensus: SignalSummary["consensus"] = "neutral";
        if (buys >= 3) consensus = "strong_buy";
        else if (buys >= 2) consensus = "buy";
        else if (sells >= 3) consensus = "strong_sell";
        else if (sells >= 2) consensus = "sell";

        summaries.push({
          symbol: sym,
          name: KNOWN_NAMES[sym] || sym,
          price: lastPrice,
          signals: stratSignals,
          consensus,
        });
      } catch { continue; }
    }
    setSignalSummaries(summaries);
    setSignalLoading(false);
  }, []);

  useEffect(() => { loadSignalSummaries(); }, [loadSignalSummaries]);

  const stats = portfolio ? getPortfolioStats(portfolio) : null;

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-4">
        <h1 className="text-lg font-bold">퀀트 투자</h1>
        <p className="text-xs text-dark-muted mt-0.5">자동 매매 전략 &amp; 백테스트</p>
      </div>

      <div className="px-5 mt-4 fade-in">
        {/* 포트폴리오 요약 */}
        <div className="bg-gradient-to-br from-accent/20 to-purple-600/20 rounded-2xl p-4 border border-accent/30 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-dark-muted">모의투자 포트폴리오</span>
            <Link href="/quant/portfolio" className="text-[10px] text-accent font-semibold">
              상세보기 &rarr;
            </Link>
          </div>
          <div className="text-2xl font-extrabold mb-1">
            {stats ? `${Math.round(stats.totalValue).toLocaleString()}원` : "₩100,000,000"}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${(stats?.totalReturn ?? 0) >= 0 ? "text-up" : "text-down"}`}>
              {stats ? `${stats.totalReturn >= 0 ? "+" : ""}${stats.totalReturn.toFixed(2)}%` : "+0.00%"}
            </span>
            <span className={`text-xs ${(stats?.totalPnL ?? 0) >= 0 ? "text-up" : "text-down"}`}>
              {stats ? `${stats.totalPnL >= 0 ? "+" : ""}${Math.round(stats.totalPnL).toLocaleString()}원` : "0원"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/10">
            <div>
              <p className="text-[10px] text-dark-muted">보유 종목</p>
              <p className="text-sm font-bold">{stats?.positionCount ?? 0}개</p>
            </div>
            <div>
              <p className="text-[10px] text-dark-muted">활성 전략</p>
              <p className="text-sm font-bold">{portfolio?.activeStrategies.length ?? 0}개</p>
            </div>
            <div>
              <p className="text-[10px] text-dark-muted">총 거래</p>
              <p className="text-sm font-bold">{stats?.tradeCount ?? 0}회</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Link href="/quant/strategies" className="bg-dark-card rounded-xl p-3 border border-dark-border text-center active:bg-dark-border/50 transition">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center mx-auto mb-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            </div>
            <p className="text-[10px] font-semibold">전략</p>
          </Link>
          <Link href="/quant/portfolio" className="bg-dark-card rounded-xl p-3 border border-dark-border text-center active:bg-dark-border/50 transition">
            <div className="w-8 h-8 rounded-lg bg-up/20 flex items-center justify-center mx-auto mb-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
            </div>
            <p className="text-[10px] font-semibold">포트폴리오</p>
          </Link>
          <Link href="/quant/signals" className="bg-dark-card rounded-xl p-3 border border-dark-border text-center active:bg-dark-border/50 transition">
            <div className="w-8 h-8 rounded-lg bg-down/20 flex items-center justify-center mx-auto mb-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
            <p className="text-[10px] font-semibold">시그널</p>
          </Link>
        </div>

        {/* 즐겨찾기 종목 시그널 요약 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm">내 종목 시그널</h2>
            <Link href="/quant/signals" className="text-[10px] text-accent font-semibold">상세보기 &rarr;</Link>
          </div>
          {signalLoading ? (
            <div className="flex items-center gap-2 py-6 justify-center">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-dark-muted">시그널 분석 중...</span>
            </div>
          ) : signalSummaries.length === 0 ? (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border text-center">
              <p className="text-xs text-dark-muted">즐겨찾기에 종목을 추가하면 자동 시그널 분석이 시작됩니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {signalSummaries.map((s) => {
                const consensusMap: Record<string, { label: string; color: string; bg: string }> = {
                  strong_buy: { label: "적극 매수", color: "text-up", bg: "bg-up/20" },
                  buy: { label: "매수", color: "text-up", bg: "bg-up/10" },
                  neutral: { label: "관망", color: "text-dark-muted", bg: "bg-dark-border/50" },
                  sell: { label: "매도", color: "text-down", bg: "bg-down/10" },
                  strong_sell: { label: "적극 매도", color: "text-down", bg: "bg-down/20" },
                };
                const c = consensusMap[s.consensus];
                return (
                  <Link key={s.symbol} href={`/stock/${s.symbol}`}
                    className="flex items-center gap-3 bg-dark-card rounded-xl p-3 border border-dark-border active:bg-dark-border/50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold">{s.name}</p>
                        <span className="text-[10px] text-dark-muted">{s.symbol}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.signals.map((sig, i) => (
                          <span key={i} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${sig.type === "buy" ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>
                            {sig.strategy} {sig.type === "buy" ? "매수" : "매도"}
                          </span>
                        ))}
                        {s.signals.length === 0 && (
                          <span className="text-[9px] text-dark-muted">최근 시그널 없음</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${c.bg} ${c.color}`}>
                        {c.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 전략 라이브러리 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm">매매 전략</h2>
            <Link href="/quant/strategies" className="text-[10px] text-accent font-semibold">
              전체보기 &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {STRATEGIES.map((s) => {
              const isActive = portfolio?.activeStrategies.includes(s.id);
              return (
                <Link
                  key={s.id}
                  href={`/quant/strategies/${s.id}`}
                  className="flex items-center gap-3 bg-dark-card rounded-xl p-3.5 border border-dark-border active:bg-dark-border/50 transition"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: `${s.color}20`, color: s.color }}
                  >
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{s.name}</p>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-up/20 text-up">활성</span>
                      )}
                    </div>
                    <p className="text-[10px] text-dark-muted mt-0.5 line-clamp-1">{s.description}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 최근 거래 */}
        {portfolio && portfolio.trades.length > 0 && (
          <div>
            <h2 className="font-bold text-sm mb-3">최근 거래</h2>
            {portfolio.trades.slice(-5).reverse().map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-dark-card rounded-xl p-3 border border-dark-border mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.type === "buy" ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>
                    {t.type === "buy" ? "매수" : "매도"}
                  </span>
                  <div>
                    <p className="text-xs font-semibold">{t.symbol}</p>
                    <p className="text-[10px] text-dark-muted">{new Date(t.time).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">{t.price.toLocaleString()}원</p>
                  <p className="text-[10px] text-dark-muted">{t.quantity}주</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
