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
  // The anchor is the 장대음봉 that STARTED the decline — i.e. the BIGGEST down
  // gap in the window, not merely the most recent one (a small −1.8% gap two
  // days ago would otherwise hijack the anchor and produce meaningless levels).
  const bigDownGap = gaps
    .filter((g) => g.kind === "down" && g.barsAgo <= 120 && Math.abs(g.sizePct) >= 3)
    .sort((a, b) => Math.abs(b.sizePct) - Math.abs(a.sizePct))[0];
  if (bigDownGap) {
    hiIdx = n - 1 - bigDownGap.barsAgo;
    anchoredOnGap = true;
  } else {
    const highs = pivots.filter((p) => p.kind === "high");
    if (highs.length === 0) return null;
    hiIdx = highs[highs.length - 1].idx;
  }
  if (hiIdx < 0 || hiIdx >= n) return null;

  // The GAP CANDLE'S OWN high is the anchor — verified against the user's own
  // TSLA chart (fib 1.0 = 342.11 = the 07-23 gap-down candle's high, NOT the
  // prior bar's high / prev close 374).
  const anchorHigh = bars[hiIdx].h;
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
  /** 고고저 (두 고점이 기울기, 저점이 평행) | 저저고 (두 저점이 기울기, 고점이 평행) */
  kind: "고고저" | "저저고";
  /** log-space slope per weekly bar (channels are drawn on a LOG chart) */
  slopeLogPerWeek: number;
  anchor1: { ts: string; price: number };
  anchor2: { ts: string; price: number };
  anchor3: { ts: string; price: number };
  /** channel width as a log-ratio; 1:1 copies are multiplicative in price */
  widthRatio: number;
  /** every 1:1 channel line's value AT THE LATEST BAR, sorted desc */
  lines: { label: string; price: number }[];
  /** the single line closest to the current price (the one that matters now) */
  nearest: { label: string; price: number; distPct: number } | null;
  /** how many times price historically touched any line of this channel */
  touchScore: number;
}

const LOG_BAND = 0.012; // ±1.2% — 주봉에서 라인을 "맞았다"고 볼 폭
// Rungs kept near price: a huge ±3 ladder trivially "touches" everything, which
// biased selection toward absurdly wide channels (TSLA picked a 2023-anchored
// 1.57× channel with rungs at $748~$1838). Narrow ladder + width cap + recency
// keeps the surfaced channel one a trader could actually act on.
const CH_MIN = -1;
const CH_MAX = 2;
const MAX_WIDTH_RATIO = 1.4; // 채널 폭 ≤ 40%
const MAX_ANCHOR_AGE = 156; // 두 번째 앵커는 최근 3년 이내
const TOUCH_WINDOW = 104; // 최근 2년 내 터치만 신뢰도로 인정
const MAX_NEAR_PCT = 10; // 어느 rung도 ±10% 밖이면 지금 볼 채널이 아님

function channelLabel(k: number, kind: "고고저" | "저저고"): string {
  // k=0 is the anchor-pair line (고-고 or 저-저), k=1 is the parallel through
  // the third anchor; the rest are the 1:1 복붙 rungs.
  if (k === 0) return kind === "고고저" ? "빗각(고-고)" : "빗각(저-저)";
  if (k === 1) return kind === "고고저" ? "평행(저)" : "평행(고)";
  return k > 1 ? `채널+${k - 1}` : `채널${k}`;
}

/**
 * 고고저/저저고 빗각 채널 — WEEKLY, LOG price space.
 *
 * Research (2026-08, third-party reconstructions of 인범 빗각 — no primary source
 * exists, practitioners explicitly disagree on anchor choice) converges on:
 *   · 로그차트에서 작도한다 (every step-by-step guide opens with this)
 *   · 3 anchors: 앞의 둘은 같은 종류(고,고 또는 저,저)로 기울기를 정하고,
 *     세 번째(반대 종류)는 평행선의 위치만 정한다 = TradingView 평행채널
 *   · 1:1 채널 = 같은 폭의 평행 복붙 (로그공간 등간격 → 가격은 배수)
 *   · 하락추세면 고-고(고고저), 상승추세면 저-저(저저고)
 *
 * Because anchor CHOICE is subjective ("사람마다 해석이 다름"), we do NOT pick
 * one arbitrarily: we enumerate candidate anchor pairs and keep the channel the
 * market has actually RESPECTED most (historical touch count) — a data-driven
 * tiebreak instead of a guess.
 */
export function buildDiagonal(weekly: Bar[], lastPrice: number): DiagonalChannel | null {
  const n = weekly.length;
  if (n < 30) return null;
  const pivots = findPivots(weekly, 3);
  const highs = pivots.filter((p) => p.kind === "high");
  const lows = pivots.filter((p) => p.kind === "low");
  const lastIdx = n - 1;
  const lnLast = Math.log(lastPrice);

  const candidates: DiagonalChannel[] = [];

  const build = (
    kind: "고고저" | "저저고",
    pair: Pivot[],
    others: Pivot[],
  ): void => {
    // Enumerate same-type anchor pairs (recent-biased, min 8 weeks apart).
    for (let i = pair.length - 1; i >= 1; i--) {
      for (let j = i - 1; j >= 0; j--) {
        const p2 = pair[i];
        const p1 = pair[j];
        if (p2.idx - p1.idx < 12) continue; // ≥3개월 떨어진 앵커만 (노이즈 기울기 배제)
        if (lastIdx - p2.idx > MAX_ANCHOR_AGE) continue; // 너무 오래된 채널은 지금 안 봄
        if (!(p1.price > 0) || !(p2.price > 0)) continue;
        const y1 = Math.log(p1.price);
        const y2 = Math.log(p2.price);
        const m = (y2 - y1) / (p2.idx - p1.idx); // log slope / week
        // Third anchor: the opposite-type pivot furthest from the base line
        // (that's the one the parallel actually has to reach).
        let third: Pivot | null = null;
        let maxDev = -Infinity;
        for (const o of others) {
          if (o.idx < p1.idx) continue;
          const lineY = y1 + m * (o.idx - p1.idx);
          const dev = kind === "고고저" ? lineY - Math.log(o.price) : Math.log(o.price) - lineY;
          if (dev > maxDev) {
            maxDev = dev;
            third = o;
          }
        }
        if (!third || !(maxDev > 0)) continue;

        const d = maxDev; // channel width in log space
        if (Math.exp(d) > MAX_WIDTH_RATIO) continue; // 지나치게 넓은 채널 배제
        const baseYNow = y1 + m * (lastIdx - p1.idx); // k=0 line at the last bar
        const dir = kind === "고고저" ? -1 : 1; // parallel sits below (고고저) / above (저저고)

        const lines: { label: string; price: number }[] = [];
        for (let k = CH_MIN; k <= CH_MAX; k++) {
          const price = Math.exp(baseYNow + dir * d * k);
          if (!isFinite(price) || price <= 0) continue;
          lines.push({ label: channelLabel(k, kind), price: round(price) });
        }
        if (lines.length === 0) continue;
        lines.sort((a, b) => b.price - a.price);

        // How often has price actually respected ANY rung of this channel?
        let touchScore = 0;
        const touchFrom = Math.max(p2.idx + 1, lastIdx - TOUCH_WINDOW);
        for (let b = touchFrom; b <= lastIdx; b++) {
          const yLo = Math.log(weekly[b].l);
          const yHi = Math.log(weekly[b].h);
          for (let k = CH_MIN; k <= CH_MAX; k++) {
            const yk = y1 + m * (b - p1.idx) + dir * d * k;
            if (yLo - LOG_BAND <= yk && yHi + LOG_BAND >= yk) {
              touchScore++;
              break; // one touch per bar
            }
          }
        }

        let nearest: DiagonalChannel["nearest"] = null;
        for (const l of lines) {
          const distPct = ((l.price - lastPrice) / lastPrice) * 100;
          if (!nearest || Math.abs(distPct) < Math.abs(nearest.distPct)) {
            nearest = { label: l.label, price: l.price, distPct: round(distPct) };
          }
        }
        // Ignore channels whose every rung is miles from price — not actionable.
        if (!nearest || Math.abs(nearest.distPct) > MAX_NEAR_PCT) continue;

        candidates.push({
          kind,
          slopeLogPerWeek: Number(m.toFixed(5)),
          anchor1: { ts: p1.ts.slice(0, 10), price: round(p1.price) },
          anchor2: { ts: p2.ts.slice(0, 10), price: round(p2.price) },
          anchor3: { ts: third.ts.slice(0, 10), price: round(third.price) },
          widthRatio: Number(Math.exp(d).toFixed(4)),
          lines,
          nearest,
          touchScore,
        });
      }
    }
  };

  if (highs.length >= 2 && lows.length >= 1) build("고고저", highs, lows);
  if (lows.length >= 2 && highs.length >= 1) build("저저고", lows, highs);
  if (candidates.length === 0) return null;

  // The channel the market has respected most; ties → the one closest to price.
  candidates.sort(
    (a, b) =>
      b.touchScore - a.touchScore ||
      Math.abs(a.nearest?.distPct ?? 99) - Math.abs(b.nearest?.distPct ?? 99),
  );
  // Sanity: a channel nobody ever touched is noise.
  return candidates[0].touchScore >= 2 ? candidates[0] : null;
}

// ─── touch detection ("밟아야 산다") ────────────────────────────────────────
export interface KeyLevel {
  label: string;
  price: number;
  source: "diagonal" | "fib" | "gap";
  /**
   * Can a touch of this level TRIGGER a signal? Only the levels this method
   * actually buys at: the 빗각 lines (가장 확실한 자리) and deep retracements
   * (0.618/0.786). Shallow 0.382/0.5 are displayed for context but do NOT
   * trigger — live scan showed 0.382 alone accounted for 57 of 172 "touches",
   * i.e. the shallow levels were drowning the list in noise.
   */
  trigger: boolean;
  /**
   * PRIME = 단독 터치만으로도 최상위 신호가 되는 자리. 사용자 기준:
   * 빗각 라인(가장 확실한 자리)과 피보 0.618("0.618만큼 중요한 수치는 없다").
   * 0.786은 trigger지만 prime은 아니라 겹침(confluence)이 있을 때 승격된다.
   */
  prime: boolean;
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
  /** key levels stacked within ±1.5% of the signal touch (겹친 자리 = 확신도) */
  touchConfluence: number;
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
        keyLevels.push({
          label: `빗각 ${l.label}`,
          price: l.price,
          source: "diagonal",
          trigger: true, // 빗각 = 가장 확실한 자리
          prime: true,
        });
      }
    }
  }
  if (fib) {
    for (const l of fib.levels) {
      // 0.618/0.786 = 깊은 되돌림(진입 트리거). 0.382/0.5 = 참고용.
      // (TSLA 사례에서 0.786=332.54가 빗각 라인과 겹친 자리였다.)
      if (l.ratio === 0.382 || l.ratio === 0.5 || l.ratio === 0.618 || l.ratio === 0.786) {
        keyLevels.push({
          label: `피보 ${l.label}`,
          price: l.price,
          source: "fib",
          trigger: l.ratio >= 0.618,
          prime: l.ratio === 0.618, // 피보의 핵심
        });
      }
    }
  }
  // Unfilled gap edges are both magnets and walls (목표 — 진입 트리거 아님).
  const targetGap =
    gaps.find((g) => g.kind === "down" && !g.filled && g.top > price) ?? null;
  if (targetGap) {
    keyLevels.push({ label: "갭 하단(목표)", price: targetGap.bottom, source: "gap", trigger: false, prime: false });
    keyLevels.push({ label: "갭 상단(목표)", price: targetGap.top, source: "gap", trigger: false, prime: false });
  }

  const touches = findTouches(daily, keyLevels, 10);

  // Nearest actionable level (support-ish: diagonal/fib, not the target gap).
  let nearestDistPct: number | null = null;
  let nearestLabel: string | null = null;
  for (const lv of keyLevels) {
    if (!lv.trigger) continue; // 근접/라인위 판정도 트리거 레벨 기준
    const d = ((lv.price - price) / price) * 100;
    if (nearestDistPct == null || Math.abs(d) < Math.abs(nearestDistPct)) {
      nearestDistPct = round(d, 2);
      nearestLabel = lv.label;
    }
  }

  // Classify. A touch only counts as a SIGNAL when it is on a trigger level
  // (빗각 / 깊은 피보) AND shows evidence of rejection — either a confirming
  // next candle or a meaningful lower wick. Without this, a 0.6% band across
  // ~8 levels over 10 bars marked 74% of the universe as "touched".
  let setup: TechSetup;
  const freshTouch = touches.find(
    (t) =>
      t.level.trigger &&
      t.barsAgo <= 3 &&
      (t.confirmed || t.wickRatio >= 0.2),
  );
  // Confluence = how many key levels stack within ±1.5% of the touched price.
  // This is the user's own conviction rule ("확실한 자리"): in the TSLA trade the
  // buy level had 피보 0.786 AND the unfilled gap bottom on top of each other.
  // A lone 0.618 touch is common (51/232 in the live scan); a 2+ stack is not.
  const confluenceAt = (p: number): number =>
    keyLevels.filter((lv) => Math.abs((lv.price - p) / p) <= 0.015).length;
  const touchConfluence = freshTouch ? confluenceAt(freshTouch.level.price) : 0;
  if (!diagonal && !fib) {
    setup = "no_structure";
  } else if (
    freshTouch &&
    freshTouch.confirmed &&
    (freshTouch.level.prime || touchConfluence >= 2)
  ) {
    // 빗각/0.618 단독이면 그것만으로 최상위, 그 외(0.786 등)는 겹침 2개 이상일 때
    setup = "touch_confirmed";
  } else if (freshTouch) {
    setup = "touch_pending"; // 밟았으나 확인 or 밀집 부족 → 대기
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
      `${freshTouch.date} ${freshTouch.level.label} 터치 (아래꼬리 ${(freshTouch.wickRatio * 100).toFixed(0)}%, 겹친 레벨 ${touchConfluence}개)${freshTouch.confirmed ? " + 확인 양봉" : " · 확인 대기"}`,
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
    touchConfluence,
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
