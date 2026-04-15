import { NextResponse } from "next/server";

/**
 * Yahoo Finance 차트 데이터 프록시 API
 * GET /api/chart/AAPL?range=6mo&interval=1d
 *
 * 심볼 변환:
 *   - 한국 주식 (6자리 숫자): 005930 → 005930.KS
 *   - 크립토 (CoinGecko ID): bitcoin → BTC-USD
 *   - 미국 주식: 그대로 (AAPL, NVDA 등)
 */

const CRYPTO_MAP: Record<string, string> = {
  bitcoin: "BTC-USD", ethereum: "ETH-USD", solana: "SOL-USD",
  ripple: "XRP-USD", dogecoin: "DOGE-USD", cardano: "ADA-USD",
  binancecoin: "BNB-USD", "avalanche-2": "AVAX-USD", polkadot: "DOT-USD",
  chainlink: "LINK-USD", tron: "TRX-USD", litecoin: "LTC-USD",
  uniswap: "UNI-USD", stellar: "XLM-USD", cosmos: "ATOM-USD",
  pepe: "PEPE-USD", sui: "SUI-USD", "shiba-inu": "SHIB-USD",
  "the-open-network": "TON-USD", "matic-network": "MATIC-USD",
  arbitrum: "ARB-USD", optimism: "OP-USD",
};

function toYahooSymbol(symbol: string): string {
  // 크립토
  if (CRYPTO_MAP[symbol.toLowerCase()]) return CRYPTO_MAP[symbol.toLowerCase()];
  // 한국 주식 (6자리 숫자)
  if (/^\d{6}$/.test(symbol)) return `${symbol}.KS`;
  // 미국 주식
  return symbol;
}

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "6mo";
  const interval = searchParams.get("interval") || "1d";
  const symbol = decodeURIComponent(params.symbol);
  const yahooSymbol = toYahooSymbol(symbol);

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${range}&interval=${interval}&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Yahoo Finance error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json({ error: "No data" }, { status: 404 });
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const { open, high, low, close, volume } = quote;

    // OHLCV 배열로 변환
    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (open[i] != null && close[i] != null) {
        candles.push({
          time: timestamps[i],
          open: open[i],
          high: high[i],
          low: low[i],
          close: close[i],
          volume: volume?.[i] || 0,
        });
      }
    }

    // 메타 정보
    const meta = result.meta || {};

    return NextResponse.json({
      symbol: meta.symbol || yahooSymbol,
      currency: meta.currency || "USD",
      candles,
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("[Chart API]", err);
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
