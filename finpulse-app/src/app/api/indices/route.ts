import { NextResponse } from "next/server";

/**
 * 실시간 주요 지수 데이터 API
 * KOSPI, KOSDAQ, S&P500, NASDAQ, 다우존스 → Yahoo Finance v8
 * 비트코인 → CoinGecko
 */

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

const INDICES = [
  { yahoo: "^KS11", name: "KOSPI", nameKr: "코스피", currency: "₩", decimals: 2 },
  { yahoo: "^KQ11", name: "KOSDAQ", nameKr: "코스닥", currency: "₩", decimals: 2 },
  { yahoo: "^GSPC", name: "S&P 500", nameKr: "S&P500", currency: "$", decimals: 2 },
  { yahoo: "^IXIC", name: "NASDAQ", nameKr: "나스닥", currency: "$", decimals: 2 },
  { yahoo: "^DJI", name: "Dow Jones", nameKr: "다우존스", currency: "$", decimals: 2 },
];

async function fetchYahooIndex(yahooSymbol: string): Promise<{
  price: number;
  prevClose: number;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=5m`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    return {
      price: meta.regularMarketPrice ?? 0,
      prevClose: meta.chartPreviousClose ?? 0,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // 병렬로 모든 지수 + BTC 데이터 가져오기
    const indexPromises = INDICES.map(async (idx) => {
      const data = await fetchYahooIndex(idx.yahoo);
      if (!data) {
        return {
          symbol: idx.name,
          name: idx.name,
          nameKr: idx.nameKr,
          price: "-",
          change: "0.00",
          changePct: "0.00",
          isUp: true,
          currency: idx.currency,
        } as IndexData;
      }

      const change = data.price - data.prevClose;
      const changePct = data.prevClose > 0 ? (change / data.prevClose) * 100 : 0;

      return {
        symbol: idx.name,
        name: idx.name,
        nameKr: idx.nameKr,
        price: data.price.toLocaleString(undefined, {
          minimumFractionDigits: idx.decimals,
          maximumFractionDigits: idx.decimals,
        }),
        change: change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2),
        changePct: changePct >= 0 ? `+${changePct.toFixed(2)}` : changePct.toFixed(2),
        isUp: change >= 0,
        currency: idx.currency,
      } as IndexData;
    });

    // 비트코인은 CoinGecko simple/price API 사용
    const btcPromise = (async (): Promise<IndexData> => {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
          { next: { revalidate: 60 } }
        );
        if (!res.ok) throw new Error("CoinGecko error");
        const data = await res.json();
        const price = data.bitcoin?.usd ?? 0;
        const change24h = data.bitcoin?.usd_24h_change ?? 0;
        return {
          symbol: "BTC",
          name: "Bitcoin",
          nameKr: "비트코인",
          price: price.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          change: change24h >= 0 ? `+${change24h.toFixed(2)}` : change24h.toFixed(2),
          changePct: change24h >= 0 ? `+${change24h.toFixed(2)}` : change24h.toFixed(2),
          isUp: change24h >= 0,
          currency: "$",
        };
      } catch {
        return {
          symbol: "BTC",
          name: "Bitcoin",
          nameKr: "비트코인",
          price: "-",
          change: "0.00",
          changePct: "0.00",
          isUp: true,
          currency: "$",
        };
      }
    })();

    const [indices, btc] = await Promise.all([
      Promise.all(indexPromises),
      btcPromise,
    ]);

    return NextResponse.json({
      indices: [...indices, btc],
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ indices: [], updatedAt: new Date().toISOString() }, { status: 500 });
  }
}
