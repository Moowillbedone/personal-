"use client";

import { useEffect, useRef, useState, use } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi } from "lightweight-charts";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { PriceBar, Signal, Ticker } from "@/lib/types";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export default function TickerPage({ params }: PageProps) {
  const { symbol } = use(params);
  const sym = symbol.toUpperCase();

  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [bars, setBars] = useState<PriceBar[]>([]);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Fetch ticker meta + chart bars + recent signals.
  // Chart bars now default to 1-year daily (via /api/bars → Alpaca direct)
  // so the user sees real long-term context instead of last-week 5-min noise.
  // price_snapshots (5-min only, ~5 days deep) is no longer used here —
  // signal detection and AI analysis still pull from it on their own.
  useEffect(() => {
    let mounted = true;
    async function load() {
      const [tRes, bRes, sRes] = await Promise.all([
        supabase.from("tickers").select("*").eq("symbol", sym).maybeSingle(),
        fetch(`/api/bars?symbol=${encodeURIComponent(sym)}&interval=1d&days=380`)
          .then((r) => r.json() as Promise<{ bars?: PriceBar[]; error?: string }>)
          .catch(() => ({ bars: [] as PriceBar[] })),
        supabase
          .from("signals")
          .select("*")
          .eq("symbol", sym)
          .order("ts", { ascending: false })
          .limit(20),
      ]);
      if (!mounted) return;
      setTicker((tRes.data as Ticker) ?? null);
      // Daily bars from Alpaca arrive ASC by timestamp — chart wants ASC, no reverse needed.
      const barsAsc = (bRes.bars ?? []) as PriceBar[];
      // Winsorize wicks: clip high/low to ±WICK_PCT from previous close to hide
      // single IEX outlier prints (long off-screen candles) that don't appear
      // on consolidated-SIP charts like TradingView. Threshold ~6% works for
      // daily bars (intraday moves of 5-8% are common around earnings, so we
      // leave more room than the 2% used on the previous 5-min chart).
      const WICK_PCT = 0.06;
      let prevClose = barsAsc[0]?.close ?? 0;
      const cleaned: PriceBar[] = barsAsc.map((b) => {
        const upper = prevClose * (1 + WICK_PCT);
        const lower = prevClose * (1 - WICK_PCT);
        const high = Math.min(b.high, Math.max(upper, b.open, b.close));
        const low = Math.max(b.low, Math.min(lower, b.open, b.close));
        prevClose = b.close;
        return { ...b, high, low };
      });
      setBars(cleaned);
      setRecentSignals((sRes.data as Signal[]) ?? []);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [sym]);

  // Chart init + updates.
  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartApiRef.current) {
      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 420,
        layout: {
          background: { type: ColorType.Solid, color: "#0b0d12" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        // Daily bars only need date labels — hide the HH:MM since
        // intraday time-of-day isn't meaningful on a 1-year daily chart.
        timeScale: { timeVisible: false, secondsVisible: false },
      });
      chartApiRef.current = chart;
      seriesRef.current = chart.addCandlestickSeries({
        upColor: "#10b981",
        downColor: "#f43f5e",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#f43f5e",
      });
      const onResize = () => {
        if (chartRef.current && chartApiRef.current) {
          chartApiRef.current.applyOptions({ width: chartRef.current.clientWidth });
        }
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data = bars.map((b) => ({
      time: (Math.floor(new Date(b.ts).getTime() / 1000) as unknown) as never,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    seriesRef.current.setData(data);
    chartApiRef.current?.timeScale().fitContent();
  }, [bars]);

  const last = bars[bars.length - 1];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/signals" className="text-sm text-sky-400 hover:underline">
          ← back to signals
        </Link>
        {/* One-click jump to the trade page with this symbol pre-selected.
            Lets the user go from "interesting signal" → AI analysis screen
            without re-searching the symbol. */}
        <Link
          href={`/trade?symbol=${encodeURIComponent(sym)}`}
          className="px-3 py-1.5 text-sm border border-sky-700 bg-sky-900/30 text-sky-200 rounded hover:bg-sky-900/60 hover:border-sky-500 transition-colors"
        >
          📊 Trade 페이지에서 분석 →
        </Link>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{sym}</h1>
          <p className="text-neutral-500 text-sm">
            {ticker?.name ?? "—"} · {ticker?.exchange ?? "—"}
            {ticker?.rank_in_exch ? ` · rank #${ticker.rank_in_exch}` : ""}
          </p>
        </div>
        {last && (
          <div className="text-right">
            <div className="text-3xl font-semibold">${last.close.toFixed(2)}</div>
            <div className="text-xs text-neutral-500">
              last bar {new Date(last.ts).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <div ref={chartRef} className="mt-6 border border-neutral-800 rounded-lg" />

      <h2 className="mt-8 mb-2 text-sm uppercase text-neutral-400">Recent signals</h2>
      {recentSignals.length === 0 ? (
        <p className="text-neutral-500 text-sm">no signals recorded for {sym} yet.</p>
      ) : (
        <ul className="text-sm space-y-1">
          {recentSignals.map((s) => (
            <li key={s.id} className="text-neutral-300">
              <span className="text-neutral-500">{new Date(s.ts).toLocaleString()}</span>
              {" · "}
              <span>{s.signal_type}</span>
              {" · "}
              <span className={s.pct_change >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {(s.pct_change * 100).toFixed(2)}%
              </span>
              {" · "}
              <span>vol×{s.volume_ratio.toFixed(1)}</span>
              {" · "}
              <span>${s.price.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
