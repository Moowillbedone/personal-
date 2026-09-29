import { NextRequest, NextResponse } from "next/server";
import { checkOwnerAuthorization, isCrossOriginWrite } from "@/lib/ownerAccess";

/** Single-owner private tools. Public market research stays accessible.
 * Also apply migration 020: API authentication cannot protect direct DB reads. */
export async function middleware(request: NextRequest) {
  const password = process.env.STOCK_TRACKER_OWNER_PASSWORD ?? "";
  const username = process.env.STOCK_TRACKER_OWNER_USER ?? "owner";
  const localDevelopment =
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
  if (!password && localDevelopment) return NextResponse.next();
  const headers = { "Cache-Control": "private, no-store" };
  if (password.length < 20)
    return new NextResponse(
      "개인 기록 보호를 위해 접근이 잠겨 있습니다. 서버에 STOCK_TRACKER_OWNER_PASSWORD(20자 이상)를 설정해 주세요. 공개 판단 데스크는 / 에서 이용할 수 있습니다.",
      { status: 503, headers },
    );
  if (
    !(await checkOwnerAuthorization(
      request.headers.get("authorization"),
      username,
      password,
    ))
  ) {
    return new NextResponse("소유자 로그인이 필요합니다.", {
      status: 401,
      headers: {
        ...headers,
        "WWW-Authenticate":
          'Basic realm="Stock Tracker Owner", charset="UTF-8"',
      },
    });
  }
  if (
    isCrossOriginWrite(
      request.method,
      request.headers.get("origin"),
      request.headers.get("sec-fetch-site"),
      request.nextUrl.origin,
    )
  ) {
    return new NextResponse(
      "다른 사이트에서의 기록 변경 요청은 허용하지 않습니다.",
      { status: 403, headers },
    );
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/trade/:path*",
    "/stats/:path*",
    "/techview/:path*",
    "/api/trades/:path*",
    "/api/positions/:path*",
    "/api/watchlist/:path*",
    "/api/rec-performance/:path*",
    "/api/analyze/:path*",
    "/api/ai-stats/:path*",
    "/api/pullback/:path*",
    "/api/techview/:path*",
  ],
};
