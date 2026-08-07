// POST /api/pullback  { symbol }
//
// 눌림목(pullback) vs 하락(downtrend) analyzer for the Trade tab. Computes the
// 5-criterion checklist MECHANICALLY (lib/pullback.ts) from daily bars, then
// asks Gemini (lib/gemini.ts generatePullback) to synthesize the final read +
// Korean narrative + action + plan on top of those facts. Returns both so the
// UI can show the deterministic checklist AND the AI judgment.

import { NextRequest, NextResponse } from "next/server";
import { getPrimarySnapshot, getPrimaryRecentBars } from "@/lib/marketData";
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
    const symbol = body?.symbol?.trim().toUpperCase();
    if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
    }

    // 1) Daily bars (the chart we analyze) + live snapshot + Ichimoku cloud.
    const [bars, snap, ichiRow, finnhub] = await Promise.all([
      getPrimaryRecentBars(symbol),
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

    const daily: Bar[] = bars?.daily ?? [];
    if (daily.length < 30) {
      return NextResponse.json(
        { error: "일봉 데이터가 부족해 눌림목 분석을 할 수 없습니다 (최소 30봉 필요)." },
        { status: 422 },
      );
    }

    const facts = analyzePullback(daily, {
      spanA: ichiRow?.spana_daily ?? null,
      spanB: ichiRow?.spanb_daily ?? null,
    });
    if (!facts) {
      return NextResponse.json(
        { error: "눌림목 구조를 판별할 수 없습니다 (스윙 미형성)." },
        { status: 422 },
      );
    }

    const nextEarnings = finnhub?.nextEarnings ?? null;

    // 2) Prompt → Gemini synthesis.
    const prompt = buildPrompt(symbol, facts, snap, nextEarnings);
    let ai: PullbackVerdict;
    try {
      ai = await generatePullback(prompt);
    } catch (e) {
      return NextResponse.json(
        { error: `AI 분석 실패: ${(e as Error).message}` },
        { status: 503 },
      );
    }

    // 3) Plan sanity — keep AI numbers only if internally ordered; else the
    // mechanical baseline. LLM numeric sloppiness never reaches the card.
    const finalPlan = coherentPlan(ai) ?? facts.plan;

    return NextResponse.json({
      symbol,
      session: snap?.session ?? null,
      price: facts.price,
      earnings: nextEarnings
        ? { date: nextEarnings.date, daysUntil: nextEarnings.daysUntil }
        : null,
      facts, // mechanical checklist + numbers
      ai, // Gemini synthesis
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
  f: PullbackFacts,
  snap: Snapshot | null,
  earnings: { date: string; daysUntil: number } | null,
): string {
  const c = f.criteria;
  const supText =
    f.supports.length > 0
      ? f.supports.map((s) => `${s.label} ${s.level}(${s.distPct >= 0 ? "+" : ""}${s.distPct}%)`).join(", ")
      : "없음";

  return [
    `# ${symbol} 눌림목(pullback) vs 하락(downtrend) 판별 — 한국어`,
    "",
    "당신은 상승추세 내 '건강한 눌림'과 '추세 전환(하락)'을 구분하는 스윙 트레이더다.",
    "아래는 일봉에서 기계적으로 계산된 사실(deterministic)이다. 이 숫자를 신뢰하고,",
    "여기에 맥락(어닝 임박, 시장 상황)을 더해 최종 판정을 내려라. **애매하면 무리하게 매수로 몰지 말고 '확인 대기(forming)'로 판정**하라.",
    "",
    "## 현재",
    `- 가격 ${f.price} (${snap?.session ?? "?"} 세션)`,
    earnings ? `- ⚠️ 다음 어닝 ${earnings.date} (D-${earnings.daysUntil}) — 임박 시 눌림이 어닝 도박이 됨, 신중` : "- 어닝 임박 정보 없음",
    "",
    "## 기계적 5기준 채점 (사실)",
    `0. 추세 [${GRADE_KO[c.trend.grade]}] ${c.trend.detail}`,
    `   - SMA20=${f.sma20} SMA50=${f.sma50} SMA200=${f.sma200}`,
    `1. 거래량 [${GRADE_KO[c.volume.grade]}] ${c.volume.detail}`,
    `2. 저점구조 [${GRADE_KO[c.structure.grade]}] ${c.structure.detail}`,
    `   - 직전 고점 ${f.swingHigh}(${f.swingHighAgo}봉 전) · 직전 저점 ${f.legLow} · 눌림 저점 ${f.pullbackLow} · 되돌림 깊이 ${pct(f.retraceDepth)}(현재 ${pct(f.retracePct)}) · 저점이탈=${f.brokeLow} · 고점낮아짐=${f.lowerHigh} · 신고가/돌파구간=${f.extended}`,
    `3. 지지밀집 [${GRADE_KO[c.support.grade]}] ${c.support.detail}`,
    `   - 현재가 -3%~+0.5% 지지: ${supText}`,
    `4. 확인캔들 [${GRADE_KO[c.confirmation.grade]}] ${c.confirmation.detail}`,
    `- 기계적 예비판정: ${f.classification}`,
    f.plan
      ? `- ATR 기반 기계적 플랜(참고): 진입 ${f.plan.entryLow}~${f.plan.entryHigh} · 손절 ${f.plan.stop} · 목표 ${f.plan.target1}/${f.plan.target2} · R:R ${f.plan.rr ?? "?"}`
      : "- 기계적 플랜: ATR 미산출",
    "",
    "## 판정 기준 (classification)",
    "- pullback = 상승추세 유지 + 거래량 마름 + 저점 유지 + 지지 반응 + 확인캔들 O → 진입 가능",
    "- forming = 추세는 살아있고 지지에 왔으나 확인캔들 아직 X → **지금 사지 말고 확인 대기(WAIT)**",
    "- downtrend = 저점 이탈 / 거래량 붙으며 하락 / 지지 붕괴 → 회피 (물타기 금지)",
    "- no_uptrend = 애초에 상승추세가 아님 → 눌림 개념 자체가 성립 안 함",
    "",
    "## 출력 (JSON 스키마 준수)",
    "- classification, confidence(0~1), headline(한 줄), summary(2~4문장), 각 criteria_notes(한 줄씩, 위 사실 기반 한국어)",
    "- action: 지금 무엇을 할지 (예: '확인 양봉 뜨면 47.5~48 분할진입, 46 이탈 시 손절'). forming/downtrend/no_uptrend면 '매수 대기/회피'를 명확히",
    "- entry_low≤entry_high, stop<entry_low, entry_high<target_1≤target_2 (숫자 순서 필수). 매수 부적합(downtrend/no_uptrend)이면 기계적 플랜 값을 그대로 두되 action에서 '진입 보류'를 명시",
    "- cautions: 솔직한 리스크 2~4개 (어닝/유동성/과최적화 등)",
    "- 확신 없으면 confidence를 낮추고 forming으로. 초보를 지키는 게 목적이다.",
  ].join("\n");
}
