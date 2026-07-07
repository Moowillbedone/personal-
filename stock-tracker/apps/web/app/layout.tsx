import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Tracker — 스윙 콘솔",
  description:
    "2x leveraged-ETF swing console: market regime, sector money flow, tranche prescriptions, NDX-100 signals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-mono">
        <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ⚡ Stock Tracker
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-400">
              <Link href="/" className="hover:text-neutral-100">대시보드</Link>
              <Link href="/trade" className="hover:text-neutral-100">Trade</Link>
              <Link href="/signals" className="hover:text-neutral-100">Signals</Link>
              {/* Stats 탭 숨김 (2026-07): 강세섹터는 대시보드로 이관, 일괄기록은
                  Trade 탭으로 이관. /stats 라우트·집계는 그대로 살아있어 URL로 접근
                  가능하고 데이터도 계속 기록됨(읽기 전용이라 중복 집계 없음). */}
            </nav>
          </div>
          <span className="text-xs text-neutral-500">
            2x ETF 스윙 · NDX-100 시그널 · data ~15min delayed
          </span>
        </header>
        <main className="px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
