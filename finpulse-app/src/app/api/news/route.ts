import { NextResponse } from "next/server";

/**
 * 실시간 글로벌 금융 뉴스 API
 * 소스: Reuters (via Google News), Investing.com RSS, 글로벌 금융뉴스
 * Google Translate로 제목 + 본문 완전 한글 번역
 */

interface NewsItem {
  id: string;
  title: string;
  titleOriginal: string;
  summary: string;
  summaryOriginal: string;
  source: string;
  sourceCategory: "reuters" | "investing" | "financialjuice";
  time: string;
  pubDate: string;
  link: string;
  imageUrl: string | null;
  content: string[];  // 본문 단락 배열 (한글)
  contentOriginal: string[]; // 원문 단락 배열
}

// 간단한 해시
function stableId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return `n${Math.abs(h).toString(36)}`;
}

// 상대 시간
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
// Google Translate (무료 API)
// ──────────────────────────────────────
async function translateToKorean(text: string): Promise<string> {
  if (!text || text.length === 0) return text;
  // 이미 한글이면 번역 스킵
  if (/^[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\s0-9.,!?%$₩()[\]{}:;"'\-+/]+$/.test(text)) return text;
  try {
    const encoded = encodeURIComponent(text.slice(0, 1000)); // 1000자 제한
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encoded}`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // 1시간 캐시
    if (!res.ok) return text;
    const data = await res.json();
    if (!data?.[0]) return text;
    return data[0].map((p: [string]) => p[0]).join("");
  } catch {
    return text;
  }
}

// 배치 번역 (여러 텍스트를 하나로 합쳐서 번역 → API 호출 최소화)
async function batchTranslate(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const SEPARATOR = " ||| ";
  const combined = texts.join(SEPARATOR);
  if (combined.length > 4500) {
    // 너무 길면 개별 번역
    return Promise.all(texts.map(t => translateToKorean(t)));
  }
  const translated = await translateToKorean(combined);
  const parts = translated.split(/\s*\|\|\|\s*/);
  // 분리가 안 되면 원본 반환
  if (parts.length !== texts.length) {
    return Promise.all(texts.map(t => translateToKorean(t)));
  }
  return parts;
}

// ──────────────────────────────────────
// RSS 파서
// ──────────────────────────────────────
interface RssRawItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  imageUrl: string | null;
  description: string;
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
      return tm ? tm[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").trim() : "";
    };

    let title = getTag("title");
    let sourceFromTitle = "";
    const lastDash = title.lastIndexOf(" - ");
    if (lastDash > 0 && lastDash > title.length - 40) {
      sourceFromTitle = title.substring(lastDash + 3).trim();
      title = title.substring(0, lastDash).trim();
    }

    const link = getTag("link");
    const pubDate = getTag("pubDate");
    const source = getTag("source") || sourceFromTitle || getTag("author") || "";
    // description에서 HTML 완전 제거
    let description = "";
    const descRe = /<description[^>]*>([\s\S]*?)<\/description>/;
    const descMatch = block.match(descRe);
    if (descMatch) {
      let raw = descMatch[1];
      // CDATA 제거
      raw = raw.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "");
      // 먼저 HTML 엔티티를 디코딩 (이중 인코딩 처리)
      raw = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      // 이제 모든 HTML 태그 제거
      raw = raw.replace(/<[^>]*>/g, " ");
      // 나머지 엔티티 정리
      raw = raw.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ");
      // 공백 정리
      description = raw.replace(/\s+/g, " ").trim();
    }

    let imageUrl: string | null = null;
    const enclosure = block.match(/enclosure[^>]*url="([^"]+)"/);
    if (enclosure) imageUrl = enclosure[1];

    if (title) {
      items.push({ title, link, pubDate, source, imageUrl, description });
    }
  }
  return items;
}

// ──────────────────────────────────────
// 뉴스 소스 fetch
// ──────────────────────────────────────
async function fetchReuters(): Promise<RssRawItem[]> {
  try {
    const url = "https://news.google.com/rss/search?q=site%3Areuters.com+markets+OR+stocks+OR+economy&hl=en-US&gl=US&ceid=US:en";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } });
    if (!res.ok) return [];
    return parseRssItems(await res.text()).slice(0, 15);
  } catch { return []; }
}

async function fetchInvesting(): Promise<RssRawItem[]> {
  try {
    const [mainRes, fxRes] = await Promise.all([
      fetch("https://www.investing.com/rss/news.rss", { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } }),
      fetch("https://www.investing.com/rss/news_14.rss", { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } }),
    ]);
    const items: RssRawItem[] = [];
    if (mainRes.ok) items.push(...parseRssItems(await mainRes.text()));
    if (fxRes.ok) items.push(...parseRssItems(await fxRes.text()));
    const seen = new Set<string>();
    return items.filter(i => { const k = i.title.substring(0, 40); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
  } catch { return []; }
}

async function fetchGlobalNews(): Promise<RssRawItem[]> {
  try {
    const url = "https://news.google.com/rss/search?q=stocks+OR+markets+OR+economy+OR+fed+OR+earnings&hl=en-US&gl=US&ceid=US:en";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } });
    if (!res.ok) return [];
    const all = parseRssItems(await res.text());
    return all.filter(i => !i.source.toLowerCase().includes("reuters")).slice(0, 10);
  } catch { return []; }
}

// ──────────────────────────────────────
// 4) 한국 금융 뉴스 RSS (본문 스크래핑 가능!)
// ──────────────────────────────────────
async function fetchKoreanNews(): Promise<RssRawItem[]> {
  try {
    const feeds = [
      { url: "https://www.mk.co.kr/rss/40300001/", source: "매일경제" },
      { url: "https://www.hankyung.com/feed/all-news", source: "한국경제" },
    ];
    const results = await Promise.all(
      feeds.map(async (feed) => {
        try {
          const res = await fetch(feed.url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            next: { revalidate: 60 },
          });
          if (!res.ok) return [];
          const xml = await res.text();
          const items = parseRssItems(xml);
          return items.map(i => ({ ...i, source: i.source || feed.source }));
        } catch { return []; }
      })
    );
    // 금융 키워드 필터
    const FINANCE_KW = ["주식","증시","코스피","코스닥","반도체","삼성","SK","현대","LG",
      "금리","환율","달러","원화","금값","ETF","IPO","실적","매출","영업이익",
      "투자","펀드","배당","경제","GDP","인플레","채권","나스닥","다우","S&P",
      "AI","반도체","GPU","NVIDIA","테슬라","애플","아마존","메타",
      "비트코인","코인","이더리움","암호화폐","관세","수출","수입"];
    const all = results.flat();
    const filtered = all.filter(item => FINANCE_KW.some(kw => item.title.includes(kw)));
    return filtered.slice(0, 15);
  } catch { return []; }
}

// ──────────────────────────────────────
// API Handler
// ──────────────────────────────────────
export async function GET() {
  try {
    // 1) RSS 수집 (병렬)
    const [reuters, investing, global, korean] = await Promise.all([
      fetchReuters(), fetchInvesting(), fetchGlobalNews(), fetchKoreanNews(),
    ]);

    // 소스 태깅 (한국 뉴스를 "financialjuice" 대신 별도 카테고리로)
    const tagged = [
      ...korean.map(i => ({ ...i, cat: "financialjuice" as const })),  // 한국 뉴스 = 상단
      ...reuters.map(i => ({ ...i, cat: "reuters" as const })),
      ...investing.map(i => ({ ...i, cat: "investing" as const })),
      ...global.map(i => ({ ...i, cat: "financialjuice" as const })),
    ];

    // 중복 제거 + 정렬
    const seen = new Set<string>();
    const unique = tagged.filter(i => {
      const k = i.title.substring(0, 30).toLowerCase();
      if (seen.has(k)) return false; seen.add(k); return true;
    }).sort((a, b) => {
      const ta = new Date(a.pubDate).getTime() || 0;
      const tb = new Date(b.pubDate).getTime() || 0;
      return tb - ta;
    }).slice(0, 30);

    // 2) 제목 배치 번역
    const titles = unique.map(i => i.title);
    const translatedTitles = await batchTranslate(titles);

    // 3) description 배치 번역 (있는 것만)
    const descs = unique.map(i => i.description || i.title);
    const translatedDescs = await batchTranslate(descs);

    // 4) NewsItem 생성
    const news: NewsItem[] = unique.map((item, idx) => ({
      id: stableId(item.title),
      title: translatedTitles[idx] || item.title,
      titleOriginal: item.title,
      summary: translatedDescs[idx] || item.description || "",
      summaryOriginal: item.description || "",
      source: item.source || (item.cat === "reuters" ? "Reuters" : item.cat === "investing" ? "Investing.com" : "Financial News"),
      sourceCategory: item.cat,
      time: relativeTime(item.pubDate),
      pubDate: item.pubDate,
      link: item.link,
      imageUrl: item.imageUrl,
      content: [], // 본문은 상세 API에서 로드
      contentOriginal: [],
    }));

    return NextResponse.json({
      news,
      count: news.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch news", detail: String(err), news: [] },
      { status: 500 }
    );
  }
}
