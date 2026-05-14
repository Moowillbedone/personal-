"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Signal, SignalType, Ticker } from "@/lib/types";

const PAGE_SIZE = 500;

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
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmtTime(iso: string) {
  // YYYY/MM/DD HH:mm in user's local timezone (24-hour)
  const d = new Date(iso);
  return (
    `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
function fmtTimeShort(iso: string) {
  // HH:mm only — used inside a date-grouped row where the date is in the header
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** YYYY-MM-DD in user's local timezone, used as a stable group key. */
function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Friendly date label: "오늘", "어제", or "M/D (요일)". */
const KOREAN_DOW = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDateLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const today = new Date();
  const todayKey = dateKey(today.toISOString());
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  const yesterdayKey = dateKey(yesterday.toISOString());
  if (key === todayKey) return `오늘 (${m}/${d} ${KOREAN_DOW[dt.getDay()]})`;
  if (key === yesterdayKey) return `어제 (${m}/${d} ${KOREAN_DOW[dt.getDay()]})`;
  return `${y}-${pad(m)}-${pad(d)} (${KOREAN_DOW[dt.getDay()]})`;
}

const TYPE_BADGE: Record<SignalType, string> = {
  gap_up: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  gap_down: "bg-rose-900/40 text-rose-300 border-rose-700",
  volume_spike: "bg-amber-900/40 text-amber-300 border-amber-700",
};

/**
 * Sortable column header. The label + indicator are inside a button so the
 * entire header cell is clickable. Indicator: ⇅ inactive, ↓ desc, ↑ asc.
 */
function SortHeader({
  label,
  active,
  indicator,
  onClick,
}: {
  label: string;
  active: boolean;
  indicator: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-neutral-200 transition-colors ${
        active ? "text-sky-300" : "text-neutral-400"
      }`}
      title={active ? "다시 누르면 방향 전환 / 한 번 더 누르면 정렬 해제" : "정렬"}
    >
      <span>{label}</span>
      <span className="text-[10px] opacity-80">{indicator}</span>
    </button>
  );
}

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

/**
 * Merge new rows into existing list, deduped by id, preserving DESC order by ts.
 * Used for both initial load and "Load more" appends + realtime prepends.
 */
function mergeSignals(prev: Signal[], incoming: Signal[]): Signal[] {
  const map = new Map<string, Signal>();
  for (const s of prev) map.set(s.id, s);
  for (const s of incoming) map.set(s.id, s);
  return Array.from(map.values()).sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}

export default function Page() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

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
      const initial = (sigRes.data as Signal[]) ?? [];
      setSignals(initial);
      setHasMore(initial.length === PAGE_SIZE);
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
          // Prepend; dedupe in case the row was also fetched via load.
          setSignals((prev) => mergeSignals(prev, [payload.new as Signal]));
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

  async function loadMore() {
    if (loadingMore || !hasMore || signals.length === 0) return;
    setLoadingMore(true);
    try {
      // Cursor pagination: rows older than the oldest currently shown.
      const cursor = signals[signals.length - 1].ts;
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .lt("ts", cursor)
        .order("ts", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) {
        console.error(error);
        return;
      }
      const more = (data as Signal[]) ?? [];
      setSignals((prev) => mergeSignals(prev, more));
      if (more.length < PAGE_SIZE) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

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

  /**
   * Group filtered signals by local-date YYYY-MM-DD with per-group counts.
   * Date order: most recent first (matches the underlying ts-desc ordering
   * so realtime inserts naturally land in the top group).
   */
  const groups = useMemo(() => {
    const buckets = new Map<string, Signal[]>();
    for (const s of filtered) {
      const key = dateKey(s.ts);
      const arr = buckets.get(key);
      if (arr) arr.push(s);
      else buckets.set(key, [s]);
    }
    const out = Array.from(buckets.entries()).map(([date, sigs]) => {
      const buy = sigs.filter((s) => s.signal_type === "gap_up").length;
      const sell = sigs.filter((s) => s.signal_type === "gap_down").length;
      const spike = sigs.filter((s) => s.signal_type === "volume_spike").length;
      return { date, signals: sigs, count: sigs.length, buy, sell, spike };
    });
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return out;
  }, [filtered]);

  /**
   * Which date groups are expanded. Default: only the most recent date is open
   * (so initial render shows the day's signals at a glance, history collapsed).
   * Realtime inserts on a new day will create a new group; user expands manually.
   */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (autoExpandedRef.current) return;
    if (groups.length === 0) return;
    setExpanded(new Set([groups[0].date]));
    autoExpandedRef.current = true;
  }, [groups]);

  // Optional sort by numeric columns. Three-state cycle per column:
  //   inactive → desc (highest first) → asc (lowest first) → inactive
  // NULL values always sink to the bottom so they don't dominate either end.
  // When no column is selected, signals stay in natural ts-desc order.
  type SortKey =
    | "volume_ratio"
    | "expected_1d"
    | "expected_3d"
    | "expected_5d";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  function cycleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortKey(null);
    }
  }
  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "⇅";
    return sortDir === "desc" ? "↓" : "↑";
  }
  function sortSignals(rows: Signal[]): Signal[] {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      // NULL → bottom regardless of dir.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }

  function toggleGroup(date: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }
  function expandAll() {
    setExpanded(new Set(groups.map((g) => g.date)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

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
        <>
          {/* Group expand/collapse controls — only when multiple groups exist */}
          {groups.length > 1 && (
            <div className="flex items-center justify-end gap-2 mb-2 text-[11px] text-neutral-500">
              <button
                onClick={expandAll}
                className="hover:text-neutral-200"
              >
                전체 펼치기
              </button>
              <span className="text-neutral-700">·</span>
              <button
                onClick={collapseAll}
                className="hover:text-neutral-200"
              >
                전체 접기
              </button>
            </div>
          )}

          <div className="space-y-2">
            {groups.map((g) => {
              const isOpen = expanded.has(g.date);
              return (
                <section
                  key={g.date}
                  className="border border-neutral-800 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleGroup(g.date)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-900/40 hover:bg-neutral-900/70 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-500 text-xs">
                        {isOpen ? "▼" : "▶"}
                      </span>
                      <span className="text-sm font-semibold text-neutral-100">
                        {fmtDateLabel(g.date)}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {g.count}건
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {g.buy > 0 && (
                        <span className="text-emerald-400">▲ {g.buy}</span>
                      )}
                      {g.sell > 0 && (
                        <span className="text-rose-400">▼ {g.sell}</span>
                      )}
                      {g.spike > 0 && (
                        <span className="text-amber-400">⚡ {g.spike}</span>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="overflow-x-auto border-t border-neutral-800">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-900/30 text-neutral-400 uppercase text-xs">
                          <tr>
                            <th className="px-3 py-2 text-left">Time</th>
                            <th className="px-3 py-2 text-left">Symbol</th>
                            <th className="px-3 py-2 text-left">Exch</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-right">Price</th>
                            <th className="px-3 py-2 text-right">Δ%</th>
                            <th className="px-3 py-2 text-right">
                              <SortHeader
                                label="Vol×"
                                active={sortKey === "volume_ratio"}
                                indicator={sortIndicator("volume_ratio")}
                                onClick={() => cycleSort("volume_ratio")}
                              />
                            </th>
                            <th className="px-3 py-2 text-left">Session</th>
                            <th className="px-3 py-2 text-right">
                              <SortHeader
                                label="E[1d]"
                                active={sortKey === "expected_1d"}
                                indicator={sortIndicator("expected_1d")}
                                onClick={() => cycleSort("expected_1d")}
                              />
                            </th>
                            <th className="px-3 py-2 text-right">
                              <SortHeader
                                label="E[3d]"
                                active={sortKey === "expected_3d"}
                                indicator={sortIndicator("expected_3d")}
                                onClick={() => cycleSort("expected_3d")}
                              />
                            </th>
                            <th className="px-3 py-2 text-right">
                              <SortHeader
                                label="E[5d]"
                                active={sortKey === "expected_5d"}
                                indicator={sortIndicator("expected_5d")}
                                onClick={() => cycleSort("expected_5d")}
                              />
                            </th>
                            <th className="px-3 py-2 text-right">n</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortSignals(g.signals).map((s) => {
                            const t = tickers[s.symbol];
                            return (
                              <tr
                                key={s.id}
                                className="border-t border-neutral-800 hover:bg-neutral-900/40"
                              >
                                <td className="px-3 py-2 text-neutral-400">
                                  {fmtTimeShort(s.ts)}
                                </td>
                                <td className="px-3 py-2">
                                  <Link
                                    href={`/ticker/${s.symbol}`}
                                    className="font-semibold text-sky-300 hover:underline"
                                  >
                                    {s.symbol}
                                  </Link>
                                </td>
                                <td className="px-3 py-2 text-neutral-500">
                                  {t?.exchange ?? "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={`px-2 py-0.5 border rounded text-xs ${TYPE_BADGE[s.signal_type]}`}
                                  >
                                    {s.signal_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {fmtMoney(s.price)}
                                </td>
                                <td
                                  className={`px-3 py-2 text-right ${
                                    s.pct_change >= 0
                                      ? "text-emerald-400"
                                      : "text-rose-400"
                                  }`}
                                >
                                  {fmtPct(s.pct_change)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {s.volume_ratio.toFixed(1)}×
                                </td>
                                <td className="px-3 py-2 text-neutral-400">
                                  {s.session}
                                </td>
                                <td
                                  className={`px-3 py-2 text-right ${
                                    s.expected_1d != null && s.expected_1d >= 0
                                      ? "text-emerald-400"
                                      : s.expected_1d != null
                                        ? "text-rose-400"
                                        : ""
                                  }`}
                                >
                                  {s.expected_1d != null
                                    ? fmtPct(s.expected_1d)
                                    : "—"}
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
                                  {s.expected_3d != null
                                    ? fmtPct(s.expected_3d)
                                    : "—"}
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
                                  {s.expected_5d != null
                                    ? fmtPct(s.expected_5d)
                                    : "—"}
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
                </section>
              );
            })}
          </div>
        </>
      )}

      {!loading && signals.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-xs">
          {hasMore ? (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-3 py-1.5 border border-neutral-700 rounded bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50"
            >
              {loadingMore ? "loading…" : `Load older signals (+${PAGE_SIZE})`}
            </button>
          ) : (
            <span className="text-neutral-600">end of history ({signals.length} total)</span>
          )}
        </div>
      )}

      <p className="text-xs text-neutral-600 mt-4">
        E[1d/3d/5d] = mean realized return of similar historical signals (same type, ±50% gap_pct & vol_ratio).
        Not investment advice.
      </p>
    </div>
  );
}
