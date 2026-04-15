"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CoinData, StockData, NewsItem } from "@/lib/api";
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/store";
import PriceAlertModal from "@/components/PriceAlertModal";

const StockChart = dynamic(() => import("@/components/StockChart"), { ssr: false });

interface StockInfo {
  currentPrice: number | null;
  changePercent: number | null;
  marketCap: number | null;
  per: number | null;
  forwardPer: number | null;
  pbr: number | null;
  psr: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dividendYield: number | null;
  dividendRate: number | null;
  dividends: { date: string; amount: number }[];
  exDividendDate: string | null;
  earningsDate: string | null;
  latestQuarter: {
    quarter: string | null;
    revenue: number | null;
    netIncome: number | null;
    eps: number | null;
    netProfitMargin: number | null;
    ebitda: number | null;
    totalAssets: number | null;
    totalEquity: number | null;
    totalLiabilities: number | null;
    cashAndInvestments: number | null;
    returnOnAssets: number | null;
    returnOnCapital: number | null;
    freeCashFlow: number | null;
    cashFromOperations: number | null;
  } | null;
  companyProfile: {
    sector: string | null;
    industry: string | null;
    description: string | null;
    website: string | null;
    employees: number | null;
    country: string | null;
    ceo: string | null;
    headquarters: string | null;
  };
  profitMargin: number | null;
  earnings: { date: string; eps: number | null; epsEstimate: number | null; surprise: number | null }[];
  quarterlyRevenue: { date: string; revenue: number; earnings: number }[];
  recommendation: string | null;
  targetPrice: number | null;
  roe: number | null;
  debtToEquity: number | null;
  operatingMargin: number | null;
  revenueGrowth: number | null;
  quarterlyFinancials: {
    quarter: string;
    revenue: number | null;
    netIncome: number | null;
    eps: number | null;
    ebitda: number | null;
    grossProfit: number | null;
    operatingIncome: number | null;
  }[];
}

function formatBigNumber(n: number | null): string {
  if (n === null || n === 0) return "-";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(0)}억`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  return n.toLocaleString();
}

export default function StockDetailClient({ symbol, coins, stocks, news }: { symbol: string; coins: CoinData[]; stocks: StockData[]; news: NewsItem[] }) {
  const [starred, setStarred] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [toast, setToast] = useState("");
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);

  const stock = stocks.find((s) => s.symbol === symbol);
  const coin = coins.find((c) => c.id === symbol || c.symbol === symbol.toLowerCase());

  const isCrypto = !!coin;
  const displayName = stock?.name || coin?.name || symbol;
  const displaySymbol = stock?.symbol || coin?.symbol.toUpperCase() || symbol;
  const price = info?.currentPrice || stock?.price || coin?.current_price || 0;
  const change = info?.changePercent || stock?.change_percent || coin?.price_change_percentage_24h || 0;
  const currency = stock?.currency || (symbol.match(/^\d{6}$/) ? "₩" : "$");
  const market = stock?.market || (coin ? "Crypto" : "");
  useEffect(() => { setStarred(isInWatchlist(stock ? symbol : coin?.id || symbol)); }, [symbol, stock, coin]);

  // Fetch detailed stock info
  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch(`/api/stock-info/${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error("fail");
        const data = await res.json();
        setInfo(data);
      } catch { /* ignore */ }
      setInfoLoading(false);
    }
    loadInfo();
  }, [symbol]);

  function toggleStar() {
    const key = stock ? symbol : coin?.id || symbol;
    if (starred) { removeFromWatchlist(key); } else { addToWatchlist(key); }
    setStarred(!starred);
  }

  function handleAlertConfirm() {
    setShowAlert(false);
    setToast(`${displaySymbol} 알림이 설정되었습니다`);
    setTimeout(() => setToast(""), 3000);
  }

  const relatedNews = news.filter((n) => n.relatedTickers.some((t) => t.symbol === displaySymbol || t.symbol === stock?.symbol || t.symbol === coin?.id));
  const priceStr = currency === "₩"
    ? `${price.toLocaleString()}원`
    : `${currency}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const changeAmt = currency === "₩"
    ? `${change >= 0 ? "+" : ""}${(price * change / 100).toFixed(0)}원`
    : `${change >= 0 ? "+" : ""}${currency}${Math.abs(price * change / 100).toFixed(2)}`;

  const tvMarket = isCrypto ? "Crypto" : market;

  const recMap: Record<string, { label: string; color: string }> = {
    "strong_buy": { label: "적극 매수", color: "text-up" },
    "buy": { label: "매수", color: "text-up" },
    "hold": { label: "보유", color: "text-yellow-400" },
    "sell": { label: "매도", color: "text-down" },
    "strong_sell": { label: "적극 매도", color: "text-down" },
  };

  // 52주 범위 퍼센트 (현재가 기준)
  const w52High = info?.fiftyTwoWeekHigh || (stock?.high_52w && stock.high_52w > 0 ? stock.high_52w : null);
  const w52Low = info?.fiftyTwoWeekLow || (stock?.low_52w && stock.low_52w > 0 ? stock.low_52w : null);
  const w52Pct = (w52High && w52Low && price > 0)
    ? ((price - w52Low) / (w52High - w52Low)) * 100
    : null;

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/markets" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div>
            <h1 className="text-sm font-semibold">{displaySymbol}</h1>
            <p className="text-[10px] text-dark-muted">{displayName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleStar} className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={starred ? "#6366f1" : "none"} stroke="#6366f1" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button onClick={() => setShowAlert(true)} className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
        </div>
      </div>

      <div className="px-5 mt-4 fade-in">
        {/* Price */}
        {price > 0 ? (
          <div className="mb-5">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-extrabold">{priceStr}</span>
              <span className={`text-sm font-semibold mb-1 ${change >= 0 ? "text-up" : "text-down"}`}>{changeAmt} ({change >= 0 ? "+" : ""}{change.toFixed(2)}%)</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 live-dot" />
                <span className="text-[10px] text-dark-muted">
                  {isCrypto ? "실시간 · CoinGecko" : `실시간 · ${market || "Google Finance"}`}
                </span>
              </div>
              {info?.recommendation && recMap[info.recommendation] && (
                <span className={`text-[10px] font-semibold ${recMap[info.recommendation].color}`}>
                  {recMap[info.recommendation].label}
                  {info.targetPrice ? ` · 목표가 $${info.targetPrice.toFixed(0)}` : ""}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <div className="text-xl font-semibold text-dark-muted mb-1">{displaySymbol}</div>
            <p className="text-xs text-dark-muted">가격 데이터를 가져오는 중이거나 지원하지 않는 종목입니다.</p>
          </div>
        )}

        {/* 차트 */}
        <div className="mb-5">
          <StockChart symbol={symbol} market={tvMarket} />
        </div>

        {/* 핵심 재무지표 */}
        <div className="mb-5">
          <h3 className="font-bold text-sm mb-3">핵심 지표</h3>
          {infoLoading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-dark-muted">재무 데이터 로딩 중...</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="시가총액" value={info?.marketCap ? formatBigNumber(info.marketCap) : (stock?.market_cap || (coin ? `$${(coin.market_cap / 1e9).toFixed(1)}B` : "-"))} />
              <MetricCard label="PER" value={info?.per ? `${info.per.toFixed(1)}x` : (stock?.pe_ratio && stock.pe_ratio > 0 ? `${stock.pe_ratio.toFixed(1)}x` : "-")} />
              <MetricCard label="PBR" value={info?.pbr ? `${info.pbr.toFixed(2)}x` : "-"} />
              <MetricCard label="PSR" value={info?.psr ? `${info.psr.toFixed(2)}x` : "-"} />
              <MetricCard label="순이익률" value={info?.profitMargin ? `${info.profitMargin.toFixed(1)}%` : "-"} highlight={info?.profitMargin ? info.profitMargin > 0 : false} />
              {info?.roe !== null && info?.roe !== undefined && (
                <MetricCard label="ROE" value={`${(info.roe * 100).toFixed(1)}%`} highlight={info.roe > 0} />
              )}
              {isCrypto && coin && <MetricCard label="24h 거래량" value={`$${(coin.total_volume / 1e9).toFixed(1)}B`} />}
              {!isCrypto && info?.latestQuarter?.eps && (
                <MetricCard label="EPS (최근)" value={currency === "₩" ? `₩${info.latestQuarter.eps.toLocaleString()}` : `$${info.latestQuarter.eps.toFixed(2)}`} />
              )}
            </div>
          )}
        </div>

        {/* 52주 범위 */}
        {w52High && w52Low && (
          <div className="mb-5">
            <h3 className="font-bold text-sm mb-3">52주 범위</h3>
            <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
              <div className="flex justify-between text-[10px] text-dark-muted mb-1.5">
                <span>{currency}{w52Low.toLocaleString()}</span>
                <span>{currency}{w52High.toLocaleString()}</span>
              </div>
              <div className="relative h-2 bg-dark-border rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-down via-yellow-400 to-up"
                  style={{ width: `${Math.min(100, Math.max(0, w52Pct || 0))}%` }}
                />
                {w52Pct !== null && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md border-2 border-accent"
                    style={{ left: `${Math.min(97, Math.max(3, w52Pct))}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-[10px] mt-1.5">
                <span className="text-down font-semibold">최저</span>
                <span className="text-dark-muted">
                  현재 {w52Pct !== null ? `${w52Pct.toFixed(0)}%` : "-"}
                </span>
                <span className="text-up font-semibold">최고</span>
              </div>
            </div>
          </div>
        )}

        {/* 배당 정보 */}
        {info && (info.dividendYield || info.dividendRate || (info.dividends && info.dividends.length > 0)) && (
          <div className="mb-5">
            <h3 className="font-bold text-sm mb-3">배당 정보</h3>
            <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-[10px] text-dark-muted mb-0.5">배당수익률</p>
                  <p className="text-sm font-bold text-up">{info.dividendYield ? `${(info.dividendYield * 100).toFixed(2)}%` : "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-dark-muted mb-0.5">연간 배당금</p>
                  <p className="text-sm font-bold">{info.dividendRate ? (currency === "₩" ? `₩${info.dividendRate.toLocaleString()}` : `$${info.dividendRate.toFixed(2)}`) : "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-dark-muted mb-0.5">배당락일</p>
                  <p className="text-sm font-bold">{info.exDividendDate || "-"}</p>
                </div>
              </div>
              {/* 최근 배당 이력 */}
              {info.dividends && info.dividends.length > 0 && (
                <div>
                  <p className="text-[10px] text-dark-muted mb-1.5 font-semibold border-t border-dark-border pt-2">최근 배당 이력</p>
                  <div className="space-y-1">
                    {info.dividends.slice(0, 6).map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span className="text-dark-muted">{d.date}</span>
                        <span className="font-semibold text-up">{currency === "₩" ? `₩${d.amount.toLocaleString()}` : `$${d.amount.toFixed(4)}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 분기별 실적 */}
        {info && (info.earningsDate || (info.quarterlyFinancials && info.quarterlyFinancials.length > 0) || info.latestQuarter) && !isCrypto && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">실적</h3>
              {info.earningsDate && (
                <span className="text-[10px] px-2 py-1 rounded-lg bg-accent/20 text-accent font-semibold animate-pulse">
                  다음 발표: {info.earningsDate}
                </span>
              )}
            </div>

            {/* 분기별 매출/순이익 바 차트 */}
            {info.quarterlyFinancials && info.quarterlyFinancials.length > 0 ? (
              <>
                <QuarterlyBarChart quarters={[...info.quarterlyFinancials].reverse()} />

                {/* 분기별 상세 테이블 */}
                <div className="bg-dark-card rounded-2xl p-4 border border-dark-border mt-3">
                  <p className="text-[10px] text-dark-muted mb-2 font-semibold">분기별 상세 (단위: $M)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-dark-muted border-b border-dark-border">
                          <th className="text-left py-1.5 pr-2">항목</th>
                          {[...info.quarterlyFinancials].reverse().map((q, i) => (
                            <th key={i} className="text-right py-1.5 px-1 whitespace-nowrap">{q.quarter}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "매출", key: "revenue" as const },
                          { label: "순이익", key: "netIncome" as const },
                          { label: "EPS", key: "eps" as const },
                          { label: "EBITDA", key: "ebitda" as const },
                          { label: "영업이익", key: "operatingIncome" as const },
                        ].map((row) => (
                          <tr key={row.key} className="border-b border-dark-border/30">
                            <td className="text-dark-muted py-1.5 pr-2 whitespace-nowrap">{row.label}</td>
                            {[...info.quarterlyFinancials].reverse().map((q, i) => {
                              const val = q[row.key];
                              const isEps = row.key === "eps";
                              return (
                                <td key={i} className={`text-right py-1.5 px-1 font-semibold whitespace-nowrap ${val !== null && val < 0 ? "text-down" : ""}`}>
                                  {val !== null
                                    ? isEps ? `$${val.toFixed(2)}` : val.toLocaleString()
                                    : "-"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : info.latestQuarter ? (
              /* 폴백: Google Finance 최근 분기 1개 */
              <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-dark-muted font-semibold">최근 분기 실적</p>
                  {info.latestQuarter.quarter && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-dark-border text-dark-muted">{info.latestQuarter.quarter}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-dark-muted mb-0.5">매출</p>
                    <p className="text-sm font-bold">{formatBigNumber(info.latestQuarter.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-dark-muted mb-0.5">순이익</p>
                    <p className={`text-sm font-bold ${(info.latestQuarter.netIncome || 0) >= 0 ? "text-up" : "text-down"}`}>
                      {formatBigNumber(info.latestQuarter.netIncome)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-dark-muted mb-0.5">EPS</p>
                    <p className="text-sm font-bold">{info.latestQuarter.eps !== null ? `$${info.latestQuarter.eps.toFixed(2)}` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-dark-muted mb-0.5">EBITDA</p>
                    <p className="text-sm font-bold">{formatBigNumber(info.latestQuarter.ebitda)}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* 기업 프로필 */}
        {info?.companyProfile?.description && (
          <div className="mb-5">
            <h3 className="font-bold text-sm mb-3">기업 정보</h3>
            <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
              {/* 기본 정보 태그 */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {info.companyProfile.sector && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-accent/20 text-accent font-semibold">{info.companyProfile.sector}</span>
                )}
                {info.companyProfile.industry && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-dark-border text-dark-muted">{info.companyProfile.industry}</span>
                )}
                {info.companyProfile.country && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-dark-border text-dark-muted">{info.companyProfile.country}</span>
                )}
                {info.companyProfile.employees && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-dark-border text-dark-muted">
                    직원 {info.companyProfile.employees.toLocaleString()}명
                  </span>
                )}
                {info.companyProfile.ceo && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-dark-border text-dark-muted">
                    CEO: {info.companyProfile.ceo}
                  </span>
                )}
                {info.companyProfile.headquarters && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-dark-border text-dark-muted">
                    {info.companyProfile.headquarters}
                  </span>
                )}
              </div>
              {/* 기업 설명 */}
              <p className={`text-xs text-dark-muted leading-relaxed ${!descExpanded ? "line-clamp-4" : ""}`}>
                {info.companyProfile.description}
              </p>
              {info.companyProfile.description.length > 200 && (
                <button onClick={() => setDescExpanded(!descExpanded)} className="text-[10px] text-accent font-semibold mt-1">
                  {descExpanded ? "접기" : "더 보기"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Related News */}
        {relatedNews.length > 0 && (
          <div>
            <h3 className="font-bold text-sm mb-3">관련 뉴스</h3>
            {relatedNews.slice(0, 3).map((n) => (
              <Link key={n.id} href={`/news/${n.id}`} className="block bg-dark-card rounded-xl p-4 border border-dark-border mb-2 active:bg-dark-border/50 transition">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${n.category === "coin" ? "bg-orange-500/20 text-orange-400" : n.category === "macro" ? "bg-cyan-500/20 text-cyan-400" : "bg-accent/20 text-indigo-400"}`}>
                    {n.category === "stock" ? "주식" : n.category === "coin" ? "코인" : "경제"}
                  </span>
                  <span className="text-[10px] text-dark-muted">{n.source} · {n.time}</span>
                </div>
                <p className="text-xs font-medium">{n.title}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Price Alert Modal */}
      {showAlert && (
        <PriceAlertModal symbol={displaySymbol} name={displayName} currentPrice={price} currency={currency} onClose={() => setShowAlert(false)} onConfirm={handleAlertConfirm} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 max-w-[380px] w-[90%] z-50">
          <div className="bg-up/90 text-white text-sm font-medium rounded-xl px-4 py-3 text-center shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-dark-card rounded-xl p-2.5 border border-dark-border">
      <p className="text-[10px] text-dark-muted mb-0.5">{label}</p>
      <p className={`text-xs font-bold ${highlight ? "text-up" : ""}`}>{value}</p>
    </div>
  );
}

// 분기별 매출/순이익 바 차트
function QuarterlyBarChart({ quarters }: { quarters: { quarter: string; revenue: number | null; netIncome: number | null; eps: number | null }[] }) {
  if (quarters.length === 0) return null;

  const maxRevenue = Math.max(...quarters.map(q => q.revenue || 0));
  // maxNetIncome not needed — niH uses maxRevenue as scale reference

  return (
    <div className="bg-dark-card rounded-2xl p-4 border border-dark-border">
      <div className="flex items-center gap-4 mb-3">
        <p className="text-[10px] text-dark-muted font-semibold">분기별 실적 추이</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-accent" />
            <span className="text-[9px] text-dark-muted">매출</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-up" />
            <span className="text-[9px] text-dark-muted">순이익</span>
          </div>
        </div>
      </div>

      {/* 바 차트 */}
      <div className="flex items-end gap-3 mb-2" style={{ height: 112 }}>
        {quarters.map((q, i) => {
          const revH = maxRevenue > 0 ? ((q.revenue || 0) / maxRevenue) * 100 : 0;
          const niH = maxRevenue > 0 ? (Math.abs(q.netIncome || 0) / maxRevenue) * 100 : 0;
          const isNeg = (q.netIncome || 0) < 0;
          return (
            <div key={i} className="flex-1 flex items-end justify-center gap-[3px]" style={{ height: "100%" }}>
              <div
                className="w-4 bg-accent rounded-t-sm"
                style={{ height: `${Math.max(4, revH)}%`, minHeight: 4 }}
              />
              <div
                className={`w-4 rounded-t-sm ${isNeg ? "bg-down" : "bg-up"}`}
                style={{ height: `${Math.max(4, niH)}%`, minHeight: 4 }}
              />
            </div>
          );
        })}
      </div>

      {/* X축 라벨 */}
      <div className="flex gap-2">
        {quarters.map((q, i) => (
          <div key={i} className="flex-1 text-center">
            <p className="text-[9px] text-dark-muted">{q.quarter}</p>
          </div>
        ))}
      </div>

      {/* EPS 라인 */}
      <div className="mt-3 pt-2 border-t border-dark-border/30">
        <p className="text-[9px] text-dark-muted mb-1.5 font-semibold">EPS 추이</p>
        <div className="flex gap-2">
          {quarters.map((q, i) => (
            <div key={i} className="flex-1 text-center">
              <span className={`text-[11px] font-bold ${(q.eps || 0) >= 0 ? "text-up" : "text-down"}`}>
                {q.eps !== null ? `$${q.eps.toFixed(2)}` : "-"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
