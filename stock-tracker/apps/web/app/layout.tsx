import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Signal Tracker",
  description: "Real-time gap & volume-spike detector for NASDAQ + NYSE top 100",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono">
        <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ⚡ Stock Signal Tracker
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-400">
              <Link href="/" className="hover:text-neutral-100">Signals</Link>
              <Link href="/trade" className="hover:text-neutral-100">Trade</Link>
            </nav>
          </div>
          <span className="text-xs text-neutral-500">
            data delayed ~15 min · top 100 NASDAQ + 100 NYSE
          </span>
        </header>
        <main className="px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
