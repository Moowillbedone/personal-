"use client";

// 스윙 콘솔 대시보드 (2026-07 pivot) — the new home page.
//
// Layout, top to bottom:
//   1. RegimeBanner    — market traffic light (QQQ trend + VIX) + mode advice.
//   2. Sma200Panel     — NASDAQ-100 + NYSE-100 names touching their 200-day line.
//   3. SectorStrength  — where the money is rotating (all sectors expanded),
//                        the primary "what to trade" panel.
// (Raw signals live on the /signals tab, open positions on the /trade tab —
//  intentionally not on the dashboard.)

import { useCallback, useEffect, useState } from "react";
import SectorStrengthPanel from "@/app/stats/SectorStrengthPanel";
import Sma200Panel from "@/app/stats/Sma200Panel";
import { regimeAdvice, type Regime } from "@/lib/prescription";

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

export default function DashboardPage() {
  const [regime, setRegime] = useState<RegimeResp | null>(null);
  const [regimeLoading, setRegimeLoading] = useState(true);

  const load = useCallback(async () => {
    setRegimeLoading(true);
    try {
      const res = await fetch("/api/regime");
      setRegime((await res.json()) as RegimeResp);
    } catch {
      setRegime(null);
    } finally {
      setRegimeLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      <SectorStrengthPanel />
    </div>
  );
}
