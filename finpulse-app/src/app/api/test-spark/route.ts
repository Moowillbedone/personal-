import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// Google Finance 심볼 형식: {ticker}:{exchange}
const TEST_STOCKS = [
  { gf: "AAPL:NASDAQ", label: "Apple" },
  { gf: "NVDA:NASDAQ", label: "NVIDIA" },
  { gf: "MSFT:NASDAQ", label: "Microsoft" },
  { gf: "TSLA:NASDAQ", label: "Tesla" },
  { gf: "JPM:NYSE", label: "JPMorgan" },
  { gf: "005930:KRX", label: "삼성전자" },
  { gf: "000660:KRX", label: "SK하이닉스" },
  { gf: "035420:KRX", label: "NAVER" },
];

async function scrapeGoogleFinance(gfSymbol: string) {
  const res = await fetch(`https://www.google.com/finance/quote/${gfSymbol}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };

  const html = await res.text();
  const price = html.match(/data-last-price="([0-9.]+)"/)?.[1];
  const prevClose = html.match(/data-previous-close="([0-9.]+)"/)?.[1];
  const change = html.match(/data-price-change="([0-9.-]+)"/)?.[1];
  const changePct = html.match(/data-price-change-percent="([0-9.-]+)"/)?.[1];
  const currency = html.match(/data-currency-code="([^"]+)"/)?.[1];

  return { price, prevClose, change, changePct, currency };
}

export async function GET() {
  const results = await Promise.all(
    TEST_STOCKS.map(async (s) => {
      try {
        const data = await scrapeGoogleFinance(s.gf);
        return { symbol: s.gf, label: s.label, ...data };
      } catch (e) {
        return { symbol: s.gf, label: s.label, error: String(e) };
      }
    })
  );

  return NextResponse.json({ stocks: results });
}
