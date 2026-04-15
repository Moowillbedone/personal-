"use client";
import { memo, useMemo } from "react";

interface Props {
  symbol: string;
  market?: string;
}

/**
 * 심볼을 TradingView 형식으로 변환합니다.
 */
function getTvSymbol(symbol: string, market?: string): string {
  // Crypto (CoinGecko ID → TradingView BINANCE)
  const cryptoMap: Record<string, string> = {
    bitcoin: "BINANCE:BTCUSDT",
    ethereum: "BINANCE:ETHUSDT",
    solana: "BINANCE:SOLUSDT",
    ripple: "BINANCE:XRPUSDT",
    dogecoin: "BINANCE:DOGEUSDT",
    cardano: "BINANCE:ADAUSDT",
    binancecoin: "BINANCE:BNBUSDT",
    "avalanche-2": "BINANCE:AVAXUSDT",
    polkadot: "BINANCE:DOTUSDT",
    chainlink: "BINANCE:LINKUSDT",
    tron: "BINANCE:TRXUSDT",
    "the-open-network": "OKX:TONUSDT",
    "shiba-inu": "BINANCE:SHIBUSDT",
    litecoin: "BINANCE:LTCUSDT",
    uniswap: "BINANCE:UNIUSDT",
    "matic-network": "BINANCE:MATICUSDT",
    stellar: "BINANCE:XLMUSDT",
    "internet-computer": "BINANCE:ICPUSDT",
    "wrapped-bitcoin": "BINANCE:WBTCUSDT",
    cosmos: "BINANCE:ATOMUSDT",
    filecoin: "BINANCE:FILUSDT",
    "lido-dao": "BINANCE:LDOUSDT",
    aave: "BINANCE:AAVEUSDT",
    "render-token": "BINANCE:RENDERUSDT",
    pepe: "BINANCE:PEPEUSDT",
    arbitrum: "BINANCE:ARBUSDT",
    optimism: "BINANCE:OPUSDT",
    sui: "BINANCE:SUIUSDT",
    sei: "BINANCE:SEIUSDT",
    celestia: "BINANCE:TIAUSDT",
    jupiter: "BINANCE:JUPUSDT",
  };
  if (cryptoMap[symbol.toLowerCase()]) return cryptoMap[symbol.toLowerCase()];

  // Crypto by ticker symbol (when market is explicitly Crypto)
  if (market === "Crypto") {
    return `BINANCE:${symbol.toUpperCase()}USDT`;
  }

  // Korean stocks → KRX (6자리 숫자 코드)
  if (market === "KOSPI" || market === "KOSDAQ" || /^\d{6}$/.test(symbol)) {
    return `KRX:${symbol}`;
  }

  // US stocks - well-known NYSE tickers
  const nyseStocks = new Set([
    "BRK-B", "BRK.B", "JPM", "V", "UNH", "JNJ", "WMT", "PG", "HD", "CVX",
    "MRK", "ABBV", "XOM", "MA", "BAC", "KO", "DIS", "VZ", "IBM",
    "GS", "CAT", "AXP", "NKE", "MMM", "BA", "GE", "PM", "RTX",
    "SPGI", "TMO", "HON", "LOW", "COP", "AMGN", "SYK", "BLK",
  ]);
  if (nyseStocks.has(symbol)) return `NYSE:${symbol.replace("-", ".")}`;

  // Default: NASDAQ
  return `NASDAQ:${symbol}`;
}

/** KRX 종목 여부 확인 */
function isKrxSymbol(symbol: string, market?: string): boolean {
  return market === "KOSPI" || market === "KOSDAQ" || /^\d{6}$/.test(symbol);
}

/**
 * KRX 종목 전용 대체 차트 UI
 * TradingView 임베디드 위젯이 KRX 데이터를 지원하지 않으므로
 * TradingView 웹사이트로 바로 이동할 수 있는 안내를 표시합니다.
 */
function KrxFallbackChart({ symbol }: { symbol: string }) {
  const tvUrl = `https://www.tradingview.com/chart/?symbol=KRX:${symbol}`;

  return (
    <div className="rounded-2xl overflow-hidden border border-dark-border bg-dark-card flex flex-col items-center justify-center gap-4" style={{ height: "260px", width: "100%" }}>
      {/* Chart icon */}
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <div className="text-center px-6">
        <p className="text-sm font-semibold text-white mb-1">KRX 차트</p>
        <p className="text-xs text-dark-muted leading-relaxed">
          한국 주식 차트는 TradingView 웹사이트에서<br />확인하실 수 있습니다.
        </p>
      </div>
      <a
        href={tvUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/80 transition active:scale-95"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
        TradingView에서 보기
      </a>
    </div>
  );
}

/**
 * TradingView 차트 위젯 - 직접 iframe embed 방식
 * KRX 종목은 임베디드 위젯 미지원으로 대체 UI를 표시합니다.
 */
function TradingViewWidget({ symbol, market }: Props) {
  const tvSymbol = getTvSymbol(symbol, market);
  const isKrx = isKrxSymbol(symbol, market);

  const iframeSrc = useMemo(() => {
    if (isKrx) return "";
    const params = new URLSearchParams({
      symbol: tvSymbol,
      interval: "D",
      timezone: "Asia/Seoul",
      theme: "dark",
      style: "1",
      locale: "kr",
      backgroundColor: "rgba(18, 18, 42, 1)",
      gridColor: "rgba(30, 30, 58, 0.6)",
      allow_symbol_change: "1",
      hide_top_toolbar: "0",
      hide_legend: "0",
      save_image: "0",
      hide_volume: "0",
      calendar: "0",
      studies: "RSI@tv-basicstudies",
      studies_2: "MASimple@tv-basicstudies",
      support_host: "https://www.tradingview.com",
    });
    return `https://s.tradingview.com/widgetembed/?hideideas=1&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&${params.toString()}`;
  }, [tvSymbol, isKrx]);

  // KRX 종목: TradingView 웹사이트 링크가 포함된 대체 UI
  if (isKrx) {
    return <KrxFallbackChart symbol={symbol} />;
  }

  // 그 외 종목: TradingView 임베디드 차트
  return (
    <div className="rounded-2xl overflow-hidden border border-dark-border" style={{ height: "420px", width: "100%" }}>
      <iframe
        src={iframeSrc}
        style={{ width: "100%", height: "100%", border: "none" }}
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

export default memo(TradingViewWidget);

export { getTvSymbol };
