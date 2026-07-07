"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi } from "lightweight-charts";
import SectorStrengthPanel from "./SectorStrengthPanel";

interface Stats {
  count: number;
  winRate1d: number | null;
  mean1d: number | null;
  median1d: number | null;
  mean3d: number | null;
  mean5d: number | null;
  sharpe1d: number | null;
}

interface StatsResponse {
  lookbackDays: number;
  asOf: string;
  totalSignalsInWindow: number;
  measuredSignals: number;
  newsEnrichedSignals: number;
  overall: Stats;
  byType: Record<string, Stats>;
  byTypeAndSession: Record<string, Record<string, Stats>>;
  byTypeAndNews: Record<string, { withNews: Stats; noNews: Stats }>;
}

interface PositionTrade {
  id: string;
  ts: string;
  action: "buy" | "sell";
  qty: number;
  price: number;
  note: string | null;
}

interface Position {
  symbol: string;
  mode: "paper" | "real";
  openQty: number;
  avgBuyPrice: number | null;
  costBasisOpen: number;
  realizedPnl: number;
  totalBuyQty: number;
  totalSellQty: number;
  tradeCount: number;
  trades: PositionTrade[];
  currentPrice?: number | null;
  marketValue?: number | null;
  unrealizedPnl?: number | null;
  unrealizedPct?: number | null;
  priceAsOf?: string | null;
  priceStale?: boolean;
}

interface PnlSummary {
  mode: "paper" | "real" | "all";
  windowDays: number | null;
  tradeCount: number;
  realizedPnl: number;
  closedPositionCount: number;
  winRate: number | null;
  openPositionCount?: number;
  pricedPositionCount?: number;
  totalCostBasisOpen?: number;
  totalMarketValue?: number | null;
  totalUnrealizedPnl?: number | null;
  totalPnl?: number | null;
}

interface RealizedPoint {
  ts: string;
  cumulative: number;
}

interface PositionsResponse {
  asOf: string;
  positions: Position[];
  summary: PnlSummary;
  realizedTimeline?: RealizedPoint[];
}

interface AiVerdictStats {
  count: number;
  mean1d: number | null;
  mean3d: number | null;
  mean5d: number | null;
  mean30d: number | null;
  winRate1d: number | null;
  sharpe1d: number | null;
}

interface CalibrationBin {
  confidenceMin: number;
  confidenceMax: number;
  count: number;
  meanReturn1d: number | null;
  winRate1d: number | null;
}

interface AiStatsResponse {
  lookbackDays: number;
  asOf: string;
  totalAnalysesInWindow: number;
  measuredAnalyses: number;
  byVerdict: { buy: AiVerdictStats; sell: AiVerdictStats; hold: AiVerdictStats };
  confidenceCalibrationBuy: CalibrationBin[];
}

interface RecTrade {
  tradeId: string;
  ts: string;
  symbol: string;
  action: "buy" | "sell";
  qty: number;
  price: number;
  mode: "paper" | "real";
  notes: string | null;
  underlying: string | null;
  verdict: "buy" | "sell" | "hold";
  confidence: number;
  verdictAt: string;
  aligned: boolean | null;
  aligned1d: number | null;
  aligned3d: number | null;
  aligned5d: number | null;
  entryLagHours: number | null;
  verdictPrice: number | null;
  slippagePct: number | null;
}

interface RecPerfResponse {
  lookbackDays: number;
  asOf: string;
  trades: RecTrade[];
  summary: {
    recTradeCount: number;
    realCount: number;
    distinctRecs: number;
    alignmentRate: number | null;
    measuredCount: number;
    hitRate1d: number | null;
    meanAligned1d: number | null;
    meanAligned3d: number | null;
    meanAligned5d: number | null;
    avgEntryLagHours: number | null;
    avgSlippagePct: number | null;
    slippageMeasuredCount: number;
    derivativeTradeCount: number;
  };
}

const TYPE_LABEL: Record<string, string> = {
  gap_up: "갭상승",
  gap_down: "갭하락",
  volume_spike: "거래량 급증",
};

const SESSION_LABEL: Record<string, string> = {
  pre: "프리장",
  regular: "정규장",
  after: "애프터장",
};

const LOOKBACK_OPTIONS = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
  { days: 365, label: "1년" },
];

function fmtPct(v: number | null, dp = 2): string {
  if (v == null) return "—";
  const s = (v * 100).toFixed(dp);
  return `${v >= 0 ? "+" : ""}${s}%`;
}

function fmtNum(v: number | null, dp = 2): string {
  if (v == null) return "—";
  return v.toFixed(dp);
}

/** Plain dollar amount (no sign), for values like market value / cost basis. */
function fmtMoney(v: number | null | undefined, dp = 2): string {
  if (v == null) return "—";
  return `$${v.toFixed(dp)}`;
}

/** Signed dollar P&L, e.g. +$12.34 / −$5.00. */
function fmtPnl(v: number | null | undefined, dp = 2): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : "−"}$${Math.abs(v).toFixed(dp)}`;
}

/** Tailwind class for a P&L value (green/red/neutral). */
function pnlClass(v: number | null | undefined): string {
  if (v == null) return "text-neutral-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-neutral-300";
}

function pctClass(v: number | null): string {
  if (v == null) return "text-neutral-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-neutral-300";
}

function winRateClass(v: number | null): string {
  if (v == null) return "text-neutral-500";
  if (v >= 0.6) return "text-emerald-400 font-semibold";
  if (v >= 0.5) return "text-emerald-500";
  if (v >= 0.45) return "text-amber-400";
  return "text-rose-400";
}

// ─── 개선 포인트 (actionable insights) ──────────────────────────────────────
// Synthesize the rec/trade/AI numbers into a few plain-Korean takeaways the
// user can act on. Rules are deliberately conservative: every claim cites its
// own sample size, and we skip anything with too little data rather than
// asserting a misleading trend. (The user's standing directive: never overstate.)

type InsightTone = "good" | "warn" | "bad" | "info";

interface Insight {
  tone: InsightTone;
  title: string;
  detail: string;
}

function meanOf(a: number[]): number | null {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}

function buildInsights(
  rec: RecPerfResponse | null,
  trades: PositionsResponse | null,
  ai: AiStatsResponse | null,
): Insight[] {
  const out: Insight[] = [];
  const r = rec?.summary;
  const s = trades?.summary;

  // 1) Big unrealized losers — the most actionable risk flag.
  if (trades) {
    const losers = trades.positions
      .filter((p) => p.openQty > 0 && p.unrealizedPct != null && p.unrealizedPct <= -0.2)
      .sort((a, b) => (a.unrealizedPct ?? 0) - (b.unrealizedPct ?? 0));
    if (losers.length > 0) {
      const list = losers
        .slice(0, 3)
        .map((p) => `${p.symbol} ${(p.unrealizedPct! * 100).toFixed(0)}%`)
        .join(", ");
      out.push({
        tone: "bad",
        title: "큰 미실현 손실 — 손절 기준 점검",
        detail: `보유 종목 중 ${list} 손실 중. 손절 규칙이 없다면 추가 하락 위험이 큽니다. 물타기 전에 종목 논리부터 다시 확인하세요.`,
      });
    }
  }

  // 2) Following AI vs going against it — which actually paid (1d)?
  if (rec) {
    const measured = rec.trades.filter((t) => t.aligned1d != null && t.aligned !== null);
    const aligned = measured.filter((t) => t.aligned === true).map((t) => t.aligned1d!);
    const contra = measured.filter((t) => t.aligned === false).map((t) => t.aligned1d!);
    const ma = meanOf(aligned);
    const mc = meanOf(contra);
    if (ma != null && mc != null && aligned.length >= 3 && contra.length >= 3) {
      if (mc > ma) {
        out.push({
          tone: "warn",
          title: "AI 역행이 추종보다 단기 우위",
          detail: `1d 기준 추종 ${fmtPct(ma)}(n=${aligned.length}) vs 역행 ${fmtPct(mc)}(n=${contra.length}). 추천을 무조건 따르기보다 본인 판단을 섞어도 될 신호 — 다만 표본이 작아 단정은 금물.`,
        });
      } else {
        out.push({
          tone: "good",
          title: "AI 추종이 역행보다 유리",
          detail: `1d 기준 추종 ${fmtPct(ma)}(n=${aligned.length}) vs 역행 ${fmtPct(mc)}(n=${contra.length}). 추천 방향을 따르는 전략이 통하고 있습니다.`,
        });
      }
    }
  }

  // 3) Short-term hit-rate caveat — guard against the misleading single number.
  if (r?.hitRate1d != null && s) {
    const totalPnl = s.totalPnl ?? s.realizedPnl;
    if (r.hitRate1d < 0.45 && totalPnl != null && totalPnl > 0) {
      out.push({
        tone: "info",
        title: "단기 적중률 ≠ 실제 손익",
        detail: `1d 적중률은 ${(r.hitRate1d * 100).toFixed(0)}%로 낮지만 실제 총손익은 ${fmtPnl(totalPnl)} 흑자입니다. 1d는 추천 시점 기준 단기 지표일 뿐, 길게 보유하는 본인 스타일과 다르니 이 숫자에 과민 반응하지 마세요.`,
      });
    }
  }

  // 4) Entry lag — proxy for chasing a move that already happened.
  if (r?.avgEntryLagHours != null && r.avgEntryLagHours > 3) {
    out.push({
      tone: "warn",
      title: "진입 지연 — 추격 매매 주의",
      detail: `추천 후 평균 ${r.avgEntryLagHours.toFixed(1)}시간 뒤 진입. 시간이 길수록 추천 시점의 엣지가 희석됩니다. 빠르게 들어가거나, 이미 크게 움직인 종목은 거르세요.`,
    });
  }

  // 4b) Leverage/derivative concentration — amplifies the losses above and
  //     makes price slippage unmeasurable. The standout structural finding.
  if (r && r.recTradeCount > 0 && r.derivativeTradeCount / r.recTradeCount >= 0.5) {
    const frac = r.derivativeTradeCount / r.recTradeCount;
    out.push({
      tone: "warn",
      title: "레버리지·파생 ETF 집중",
      detail: `추천 매매 ${r.recTradeCount}건 중 ${r.derivativeTradeCount}건(${(frac * 100).toFixed(0)}%)이 레버리지/파생 ETF. underlying 분석을 ETF로 실행하니 손익이 그대로 증폭됩니다 — 위 손실 종목의 낙폭이 큰 것도 같은 이유. 변동성·소멸(decay) 리스크를 감안해 비중을 관리하세요.`,
    });
  }

  // 5) Confidence calibration — is high-confidence BUY actually better?
  if (ai && ai.confidenceCalibrationBuy.length >= 2) {
    const bins = ai.confidenceCalibrationBuy.filter(
      (b) => b.count >= 3 && b.winRate1d != null,
    );
    if (bins.length >= 2) {
      const hi = bins[bins.length - 1];
      const lo = bins[0];
      if (hi.winRate1d! < lo.winRate1d!) {
        out.push({
          tone: "warn",
          title: "AI 신뢰도 과신 신호",
          detail: `고신뢰 BUY(${(hi.confidenceMin * 100).toFixed(0)}%+) 승률 ${(hi.winRate1d! * 100).toFixed(0)}%가 저신뢰(${(lo.confidenceMin * 100).toFixed(0)}%~) ${(lo.winRate1d! * 100).toFixed(0)}%보다 낮습니다. 신뢰도가 높다고 더 크게 베팅하지 마세요.`,
        });
      }
    }
  }

  // 6) Closed-trade win rate — reinforce or warn.
  if (s?.winRate != null && s.closedPositionCount >= 4) {
    if (s.winRate >= 0.6) {
      out.push({
        tone: "good",
        title: "청산 승률 양호",
        detail: `청산 ${s.closedPositionCount}건 중 ${(s.winRate * 100).toFixed(0)}%를 수익으로 마감. 익절/손절 규칙이 작동하고 있습니다.`,
      });
    } else if (s.winRate < 0.4) {
      out.push({
        tone: "warn",
        title: "청산 승률 낮음",
        detail: `청산 ${s.closedPositionCount}건 중 ${(s.winRate * 100).toFixed(0)}%만 수익. 손절이 늦거나 익절이 이른지 점검하세요.`,
      });
    }
  }

  // Prioritize bad → warn → info → good, and cap so the panel stays scannable.
  const order: Record<InsightTone, number> = { bad: 0, warn: 1, info: 2, good: 3 };
  out.sort((a, b) => order[a.tone] - order[b.tone]);
  return out.slice(0, 5);
}

type TabKey = "dash" | "ai" | "signals";

export default function StatsPage() {
  const [lookback, setLookback] = useState(30);
  const [tab, setTab] = useState<TabKey>("dash");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<PositionsResponse | null>(null);
  const [ai, setAi] = useState<AiStatsResponse | null>(null);
  const [rec, setRec] = useState<RecPerfResponse | null>(null);

  // Hoisted so the bulk-entry tool can re-run it via onDone after a backfill,
  // refreshing every panel (positions, realized curve, rec-performance) at once.
  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/signal-stats?lookback=${lookback}`).then((r) => r.json()),
      fetch(`/api/trades/positions?lookback=${lookback}`).then((r) => r.json()),
      fetch(`/api/ai-stats?lookback=${lookback}`).then((r) => r.json()),
      fetch(`/api/rec-performance?lookback=${lookback}`).then((r) => r.json()),
    ])
      .then(
        ([sigD, tradeD, aiD, recD]: [
          StatsResponse | { error: string },
          PositionsResponse | { error: string },
          AiStatsResponse | { error: string },
          RecPerfResponse | { error: string },
        ]) => {
          if ("error" in sigD) setError(sigD.error);
          else setData(sigD);
          if (!("error" in tradeD)) setTrades(tradeD);
          if (!("error" in aiD)) setAi(aiD);
          if (!("error" in recD)) setRec(recD);
        },
      )
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [lookback]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">📊 트레이딩 대시보드</h1>
        <p className="text-xs text-neutral-500 mt-1">
          텔레그램 AI 추천을 따른 <span className="text-neutral-300">실전 성과</span>, 보유 포지션 실시간 평가손익,
          AI 정확도, 시그널 통계를 한 곳에서.
        </p>
      </header>

      {/* lookback selector */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-neutral-500">기간:</span>
        {LOOKBACK_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setLookback(opt.days)}
            className={`px-3 py-1 border rounded ${
              lookback === opt.days
                ? "border-sky-500 text-sky-300 bg-sky-950/30"
                : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-neutral-600">
            {new Date(data.asOf).toLocaleString("ko-KR")} 기준
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-neutral-500">로딩 중…</p>}
      {error && (
        <div className="border border-rose-800 bg-rose-950/40 text-rose-200 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Hero KPI band — at-a-glance health, always visible across tabs */}
          <HeroBand trades={trades} rec={rec} />

          {/* 누적 실현 손익 — pulled above the tab bar so it's the first chart
              seen, sitting directly atop the 내 성과/AI 정확도/시그널 통계 tabs. */}
          <RealizedPnlSection points={trades?.realizedTimeline} />

          {/* Tab nav */}
          <div className="flex items-center gap-1 border-b border-neutral-800 text-sm">
            {(
              [
                ["dash", "📊 내 성과"],
                ["ai", "🤖 AI 정확도"],
                ["signals", "📡 시그널 통계"],
              ] as Array<[TabKey, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-3 py-2 -mb-px border-b-2 transition-colors ${
                  tab === key
                    ? "border-sky-500 text-sky-200"
                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab: 내 성과 (추천→매매→손익) ─────────────────────── */}
          {tab === "dash" && (
            <div className="space-y-6">
              <SectorStrengthPanel />

              <InsightsPanel rec={rec} trades={trades} ai={ai} />

              {rec && (
                <section className="border border-sky-900/60 bg-sky-950/10 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <h2 className="text-sm font-semibold text-sky-200">
                      🎯 AI 추천 실전 성과 ({lookback}일)
                    </h2>
                    <span className="text-[11px] text-neutral-500">
                      추천 따라 매매 {rec.summary.recTradeCount.toLocaleString()}건
                      (실전 {rec.summary.realCount.toLocaleString()}건)
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mb-3">
                    텔레그램 추천을 받고 <span className="text-neutral-300">실제로 매매한 것</span>의 단기 결과.
                    수익률은 추천 시점 기준 1d/3d/5d이며 <span className="text-neutral-300">내 매매 방향으로 부호 조정</span>
                    (매수=오르면 +, 매도=내리면 +). 장기 보유의 실제 손익은 아래 「내 매매 성과」 참고.
                  </p>
                  <RecPerformancePanel data={rec} />
                </section>
              )}

              {/* 일괄기록(BulkTradeEntry)은 2026-07에 Trade 탭으로 이관됨 —
                  기록 경로를 한 곳으로 모아 중복 입력을 방지. */}

              {trades && (
                <section className="border border-neutral-800 rounded-lg p-4">
                  <h2 className="text-xs uppercase text-neutral-400 mb-3">📝 내 매매 성과 ({lookback}일)</h2>
                  <TradePnlPanel data={trades} onChanged={loadAll} />
                </section>
              )}
            </div>
          )}

          {/* ── Tab: AI 정확도 ─────────────────────── */}
          {tab === "ai" && (
            <div className="space-y-6">
              {ai && (
                <section className="border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h2 className="text-xs uppercase text-neutral-400">
                      🤖 AI verdict 정확도 ({lookback}일)
                    </h2>
                    <span className="text-[11px] text-neutral-500">
                      측정됨 {ai.measuredAnalyses.toLocaleString()} /
                      전체 {ai.totalAnalysesInWindow.toLocaleString()}건
                    </span>
                  </div>
                  <AiAccuracyPanel data={ai} />
                </section>
              )}
            </div>
          )}

          {/* ── Tab: 시그널 통계 (raw, 참고용 고급) ─────────────────────── */}
          {tab === "signals" && (
            <div className="space-y-6">
              <p className="text-xs text-neutral-500">
                측정됨 {data.measuredSignals.toLocaleString()} / 전체 {data.totalSignalsInWindow.toLocaleString()}건.
                raw 시그널은 직접 매매 대상이 아니라 AI 추천의 재료입니다 (참고용).
              </p>

              <section className="border border-neutral-800 rounded-lg p-4">
                <h2 className="text-xs uppercase text-neutral-400 mb-3">전체 시그널 (지난 {lookback}일, 측정된 것만)</h2>
                <OverallCard stats={data.overall} />
              </section>

              <section className="border border-neutral-800 rounded-lg p-4">
                <h2 className="text-xs uppercase text-neutral-400 mb-3">시그널 타입별</h2>
                {Object.keys(data.byType).length === 0 ? (
                  <p className="text-sm text-neutral-500">측정된 시그널 없음. 7일 이상 지난 시그널이 쌓이면 표시됩니다.</p>
                ) : (
                  <StatsTable rows={data.byType} labelMap={TYPE_LABEL} firstColLabel="타입" />
                )}
              </section>

              <section className="border border-neutral-800 rounded-lg p-4">
                <h2 className="text-xs uppercase text-neutral-400 mb-3">타입 × 세션 (어느 시간대가 강한지)</h2>
                {Object.entries(data.byTypeAndSession).map(([type, sessions]) => (
                  <div key={type} className="mb-4 last:mb-0">
                    <h3 className="text-sm font-semibold text-sky-300 mb-1">
                      {TYPE_LABEL[type] ?? type}
                    </h3>
                    <StatsTable rows={sessions} labelMap={SESSION_LABEL} firstColLabel="세션" />
                  </div>
                ))}
              </section>

              <section className="border border-neutral-800 rounded-lg p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h2 className="text-xs uppercase text-neutral-400">
                    📰 뉴스 동반 vs 뉴스 없음 (시그널 신뢰도 비교)
                  </h2>
                  <span className="text-[11px] text-neutral-500">
                    뉴스 측정됨: {data.newsEnrichedSignals.toLocaleString()} /{" "}
                    {data.measuredSignals.toLocaleString()}건
                  </span>
                </div>
                {data.newsEnrichedSignals === 0 ? (
                  <p className="text-sm text-neutral-500">
                    뉴스 enrichment이 적용된 시그널이 아직 없습니다. poll worker가 6번 가량
                    새 시그널을 기록하면 데이터가 쌓입니다 (5분 cadence).
                  </p>
                ) : (
                  Object.entries(data.byTypeAndNews).map(([type, split]) => (
                    <div key={type} className="mb-4 last:mb-0">
                      <h3 className="text-sm font-semibold text-sky-300 mb-1">
                        {TYPE_LABEL[type] ?? type}
                      </h3>
                      <StatsTable
                        rows={{ withNews: split.withNews, noNews: split.noNews }}
                        labelMap={{ withNews: "📰 뉴스 동반", noNews: "📭 뉴스 없음" }}
                        firstColLabel="구분"
                      />
                    </div>
                  ))
                )}
                <p className="mt-2 text-xs text-neutral-600">
                  뉴스 동반 승률이 뉴스 없음 대비 +10%p 이상 차이 나면 NOTIFY_REQUIRE_NEWS=1 로
                  필터 활성화 권장 (워커 환경변수).
                </p>
              </section>

              <p className="text-xs text-neutral-600">
                <strong>승률</strong>: realized_1d &gt; 0 비율. <strong>Sharpe</strong>: mean / stddev (annualized X, 시그널간 상대 비교용).
                샘플 수가 적으면(n &lt; 20) 통계적 유의성 낮음.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OverallCard({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <Tile label="시그널 수" value={stats.count.toLocaleString()} />
      <Tile
        label="승률 (1일)"
        value={stats.winRate1d != null ? `${(stats.winRate1d * 100).toFixed(1)}%` : "—"}
        className={winRateClass(stats.winRate1d)}
      />
      <Tile
        label="평균 1일 수익률"
        value={fmtPct(stats.mean1d)}
        className={pctClass(stats.mean1d)}
      />
      <Tile label="Sharpe (1일)" value={fmtNum(stats.sharpe1d)} />
      <Tile label="중앙값 1일" value={fmtPct(stats.median1d)} className={pctClass(stats.median1d)} />
      <Tile label="평균 3일" value={fmtPct(stats.mean3d)} className={pctClass(stats.mean3d)} />
      <Tile label="평균 5일" value={fmtPct(stats.mean5d)} className={pctClass(stats.mean5d)} />
    </div>
  );
}

function Tile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="border border-neutral-800 rounded p-2.5">
      <div className="text-[10px] uppercase text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${className ?? "text-neutral-100"}`}>{value}</div>
    </div>
  );
}

function TradePnlPanel({
  data,
  onChanged,
}: {
  data: PositionsResponse;
  onChanged?: () => void;
}) {
  const { positions, summary } = data;
  const paperPos = positions.filter((p) => p.mode === "paper");
  const realPos = positions.filter((p) => p.mode === "real");

  if (positions.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        아직 거래 기록이 없습니다. /trade 페이지에서 종목 선택 후 매수/매도를 기록하세요.
      </p>
    );
  }

  const totalPnl = summary.totalPnl ?? summary.realizedPnl;
  const hasLive = summary.totalUnrealizedPnl != null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <KpiTile
          label="총 손익"
          value={fmtPnl(totalPnl)}
          sub={hasLive ? "실현 + 미실현" : "실현만 (시세 없음)"}
          valueClass={pnlClass(totalPnl)}
        />
        <KpiTile
          label="미실현 손익"
          value={fmtPnl(summary.totalUnrealizedPnl)}
          sub={
            summary.openPositionCount
              ? `보유 ${summary.pricedPositionCount ?? 0}/${summary.openPositionCount}개 평가`
              : "보유 포지션 없음"
          }
          valueClass={pnlClass(summary.totalUnrealizedPnl)}
        />
        <KpiTile
          label="실현 손익"
          value={fmtPnl(summary.realizedPnl)}
          sub={`청산 ${summary.closedPositionCount}건`}
          valueClass={pnlClass(summary.realizedPnl)}
        />
        <KpiTile
          label="총 평가액"
          value={fmtMoney(summary.totalMarketValue)}
          sub={summary.totalCostBasisOpen ? `원가 ${fmtMoney(summary.totalCostBasisOpen)}` : undefined}
        />
        <KpiTile
          label="청산 승률"
          value={summary.winRate != null ? `${(summary.winRate * 100).toFixed(1)}%` : "—"}
          sub={`청산 ${summary.closedPositionCount}건 기준`}
          valueClass={winRateClass(summary.winRate)}
        />
        <KpiTile
          label="보유 포지션"
          value={`${summary.openPositionCount ?? 0}개`}
          sub={`총 거래 ${summary.tradeCount}건`}
        />
      </div>
      {realPos.length > 0 && (
        <PositionsTable label="💵 실전 포지션" rows={realPos} onChanged={onChanged} />
      )}
      {paperPos.length > 0 && (
        <PositionsTable label="📄 페이퍼 포지션" rows={paperPos} onChanged={onChanged} />
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-950/40">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueClass ?? "text-neutral-100"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

function InsightsPanel({
  rec,
  trades,
  ai,
}: {
  rec: RecPerfResponse | null;
  trades: PositionsResponse | null;
  ai: AiStatsResponse | null;
}) {
  const insights = buildInsights(rec, trades, ai);
  if (insights.length === 0) return null;

  const tones: Record<InsightTone, { icon: string; border: string; bg: string }> = {
    bad: { icon: "🔴", border: "border-l-rose-500", bg: "bg-rose-950/15" },
    warn: { icon: "🟡", border: "border-l-amber-500", bg: "bg-amber-950/15" },
    good: { icon: "🟢", border: "border-l-emerald-500", bg: "bg-emerald-950/15" },
    info: { icon: "💡", border: "border-l-sky-500", bg: "bg-sky-950/15" },
  };

  return (
    <section className="border border-neutral-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-neutral-200 mb-3">💡 개선 포인트</h2>
      <ul className="space-y-2">
        {insights.map((ins, i) => {
          const t = tones[ins.tone];
          return (
            <li key={i} className={`border-l-2 ${t.border} ${t.bg} rounded-r px-3 py-2`}>
              <div className="flex items-start gap-2">
                <span className="text-sm leading-tight shrink-0">{t.icon}</span>
                <div>
                  <div className="text-sm font-medium text-neutral-100">{ins.title}</div>
                  <div className="mt-0.5 text-xs text-neutral-400 leading-relaxed">{ins.detail}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-neutral-600">
        데이터에서 자동 추출한 관찰입니다. 표본이 작을 수 있으니(n 표기 참고) 참고용으로만 활용하세요.
      </p>
    </section>
  );
}

function RealizedPnlChart({ points }: { points: RealizedPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Baseline"> | null>(null);

  // Create the chart once.
  useEffect(() => {
    if (!containerRef.current || apiRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 240,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      rightPriceScale: { borderColor: "#1f2937" },
      timeScale: { borderColor: "#1f2937", timeVisible: false, secondsVisible: false },
      crosshair: { mode: 0 },
    });
    apiRef.current = chart;
    seriesRef.current = chart.addBaselineSeries({
      baseValue: { type: "price", price: 0 },
      topLineColor: "#10b981",
      topFillColor1: "rgba(16,185,129,0.28)",
      topFillColor2: "rgba(16,185,129,0.04)",
      bottomLineColor: "#f43f5e",
      bottomFillColor1: "rgba(244,63,94,0.04)",
      bottomFillColor2: "rgba(244,63,94,0.28)",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    const onResize = () => {
      if (containerRef.current && apiRef.current) {
        apiRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      apiRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push data whenever the curve changes. Collapse same-second events so the
  // series stays strictly ascending (lightweight-charts rejects duplicates).
  useEffect(() => {
    if (!seriesRef.current) return;
    const byTime = new Map<number, number>();
    for (const p of points) {
      byTime.set(Math.floor(new Date(p.ts).getTime() / 1000), p.cumulative);
    }
    const data = [...byTime.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as unknown as never, value }));
    seriesRef.current.setData(data);
    apiRef.current?.timeScale().fitContent();
  }, [points]);

  return <div ref={containerRef} className="w-full" />;
}

function RealizedPnlSection({ points }: { points: RealizedPoint[] | undefined }) {
  if (!points || points.length < 2) return null;
  const final = points[points.length - 1].cumulative;
  return (
    <section className="border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-xs uppercase text-neutral-400">📈 누적 실현 손익</h2>
        <span className={`text-sm font-semibold ${pnlClass(final)}`}>{fmtPnl(final)}</span>
      </div>
      <p className="text-xs text-neutral-500 mb-2">
        매도 시점마다 확정된 실현 손익의 누적 곡선 (가중평균 단가 기준). 미실현은 제외 —
        보유 종목 평가손익은 아래 「내 매매 성과」 참고.
      </p>
      <RealizedPnlChart points={points} />
    </section>
  );
}

function HeroBand({
  trades,
  rec,
}: {
  trades: PositionsResponse | null;
  rec: RecPerfResponse | null;
}) {
  const s = trades?.summary;
  const r = rec?.summary;
  const totalPnl = s ? s.totalPnl ?? s.realizedPnl : null;

  const cells: Array<{ label: string; value: string; cls?: string; sub?: string }> = [
    {
      label: "총 손익 (실현+미실현)",
      value: fmtPnl(totalPnl),
      cls: pnlClass(totalPnl),
      sub: s?.totalMarketValue != null ? `평가액 ${fmtMoney(s.totalMarketValue)}` : undefined,
    },
    {
      label: "미실현 손익",
      value: fmtPnl(s?.totalUnrealizedPnl),
      cls: pnlClass(s?.totalUnrealizedPnl),
      sub: s?.openPositionCount ? `보유 ${s.openPositionCount}종목` : undefined,
    },
    {
      label: "실현 손익",
      value: fmtPnl(s?.realizedPnl),
      cls: pnlClass(s?.realizedPnl),
      sub: s ? `청산 승률 ${s.winRate != null ? (s.winRate * 100).toFixed(0) + "%" : "—"}` : undefined,
    },
    {
      label: "AI 추천 적중률 (1d)",
      value: r?.hitRate1d != null ? `${(r.hitRate1d * 100).toFixed(0)}%` : "—",
      cls: winRateClass(r?.hitRate1d ?? null),
      sub: r ? `측정 ${r.measuredCount}건` : undefined,
    },
    {
      label: "추천 방향 일치율",
      value: r?.alignmentRate != null ? `${(r.alignmentRate * 100).toFixed(0)}%` : "—",
      sub: r ? `추천 ${r.distinctRecs}개 실행` : undefined,
    },
    {
      label: "추천 평균수익 (1d)",
      value: fmtPct(r?.meanAligned1d ?? null),
      cls: pctClass(r?.meanAligned1d ?? null),
      sub: "내 매매 방향 기준",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {cells.map((c) => (
        <div key={c.label} className="border border-neutral-800 rounded-lg p-3 bg-neutral-950/60">
          <div className="text-[10px] uppercase tracking-wide text-neutral-500 leading-tight">
            {c.label}
          </div>
          <div className={`mt-1 text-lg lg:text-xl font-bold ${c.cls ?? "text-neutral-100"}`}>
            {c.value}
          </div>
          {c.sub && <div className="mt-0.5 text-[11px] text-neutral-600">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function VerdictBadge({ verdict, confidence }: { verdict: "buy" | "sell" | "hold"; confidence: number }) {
  const map = {
    buy: { label: "매수", cls: "text-emerald-300 border-emerald-800/60 bg-emerald-950/30" },
    sell: { label: "매도", cls: "text-rose-300 border-rose-800/60 bg-rose-950/30" },
    hold: { label: "관망", cls: "text-amber-300 border-amber-800/60 bg-amber-950/30" },
  }[verdict];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${map.cls}`}>
      {map.label}
      <span className="text-neutral-500">{(confidence * 100).toFixed(0)}%</span>
    </span>
  );
}

function RecPerformancePanel({ data }: { data: RecPerfResponse }) {
  const { trades, summary } = data;

  if (trades.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        아직 추천 기반 매매 기록이 없습니다. /trade 페이지에서 매매를 기록하면
        24시간 내 AI 추천에 자동 연결되어 여기 성과가 쌓입니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 ${
          summary.slippageMeasuredCount > 0 ? "lg:grid-cols-6" : "lg:grid-cols-5"
        }`}
      >
        <KpiTile
          label="추천 실행"
          value={`${summary.recTradeCount}건`}
          sub={`실전 ${summary.realCount} · 추천 ${summary.distinctRecs}개`}
        />
        <KpiTile
          label="방향 일치율"
          value={summary.alignmentRate != null ? `${(summary.alignmentRate * 100).toFixed(0)}%` : "—"}
          sub="AI 방향대로 매매"
        />
        <KpiTile
          label="적중률 (1d)"
          value={summary.hitRate1d != null ? `${(summary.hitRate1d * 100).toFixed(0)}%` : "—"}
          sub={`내 매매가 맞은 비율 (n=${summary.measuredCount})`}
          valueClass={winRateClass(summary.hitRate1d)}
        />
        <KpiTile
          label="평균 수익률 (1d)"
          value={fmtPct(summary.meanAligned1d)}
          sub={`3d ${fmtPct(summary.meanAligned3d)} · 5d ${fmtPct(summary.meanAligned5d)}`}
          valueClass={pctClass(summary.meanAligned1d)}
        />
        <KpiTile
          label="평균 진입 지연"
          value={summary.avgEntryLagHours != null ? `${summary.avgEntryLagHours.toFixed(1)}h` : "—"}
          sub="추천 → 내 매매"
        />
        {summary.slippageMeasuredCount > 0 && (
          <KpiTile
            label="평균 진입 슬리피지"
            value={fmtPct(summary.avgSlippagePct)}
            sub={`추천가 대비 (+=불리, n=${summary.slippageMeasuredCount})`}
            valueClass={
              summary.avgSlippagePct == null
                ? undefined
                : summary.avgSlippagePct > 0
                  ? "text-rose-400"
                  : "text-emerald-400"
            }
          />
        )}
      </div>

      {/* Derivative-trading note: when the user trades leveraged/derivative
          ETFs on an underlying's verdict, the fill price and the verdict price
          live on different scales, so absolute-price slippage isn't meaningful.
          Surface this honestly rather than showing a broken metric. */}
      {summary.derivativeTradeCount > 0 &&
        summary.slippageMeasuredCount < summary.recTradeCount && (
          <p className="text-xs text-amber-300/80 bg-amber-950/15 border border-amber-900/40 rounded px-3 py-2">
            ⚠️ 추천 매매 {summary.recTradeCount}건 중 {summary.derivativeTradeCount}건이
            레버리지·파생 ETF 매매입니다 (예: AAPU←AAPL). 추천가는 underlying 가격,
            체결가는 ETF 가격이라 단위가 달라 <span className="text-amber-200">진입 슬리피지는 측정 불가</span>.
            추격 정도는 위 「평균 진입 지연」으로 가늠하세요. 또한 ETF 레버리지로 손익이 underlying보다 증폭됩니다.
          </p>
        )}

      {/* Per-trade table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-neutral-500 border-b border-neutral-800">
            <tr>
              <th className="text-left py-1.5 pr-2">날짜</th>
              <th className="text-left py-1.5 px-2">종목</th>
              <th className="text-left py-1.5 px-2">AI 추천</th>
              <th className="text-left py-1.5 px-2">내 매매</th>
              <th className="text-center py-1.5 px-2">방향</th>
              <th className="text-right py-1.5 px-2">1d</th>
              <th className="text-right py-1.5 px-2">3d</th>
              <th className="text-right py-1.5 pl-2">5d</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <Fragment key={t.tradeId}>
                <tr className="border-b border-neutral-900 hover:bg-neutral-900/40">
                  <td className="py-1.5 pr-2 text-neutral-500 font-mono whitespace-nowrap">
                    {new Date(t.ts).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                  </td>
                  <td className="py-1.5 px-2">
                    <span className="text-sky-300 font-semibold">{t.symbol}</span>
                    {t.underlying && t.underlying !== t.symbol && (
                      <span
                        className="ml-1 text-[10px] text-neutral-500"
                        title={`${t.underlying} 분석을 보고 ${t.symbol}(파생) 매매`}
                      >
                        ←{t.underlying}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    <VerdictBadge verdict={t.verdict} confidence={t.confidence} />
                  </td>
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <span className={t.action === "buy" ? "text-emerald-400" : "text-rose-400"}>
                      {t.action === "buy" ? "매수" : "매도"}
                    </span>
                    <span className="text-neutral-400"> {t.qty}@${t.price.toFixed(2)}</span>
                    {t.mode === "real" ? (
                      <span className="ml-1 text-[10px] text-amber-400/80">실전</span>
                    ) : (
                      <span className="ml-1 text-[10px] text-neutral-600">페이퍼</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {t.aligned === true ? (
                      <span className="text-emerald-400">일치</span>
                    ) : t.aligned === false ? (
                      <span className="text-amber-400">역행</span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className={`text-right py-1.5 px-2 ${pctClass(t.aligned1d)}`}>{fmtPct(t.aligned1d)}</td>
                  <td className={`text-right py-1.5 px-2 ${pctClass(t.aligned3d)}`}>{fmtPct(t.aligned3d)}</td>
                  <td className={`text-right py-1.5 pl-2 ${pctClass(t.aligned5d)}`}>{fmtPct(t.aligned5d)}</td>
                </tr>
                {t.notes && t.notes.trim().length > 0 && (
                  <tr>
                    <td colSpan={8} className="pb-2 px-2 bg-neutral-950/30">
                      <span className="text-[11px] text-neutral-400 italic">“{t.notes.trim()}”</span>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-600">
        <strong>방향</strong>: 내 매매가 AI verdict 방향과 같으면 일치, 반대면 역행 (관망은 —).
        <strong className="ml-2">1d/3d/5d</strong>: 추천 시점부터의 수익률을 내 매매 방향 기준으로 본 값
        (+면 내 판단이 맞은 것). 추천 후 7일 지나야 5d까지 채워짐.
      </p>
    </div>
  );
}

function AiAccuracyPanel({ data }: { data: AiStatsResponse }) {
  const totalMeasured =
    data.byVerdict.buy.count +
    data.byVerdict.sell.count +
    data.byVerdict.hold.count;

  if (totalMeasured === 0) {
    return (
      <p className="text-sm text-neutral-500">
        측정된 AI verdict 없음. AI 스캔 워커가 발동한 verdict가 7일 이상 지나야 measured 상태로 전환됩니다 (1d/3d/5d 필요). 첫 스캔 후 약 1주일 뒤부터 데이터가 쌓입니다.
      </p>
    );
  }

  const verdicts: Array<{
    key: "buy" | "sell" | "hold";
    label: string;
    interpretation: string;
    color: string;
  }> = [
    {
      key: "buy",
      label: "🟢 BUY",
      interpretation: "승률 = 1d 후 가격 상승 비율",
      color: "border-emerald-900/50 bg-emerald-950/20",
    },
    {
      key: "sell",
      label: "🔴 SELL",
      interpretation: "승률 = 1d 후 가격 하락 비율",
      color: "border-rose-900/50 bg-rose-950/20",
    },
    {
      key: "hold",
      label: "🟡 HOLD",
      interpretation: "승률 = 1d 후 |변화| < 1% 비율",
      color: "border-amber-900/50 bg-amber-950/20",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Per-verdict tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {verdicts.map((v) => {
          const s = data.byVerdict[v.key];
          if (s.count === 0) {
            return (
              <div
                key={v.key}
                className={`border rounded-lg p-3 ${v.color} opacity-60`}
              >
                <div className="text-xs font-semibold text-neutral-300">{v.label}</div>
                <div className="text-xs text-neutral-500 mt-1">측정 데이터 없음</div>
              </div>
            );
          }
          return (
            <div key={v.key} className={`border rounded-lg p-3 ${v.color}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-semibold text-neutral-200">{v.label}</div>
                <div className="text-xs text-neutral-400">n = {s.count}</div>
              </div>
              <div className="text-xs text-neutral-500 mb-2">{v.interpretation}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                <span className="text-neutral-500">승률 (1d)</span>
                <span className={`text-right font-semibold ${winRateClass(s.winRate1d)}`}>
                  {s.winRate1d != null ? `${(s.winRate1d * 100).toFixed(1)}%` : "—"}
                </span>
                <span className="text-neutral-500">평균 1d</span>
                <span className={`text-right ${pctClass(s.mean1d)}`}>{fmtPct(s.mean1d)}</span>
                <span className="text-neutral-500">평균 3d</span>
                <span className={`text-right ${pctClass(s.mean3d)}`}>{fmtPct(s.mean3d)}</span>
                <span className="text-neutral-500">평균 5d</span>
                <span className={`text-right ${pctClass(s.mean5d)}`}>{fmtPct(s.mean5d)}</span>
                {s.mean30d != null && (
                  <>
                    <span className="text-neutral-500">평균 30d</span>
                    <span className={`text-right ${pctClass(s.mean30d)}`}>
                      {fmtPct(s.mean30d)}
                    </span>
                  </>
                )}
                <span className="text-neutral-500">Sharpe (1d)</span>
                <span className="text-right text-neutral-300">{fmtNum(s.sharpe1d)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confidence calibration for BUY */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-300 mb-1">
          BUY 신뢰도 캘리브레이션
        </h3>
        <p className="text-xs text-neutral-500 mb-2">
          잘 캘리브레이션된 AI는 신뢰도 구간이 높을수록 승률이 일관되게 ↑.
          높은 신뢰도 구간에서 승률이 낮으면 → AI가 과신 (verdict 신뢰도를 그대로 받지 말 것).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-neutral-500 border-b border-neutral-800">
              <tr>
                <th className="text-left py-1.5 pr-2">신뢰도 구간</th>
                <th className="text-right py-1.5 px-2">건수</th>
                <th className="text-right py-1.5 px-2">승률 (1d)</th>
                <th className="text-right py-1.5 pl-2">평균 1d</th>
              </tr>
            </thead>
            <tbody>
              {data.confidenceCalibrationBuy.map((b, i) => (
                <tr
                  key={i}
                  className="border-b border-neutral-900 hover:bg-neutral-900/40"
                >
                  <td className="py-1.5 pr-2 text-neutral-300">
                    {(b.confidenceMin * 100).toFixed(0)}% ~ {Math.min(100, b.confidenceMax * 100).toFixed(0)}%
                  </td>
                  <td className="text-right py-1.5 px-2 text-neutral-400">{b.count}</td>
                  <td className={`text-right py-1.5 px-2 ${winRateClass(b.winRate1d)}`}>
                    {b.winRate1d != null ? `${(b.winRate1d * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className={`text-right py-1.5 pl-2 ${pctClass(b.meanReturn1d)}`}>
                    {fmtPct(b.meanReturn1d)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PositionsTable({
  label,
  rows,
  onChanged,
}: {
  label: string;
  rows: Position[];
  onChanged?: () => void;
}) {
  // Per-fill selection for deletion. Keyed by trade id (globally unique), so a
  // single Set is safe even though real/paper tables are separate instances.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDelErr(null);
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `선택한 매매 ${ids.length}건을 삭제할까요?\n되돌릴 수 없으며, 삭제 후 대시보드 전체(누적 곡선·KPI·개선 포인트·AI 추천 성과)가 다시 계산됩니다.`,
      )
    )
      return;
    setDeleting(true);
    setDelErr(null);
    try {
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/trades?id=${encodeURIComponent(id)}`, { method: "DELETE" })
            .then(async (r) => ({
              ok: r.ok,
              err: r.ok ? null : ((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`,
            }))
            .catch((e) => ({ ok: false, err: (e as Error).message })),
        ),
      );
      const failed = results.filter((r) => !r.ok);
      setSelected(new Set());
      if (failed.length > 0) {
        setDelErr(`${failed.length}/${ids.length}건 삭제 실패: ${failed[0].err}`);
      }
      // Refresh every panel so the realized curve, KPIs and insights re-derive
      // from the new trade set (cascade requirement).
      onChanged?.();
    } catch (e) {
      setDelErr((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h3 className="text-sm font-semibold text-neutral-300">{label}</h3>
        {(selected.size > 0 || delErr) && (
          <div className="flex items-center gap-2">
            {delErr && <span className="text-[11px] text-rose-400">{delErr}</span>}
            {selected.size > 0 && (
              <>
                <button
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="px-2 py-1 text-[11px] rounded border border-rose-800/70 text-rose-300 hover:bg-rose-950/40 disabled:opacity-40"
                >
                  {deleting ? "삭제 중…" : `선택 ${selected.size}건 삭제`}
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300"
                >
                  선택 해제
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-neutral-500 border-b border-neutral-800">
            <tr>
              <th className="text-left py-1.5 pr-2">종목</th>
              <th className="text-right py-1.5 px-2">보유</th>
              <th className="text-right py-1.5 px-2">평균가</th>
              <th className="text-right py-1.5 px-2">현재가</th>
              <th className="text-right py-1.5 px-2">평가손익</th>
              <th className="text-right py-1.5 pl-2">실현손익</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <Fragment key={`${p.symbol}|${p.mode}`}>
              <tr
                className="border-b border-neutral-900 hover:bg-neutral-900/40"
              >
                <td className="py-1.5 pr-2 text-sky-300 font-semibold">{p.symbol}</td>
                <td className="text-right py-1.5 px-2 text-neutral-200">
                  {p.openQty.toFixed(Math.abs(p.openQty) < 1 ? 4 : 2)}
                </td>
                <td className="text-right py-1.5 px-2 text-neutral-200">
                  {p.avgBuyPrice != null ? `$${p.avgBuyPrice.toFixed(2)}` : "—"}
                </td>
                <td className="text-right py-1.5 px-2 text-neutral-300 whitespace-nowrap">
                  {p.currentPrice != null ? `$${p.currentPrice.toFixed(2)}` : "—"}
                  {p.priceStale && (
                    <span className="ml-1 text-[10px] text-amber-500/70" title="장 마감 시세 (실시간 아님)">
                      *
                    </span>
                  )}
                </td>
                <td className="text-right py-1.5 px-2 font-semibold whitespace-nowrap">
                  {p.unrealizedPnl != null ? (
                    <span className={pnlClass(p.unrealizedPnl)}>
                      {fmtPnl(p.unrealizedPnl)}
                      {p.unrealizedPct != null && (
                        <span className="ml-1 text-[10px] font-normal">
                          ({p.unrealizedPct >= 0 ? "+" : ""}{(p.unrealizedPct * 100).toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
                <td className={`text-right py-1.5 pl-2 font-semibold ${pnlClass(p.realizedPnl)}`}>
                  {p.realizedPnl !== 0 ? fmtPnl(p.realizedPnl) : "—"}
                </td>
              </tr>
              {/* Per-fill breakdown — EVERY trade (noted or not) so bulk
                  backfills with empty notes are still visible, each with a
                  checkbox to delete an erroneous/duplicate fill in place. */}
              {p.trades.length > 0 && (
                <tr>
                  <td colSpan={6} className="pb-3 px-2 bg-neutral-950/40">
                    <ul className="space-y-1.5 text-[11px]">
                      {p.trades.map((n) => (
                        <li
                          key={n.id}
                          className={`flex flex-wrap items-center gap-2 leading-relaxed rounded px-1 ${
                            selected.has(n.id) ? "bg-rose-950/30" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(n.id)}
                            onChange={() => toggle(n.id)}
                            title="이 매매를 선택 (삭제용)"
                            className="shrink-0 accent-rose-500 cursor-pointer"
                          />
                          <span className="text-neutral-500 shrink-0 font-mono">
                            {new Date(n.ts).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span
                            className={`shrink-0 font-semibold ${
                              n.action === "buy"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {n.action === "buy" ? "매수" : "매도"}
                          </span>
                          <span className="shrink-0 text-neutral-400 tabular-nums">
                            {n.qty} @ ${n.price.toFixed(2)}
                          </span>
                          {n.note && (
                            <span className="text-neutral-200 break-words italic">
                              “{n.note}”
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatsTable({
  rows,
  labelMap,
  firstColLabel,
}: {
  rows: Record<string, Stats>;
  labelMap: Record<string, string>;
  firstColLabel: string;
}) {
  const entries = Object.entries(rows).sort((a, b) => b[1].count - a[1].count);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-neutral-500 border-b border-neutral-800">
          <tr>
            <th className="text-left py-1.5 pr-3">{firstColLabel}</th>
            <th className="text-right py-1.5 px-2">건수</th>
            <th className="text-right py-1.5 px-2">승률 (1일)</th>
            <th className="text-right py-1.5 px-2">평균 1일</th>
            <th className="text-right py-1.5 px-2">중앙값 1일</th>
            <th className="text-right py-1.5 px-2">평균 3일</th>
            <th className="text-right py-1.5 px-2">평균 5일</th>
            <th className="text-right py-1.5 pl-2">Sharpe (1일)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, s]) => (
            <tr key={key} className="border-b border-neutral-900 hover:bg-neutral-900/40">
              <td className="py-1.5 pr-3 text-neutral-200 font-semibold">
                {labelMap[key] ?? key}
              </td>
              <td className="text-right py-1.5 px-2 text-neutral-400">{s.count}</td>
              <td className={`text-right py-1.5 px-2 ${winRateClass(s.winRate1d)}`}>
                {s.winRate1d != null ? `${(s.winRate1d * 100).toFixed(1)}%` : "—"}
              </td>
              <td className={`text-right py-1.5 px-2 ${pctClass(s.mean1d)}`}>
                {fmtPct(s.mean1d)}
              </td>
              <td className={`text-right py-1.5 px-2 ${pctClass(s.median1d)}`}>
                {fmtPct(s.median1d)}
              </td>
              <td className={`text-right py-1.5 px-2 ${pctClass(s.mean3d)}`}>
                {fmtPct(s.mean3d)}
              </td>
              <td className={`text-right py-1.5 px-2 ${pctClass(s.mean5d)}`}>
                {fmtPct(s.mean5d)}
              </td>
              <td className="text-right py-1.5 pl-2 text-neutral-300">
                {fmtNum(s.sharpe1d)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
