// Mechanical 눌림목(pullback) engine — deterministic scoring of the 5 criteria,
// so the same chart always yields the same checklist (backtestable). Gemini
// (lib/gemini.ts generatePullback) then synthesizes the final read + narrative
// + plan on top of these facts, weighing context the chart can't show.
//
// The 5 criteria (0단계 = the precondition the user's framework was missing):
//   0. trend        — is there an UPTREND to pull back from? (price>50>200, rising)
//   1. volume        — dries on the dip (healthy) vs surges (real supply)
//   2. structure     — holds the prior higher-low; retrace depth (Fib)
//   3. support        — reacting at a confluence of meaningful levels
//   4. confirmation   — did the next candle actually react? (else WAIT)

import type { Bar } from "@/lib/indicators";
import { sma, atr } from "@/lib/indicators";
import type { PullbackClass } from "@/lib/gemini";

export type Grade = "pass" | "warn" | "fail";

export interface CriterionResult {
  grade: Grade;
  detail: string; // Korean, with the actual numbers
}

export interface SupportLevel {
  label: string;
  level: number;
  distPct: number; // (level − price) / price × 100; negative = below price
}

export interface PullbackPlan {
  entryLow: number;
  entryHigh: number;
  stop: number;
  target1: number;
  target2: number;
  rr: number | null; // reward:risk measured from entryHigh
}

export interface PullbackFacts {
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  atr14: number | null;
  swingHigh: number;
  swingHighAgo: number; // bars since the leg high
  legLow: number; // base of the advance into swingHigh (the higher-low to hold)
  pullbackLow: number; // lowest low since the swing high
  retracePct: number | null; // current position (close) in the up-leg, 0..1+
  retraceDepth: number | null; // deepest point of the dip (pullbackLow), 0..1+
  extended: boolean; // price above the prior swing high → breakout, not a pullback
  brokeLow: boolean; // pullback undercut legLow
  lowerHigh: boolean; // last peak < the peak before it
  volRatio: number | null; // pullback avg volume / 20d avg
  downUpVolRatio: number | null; // down-day vol / up-day vol during the pullback
  distributionDays: number; // high-volume down days DURING the pullback window
  supports: SupportLevel[];
  confluence: number; // # of supports clustered within the touch band
  nearestSupport: number | null;
  criteria: {
    trend: CriterionResult;
    volume: CriterionResult;
    structure: CriterionResult;
    support: CriterionResult;
    confirmation: CriterionResult;
  };
  classification: PullbackClass; // mechanical (Gemini may refine)
  plan: PullbackPlan | null;
}

const RECENT_WIN = 60; // ~3 months structural window
const SUPPORT_BAND = 0.03; // ±3% = "at" a level
const MIN_SWING_AGE = 2; // swing high must be ≥2 bars old (else it's a breakout, not a pullback)
const round = (v: number, dp = 2): number => Number(v.toFixed(dp));

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function argMaxHigh(bars: Bar[], from: number, to: number): { idx: number; val: number } {
  let idx = from;
  let val = -Infinity;
  for (let i = from; i <= to; i++) {
    if (bars[i].h > val) {
      val = bars[i].h;
      idx = i;
    }
  }
  return { idx, val };
}

function argMinLow(bars: Bar[], from: number, to: number): { idx: number; val: number } {
  let idx = from;
  let val = Infinity;
  for (let i = from; i <= to; i++) {
    if (bars[i].l < val) {
      val = bars[i].l;
      idx = i;
    }
  }
  return { idx, val };
}

export interface IchimokuLevels {
  spanA: number | null;
  spanB: number | null;
}

/**
 * Analyze the most-recent pullback structure on daily bars.
 * `ichi` optionally supplies the Ichimoku cloud edges (from the sma200 table)
 * so they count toward support confluence.
 * Returns null if there aren't enough bars to say anything.
 */
export function analyzePullback(bars: Bar[], ichi?: IchimokuLevels): PullbackFacts | null {
  const n = bars.length;
  if (n < 30) return null; // not enough to define a swing

  const closes = bars.map((b) => b.c);
  const price = closes[n - 1];
  if (!(price > 0)) return null;

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const atr14 = atr(bars, 14);

  // Rising-MA checks (slope over the last ~20 bars).
  const sma50Prev = sma(closes.slice(0, -20), 50);
  const sma200Prev = sma(closes.slice(0, -20), 200);
  const sma50Rising = sma50 != null && sma50Prev != null ? sma50 > sma50Prev : null;
  const sma200Rising =
    sma200 != null && sma200Prev != null ? sma200 >= sma200Prev : null;

  // ── swing structure over the recent window ────────────────────────────────
  // Exclude the most recent MIN_SWING_AGE bars so the swing high is a genuine
  // PRIOR peak — a pullback pulls back FROM a past high. A fresh new-high /
  // breakout day must not be scored as a shallow (retrace≈0) "healthy pullback".
  const start = Math.max(0, n - RECENT_WIN);
  const searchTo = Math.max(start, n - 1 - MIN_SWING_AGE);
  const high = argMaxHigh(bars, start, searchTo);
  const hIdx = high.idx;
  const swingHigh = high.val;
  // Price now ABOVE that prior peak = extended / breakout, not a pullback.
  const extended = price > swingHigh;
  // Base of the advance into that high (the higher-low to hold).
  const legStart = Math.max(0, hIdx - RECENT_WIN);
  const low = hIdx > legStart ? argMinLow(bars, legStart, hIdx) : { idx: hIdx, val: bars[hIdx].l };
  const lIdx = low.idx;
  const legLow = low.val;
  // Lowest low since the swing high = how deep the pullback actually went.
  const pullbackLow = argMinLow(bars, hIdx, n - 1).val;
  const swingHighAgo = n - 1 - hIdx;

  // Prior peak (before the leg base) → lower-high detection.
  let lowerHigh = false;
  if (lIdx - 1 >= 0) {
    const priorPeak = argMaxHigh(bars, Math.max(0, lIdx - RECENT_WIN), lIdx - 1);
    if (priorPeak.val > 0 && swingHigh < priorPeak.val * 0.999) lowerHigh = true;
  }

  const legRange = swingHigh - legLow;
  // retracePct = current position (close); retraceDepth = how deep the dip went
  // (to pullbackLow). Structure grading uses DEPTH so a V-recovery off a deep
  // dip isn't mislabeled "shallow healthy pullback".
  const retracePct = legRange > 0 ? (swingHigh - price) / legRange : null;
  const retraceDepth = legRange > 0 ? (swingHigh - pullbackLow) / legRange : null;
  const brokeLow = pullbackLow < legLow; // undercut the higher-low

  // ── volume behaviour during the pullback ──────────────────────────────────
  const vols = bars.map((b) => b.v);
  // Baseline = the ADVANCE's volume (~20 bars into the swing high), NOT a
  // trailing window that overlaps (and is diluted by) the pullback itself —
  // otherwise volRatio→1 and "volume dried" can never pass on longer pullbacks.
  const baseFrom = Math.max(0, hIdx - 20);
  const advVols = vols.slice(baseFrom, hIdx);
  const avgBase = advVols.length >= 5 ? mean(advVols) : mean(vols.slice(-21, -1));
  const pbFrom = hIdx + 1; // strictly AFTER the (past) swing high
  const pbBars = pbFrom < n ? bars.slice(pbFrom) : []; // empty → null metrics (not the peak bar)
  const pbVolAvg = mean(pbBars.map((b) => b.v));
  const volRatio =
    avgBase && pbVolAvg != null && avgBase > 0 ? pbVolAvg / avgBase : null;
  let upVol = 0;
  let downVol = 0;
  let upDays = 0;
  let downDays = 0;
  for (let i = pbFrom; i < n; i++) {
    if (bars[i].c >= bars[i].o) {
      upVol += bars[i].v;
      upDays++;
    } else {
      downVol += bars[i].v;
      downDays++;
    }
  }
  // Per-DAY intensity, not cumulative sums: a pullback naturally has more down
  // days than up days, so summed downVol>upVol even when each day's volume is
  // drying. Averaging removes that day-count bias → measures real selling force.
  const avgUp = upDays > 0 ? upVol / upDays : 0;
  const avgDown = downDays > 0 ? downVol / downDays : 0;
  const downUpVolRatio = avgUp > 0 ? avgDown / avgUp : avgDown > 0 ? Infinity : null;
  // Distribution days DURING THE PULLBACK (down ≥0.2% on higher volume than the
  // prior bar). Scoped to the dip — a fixed 25-bar window would count rally-era
  // down days and wrongly force a "downtrend" verdict on a healthy pullback.
  let distributionDays = 0;
  for (let i = Math.max(1, pbFrom); i < n; i++) {
    const chg = (bars[i].c - bars[i - 1].c) / bars[i - 1].c;
    if (chg <= -0.002 && bars[i].v > bars[i - 1].v) distributionDays++;
  }

  // ── support confluence near the current price ─────────────────────────────
  const cloudBottom =
    ichi?.spanA != null && ichi?.spanB != null
      ? Math.min(ichi.spanA, ichi.spanB)
      : ichi?.spanB ?? null;
  const cloudTop =
    ichi?.spanA != null && ichi?.spanB != null
      ? Math.max(ichi.spanA, ichi.spanB)
      : null;
  // Prior breakout / old resistance (the peak before the leg base) — now support.
  const priorBreakout =
    lIdx - 1 >= 0 ? argMaxHigh(bars, Math.max(0, lIdx - RECENT_WIN), lIdx - 1).val : null;
  const fib = (r: number) => (legRange > 0 ? swingHigh - legRange * r : null);
  const roundNum = Math.round(price / (price >= 100 ? 10 : price >= 20 ? 5 : 1)) *
    (price >= 100 ? 10 : price >= 20 ? 5 : 1);

  const candidates: Array<[string, number | null]> = [
    ["20일선", sma20],
    ["50일선", sma50],
    ["200일선", sma200],
    ["일목 스팬B", ichi?.spanB ?? null],
    ["구름하단", cloudBottom],
    ["구름상단", cloudTop],
    ["직전 저점", legLow],
    ["직전 돌파레벨", priorBreakout],
    ["피보 38.2%", fib(0.382)],
    ["피보 50%", fib(0.5)],
    ["피보 61.8%", fib(0.618)],
    ["라운드넘버", roundNum],
  ];
  // Only levels AT or BELOW price count as SUPPORT (allow +0.5% "sitting on it"
  // tolerance). Overhead levels within the band are resistance, not support,
  // and must not inflate the support grade.
  const supports: SupportLevel[] = [];
  for (const [label, lvl] of candidates) {
    if (lvl == null || !(lvl > 0)) continue;
    const distPct = ((lvl - price) / price) * 100;
    if (distPct <= 0.5 && distPct >= -SUPPORT_BAND * 100) {
      supports.push({ label, level: round(lvl), distPct: round(distPct) });
    }
  }
  supports.sort((a, b) => Math.abs(a.distPct) - Math.abs(b.distPct));
  const confluence = supports.length;
  const nearestSupport = supports.length > 0 ? supports[0].level : null;

  // ── confirmation from the last candle ─────────────────────────────────────
  const last = bars[n - 1];
  const prev = bars[n - 2];
  const range = last.h - last.l;
  const closePos = range > 0 ? (last.c - last.l) / range : 0.5; // 1=closed at high
  const bullishBar = last.c > last.o && closePos >= 0.55;
  const madeNewLow = last.l <= pullbackLow + 1e-9 && last.c < last.o;
  const higherLow = last.l > prev.l && last.c > prev.c; // turning up
  const reclaim20 = sma20 != null && prev.c < sma20 && last.c > sma20;
  let confirmGrade: Grade;
  let confirmDetail: string;
  if (bullishBar || reclaim20) {
    confirmGrade = "pass";
    confirmDetail = reclaim20
      ? "직전 캔들이 20일선을 회복(reclaim) — 반응 확인"
      : `양봉 반전(종가 위치 ${(closePos * 100).toFixed(0)}%) — 반응 확인`;
  } else if (madeNewLow) {
    confirmGrade = "fail";
    confirmDetail = "직전 캔들이 신저점 + 음봉 마감 — 아직 반응 없음(사지 마라)";
  } else if (higherLow) {
    confirmGrade = "warn";
    confirmDetail = "하락은 멈췄으나(저점 상승) 뚜렷한 반전 캔들은 아직 — 확인 대기";
  } else {
    confirmGrade = "warn";
    confirmDetail = "뚜렷한 반전 신호 없음 — 확인 캔들 대기";
  }

  // ── grade each criterion ──────────────────────────────────────────────────
  // 0. Trend
  const aligned = sma50 != null && sma200 != null && price > sma50 && sma50 > sma200;
  const aboveLong = sma200 != null && price > sma200;
  let trendGrade: Grade;
  let trendDetail: string;
  if (aligned && sma50Rising !== false && sma200Rising !== false) {
    trendGrade = "pass";
    trendDetail = "가격>50선>200선 정배열 + 이평선 상승 — 상승추세 확인";
  } else if (aboveLong && !lowerHigh) {
    trendGrade = "warn";
    trendDetail = "200선 위지만 정배열 미완성/기울기 약함 — 추세 약함";
  } else if (sma200 == null) {
    // Insufficient history (<200 bars, e.g. a recent IPO like SPCX) is NOT a
    // confirmed downtrend — fall back to the 50-day read so a short-history
    // uptrend isn't force-classified "no_uptrend". Structure/volume still guard.
    if (sma50 != null && price > sma50 && sma50Rising !== false) {
      trendGrade = "warn";
      trendDetail = "200일선 산출 불가(데이터 부족) — 50일선 기준 잠정 상승, 장기추세 미확인";
    } else {
      trendGrade = "warn";
      trendDetail = "200일선 산출 불가(데이터 부족) — 추세 판단 보류";
    }
  } else {
    trendGrade = "fail";
    trendDetail = "200선 아래 또는 고점 낮아짐 — 상승추세 아님(눌림 아님)";
  }

  // 1. Volume
  let volGrade: Grade;
  let volDetail: string;
  const vr = volRatio;
  const du = downUpVolRatio ?? 0;
  const duText = downUpVolRatio == null ? "?" : isFinite(du) ? du.toFixed(2) : "∞";
  if (vr != null && vr <= 0.9 && distributionDays <= 1 && du <= 1.2) {
    volGrade = "pass";
    volDetail = `조정 거래량 상승구간의 ${vr.toFixed(2)}배로 마름 · 조정중 분산일 ${distributionDays} · 하락/상승거래량 ${duText} — 매도압력 약함`;
  } else if ((vr != null && vr >= 1.3 && du > 1.5) || (distributionDays >= 3 && du > 1.2)) {
    volGrade = "fail";
    const spiked = vr != null && vr >= 1.3;
    const vrText = vr == null ? "?" : vr.toFixed(2);
    volDetail = spiked
      ? `조정 거래량 상승구간의 ${vrText}배로 붙음 · 조정중 분산일 ${distributionDays} · 하락거래량 우위(${duText}) — 실제 매도세(하락 의심)`
      : `조정 거래량은 ${vrText}배(마르긴 함)이나 분산일 ${distributionDays} + 하락일 거래강도 우위(${duText}) — 매도세 우위(하락 의심)`;
  } else {
    volGrade = "warn";
    volDetail = `거래량 중립 (${vr == null ? "?" : vr.toFixed(2)}배, 조정중 분산일 ${distributionDays}) — 애매`;
  }

  // 2. Structure
  let structGrade: Grade;
  let structDetail: string;
  const rd = retraceDepth;
  if (extended) {
    structGrade = "warn";
    structDetail = `현재가가 직전 고점(${round(swingHigh)}) 위 — 신고가/돌파 구간, 눌림 아님(되돌림 대기)`;
  } else if (brokeLow || (lowerHigh && (rd ?? 0) > 0.9)) {
    structGrade = "fail";
    structDetail = brokeLow
      ? `직전 저점(${round(legLow)}) 이탈 — 고점·저점 낮아짐 구조(추세 전환)`
      : "고점 낮아짐 + 깊은 되돌림 — 구조 훼손";
  } else if (rd != null && rd <= 0.618) {
    structGrade = "pass";
    structDetail = `직전 저점(${round(legLow)}) 유지 · 되돌림 깊이 ${(rd * 100).toFixed(0)}% (≤61.8%) — 건강한 눌림`;
  } else if (rd != null && rd <= 1.0) {
    structGrade = "warn";
    structDetail = `저점은 유지하나 되돌림 깊이 ${(rd * 100).toFixed(0)}% (>61.8%) — 다소 깊음, 주의`;
  } else {
    structGrade = "warn";
    structDetail = "되돌림 깊이 불명확 — 저점 유지 여부로 판단";
  }

  // 3. Support
  let supGrade: Grade;
  let supDetail: string;
  if (confluence >= 2) {
    supGrade = "pass";
    supDetail = `현재가 -3%~+0.5% 내 지지 ${confluence}개 밀집: ${supports.slice(0, 4).map((s) => s.label).join(", ")} — 의미있는 자리`;
  } else if (confluence === 1) {
    supGrade = "warn";
    supDetail = `지지 1개(${supports[0].label}) 근접 — 밀집 약함`;
  } else {
    supGrade = "fail";
    supDetail = "현재가 근처 의미있는 지지 없음 — 받쳐줄 자리 부재";
  }

  const criteria = {
    trend: { grade: trendGrade, detail: trendDetail },
    volume: { grade: volGrade, detail: volDetail },
    structure: { grade: structGrade, detail: structDetail },
    support: { grade: supGrade, detail: supDetail },
    confirmation: { grade: confirmGrade, detail: confirmDetail },
  };

  // ── mechanical classification ─────────────────────────────────────────────
  let classification: PullbackClass;
  if (trendGrade === "fail") {
    classification = "no_uptrend";
  } else if (extended) {
    // 신고가/돌파 구간 — 눌림도 하락도 아님, 되돌림 대기. Must precede the
    // downtrend branch: a post-high spike day could otherwise fail volume and
    // mislabel a new-high stock as a downtrend.
    classification = "forming";
  } else if (structGrade === "fail" || volGrade === "fail") {
    classification = "downtrend";
  } else if (
    confirmGrade === "pass" &&
    supGrade !== "fail" &&
    structGrade === "pass"
  ) {
    classification = "pullback";
  } else {
    classification = "forming";
  }

  // ── mechanical entry/stop/target baseline ─────────────────────────────────
  let plan: PullbackPlan | null = null;
  if (atr14 != null && atr14 > 0 && swingHigh > 0) {
    const supp = nearestSupport ?? price - atr14;
    const entryLow = Math.min(supp, price);
    const entryHigh = price;
    // Stop below the structural invalidation: the deeper of legLow / pullbackLow, minus a buffer.
    const stop = Math.min(legLow, pullbackLow) - 0.5 * atr14;
    const target1 = swingHigh; // retest the leg high
    const target2 = swingHigh + legRange * 0.5; // measured-move extension
    const risk = entryHigh - stop;
    const rr = risk > 0 ? (target1 - entryHigh) / risk : null;
    if (stop < entryLow && entryLow <= entryHigh && entryHigh < target1) {
      plan = {
        entryLow: round(entryLow),
        entryHigh: round(entryHigh),
        stop: round(stop),
        target1: round(target1),
        target2: round(target2),
        rr: rr != null ? round(rr, 2) : null,
      };
    }
  }

  return {
    price: round(price),
    sma20: sma20 != null ? round(sma20) : null,
    sma50: sma50 != null ? round(sma50) : null,
    sma200: sma200 != null ? round(sma200) : null,
    atr14: atr14 != null ? round(atr14) : null,
    swingHigh: round(swingHigh),
    swingHighAgo,
    legLow: round(legLow),
    pullbackLow: round(pullbackLow),
    retracePct: retracePct != null ? round(retracePct, 3) : null,
    retraceDepth: retraceDepth != null ? round(retraceDepth, 3) : null,
    extended,
    brokeLow,
    lowerHigh,
    volRatio: volRatio != null ? round(volRatio, 2) : null,
    downUpVolRatio:
      downUpVolRatio != null && isFinite(downUpVolRatio) ? round(downUpVolRatio, 2) : null,
    distributionDays,
    supports,
    confluence,
    nearestSupport: nearestSupport != null ? round(nearestSupport) : null,
    criteria,
    classification,
    plan,
  };
}
