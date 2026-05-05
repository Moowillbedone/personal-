// Fetches headline news from premium financial outlets via Google News RSS.
// Why Google News RSS: Reuters/Bloomberg/CNBC/WSJ official RSS feeds are
// either retired or paywalled. Google News mirrors public web indexed
// headlines from those sites and exposes a free, unauthenticated RSS endpoint.

export interface HeadlineItem {
  source: string;       // 'Reuters', 'Bloomberg', etc
  headline: string;
  link: string;
  publishedAt: string;  // ISO
}

const GNEWS_BASE = "https://news.google.com/rss/search";

interface OutletDef {
  name: string;
  domain: string;
}

const OUTLETS: OutletDef[] = [
  { name: "Reuters",     domain: "reuters.com" },
  { name: "Bloomberg",   domain: "bloomberg.com" },
  { name: "CNBC",        domain: "cnbc.com" },
  { name: "WSJ",         domain: "wsj.com" },
  { name: "FT",          domain: "ft.com" },
  { name: "MarketWatch", domain: "marketwatch.com" },
];

/** Decode the few HTML entities Google News RSS emits in titles. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, ""); // strip nested tags
}

/** Cheap RSS parser — Google News format is tame and we don't want to add a dep. */
function parseRss(xml: string): { title: string; link: string; pubDate: string }[] {
  const items: { title: string; link: string; pubDate: string }[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1] ?? "";
    const link = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "";
    const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? "";
    if (title) items.push({ title: decodeEntities(title.trim()), link: link.trim(), pubDate: pubDate.trim() });
  }
  return items;
}

async function fetchOutletQuery(outlet: OutletDef, query: string, limit: number): Promise<HeadlineItem[]> {
  const q = `site:${outlet.domain} ${query}`;
  const url = `${GNEWS_BASE}?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 stock-tracker/1.0" },
      cache: "no-store",
      // Google News occasionally serves slowly; cap at 8s
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = parseRss(xml).slice(0, limit);
    return items.map((it) => {
      // Google News titles usually look like "Headline - Outlet". Strip the trailing outlet.
      const headline = it.title.replace(new RegExp(`\\s*-\\s*${outlet.name}.*$`, "i"), "");
      return {
        source: outlet.name,
        headline,
        link: it.link,
        publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

/** Fetch ticker-specific news from premium outlets. */
export async function fetchTickerNews(symbol: string, perOutlet = 3): Promise<HeadlineItem[]> {
  const sym = symbol.toUpperCase();
  const lists = await Promise.all(
    OUTLETS.map((o) => fetchOutletQuery(o, `${sym} stock`, perOutlet)),
  );
  return mergeSort(lists);
}

/** Fetch macro/global news (politics, geopolitics, central banks) — same outlets. */
export async function fetchMacroNews(perOutlet = 3): Promise<HeadlineItem[]> {
  const queries = [
    "Federal Reserve OR \"interest rate\" OR inflation",
    "geopolitics OR \"trade war\" OR tariff OR sanctions",
    "earnings OR \"market outlook\"",
  ];
  const lists: HeadlineItem[][] = [];
  for (const q of queries) {
    const perQuery = await Promise.all(
      OUTLETS.map((o) => fetchOutletQuery(o, q, Math.max(1, Math.floor(perOutlet / queries.length)))),
    );
    lists.push(...perQuery);
  }
  return mergeSort(lists);
}

function mergeSort(lists: HeadlineItem[][]): HeadlineItem[] {
  const merged = lists.flat();
  // Dedupe by headline+source
  const seen = new Set<string>();
  const out: HeadlineItem[] = [];
  for (const it of merged) {
    const key = `${it.source}|${it.headline}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  out.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return out;
}
