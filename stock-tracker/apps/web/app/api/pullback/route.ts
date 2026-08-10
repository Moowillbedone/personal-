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
import { supabase } from "@/lib/supabase";
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
  { key: "1m", tf: "1Min", days: 4, limit: 1500, label: "1분봉", adj: "raw" },
  { key: "15m", tf: "15Min", days: 15, limit: 700, label: "15분봉", adj: "raw" },
  { key: "1h", tf: "1Hour", days: 45, limit: 700, label: "1시간봉", adj: "raw" },
  { key: "4h", tf: "4Hour", days: 260, limit: 500, label: "4시간봉", adj: "split" },
  { key: "1d", tf: "1Day", days: 380, limit: 400, label: "일봉", adj: "split" },
] as const;

interface TimeframeResult {
  key: string;
  label: string;
  bars: number;
  facts: PullbackFacts | null; // null = not enough data
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
    const symbol = body?.symbol?.trim().toUpperCase();
    if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
    }

    // Fetch every timeframe's bars + snapshot + daily Ichimoku + earnings in parallel.
    const [barsByTf, snap, ichiRow, finnhub] = await Promise.all([
      Promise.all(
        TFS.map((t) => softly(fetchAlpacaBars(symbol, t.tf, t.days, t.limit, t.adj))),
      ),
      softly(getPrimarySnapshot(symbol)),
      softly(
        (async () => {
          const { data } = await supabase
            .from("sma200")
            .select("spana_daily, spanb_daily")
            .eq("symbol", symbol)
            .maybeSingle();
          return data as { spana_daily: number | null; spanb_daily: number | null } | null;
        })(),
      ),
      isFinnhubEnabled() ? softly(getFinnhubBundle(symbol)) : Promise.resolve(null),
    ]);

    // Daily Ichimoku spans are horizontal price levels → valid support on any TF.
    const ichi = { spanA: ichiRow?.spana_daily ?? null, spanB: ichiRow?.spanb_daily ?? null };

    const timeframes: TimeframeResult[] = TFS.map((t, i) => {
      const bars = (barsByTf[i] ?? []) as Bar[];
      const facts = bars.length >= 30 ? analyzePullback(bars, ichi) : null;
      return { key: t.key, label: t.label, bars: bars.length, facts };
    });

    if (timeframes.every((t) => t.facts == null)) {
      return NextResponse.json(
        { error: "어느 타임프레임에서도 눌림목 구조를 판별할 데이터가 부족합니다." },
        { status: 422 },
      );
    }

    const nextEarnings = finnhub?.nextEarnings ?? null;
    const dailyFacts = timeframes.find((t) => t.key === "1d")?.facts ?? null;
    const price =
      snap?.lastPrice ?? dailyFacts?.price ?? timeframes.find((t) => t.facts)!.facts!.price;

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
      session: snap?.session ?? null,
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
      tfBlocks.push(`### ${t.label}: 데이터 부족(${t.bars}봉) — 판정 제외`);
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
    "각 TF의 숫자를 신뢰하고, **타임프레임 정합성**을 핵심으로 종합 판정하라.",
    "",
    `## 현재: ${symbol} ${snap?.lastPrice ?? "?"} (${snap?.session ?? "?"} 세션)`,
    earnings
      ? `⚠️ 다음 어닝 ${earnings.date} (D-${earnings.daysUntil}) — 임박 시 눌림이 어닝 도박이 됨`
      : "어닝 임박 정보 없음",
    "",
    "## 타임프레임별 기계적 판정",
    ...tfBlocks,
    "",
    "## 종합 규칙 (매우 중요)",
    "- **상위 TF가 추세를 정하고, 하위 TF가 진입 타이밍을 준다.** 단타~1-3일 스윙의 진입 타이밍은 15분/1시간봉에서, 추세 유효성은 4시간/일봉에서 확인.",
    "- **상위 TF(4시간/일봉)가 하락/추세훼손이면, 하위 TF(1분/15분)의 반등은 데드캣일 확률이 높다 → 매수 금지.** 반대로 상위 TF 상승추세 + 하위 TF 확인캔들 = 진입 정렬.",
    "- 1분봉은 노이즈가 크니 참고만. 4시간/1시간봉이 스윙의 주력 판단.",
    "- operative_tf: 이 트레이드의 기준이 되는 타임프레임을 명시 (예: '1시간봉').",
    "- classification: pullback(진입가능) / forming(확인대기, 지금 사지마) / downtrend(회피) / no_uptrend(눌림아님). TF가 엇갈리거나 확인 전이면 forming.",
    "- action: 지금 무엇을 할지 + 어느 TF의 무엇을 기다릴지 (예: '일봉 추세 양호, 1시간봉 반전양봉+거래량 확인되면 진입').",
    "- entry_low≤entry_high, stop<entry_low, entry_high<target_1≤target_2 (숫자 순서 필수, operative_tf 기준 가격).",
    "- cautions: 솔직한 리스크 2~4개. 확신 없으면 confidence 낮추고 forming. 초보 보호가 목적.",
  ].join("\n");
}
