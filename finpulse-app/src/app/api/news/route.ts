import { NextResponse } from "next/server";

/**
 * 실시간 글로벌 금융 뉴스 API
 * 소스: Reuters (via Google News), Investing.com RSS
 * 모든 뉴스는 한글 제목으로 번역하여 제공
 */

interface NewsItem {
  id: string;
  title: string;
  titleOriginal: string;
  source: string;
  sourceCategory: "reuters" | "investing" | "financialjuice";
  time: string;
  pubDate: string;
  link: string;
  imageUrl: string | null;
  author: string;
}

// 간단한 해시 함수 (안정적 ID 생성)
function stableId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `n${Math.abs(h).toString(36)}`;
}

// 상대 시간 (한국어)
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "";
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

// ──────────────────────────────────────
// RSS 파서 (XML → 아이템 배열)
// ──────────────────────────────────────
interface RssRawItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  imageUrl: string | null;
  author: string;
}

function parseRssItems(xml: string): RssRawItem[] {
  const items: RssRawItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const getTag = (tag: string) => {
      const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, "s");
      const tm = block.match(re);
      return tm ? tm[1].replace(/<[^>]+>/g, "").trim() : "";
    };

    const title = getTag("title")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");

    // Google News 형식: "Title - Source" → 소스 분리
    let cleanTitle = title;
    let sourceFromTitle = "";
    const lastDash = title.lastIndexOf(" - ");
    if (lastDash > 0 && lastDash > title.length - 40) {
      cleanTitle = title.substring(0, lastDash).trim();
      sourceFromTitle = title.substring(lastDash + 3).trim();
    }

    const link = getTag("link");
    const pubDate = getTag("pubDate");
    const source = getTag("source") || sourceFromTitle || getTag("author") || "";
    const author = getTag("author") || source;

    // 이미지 URL
    let imageUrl: string | null = null;
    const enclosure = block.match(/enclosure[^>]*url="([^"]+)"/);
    if (enclosure) imageUrl = enclosure[1];
    const mediaContent = block.match(/media:content[^>]*url="([^"]+)"/);
    if (!imageUrl && mediaContent) imageUrl = mediaContent[1];

    if (cleanTitle) {
      items.push({ title: cleanTitle, link, pubDate, source, imageUrl, author });
    }
  }
  return items;
}

// ──────────────────────────────────────
// 영어 → 한글 간이 번역 (핵심 금융 용어 + 구조 변환)
// ──────────────────────────────────────
function translateTitle(title: string): string {
  // 금융 용어 번역 매핑
  const dict: [RegExp, string][] = [
    [/\bstock(?:s)?\b/gi, "주식"],
    [/\bmarket(?:s)?\b/gi, "시장"],
    [/\bshare(?:s)?\b/gi, "주가"],
    [/\brally\b/gi, "랠리"],
    [/\bsurge(?:s|d)?\b/gi, "급등"],
    [/\bslump(?:s|ed)?\b/gi, "급락"],
    [/\btumble(?:s|d)?\b/gi, "폭락"],
    [/\bsoar(?:s|ed)?\b/gi, "급등"],
    [/\bplunge(?:s|d)?\b/gi, "폭락"],
    [/\bdrop(?:s|ped)?\b/gi, "하락"],
    [/\bfall(?:s)?\b/gi, "하락"],
    [/\brise(?:s)?\b/gi, "상승"],
    [/\bgain(?:s|ed)?\b/gi, "상승"],
    [/\bhit(?:s)?\b/gi, "도달"],
    [/\bnear(?:s)?\b/gi, "근접"],
    [/\brecord high(?:s)?\b/gi, "사상 최고치"],
    [/\ball-time high\b/gi, "사상 최고가"],
    [/\bbull(?:ish)?\b/gi, "강세"],
    [/\bbear(?:ish)?\b/gi, "약세"],
    [/\bearnings\b/gi, "실적"],
    [/\brevenue\b/gi, "매출"],
    [/\bprofit(?:s)?\b/gi, "이익"],
    [/\bloss(?:es)?\b/gi, "손실"],
    [/\bdividend(?:s)?\b/gi, "배당"],
    [/\binflation\b/gi, "인플레이션"],
    [/\binterest rate(?:s)?\b/gi, "금리"],
    [/\brate cut(?:s)?\b/gi, "금리 인하"],
    [/\brate hike(?:s)?\b/gi, "금리 인상"],
    [/\bFed\b/g, "연준"],
    [/\bFederal Reserve\b/gi, "연준"],
    [/\btreasury\b/gi, "국채"],
    [/\bbond(?:s)?\b/gi, "채권"],
    [/\byield(?:s)?\b/gi, "수익률"],
    [/\boil price(?:s)?\b/gi, "유가"],
    [/\bcrude oil\b/gi, "원유"],
    [/\bgold price(?:s)?\b/gi, "금값"],
    [/\bgold\b/gi, "금"],
    [/\bdollar\b/gi, "달러"],
    [/\byen\b/gi, "엔화"],
    [/\beuro\b/gi, "유로"],
    [/\bwon\b/gi, "원화"],
    [/\bcryptocurrency\b/gi, "암호화폐"],
    [/\bcrypto\b/gi, "암호화폐"],
    [/\bBitcoin\b/gi, "비트코인"],
    [/\bEthereum\b/gi, "이더리움"],
    [/\bchip(?:s)?\b/gi, "반도체"],
    [/\bsemiconductor(?:s)?\b/gi, "반도체"],
    [/\bAI\b/g, "AI"],
    [/\bartificial intelligence\b/gi, "인공지능"],
    [/\btariff(?:s)?\b/gi, "관세"],
    [/\btrade war\b/gi, "무역 전쟁"],
    [/\bsanction(?:s)?\b/gi, "제재"],
    [/\bWall Street\b/gi, "월가"],
    [/\bIPO\b/g, "IPO"],
    [/\bmerger(?:s)?\b/gi, "인수합병"],
    [/\bacquisition(?:s)?\b/gi, "인수"],
    [/\bbuyback\b/gi, "자사주 매입"],
    [/\blayoff(?:s)?\b/gi, "감원"],
    [/\bforecast(?:s)?\b/gi, "전망"],
    [/\boutlook\b/gi, "전망"],
    [/\banalyst(?:s)?\b/gi, "애널리스트"],
    [/\bupgrade(?:s|d)?\b/gi, "상향"],
    [/\bdowngrade(?:s|d)?\b/gi, "하향"],
    [/\bGDP\b/g, "GDP"],
    [/\bunemployment\b/gi, "실업률"],
    [/\bjobs report\b/gi, "고용보고서"],
    [/\brecession\b/gi, "경기침체"],
    [/\brecovery\b/gi, "회복"],
    [/\bgrowth\b/gi, "성장"],
    [/\bS&P 500\b/g, "S&P500"],
    [/\bNasdaq\b/gi, "나스닥"],
    [/\bDow Jones\b/gi, "다우존스"],
    [/\bKOSPI\b/gi, "코스피"],
    [/\bKOSDAQ\b/gi, "코스닥"],
    [/\bNikkei\b/gi, "니케이"],
    [/\bexclusive:?\s*/gi, "[단독] "],
    [/\bbreaking:?\s*/gi, "[속보] "],
    [/\bupdate\s*\d*:?\s*/gi, "[업데이트] "],
    [/\banalysis:?\s*/gi, "[분석] "],
  ];

  let translated = title;
  for (const [pattern, replacement] of dict) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
}

// ──────────────────────────────────────
// 1) Reuters (via Google News)
// ──────────────────────────────────────
async function fetchReuters(): Promise<NewsItem[]> {
  try {
    const url = "https://news.google.com/rss/search?q=site%3Areuters.com+markets+OR+stocks+OR+economy&hl=en-US&gl=US&ceid=US:en";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 }, // 1분 캐시
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const raw = parseRssItems(xml);

    return raw.slice(0, 30).map(item => ({
      id: stableId(item.title),
      title: translateTitle(item.title),
      titleOriginal: item.title,
      source: "Reuters",
      sourceCategory: "reuters" as const,
      time: relativeTime(item.pubDate),
      pubDate: item.pubDate,
      link: item.link,
      imageUrl: item.imageUrl,
      author: item.author || "Reuters",
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────
// 2) Investing.com RSS
// ──────────────────────────────────────
async function fetchInvesting(): Promise<NewsItem[]> {
  try {
    // 2개 피드 병렬: 일반 뉴스 + 포렉스/경제
    const [mainRes, fxRes] = await Promise.all([
      fetch("https://www.investing.com/rss/news.rss", {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 60 },
      }),
      fetch("https://www.investing.com/rss/news_14.rss", {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 60 },
      }),
    ]);

    const items: RssRawItem[] = [];
    if (mainRes.ok) items.push(...parseRssItems(await mainRes.text()));
    if (fxRes.ok) items.push(...parseRssItems(await fxRes.text()));

    // 중복 제거 (제목 기준)
    const seen = new Set<string>();
    const unique = items.filter(item => {
      const key = item.title.substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(0, 20).map(item => ({
      id: stableId(item.title),
      title: translateTitle(item.title),
      titleOriginal: item.title,
      source: item.author || "Investing.com",
      sourceCategory: "investing" as const,
      time: relativeTime(item.pubDate),
      pubDate: item.pubDate,
      link: item.link,
      imageUrl: item.imageUrl,
      author: item.author || "Investing.com",
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────
// 3) Financial Juice (via Google News fallback)
// ──────────────────────────────────────
async function fetchFinancialJuice(): Promise<NewsItem[]> {
  try {
    // Financial Juice는 JS 렌더링이라 직접 스크래핑 불가
    // 대안: Google News에서 CNBC/Bloomberg 금융 뉴스 수집
    const url = "https://news.google.com/rss/search?q=stocks+OR+markets+OR+economy+OR+fed+OR+earnings&hl=en-US&gl=US&ceid=US:en";
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const raw = parseRssItems(xml);

    // Reuters가 아닌 소스만 (Reuters는 위에서 별도 수집)
    const nonReuters = raw.filter(item =>
      !item.source.toLowerCase().includes("reuters")
    );

    return nonReuters.slice(0, 20).map(item => ({
      id: stableId(item.title),
      title: translateTitle(item.title),
      titleOriginal: item.title,
      source: item.source || "Financial News",
      sourceCategory: "financialjuice" as const,
      time: relativeTime(item.pubDate),
      pubDate: item.pubDate,
      link: item.link,
      imageUrl: item.imageUrl,
      author: item.author || item.source || "Financial News",
    }));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────
// API Handler
// ──────────────────────────────────────
export async function GET() {
  try {
    const [reuters, investing, fj] = await Promise.all([
      fetchReuters(),
      fetchInvesting(),
      fetchFinancialJuice(),
    ]);

    // 통합 + 시간순 정렬
    const all = [...reuters, ...investing, ...fj];

    // 중복 제거 (제목 앞 30자 기준)
    const seen = new Set<string>();
    const unique = all.filter(item => {
      const key = item.titleOriginal.substring(0, 30).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 최신순 정렬
    unique.sort((a, b) => {
      const ta = new Date(a.pubDate).getTime() || 0;
      const tb = new Date(b.pubDate).getTime() || 0;
      return tb - ta;
    });

    return NextResponse.json({
      news: unique,
      count: unique.length,
      sources: {
        reuters: reuters.length,
        investing: investing.length,
        financialJuice: fj.length,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch news", detail: String(err), news: [] },
      { status: 500 }
    );
  }
}
