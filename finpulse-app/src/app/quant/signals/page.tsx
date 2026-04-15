"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { STRATEGIES, generateSignals, type OHLCV, type Signal } from "@/lib/quant";
import { getDefaultParams } from "@/lib/backtest";
import { getPortfolio } from "@/lib/portfolio-store";
import { getWatchlist } from "@/lib/store";

interface SymbolSignal {
  symbol: string;
  name: string;
  signals: Signal[];
  latestSignal: Signal | null;
  price: number;
}

const DEFAULT_SYMBOLS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "005930", name: "삼성전자" },
  { symbol: "000660", name: "SK하이닉스" },
  { symbol: "bitcoin", name: "Bitcoin" },
  { symbol: "ethereum", name: "Ethereum" },
];

const KNOWN_NAMES: Record<string, string> = {
  AAPL: "Apple", NVDA: "NVIDIA", MSFT: "Microsoft", TSLA: "Tesla",
  GOOG: "Google", GOOGL: "Google", AMZN: "Amazon", META: "Meta",
  NFLX: "Netflix", AMD: "AMD", INTC: "Intel", TSM: "TSMC",
  "005930": "삼성전자", "000660": "SK하이닉스", "035420": "NAVER",
  "035720": "카카오", "051910": "LG화학", "006400": "삼성SDI",
  bitcoin: "Bitcoin", ethereum: "Ethereum", solana: "Solana",
};

export default function SignalsPage() {
  const [loading, setLoading] = useState(true);
  const [signalData, setSignalData] = useState<SymbolSignal[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const [activeStrategies, setActiveStrategies] = useState<string[]>([]);

  const [watchlistSymbols, setWatchlistSymbols] = useState(DEFAULT_SYMBOLS);

  useEffect(() => {
    setActiveStrategies(getPortfolio().activeStrategies);
    // 즐겨찾기 종목 로드
    const wl = getWatchlist();
    const defaultSet = new Set(DEFAULT_SYMBOLS.map(s => s.symbol));
    const extras = wl
      .filter(sym => !defaultSet.has(sym))
      .map(sym => ({ symbol: sym, name: KNOWN_NAMES[sym] || sym }));
    if (extras.length > 0) {
      setWatchlistSymbols([...extras, ...DEFAULT_SYMBOLS]);
    }
  }, []);

  const loadSignals = useCallback(async () => {
    setLoading(true);
    const results: SymbolSignal[] = [];
    const params = getDefaultParams(selectedStrategy);

    for (const sym of watchlistSymbols) {
      try {
        const res = await fetch(`/api/chart/${encodeURIComponent(sym.symbol)}?range=3mo&interval=1d`);
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.candles?.length) continue;

        const candles: OHLCV[] = data.candles;
        const sigs = generateSignals(selectedStrategy, candles, params);
        const lastCandle = candles[candles.length - 1];

        results.push({
          symbol: sym.symbol,
          name: sym.name,
          signals: sigs,
          latestSignal: sigs.length > 0 ? sigs[sigs.length - 1] : null,
          price: lastCandle.close,
        });
      } catch {
        // skip
      }
    }

    setSignalData(results);
    setLoading(false);
  }, [selectedStrategy, watchlistSymbols]);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  const buySignals = signalData.filter((s) => s.latestSignal?.type === "buy");
  const sellSignals = signalData.filter((s) => s.latestSignal?.type === "sell");

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3 flex items-center gap-3">
        <Link href="/quant" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div>
          <h1 className="text-sm font-semibold">매매 시그널</h1>
          <p className="text-[10px] text-dark-muted">최근 3개월 기준</p>
        </div>
      </div>

      <div className="px-5 mt-4 fade-in">
        {/* 전략 선택 */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStrategy(s.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition ${
                selectedStrategy === s.id
                  ? "bg-accent text-white"
                  : "bg-dark-border/50 text-dark-muted"
              }`}
            >
              {s.name}
              {activeStrategies.includes(s.id) && " *"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-dark-muted ml-2">시그널 분석 중...</span>
          </div>
        ) : (
          <>
            {/* 매수 시그널 */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-up" />
                <h2 className="font-bold text-sm">매수 시그널</h2>
                <span className="text-[10px] text-dark-muted">({buySignals.length})</span>
              </div>
              {buySignals.length === 0 ? (
                <div className="bg-dark-card rounded-xl p-4 border border-dark-border text-center">
                  <p className="text-xs text-dark-muted">현재 매수 시그널이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {buySignals.map((s) => (
                    <SignalCard key={s.symbol} data={s} />
                  ))}
                </div>
              )}
            </div>

            {/* 매도 시그널 */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-down" />
                <h2 className="font-bold text-sm">매도 시그널</h2>
                <span className="text-[10px] text-dark-muted">({sellSignals.length})</span>
              </div>
              {sellSignals.length === 0 ? (
                <div className="bg-dark-card rounded-xl p-4 border border-dark-border text-center">
                  <p className="text-xs text-dark-muted">현재 매도 시그널이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sellSignals.map((s) => (
                    <SignalCard key={s.symbol} data={s} />
                  ))}
                </div>
              )}
            </div>

            {/* 전체 시그널 히스토리 */}
            <div>
              <h2 className="font-bold text-sm mb-3">종목별 최근 시그널</h2>
              <div className="space-y-2">
                {signalData.map((s) => (
                  <Link
                    key={s.symbol}
                    href={`/stock/${encodeURIComponent(s.symbol)}`}
                    className="flex items-center justify-between bg-dark-card rounded-xl px-3 py-3 border border-dark-border active:bg-dark-border/50 transition"
                  >
                    <div>
                      <p className="text-xs font-semibold">{s.symbol}</p>
                      <p className="text-[10px] text-dark-muted">{s.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold">${s.price.toFixed(2)}</p>
                      <p className="text-[10px] text-dark-muted">{s.signals.length}개 시그널</p>
                    </div>
                    {s.latestSignal && (
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ml-2 ${
                        s.latestSignal.type === "buy" ? "bg-up/20 text-up" : "bg-down/20 text-down"
                      }`}>
                        {s.latestSignal.type === "buy" ? "매수" : "매도"}
                        <br />
                        <span className="text-[8px] font-normal">{s.latestSignal.strength === "strong" ? "강" : s.latestSignal.strength === "medium" ? "중" : "약"}</span>
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SignalCard({ data }: { data: SymbolSignal }) {
  const sig = data.latestSignal!;
  return (
    <Link
      href={`/stock/${encodeURIComponent(data.symbol)}`}
      className="block bg-dark-card rounded-xl p-3.5 border border-dark-border active:bg-dark-border/50 transition"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            sig.type === "buy" ? "bg-up/20 text-up" : "bg-down/20 text-down"
          }`}>
            {sig.type === "buy" ? "매수" : "매도"}
          </span>
          <span className="text-sm font-semibold">{data.symbol}</span>
          <span className="text-[10px] text-dark-muted">{data.name}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
          sig.strength === "strong" ? "bg-accent/20 text-accent" :
          sig.strength === "medium" ? "bg-yellow-500/20 text-yellow-400" :
          "bg-dark-border text-dark-muted"
        }`}>
          {sig.strength === "strong" ? "강" : sig.strength === "medium" ? "중" : "약"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-dark-muted">{sig.reason}</p>
        <p className="text-xs font-semibold">${data.price.toFixed(2)}</p>
      </div>
    </Link>
  );
}
