import { NextResponse } from "next/server";

/**
 * 뉴스 본문 스크래핑 + 한글 번역 API
 * 1) 직접 스크래핑 시도 (한국 뉴스 사이트, 일부 영문 사이트)
 * 2) 실패 시 → 빈 배열 반환 (클라이언트에서 요약으로 폴백)
 */

async function translateToKorean(text: string): Promise<string> {
  if (!text || text.length === 0) return text;
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  if (koreanChars / text.length > 0.3) return text; // 이미 한글
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

function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// 본문 추출 - 여러 전략 순차 적용
function extractArticleContent(html: string): string[] {
  const paragraphs: string[] = [];

  // 전략 1: <article> 태그 내부
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const scope = articleMatch ? articleMatch[1] : html;

  // 전략 2: 본문 영역 클래스 탐색
  const bodyPatterns = [
    /class="[^"]*article[_-]?body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*story[_-]?(?:body|content|text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*post[_-]?content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*entry[_-]?content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /itemprop="articleBody"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  let bodyHtml = scope;
  for (const pat of bodyPatterns) {
    const m = html.match(pat);
    if (m && m[1].length > 200) {
      bodyHtml = m[1];
      break;
    }
  }

  // <p> 태그 추출
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(bodyHtml)) !== null) {
    const text = cleanText(pm[1]);
    if (text.length >= 25 && isValidParagraph(text)) {
      paragraphs.push(text);
    }
  }

  // <p> 태그에서 못 찾으면 <div> 블록에서 긴 텍스트 추출
  if (paragraphs.length === 0) {
    const textBlocks = html.match(/>([^<]{80,})</g) || [];
    for (const block of textBlocks) {
      const text = cleanText(block.substring(1));
      if (text.length >= 50 && isValidParagraph(text)) {
        paragraphs.push(text);
      }
    }
  }

  // JSON-LD articleBody 폴백
  if (paragraphs.length === 0) {
    const ldBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    for (const block of ldBlocks) {
      try {
        const jsonStr = block.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
        let data = JSON.parse(jsonStr);
        if (Array.isArray(data)) data = data[0];
        if (data?.articleBody) {
          const body = cleanText(data.articleBody);
          // 문장 단위로 분리
          const sentences = body.split(/(?<=\.\s)|(?<=다\.)|(?<=요\.)|(?<=됐다\.)/);
          let chunk = "";
          for (const s of sentences) {
            chunk += s;
            if (chunk.length >= 80) {
              paragraphs.push(chunk.trim());
              chunk = "";
            }
          }
          if (chunk.trim().length >= 30) paragraphs.push(chunk.trim());
          break;
        }
      } catch { /* continue */ }
    }
  }

  return paragraphs.slice(0, 15);
}

function isValidParagraph(text: string): boolean {
  const noise = [
    /^(Sign up|Subscribe|Already a|Download|Click here)/i,
    /^(©|Copyright|All rights reserved)/i,
    /(cookie|javascript|privacy policy|terms of (use|service))/i,
    /\.(jpg|png|gif|svg|webp)\b/i,
    /^(Share|Tweet|Email|Print|댓글|좋아요|글자크기)/i,
    /^(function\s*\(|var |window\.)/i,
    /^\{.*\}$/,
    /^https?:\/\//,
    /기자\s*=\s*$/,
    /^(더보기|접기|펼쳐보기)$/,
  ];
  return !noise.some(re => re.test(text));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const articleUrl = searchParams.get("url");

  if (!articleUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(articleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      redirect: "follow",
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ paragraphs: [], translated: [] });
    }

    const html = await res.text();

    // Cloudflare 차단 감지
    if (html.length < 10000 && (html.includes("cf-browser-verification") || html.includes("cloudflare") || html.includes("Just a moment"))) {
      return NextResponse.json({ paragraphs: [], translated: [], blocked: true });
    }

    const contentParagraphs = extractArticleContent(html);

    if (contentParagraphs.length === 0) {
      return NextResponse.json({ paragraphs: [], translated: [], count: 0 });
    }

    // 번역
    const translated: string[] = [];
    const SEPARATOR = " ||| ";
    const combined = contentParagraphs.join(SEPARATOR);

    if (combined.length <= 4500) {
      const result = await translateToKorean(combined);
      const parts = result.split(/\s*\|\|\|\s*/);
      if (parts.length === contentParagraphs.length) {
        translated.push(...parts);
      } else {
        for (const p of contentParagraphs) {
          translated.push(await translateToKorean(p));
        }
      }
    } else {
      for (const p of contentParagraphs) {
        translated.push(await translateToKorean(p));
      }
    }

    return NextResponse.json({
      paragraphs: contentParagraphs,
      translated,
      count: contentParagraphs.length,
    });
  } catch (err) {
    return NextResponse.json({ paragraphs: [], translated: [], error: String(err) });
  }
}
