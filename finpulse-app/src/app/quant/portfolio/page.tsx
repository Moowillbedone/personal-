"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getPortfolio, getPortfolioStats, resetPortfolio, type Portfolio } from "@/lib/portfolio-store";

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    setPortfolio(getPortfolio());
  }, []);

  const stats = portfolio ? getPortfolioStats(portfolio) : null;

  function handleReset() {
    const p = resetPortfolio();
    setPortfolio(p);
    setShowReset(false);
  }

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/quant" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div>
            <h1 className="text-sm font-semibold">모의투자 포트폴리오</h1>
            <p className="text-[10px] text-dark-muted">Paper Trading</p>
          </div>
        </div>
        <button
          onClick={() => setShowReset(true)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-dark-border text-dark-muted"
        >
          초기화
        </button>
      </div>

      <div className="px-5 mt-4 fade-in">
        {/* 총 자산 */}
        <div className="bg-gradient-to-br from-accent/20 to-purple-600/20 rounded-2xl p-5 border border-accent/30 mb-5">
          <p className="text-xs text-dark-muted mb-1">총 평가자산</p>
          <p className="text-3xl font-extrabold mb-1">
            {stats ? `${Math.round(stats.totalValue).toLocaleString()}원` : "0원"}
          </p>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${(stats?.totalReturn ?? 0) >= 0 ? "text-up" : "text-down"}`}>
              {stats ? `${stats.totalReturn >= 0 ? "+" : ""}${stats.totalReturn.toFixed(2)}%` : "0.00%"}
            </span>
            <span className={`text-xs ${(stats?.totalPnL ?? 0) >= 0 ? "text-up" : "text-down"}`}>
              {stats ? `${stats.totalPnL >= 0 ? "+" : ""}${Math.round(stats.totalPnL).toLocaleString()}원` : "0원"}
            </span>
          </div>
        </div>

        {/* 자산 구성 */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-dark-card rounded-xl p-3 border border-dark-border">
            <p className="text-[10px] text-dark-muted mb-1">현금</p>
            <p className="text-sm font-bold">{portfolio ? `${Math.round(portfolio.cash).toLocaleString()}원` : "0원"}</p>
          </div>
          <div className="bg-dark-card rounded-xl p-3 border border-dark-border">
            <p className="text-[10px] text-dark-muted mb-1">주식 평가액</p>
            <p className="text-sm font-bold">{stats ? `${Math.round(stats.totalPositionValue).toLocaleString()}원` : "0원"}</p>
          </div>
        </div>

        {/* 보유 종목 */}
        <div className="mb-5">
          <h2 className="font-bold text-sm mb-3">보유 종목</h2>
          {(!portfolio || portfolio.positions.length === 0) ? (
            <div className="bg-dark-card rounded-xl p-6 border border-dark-border text-center">
              <p className="text-sm text-dark-muted mb-2">보유 종목이 없습니다</p>
              <p className="text-[10px] text-dark-muted">전략 백테스트를 실행하면 자동으로 매매가 진행됩니다</p>
              <Link href="/quant/strategies" className="inline-block mt-3 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold">
                전략 둘러보기
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {portfolio.positions.map((p) => {
                const pnl = (p.currentPrice - p.avgPrice) * p.quantity;
                const pnlPct = ((p.currentPrice - p.avgPrice) / p.avgPrice) * 100;
                return (
                  <div key={p.symbol} className="bg-dark-card rounded-xl p-3.5 border border-dark-border">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold">{p.symbol}</p>
                        <p className="text-[10px] text-dark-muted">{p.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{Math.round(p.currentPrice * p.quantity).toLocaleString()}원</p>
                        <p className={`text-[10px] font-semibold ${pnl >= 0 ? "text-up" : "text-down"}`}>
                          {pnl >= 0 ? "+" : ""}{Math.round(pnl).toLocaleString()}원 ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-dark-muted">
                      <span>{p.quantity}주</span>
                      <span>평균 {p.avgPrice.toLocaleString()}원</span>
                      <span>현재 {p.currentPrice.toLocaleString()}원</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 거래 내역 */}
        <div>
          <h2 className="font-bold text-sm mb-3">거래 내역</h2>
          {(!portfolio || portfolio.trades.length === 0) ? (
            <div className="bg-dark-card rounded-xl p-6 border border-dark-border text-center">
              <p className="text-sm text-dark-muted">아직 거래 내역이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {portfolio.trades.slice().reverse().map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-dark-card rounded-xl px-3 py-2.5 border border-dark-border">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.type === "buy" ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>
                      {t.type === "buy" ? "매수" : "매도"}
                    </span>
                    <div>
                      <p className="text-xs font-semibold">{t.symbol}</p>
                      <p className="text-[10px] text-dark-muted">{new Date(t.time).toLocaleDateString()} · {t.strategyId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold">{t.price.toLocaleString()}원</p>
                    <p className="text-[10px] text-dark-muted">{t.quantity}주 · {Math.round(t.total).toLocaleString()}원</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 초기화 모달 */}
      {showReset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5" onClick={() => setShowReset(false)}>
          <div className="bg-dark-card rounded-2xl p-5 w-full max-w-sm border border-dark-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm mb-2">포트폴리오 초기화</h3>
            <p className="text-xs text-dark-muted mb-4">모든 보유 종목과 거래 내역이 삭제되고 자본금이 1억원으로 초기화됩니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowReset(false)} className="flex-1 py-2.5 rounded-xl bg-dark-border text-sm font-semibold">취소</button>
              <button onClick={handleReset} className="flex-1 py-2.5 rounded-xl bg-down text-white text-sm font-semibold">초기화</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
