import { fetchCoins, fetchNews, StockData } from "@/lib/api";
import StockDetailClient from "./StockDetailClient";

export const revalidate = 60;

const GF_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * 개별 종목 1개만 Google Finance에서 빠르게 가져옵니다.
 * 기존: 31개 전체 스크래핑 (3~8초) → 개선: 1개만 (0.5~1초)
 */
async function fetchSingleStock(symbol: string): Promise<StockData | null> {
  const isKR = /^\d{6}$/.test(symbol);
  const candidates = isKR
    ? [`${symbol}:KRX`]
    : [`${symbol}:NASDAQ`, `${symbol}:NYSE`];

  for (const gfSymbol of candidates) {
    try {
      const res = await fetch(`https://www.google.com/finance/quote/${gfSymbol}`, {
        headers: { "User-Agent": GF_UA },
        next: { revalidate: 60 },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const priceStr = html.match(/data-last-price="([0-9.]+)"/)?.[1];
      if (!priceStr) continue;

      const currency = html.match(/data-currency-code="([^"]+)"/)?.[1] || "USD";
      const price = parseFloat(priceStr);

      // 종목명
      let name = symbol;
      const nameMatch = html.match(/<div[^>]*class="[^"]*zzDege[^"]*"[^>]*>([^<]+)/);
      if (nameMatch) name = nameMatch[1].trim();
      if (name === symbol) {
        const titleMatch = html.match(/<title>([^(]+)/);
        if (titleMatch) {
          const t = titleMatch[1].replace(/Stock Price.*|주가.*|Google Finance/gi, "").trim();
          if (t && t.length < 60) name = t;
        }
      }

      // Previous close
      let prevClose = price;
      const prevIdx = html.indexOf("Previous close");
      if (prevIdx > 0) {
        const after = html.slice(prevIdx, prevIdx + 500);
        const nodes = after.match(/>([^<]+)</g);
        if (nodes) {
          for (const node of nodes) {
            const text = node.slice(1, -1).trim();
            const pm = text.match(/^[$₩€£]?([\d,]+\.?\d+)$/);
            if (pm) { prevClose = parseFloat(pm[1].replace(/,/g, "")); break; }
            const nm = text.match(/^([\d,]+)$/);
            if (nm) {
              const val = parseFloat(nm[1].replace(/,/g, ""));
              if (val >= 100) { prevClose = val; break; }
            }
          }
        }
      }

      const changePct = prevClose > 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;
      const exchange = gfSymbol.split(":")[1] || "";

      // 52주 고/저
      let high52 = 0, low52 = 0;
      const yearIdx = html.indexOf("Year range");
      if (yearIdx > 0) {
        const yearSlice = html.slice(yearIdx, yearIdx + 400);
        const nums = yearSlice.match(/>([^<]*\d[\d,.]+[^<]*)</g);
        if (nums) {
          const extracted: number[] = [];
          for (const n of nums) {
            const raw = n.slice(1, -1).replace(/[,$₩€£\s]/g, "");
            const v = parseFloat(raw);
            if (!isNaN(v) && v > 0) extracted.push(v);
          }
          if (extracted.length >= 2) {
            low52 = Math.min(...extracted.slice(0, 2));
            high52 = Math.max(...extracted.slice(0, 2));
          }
        }
      }

      // 시가총액
      let marketCap = "-";
      const mcIdx = html.indexOf("Market cap");
      if (mcIdx > 0) {
        const mcSlice = html.slice(mcIdx, mcIdx + 300);
        const mcMatch = mcSlice.match(/>([^<]*\d[\d,.]+[^<]*[TBMK]?[^<]*)</g);
        if (mcMatch && mcMatch.length >= 2) {
          const raw = mcMatch[1].slice(1, -1).trim();
          if (raw.length < 30) marketCap = raw;
        }
      }

      // PER
      let peRatio = 0;
      const peIdx = html.indexOf("P/E ratio");
      if (peIdx > 0) {
        const peSlice = html.slice(peIdx, peIdx + 200);
        const peMatch = peSlice.match(/>(\d[\d,.]+)</);
        if (peMatch) peRatio = parseFloat(peMatch[1].replace(",", ""));
      }

      return {
        symbol, name, price, change_percent: changePct,
        market_cap: marketCap, pe_ratio: peRatio,
        high_52w: high52, low_52w: low52,
        market: isKR ? "KOSPI" : exchange.includes("NYSE") ? "NYSE" : "NASDAQ",
        currency: currency === "KRW" ? "₩" : "$",
      };
    } catch {
      continue;
    }
  }
  return null;
}

export default async function StockDetail({ params }: { params: { symbol: string } }) {
  const decodedSymbol = decodeURIComponent(params.symbol);

  // ★ 핵심 최적화: 코인만 빠르게 가져오고, 주식은 개별 1개만 fetch
  // 기존: fetchStocks() 31개 전체 스크래핑 (3~8초)
  // 개선: fetchSingleStock() 1개만 (0.5~1초)
  const [coins, cachedNews] = await Promise.all([
    fetchCoins(),
    fetchNews(),
  ]);

  const coin = coins.find(
    (c) => c.id === decodedSymbol || c.symbol === decodedSymbol.toLowerCase()
  );

  let stocks: StockData[] = [];
  if (!coin) {
    const stock = await fetchSingleStock(decodedSymbol);
    if (stock) stocks = [stock];
  }

  return (
    <StockDetailClient
      symbol={decodedSymbol}
      coins={coins}
      stocks={stocks}
      news={cachedNews}
    />
  );
}
