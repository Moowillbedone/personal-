import { NextResponse } from "next/server";

/**
 * 뉴스 본문 스크래핑 + 한글 번역 API
 * Google News 리다이렉트 URL도 처리
 */

async function translateToKorean(text: string): Promise<string> {
  if (!text || text.length === 0) return text;
  // 이미 한글이면 스킵
  const koreanRatio = (text.match(/[\uAC00-\uD7AF]/g) || []).length / text.length;
  if (koreanRatio > 0.3) return text;
  try {
    const encoded = encodeURIComponent(text.slice(0, 2000));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encoded}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return text;
    const data = await res.json();
    if (!data?.[0]) return text;
    return data[0].map((p: [string]) => p[0]).join("");
  } catch { return text; }
}

// HTML에서 깨끗한 본문 단락 추출
function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];

  // <article> 태그 내부 우선 탐색
  let scope = html;
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) scope = articleMatch[1];

  // <p> 태그에서 텍스트 추출
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(scope)) !== null) {
    const text = pm[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

    // 필터: 25자 이상, 광고/쿠키/구독 문구 제외
    if (text.length >= 25 &&
      !/^(Sign up|Subscribe|Already a|Download|Click here|©|Copyright|Read more|Share this)/i.test(text) &&
      !/cookie|javascript|privacy policy|terms of (use|service)/i.test(text) &&
      !/\.(jpg|png|gif|svg|webp)/i.test(text)
    ) {
      paragraphs.push(text);
    }
  }

  return paragraphs.slice(0, 15);
}

// Google News URL에서 실제 기사 URL 추출 시도
function extractRealUrl(googleUrl: string): string | null {
  // Google News RSS 링크: https://news.google.com/rss/articles/...
  // 또는 실제 기사 URL이 직접 들어오는 경우
  if (!googleUrl.includes("news.google.com")) return googleUrl;
  // Google News redirect는 서버에서 따라갈 수 있음
  return googleUrl;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const articleUrl = searchParams.get("url");

  if (!articleUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    const realUrl = extractRealUrl(articleUrl) || articleUrl;

    // 기사 HTML 가져오기 (리다이렉트 따라감)
    const res = await fetch(realUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ paragraphs: [], translated: [], error: `HTTP ${res.status}` });
    }

    const html = await res.text();
    const contentParagraphs = extractParagraphs(html);

    if (contentParagraphs.length === 0) {
      return NextResponse.json({ paragraphs: [], translated: [], count: 0 });
    }

    // 번역: 배치로 (||| 구분자 사용)
    const SEPARATOR = " ||| ";
    const combined = contentParagraphs.join(SEPARATOR);

    let translatedParagraphs: string[];
    if (combined.length <= 4500) {
      const translatedCombined = await translateToKorean(combined);
      const parts = translatedCombined.split(/\s*\|\|\|\s*/);
      if (parts.length === contentParagraphs.length) {
        translatedParagraphs = parts;
      } else {
        // 분리 실패 시 개별 번역
        translatedParagraphs = [];
        for (const p of contentParagraphs) {
          translatedParagraphs.push(await translateToKorean(p));
        }
      }
    } else {
      // 너무 길면 개별 번역
      translatedParagraphs = [];
      for (const p of contentParagraphs) {
        translatedParagraphs.push(await translateToKorean(p));
      }
    }

    return NextResponse.json({
      paragraphs: contentParagraphs,
      translated: translatedParagraphs,
      count: contentParagraphs.length,
    });
  } catch (err) {
    return NextResponse.json({
      paragraphs: [], translated: [], error: String(err),
    });
  }
}
