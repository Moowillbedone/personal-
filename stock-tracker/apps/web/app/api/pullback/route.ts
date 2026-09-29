// POST /api/pullback  { symbol }
//
// MULTI-TIMEFRAME 눌림목(pullback vs downtrend) analyzer for the Trade tab.
// Runs the SAME deterministic engine (lib/pullback.ts) on 1분/15분/1시간/4시간/
// 일봉 so short-term (day ~ 1-3d swing) reads sit next to the daily big picture —
// the previous version was daily-only, which didn't match the intraday chart.
// Gemini (generatePullback) then synthesizes across timeframes: which TF is
// operative, do the higher-TF trend and lower-TF timing agree, and the plan.

import { NextRequest, NextResponse } from "next/server";
import { getPrimarySnapshot } from "@/lib/marketData";
import { fetchAlpacaBars } from "@/lib/alpaca";
import { getFinnhubBundle, isFinnhubEnabled } from "@/lib/finnhub";
import { generatePullback, type PullbackVerdict } from "@/lib/gemini";
import { analyzePullback, type PullbackFacts, type Grade } from "@/lib/pullback";
import { completedDailyBars, dailyBarsQuality, snapshotQuality, timestampQuality, type DataQuality } from "@/lib/dataQuality";
import type { Bar } from "@/lib/indicators";
import type { Snapshot } from "@/lib/alpaca";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOFT_TIMEOUT_MS = 8000;
function softly<T>(p: Promise<T>, ms = SOFT_TIMEOUT_MS): Promise<T | null> {
  return Promise.race([
    p.then((v) => v, () => null),
    new Promise<null>((res) => setTimeout(() => res(null), ms)),
  ]);
}

const GRADE_KO: Record<Grade, string> = { pass: "충족", warn: "주의", fail: "위반" };

// Each timeframe's fetch depth is chosen to yield ~200+ bars (so SMA200 + the
// 60-bar swing window resolve) while the 60-bar window maps to a sensible span:
// 1m→1h micro, 15m→~2.5d, 1h→~1-2wk, 4h→~6wk, 1d→~3mo.
// adj: 1d/4h use SPLIT-adjusted bars (a split inside the long window would else
// inject an ~Nx price cliff into SMA200/swing/retrace) — matches the worker so
// the dashboard scanner agrees with this daily read. Intraday windows are short
// → raw (actual traded prices).
const TFS = [
  { key: "1m", tf: "1Min", days: 4, limit: 1500, label: "1분봉", minutes: 1, adj: "raw" },
  { key: "15m", tf: "15Min", days: 15, limit: 700, label: "15분봉", minutes: 15, adj: "raw" },
  { key: "1h", tf: "1Hour", days: 45, limit: 700, label: "1시간봉", minutes: 60, adj: "raw" },
  { key: "4h", tf: "4Hour", days: 260, limit: 500, label: "4시간봉", minutes: 240, adj: "split" },
  { key: "1d", tf: "1Day", days: 380, limit: 400, label: "일봉", minutes: 1440, adj: "split" },
] as const;

interface TimeframeResult {
  key: string;
  label: string;
  bars: number;
  facts: PullbackFacts | null; // null = insufficient or outdated evidence
  dataQuality: DataQuality;
  source: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
    const symbol = body?.symbol?.trim().toUpperCase();
    if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
    }

    // Fetch source bars and quotes independently; do not mix undated scanner levels.
    const [barsByTf, snap, finnhub] = await Promise.all([
      Promise.all(
        TFS.map((t) => softly(fetchAlpacaBars(symbol, t.tf, t.days, t.limit, t.adj))),
      ),
      softly(getPrimarySnapshot(symbol)),
      isFinnhubEnabled() ? softly(getFinnhubBundle(symbol)) : Promise.resolve(null),
    ]);

    const now = new Date();
    const priceQuality = snap ? snapshotQuality(snap.lastTradeTs, snap.lastPrice, snap.session, now) : null;
    if (!snap || snap.dataQuality?.status !== "fresh" || priceQuality?.status !== "fresh" || snap.lastPrice == null) {
      return NextResponse.json({
        error: "현재 가격의 출처 시각·신선도를 확인할 수 없어 분석을 중단했습니다. 가격을 새로고침한 뒤 다시 시도하세요.",
        dataQuality: priceQuality,
      }, { status: 503 });
    }

    const delayedCutoff = now.getTime() - 16 * 60_000;
    const timeframes: TimeframeResult[] = TFS.map((t, i) => {
      const rawBars = (barsByTf[i] ?? []) as Bar[];
      // SIP is delayed; a timestamp marks the OPEN of the candle. A candle
      // must also have ended before the delayed feed cutoff to be evidence.
      const bars = t.key === "1d" ? completedDailyBars(rawBars, now)
        : rawBars.filter((b) => Number.isFinite(Date.parse(b.ts)) && Date.parse(b.ts) + t.minutes * 60_000 <= delayedCutoff);
      const quality = t.key === "1d" ? dailyBarsQuality(bars, 30, now)
        : timestampQuality(bars.at(-1)?.ts, (16 + 2 * t.minutes + 5) * 60_000, now);
      if (bars.length < 30) {
        quality.status = "unavailable";
        quality.reasons.push(`최소 30개 완료 봉 중 ${bars.length}개만 있습니다.`);
      }
      const facts = quality.status === "fresh" ? analyzePullback(bars) : null;
      return { key: t.key, label: t.label, bars: bars.length, facts, dataQuality: quality,
        source: `Alpaca SIP · ${t.key === "1d" ? "완료 일봉" : "16분 이상 지연·완료 봉"} · ${t.adj}` };
    });

    if (timeframes.every((t) => t.facts == null)) {
      return NextResponse.json(
        { error: "유효한 최신 완료 봉이 없어 눌림목 분석을 중단했습니다.", timeframes },
        { status: 503 },
      );
    }

    const nextEarnings = finnhub?.nextEarnings ?? null;
    const price = snap.lastPrice;

    const prompt = buildPrompt(symbol, timeframes, snap, nextEarnings);
    let ai: PullbackVerdict;
    try {
      ai = await generatePullback(prompt);
    } catch (e) {
      return NextResponse.json(
        { error: `AI 분석 실패: ${(e as Error).message}` },
        { status: 503 },
      );
    }

    // Plan: AI numbers if internally ordered, else the mechanical baseline from
    // the longest timeframe that produced one (most stable structure).
    const fallbackPlan =
      ["1d", "4h", "1h", "15m", "1m"]
        .map((k) => timeframes.find((t) => t.key === k)?.facts?.plan)
        .find((p) => p != null) ?? null;
    const finalPlan = coherentPlan(ai) ?? fallbackPlan;

    return NextResponse.json({
      symbol,
      session: snap.session,
      dataQuality: priceQuality,
      priceSource: snap.priceSource,
      priceAsOf: snap.lastTradeTs,
      price: Number(price.toFixed(2)),
      earnings: nextEarnings
        ? { date: nextEarnings.date, daysUntil: nextEarnings.daysUntil }
        : null,
      timeframes,
      ai,
      plan: finalPlan,
      gradeLabels: GRADE_KO,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "pullback analysis failed" },
      { status: 500 },
    );
  }
}

function coherentPlan(ai: PullbackVerdict): {
  entryLow: number;
  entryHigh: number;
  stop: number;
  target1: number;
  target2: number;
  rr: number | null;
} | null {
  const { entry_low, entry_high, stop, target_1, target_2 } = ai;
  const ok =
    [entry_low, entry_high, stop, target_1, target_2].every(
      (v) => typeof v === "number" && isFinite(v) && v > 0,
    ) &&
    stop < entry_low &&
    entry_low <= entry_high &&
    entry_high < target_1 &&
    target_1 <= target_2;
  if (!ok) return null;
  const risk = entry_high - stop;
  return {
    entryLow: entry_low,
    entryHigh: entry_high,
    stop,
    target1: target_1,
    target2: target_2,
    rr: risk > 0 ? Number(((target_1 - entry_high) / risk).toFixed(2)) : null,
  };
}

function pct(v: number | null): string {
  return v == null ? "?" : `${(v * 100).toFixed(0)}%`;
}

function buildPrompt(
  symbol: string,
  timeframes: TimeframeResult[],
  snap: Snapshot | null,
  earnings: { date: string; daysUntil: number } | null,
): string {
  const tfBlocks: string[] = [];
  for (const t of timeframes) {
    if (!t.facts) {
      tfBlocks.push(`### ${t.label}: 판정 제외 — ${t.dataQuality.reasons.join(" ")}`);
      continue;
    }
    const f = t.facts;
    const c = f.criteria;
    const sup =
      f.supports.length > 0
        ? f.supports.map((s) => `${s.label}(${s.distPct >= 0 ? "+" : ""}${s.distPct}%)`).join(", ")
        : "없음";
    tfBlocks.push(
      [
        `### ${t.label} — 기계적 판정: ${f.classification}`,
        `  출처: ${t.source} · 봉 시작 시각: ${t.dataQuality.asOf} · 봉 종가: ${f.price}`,
        `  0추세[${GRADE_KO[c.trend.grade]}] 1거래량[${GRADE_KO[c.volume.grade]}] 2저점구조[${GRADE_KO[c.structure.grade]}] 3지지[${GRADE_KO[c.support.grade]}] 4확인캔들[${GRADE_KO[c.confirmation.grade]}]`,
        `  직전고점 ${f.swingHigh}(${f.swingHighAgo}봉전) · 직전저점 ${f.legLow} · 눌림저점 ${f.pullbackLow} · 되돌림깊이 ${pct(f.retraceDepth)} · 저점이탈=${f.brokeLow} · 신고가/돌파=${f.extended}`,
        `  거래량: ${c.volume.detail}`,
        `  확인캔들: ${c.confirmation.detail}`,
        `  지지(현재가 -3%~+0.5%): ${sup}`,
      ].join("\n"),
    );
  }

  return [
    `# ${symbol} 눌림목 멀티 타임프레임 분석 — 한국어`,
    "",
    "당신은 단타~1-3일 스윙 트레이더다. 아래는 여러 타임프레임에서 기계적으로 계산된 사실이다.",
    "아래 숫자는 과거 관측값이며 수익 예측력이 검증되지 않았다. 타임프레임 정합성을 설명하되 성공 확률로 표현하지 마라.",
    "현재 가격과 완료 봉 종가는 서로 다른 시점·피드다. 특히 분·시간봉도 16분 이상 지연되므로 실시간 진입 확인으로 표현하지 마라.",
    "",
    `## 최근 가격: ${symbol} ${snap?.lastPrice ?? "?"} (${snap?.session ?? "?"} 세션, ${snap?.priceSource ?? "?"}, ${snap?.lastTradeTs ?? "시각 없음"})`,
    earnings
      ? `⚠️ 다음 어닝 ${earnings.date} (D-${earnings.daysUntil}) — 임박 시 눌림이 어닝 도박이 됨`
      : "어닝 임박 정보 없음",
    "",
    "## 타임프레임별 기계적 판정",
    ...tfBlocks,
    "",
    "## 종합 규칙 (매우 중요)",
    "- **상위 TF가 추세를 정하고, 하위 TF가 진입 타이밍을 준다.** 단타~1-3일 스윙의 진입 타이밍은 15분/1시간봉에서, 추세 유효성은 4시간/일봉에서 확인.",
    "- 상위 TF(4시간/일봉) 하락과 하위 TF 반등이 엇갈리면 forming으로 분류하고 확인을 기다린다. 이런 규칙은 검증 전 가설이며 반등 실패 확률이 높다고 단정하지 마라.",
    "- 1분봉은 노이즈가 크니 참고만. 4시간/1시간봉이 스윙의 주력 판단.",
    "- operative_tf: 이 트레이드의 기준이 되는 타임프레임을 명시 (예: '1시간봉').",
    "- classification: pullback(진입가능) / forming(확인대기, 지금 사지마) / downtrend(회피) / no_uptrend(눌림아님). TF가 엇갈리거나 확인 전이면 forming.",
    "- action: 지금 무엇을 할지 + 어느 TF의 무엇을 기다릴지 (예: '일봉 추세 양호, 1시간봉 반전양봉+거래량 확인되면 진입').",
    "- entry_low≤entry_high, stop<entry_low, entry_high<target_1≤target_2 (숫자 순서 필수, operative_tf 기준 가격).",
    "- cautions: 실제 데이터의 지연·누락·시간축 차이를 포함한 리스크 2~4개. confidence는 서술상 확신도이며 승률이나 수익 확률이 아니다. 불명확하면 forming.",
  ].join("\n");
}
