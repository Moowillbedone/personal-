import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import RegisterSW from "./register-sw";

export const metadata: Metadata = {
  title: "Stock Tracker — 투자 판단 워크스페이스",
  description:
    "미국주식 데이터 확인, 종목 검토, 손실 한도 계산과 매매 복기를 위한 개인 투자 워크스페이스",
  applicationName: "스윙콘솔",
  // Installable-app metadata (iOS Safari standalone + home-screen icon).
  appleWebApp: {
    capable: true,
    title: "스윙콘솔",
    statusBarStyle: "black-translucent",
  },
  // Next 15 emits only the modern `mobile-web-app-capable`; add the legacy
  // apple-prefixed tag too so older iOS Safari also launches standalone.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  // Fill the notch/safe areas so it reads as a native app when launched
  // from the home screen in standalone mode.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <RegisterSW />
        <header className="app-header">
          <div className="app-header-inner">
            <Link href="/" className="app-brand">
              <span className="brand-icon" aria-hidden="true">
                ▥
              </span>{" "}
              Stock Tracker
            </Link>
            <nav className="app-nav" aria-label="주 메뉴">
              <Link href="/">판단 데스크</Link>
              <Link href="/research">종목 탐색</Link>
              <Link href="/trade">상세 분석</Link>
              <Link href="/stats">매매 복기</Link>
              <Link href="/methodology">데이터 기준</Link>
            </nav>
            <span className="app-context">
              US EQUITIES <span>·</span> RESEARCH
            </span>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
