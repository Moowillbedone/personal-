// POST /api/techview  { symbol }
//
// 기술분석 (Tech View) — 갭 + 피보나치 되돌림 + 주봉 고고저 빗각 채널 + 터치 확인.
// lib/techview.ts computes every level MECHANICALLY (deterministic), then Gemini
// narrates the scenario + entry/stop/target on top of those facts. Same split-
// adjusted bar basis as the other long-window engines so levels line up.

import { NextRequest, NextResponse } from "next/server";
import { fetchAlpacaBars } from "@/lib/alpaca";
import { getPrimarySnapshot } from "@/lib/marketData";
import { getFinnhubBundle, isFinnhubEnabled } from "@/lib/finnhub";
import { generateTechView, type TechVerdict } from "@/lib/gemini";
import { analyzeTech, SETUP_META, type TechAnalysis } from "@/lib/techview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SOFT_MS = 8000;
function softly<T>(p: Promise<T>, ms = SOFT_MS): Promise<T | null> {
  return Promise.race([
    p.then((v) => v, () => null),
    new Promise<null>((res) => setTimeout(() => res(null), ms)),
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      symbol?: string;
      anchors?: string[]; // 주봉 앵커 3개 (YYYY-MM-DD) — 사용자 수동 고정
      space?: "linear" | "log";
    } | null;
    const symbol = body?.symbol?.trim().toUpperCase();
    if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      return NextResponse.json({ error: "invalid symbol" }, { status: 400 });
    }

    const [daily, weekly, snap, finnhub] = await Promise.all([
      fetchAlpacaBars(symbol, "1Day", 400, 400, "split"),
      fetchAlpacaBars(symbol, "1Week", 3650, 600, "split"),
      softly(getPrimarySnapshot(symbol)),
      isFinnhubEnabled() ? softly(getFinnhubBundle(symbol)) : Promise.resolve(null),
    ]);

    if (!daily || daily.length < 40) {
      return NextResponse.json(
        { error: "일봉 데이터가 부족해 기술분석을 할 수 없습니다 (최소 40봉)." },
        { status: 422 },
      );
    }

    const anchorDates =
      Array.isArray(body?.anchors) && body!.anchors!.length === 3 &&
      body!.anchors!.every((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
        ? ([body!.anchors![0], body!.anchors![1], body!.anchors![2]] as [string, string, string])
        : undefined;
    const space = body?.space === "linear" || body?.space === "log" ? body.space : undefined;
    const tech = analyzeTech(symbol, daily, weekly ?? [], { anchorDates, space });
    if (!tech) {
      return NextResponse.json({ error: "기술적 구조를 산출할 수 없습니다." }, { status: 422 });
    }

    const nextEarnings = finnhub?.nextEarnings ?? null;
    const prompt = buildPrompt(tech, snap?.session ?? null, nextEarnings);

    let ai: TechVerdict;
    try {
      ai = await generateTechView(prompt);
    } catch (e) {
      return NextResponse.json({ error: `AI 분석 실패: ${(e as Error).message}` }, { status: 503 });
    }

    return NextResponse.json({
      symbol,
      session: snap?.session ?? null,
      livePrice: snap?.lastPrice ?? null,
      earnings: nextEarnings
        ? { date: nextEarnings.date, daysUntil: nextEarnings.daysUntil }
        : null,
      tech,
      setupLabel: SETUP_META[tech.setup].label,
      ai,
      plan: coherentPlan(ai),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "techview failed" },
      { status: 500 },
    );
  }
}

function coherentPlan(ai: TechVerdict) {
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

function buildPrompt(
  t: TechAnalysis,
  session: string | null,
  earnings: { date: string; daysUntil: number } | null,
): string {
  const L: string[] = [];
  L.push(`# ${t.symbol} 기술적 분석 (갭 + 피보나치 + 주봉 고고저 빗각) — 한국어`);
  L.push("");
  L.push(
    "당신은 아래 '매물대 터치 매매법'을 쓰는 트레이더다. 기계적으로 계산된 사실만 신뢰하고, 그 위에 시나리오를 세워라.",
  );
  L.push("");
  L.push("## 이 매매법의 원칙 (반드시 이 틀로 판단)");
  L.push("1. 주봉 고고저 빗각(평행 채널) 라인이 가장 확실한 매물대다.");
  L.push("2. 갭하락 장대음봉 고점 → 이후 최저점으로 피보나치를 긋는다. **피보는 관찰 레벨**(0.618 중심) — 어디까지 눌렸는지 가늠용이고, 진입 트리거는 아니다.");
  L.push("3. **'밟아야 산다'** — **빗각 라인**을 실제로 터치(꼬리 포함)해야 진입 검토. 근접만으로는 사지 않고, 피보 터치만으로도 사지 않는다.");
  L.push("4. 터치 후 다음 캔들의 반응(양봉)이 확인이다. 확인 없으면 대기.");
  L.push("5. 목표는 **미충족 갭 구간** — 갭을 메우는 자리에서 정리(분할 매도).");
  L.push("6. 매크로/뉴스가 나쁘면 더 확실한 자리(빗각)를 밟을 때까지 기다린다.");
  L.push("7. **핵심 매수 패턴 = '위에서 아래로 밟기'** — 라인이 저항이었다가 상향 돌파된 뒤, 눌림으로 그 라인을 다시 밟을 때 매수한다. 돌파는 이미 일어났으므로 추격은 금지, 되돌림 터치를 기다린다.");
  L.push("8. 목표는 위쪽 rung 순서로 — **하프라인 먼저, 그다음 채널 상단**. 각 rung에서 기계적 분할 매도.");
  L.push("9. 고고저 채널 = 매수(지지) 도구, 저저고 채널 = 매도(저항) 도구. 저저고 라인은 목표/저항으로만 쓰고 매수 근거로 쓰지 않는다.");
  L.push("");
  L.push(`## 현재: ${t.price} (${session ?? "?"} 세션, 기준일 ${t.asOf})`);
  if (earnings) L.push(`- ⚠️ 다음 어닝 ${earnings.date} (D-${earnings.daysUntil})`);
  L.push(`- 기계적 셋업 판정: ${t.setup} (${SETUP_META[t.setup].label})`);
  L.push("");

  if (t.diagonal) {
    const d = t.diagonal;
    L.push(`## 주봉 ${d.kind} 빗각 채널 (로그공간, 1:1 복붙)`);
    L.push(
      `- 앵커: ${d.anchor1.ts}(${d.anchor1.price}) → ${d.anchor2.ts}(${d.anchor2.price}) 로 기울기, ${d.anchor3.ts}(${d.anchor3.price}) 로 평행`,
    );
    L.push(`- 채널폭 배수 ${d.widthRatio}× · 과거 이 채널 라인 터치 ${d.touchScore}회(시장이 실제로 존중한 횟수)`);
    L.push(`- 현재 라인값: ${d.lines.map((l) => `${l.label} ${l.price}`).join(" · ")}`);
    if (d.nearest)
      L.push(`- 가장 가까운 라인: ${d.nearest.label} ${d.nearest.price} (${d.nearest.distPct >= 0 ? "+" : ""}${d.nearest.distPct}%)`);
    if (d.manual) L.push("- ⭐ 이 채널은 사용자가 직접 고정한 앵커로 작도됨 (자동 탐색 아님)");
    L.push(`- 작도 공간: ${d.space === "log" ? "로그(등비율)" : "선형(등간격)"}`);
    L.push("- (빗각 앵커 선택은 작도자마다 다름 — 위 채널은 '과거 터치 횟수'로 고른 후보다. 절대가격이 아니라 구간으로 취급할 것)");
  } else {
    L.push("## 주봉 빗각: 산출 불가 (유효 채널 없음/데이터 부족)");
  }
  L.push("");

  if (t.resistChannel?.nearest) {
    const rc = t.resistChannel;
    L.push(
      `## 저저고(저항) 채널 — 목표/저항 참고: ${rc.nearest!.label} ${rc.nearest!.price} (${rc.nearest!.distPct >= 0 ? "+" : ""}${rc.nearest!.distPct}%) · 과거터치 ${rc.touchScore}회`,
    );
    L.push("");
  }

  if (t.fib) {
    const f = t.fib;
    L.push("## 피보나치 되돌림 (관찰 레벨 — 진입 근거로 쓰지 말 것)");
    L.push(
      `- 앵커: 고점 ${f.anchorHigh} (${f.anchorHighDate}${f.anchoredOnGap ? ", 갭하락 캔들" : ""}) → 저점 ${f.anchorLow} (${f.anchorLowDate})`,
    );
    L.push(`- 레벨: ${f.levels.map((l) => `${l.label}=${l.price}`).join(" · ")}`);
  }
  L.push("");

  if (t.gaps.length > 0) {
    L.push("## 갭 (최근순)");
    for (const g of t.gaps) {
      L.push(
        `- ${g.date} ${g.kind === "down" ? "갭하락" : "갭상승"} ${g.sizePct}% · 구간 ${g.bottom}~${g.top} · ${g.filledPct}% 메움${g.filled ? " (충족)" : " (미충족)"}`,
      );
    }
    if (t.targetGap)
      L.push(
        `- 🎯 목표 갭: ${t.targetGap.bottom}~${t.targetGap.top} (현재가 대비 ${t.targetUpsidePct}% 위)`,
      );
  }
  L.push("");

  if (t.touches.length > 0) {
    L.push("## 최근 터치 이벤트 (10봉 내)");
    for (const tc of t.touches) {
      L.push(
        `- ${tc.date} ${tc.level.label} ${tc.level.price} 터치 · 아래꼬리 ${(tc.wickRatio * 100).toFixed(0)}% · ${tc.confirmed ? "다음날 양봉 확인" : "확인 캔들 없음"} (${tc.barsAgo}봉 전)`,
      );
    }
  } else {
    L.push("## 최근 터치: 없음 (아직 라인을 밟지 않음)");
  }
  L.push("");

  L.push("## 출력 규칙 (JSON 스키마 준수)");
  L.push("- headline: 한 줄 결론 (예: '빗각 하단 밟고 확인 양봉 — 1차 진입 구간')");
  L.push("- summary: 2~4문장. 위 사실(라인값·피보·갭)을 숫자로 인용해 설명.");
  L.push(
    "- scenario: 지금 할 일. **터치 전이면 '아직 사지 말고 ○○ 라인(가격) 밟을 때까지 대기'로 명확히.** 터치+확인이면 분할 진입 조건을 제시.",
  );
  L.push("- entry_low~entry_high: 터치 매매 기준 진입 구간(핵심 라인 부근). 아직 대기면 '밟아야 할 그 라인' 구간을 넣어라.");
  L.push("- stop: 라인 이탈 시 손절 (라인 아래 또는 직전 저점 아래).");
  L.push("- target_1 / target_2: 1차는 가까운 저항/갭 하단, 2차는 갭 상단(갭 메움 완성).");
  L.push("- 숫자 순서 필수: stop < entry_low ≤ entry_high < target_1 ≤ target_2");
  L.push("- confidence 0~1. 터치 미발생/구조 불명확이면 낮게.");
  L.push("- cautions: 솔직한 리스크 2~4개 (어닝 임박, 갭 재확대, 빗각은 작도 방식에 따라 달라질 수 있음 등).");
  return L.join("\n");
}
