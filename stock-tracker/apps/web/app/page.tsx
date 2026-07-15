"use client";

// 스윙 콘솔 대시보드 (2026-07 pivot) — the new home page.
//
// Layout, top to bottom:
//   1. RegimeBanner    — market traffic light (QQQ trend + VIX) + mode advice.
//   2. PositionsRx     — open positions with mechanical prescriptions
//                        (분할익절 / 물타기 / 손절 / decay), regime-gated.
//   3. SectorStrength  — where the money is rotating (all sectors expanded),
//                        the primary "what to trade" panel.
// (Raw signals live on the /signals tab — intentionally not on the dashboard.)

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SectorStrengthPanel from "@/app/stats/SectorStrengthPanel";
import Sma200Panel from "@/app/stats/Sma200Panel";
import {
  prescribe,
  regimeAdvice,
  DEFAULT_RX,
  type Regime,
  type Prescription,
} from "@/lib/prescription";

// ─── shared formatters ──────────────────────────────────────────────────────
function fmtPct(v: number | null | undefined, dp = 1): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(dp)}%`;
}
function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function pctClass(v: number | null | undefined): string {
  if (v == null) return "text-neutral-500";
  return v >= 0 ? "text-emerald-400" : "text-rose-400";
}

// ─── /api/regime response ───────────────────────────────────────────────────
interface RegimeResp {
  regime: Regime;
  benchmark: string;
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  pctFromSma20: number | null;
  pctFromSma50: number | null;
  pctFromSma200: number | null;
  ret5d: number | null;
  ret20d: number | null;
  realizedVol20d: number | null;
  vix: number | null;
  reasons: string[];
  error?: string;
}

// ─── /api/trades/positions response (subset we use) ────────────────────────
interface PositionTrade {
  id: string;
  ts: string;
  action: "buy" | "sell";
  qty: number;
  price: number;
}
interface Position {
  symbol: string;
  mode: "paper" | "real";
  openQty: number;
  avgBuyPrice: number | null;
  costBasisOpen: number | null;
  realizedPnl: number;
  trades: PositionTrade[];
  currentPrice?: number | null;
  unrealizedPnl?: number | null;
  unrealizedPct?: number | null;
  priceStale?: boolean;
}
interface PositionsResp {
  positions?: Position[];
  error?: string;
}

interface AvgOverride {
  avg: number;
  updatedAt: string; // ISO — when the override was set (for cycle gating)
}

const SEV_STYLE: Record<Prescription["severity"], string> = {
  good: "border-emerald-700 bg-emerald-900/30 text-emerald-300",
  info: "border-neutral-700 bg-neutral-900/40 text-neutral-300",
  warn: "border-amber-700 bg-amber-900/30 text-amber-300",
  danger: "border-rose-700 bg-rose-900/30 text-rose-300",
};

const REGIME_CARD: Record<Regime, string> = {
  risk_on: "border-emerald-700/60 bg-emerald-950/40",
  neutral: "border-amber-700/60 bg-amber-950/30",
  risk_off: "border-rose-700/60 bg-rose-950/40",
};

function RegimeBanner({ data, loading }: { data: RegimeResp | null; loading: boolean }) {
  if (loading) {
    return (
      <section className="border border-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
        시장 레짐 계산 중…
      </section>
    );
  }
  if (!data || data.error) {
    return (
      <section className="border border-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
        레짐 조회 실패{data?.error ? ` — ${data.error}` : ""}. 새로고침 해주세요.
      </section>
    );
  }
  const adv = regimeAdvice(data.regime);
  return (
    <section className={`border rounded-lg p-4 ${REGIME_CARD[data.regime]}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">
            {adv.emoji} 시장 레짐: {adv.label}
          </div>
          <p className="text-sm text-neutral-300 mt-1 max-w-3xl">{adv.advice}</p>
          <p className="text-xs text-neutral-500 mt-1">
            근거: {data.reasons.join(" · ")}
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-5 gap-y-2 text-xs">
          <Metric label={`${data.benchmark}`} value={fmtMoney(data.price)} />
          <Metric label="vs 20일선" value={fmtPct(data.pctFromSma20)} cls={pctClass(data.pctFromSma20)} />
          <Metric label="vs 50일선" value={fmtPct(data.pctFromSma50)} cls={pctClass(data.pctFromSma50)} />
          <Metric label="vs 200일선" value={fmtPct(data.pctFromSma200)} cls={pctClass(data.pctFromSma200)} />
          <Metric label="5일 수익률" value={fmtPct(data.ret5d)} cls={pctClass(data.ret5d)} />
          <Metric
            label="VIX"
            value={data.vix != null ? data.vix.toFixed(1) : "—"}
            cls={
              data.vix == null
                ? "text-neutral-500"
                : data.vix >= 28
                  ? "text-rose-400"
                  : data.vix >= 20
                    ? "text-amber-400"
                    : "text-emerald-400"
            }
          />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-neutral-500">{label}</div>
      <div className={`font-semibold ${cls ?? "text-neutral-200"}`}>{value}</div>
    </div>
  );
}

// CURRENT open cycle state: walk fills oldest→newest, resetting whenever
// openQty crosses to ~0 (a closed round trip). Returns BOTH the tranche
// count AND the cycle's own weighted-average cost. The cycle avg cost is
// essential: lib/trades.ts avgBuyPrice is a LIFETIME average that never
// resets after a closed cycle, so judging ±10/20/30% prescription lines
// against it inverts prescriptions after any re-entry at a different price
// (e.g. old cycle @$100 closed, re-entered @$50, now $60 → lifetime basis
// says -20% "물타기" when the open position is actually +20% "익절").
//
// Tie-break on identical timestamps (bulk backfill stamps all same-day
// fills at local noon): process SELLS before BUYS. That only changes the
// outcome for a same-day close-then-re-enter, where reset-first is correct;
// a same-day open-then-full-close ends flat and is filtered out anyway.
function openCycleBuys(trades: PositionTrade[]): {
  count: number;
  firstTs: string | null;
  avgCost: number | null;
  ids: string[]; // exact fill ids belonging to the CURRENT open cycle
} {
  const asc = [...trades].sort((a, b) =>
    a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.action === b.action ? 0 : a.action === "sell" ? -1 : 1,
  );
  let qty = 0;
  let cost = 0;
  let count = 0;
  let firstTs: string | null = null;
  // ids of the fills in the currently-open cycle. Tracked by exact id (not a
  // ts>=firstTs string compare) because bulk-backfilled fills share a
  // day-granular timestamp, so a same-day close+re-enter would otherwise let
  // a prior closed cycle's sell match the filter — deleting it and corrupting
  // that cycle's realized P&L.
  let ids: string[] = [];
  for (const t of asc) {
    if (t.action === "buy") {
      if (qty <= 1e-9) {
        qty = 0;
        cost = 0;
        count = 0;
        firstTs = t.ts;
        ids = [];
      }
      qty += t.qty;
      cost += t.qty * t.price;
      count += 1;
      ids.push(t.id);
    } else {
      const avg = qty > 1e-9 ? cost / qty : 0;
      qty -= t.qty;
      cost -= t.qty * avg;
      ids.push(t.id); // part of the current cycle until proven closed…
      if (qty <= 1e-9) {
        qty = 0;
        cost = 0;
        count = 0;
        firstTs = null;
        ids = []; // …cycle closed → these fills are no longer "open"
      }
    }
  }
  return {
    count,
    firstTs,
    avgCost: qty > 1e-9 && cost > 0 ? cost / qty : null,
    ids,
  };
}

function PositionsRx({
  positions,
  regime,
  loading,
  error,
  onChanged,
  overrides,
}: {
  positions: Position[];
  regime: Regime | null; // null = 레짐 조회 실패 → 물타기 게이트 fail-closed
  loading: boolean;
  error: string | null;
  onChanged: () => void;
  overrides: Record<string, AvgOverride>; // symbol → manual avg-cost override
}) {
  const open = positions.filter((p) => p.openQty > 1e-9 && p.mode === "real");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);

  // Persist a manual average-cost override (migration 011). The derived
  // avg is wrong when the journal is incomplete; this pins the correct one
  // and the prescription recomputes from it. onChanged() reloads positions
  // + overrides so the card reflects the new basis immediately.
  async function saveOverride(symbol: string) {
    const avg = Number(editVal);
    if (!Number.isFinite(avg) || avg <= 0) {
      window.alert("평단가는 0보다 큰 숫자여야 합니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/positions/override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, avg_cost: avg }),
      });
      if (!res.ok) {
        window.alert("평단 저장에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      setEditing(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride(symbol: string) {
    setSaving(true);
    try {
      await fetch(`/api/positions/override?symbol=${encodeURIComponent(symbol)}`, {
        method: "DELETE",
      }).catch(() => {});
      setEditing(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  // "삭제": the user already exited this IRL but never journaled the close,
  // so the card lingers on a stale open position. Delete EXACTLY the current
  // open cycle's fills (tracked by id in openCycleBuys — buys and any
  // in-cycle partial sells). Prior fully-closed cycles are never touched, so
  // their realized P&L survives. If the open cycle also had partial-profit
  // sells, those in-progress records go with it — the confirm text says so.
  async function deletePosition(p: Position) {
    const ids = openCycleBuys(p.trades ?? []).ids;
    if (ids.length === 0) return; // card shouldn't render without an open cycle; no-op if so
    if (
      !window.confirm(
        `${p.symbol}의 현재 열린 사이클 기록 ${ids.length}건(매수 및 이 사이클 내 부분매도 포함)을 삭제합니다.\n` +
          `이미 청산한 종목을 목록에서 지울 때 사용하세요.\n` +
          `• 과거에 완전히 청산된 사이클의 손익 기록은 그대로 보존됩니다.\n` +
          `• 이 사이클 내에서 부분 익절한 실현손익이 있다면 함께 삭제됩니다.`,
      )
    )
      return;
    setDeleting(p.symbol);
    try {
      // fetch never rejects on 4xx/5xx, so check res.ok per request. A partial
      // failure would leave a corrupted derived position; warn the user.
      const oks = await Promise.all(
        ids.map((id) =>
          fetch(`/api/trades?id=${encodeURIComponent(id)}`, { method: "DELETE" })
            .then((res) => res.ok)
            .catch(() => false),
        ),
      );
      // Clear any manual override too, so it doesn't silently reapply if the
      // symbol is re-entered later (best-effort, non-blocking).
      fetch(`/api/positions/override?symbol=${encodeURIComponent(p.symbol)}`, {
        method: "DELETE",
      }).catch(() => {});
      onChanged(); // reload either way so the UI reflects the true state
      const failed = oks.filter((ok) => !ok).length;
      if (failed > 0) {
        window.alert(
          `${p.symbol}: ${ids.length}건 중 ${failed}건 삭제 실패. 일부만 삭제돼 값이 어긋날 수 있으니 다시 시도하세요. (id 기반 삭제라 재시도는 안전)`,
        );
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold">💊 내 포지션 · 처방</h2>
        <span className="text-xs text-neutral-500">
          룰: +{DEFAULT_RX.tp1 * 100}% 1차 익절 · +{DEFAULT_RX.tp2 * 100}% 2차 ·{" "}
          {DEFAULT_RX.avgDown * 100}% 물타기(레짐 게이트) · {DEFAULT_RX.hardStop * 100}% 손절 검토
        </span>
      </div>
      {loading ? (
        <p className="text-sm text-neutral-500 border border-neutral-800 rounded-lg p-4">
          포지션 로딩 중…
        </p>
      ) : error ? (
        <p className="text-sm text-rose-400 border border-neutral-800 rounded-lg p-4">{error}</p>
      ) : open.length === 0 ? (
        <p className="text-sm text-neutral-500 border border-neutral-800 rounded-lg p-4">
          열려있는 실전 포지션이 없습니다.{" "}
          <Link href="/trade" className="text-sky-400 hover:underline">
            Trade 탭
          </Link>
          에서 매수를 기록하면 여기에 처방이 표시됩니다.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((p) => {
            const cyc = openCycleBuys(p.trades ?? []);
            // Prescription basis, in priority order:
            //   1. manual override (user-pinned correct avg cost)
            //   2. open-cycle weighted avg
            //   3. lifetime avg (fallback)
            const derivedAvg = cyc.avgCost ?? p.avgBuyPrice ?? null;
            const ov = overrides[p.symbol];
            // Honor the override ONLY if it was set during the CURRENT open
            // cycle. A pin from a prior (since-closed) cycle must not reapply
            // to a fresh re-entry — that would show a bogus P&L/prescription.
            const hasOverride =
              ov != null &&
              ov.avg > 0 &&
              (cyc.firstTs == null || ov.updatedAt >= cyc.firstTs);
            const avgCost = hasOverride ? ov.avg : derivedAvg;
            const cyclePct =
              p.currentPrice != null && avgCost != null && avgCost > 0
                ? p.currentPrice / avgCost - 1
                : (p.unrealizedPct ?? null);
            const rx = prescribe({
              unrealizedPct: cyclePct,
              buyFillCount: Math.max(1, cyc.count),
              openQty: p.openQty,
              firstBuyTs: cyc.firstTs,
              regime,
            });
            return (
              <div key={p.symbol} className="border border-neutral-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/trade?symbol=${p.symbol}`}
                      className="font-semibold text-sky-300 hover:underline"
                    >
                      {p.symbol}
                    </Link>
                    <span className={`px-2 py-0.5 border rounded text-xs ${SEV_STYLE[rx.severity]}`}>
                      {rx.badge}
                    </span>
                    {hasOverride && (
                      <span className="text-[10px] px-1.5 py-0.5 border border-sky-800 rounded text-sky-300" title="평단이 수동 수정된 상태">
                        평단 수정됨
                      </span>
                    )}
                    {p.priceStale && (
                      <span className="text-[10px] text-amber-500">⚠ 시세 지연</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-semibold ${pctClass(cyclePct)}`}>
                      {fmtPct(cyclePct)}
                    </span>
                    <button
                      onClick={() => deletePosition(p)}
                      disabled={deleting === p.symbol}
                      title="이미 청산한 종목이면 목록에서 삭제 (현재 열린 사이클 기록 삭제)"
                      className="text-xs px-2 py-0.5 border border-neutral-700 rounded text-neutral-400 hover:border-rose-600 hover:text-rose-300 disabled:opacity-40"
                    >
                      {deleting === p.symbol ? "삭제 중…" : "🗑 삭제"}
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-neutral-500 flex items-center flex-wrap gap-x-1.5 gap-y-1">
                  <span>{p.openQty.toLocaleString()}주 · 평단 {fmtMoney(avgCost)}</span>
                  {hasOverride ? (
                    <span className="text-neutral-600">(수정, 자동 {fmtMoney(derivedAvg)})</span>
                  ) : cyc.avgCost == null && p.avgBuyPrice != null ? (
                    <span className="text-neutral-600">(누적)</span>
                  ) : null}
                  {editing === p.symbol ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveOverride(p.symbol);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        placeholder="평단"
                        className="w-20 bg-neutral-900 border border-sky-700 rounded px-1.5 py-0.5 text-right text-neutral-200"
                      />
                      <button
                        onClick={() => saveOverride(p.symbol)}
                        disabled={saving}
                        className="px-1.5 py-0.5 border border-sky-700 rounded text-sky-300 hover:bg-sky-900/40 disabled:opacity-40"
                      >
                        저장
                      </button>
                      <button onClick={() => setEditing(null)} className="px-1.5 py-0.5 text-neutral-500 hover:text-neutral-300">
                        취소
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditVal(avgCost != null ? String(Number(avgCost.toFixed(4))) : "");
                        setEditing(p.symbol);
                      }}
                      className="text-sky-400 hover:underline"
                      title="현재 평단가를 수정하면 처방이 새 평단 기준으로 갱신됩니다"
                    >
                      ✏️ 평단 수정
                    </button>
                  )}
                  {hasOverride && editing !== p.symbol && (
                    <button
                      onClick={() => clearOverride(p.symbol)}
                      disabled={saving}
                      className="text-neutral-500 hover:text-neutral-300 disabled:opacity-40"
                      title="수정 취소 — 기록 기반 자동 평단으로 되돌림"
                    >
                      되돌리기
                    </button>
                  )}
                  <span>· 현재 {fmtMoney(p.currentPrice)} · 트랜치 {Math.max(1, cyc.count)}/{DEFAULT_RX.maxTranches}</span>
                </div>
                <div className="mt-2 text-sm text-neutral-200">{rx.action}</div>
                <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{rx.detail}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [regime, setRegime] = useState<RegimeResp | null>(null);
  const [regimeLoading, setRegimeLoading] = useState(true);
  const [positions, setPositions] = useState<Position[]>([]);
  const [posLoading, setPosLoading] = useState(true);
  const [posError, setPosError] = useState<string | null>(null);
  // symbol → { avg cost, when it was set }. updatedAt lets the card ignore an
  // override left over from a PRIOR closed cycle (see AvgOverride usage).
  const [overrides, setOverrides] = useState<Record<string, AvgOverride>>({});

  const load = useCallback(async () => {
    setRegimeLoading(true);
    setPosLoading(true);
    setPosError(null);
    const [regRes, posRes, ovrRes] = await Promise.allSettled([
      fetch("/api/regime").then((r) => r.json() as Promise<RegimeResp>),
      fetch("/api/trades/positions?mode=real&lookback=3650").then(
        (r) => r.json() as Promise<PositionsResp>,
      ),
      fetch("/api/positions/override").then(
        (r) =>
          r.json() as Promise<{
            overrides?: { symbol: string; avg_cost: number; updated_at: string }[];
          }>,
      ),
    ]);
    if (regRes.status === "fulfilled") setRegime(regRes.value);
    setRegimeLoading(false);
    if (posRes.status === "fulfilled") {
      if (posRes.value.error) setPosError(posRes.value.error);
      setPositions(posRes.value.positions ?? []);
    } else {
      setPosError("포지션 조회 실패");
    }
    setPosLoading(false);
    if (ovrRes.status === "fulfilled" && ovrRes.value.overrides) {
      const map: Record<string, AvgOverride> = {};
      for (const o of ovrRes.value.overrides) {
        map[o.symbol] = { avg: Number(o.avg_cost), updatedAt: o.updated_at };
      }
      setOverrides(map);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Fail CLOSED: when the regime lookup failed, pass null so the
  // prescription engine blocks 물타기 instead of assuming "neutral".
  const effectiveRegime: Regime | null = regime?.regime ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">스윙 콘솔</h1>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 border border-neutral-700 rounded bg-neutral-900 hover:bg-neutral-800"
        >
          ↻ 새로고침
        </button>
      </div>

      <RegimeBanner data={regime} loading={regimeLoading} />
      <Sma200Panel />
      <PositionsRx
        positions={positions}
        regime={effectiveRegime}
        loading={posLoading}
        error={posError}
        onChanged={load}
        overrides={overrides}
      />
      <SectorStrengthPanel />

      <p className="text-xs text-neutral-600">
        처방은 기계적 규칙(기본값) 기반 참고 정보이며 투자 판단의 책임은 본인에게 있습니다. 물타기
        처방은 시장 레짐이 risk-off이거나 <b>레짐 조회에 실패했을 때</b> 자동 차단됩니다(fail-closed).
        손익률·평단은 현재 열린 사이클 기준입니다.
      </p>
    </div>
  );
}
