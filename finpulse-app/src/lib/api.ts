/* ───────────────────── Types ───────────────────── */
export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d?: { price: number[] };
  image: string;
}

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
  market_cap: string;
  pe_ratio: number;
  high_52w: number;
  low_52w: number;
  market: string;
  currency: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string[];
  content?: string[];
  source: string;
  time: string;
  category: "stock" | "coin" | "macro";
  relatedTickers: { symbol: string; change: string }[];
  isBreaking?: boolean;
  link?: string;          // 원문 링크 (Google News RSS)
  pubDate?: string;       // 원문 발행시간 (ISO)
}

/* ────────────── Real Crypto (CoinGecko) ────────────── */
export async function fetchCoins(): Promise<CoinData[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&sparkline=true&price_change_percentage=24h",
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error("CoinGecko API error");
    return res.json();
  } catch {
    return getMockCoins();
  }
}

/* ────────────── Real Stock Data (Google Finance Scraping) ────────────── */

/**
 * Google Finance에서 스크래핑으로 실시간 주가를 가져옵니다.
 * Yahoo Finance API는 클라우드 IP(Vercel)에서 429 차단되지만,
 * Google Finance 웹 페이지는 안정적으로 접근 가능합니다.
 *
 * URL 형식: https://www.google.com/finance/quote/{symbol}:{exchange}
 * - US NASDAQ: AAPL:NASDAQ, NVDA:NASDAQ
 * - US NYSE: JPM:NYSE, V:NYSE
 * - Korean: 005930:KRX, 000660:KRX
 */

interface StockSymbolEntry {
  /** 앱 내부 심볼 (mock 데이터의 symbol과 일치) */
  symbol: string;
  /** Google Finance 심볼 (AAPL:NASDAQ, 005930:KRX) */
  gf: string;
  /** 종목명 */
  name: string;
  /** 거래소 */
  market: string;
}

const STOCK_SYMBOLS: StockSymbolEntry[] = [
  // US stocks - NASDAQ
  { symbol: "NVDA", gf: "NVDA:NASDAQ", name: "NVIDIA Corp", market: "NASDAQ" },
  { symbol: "AAPL", gf: "AAPL:NASDAQ", name: "Apple Inc", market: "NASDAQ" },
  { symbol: "MSFT", gf: "MSFT:NASDAQ", name: "Microsoft Corp", market: "NASDAQ" },
  { symbol: "GOOGL", gf: "GOOGL:NASDAQ", name: "Alphabet Inc", market: "NASDAQ" },
  { symbol: "AMZN", gf: "AMZN:NASDAQ", name: "Amazon.com", market: "NASDAQ" },
  { symbol: "META", gf: "META:NASDAQ", name: "Meta Platforms", market: "NASDAQ" },
  { symbol: "TSLA", gf: "TSLA:NASDAQ", name: "Tesla Inc", market: "NASDAQ" },
  { symbol: "AVGO", gf: "AVGO:NASDAQ", name: "Broadcom Inc", market: "NASDAQ" },
  { symbol: "AMD", gf: "AMD:NASDAQ", name: "AMD Inc", market: "NASDAQ" },
  { symbol: "NFLX", gf: "NFLX:NASDAQ", name: "Netflix Inc", market: "NASDAQ" },
  { symbol: "INTC", gf: "INTC:NASDAQ", name: "Intel Corp", market: "NASDAQ" },
  // US stocks - NYSE
  { symbol: "BRK-B", gf: "BRK.B:NYSE", name: "Berkshire Hathaway", market: "NYSE" },
  { symbol: "JPM", gf: "JPM:NYSE", name: "JPMorgan Chase", market: "NYSE" },
  { symbol: "V", gf: "V:NYSE", name: "Visa Inc", market: "NYSE" },
  { symbol: "UNH", gf: "UNH:NYSE", name: "UnitedHealth", market: "NYSE" },
  { symbol: "XOM", gf: "XOM:NYSE", name: "Exxon Mobil", market: "NYSE" },
  // Korean stocks - KRX
  { symbol: "005930", gf: "005930:KRX", name: "삼성전자", market: "KOSPI" },
  { symbol: "000660", gf: "000660:KRX", name: "SK하이닉스", market: "KOSPI" },
  { symbol: "373220", gf: "373220:KRX", name: "LG에너지솔루션", market: "KOSPI" },
  { symbol: "207940", gf: "207940:KRX", name: "삼성바이오로직스", market: "KOSPI" },
  { symbol: "005380", gf: "005380:KRX", name: "현대차", market: "KOSPI" },
  { symbol: "035720", gf: "035720:KRX", name: "카카오", market: "KOSPI" },
  { symbol: "035420", gf: "035420:KRX", name: "NAVER", market: "KOSPI" },
  { symbol: "006400", gf: "006400:KRX", name: "삼성SDI", market: "KOSPI" },
  { symbol: "051910", gf: "051910:KRX", name: "LG화학", market: "KOSPI" },
  { symbol: "000270", gf: "000270:KRX", name: "기아", market: "KOSPI" },
  { symbol: "068270", gf: "068270:KRX", name: "셀트리온", market: "KOSPI" },
  { symbol: "003670", gf: "003670:KRX", name: "포스코홀딩스", market: "KOSPI" },
  { symbol: "105560", gf: "105560:KRX", name: "KB금융", market: "KOSPI" },
  { symbol: "055550", gf: "055550:KRX", name: "신한지주", market: "KOSPI" },
  { symbol: "028260", gf: "028260:KRX", name: "삼성물산", market: "KOSPI" },
];

const GF_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Google Finance 페이지를 스크래핑하여 개별 종목의 실시간 가격을 가져옵니다.
 * - data-last-price: 현재 가격
 * - "Previous close" 텍스트 뒤의 값: 전일 종가
 * - data-currency-code: 통화
 * 반환: { price, prevClose, currency } 또는 null (실패 시)
 */
async function scrapeGoogleFinance(
  gfSymbol: string
): Promise<{ price: number; prevClose: number; currency: string } | null> {
  try {
    const res = await fetch(
      `https://www.google.com/finance/quote/${gfSymbol}`,
      {
        headers: { "User-Agent": GF_UA },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;

    const html = await res.text();

    // 1) 현재 가격: data-last-price 속성
    const priceStr = html.match(/data-last-price="([0-9.]+)"/)?.[1];
    if (!priceStr) return null;

    // 2) 전일 종가: "Previous close" 텍스트 뒤의 HTML 텍스트 노드에서 추출
    //    HTML 구조: >Previous close<...>The last closing price<...>$257.46<...>Day range<
    //    태그 사이 텍스트만 추출하여 통화기호가 있는 가격을 찾음
    let prevCloseStr: string | null = null;
    const prevIdx = html.indexOf("Previous close");
    if (prevIdx > 0) {
      const afterPrev = html.slice(prevIdx, prevIdx + 500);
      // HTML 태그 사이의 텍스트만 추출
      const textNodes = afterPrev.match(/>([^<]+)</g);
      if (textNodes) {
        for (const node of textNodes) {
          const text = node.slice(1, -1).trim(); // > ... < 제거
          // 통화기호로 시작하는 가격: $177.82, ₩188,400
          const priceMatch = text.match(/^[$₩€£]?([\d,]+\.?\d+)$/);
          if (priceMatch) {
            prevCloseStr = priceMatch[1].replace(/,/g, "");
            break;
          }
          // 한국 주식: 순수 숫자 (100 이상)
          const numMatch = text.match(/^([\d,]+)$/);
          if (numMatch) {
            const val = parseFloat(numMatch[1].replace(/,/g, ""));
            if (val >= 100) {
              prevCloseStr = numMatch[1].replace(/,/g, "");
              break;
            }
          }
        }
      }
    }

    // 3) 통화
    const currency = html.match(/data-currency-code="([^"]+)"/)?.[1] || "USD";

    const price = parseFloat(priceStr);
    const prevClose = prevCloseStr ? parseFloat(prevCloseStr) : price;

    return { price, prevClose, currency };
  } catch {
    return null;
  }
}

/**
 * 모듈 레벨 캐시 — 같은 빌드/런타임 내에서 중복 API 호출을 방지합니다.
 */
let _cachedStocks: StockData[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 55_000; // 55초

/**
 * Google Finance에서 실시간 주가를 스크래핑합니다.
 * 31개 종목을 병렬로 가져오되, 5개씩 배치로 처리하여 rate limit을 방지합니다.
 * mock 데이터를 기본 뼈대로 사용하고, 실시간 가격으로 덮어씁니다.
 */
export async function fetchStocks(): Promise<StockData[]> {
  // 캐시가 유효하면 즉시 반환
  if (_cachedStocks && Date.now() - _cacheTime < CACHE_TTL) {
    return _cachedStocks;
  }

  const base = getMockStocks();

  try {
    // 8개씩 배치로 병렬 요청 (Google Finance rate limit 방지)
    const BATCH_SIZE = 8;
    const priceMap = new Map<string, { price: number; prevClose: number; currency: string }>();

    for (let i = 0; i < STOCK_SYMBOLS.length; i += BATCH_SIZE) {
      const batch = STOCK_SYMBOLS.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((s) => scrapeGoogleFinance(s.gf))
      );

      results.forEach((res, idx) => {
        if (res.status === "fulfilled" && res.value) {
          priceMap.set(batch[idx].symbol, res.value);
        }
      });
    }

    let updatedCount = 0;
    const updated = base.map((stock) => {
      const entry = STOCK_SYMBOLS.find((s) => s.symbol === stock.symbol);
      if (!entry) return stock;

      const gfData = priceMap.get(entry.symbol);
      if (!gfData) return stock;

      const price = gfData.price;
      const prev = gfData.prevClose;
      const changePct = prev > 0 ? Math.round(((price - prev) / prev) * 10000) / 100 : 0;
      const isKR = gfData.currency === "KRW";

      updatedCount++;
      return {
        ...stock,
        price,
        change_percent: changePct,
        market: entry.market,
        currency: isKR ? "₩" : "$",
      };
    });

    console.log(`[FinPulse] Google Finance: ${updatedCount}/${STOCK_SYMBOLS.length} stocks updated in real-time`);

    // 캐시 저장
    _cachedStocks = updated;
    _cacheTime = Date.now();

    return updated;
  } catch (err) {
    console.log(`[FinPulse] fetchStocks error:`, err);
    return base;
  }
}

/* ────────────── News (Real-time RSS) ────────────── */

/** 안정적 ID 생성 (제목 기반 해시 → 캐시 갱신 시 ID가 바뀌지 않음) */
function stableId(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = ((h << 5) - h + title.charCodeAt(i)) & 0x7fffffff;
  }
  return h.toString(36);
}

/** 상대 시간 포맷 (pubDate → "3분 전", "2시간 전", "1일 전") */
function relativeTime(pubDate: string): string {
  const now = Date.now();
  const pub = new Date(pubDate).getTime();
  if (isNaN(pub)) return "";
  const diff = Math.max(0, now - pub);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

/** RSS 아이템 타입 */
interface RssItem {
  title: string;
  link: string;         // 원본 링크 (Google redirect URL 또는 실제 URL)
  sourceUrl: string;    // 실제 기사 URL (<source url="..."> 에서 추출)
  pubDate: string;
  source: string;
  description: string;  // RSS description (요약 텍스트)
}

/** 간단한 RSS XML 파서 — <item> 단위로 title, link, pubDate, source, sourceUrl, description 추출 */
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ?? "";
    // 실제 기사 URL: <source url="https://actual-article.com/...">
    const sourceUrl = block.match(/<source[^>]*url="([^"]*)"[^>]*>/)?.[1]?.trim() ?? "";
    // RSS description (요약 텍스트 — 엔티티 디코딩 후 태그 제거)
    let descRaw = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") ?? "";
    // 1. HTML 엔티티를 먼저 디코딩 (Google News는 &lt;a&gt; 형태로 인코딩)
    descRaw = descRaw.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
    // 2. 그 다음 HTML 태그 제거
    const description = descRaw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (title) items.push({ title, link, pubDate, source, sourceUrl, description });
  }
  return items;
}

// 뉴스 모듈 레벨 캐시 (5분 TTL)
let _newsCache: NewsItem[] | null = null;
let _newsCacheTime = 0;
const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5분

/** Google News RSS 피드 가져오기 */
async function fetchGoogleRss(query: string): Promise<RssItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml);
  } catch {
    return [];
  }
}

/** kr.investing.com RSS 피드 가져오기 (한국어 해외 뉴스) */
async function fetchInvestingRss(): Promise<RssItem[]> {
  try {
    const res = await fetch("https://kr.investing.com/rss/news.rss", {
      next: { revalidate: 300 },
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: RssItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml)) !== null) {
      const block = m[1];
      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() ?? "";
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
      const pubDateRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      const pubDate = pubDateRaw.includes("T") || pubDateRaw.includes("GMT") ? pubDateRaw : pubDateRaw.replace(" ", "T") + "+00:00";
      let descRaw2 = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
        ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") ?? "";
      descRaw2 = descRaw2.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
      const description = descRaw2.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (title && !title.includes("내부자 거래")) {
        items.push({ title, link, pubDate, source: "Investing.com", sourceUrl: link, description });
      }
    }
    return items;
  } catch {
    return [];
  }
}

/** 한국 뉴스사이트 RSS 가져오기 (직접 URL → 본문 추출 가능) */
async function fetchKoreanRss(feedUrl: string, defaultSource: string): Promise<RssItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: RssItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xml)) !== null && items.length < 10) {
      const block = m[1];
      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
        ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() ?? "";
      let link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
      link = link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim(); // CDATA 제거
      const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      let desc = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
        ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") ?? "";
      desc = desc.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
      desc = desc.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (title && link.startsWith("http")) {
        items.push({ title, link, pubDate, source: defaultSource, sourceUrl: "", description: desc });
      }
    }
    return items;
  } catch {
    return [];
  }
}

/** HTML에서 텍스트 단락 추출 (한국 뉴스 사이트 최적화) */
function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];

  // 본문 컨테이너 탐지 (indexOf 기반 — 중첩 div에서도 안전)
  // 매칭된 태그부터 최대 15000자를 검색 영역으로 사용
  const containerMarkers = [
    'itemprop="articleBody"',                      // 매일경제 등 (시맨틱 표준)
    'id="dic_area"',                               // 네이버뉴스
    'class="article_body"', 'class="article-body"',
    'class="news_cnt_detail_wrap"',                // 매일경제
    'class="story_area"',                          // 한국경제
    'class="article_txt"',                         // 연합뉴스
    'class="text_area"',                           // SBS
    'class="article_content"',
    '<article',                                    // 일반 <article> 태그
  ];

  let searchArea = "";
  for (const marker of containerMarkers) {
    const idx = html.indexOf(marker);
    if (idx > 0) {
      // 마커 위치부터 최대 15000자 추출
      const chunk = html.slice(idx, idx + 15000);
      // <p> 태그가 있는지 빠르게 확인
      if (chunk.includes("<p")) {
        searchArea = chunk;
        break;
      }
    }
  }
  if (!searchArea) searchArea = html;

  // <p> 태그에서 텍스트 추출
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRegex.exec(searchArea)) !== null) {
    let text = pm[1].replace(/<[^>]+>/g, "").trim();
    text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/&middot;/g, "·").replace(/&hellip;/g, "…")
      .replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim();

    // 노이즈 필터링 (한국 뉴스 사이트 네비/광고/UI 텍스트 제외)
    const lower = text.toLowerCase();
    if (text.length > 25 &&
      !lower.includes("copyright") && !lower.includes("cookie") &&
      !lower.includes("javascript") && !lower.includes("subscribe") &&
      !lower.includes("sign up") && !lower.includes("로그인") &&
      !lower.includes("뉴스레터") && !lower.includes("글자크기") &&
      !lower.includes("무단전재") && !lower.includes("재배포") &&
      !lower.includes("기자 =") &&
      !lower.includes("maeil business") && !lower.includes("매일경제 60") &&
      !lower.includes("나만의 ai") && !lower.includes("hankyung") &&
      !lower.includes("한국경제신문") && !lower.includes("mk.co.kr") &&
      !lower.includes("sbs 뉴스") && !lower.includes("yonhapnews") &&
      !lower.includes("연합뉴스 ") && !lower.includes("저작권자") &&
      !lower.includes("앱으로") && !lower.includes("google play") &&
      !lower.includes("app store") && !lower.includes("댓글") &&
      !lower.includes("좋아요") && !lower.includes("공유하기") &&
      !lower.includes("more,, or") &&
      !text.includes("©") && !text.startsWith("[") &&
      !/^[\d\s.,-]+$/.test(text) &&
      // 사이드바 AI 프롬프트 질문 (매일경제 등) 필터
      !(text.endsWith("?") && text.length < 100 && /^(한국|최근|미국|글로벌|세계|중국|일본|20\d{2}년)/.test(text)) &&
      // 신문사 푸터 정보 (주소, 등록번호, 발행인 등) 필터
      !text.includes("등록번호") && !text.includes("등록일자") &&
      !text.includes("발행/편집인") && !text.includes("발행인 :") && !text.includes("편집인 :") &&
      !/^주소\s*:/.test(text) && !/전화\s*:\s*\d{2,3}-/.test(text) &&
      !text.includes("인터넷신문") && !text.includes("일간신문") &&
      !text.includes("청소년보호책임자") && !text.includes("대표이사") &&
      !text.includes("사업자등록번호") && !text.includes("통신판매") &&
      // 너무 짧은 광고/네비 텍스트
      text.length < 2000) {
      paragraphs.push(text);
    }
  }
  return paragraphs;
}

/** 기사 본문 추출 (HTML → 텍스트 단락) */
export async function fetchArticleContent(url: string): Promise<string[]> {
  try {
    // Google News redirect URL → 서버 측 추출 불가
    if (url.includes("news.google.com") || url.includes("investing.com")) {
      return [];
    }
    // 도메인만 있는 URL (sourceUrl fallback) → 스킵
    const urlPath = new URL(url).pathname;
    if (!urlPath || urlPath === "/") return [];

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const paragraphs = extractParagraphs(html);
    return paragraphs.slice(0, 15);
  } catch {
    return [];
  }
}

/** 실시간 뉴스 가져오기 (한국 뉴스 RSS + Google News RSS) */
export async function fetchNews(): Promise<NewsItem[]> {
  // 캐시 확인
  if (_newsCache && Date.now() - _newsCacheTime < NEWS_CACHE_TTL) {
    return _newsCache;
  }

  try {
    // ── 한국 뉴스 사이트 RSS (직접 URL → 본문 추출 가능!) ──
    // ── Google News RSS (다양한 소스 커버) ──
    const [
      hankyung, mk, yonhap, sbs,
      googleStockKR, googleStockUS, googleCoin,
      googleMacroKR, googleMacroGlobal, investingItems,
    ] = await Promise.all([
      fetchKoreanRss("https://www.hankyung.com/feed/all-news", "한국경제"),
      fetchKoreanRss("https://www.mk.co.kr/rss/40300001/", "매일경제"),
      fetchKoreanRss("https://www.yna.co.kr/rss/economy.xml", "연합뉴스"),
      fetchKoreanRss("https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER", "SBS"),
      fetchGoogleRss("주식 증시 코스피 코스닥"),
      fetchGoogleRss("나스닥 미국증시 S&P500 반도체"),
      fetchGoogleRss("비트코인 코인 가상화폐 이더리움 알트코인"),
      fetchGoogleRss("세계경제 금리 환율 연준 기준금리"),
      fetchGoogleRss("월가 월스트리트 유럽증시 글로벌 경제"),
      fetchInvestingRss(),
    ]);

    // 한국 뉴스사이트 피드를 우선 배치 (본문 추출 가능하므로)
    const koreanDirect = [...hankyung, ...mk, ...yonhap, ...sbs];
    // stockItems 는 filteredStockItems로 대체 (금융 키워드 필터링)
    const coinItems = [...googleCoin];
    const macroItems = [...googleMacroKR, ...googleMacroGlobal, ...investingItems];

    const articles: NewsItem[] = [];
    const seenTitles = new Set<string>();

    // 카테고리별로 뉴스 추가
    const addItems = (
      items: RssItem[],
      category: "stock" | "coin" | "macro",
      maxCount: number
    ) => {
      let count = 0;
      for (const item of items) {
        if (count >= maxCount) break;

        // 제목에서 " - 소스" 부분 제거 (Google News RSS 제목 형식)
        let cleanTitle = item.title;
        const lastDash = cleanTitle.lastIndexOf(" - ");
        if (lastDash > 0 && lastDash > cleanTitle.length - 30) {
          cleanTitle = cleanTitle.substring(0, lastDash).trim();
        }

        // 중복 제거
        const titleKey = cleanTitle.substring(0, 30);
        if (seenTitles.has(titleKey)) continue;
        seenTitles.add(titleKey);

        // RSS description 폴백 (제목과 다를 때만 사용)
        let descContent: string[] | undefined;
        if (item.description && item.description.length > 30) {
          const descStart = item.description.substring(0, 25);
          const titleStart = cleanTitle.substring(0, 25);
          if (descStart !== titleStart) {
            descContent = [item.description];
          }
        }

        articles.push({
          id: stableId(cleanTitle),     // ★ 안정적 ID (제목 해시)
          title: cleanTitle,
          summary: [cleanTitle],
          content: descContent,
          source: item.source || "Google News",
          time: relativeTime(item.pubDate),
          pubDate: item.pubDate,
          category,
          relatedTickers: [],
          link: item.link,              // ★ 항상 원본 link 사용
          isBreaking: false,
        });
        count++;
      }
    };

    // 주식/증권/금/경제 관련 뉴스만 필터링
    const FINANCE_KEYWORDS = [
      "주식", "증시", "코스피", "코스닥", "상장", "시가총액", "PER", "배당",
      "반도체", "삼성", "SK", "LG", "현대", "기아", "네이버", "카카오",
      "나스닥", "다우", "S&P", "월가", "월스트리트", "NYSE", "NASDAQ",
      "NVDA", "AAPL", "TSLA", "MSFT", "AMZN", "META", "GOOG",
      "금리", "기준금리", "연준", "Fed", "ECB", "BOJ", "한은",
      "환율", "달러", "원화", "엔화", "유로", "위안",
      "금값", "금시세", "금가격", "gold", "원자재",
      "ETF", "IPO", "공모", "상장", "코넥스",
      "실적", "매출", "영업이익", "순이익", "분기",
      "투자", "펀드", "자산", "포트폴리오", "수익률",
      "경제", "GDP", "인플레", "디플레", "고용", "실업",
      "채권", "국채", "회사채", "수익률",
      "stock", "market", "bull", "bear", "rally", "crash",
      "earnings", "revenue", "profit", "dividend",
      "AI", "인공지능", "GPU", "데이터센터",
    ];

    const isFinanceRelated = (title: string) => {
      const lower = title.toLowerCase();
      return FINANCE_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
    };

    // 한국 RSS 뉴스는 금융 키워드 필터링 적용
    const filteredKorean = koreanDirect.filter(item => isFinanceRelated(item.title));
    const filteredStockItems = [...filteredKorean, ...googleStockKR, ...googleStockUS];

    addItems(filteredStockItems, "stock", 15);
    addItems(coinItems, "coin", 8);
    addItems(macroItems, "macro", 12);

    // 시간순 정렬 (최신 먼저)
    articles.sort((a, b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return tb - ta;
    });

    // 가장 최신 뉴스를 "속보"로 표시
    if (articles.length > 0) articles[0].isBreaking = true;

    console.log(`[FinPulse] Google News: ${articles.length}개 실시간 뉴스 수집 완료`);

    _newsCache = articles;
    _newsCacheTime = Date.now();
    return articles;
  } catch (err) {
    console.log(`[FinPulse] fetchNews error:`, err);
    return _newsCache ?? [];
  }
}

/** 동기 버전 (이전 호환 — 캐시된 데이터만 반환) */
export function getAllNews(): NewsItem[] {
  return _newsCache ?? [];
}

/** DEPRECATED: 이전 dummy 데이터 — 아래는 삭제하지 않고 주석 처리 */
/* OLD DUMMY NEWS REMOVED — replaced by fetchNews() above */

/*
  return [
    {
      id: "1",
      title: "엔비디아, 차세대 AI 칩 'Blackwell Ultra' 발표 — 데이터센터 시장 판도 변화 예고",
      summary: [
        "엔비디아가 신규 AI 칩 Blackwell Ultra를 공개하며 전작 대비 40% 향상된 성능을 강조했습니다.",
        "마이크로소프트, 구글, 아마존이 사전 주문을 완료한 것으로 알려졌습니다.",
        "발표 직후 시간외 거래에서 주가가 4.2% 상승했습니다.",
      ],
      content: [
        "엔비디아는 연례 GTC 컨퍼런스에서 차세대 AI 반도체 'Blackwell Ultra'를 공식 발표했습니다. 이 칩은 전작 Blackwell 대비 AI 추론 성능이 40%, 학습 성능이 30% 이상 향상된 것이 특징입니다.",
        "젠슨 황 CEO는 기조연설에서 'AI 인프라 수요는 이제 시작'이라며 데이터센터 시장의 폭발적 성장을 전망했습니다. 특히 소버린 AI(각국 정부의 자체 AI 인프라) 수요가 새로운 성장 동력이 될 것이라고 강조했습니다.",
        "주요 클라우드 사업자인 마이크로소프트, 구글(GCP), 아마존(AWS)이 이미 대규모 사전 주문을 완료한 것으로 알려졌으며, 이는 2025년 하반기 매출에 크게 기여할 전망입니다.",
        "시장 전문가들은 Blackwell Ultra가 엔비디아의 데이터센터 부문 매출을 전년 대비 60% 이상 끌어올릴 것으로 예측하고 있습니다.",
      ],
      source: "Reuters", time: "25분 전", category: "stock",
      relatedTickers: [{ symbol: "NVDA", change: "+4.2%" }, { symbol: "MSFT", change: "+0.8%" }],
    },
    {
      id: "2",
      title: "비트코인 ETF, 5일 연속 순유입 — 기관 투자 수요 지속 확인",
      summary: [
        "미국 비트코인 현물 ETF에 5거래일 연속 총 $2.1B 순유입이 발생했습니다.",
        "BlackRock IBIT가 전체 유입의 62%를 차지하며 시장을 주도하고 있습니다.",
        "분석가들은 $100K 돌파 시도가 임박했다고 전망합니다.",
      ],
      content: [
        "미국 현물 비트코인 ETF 시장에서 5거래일 연속 순유입이 기록되며 총 누적 유입액이 21억 달러에 달했습니다.",
        "BlackRock의 IBIT가 전체 유입의 62%를 차지하며 압도적인 시장 점유율을 보여주고 있으며, Fidelity의 FBTC가 22%로 그 뒤를 잇고 있습니다.",
        "기관 투자자들의 참여가 늘어나면서 비트코인의 10만 달러 돌파 시도가 임박했다는 분석이 나오고 있습니다.",
      ],
      source: "CoinDesk", time: "1시간 전", category: "coin",
      relatedTickers: [{ symbol: "bitcoin", change: "+1.8%" }, { symbol: "ethereum", change: "+2.3%" }],
    },
    {
      id: "3",
      title: "Fed 파월 의장 \"금리 인하 서두르지 않겠다\" — 시장 기대와 온도차",
      isBreaking: true,
      summary: [
        "파월 의장이 상원 청문회에서 인플레이션 목표 2%에 아직 도달하지 못했다고 발언했습니다.",
        "6월 금리 인하 가능성이 68%에서 52%로 하락했습니다.",
        "기술주 중심으로 나스닥 선물이 0.3% 하락했습니다.",
      ],
      content: [
        "제롬 파월 Fed 의장은 상원 은행위원회 청문회에서 '인플레이션은 2% 목표에 아직 도달하지 못했다'며 금리 인하를 서두르지 않겠다는 입장을 재확인했습니다.",
        "이에 따라 CME FedWatch 기준 6월 금리 인하 확률이 68%에서 52%로 급락했으며, 시장에서는 첫 금리 인하 시점을 9월로 늦춰 잡는 분위기가 형성되고 있습니다.",
        "파월 의장의 매파적 발언 이후 기술주 중심의 나스닥 선물이 0.3% 하락했으며, 미 국채 10년물 금리는 4.35%로 소폭 상승했습니다.",
      ],
      source: "Bloomberg", time: "2시간 전", category: "macro",
      relatedTickers: [{ symbol: "AAPL", change: "-0.3%" }, { symbol: "MSFT", change: "-0.2%" }],
    },
    {
      id: "4",
      title: "솔라나, 새로운 DEX 거래량 사상 최고 — 이더리움 대비 수수료 경쟁력 부각",
      summary: [
        "솔라나 기반 DEX의 24시간 거래량이 $8.2B로 사상 최고치를 기록했습니다.",
        "이더리움 DEX 거래량의 85% 수준에 도달하며 격차가 빠르게 줄고 있습니다.",
        "Raydium과 Jupiter가 거래의 78%를 차지하고 있습니다.",
      ],
      content: [
        "솔라나 블록체인 기반 탈중앙화 거래소(DEX)들의 24시간 누적 거래량이 82억 달러를 기록하며 역대 최고치를 경신했습니다.",
        "이는 이더리움 기반 DEX 거래량의 85%에 해당하는 수준으로, 불과 1년 전 30% 수준이었던 것과 비교하면 놀라운 성장세입니다.",
      ],
      source: "The Block", time: "3시간 전", category: "coin",
      relatedTickers: [{ symbol: "solana", change: "+3.1%" }, { symbol: "ethereum", change: "-0.4%" }],
    },
    {
      id: "5",
      title: "삼성전자, HBM3E 양산 시작 — 엔비디아 납품 경쟁 가속",
      summary: [
        "삼성전자가 HBM3E 12단 제품의 양산을 공식 시작했습니다.",
        "SK하이닉스에 이어 두 번째로 HBM3E 양산에 진입한 것입니다.",
        "엔비디아 차세대 GPU 탑재를 목표로 하반기 납품을 준비 중입니다.",
      ],
      content: [
        "삼성전자가 HBM3E 12단 적층 제품의 양산을 공식 시작했습니다. 이는 SK하이닉스에 이어 글로벌 두 번째 양산 사례입니다.",
        "삼성전자는 엔비디아의 차세대 GPU인 Blackwell Ultra에 HBM3E를 탑재하는 것을 목표로 하반기 대규모 납품을 준비하고 있습니다.",
        "HBM(고대역폭메모리) 시장은 AI 반도체 수요 급증으로 2025년 300억 달러 규모로 성장할 것으로 전망됩니다.",
      ],
      source: "한국경제", time: "4시간 전", category: "stock",
      relatedTickers: [{ symbol: "005930", change: "-1.1%" }, { symbol: "000660", change: "+2.8%" }],
    },
    {
      id: "6",
      title: "애플, Vision Pro 2세대 개발 착수 — 더 가볍고 저렴한 모델 예고",
      summary: [
        "애플이 Vision Pro 2세대 헤드셋 개발에 본격 착수했습니다.",
        "현재 모델 대비 40% 가벼운 디자인과 $1,999 이하 가격대를 목표로 합니다.",
        "2025년 말 ~ 2026년 초 출시가 예상됩니다.",
      ],
      content: [
        "애플이 차세대 Vision Pro 2 개발에 본격 착수한 것으로 알려졌습니다. 새로운 모델은 현재 버전 대비 무게를 40% 이상 줄이는 것이 핵심 목표입니다.",
        "가격대도 현재 $3,499에서 $1,999 이하로 대폭 낮춰 대중화를 노리고 있으며, M4 칩 기반의 향상된 성능을 탑재할 예정입니다.",
      ],
      source: "The Information", time: "5시간 전", category: "stock",
      relatedTickers: [{ symbol: "AAPL", change: "+1.2%" }, { symbol: "META", change: "-0.5%" }],
    },
    {
      id: "7",
      title: "이더리움 Dencun 업그레이드 후 L2 수수료 90% 절감 — 생태계 활성화 기대",
      summary: [
        "이더리움 Dencun 업그레이드 이후 L2 네트워크 수수료가 90% 이상 절감되었습니다.",
        "Arbitrum, Optimism 등 주요 L2의 일일 트랜잭션이 3배 증가했습니다.",
        "ETH 가격은 업그레이드 소식에 2.3% 상승했습니다.",
      ],
      content: [
        "이더리움의 Dencun 업그레이드가 성공적으로 완료된 이후, Layer 2 네트워크들의 가스비가 90% 이상 절감되는 효과가 나타나고 있습니다.",
        "Arbitrum과 Optimism 등 주요 L2 네트워크의 일일 트랜잭션 수가 업그레이드 전 대비 3배 이상 증가했으며, 이는 DeFi 생태계 활성화로 이어지고 있습니다.",
      ],
      source: "CoinDesk", time: "5시간 전", category: "coin",
      relatedTickers: [{ symbol: "ethereum", change: "+2.3%" }],
    },
    {
      id: "8",
      title: "테슬라, 중국 판매량 3개월 연속 증가 — FSD 중국 출시 임박",
      summary: [
        "테슬라 중국 3월 판매량이 전년 대비 15% 증가한 8.9만대를 기록했습니다.",
        "FSD(완전자율주행) 중국 시장 출시가 임박한 것으로 알려졌습니다.",
        "주가는 장 중 3.5% 반등하며 긍정적 반응을 보였습니다.",
      ],
      content: [
        "테슬라의 3월 중국 판매량이 약 89,000대로 집계되며 전년 동기 대비 15% 증가했습니다.",
        "더불어 테슬라의 FSD 시스템의 중국 시장 출시가 임박했다는 소식이 전해지면서 기대감이 커지고 있습니다.",
      ],
      source: "CNBC", time: "6시간 전", category: "stock",
      relatedTickers: [{ symbol: "TSLA", change: "+3.5%" }],
    },
    {
      id: "9",
      title: "XRP, SEC 소송 합의 임박 — 리플 CEO \"규제 명확성 확보\" 자신감",
      summary: [
        "리플과 SEC 간 소송이 합의를 통해 마무리될 가능성이 높아졌습니다.",
        "리플 CEO는 '규제 명확성을 확보했다'며 자신감을 표명했습니다.",
        "XRP 가격이 소식에 5.2% 급등했습니다.",
      ],
      content: [
        "리플(Ripple)과 미국 증권거래위원회(SEC) 간의 오랜 법적 분쟁이 합의를 통해 마무리될 가능성이 높아졌습니다.",
        "브래드 갈링하우스 리플 CEO는 '이번 합의를 통해 XRP의 규제 명확성이 확보될 것'이라며 강한 자신감을 표명했습니다.",
      ],
      source: "CoinTelegraph", time: "7시간 전", category: "coin",
      relatedTickers: [{ symbol: "ripple", change: "+5.2%" }],
    },
    {
      id: "10",
      title: "마이크로소프트, Copilot 기업용 대규모 업데이트 — AI PC 시대 본격화",
      summary: [
        "마이크로소프트가 Copilot for Business의 대규모 업데이트를 발표했습니다.",
        "Excel, PowerPoint 등 Office 전 제품에 AI 에이전트 기능이 통합됩니다.",
        "기업 고객 사이에서 AI PC 도입이 가속화될 전망입니다.",
      ],
      content: [
        "마이크로소프트가 기업용 AI 비서 'Copilot for Business'의 대규모 업데이트를 발표했습니다.",
        "특히 Excel에서 자연어로 복잡한 데이터 분석을 수행하고, PowerPoint에서 프레젠테이션을 자동 생성하는 기능이 주목받고 있습니다.",
      ],
      source: "The Verge", time: "8시간 전", category: "stock",
      relatedTickers: [{ symbol: "MSFT", change: "+1.5%" }, { symbol: "GOOGL", change: "-0.3%" }],
    },
    {
      id: "11",
      title: "도지코인, 일론 머스크 SNS 게시물에 15% 급등 — 밈코인 열풍 재점화",
      summary: [
        "일론 머스크의 X(트위터) 게시물 이후 도지코인이 15% 급등했습니다.",
        "밈코인 전체 시가총액이 24시간 만에 $12B 증가했습니다.",
        "전문가들은 단기 과열 경고를 내놓고 있습니다.",
      ],
      content: [
        "일론 머스크가 X(구 트위터)에 도지코인 관련 밈 이미지를 게시한 후, DOGE 가격이 15% 이상 급등하는 모습을 보였습니다.",
        "이 영향으로 밈코인 전체 시가총액이 24시간 만에 120억 달러 이상 증가했습니다.",
      ],
      source: "Decrypt", time: "9시간 전", category: "coin",
      relatedTickers: [{ symbol: "dogecoin", change: "+15.2%" }, { symbol: "TSLA", change: "+0.8%" }],
    },
    {
      id: "12",
      title: "SK하이닉스, 1분기 영업이익 7조원 전망 — HBM 효과 본격화",
      summary: [
        "SK하이닉스의 1분기 영업이익이 7조원을 돌파할 것으로 전망됩니다.",
        "HBM3E 제품의 출하가 본격화되며 수익성이 크게 개선되었습니다.",
        "외국인 투자자의 순매수가 3주 연속 이어지고 있습니다.",
      ],
      content: [
        "증권가에서는 SK하이닉스의 2025년 1분기 영업이익이 7조원을 돌파할 것으로 전망하고 있습니다.",
        "HBM3E 제품의 본격적인 출하와 함께 AI 서버용 메모리 수요 급증이 실적 개선의 핵심 동력으로 작용하고 있습니다.",
      ],
      source: "매일경제", time: "10시간 전", category: "stock",
      relatedTickers: [{ symbol: "000660", change: "+2.8%" }, { symbol: "005930", change: "+0.5%" }],
    },
    {
      id: "13",
      title: "아마존 AWS, AI 전용 칩 Trainium3 공개 — 엔비디아 독주 체제 도전",
      summary: [
        "아마존 AWS가 자체 AI 학습 칩 Trainium3를 공개했습니다.",
        "엔비디아 H100 대비 40% 저렴한 가격으로 AI 학습 비용 절감을 제시합니다.",
        "AWS 클라우드에서 즉시 사용 가능한 서비스로 제공됩니다.",
      ],
      content: [
        "아마존웹서비스(AWS)가 자체 개발한 3세대 AI 학습 칩 'Trainium3'를 공개했습니다.",
        "AWS는 Trainium3 기반의 새로운 EC2 인스턴스를 즉시 이용할 수 있도록 서비스를 시작했습니다.",
      ],
      source: "TechCrunch", time: "11시간 전", category: "stock",
      relatedTickers: [{ symbol: "AMZN", change: "+2.1%" }, { symbol: "NVDA", change: "-1.2%" }],
    },
    {
      id: "14",
      title: "유럽중앙은행(ECB), 금리 0.25%p 인하 — 유로존 경기 부양 시그널",
      summary: [
        "ECB가 기준금리를 0.25%p 인하하여 3.5%로 조정했습니다.",
        "유로존 경기 둔화 우려에 따른 선제적 조치로 해석됩니다.",
        "유럽 증시가 일제히 상승하며 긍정적 반응을 보였습니다.",
      ],
      content: [
        "유럽중앙은행(ECB)이 기준금리를 0.25%포인트 인하하여 3.5%로 조정했습니다.",
        "라가르드 ECB 총재는 '유로존 경기 둔화 리스크가 커지고 있다'며 추가 인하 가능성도 열어두었습니다.",
      ],
      source: "Financial Times", time: "12시간 전", category: "macro",
      relatedTickers: [{ symbol: "MSFT", change: "+0.5%" }, { symbol: "GOOGL", change: "+0.3%" }],
    },
    {
      id: "15",
      title: "NAVER, 하이퍼클로바X 기업용 서비스 출시 — 국내 AI 시장 경쟁 심화",
      summary: [
        "네이버가 하이퍼클로바X 기반 기업용 AI 서비스를 본격 출시했습니다.",
        "삼성전자, 현대차 등 대기업 5곳과 초기 계약을 체결했습니다.",
        "국내 AI 시장에서 삼성SDS, KT 등과의 경쟁이 본격화됩니다.",
      ],
      content: [
        "네이버가 자체 LLM '하이퍼클로바X'를 기반으로 한 기업용 AI 서비스를 본격 출시했습니다.",
        "삼성전자, 현대차, LG전자, 포스코, KB금융 등 대기업 5곳과 초기 도입 계약을 체결한 것으로 알려졌습니다.",
      ],
      source: "조선비즈", time: "13시간 전", category: "stock",
      relatedTickers: [{ symbol: "035420", change: "+3.2%" }, { symbol: "035720", change: "+1.1%" }],
    },
    {
      id: "16",
      title: "메타, 차세대 AR 글래스 'Orion' 양산 계획 발표 — AR 시장 선점",
      summary: [
        "메타가 AR 글래스 Orion의 양산 계획을 공식 발표했습니다.",
        "$799 가격대로 2025년 4분기 출시를 목표로 합니다.",
        "일반 안경과 유사한 디자인으로 대중화를 노립니다.",
      ],
      content: [
        "메타(Meta)가 차세대 AR 글래스 'Orion'의 양산 계획을 공식 발표했습니다. 가격은 $799로 책정되었습니다.",
        "마크 저커버그 CEO는 'Orion은 스마트폰 이후의 차세대 컴퓨팅 플랫폼이 될 것'이라고 강조했습니다.",
      ],
      source: "The Verge", time: "14시간 전", category: "stock",
      relatedTickers: [{ symbol: "META", change: "+4.1%" }, { symbol: "AAPL", change: "-0.3%" }],
    },
    {
      id: "17",
      title: "일본은행(BOJ), 금리 동결 — 엔화 약세 지속으로 수출주 영향 분석",
      summary: [
        "일본은행이 기준금리를 현행 0.25%로 동결했습니다.",
        "엔/달러 환율이 155엔을 돌파하며 엔화 약세가 지속됩니다.",
        "일본 수출 기업과 한국 경쟁사에 대한 영향이 주목됩니다.",
      ],
      content: [
        "일본은행(BOJ)이 금리를 현행 0.25%로 동결하기로 결정했습니다.",
        "이에 따라 엔/달러 환율이 155엔을 돌파하며 엔화 약세가 가속화되고 있습니다.",
      ],
      source: "Nikkei", time: "15시간 전", category: "macro",
      relatedTickers: [{ symbol: "005380", change: "-0.8%" }, { symbol: "000270", change: "-0.5%" }],
    },
    {
      id: "18",
      title: "AMD, MI400 AI 가속기 공개 — 엔비디아 시장점유율 잠식 가속",
      summary: [
        "AMD가 차세대 AI 가속기 MI400을 공개하며 엔비디아에 도전장을 내밀었습니다.",
        "성능 대비 가격이 엔비디아 H200 대비 30% 저렴합니다.",
        "마이크로소프트 Azure에 대규모 도입이 확정되었습니다.",
      ],
      content: [
        "AMD가 데이터센터용 AI 가속기 'MI400'을 공식 공개했습니다.",
        "특히 마이크로소프트 Azure에 대규모 도입이 확정되면서 기대감이 높아지고 있습니다.",
      ],
      source: "Ars Technica", time: "16시간 전", category: "stock",
      relatedTickers: [{ symbol: "AMD", change: "+5.8%" }, { symbol: "NVDA", change: "-1.5%" }],
    },
    {
      id: "19",
      title: "카카오, AI 메이트 서비스 출시 — 개인화 AI 어시스턴트 시장 진출",
      summary: [
        "카카오가 개인화 AI 어시스턴트 'AI 메이트' 서비스를 공식 출시했습니다.",
        "카카오톡 내에서 바로 이용 가능하며, 일정 관리부터 쇼핑까지 지원합니다.",
        "출시 첫 주 100만 사용자를 돌파했습니다.",
      ],
      content: [
        "카카오가 개인화 AI 어시스턴트 서비스 'AI 메이트'를 카카오톡 내에 정식 출시했습니다.",
        "일정 관리, 뉴스 요약, 쇼핑 추천 등 다양한 기능을 채팅 인터페이스에서 바로 이용할 수 있습니다.",
      ],
      source: "지디넷코리아", time: "18시간 전", category: "stock",
      relatedTickers: [{ symbol: "035720", change: "+2.5%" }],
    },
    {
      id: "20",
      title: "비트코인 반감기 이후 채굴 수익성 분석 — 해시레이트 사상 최고",
      summary: [
        "비트코인 네트워크 해시레이트가 반감기 이후 사상 최고치를 경신했습니다.",
        "대형 채굴업체들은 장비 투자를 확대하고 있습니다.",
        "비트코인 가격 상승이 채굴 수익성 하락을 상쇄할 것이라는 전망이 우세합니다.",
      ],
      content: [
        "비트코인 네트워크의 총 해시레이트가 반감기 이후에도 계속 상승하여 사상 최고치를 경신했습니다.",
        "Marathon Digital, Riot Platforms 등 대형 채굴업체들은 오히려 장비 확대 투자 계획을 발표했습니다.",
      ],
      source: "The Block", time: "20시간 전", category: "coin",
      relatedTickers: [{ symbol: "bitcoin", change: "+0.8%" }],
    },
  ];
} */

export function getNews(count: number = 5): NewsItem[] {
  return getAllNews().slice(0, count);
}

/* ────────────── Mock Fallback Data ────────────── */

function getMockStocks(): StockData[] {
  return [
    { symbol: "NVDA", name: "NVIDIA Corp", price: 142.50, change_percent: 3.24, market_cap: "$3.48T", pe_ratio: 72.4, high_52w: 152.89, low_52w: 76.32, market: "NASDAQ", currency: "$" },
    { symbol: "AAPL", name: "Apple Inc", price: 228.30, change_percent: 0.52, market_cap: "$3.52T", pe_ratio: 33.1, high_52w: 237.49, low_52w: 164.08, market: "NASDAQ", currency: "$" },
    { symbol: "MSFT", name: "Microsoft Corp", price: 442.10, change_percent: 0.87, market_cap: "$3.29T", pe_ratio: 38.5, high_52w: 468.35, low_52w: 362.90, market: "NASDAQ", currency: "$" },
    { symbol: "GOOGL", name: "Alphabet Inc", price: 176.80, change_percent: 1.15, market_cap: "$2.18T", pe_ratio: 26.8, high_52w: 191.75, low_52w: 130.67, market: "NASDAQ", currency: "$" },
    { symbol: "AMZN", name: "Amazon.com", price: 214.20, change_percent: 1.34, market_cap: "$2.25T", pe_ratio: 61.8, high_52w: 232.57, low_52w: 151.61, market: "NASDAQ", currency: "$" },
    { symbol: "META", name: "Meta Platforms", price: 598.40, change_percent: 2.18, market_cap: "$1.52T", pe_ratio: 34.2, high_52w: 630.00, low_52w: 390.42, market: "NASDAQ", currency: "$" },
    { symbol: "TSLA", name: "Tesla Inc", price: 267.80, change_percent: -2.15, market_cap: "$856B", pe_ratio: 95.2, high_52w: 358.64, low_52w: 138.80, market: "NASDAQ", currency: "$" },
    { symbol: "BRK-B", name: "Berkshire Hathaway", price: 478.50, change_percent: 0.34, market_cap: "$1.05T", pe_ratio: 12.1, high_52w: 492.00, low_52w: 385.82, market: "NYSE", currency: "$" },
    { symbol: "JPM", name: "JPMorgan Chase", price: 215.60, change_percent: 0.78, market_cap: "$620B", pe_ratio: 12.8, high_52w: 228.50, low_52w: 165.33, market: "NYSE", currency: "$" },
    { symbol: "V", name: "Visa Inc", price: 305.40, change_percent: 0.45, market_cap: "$622B", pe_ratio: 32.5, high_52w: 318.00, low_52w: 252.70, market: "NYSE", currency: "$" },
    { symbol: "UNH", name: "UnitedHealth", price: 542.80, change_percent: -0.62, market_cap: "$498B", pe_ratio: 22.4, high_52w: 630.73, low_52w: 436.38, market: "NYSE", currency: "$" },
    { symbol: "XOM", name: "Exxon Mobil", price: 112.30, change_percent: -0.34, market_cap: "$449B", pe_ratio: 13.6, high_52w: 126.34, low_52w: 95.77, market: "NYSE", currency: "$" },
    { symbol: "AVGO", name: "Broadcom Inc", price: 185.60, change_percent: 2.45, market_cap: "$862B", pe_ratio: 68.3, high_52w: 198.00, low_52w: 112.50, market: "NASDAQ", currency: "$" },
    { symbol: "AMD", name: "AMD Inc", price: 168.40, change_percent: 1.92, market_cap: "$272B", pe_ratio: 48.6, high_52w: 227.30, low_52w: 118.86, market: "NASDAQ", currency: "$" },
    { symbol: "NFLX", name: "Netflix Inc", price: 892.50, change_percent: 0.95, market_cap: "$385B", pe_ratio: 48.2, high_52w: 941.75, low_52w: 542.01, market: "NASDAQ", currency: "$" },
    { symbol: "INTC", name: "Intel Corp", price: 24.60, change_percent: -1.82, market_cap: "$105B", pe_ratio: 0, high_52w: 51.28, low_52w: 18.51, market: "NASDAQ", currency: "$" },
    { symbol: "005930", name: "삼성전자", price: 68400, change_percent: -1.12, market_cap: "408조", pe_ratio: 34.2, high_52w: 88800, low_52w: 53000, market: "KOSPI", currency: "₩" },
    { symbol: "000660", name: "SK하이닉스", price: 198000, change_percent: 2.84, market_cap: "144조", pe_ratio: 18.5, high_52w: 240000, low_52w: 110000, market: "KOSPI", currency: "₩" },
    { symbol: "373220", name: "LG에너지솔루션", price: 368000, change_percent: -0.54, market_cap: "86조", pe_ratio: 82.3, high_52w: 545000, low_52w: 320000, market: "KOSPI", currency: "₩" },
    { symbol: "207940", name: "삼성바이오로직스", price: 928000, change_percent: 1.20, market_cap: "66조", pe_ratio: 78.5, high_52w: 1020000, low_52w: 680000, market: "KOSPI", currency: "₩" },
    { symbol: "005380", name: "현대차", price: 248000, change_percent: -0.80, market_cap: "52조", pe_ratio: 6.8, high_52w: 295000, low_52w: 175000, market: "KOSPI", currency: "₩" },
    { symbol: "035720", name: "카카오", price: 41850, change_percent: -0.47, market_cap: "18.6조", pe_ratio: 45.2, high_52w: 55700, low_52w: 33450, market: "KOSPI", currency: "₩" },
    { symbol: "035420", name: "NAVER", price: 218500, change_percent: 1.38, market_cap: "35.8조", pe_ratio: 28.4, high_52w: 248000, low_52w: 156000, market: "KOSPI", currency: "₩" },
    { symbol: "006400", name: "삼성SDI", price: 385000, change_percent: -1.28, market_cap: "26.5조", pe_ratio: 22.1, high_52w: 520000, low_52w: 312000, market: "KOSPI", currency: "₩" },
    { symbol: "051910", name: "LG화학", price: 328000, change_percent: -0.91, market_cap: "23.2조", pe_ratio: 15.8, high_52w: 485000, low_52w: 295000, market: "KOSPI", currency: "₩" },
    { symbol: "003670", name: "포스코홀딩스", price: 298000, change_percent: 0.67, market_cap: "25.2조", pe_ratio: 11.5, high_52w: 420000, low_52w: 265000, market: "KOSPI", currency: "₩" },
    { symbol: "105560", name: "KB금융", price: 82400, change_percent: 0.49, market_cap: "33.5조", pe_ratio: 7.2, high_52w: 92000, low_52w: 55200, market: "KOSPI", currency: "₩" },
    { symbol: "055550", name: "신한지주", price: 52800, change_percent: 0.38, market_cap: "27.2조", pe_ratio: 6.5, high_52w: 58500, low_52w: 35400, market: "KOSPI", currency: "₩" },
    { symbol: "000270", name: "기아", price: 125000, change_percent: -0.40, market_cap: "50.8조", pe_ratio: 5.8, high_52w: 142000, low_52w: 78000, market: "KOSPI", currency: "₩" },
    { symbol: "068270", name: "셀트리온", price: 198500, change_percent: 1.54, market_cap: "28.2조", pe_ratio: 42.3, high_52w: 231500, low_52w: 131800, market: "KOSPI", currency: "₩" },
    { symbol: "028260", name: "삼성물산", price: 142000, change_percent: 0.28, market_cap: "26.7조", pe_ratio: 18.3, high_52w: 175000, low_52w: 108000, market: "KOSPI", currency: "₩" },
  ];
}

function getMockCoins(): CoinData[] {
  return [
    { id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: 97842, price_change_percentage_24h: 1.87, market_cap: 1920000000000, total_volume: 38000000000, image: "", sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => 95000 + Math.sin(i / 10) * 3000 + i * 15) } },
    { id: "ethereum", symbol: "eth", name: "Ethereum", current_price: 3842, price_change_percentage_24h: 2.34, market_cap: 462000000000, total_volume: 18000000000, image: "", sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => 3600 + Math.sin(i / 8) * 200 + i * 1.2) } },
    { id: "solana", symbol: "sol", name: "Solana", current_price: 198.40, price_change_percentage_24h: -0.92, market_cap: 92000000000, total_volume: 4200000000, image: "", sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => 190 + Math.sin(i / 12) * 15 + Math.random() * 5) } },
    { id: "ripple", symbol: "xrp", name: "XRP", current_price: 2.48, price_change_percentage_24h: 5.21, market_cap: 142000000000, total_volume: 8500000000, image: "", sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => 2.2 + Math.sin(i / 6) * 0.3 + i * 0.002) } },
    { id: "dogecoin", symbol: "doge", name: "Dogecoin", current_price: 0.342, price_change_percentage_24h: 1.23, market_cap: 50000000000, total_volume: 3200000000, image: "", sparkline_in_7d: { price: Array.from({ length: 168 }, (_, i) => 0.32 + Math.sin(i / 10) * 0.02 + Math.random() * 0.01) } },
  ];
}
