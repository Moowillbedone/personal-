import { NextResponse } from "next/server";

/**
 * 뉴스 프록시 API
 * 원문 기사 HTML을 가져와서 X-Frame-Options 헤더 없이 반환
 * → 앱 내 iframe에서 표시 가능
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const articleUrl = searchParams.get("url");

  if (!articleUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    const res = await fetch(articleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.google.com/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return new NextResponse(`Fetch failed: ${res.status}`, { status: res.status });
    }

    let html = await res.text();

    // base 태그 추가 (상대 경로 리소스가 정상 로드되도록)
    const baseUrl = new URL(articleUrl).origin;
    if (!html.includes("<base")) {
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}" />`);
    }

    // 다크 모드 스타일 주입 (앱 테마와 일관성)
    const darkModeCSS = `
      <style>
        body { background: #0f0f14 !important; color: #e5e5e5 !important; }
        a { color: #818cf8 !important; }
        img { max-width: 100% !important; height: auto !important; }
        .ad, [class*="ad-"], [id*="ad-"], [class*="banner"], [class*="popup"],
        [class*="cookie"], [class*="consent"], [class*="subscribe"],
        [class*="paywall"], [class*="modal"], [class*="overlay"] {
          display: none !important;
        }
        nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"],
        [class*="sidebar"], [class*="social"], [class*="share"], [class*="related"],
        [class*="comment"], [class*="newsletter"] {
          display: none !important;
        }
      </style>
    `;
    html = html.replace("</head>", `${darkModeCSS}</head>`);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // X-Frame-Options 없이 반환 → iframe에서 로드 가능
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return new NextResponse(`Proxy error: ${String(err)}`, { status: 500 });
  }
}
