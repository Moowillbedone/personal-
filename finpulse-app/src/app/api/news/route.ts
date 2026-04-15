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
      description = descMatch[1]
        .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
        .replace(/\s+/g, " ").trim();
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
// API Handler
// ──────────────────────────────────────
export async function GET() {
  try {
    // 1) RSS 수집
    const [reuters, investing, global] = await Promise.all([
      fetchReuters(), fetchInvesting(), fetchGlobalNews(),
    ]);

    // 소스 태깅
    const tagged = [
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
