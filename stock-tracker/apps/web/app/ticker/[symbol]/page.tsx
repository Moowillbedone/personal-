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

  // Fetch ticker meta + bars + recent signals.
  useEffect(() => {
    let mounted = true;
    async function load() {
      const [tRes, bRes, sRes] = await Promise.all([
        supabase.from("tickers").select("*").eq("symbol", sym).maybeSingle(),
        supabase
          .from("price_snapshots")
          .select("ts,open,high,low,close,volume")
          .eq("symbol", sym)
          .order("ts", { ascending: true })
          .limit(500),
        supabase
          .from("signals")
          .select("*")
          .eq("symbol", sym)
          .order("ts", { ascending: false })
          .limit(20),
      ]);
      if (!mounted) return;
      setTicker((tRes.data as Ticker) ?? null);
      setBars((bRes.data as PriceBar[]) ?? []);
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
        timeScale: { timeVisible: true, secondsVisible: false },
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
      <Link href="/" className="text-sm text-sky-400 hover:underline">
        ← back to signals
      </Link>
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
