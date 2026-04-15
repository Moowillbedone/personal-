import { NextResponse } from "next/server";

/**
 * 뉴스 본문 스크래핑 + 한글 번역 API
 * ?url=https://... 형태로 기사 URL을 전달하면
 * 본문을 추출하고 한글로 번역하여 반환
 */

async function translateToKorean(text: string): Promise<string> {
  if (!text || text.length === 0) return text;
  if (/^[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\s0-9.,!?%$₩()[\]{}:;"'\-+/]+$/.test(text)) return text;
  try {
    const encoded = encodeURIComponent(text.slice(0, 2000));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encoded}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return text;
    const data = await res.json();
    if (!data?.[0]) return text;
    return data[0].map((p: [string]) => p[0]).join("");
  } catch {
    return text;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const articleUrl = searchParams.get("url");

  if (!articleUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  try {
    // 기사 HTML 가져오기
    const res = await fetch(articleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ paragraphs: [], translated: [] });
    }

    const html = await res.text();

    // 본문 <p> 추출
    const paragraphs: string[] = [];
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pm: RegExpExecArray | null;
    while ((pm = pRe.exec(html)) !== null) {
      const text = pm[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();

      if (
        text.length >= 25 &&
        !text.startsWith("Sign up") &&
        !text.startsWith("Subscribe") &&
        !text.startsWith("Already a member") &&
        !text.includes("cookie") &&
        !text.includes("javascript") &&
        !text.startsWith("©") &&
        !text.startsWith("Copyright")
      ) {
        paragraphs.push(text);
      }
    }

    const contentParagraphs = paragraphs.slice(0, 12);

    // 번역: 각 단락을 개별 번역 (배치는 너무 길어질 수 있음)
    const translated: string[] = [];
    for (const p of contentParagraphs) {
      const t = await translateToKorean(p);
      translated.push(t);
    }

    return NextResponse.json({
      paragraphs: contentParagraphs,
      translated,
      count: contentParagraphs.length,
    });
  } catch (err) {
    return NextResponse.json({
      paragraphs: [],
      translated: [],
      error: String(err),
    });
  }
}
