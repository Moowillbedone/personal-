"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Signal, SignalType, Ticker } from "@/lib/types";

const PAGE_SIZE = 200;

type Exchange = "NASDAQ" | "NYSE";
type Session = "pre" | "regular" | "after";

const EXCHANGES: Exchange[] = ["NASDAQ", "NYSE"];
const TYPES: SignalType[] = ["gap_up", "gap_down", "volume_spike"];
const SESSIONS: Session[] = ["pre", "regular", "after"];

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

const TYPE_BADGE: Record<SignalType, string> = {
  gap_up: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  gap_down: "bg-rose-900/40 text-rose-300 border-rose-700",
  volume_spike: "bg-amber-900/40 text-amber-300 border-amber-700",
};

function FilterChip<T extends string>({
  label,
  active,
  onToggle,
}: {
  label: T;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`px-2 py-1 text-xs border rounded transition-colors ${
        active
          ? "bg-sky-900/40 text-sky-200 border-sky-700"
          : "bg-neutral-900/40 text-neutral-500 border-neutral-800 hover:border-neutral-600"
      }`}
    >
      {label}
    </button>
  );
}

export default function Page() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [loading, setLoading] = useState(true);

  const [exchanges, setExchanges] = useState<Set<Exchange>>(new Set(EXCHANGES));
  const [types, setTypes] = useState<Set<SignalType>>(new Set(TYPES));
  const [sessions, setSessions] = useState<Set<Session>>(new Set(SESSIONS));
  const [minPct, setMinPct] = useState(0);
  const [minVolX, setMinVolX] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [sigRes, tickRes] = await Promise.all([
        supabase
          .from("signals")
          .select("*")
          .order("ts", { ascending: false })
          .limit(PAGE_SIZE),
        supabase.from("tickers").select("symbol,exchange,name,rank_in_exch"),
      ]);
      if (!mounted) return;
      if (sigRes.error) console.error(sigRes.error);
      if (tickRes.error) console.error(tickRes.error);
      setSignals((sigRes.data as Signal[]) ?? []);
      const map: Record<string, Ticker> = {};
      ((tickRes.data as Ticker[]) ?? []).forEach((t) => (map[t.symbol] = t));
      setTickers(map);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel("signals-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        (payload) => {
          setSignals((prev) => [payload.new as Signal, ...prev].slice(0, PAGE_SIZE));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "signals" },
        (payload) => {
          setSignals((prev) =>
            prev.map((s) => (s.id === (payload.new as Signal).id ? (payload.new as Signal) : s)),
          );
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      const t = tickers[s.symbol];
      if (t && !exchanges.has(t.exchange)) return false;
      if (!types.has(s.signal_type)) return false;
      if (!sessions.has(s.session)) return false;
      if (Math.abs(s.pct_change) * 100 < minPct) return false;
      if (s.volume_ratio < minVolX) return false;
      return true;
    });
  }, [signals, tickers, exchanges, types, sessions, minPct, minVolX]);

  function toggle<T>(set: Set<T>, val: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Live Signals</h1>
        <span className="text-xs text-neutral-500">
          {filtered.length} / {signals.length}
        </span>
      </div>

      <div className="border border-neutral-800 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Exchange:</span>
          {EXCHANGES.map((e) => (
            <FilterChip
              key={e}
              label={e}
              active={exchanges.has(e)}
              onToggle={() => toggle(exchanges, e, setExchanges)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Type:</span>
          {TYPES.map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={types.has(t)}
              onToggle={() => toggle(types, t, setTypes)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">Session:</span>
          {SESSIONS.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={sessions.has(s)}
              onToggle={() => toggle(sessions, s, setSessions)}
            />
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Min |Δ|%:</span>
          <input
            type="number"
            value={minPct}
            min={0}
            step={0.1}
            onChange={(e) => setMinPct(Number(e.target.value))}
            className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-right"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-neutral-500">Min Vol×:</span>
          <input
            type="number"
            value={minVolX}
            min={0}
            step={0.5}
            onChange={(e) => setMinVolX(Number(e.target.value))}
            className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-right"
          />
        </label>
      </div>

      {loading ? (
        <p className="text-neutral-500">loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-neutral-500">
          {signals.length === 0
            ? "No signals yet. The worker will publish here as it detects gaps and volume spikes."
            : "No signals match the current filters."}
        </p>
      ) : (
        <div className="overflow-x-auto border border-neutral-800 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900/60 text-neutral-400 uppercase text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Exch</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Δ%</th>
                <th className="px-3 py-2 text-right">Vol×</th>
                <th className="px-3 py-2 text-left">Session</th>
                <th className="px-3 py-2 text-right">E[1d]</th>
                <th className="px-3 py-2 text-right">E[3d]</th>
                <th className="px-3 py-2 text-right">E[5d]</th>
                <th className="px-3 py-2 text-right">n</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const t = tickers[s.symbol];
                return (
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
                    <td className="px-3 py-2 text-neutral-500">{t?.exchange ?? "—"}</td>
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
                    <td
                      className={`px-3 py-2 text-right ${
                        s.expected_1d != null && s.expected_1d >= 0
                          ? "text-emerald-400"
                          : s.expected_1d != null
                            ? "text-rose-400"
                            : ""
                      }`}
                    >
                      {s.expected_1d != null ? fmtPct(s.expected_1d) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        s.expected_3d != null && s.expected_3d >= 0
                          ? "text-emerald-400"
                          : s.expected_3d != null
                            ? "text-rose-400"
                            : ""
                      }`}
                    >
                      {s.expected_3d != null ? fmtPct(s.expected_3d) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        s.expected_5d != null && s.expected_5d >= 0
                          ? "text-emerald-400"
                          : s.expected_5d != null
                            ? "text-rose-400"
                            : ""
                      }`}
                    >
                      {s.expected_5d != null ? fmtPct(s.expected_5d) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-500">
                      {s.sample_size ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-neutral-600 mt-4">
        E[1d/3d/5d] = mean realized return of similar historical signals (same type, ±50% gap_pct & vol_ratio).
        Not investment advice.
      </p>
    </div>
  );
}
