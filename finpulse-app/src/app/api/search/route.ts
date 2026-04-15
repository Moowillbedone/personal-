import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  if (!query || query.length < 1) {
    return NextResponse.json({ quotes: [] });
  }

  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0&listsCount=0`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      }
    );

    if (!res.ok) throw new Error("Yahoo Finance search error");
    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes = (data.quotes || [])
      .filter((q: Record<string, string>) => q.quoteType === "EQUITY" || q.quoteType === "CRYPTOCURRENCY" || q.quoteType === "ETF")
      .map((q: Record<string, string>) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: q.quoteType === "CRYPTOCURRENCY" ? "coin" : "stock",
        exchange: q.exchange || "",
        exchDisp: q.exchDisp || "",
      }));

    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json({ quotes: [] });
  }
}
