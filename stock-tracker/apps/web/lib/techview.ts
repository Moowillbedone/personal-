// Tech View — 기술적 분석 엔진 (갭 + 피보나치 되돌림 + 고고저 빗각 채널 + 터치 확인).
//
// Encodes the user's actual trading process (TSLA 2026-07~08 worked example):
//   1) 주봉에 고고저 빗각(평행 채널)을 그어 두고 그 라인을 핵심 매물대로 본다.
//   2) 갭하락 장대음봉의 고점 → 이후 최저점으로 피보나치를 긋고 0.382 / 0.618을 본다.
//   3) 되돌림 자리를 "꼬리로 밟으면" 유의미 — 다만 확실한 자리(빗각 라인)를 밟기 전엔 기다린다.
//   4) 빗각 라인을 실제로 밟고(터치) 지지 확인되면 진입.
//   5) 목표는 미충족 갭(gap) 구간 — 갭을 메우는 자리에서 정리.
//
// Everything here is DETERMINISTIC: same bars in → same levels/verdict out, so the
// scanner list and the per-ticker report agree and the whole thing is backtestable.
// The AI layer (api/techview) only narrates + weighs context on top of these facts.

import type { Bar } from "@/lib/indicators";

const round = (v: number, dp = 2): number => Number(v.toFixed(dp));

// ─── pivots ────────────────────────────────────────────────────────────────
export interface Pivot {
  idx: number;
  ts: string;
  price: number;
  kind: "high" | "low";
}

/**
 * Fractal pivots: a bar is a pivot high when its high is the strict max of the
 * ±k window (mirror for lows). `k` larger = fewer, more structural pivots.
 * The last k bars can't be confirmed as pivots yet (by construction) — that's
 * intentional: an unconfirmed pivot would repaint.
 */
export function findPivots(bars: Bar[], k = 3): Pivot[] {
  const out: Pivot[] = [];
  for (let i = k; i < bars.length - k; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (bars[j].h >= bars[i].h) isHigh = false;
      if (bars[j].l <= bars[i].l) isLow = false;
    }
    if (isHigh) out.push({ idx: i, ts: bars[i].ts, price: bars[i].h, kind: "high" });
    if (isLow) out.push({ idx: i, ts: bars[i].ts, price: bars[i].l, kind: "low" });
  }
  return out;
}

// ─── gaps ──────────────────────────────────────────────────────────────────
export interface GapZone {
  date: string;
  kind: "up" | "down";
  /** zone edges: for a gap down, top = prev close, bottom = gap-day open */
  top: number;
  bottom: number;
  sizePct: number; // |open − prevClose| / prevClose × 100
  barsAgo: number;
  /** 0..100 — how much of the zone price has traded back through since */
  filledPct: number;
  filled: boolean; // ≥95% retraced
}

const GAP_MIN_PCT = 1.5;

/**
 * Unfilled/partially-filled gaps in the recent window. A gap DOWN leaves an
 * overhead vacuum (prev close … gap open) that later acts as the natural
 * take-profit zone — exactly the 360~370 target in the user's TSLA trade.
 */
export function findGaps(bars: Bar[], lookback = 120): GapZone[] {
  const n = bars.length;
  const start = Math.max(1, n - lookback);
  const out: GapZone[] = [];
  for (let i = start; i < n; i++) {
    const prevClose = bars[i - 1].c;
    const open = bars[i].o;
    if (!(prevClose > 0)) continue;
    const sizePct = ((open - prevClose) / prevClose) * 100;
    if (Math.abs(sizePct) < GAP_MIN_PCT) continue;
    const kind: "up" | "down" = sizePct < 0 ? "down" : "up";
    const top = Math.max(prevClose, open);
    const bottom = Math.min(prevClose, open);
    const span = top - bottom;
    // How far back into the zone has price traded since the gap bar?
    let deepest = kind === "down" ? bottom : top;
    for (let j = i; j < n; j++) {
      if (kind === "down") deepest = Math.max(deepest, bars[j].h);
      else deepest = Math.min(deepest, bars[j].l);
    }
    const filledPct =
      span > 0
        ? Math.max(0, Math.min(100, ((kind === "down" ? deepest - bottom : top - deepest) / span) * 100))
        : 100;
    out.push({
      date: bars[i].ts.slice(0, 10),
      kind,
      top: round(top),
      bottom: round(bottom),
      sizePct: round(sizePct),
      barsAgo: n - 1 - i,
      filledPct: round(filledPct, 0),
      filled: filledPct >= 95,
    });
  }
  // Most recent first; unfilled gaps matter most.
  return out.reverse();
}

// ─── fibonacci retracement ─────────────────────────────────────────────────
export interface FibLevel {
  ratio: number;
  label: string;
  price: number;
}
export interface FibSetup {
  anchorHigh: number;
  anchorHighDate: string;
  anchorLow: number;
  anchorLowDate: string;
  /** true when the high anchor is the gap-down candle's high (user's method) */
  anchoredOnGap: boolean;
  levels: FibLevel[];
}

const FIB_RATIOS: [number, string][] = [
  [0.236, "0.236"],
  [0.382, "0.382"],
  [0.5, "0.5"],
  [0.618, "0.618"],
  [0.786, "0.786"],
];

/**
 * Retracement of the decline: high anchor = the gap-down candle's high when a
 * recent significant down gap exists (the user's exact anchoring), else the most
 * recent structural swing high; low anchor = the lowest low after it.
 */
export function buildFib(bars: Bar[], gaps: GapZone[], pivots: Pivot[]): FibSetup | null {
  const n = bars.length;
  if (n < 20) return null;

  let hiIdx = -1;
  let anchoredOnGap = false;
  const recentDownGap = gaps.find((g) => g.kind === "down" && g.barsAgo <= 90);
  if (recentDownGap) {
    hiIdx = n - 1 - recentDownGap.barsAgo;
    anchoredOnGap = true;
  } else {
    const highs = pivots.filter((p) => p.kind === "high");
    if (highs.length === 0) return null;
    hiIdx = highs[highs.length - 1].idx;
  }
  if (hiIdx < 0 || hiIdx >= n) return null;

  // The gap candle's own high is the anchor (it's the last price before the void).
  const anchorHigh = Math.max(bars[hiIdx].h, bars[Math.max(0, hiIdx - 1)].h);
  let loIdx = hiIdx;
  let anchorLow = bars[hiIdx].l;
  for (let j = hiIdx; j < n; j++) {
    if (bars[j].l < anchorLow) {
      anchorLow = bars[j].l;
      loIdx = j;
    }
  }
  const span = anchorHigh - anchorLow;
  if (!(span > 0)) return null;

  return {
    anchorHigh: round(anchorHigh),
    anchorHighDate: bars[hiIdx].ts.slice(0, 10),
    anchorLow: round(anchorLow),
    anchorLowDate: bars[loIdx].ts.slice(0, 10),
    anchoredOnGap,
    // Retracement UP from the low: 0.382 = shallow bounce, 0.618 = deep bounce.
    levels: FIB_RATIOS.map(([ratio, label]) => ({
      ratio,
      label,
      price: round(anchorLow + span * ratio),
    })),
  };
}

// ─── 고고저 빗각 (weekly diagonal channel) ──────────────────────────────────
export interface DiagonalChannel {
  /** price change per week along the line */
  slopePerWeek: number;
  /** the two highs that set the slope + the low that sets the parallel */
  anchorHigh1: { ts: string; price: number };
  anchorHigh2: { ts: string; price: number };
  anchorLow: { ts: string; price: number };
  /** channel width (vertical distance between the high-line and low-line) */
  width: number;
  /** every 1:1 channel line's value AT THE LATEST BAR, sorted desc */
  lines: { label: string; price: number }[];
  /** the single line closest to the current price (the one that matters now) */
  nearest: { label: string; price: number; distPct: number } | null;
}

/**
 * 고고저 빗각 — built from WEEKLY bars:
 *   ① 고, 고 : two structural pivot highs define the slope (the 빗각 itself)
 *   ② 저     : a pivot low between/after them gets a PARALLEL copy of that line
 *   ③ 1:1    : the high-line ↔ low-line distance is copied at equal (1:1)
 *              spacing above and below, forming the channel grid
 * Each line is evaluated at the latest bar, so "the line is at $332 today".
 *
 * NOTE on provenance: this is the standard parallel-trend-channel construction
 * that matches the user's description (weekly, high-high-low anchors, 1:1
 * spacing). It is NOT claimed to be a verbatim reproduction of any one
 * YouTuber's proprietary drawing rules.
 */
export function buildDiagonal(weekly: Bar[], lastPrice: number): DiagonalChannel | null {
  const n = weekly.length;
  if (n < 30) return null;
  const pivots = findPivots(weekly, 2);
  const highs = pivots.filter((p) => p.kind === "high");
  const lows = pivots.filter((p) => p.kind === "low");
  if (highs.length < 2 || lows.length < 1) return null;

  // Two most recent structural highs, far enough apart to define a real slope.
  let h2 = highs[highs.length - 1];
  let h1: Pivot | null = null;
  for (let i = highs.length - 2; i >= 0; i--) {
    if (h2.idx - highs[i].idx >= 6) {
      h1 = highs[i];
      break;
    }
  }
  if (!h1) h1 = highs[0];
  if (h1.idx === h2.idx) return null;

  const slope = (h2.price - h1.price) / (h2.idx - h1.idx); // per weekly bar
  const lastIdx = n - 1;

  // Parallel through the DEEPEST low relative to the line (the 저 anchor).
  let low = lows[0];
  let maxDev = -Infinity;
  for (const l of lows) {
    if (l.idx < h1.idx) continue; // only lows inside/after the leg
    const lineAt = h1.price + slope * (l.idx - h1.idx);
    const dev = lineAt - l.price; // how far below the line
    if (dev > maxDev) {
      maxDev = dev;
      low = l;
    }
  }
  const highLineNow = h1.price + slope * (lastIdx - h1.idx);
  const lowLineNow = low.price + slope * (lastIdx - low.idx);
  const width = Math.abs(highLineNow - lowLineNow);
  if (!(width > 0)) return null;

  // 1:1 channel grid: ±2 copies each way around the high/low pair.
  const base = Math.min(highLineNow, lowLineNow);
  const lines: { label: string; price: number }[] = [];
  for (let m = -2; m <= 3; m++) {
    const price = base + width * m;
    if (!(price > 0)) continue;
    const label =
      m === 0 ? "채널 하단(저)" : m === 1 ? "채널 상단(고)" : m > 1 ? `상단+${m - 1}` : `하단${m}`;
    lines.push({ label, price: round(price) });
  }
  lines.sort((a, b) => b.price - a.price);

  let nearest: DiagonalChannel["nearest"] = null;
  for (const l of lines) {
    const distPct = ((l.price - lastPrice) / lastPrice) * 100;
    if (!nearest || Math.abs(distPct) < Math.abs(nearest.distPct)) {
      nearest = { label: l.label, price: l.price, distPct: round(distPct) };
    }
  }

  return {
    slopePerWeek: round(slope, 3),
    anchorHigh1: { ts: h1.ts.slice(0, 10), price: round(h1.price) },
    anchorHigh2: { ts: h2.ts.slice(0, 10), price: round(h2.price) },
    anchorLow: { ts: low.ts.slice(0, 10), price: round(low.price) },
    width: round(width),
    lines,
    nearest,
  };
}

// ─── touch detection ("밟아야 산다") ────────────────────────────────────────
export interface KeyLevel {
  label: string;
  price: number;
  source: "diagonal" | "fib" | "gap";
}

export interface TouchEvent {
  level: KeyLevel;
  date: string;
  barsAgo: number;
  /** lower-wick share of the bar's range — a long tail = rejection/흡수 */
  wickRatio: number;
  /** the bar after the touch closed up (확인 캔들) */
  confirmed: boolean;
}

const TOUCH_BAND = 0.006; // 0.6% — "밟았다"로 인정하는 폭

/**
 * Did price actually STEP ON a key level in the recent window? A touch requires
 * the bar's range to straddle (or come within TOUCH_BAND of) the level — an
 * approach that never reaches it does NOT count, which is the whole discipline
 * the user applies ("확실하게 밟아야 산다").
 */
export function findTouches(bars: Bar[], levels: KeyLevel[], window = 10): TouchEvent[] {
  const n = bars.length;
  const out: TouchEvent[] = [];
  for (const lv of levels) {
    if (!(lv.price > 0)) continue;
    const band = lv.price * TOUCH_BAND;
    for (let i = Math.max(1, n - window); i < n; i++) {
      const b = bars[i];
      const touched = b.l - band <= lv.price && b.h + band >= lv.price;
      if (!touched) continue;
      const range = b.h - b.l;
      const lowerWick = Math.min(b.o, b.c) - b.l;
      const wickRatio = range > 0 ? lowerWick / range : 0;
      const next = i + 1 < n ? bars[i + 1] : null;
      out.push({
        level: lv,
        date: b.ts.slice(0, 10),
        barsAgo: n - 1 - i,
        wickRatio: round(wickRatio, 2),
        confirmed: !!next && next.c > next.o && next.c > b.c,
      });
    }
  }
  // Most recent touch first.
  out.sort((a, b) => a.barsAgo - b.barsAgo);
  return out;
}

// ─── overall setup ─────────────────────────────────────────────────────────
export type TechSetup =
  | "touch_confirmed" // 핵심 라인 터치 + 확인 캔들 → 진입 신호
  | "touch_pending" // 터치는 했으나 확인 캔들 아직 → 대기
  | "at_level" // 지금 라인 위 (밟는 중)
  | "approaching" // 라인 근접 (아직 안 밟음) → 관찰
  | "extended" // 라인에서 멀리 이탈 → 해당 없음
  | "no_structure"; // 빗각/피보 산출 불가

export interface TechAnalysis {
  symbol: string;
  price: number;
  asOf: string;
  gaps: GapZone[];
  targetGap: GapZone | null; // 미충족 갭 = 목표 구간
  fib: FibSetup | null;
  diagonal: DiagonalChannel | null;
  keyLevels: KeyLevel[];
  touches: TouchEvent[];
  setup: TechSetup;
  /** distance to the nearest key level, % (signed: + = level is above) */
  nearestDistPct: number | null;
  nearestLabel: string | null;
  /** upside to the target gap zone bottom, % */
  targetUpsidePct: number | null;
  notes: string[];
}

const NEAR_PCT = 3; // ±3% = 근접

export function analyzeTech(
  symbol: string,
  daily: Bar[],
  weekly: Bar[],
): TechAnalysis | null {
  if (daily.length < 40) return null;
  const price = daily[daily.length - 1].c;
  const asOf = daily[daily.length - 1].ts.slice(0, 10);

  const gaps = findGaps(daily, 150);
  const pivots = findPivots(daily, 3);
  const fib = buildFib(daily, gaps, pivots);
  const diagonal = buildDiagonal(weekly, price);

  // Key levels the user actually trades off.
  const keyLevels: KeyLevel[] = [];
  if (diagonal) {
    for (const l of diagonal.lines) {
      // Only lines within a sane distance are actionable.
      if (Math.abs((l.price - price) / price) <= 0.25) {
        keyLevels.push({ label: `빗각 ${l.label}`, price: l.price, source: "diagonal" });
      }
    }
  }
  if (fib) {
    for (const l of fib.levels) {
      if (l.ratio === 0.382 || l.ratio === 0.5 || l.ratio === 0.618) {
        keyLevels.push({ label: `피보 ${l.label}`, price: l.price, source: "fib" });
      }
    }
  }
  // Unfilled gap edges are both magnets and walls.
  const targetGap =
    gaps.find((g) => g.kind === "down" && !g.filled && g.top > price) ?? null;
  if (targetGap) {
    keyLevels.push({ label: "갭 하단(목표)", price: targetGap.bottom, source: "gap" });
    keyLevels.push({ label: "갭 상단(목표)", price: targetGap.top, source: "gap" });
  }

  const touches = findTouches(daily, keyLevels, 10);

  // Nearest actionable level (support-ish: diagonal/fib, not the target gap).
  let nearestDistPct: number | null = null;
  let nearestLabel: string | null = null;
  for (const lv of keyLevels) {
    if (lv.source === "gap") continue;
    const d = ((lv.price - price) / price) * 100;
    if (nearestDistPct == null || Math.abs(d) < Math.abs(nearestDistPct)) {
      nearestDistPct = round(d, 2);
      nearestLabel = lv.label;
    }
  }

  // Classify.
  let setup: TechSetup;
  const freshTouch = touches.find((t) => t.barsAgo <= 3 && t.level.source !== "gap");
  if (!diagonal && !fib) {
    setup = "no_structure";
  } else if (freshTouch && freshTouch.confirmed) {
    setup = "touch_confirmed";
  } else if (freshTouch) {
    setup = "touch_pending";
  } else if (nearestDistPct != null && Math.abs(nearestDistPct) <= 1) {
    setup = "at_level";
  } else if (nearestDistPct != null && Math.abs(nearestDistPct) <= NEAR_PCT) {
    setup = "approaching";
  } else {
    setup = "extended";
  }

  const notes: string[] = [];
  if (fib?.anchoredOnGap) {
    notes.push(
      `갭하락(${fib.anchorHighDate}) 고점 ${fib.anchorHigh} → 저점 ${fib.anchorLow} 기준 피보나치`,
    );
  }
  if (diagonal?.nearest) {
    notes.push(
      `주봉 빗각 ${diagonal.nearest.label} = ${diagonal.nearest.price} (${diagonal.nearest.distPct >= 0 ? "+" : ""}${diagonal.nearest.distPct}%)`,
    );
  }
  if (targetGap) {
    notes.push(
      `미충족 갭 ${targetGap.bottom}~${targetGap.top} (${targetGap.filledPct}% 메움) — 목표 구간`,
    );
  }
  if (freshTouch) {
    notes.push(
      `${freshTouch.date} ${freshTouch.level.label} 터치 (아래꼬리 ${(freshTouch.wickRatio * 100).toFixed(0)}%)${freshTouch.confirmed ? " + 확인 양봉" : " · 확인 대기"}`,
    );
  }

  const targetUpsidePct =
    targetGap && price > 0 ? round(((targetGap.bottom - price) / price) * 100, 1) : null;

  return {
    symbol,
    price: round(price),
    asOf,
    gaps: gaps.slice(0, 6),
    targetGap,
    fib,
    diagonal,
    keyLevels,
    touches: touches.slice(0, 6),
    setup,
    nearestDistPct,
    nearestLabel,
    targetUpsidePct,
    notes,
  };
}

export const SETUP_META: Record<TechSetup, { label: string; rank: number; buyable: boolean }> = {
  touch_confirmed: { label: "🎯 라인 터치 + 확인 — 진입 신호", rank: 0, buyable: true },
  touch_pending: { label: "🟡 터치함 · 확인 캔들 대기", rank: 1, buyable: false },
  at_level: { label: "🔵 라인 위 (밟는 중)", rank: 2, buyable: false },
  approaching: { label: "👀 라인 근접 — 관찰", rank: 3, buyable: false },
  extended: { label: "⚪ 라인에서 이탈", rank: 4, buyable: false },
  no_structure: { label: "⚪ 구조 산출 불가", rank: 5, buyable: false },
};
