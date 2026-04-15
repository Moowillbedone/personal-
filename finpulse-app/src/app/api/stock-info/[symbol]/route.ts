import { NextResponse } from "next/server";

/**
 * 종목 상세 정보 API
 * Google Finance 스크래핑 (주요 지표 + 기업설명 + 최근 분기 실적)
 * + EarningsWhispers (다음 실적 발표일)
 * + Yahoo Finance v8 (배당 이력)
 */

const CRYPTO_MAP: Record<string, string> = {
  bitcoin: "BTC-USD", ethereum: "ETH-USD", solana: "SOL-USD",
  ripple: "XRP-USD", dogecoin: "DOGE-USD", cardano: "ADA-USD",
  polkadot: "DOT-USD", avalanche: "AVAX-USD", chainlink: "LINK-USD",
  toncoin: "TON11419-USD",
};

function toYahooSymbol(symbol: string): string {
  if (CRYPTO_MAP[symbol.toLowerCase()]) return CRYPTO_MAP[symbol.toLowerCase()];
  if (/^\d{6}$/.test(symbol)) return `${symbol}.KS`;
  return symbol;
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

// ──────────────────────────────────────────────
// 1. Google Finance 스크래핑
// ──────────────────────────────────────────────
async function scrapeGoogleFinance(symbol: string) {
  const isKR = /^\d{6}$/.test(symbol);
  const isCrypto = !!CRYPTO_MAP[symbol.toLowerCase()];

  const urls = isKR
    ? [`https://www.google.com/finance/quote/${symbol}:KRX`]
    : isCrypto
    ? [`https://www.google.com/finance/quote/${CRYPTO_MAP[symbol.toLowerCase()]?.replace("-USD", "")}-USD`]
    : [
        `https://www.google.com/finance/quote/${symbol}:NASDAQ`,
        `https://www.google.com/finance/quote/${symbol}:NYSE`,
        `https://www.google.com/finance/quote/${symbol}:NYSEARCA`,
      ];

  let html = "";
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: HEADERS,
        next: { revalidate: 300 },
      });
      if (res.ok) {
        html = await res.text();
        if (html.includes("data-last-price")) break;
      }
    } catch { continue; }
  }

  if (!html) return null;

  // Google Finance 2024+ HTML:
  // Label: <div class="mfs7Fc" ...>Label</div>
  // Value: <div class="P6K39c">Value</div>
  function extractMetric(label: string): string | null {
    const p = new RegExp(
      `class="mfs7Fc"[^>]*>${label}</div>[\\s\\S]*?class="P6K39c">([^<]+)</div>`,
      "i"
    );
    const m = html.match(p);
    return m ? m[1].trim() : null;
  }

  // 현재가
  let currentPrice: number | null = null;
  const pm = html.match(/data-last-price="([^"]+)"/);
  if (pm) currentPrice = parseFloat(pm[1]);

  // 등락률
  let changePercent: number | null = null;
  const cpm = html.match(/data-last-normal-market-timestamp[^>]*>[\s\S]*?data-change-percent="([^"]+)"/);
  if (!cpm) {
    const cpm2 = html.match(/data-change-percent="([^"]+)"/);
    if (cpm2) changePercent = parseFloat(cpm2[1]);
  } else {
    changePercent = parseFloat(cpm[1]);
  }

  // 기업 설명 (class="bLLb2d")
  let description: string | null = null;
  const dm = html.match(/class="bLLb2d">([^<]{30,})/);
  if (dm) {
    description = dm[1]
      .replace(/&#39;/g, "'").replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .trim();
    if (description.length > 500) description = description.slice(0, 497) + "...";
  }

  // 재무 데이터 (Income Statement + Balance Sheet + Cash Flow)
  const quarterlyData = extractAllFinancials(html);

  return {
    currentPrice,
    changePercent,
    marketCap: extractMetric("Market cap"),
    per: extractMetric("P/E ratio"),
    dividendYield: extractMetric("Dividend yield"),
    yearRange: extractMetric("Year range"),
    previousClose: extractMetric("Previous close"),
    avgVolume: extractMetric("Avg Volume") || extractMetric("Average volume"),
    primaryExchange: extractMetric("Primary exchange"),
    description,
    employees: extractMetric("Employees"),
    ceo: extractMetric("CEO"),
    headquarters: extractMetric("Headquarters"),
    quarterlyData,
  };
}

// 테이블에서 행 라벨-값 쌍 추출하는 공통 함수
function extractTableData(table: string): Record<string, string> {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rm: RegExpExecArray | null;
  const data: Record<string, string> = {};

  while ((rm = rowRe.exec(table)) !== null) {
    const content = rm[1];
    let label = "";
    const labelMatch = content.match(/class="rPF6Lc"[^>]*>([^<]+)/);
    if (labelMatch) {
      label = labelMatch[1].trim();
    } else {
      const altMatch = content.match(/class="rsPbEe"[^>]*>([^<]+)/);
      if (altMatch) label = altMatch[1].trim();
    }
    const valMatch = content.match(/class="QXDnM">([^<]+)/);
    if (label && valMatch) {
      data[label] = valMatch[1].trim();
    }
  }
  return data;
}

// 3개 재무 테이블 전체 추출 (Income Statement, Balance Sheet, Cash Flow)
function extractAllFinancials(html: string) {
  // 모든 slpEwd 테이블 찾기
  const tableRe = /<table class="slpEwd">([\s\S]*?)<\/table>/g;
  let tm: RegExpExecArray | null;
  const tables: string[] = [];
  while ((tm = tableRe.exec(html)) !== null) {
    tables.push(tm[1]);
  }

  if (tables.length === 0) return null;

  // 분기 헤더 (첫 번째 테이블에서)
  let quarter: string | null = null;
  const headerRe = /<th class="yNnsfe">([\s\S]*?)<\/th>/g;
  let hm: RegExpExecArray | null;
  while ((hm = headerRe.exec(tables[0])) !== null) {
    const dm = hm[1].match(/([A-Z][a-z]+ \d{4})/);
    if (dm) { quarter = dm[1]; break; }
  }

  // Income Statement (테이블 0)
  const income = tables[0] ? extractTableData(tables[0]) : {};
  // Balance Sheet (테이블 1)
  const balance = tables[1] ? extractTableData(tables[1]) : {};
  // Cash Flow (테이블 2)
  const cashFlow = tables[2] ? extractTableData(tables[2]) : {};

  return {
    quarter,
    // Income Statement
    revenue: income["Revenue"] || null,
    operatingExpense: income["Operating expense"] || null,
    netIncome: income["Net income"] || null,
    netProfitMargin: income["Net profit margin"] || null,
    eps: income["Earnings per share"] || null,
    ebitda: income["EBITDA"] || null,
    effectiveTaxRate: income["Effective tax rate"] || null,
    // Balance Sheet
    totalAssets: balance["Total assets"] || null,
    totalLiabilities: balance["Total liabilities"] || null,
    totalEquity: balance["Total equity"] || null,
    sharesOutstanding: balance["Shares outstanding"] || null,
    priceToBook: balance["Price to book"] || null,
    returnOnAssets: balance["Return on assets"] || null,
    returnOnCapital: balance["Return on capital"] || null,
    cashAndInvestments: balance["Cash and short-term investments"] || null,
    // Cash Flow
    cashFromOperations: cashFlow["Cash from operations"] || null,
    freeCashFlow: cashFlow["Free cash flow"] || null,
  };
}

// ──────────────────────────────────────────────
// 2. EarningsWhispers (다음 실적 발표일)
// ──────────────────────────────────────────────
async function fetchEarningsDate(symbol: string): Promise<string | null> {
  // 한국 종목이나 암호화폐는 건너뛰기
  if (/^\d{6}$/.test(symbol) || CRYPTO_MAP[symbol.toLowerCase()]) return null;

  try {
    const res = await fetch(`https://www.earningswhispers.com/stocks/${symbol.toLowerCase()}`, {
      headers: HEADERS,
      next: { revalidate: 3600 }, // 1시간 캐시
    });
    if (!res.ok) return null;
    const html = await res.text();

    // "May 27, 2026" 형식 날짜 추출
    const months = "January|February|March|April|May|June|July|August|September|October|November|December";
    const datePattern = new RegExp(`((?:${months})\\s+\\d{1,2},?\\s*\\d{4})`, "g");
    let dm: RegExpExecArray | null;
    while ((dm = datePattern.exec(html)) !== null) {
      const parsed = new Date(dm[1]);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// 2b. 분기별 실적 (US: StockAnalysis, KR: NAVER Finance)
// ──────────────────────────────────────────────
interface QuarterlyFinancialRow {
  quarter: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  ebitda: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
}

// 한국 숫자 파싱 (억원 단위, 쉼표 포함)
function parseKrNum(v: string | undefined): number | null {
  if (!v || v === "" || v === "-") return null;
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// 한국 주식: NAVER Finance에서 분기별 실적
async function fetchKoreanQuarterly(symbol: string): Promise<QuarterlyFinancialRow[]> {
  try {
    const url = `https://finance.naver.com/item/main.naver?code=${symbol}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ko-KR,ko;q=0.9" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // tb_type1 tb_num 클래스 테이블 찾기
    const tableMatch = html.match(/class="tb_type1 tb_num[^"]*">([\s\S]*?)<\/table>/);
    if (!tableMatch) return [];
    const table = tableMatch[1];

    // 행 파싱
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let rm: RegExpExecArray | null;
    const allRows: string[][] = [];
    while ((rm = rowRe.exec(table)) !== null) {
      const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g;
      let cm: RegExpExecArray | null;
      const cells: string[] = [];
      while ((cm = cellRe.exec(rm[1])) !== null) {
        cells.push(cm[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").replace(/&#40;/g, "(").replace(/&#41;/g, ")").replace(/\s+/g, " ").trim());
      }
      if (cells.length > 0) allRows.push(cells);
    }

    if (allRows.length < 4) return [];

    // 헤더 행: 날짜들 (index 1)
    const dateRow = allRows[1];
    // 데이터 행들
    const dataMap: Record<string, string[]> = {};
    for (const row of allRows.slice(3)) {
      if (row.length > 1 && row[0]) {
        dataMap[row[0]] = row.slice(1);
      }
    }

    // 분기 날짜: dateRow에서 연간 4개(0-3) 후 분기 시작
    // "2024.12", "2025.03", "2025.06", "2025.09", "2025.12", "2026.03 (E)"
    // 연간은 보통 4개, 분기는 그 뒤
    const annualCount = dateRow.filter(d => d.match(/^\d{4}\.\d{2}$/) && d.endsWith(".12")).length;
    const quarterDates = dateRow.slice(Math.max(annualCount, 4));

    // 최근 4분기 (예측 제외)
    const result: QuarterlyFinancialRow[] = [];
    const startIdx = Math.max(annualCount, 4);

    for (let i = 0; i < Math.min(quarterDates.length, 5); i++) {
      const qDate = quarterDates[i];
      if (!qDate) continue;
      const isEstimate = qDate.includes("(E)");
      const cleanDate = qDate.replace(/\s*\(E\)\s*/, "");

      // 인덱스: allRows의 각 행에서 [0]은 라벨, [1~]은 값
      const actualIdx = startIdx + i;
      const revenue = parseKrNum(allRows.find(r => r[0] === "매출액")?.[actualIdx + 1]);
      const netIncome = parseKrNum(allRows.find(r => r[0] === "당기순이익")?.[actualIdx + 1]);
      const operatingIncome = parseKrNum(allRows.find(r => r[0] === "영업이익")?.[actualIdx + 1]);
      result.push({
        quarter: (isEstimate ? `${cleanDate} (E)` : cleanDate),
        revenue,
        netIncome,
        eps: null, // NAVER에 분기 EPS 없음
        ebitda: null,
        grossProfit: null,
        operatingIncome,
      });
    }

    // 예측 제외하고 최근 4분기만
    return result.filter(q => !q.quarter.includes("(E)")).slice(0, 4);
  } catch {
    return [];
  }
}

async function fetchQuarterlyFinancials(symbol: string): Promise<QuarterlyFinancialRow[]> {
  // 한국 종목 → NAVER Finance
  if (/^\d{6}$/.test(symbol)) return fetchKoreanQuarterly(symbol);
  // 암호화폐 → 건너뛰기
  if (CRYPTO_MAP[symbol.toLowerCase()]) return [];

  try {
    const url = `https://stockanalysis.com/stocks/${symbol.toLowerCase()}/financials/?p=quarterly`;
    const res = await fetch(url, {
      headers: HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // 테이블 파싱
    const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
    if (!tableMatch) return [];
    const table = tableMatch[1];

    // 헤더 (분기명)
    const headerRe = /<th[^>]*>([\s\S]*?)<\/th>/g;
    let hm: RegExpExecArray | null;
    const quarters: string[] = [];
    while ((hm = headerRe.exec(table)) !== null) {
      const clean = hm[1].replace(/<[^>]+>/g, "").trim();
      if (clean.match(/^Q\d\s+\d{4}$/)) quarters.push(clean);
    }

    if (quarters.length === 0) return [];

    // 행 파싱
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let rm: RegExpExecArray | null;
    const rowData: Record<string, string[]> = {};

    while ((rm = rowRe.exec(table)) !== null) {
      const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let cm: RegExpExecArray | null;
      const cells: string[] = [];
      while ((cm = cellRe.exec(rm[1])) !== null) {
        cells.push(cm[1].replace(/<[^>]+>/g, "").trim());
      }
      if (cells.length > 1) {
        rowData[cells[0]] = cells.slice(1);
      }
    }

    // 최대 4분기 (최근 4개)
    const maxQ = Math.min(quarters.length, 4);
    const result: QuarterlyFinancialRow[] = [];

    for (let i = 0; i < maxQ; i++) {
      result.push({
        quarter: quarters[i],
        revenue: parseFinancialVal(rowData["Revenue"]?.[i]),
        netIncome: parseFinancialVal(rowData["Net Income"]?.[i]),
        eps: parseFinancialVal(rowData["EPS (Diluted)"]?.[i]),
        ebitda: parseFinancialVal(rowData["EBITDA"]?.[i]),
        grossProfit: parseFinancialVal(rowData["Gross Profit"]?.[i]),
        operatingIncome: parseFinancialVal(rowData["Operating Income"]?.[i]),
      });
    }

    return result;
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// 3. Yahoo Finance v8 (배당 이력)
// ──────────────────────────────────────────────
async function fetchYahooDividends(yahooSymbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=3y&interval=3mo&events=div`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { dividends: [], annualDividend: null };
    const json = await res.json();
    const result = json?.chart?.result?.[0];

    const divEvents = result?.events?.dividends || {};
    const dividends = Object.values(divEvents)
      .map((d: unknown) => {
        const div = d as { date?: number; amount?: number };
        return {
          date: div.date ? new Date(div.date * 1000).toISOString().slice(0, 10) : "",
          amount: div.amount ?? 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    // 최근 1년 배당 합계
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const annualDividend = dividends
      .filter(d => new Date(d.date) >= oneYearAgo)
      .reduce((sum, d) => sum + d.amount, 0);

    return {
      dividends: dividends.slice(0, 12),
      annualDividend: annualDividend > 0 ? annualDividend : null,
    };
  } catch {
    return { dividends: [], annualDividend: null };
  }
}

// Yahoo v7 quote API (폴백)
async function fetchYahooQuote(yahooSymbol: string) {
  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const q = json?.quoteResponse?.result?.[0];
    if (!q) return null;

    return {
      marketCap: q.marketCap || null,
      per: q.trailingPE || null,
      forwardPer: q.forwardPE || null,
      pbr: q.priceToBook || null,
      epsTrailing: q.epsTrailingTwelveMonths || null,
      dividendYield: q.trailingAnnualDividendYield || null,
      dividendRate: q.trailingAnnualDividendRate || null,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh || null,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow || null,
      sector: q.sector || null,
      industry: q.industry || null,
      displayName: q.displayName || q.shortName || null,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// 유틸리티 함수
// ──────────────────────────────────────────────
// 숫자 파싱 - StockAnalysis용 (쉼표 제거, 괄호 음수 처리)
function parseFinancialVal(v: string | undefined): number | null {
  if (!v || v === "-" || v === "") return null;
  const cleaned = v.replace(/[$,]/g, "").replace(/\((.+)\)/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseNum(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[,$%]/g, "").trim());
  return isNaN(n) ? null : n;
}

function parseMarketCap(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/([\d,.]+)\s*(T|B|M|K)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  const unit = (m[2] || "").toUpperCase();
  if (unit === "T") return num * 1e12;
  if (unit === "B") return num * 1e9;
  if (unit === "M") return num * 1e6;
  if (unit === "K") return num * 1e3;
  return num;
}

function parseBigNumber(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/([\d,.]+)\s*(T|B|M|K)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ""));
  const unit = (m[2] || "").toUpperCase();
  if (unit === "T") return num * 1e12;
  if (unit === "B") return num * 1e9;
  if (unit === "M") return num * 1e6;
  if (unit === "K") return num * 1e3;
  return num;
}

function parse52WeekRange(v: string | null | undefined): { low: number; high: number } | null {
  if (!v) return null;
  // "₩52,900.00 - ₩223,000.00" or "$86.63 - $212.19"
  const m = v.match(/[\$₩]?([\d,.]+)\s*[-–]\s*[\$₩]?([\d,.]+)/);
  if (!m) return null;
  return {
    low: parseFloat(m[1].replace(/,/g, "")),
    high: parseFloat(m[2].replace(/,/g, "")),
  };
}

// ──────────────────────────────────────────────
// API 핸들러
// ──────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: { symbol: string } }
) {
  const { symbol } = params;
  const yahooSymbol = toYahooSymbol(symbol);
  const isCrypto = !!CRYPTO_MAP[symbol.toLowerCase()];

  try {
    // 4개 소스 병렬 fetch
    const [gf, earningsDate, divData, yq, quarterlyFinancials] = await Promise.all([
      scrapeGoogleFinance(symbol),
      fetchEarningsDate(symbol),
      fetchYahooDividends(yahooSymbol),
      fetchYahooQuote(yahooSymbol),
      fetchQuarterlyFinancials(symbol),
    ]);

    // 데이터 병합
    const marketCap = yq?.marketCap || parseMarketCap(gf?.marketCap);
    const per = yq?.per || parseNum(gf?.per);
    const forwardPer = yq?.forwardPer || null;
    // PBR: Yahoo 우선, Google Finance Balance Sheet 폴백
    const pbr = yq?.pbr || parseNum(gf?.quarterlyData?.priceToBook) || null;

    // 52주 범위
    const yearRange = parse52WeekRange(gf?.yearRange);
    const fiftyTwoWeekHigh = yq?.fiftyTwoWeekHigh || yearRange?.high || null;
    const fiftyTwoWeekLow = yq?.fiftyTwoWeekLow || yearRange?.low || null;

    // 배당 정보
    const gfDivYield = gf?.dividendYield ? parseNum(gf.dividendYield.replace("%", "")) : null;
    const dividendYield = yq?.dividendYield || (gfDivYield ? gfDivYield / 100 : null);
    const dividendRate = yq?.dividendRate || divData.annualDividend || null;

    // 현재가
    const currentPrice = gf?.currentPrice || null;

    // 분기별 실적 + Balance Sheet + Cash Flow
    const qd = gf?.quarterlyData;
    const revenue = parseBigNumber(qd?.revenue);
    const latestQuarter = qd ? {
      quarter: qd.quarter,
      revenue,
      netIncome: parseBigNumber(qd.netIncome),
      eps: parseNum(qd.eps),
      netProfitMargin: parseNum(qd.netProfitMargin),
      ebitda: parseBigNumber(qd.ebitda),
      // Balance Sheet
      totalAssets: parseBigNumber(qd.totalAssets),
      totalEquity: parseBigNumber(qd.totalEquity),
      totalLiabilities: parseBigNumber(qd.totalLiabilities),
      cashAndInvestments: parseBigNumber(qd.cashAndInvestments),
      returnOnAssets: parseNum(qd.returnOnAssets?.replace("%", "")),
      returnOnCapital: parseNum(qd.returnOnCapital?.replace("%", "")),
      // Cash Flow
      freeCashFlow: parseBigNumber(qd.freeCashFlow),
      cashFromOperations: parseBigNumber(qd.cashFromOperations),
    } : null;

    // PSR 계산: 시가총액 / (최근분기매출 × 4) — 연환산
    const annualizedRevenue = revenue ? revenue * 4 : null;
    const psr = (marketCap && annualizedRevenue && annualizedRevenue > 0)
      ? marketCap / annualizedRevenue
      : null;

    // 기업 프로필
    const companyProfile = {
      sector: yq?.sector || null,
      industry: yq?.industry || null,
      description: gf?.description || null,
      website: null,
      employees: gf?.employees ? parseInt(gf.employees.replace(/,/g, "")) : null,
      country: null,
      ceo: gf?.ceo || null,
      headquarters: gf?.headquarters || null,
    };

    return NextResponse.json({
      symbol,
      yahooSymbol,
      isCrypto,
      currentPrice,
      changePercent: gf?.changePercent || null,
      marketCap,
      per,
      forwardPer,
      pbr,
      psr,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      dividendYield,
      dividendRate,
      dividends: divData.dividends,
      exDividendDate: divData.dividends.length > 0 ? divData.dividends[0].date : null,
      companyProfile,
      earningsDate, // EarningsWhispers에서 가져옴
      latestQuarter, // 최근 분기 실적
      revenueGrowth: null,
      profitMargin: latestQuarter?.netProfitMargin || null,
      operatingMargin: null,
      targetPrice: null,
      recommendation: null,
      roe: latestQuarter?.returnOnCapital ? latestQuarter.returnOnCapital / 100 : null,
      debtToEquity: null,
      // 분기별 실적 (StockAnalysis.com에서 4분기)
      quarterlyFinancials,
      // 하위 호환
      earnings: [],
      quarterlyRevenue: quarterlyFinancials.length > 0
        ? quarterlyFinancials.map(q => ({
            date: q.quarter,
            revenue: (q.revenue || 0) * 1e6, // StockAnalysis is in millions
            earnings: (q.netIncome || 0) * 1e6,
          }))
        : latestQuarter ? [{
            date: latestQuarter.quarter || "",
            revenue: latestQuarter.revenue || 0,
            earnings: latestQuarter.netIncome || 0,
          }] : [],
      _sources: {
        googleFinance: !!gf,
        earningsWhispers: !!earningsDate,
        yahooDividends: divData.dividends.length > 0,
        yahooQuote: !!yq,
        stockAnalysis: quarterlyFinancials.length > 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch stock info", detail: String(err) },
      { status: 500 }
    );
  }
}
