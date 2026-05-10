"use client";

import { useEffect, useState } from "react";

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
}

interface PnlSummary {
  mode: "paper" | "real" | "all";
  windowDays: number | null;
  tradeCount: number;
  realizedPnl: number;
  closedPositionCount: number;
  winRate: number | null;
}

interface PositionsResponse {
  asOf: string;
  positions: Position[];
  summary: PnlSummary;
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

export default function StatsPage() {
  const [lookback, setLookback] = useState(30);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<PositionsResponse | null>(null);
  const [ai, setAi] = useState<AiStatsResponse | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/signal-stats?lookback=${lookback}`).then((r) => r.json()),
      fetch(`/api/trades/positions?lookback=${lookback}`).then((r) => r.json()),
      fetch(`/api/ai-stats?lookback=${lookback}`).then((r) => r.json()),
    ])
      .then(
        ([sigD, tradeD, aiD]: [
          StatsResponse | { error: string },
          PositionsResponse | { error: string },
          AiStatsResponse | { error: string },
        ]) => {
          if ("error" in sigD) setError(sigD.error);
          else setData(sigD);
          if (!("error" in tradeD)) setTrades(tradeD);
          if (!("error" in aiD)) setAi(aiD);
        },
      )
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [lookback]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">📈 시그널 성과</h1>
        <p className="text-xs text-neutral-500 mt-1">
          내 트래커가 발동한 시그널의 <span className="text-neutral-300">실제</span> 1일/3일/5일 후 수익률 측정.
          시그널 발동 후 7일 이상 지나야 5일 데이터가 채워짐 (realize.py 일일 cron).
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
          <span className="ml-auto text-neutral-500">
            측정됨 {data.measuredSignals.toLocaleString()} / 전체 {data.totalSignalsInWindow.toLocaleString()}건
            <span className="text-neutral-700 ml-2">
              ({new Date(data.asOf).toLocaleString()} 기준)
            </span>
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
          {/* Trade journal P&L */}
          {trades && (
            <section className="border border-neutral-800 rounded-lg p-4">
              <h2 className="text-xs uppercase text-neutral-400 mb-3">📝 내 매매 성과 ({lookback}일)</h2>
              <TradePnlPanel data={trades} />
            </section>
          )}

          {/* AI verdict accuracy */}
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

          {/* Overall */}
          <section className="border border-neutral-800 rounded-lg p-4">
            <h2 className="text-xs uppercase text-neutral-400 mb-3">전체 시그널 (지난 {lookback}일, 측정된 것만)</h2>
            <OverallCard stats={data.overall} />
          </section>

          {/* By type */}
          <section className="border border-neutral-800 rounded-lg p-4">
            <h2 className="text-xs uppercase text-neutral-400 mb-3">시그널 타입별</h2>
            {Object.keys(data.byType).length === 0 ? (
              <p className="text-sm text-neutral-500">측정된 시그널 없음. 7일 이상 지난 시그널이 쌓이면 표시됩니다.</p>
            ) : (
              <StatsTable rows={data.byType} labelMap={TYPE_LABEL} firstColLabel="타입" />
            )}
          </section>

          {/* By type × session */}
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

          {/* By type × news (with-news vs no-news comparison) */}
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

function TradePnlPanel({ data }: { data: PositionsResponse }) {
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Tile
          label="총 거래 건수"
          value={summary.tradeCount.toLocaleString()}
        />
        <Tile
          label="청산 완료 포지션"
          value={summary.closedPositionCount.toLocaleString()}
        />
        <Tile
          label="청산 승률"
          value={
            summary.winRate != null
              ? `${(summary.winRate * 100).toFixed(1)}%`
              : "—"
          }
          className={winRateClass(summary.winRate)}
        />
        <Tile
          label="실현 손익 (USD)"
          value={`${summary.realizedPnl >= 0 ? "+" : ""}$${summary.realizedPnl.toFixed(2)}`}
          className={
            summary.realizedPnl > 0
              ? "text-emerald-400"
              : summary.realizedPnl < 0
                ? "text-rose-400"
                : "text-neutral-300"
          }
        />
      </div>
      {paperPos.length > 0 && (
        <PositionsTable label="📄 페이퍼 포지션" rows={paperPos} />
      )}
      {realPos.length > 0 && (
        <PositionsTable label="💵 실전 포지션" rows={realPos} />
      )}
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

function PositionsTable({ label, rows }: { label: string; rows: Position[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-300 mb-1">{label}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-neutral-500 border-b border-neutral-800">
            <tr>
              <th className="text-left py-1.5 pr-2">종목</th>
              <th className="text-right py-1.5 px-2">보유 수량</th>
              <th className="text-right py-1.5 px-2">평균 매수가</th>
              <th className="text-right py-1.5 px-2">실현 손익</th>
              <th className="text-right py-1.5 px-2">총 매수</th>
              <th className="text-right py-1.5 pl-2">총 매도</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={`${p.symbol}|${p.mode}`}
                className="border-b border-neutral-900 hover:bg-neutral-900/40"
              >
                <td className="py-1.5 pr-2 text-sky-300 font-semibold">{p.symbol}</td>
                <td className="text-right py-1.5 px-2 text-neutral-200">
                  {p.openQty.toFixed(p.openQty < 1 ? 4 : 2)}
                </td>
                <td className="text-right py-1.5 px-2 text-neutral-200">
                  {p.avgBuyPrice != null ? `$${p.avgBuyPrice.toFixed(2)}` : "—"}
                </td>
                <td
                  className={`text-right py-1.5 px-2 font-semibold ${
                    p.realizedPnl > 0
                      ? "text-emerald-400"
                      : p.realizedPnl < 0
                        ? "text-rose-400"
                        : "text-neutral-300"
                  }`}
                >
                  {p.realizedPnl >= 0 ? "+" : ""}${p.realizedPnl.toFixed(2)}
                </td>
                <td className="text-right py-1.5 px-2 text-neutral-400">
                  {p.totalBuyQty.toFixed(2)}
                </td>
                <td className="text-right py-1.5 pl-2 text-neutral-400">
                  {p.totalSellQty.toFixed(2)}
                </td>
              </tr>
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
