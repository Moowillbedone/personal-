import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinPulse - 투자 도우미",
  description: "주식, 코인, 글로벌 뉴스를 AI가 요약해서 한국어로",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="max-w-[430px] mx-auto min-h-screen relative">
        {children}
      </body>
    </html>
  );
}
