"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { STRATEGIES, generateSignals, type OHLCV, type Signal } from "@/lib/quant";
import { runBacktest, getDefaultParams, type BacktestResult } from "@/lib/backtest";
import { getPortfolio, toggleStrategy } from "@/lib/portfolio-store";
import { getWatchlist } from "@/lib/store";

const DEFAULT_SYMBOLS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "005930", name: "삼성전자" },
  { symbol: "000660", name: "SK하이닉스" },
  { symbol: "bitcoin", name: "Bitcoin" },
  { symbol: "ethereum", name: "Ethereum" },
];

// 심볼 → 이름 매핑 (알려진 종목)
const KNOWN_NAMES: Record<string, string> = {
  AAPL: "Apple", NVDA: "NVIDIA", MSFT: "Microsoft", TSLA: "Tesla",
  GOOG: "Google", GOOGL: "Google", AMZN: "Amazon", META: "Meta",
  NFLX: "Netflix", AMD: "AMD", INTC: "Intel", TSM: "TSMC",
  "005930": "삼성전자", "000660": "SK하이닉스", "035420": "NAVER",
  "035720": "카카오", "051910": "LG화학", "006400": "삼성SDI",
  "003670": "포스코퓨처엠", "373220": "LG에너지솔루션",
  bitcoin: "Bitcoin", ethereum: "Ethereum", solana: "Solana",
  ripple: "XRP", dogecoin: "Dogecoin", cardano: "Cardano",
};

const PERIODS = [
  { label: "1Y", range: "1y", interval: "1d" },
  { label: "2Y", range: "2y", interval: "1d" },
  { label: "5Y", range: "5y", interval: "1wk" },
];

export default function StrategyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const strategy = STRATEGIES.find((s) => s.id === id);

  const [params, setParams] = useState<Record<string, number>>({});
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOLS[0].symbol);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [allSymbols, setAllSymbols] = useState(DEFAULT_SYMBOLS);
  const chartRef = useRef<HTMLDivElement>(null);
  const lwChartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);

  // 즐겨찾기 종목 로드 및 기본 심볼과 병합
  useEffect(() => {
    const watchlist = getWatchlist();
    const defaultSymSet = new Set(DEFAULT_SYMBOLS.map(s => s.symbol));
    const watchlistItems = watchlist
      .filter(sym => !defaultSymSet.has(sym))
      .map(sym => ({ symbol: sym, name: KNOWN_NAMES[sym] || sym }));

    if (watchlistItems.length > 0) {
      setAllSymbols([...watchlistItems, ...DEFAULT_SYMBOLS]);
    }
  }, []);

  useEffect(() => {
    if (strategy) {
      setParams(getDefaultParams(strategy.id));
      setIsActive(getPortfolio().activeStrategies.includes(strategy.id));
    }
  }, [strategy]);

  const fetchAndTest = useCallback(async () => {
    if (!strategy) return;
    setLoading(true);
    try {
      const period = PERIODS[periodIdx];
      const res = await fetch(`/api/chart/${encodeURIComponent(selectedSymbol)}?range=${period.range}&interval=${period.interval}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (!data.candles?.length) throw new Error("No data");

      const c: OHLCV[] = data.candles;
      setCandles(c);
      const sigs = generateSignals(strategy.id, c, params);
      setSignals(sigs);
      const bt = runBacktest(strategy.id, c, params);
      setResult(bt);
    } catch {
      setResult(null);
      setSignals([]);
    }
    setLoading(false);
  }, [strategy, selectedSymbol, periodIdx, params]);

  // 차트 렌더링
  useEffect(() => {
    if (!chartRef.current || candles.length === 0 || !result) return;

    let chart: ReturnType<typeof import("lightweight-charts").createChart>;

    (async () => {
      const { createChart, LineSeries } = await import("lightweight-charts");

      if (lwChartRef.current) {
        lwChartRef.current.remove();
        lwChartRef.current = null;
      }

      const el = chartRef.current;
      if (!el) return;

      chart = createChart(el, {
        width: el.clientWidth,
        height: 260,
        layout: { background: { color: "transparent" }, textColor: "#9ca3af", fontSize: 10 },
        grid: { vertLines: { color: "rgba(55,65,81,0.3)" }, horzLines: { color: "rgba(55,65,81,0.3)" } },
        rightPriceScale: { borderColor: "rgba(55,65,81,0.5)" },
        timeScale: { borderColor: "rgba(55,65,81,0.5)" },
      });
      lwChartRef.current = chart;

      // Equity curve
      const equitySeries = chart.addSeries(LineSeries, {
        color: "#6366f1",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      equitySeries.setData(
        result.equity.map((e) => ({
          time: e.time as import("lightweight-charts").UTCTimestamp,
          value: e.value,
        }))
      );

      // Buy & Hold benchmark
      if (candles.length > 0) {
        const initPrice = candles[0].close;
        const initCap = 100000000;
        const shares = Math.floor(initCap / initPrice);
        const benchSeries = chart.addSeries(LineSeries, {
          color: "#6b728080",
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        benchSeries.setData(
          candles.map((c) => ({
            time: c.time as import("lightweight-charts").UTCTimestamp,
            value: shares * c.close + (initCap - shares * initPrice),
          }))
        );
      }

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (el && chart) chart.applyOptions({ width: el.clientWidth });
      });
      ro.observe(el);
    })();

    return () => {
      if (lwChartRef.current) {
        lwChartRef.current.remove();
        lwChartRef.current = null;
      }
    };
  }, [candles, result]);

  function handleToggleStrategy() {
    if (!strategy) return;
    toggleStrategy(strategy.id);
    setIsActive(!isActive);
  }

  if (!strategy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-dark-muted text-sm">전략을 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/quant/strategies" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div>
            <h1 className="text-sm font-semibold">{strategy.name}</h1>
            <p className="text-[10px] text-dark-muted">{strategy.nameEn}</p>
          </div>
        </div>
        <button
          onClick={handleToggleStrategy}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${isActive ? "bg-up/20 text-up" : "bg-dark-border text-dark-muted"}`}
        >
          {isActive ? "활성" : "비활성"}
        </button>
      </div>

      <div className="px-5 mt-4 fade-in">
        {/* 설명 */}
        <p className="text-xs text-dark-muted leading-relaxed mb-4">{strategy.description}</p>

        {/* 파라미터 설정 */}
        <div className="bg-dark-card rounded-2xl p-4 border border-dark-border mb-4">
          <h3 className="text-xs font-bold mb-3">파라미터 설정</h3>
          {strategy.params.map((p) => (
            <div key={p.key} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-dark-muted">{p.label}</span>
                <span className="text-xs font-bold" style={{ color: strategy.color }}>
                  {params[p.key] ?? p.defaultValue}
                </span>
              </div>
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={params[p.key] ?? p.defaultValue}
                onChange={(e) => setParams({ ...params, [p.key]: parseFloat(e.target.value) })}
                className="w-full h-1 rounded-full appearance-none bg-dark-border accent-accent"
              />
            </div>
          ))}
        </div>

        {/* 종목 & 기간 선택 */}
        <div className="bg-dark-card rounded-2xl p-4 border border-dark-border mb-4">
          <h3 className="text-xs font-bold mb-3">백테스트 대상</h3>
          {/* 즐겨찾기 종목이 있으면 섹션 분리 */}
          {allSymbols.length > DEFAULT_SYMBOLS.length && (
            <p className="text-[9px] text-accent font-semibold mb-1.5">⭐ 즐겨찾기</p>
          )}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {allSymbols.slice(0, allSymbols.length - DEFAULT_SYMBOLS.length).map((s) => (
              <button
                key={s.symbol}
                onClick={() => setSelectedSymbol(s.symbol)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border ${
                  selectedSymbol === s.symbol
                    ? "bg-accent text-white border-accent"
                    : "bg-accent/10 text-accent border-accent/30"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          {allSymbols.length > DEFAULT_SYMBOLS.length && (
            <p className="text-[9px] text-dark-muted font-semibold mb-1.5">기본 종목</p>
          )}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DEFAULT_SYMBOLS.map((s) => (
              <button
                key={s.symbol}
                onClick={() => setSelectedSymbol(s.symbol)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition ${
                  selectedSymbol === s.symbol
                    ? "bg-accent text-white"
                    : "bg-dark-border/50 text-dark-muted"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {PERIODS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setPeriodIdx(i)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  i === periodIdx
                    ? "bg-accent text-white"
                    : "bg-dark-border/50 text-dark-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 백테스트 실행 */}
        <button
          onClick={fetchAndTest}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-accent text-white font-bold text-sm mb-4 disabled:opacity-50 transition active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              백테스트 실행 중...
            </span>
          ) : (
            "백테스트 실행"
          )}
        </button>

        {/* 결과 */}
        {result && (
          <>
            {/* 성과 지표 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatCard label="총 수익률" value={`${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%`} color={result.totalReturn >= 0 ? "text-up" : "text-down"} />
              <StatCard label="연평균 수익률 (CAGR)" value={`${result.cagr >= 0 ? "+" : ""}${result.cagr.toFixed(2)}%`} color={result.cagr >= 0 ? "text-up" : "text-down"} />
              <StatCard label="최대 낙폭 (MDD)" value={`-${result.mdd.toFixed(2)}%`} color="text-down" />
              <StatCard label="샤프 비율" value={result.sharpeRatio.toFixed(2)} color={result.sharpeRatio >= 1 ? "text-up" : "text-dark-muted"} />
              <StatCard label="승률" value={`${result.winRate.toFixed(1)}%`} color={result.winRate >= 50 ? "text-up" : "text-down"} />
              <StatCard label="총 거래 수" value={`${result.totalTrades}회`} color="text-white" />
              <StatCard label="평균 보유일" value={`${Math.round(result.avgHoldingDays)}일`} color="text-white" />
              <StatCard label="벤치마크 (B&H)" value={`${result.benchmarkReturn >= 0 ? "+" : ""}${result.benchmarkReturn.toFixed(2)}%`} color={result.benchmarkReturn >= 0 ? "text-up" : "text-down"} />
              {result.totalCommission > 0 && (
                <StatCard label="총 수수료" value={`${(result.totalCommission / 10000).toFixed(0)}만원`} color="text-dark-muted" />
              )}
            </div>

            {/* Equity Chart */}
            <div className="bg-dark-card rounded-2xl p-3 border border-dark-border mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold">수익률 차트</h3>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-dark-muted">
                    <span className="w-3 h-0.5 bg-accent inline-block rounded" /> 전략
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-dark-muted">
                    <span className="w-3 h-0.5 bg-dark-muted inline-block rounded" style={{ opacity: 0.5 }} /> B&H
                  </span>
                </div>
              </div>
              <div ref={chartRef} style={{ width: "100%", height: 260 }} />
            </div>

            {/* 시그널 히스토리 */}
            {signals.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold mb-2">매매 시그널 ({signals.length}개)</h3>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {signals.slice(-20).reverse().map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-dark-card rounded-xl px-3 py-2 border border-dark-border">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.type === "buy" ? "bg-up/20 text-up" : "bg-down/20 text-down"}`}>
                          {s.type === "buy" ? "매수" : "매도"}
                        </span>
                        <span className="text-[10px] text-dark-muted">
                          {new Date(s.time * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold">${s.price.toFixed(2)}</p>
                        <p className="text-[8px] text-dark-muted">{s.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 거래 내역 */}
            {result.trades.length > 0 && (
              <div>
                <h3 className="text-xs font-bold mb-2">거래 내역 ({result.trades.length}건)</h3>
                <div className="max-h-60 overflow-y-auto space-y-1.5">
                  {result.trades.slice(-10).reverse().map((t, i) => (
                    <div key={i} className="bg-dark-card rounded-xl px-3 py-2.5 border border-dark-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-dark-muted">
                          {new Date(t.entryTime * 1000).toLocaleDateString()} → {new Date(t.exitTime * 1000).toLocaleDateString()}
                        </span>
                        <span className={`text-xs font-bold ${t.returnPct >= 0 ? "text-up" : "text-down"}`}>
                          {t.returnPct >= 0 ? "+" : ""}{t.returnPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-dark-muted">
                        <span>매수 ${t.entryPrice.toFixed(2)}</span>
                        <span>&rarr;</span>
                        <span>매도 ${t.exitPrice.toFixed(2)}</span>
                        <span>({t.holdingDays}일)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-dark-card rounded-xl p-3 border border-dark-border">
      <p className="text-[10px] text-dark-muted mb-1">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}
