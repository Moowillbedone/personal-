import { NextResponse } from "next/server";

/**
 * 실적 발표일 캘린더 API
 * US: Nasdaq API
 * KR: 주요 종목 하드코딩 + NAVER Finance
 *
 * 시간대 변환: US Eastern → KST (+14시간 / +13시간 DST)
 */

interface EarningsEntry {
  symbol: string;
  name: string;
  date: string;           // YYYY-MM-DD (발표일)
  timeLabel: string;      // "장전", "장후", "미정"
  kstDateTime: string;    // 한국시간 표시 (ex: "3/26 (수) 오후 10:30 KST")
  market: "US" | "KR";
  marketCap: string;
  fiscalQuarter: string;
  epsForecast: string;
  lastYearEps: string;
  noOfEstimates: number;
}

// 유럽 기업 리스트 (Nasdaq/NYSE 상장이지만 실적 발표는 유럽 시간 기준)
const EUROPEAN_STOCKS = new Set([
  "ASML", "NVO", "SAP", "TM", "UL", "AZN", "NVS", "HSBC", "GSK", "DEO",
  "BP", "SHEL", "RIO", "BHP", "BTI", "LULU", "SHOP", "STM", "ING", "ERIC",
  "NOK", "PHG", "SPOT", "GRAB", "SE", "BIDU", "WBD", "SONY", "HMC", "MUFG",
  "SMFG", "MFG", "KB", "SHG", "LPL", "WIT", "INFY", "HDB", "IBN",
]);

// Nasdaq API에서 특정 날짜의 실적 발표 목록 가져오기
async function fetchNasdaqEarnings(date: string): Promise<EarningsEntry[]> {
  try {
    const url = `https://api.nasdaq.com/api/calendar/earnings?date=${date}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 1800 }, // 30분 캐시
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rows = json?.data?.rows || [];

    return rows.map((r: Record<string, string>) => {
      const timeRaw = r.time || "time-not-supplied";
      const symbol = r.symbol || "";
      const isEU = EUROPEAN_STOCKS.has(symbol);

      let timeLabel = "미정";
      let kstDateTime = `${formatDateKr(date)} 미정`;

      if (timeRaw === "time-pre-market") {
        if (isEU) {
          // 유럽 기업: CET 7:00~8:00 → KST 당일 오후 2:00~4:00
          timeLabel = "장전 (유럽)";
          kstDateTime = `${formatDateKr(date)} 오후 ~3:00 KST`;
        } else {
          // US 기업 장전: ET 6:00~9:30 → KST 당일 밤 8:00~11:30
          timeLabel = "장전";
          kstDateTime = `${formatDateKr(date)} 밤 ~21:30 KST`;
        }
      } else if (timeRaw === "time-after-hours") {
        timeLabel = "장후";
        // US 장후 = ET 16:05~17:00 → KST 다음날 새벽 6:05~7:00
        kstDateTime = `${formatNextDateKr(date)} 새벽 ~6:00 KST`;
      }

      return {
        symbol,
        name: (r.name || "").substring(0, 40),
        date,
        timeLabel,
        kstDateTime,
        market: "US" as const,
        marketCap: r.marketCap || "",
        fiscalQuarter: r.fiscalQuarterEnding || "",
        epsForecast: r.epsForecast || "-",
        lastYearEps: r.lastYearEPS || "-",
        noOfEstimates: parseInt(r.noOfEsts || "0") || 0,
      };
    });
  } catch {
    return [];
  }
}

// 한국 주요 종목 실적 발표일 (분기별 업데이트 필요 - 2026년 기준)
function getKoreanEarnings(): EarningsEntry[] {
  // 한국 주요 대형주 실적 발표일 (잠정실적 기준)
  const krEarnings: { symbol: string; name: string; dates: { date: string; quarter: string }[] }[] = [
    { symbol: "005930", name: "삼성전자", dates: [
      { date: "2026-04-08", quarter: "Q1 2026" },
      { date: "2026-07-08", quarter: "Q2 2026" },
      { date: "2026-10-08", quarter: "Q3 2026" },
    ]},
    { symbol: "000660", name: "SK하이닉스", dates: [
      { date: "2026-04-23", quarter: "Q1 2026" },
      { date: "2026-07-23", quarter: "Q2 2026" },
      { date: "2026-10-22", quarter: "Q3 2026" },
    ]},
    { symbol: "035420", name: "NAVER", dates: [
      { date: "2026-04-23", quarter: "Q1 2026" },
      { date: "2026-07-23", quarter: "Q2 2026" },
    ]},
    { symbol: "035720", name: "카카오", dates: [
      { date: "2026-05-08", quarter: "Q1 2026" },
      { date: "2026-08-07", quarter: "Q2 2026" },
    ]},
    { symbol: "051910", name: "LG화학", dates: [
      { date: "2026-04-22", quarter: "Q1 2026" },
      { date: "2026-07-22", quarter: "Q2 2026" },
    ]},
    { symbol: "006400", name: "삼성SDI", dates: [
      { date: "2026-04-24", quarter: "Q1 2026" },
      { date: "2026-07-24", quarter: "Q2 2026" },
    ]},
    { symbol: "005380", name: "현대차", dates: [
      { date: "2026-04-24", quarter: "Q1 2026" },
      { date: "2026-07-24", quarter: "Q2 2026" },
    ]},
    { symbol: "000270", name: "기아", dates: [
      { date: "2026-04-24", quarter: "Q1 2026" },
      { date: "2026-07-24", quarter: "Q2 2026" },
    ]},
    { symbol: "055550", name: "신한지주", dates: [
      { date: "2026-04-22", quarter: "Q1 2026" },
    ]},
    { symbol: "105560", name: "KB금융", dates: [
      { date: "2026-04-23", quarter: "Q1 2026" },
    ]},
  ];

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const result: EarningsEntry[] = [];
  for (const company of krEarnings) {
    for (const d of company.dates) {
      const dt = new Date(d.date);
      if (dt >= now && dt <= oneYearLater) {
        result.push({
          symbol: company.symbol,
          name: company.name,
          date: d.date,
          timeLabel: "장후",
          kstDateTime: `${formatDateKr(d.date)} 오후 발표 예정`,
          market: "KR",
          marketCap: "",
          fiscalQuarter: d.quarter,
          epsForecast: "-",
          lastYearEps: "-",
          noOfEstimates: 0,
        });
      }
    }
  }
  return result;
}

// 날짜 포맷 (한국어)
function formatDateKr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = days[d.getDay()];
  return `${m}/${day} (${dow})`;
}

function formatNextDateKr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = days[d.getDay()];
  return `${m}/${day} (${dow})`;
}

// 주요 종목명 매핑
const STOCK_NAMES: Record<string, string> = {
  AAPL: "Apple Inc", MSFT: "Microsoft Corp", NVDA: "NVIDIA Corp",
  GOOG: "Alphabet Inc", GOOGL: "Alphabet Inc", AMZN: "Amazon.com",
  META: "Meta Platforms", TSLA: "Tesla Inc", "BRK.B": "Berkshire Hathaway",
  UNH: "UnitedHealth", JNJ: "Johnson & Johnson", V: "Visa Inc",
  XOM: "Exxon Mobil", WMT: "Walmart", JPM: "JPMorgan Chase",
  PG: "Procter & Gamble", MA: "Mastercard", HD: "Home Depot",
  CVX: "Chevron Corp", MRK: "Merck & Co", ABBV: "AbbVie Inc",
  KO: "Coca-Cola", PEP: "PepsiCo", COST: "Costco",
  AVGO: "Broadcom", LLY: "Eli Lilly", TMO: "Thermo Fisher",
  MCD: "McDonald's", CSCO: "Cisco Systems", ACN: "Accenture",
  ORCL: "Oracle Corp", CRM: "Salesforce", AMD: "AMD Inc",
  INTC: "Intel Corp", QCOM: "Qualcomm", ADBE: "Adobe Inc",
  TXN: "Texas Instruments", NFLX: "Netflix", DIS: "Walt Disney",
  NKE: "Nike Inc", PYPL: "PayPal", BA: "Boeing",
  CAT: "Caterpillar", GE: "GE Aerospace", GS: "Goldman Sachs",
  MS: "Morgan Stanley", BABA: "Alibaba", PDD: "PDD Holdings",
  JD: "JD.com", NIO: "NIO Inc", LI: "Li Auto",
  XPEV: "XPeng", BIDU: "Baidu",
  MU: "Micron", LRCX: "Lam Research", AMAT: "Applied Materials",
  KLAC: "KLA Corp", MRVL: "Marvell Tech", ARM: "Arm Holdings",
  SMCI: "Super Micro",
};

// EarningsWhispers에서 개별 종목 실적 발표일 가져오기
async function fetchEarningsWhispersBatch(symbols: string[]): Promise<EarningsEntry[]> {
  const results: EarningsEntry[] = [];
  const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  };

  // 5개씩 병렬 처리
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (sym) => {
        try {
          const res = await fetch(`https://www.earningswhispers.com/stocks/${sym.toLowerCase()}`, {
            headers: HEADERS,
            next: { revalidate: 3600 },
          });
          if (!res.ok) return null;
          const html = await res.text();

          const months = "January|February|March|April|May|June|July|August|September|October|November|December";
          const datePattern = new RegExp(`((?:${months})\\s+\\d{1,2},?\\s*\\d{4})`, "g");
          let dm: RegExpExecArray | null;
          while ((dm = datePattern.exec(html)) !== null) {
            const parsed = new Date(dm[1]);
            if (!isNaN(parsed.getTime())) {
              const dateStr = parsed.toISOString().slice(0, 10);

              // 시간 정보 추출 (AMC = after market close, BMO = before market open)
              const isAMC = html.includes("After Market Close") || html.includes("AMC");
              const isBMO = html.includes("Before Market Open") || html.includes("BMO");
              const timeLabel = isAMC ? "장후" : isBMO ? "장전" : "미정";
              const kstDateTime = isAMC
                ? `${formatNextDateKr(dateStr)} 새벽 ~06:00 KST`
                : isBMO
                ? `${formatDateKr(dateStr)} 밤 ~22:00 KST`
                : `${formatDateKr(dateStr)} 미정`;

              // EPS 예측 추출
              let epsForecast = "-";
              const epsMatch = html.match(/Consensus EPS Forecast[^<]*<[^>]*>([^<]+)/i) ||
                               html.match(/consensus[^<]*\$?([\d.]+)/i);
              if (epsMatch) {
                const val = epsMatch[1].trim();
                if (val && !isNaN(parseFloat(val))) epsForecast = `$${parseFloat(val).toFixed(2)}`;
              }

              return {
                symbol: sym,
                name: (STOCK_NAMES[sym] || sym).substring(0, 40),
                date: dateStr,
                timeLabel,
                kstDateTime,
                market: "US" as const,
                marketCap: "",
                fiscalQuarter: "",
                epsForecast,
                lastYearEps: "-",
                noOfEstimates: 0,
              };
            }
          }
          return null;
        } catch {
          return null;
        }
      })
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }
  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weeksStr = searchParams.get("weeks") || "4"; // 기본 4주
  const weeks = Math.min(parseInt(weeksStr) || 4, 52);

  try {
    const today = new Date();
    const dates: string[] = [];

    // 주어진 주 수만큼 평일 날짜 생성
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const dt = new Date(today);
        dt.setDate(today.getDate() + w * 7 + d);
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) continue; // 주말 제외
        dates.push(dt.toISOString().slice(0, 10));
      }
    }

    // Nasdaq API에서 실적 발표 데이터 (최대 20일씩 배치)
    // 너무 많은 요청 방지: 최대 30 평일 (약 6주) + 이후는 주요 종목만 하드코딩
    const nasdaqDates = dates.slice(0, Math.min(dates.length, 30));
    const nasdaqPromises = nasdaqDates.map(d => fetchNasdaqEarnings(d));
    const nasdaqResults = await Promise.all(nasdaqPromises);

    // US 실적 - 주요 종목만 필터 (시가총액 $1B 이상 또는 유명 종목)
    const MAJOR_US = new Set([
      "AAPL", "MSFT", "NVDA", "GOOG", "GOOGL", "AMZN", "META", "TSLA", "BRK.B",
      "UNH", "JNJ", "V", "XOM", "WMT", "JPM", "PG", "MA", "HD", "CVX",
      "MRK", "ABBV", "KO", "PEP", "COST", "AVGO", "LLY", "TMO", "MCD",
      "CSCO", "ACN", "ORCL", "CRM", "AMD", "INTC", "QCOM", "ADBE", "TXN",
      "NFLX", "DIS", "NKE", "PYPL", "BA", "CAT", "GE", "GS", "MS",
      "BABA", "PDD", "JD", "NIO", "LI", "XPEV", "BIDU",
      "MU", "LRCX", "AMAT", "KLAC", "MRVL", "ARM", "SMCI",
    ]);

    const usEntries: EarningsEntry[] = [];
    for (const dayEntries of nasdaqResults) {
      for (const entry of dayEntries) {
        // 시가총액 $10B+ 또는 주요 종목
        const mcap = parseFloat(entry.marketCap.replace(/[$,]/g, "")) || 0;
        if (mcap >= 10e9 || MAJOR_US.has(entry.symbol)) {
          usEntries.push(entry);
        }
      }
    }

    // 한국 종목
    const krEntries = getKoreanEarnings();

    // Nasdaq API 범위 밖 주요 종목 보충 (EarningsWhispers)
    const coveredSymbols = new Set(usEntries.map(e => e.symbol));
    const missingMajor = Array.from(MAJOR_US).filter(s => !coveredSymbols.has(s));

    if (missingMajor.length > 0) {
      const ewEntries = await fetchEarningsWhispersBatch(missingMajor.slice(0, 20));
      usEntries.push(...ewEntries);
    }

    // 미래 분기 추정: 이미 알려진 실적일에서 +90일 간격으로 추가 분기 생성
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const allCoveredNow = new Set(usEntries.map(e => e.symbol));
    const futureEstimates: EarningsEntry[] = [];

    for (const entry of usEntries) {
      // 이 종목의 다음 분기들 추정 (현재 날짜 + 90일, +180일, +270일)
      const baseDate = new Date(entry.date + "T12:00:00");
      for (let q = 1; q <= 3; q++) {
        const est = new Date(baseDate);
        est.setDate(est.getDate() + q * 91);
        if (est > oneYearLater) break;
        const estDateStr = est.toISOString().slice(0, 10);
        // 이미 해당 날짜 근처에 같은 종목 있는지 확인
        const alreadyExists = usEntries.some(e =>
          e.symbol === entry.symbol &&
          Math.abs(new Date(e.date).getTime() - est.getTime()) < 30 * 86400000
        ) || futureEstimates.some(e =>
          e.symbol === entry.symbol &&
          Math.abs(new Date(e.date).getTime() - est.getTime()) < 30 * 86400000
        );
        if (!alreadyExists && allCoveredNow.has(entry.symbol)) {
          futureEstimates.push({
            ...entry,
            date: estDateStr,
            kstDateTime: `${formatDateKr(estDateStr)} 예정 (추정)`,
            timeLabel: "미정",
            fiscalQuarter: "", // 추정이므로 빈칸
          });
        }
      }
    }

    usEntries.push(...futureEstimates);

    // 통합 + 날짜순 정렬 + 중복 제거
    const seen = new Set<string>();
    const allEntries = [...usEntries, ...krEntries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter(e => {
        const key = `${e.symbol}-${e.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    // 날짜별 그룹핑
    const grouped: Record<string, EarningsEntry[]> = {};
    for (const entry of allEntries) {
      if (!grouped[entry.date]) grouped[entry.date] = [];
      grouped[entry.date].push(entry);
    }

    return NextResponse.json({
      entries: allEntries,
      grouped,
      totalCount: allEntries.length,
      dateRange: {
        from: dates[0],
        to: dates[dates.length - 1],
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch earnings calendar", detail: String(err) },
      { status: 500 }
    );
  }
}
