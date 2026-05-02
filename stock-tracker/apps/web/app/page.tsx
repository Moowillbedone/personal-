"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Signal } from "@/lib/types";

const PAGE_SIZE = 100;

function fmtPct(v: number) {
  return `${(v * 100).toFixed(2)}%`;
}
function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_BADGE: Record<Signal["signal_type"], string> = {
  gap_up: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  gap_down: "bg-rose-900/40 text-rose-300 border-rose-700",
  volume_spike: "bg-amber-900/40 text-amber-300 border-amber-700",
};

export default function Page() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .order("ts", { ascending: false })
        .limit(PAGE_SIZE);
      if (!mounted) return;
      if (error) console.error(error);
      setSignals((data as Signal[]) ?? []);
      setLoading(false);
    }
    load();

    // Live updates via Supabase Realtime
    const channel = supabase
      .channel("signals-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        (payload) => {
          setSignals((prev) => [payload.new as Signal, ...prev].slice(0, PAGE_SIZE));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Live Signals</h1>
      {loading ? (
        <p className="text-neutral-500">loading…</p>
      ) : signals.length === 0 ? (
        <p className="text-neutral-500">
          No signals yet. The worker will publish here as it detects gaps and volume spikes.
        </p>
      ) : (
        <div className="overflow-x-auto border border-neutral-800 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-neutral-400 uppercase text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Change</th>
                <th className="px-3 py-2 text-right">Vol×</th>
                <th className="px-3 py-2 text-left">Session</th>
                <th className="px-3 py-2 text-right">E[1d]</th>
                <th className="px-3 py-2 text-right">E[3d]</th>
                <th className="px-3 py-2 text-right">E[5d]</th>
                <th className="px-3 py-2 text-right">n</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-neutral-800 hover:bg-neutral-900/40"
                >
                  <td className="px-3 py-2 text-neutral-400">{fmtTime(s.ts)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/ticker/${s.symbol}`}
                      className="font-semibold text-sky-300 hover:underline"
                    >
                      {s.symbol}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 border rounded text-xs ${TYPE_BADGE[s.signal_type]}`}
                    >
                      {s.signal_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{fmtMoney(s.price)}</td>
                  <td
                    className={`px-3 py-2 text-right ${
                      s.pct_change >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {fmtPct(s.pct_change)}
                  </td>
                  <td className="px-3 py-2 text-right">{s.volume_ratio.toFixed(1)}×</td>
                  <td className="px-3 py-2 text-neutral-400">{s.session}</td>
                  <td className="px-3 py-2 text-right">
                    {s.expected_1d != null ? fmtPct(s.expected_1d) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.expected_3d != null ? fmtPct(s.expected_3d) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.expected_5d != null ? fmtPct(s.expected_5d) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-neutral-500">
                    {s.sample_size ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-neutral-600 mt-4">
        E[1d/3d/5d] = mean realized return after similar historical signals. Not investment advice.
      </p>
    </div>
  );
}
