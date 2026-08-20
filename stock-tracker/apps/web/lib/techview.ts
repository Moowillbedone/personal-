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

// ─── 고고저 / 저저고 빗각 채널 (weekly, LOG space) ─────────────────────────
export interface DiagonalChannel {
  /** 고고저 = 매수(지지) 채널 · 저저고 = 매도(저항) 채널 */
  kind: "고고저" | "저저고";
  slopeLogPerWeek: number;
  anchor1: { ts: string; price: number };
  anchor2: { ts: string; price: number };
  anchor3: { ts: string; price: number };
  /** linear = 등간격(가격), log = 등비율. 사용자 TSLA 채널은 linear에서 재현됨 */
  space: "linear" | "log";
  /** 채널 폭 (linear=가격 차, log=배수) */
  widthRatio: number;
  /** 사용자가 앵커를 직접 지정한 채널인지 */
  manual: boolean;
  /** 1:1 rung + 하프라인, 최신 봉에서 평가한 값 (내림차순) */
  lines: { label: string; price: number; half: boolean }[];
  nearest: { label: string; price: number; distPct: number } | null;
  /** 과거에 이 채널 라인을 실제로 맞은 주봉 수 (작도 검증) */
  touchScore: number;
  /** 터치수 ÷ 가격범위 안에 든 rung 수 — rung 밀도 보정 점수 */
  touchScoreNorm: number;
  /**
   * 반응률 — 라인을 터치한 뒤 4주 내 기대방향(지지=위/저항=아래)으로 3% 이상
   * 움직인 비율. 채널 선택의 주 기준. 터치 "횟수"는 rung이 촘촘한 채널이 유리해
   * 공정하지 않은데(선형 213회 vs 로그 96회는 밀도 차이였다), 반응률은 밀도와
   * 무관하게 "그 라인을 시장이 실제로 존중했는가"를 측정한다.
   */
  reactionRate: number;
  reactionSample: number;
}

const LOG_BAND = 0.012; // ±1.2% — 주봉에서 라인을 "맞았다"고 볼 폭
// Rungs: 1:1 채널을 위아래로 이어붙이고, 그 절반(하프채널)까지. 사용자 기준
// "1:1 비율로 이어붙이면 계속 채널이 생기고, 그 1/2를 쪼개면 하프채널".
const K_STEPS = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3];
const MIN_PAIR_SEP = 10; // 앵커 두 개는 최소 10주 떨어져야 기울기가 의미 있음
const TOP_PIVOTS = 14; // "역사적 의미"가 큰 피벗만 앵커 후보로
const MAX_WIDTH_RATIO = 3.0; // 로그폭 상한 (장기 채널은 넓을 수 있음)
const MAX_NEAR_PCT = 12; // 어떤 rung도 이보다 멀면 지금 볼 채널이 아님

function rungLabel(k: number, kind: "고고저" | "저저고"): string {
  if (k === 0) return kind === "고고저" ? "빗각(고-고)" : "빗각(저-저)";
  if (k === 1) return "채널 반대선";
  const half = !Number.isInteger(k);
  const n = k > 0 ? k : k;
  return `${half ? "하프" : "채널"}${n > 0 ? "+" : ""}${n}`;
}

/**
 * "역사적 의미가 있는" 피벗만 남긴다. 사용자 기준: 코로나/리먼 같은 대형 변곡점,
 * 급등 직전/직후의 변곡점 = 되돌림 폭(prominence)이 큰 자리. 폭이 큰 순으로
 * 상위 TOP_PIVOTS개만 앵커 후보로 써서, 잔챙이 스윙이 앵커가 되는 걸 막는다.
 */
function significantPivots(bars: Bar[], k = 4): Pivot[] {
  const pv = findPivots(bars, k);
  const scored = pv.map((p) => {
    const from = Math.max(0, p.idx - 26);
    const to = Math.min(bars.length - 1, p.idx + 26);
    let opp = p.kind === "high" ? Infinity : -Infinity;
    for (let i = from; i <= to; i++) {
      if (p.kind === "high") opp = Math.min(opp, bars[i].l);
      else opp = Math.max(opp, bars[i].h);
    }
    // prominence = 반대편 극단까지의 로그 거리 (되돌림 크기)
    const prom = Math.abs(Math.log(p.price) - Math.log(opp > 0 ? opp : p.price));
    return { p, prom };
  });
  scored.sort((a, b) => b.prom - a.prom);
  return scored
    .slice(0, TOP_PIVOTS)
    .map((x) => x.p)
    .sort((a, b) => a.idx - b.idx);
}

/**
 * 빗각 채널 (주봉·로그).
 *   ① 같은 종류 피벗 2개(고-고 또는 저-저)로 기울기 = 빗각 본선
 *   ② 세 번째 앵커: 본선에서 가장 많이 벗어난 "의미있는 변곡점" — 상승장에서는
 *      본선 위의 신고점이, 하락장에서는 본선 아래의 저점이 잡힌다. (사용자 TSLA
 *      예시의 세 번째 앵커 2020-08-31도 당시 신고점이었다.)
 *   ③ 그 폭을 1:1로 위아래 무한히 이어붙이고, 절반 지점에 하프라인.
 * 앵커 선택은 원래 주관적이라, 후보를 열거해 "과거에 실제로 라인을 맞은 횟수"가
 * 가장 많은 채널을 고른다(작도 검증). 최신성 제한은 두지 않는다 — 사용자의 TSLA
 * 앵커가 2020년 코로나 고점이었듯, 오래된 앵커일수록 오히려 의미가 크다.
 */
export interface DiagonalOpts {
  /** 앵커 직접 지정 (주봉 날짜 YYYY-MM-DD 3개) */
  anchorDates?: [string, string, string];
  space?: "linear" | "log";
}

/** 한 조합(앵커3 + 공간)으로 채널을 만든다. */
function makeChannel(
  weekly: Bar[],
  lastPrice: number,
  kind: "고고저" | "저저고",
  i1: number,
  i2: number,
  i3: number,
  space: "linear" | "log",
  manual: boolean,
): DiagonalChannel | null {
  const n = weekly.length;
  const lastIdx = n - 1;
  const pick = (i: number) => (kind === "고고저" ? weekly[i].h : weekly[i].l);
  const p1 = pick(i1);
  const p2 = pick(i2);
  // 세 번째 앵커는 본선에서 벗어난 쪽 극단을 쓴다 (상승장이면 고점, 하락장이면 저점).
  const y = (v: number) => (space === "log" ? Math.log(v) : v);
  const iy = (v: number) => (space === "log" ? Math.exp(v) : v);
  if (!(p1 > 0) || !(p2 > 0)) return null;
  const m = (y(p2) - y(p1)) / (i2 - i1);
  const lineAt3 = y(p1) + m * (i3 - i1);
  const cand3 = [weekly[i3].h, weekly[i3].l];
  let p3 = cand3[0];
  let d = y(cand3[0]) - lineAt3;
  for (const c of cand3) {
    const dv = y(c) - lineAt3;
    if (Math.abs(dv) > Math.abs(d)) {
      d = dv;
      p3 = c;
    }
  }
  if (d === 0) return null;
  if (space === "log" && Math.exp(Math.abs(d)) > 4) return null;

  const baseNow = y(p1) + m * (lastIdx - i1);
  const lines: { label: string; price: number; half: boolean }[] = [];
  for (const k of K_STEPS) {
    const price = iy(baseNow + d * k);
    if (!isFinite(price) || price <= 0) continue;
    lines.push({ label: rungLabel(k, kind), price: round(price), half: !Number.isInteger(k) });
  }
  if (lines.length === 0) return null;
  lines.sort((a, b) => b.price - a.price);

  // 작도 검증: rung을 실제로 맞은 주봉 수 + 가격범위에 든 rung 수로 정규화
  let touchScore = 0;
  const inRange = new Set<number>();
  const FWD = 4; // 반응 관찰 기간(주)
  const MOVE = 0.03; // 3% 이상 움직이면 "반응"
  let reacted = 0;
  let sample = 0;
  for (let b = i2 + 1; b <= lastIdx; b++) {
    const lo = weekly[b].l;
    const hi = weekly[b].h;
    let hitV: number | null = null;
    for (const k of K_STEPS) {
      const v = iy(y(p1) + m * (b - i1) + d * k);
      if (!(v > 0)) continue;
      if (lo * 0.8 <= v && v <= hi * 1.2) inRange.add(k);
      if (hitV == null && lo * (1 - LOG_BAND) <= v && v <= hi * (1 + LOG_BAND)) hitV = v;
    }
    if (hitV == null) continue;
    touchScore++;
    // 접근 방향으로 기대 반응을 정하고 이후 4주 실제 움직임을 본다.
    if (b + FWD <= lastIdx) {
      const prev = weekly[Math.max(0, b - 2)].c;
      const fwd = weekly.slice(b + 1, b + 1 + FWD).map((x) => x.c);
      if (fwd.length > 0) {
        const mv =
          prev > hitV
            ? (Math.max(...fwd) - hitV) / hitV // 지지 기대 → 위로
            : (hitV - Math.min(...fwd)) / hitV; // 저항 기대 → 아래로
        sample++;
        if (mv >= MOVE) reacted++;
      }
    }
  }
  const touchScoreNorm = Number((touchScore / Math.max(1, inRange.size)).toFixed(1));
  const reactionRate = sample > 0 ? Number(((reacted / sample) * 100).toFixed(1)) : 0;

  let nearest: DiagonalChannel["nearest"] = null;
  for (const l of lines) {
    const distPct = ((l.price - lastPrice) / lastPrice) * 100;
    if (!nearest || Math.abs(distPct) < Math.abs(nearest.distPct)) {
      nearest = { label: l.label, price: l.price, distPct: round(distPct) };
    }
  }
  if (!nearest) return null;
  if (!manual && Math.abs(nearest.distPct) > MAX_NEAR_PCT) return null;

  return {
    kind,
    space,
    manual,
    slopeLogPerWeek: Number(m.toFixed(5)),
    anchor1: { ts: weekly[i1].ts.slice(0, 10), price: round(p1) },
    anchor2: { ts: weekly[i2].ts.slice(0, 10), price: round(p2) },
    anchor3: { ts: weekly[i3].ts.slice(0, 10), price: round(p3) },
    widthRatio: Number((space === "log" ? Math.exp(Math.abs(d)) : Math.abs(d)).toFixed(4)),
    lines,
    nearest,
    touchScore,
    touchScoreNorm,
    reactionRate,
    reactionSample: sample,
  };
}

/**
 * 빗각 채널 (주봉). 앵커 선택이 주관적이므로 자동 모드는 후보를 열거해
 * "과거에 라인을 실제로 맞은 정도(정규화 점수)"가 가장 높은 채널을 고른다.
 * linear/log 두 공간을 모두 만들어 비교한다 — 리서치는 로그차트를 말하지만,
 * 사용자의 실제 TSLA 채널(2020-02-03/06-08/08-31, 흰색선 332)은 LINEAR에서만
 * 재현되고 검증 점수도 linear가 216 대 97로 압도적이었다.
 * anchorDates가 주어지면 그 앵커로만 만든다(사용자 수동 고정).
 */
export function buildDiagonal(
  weekly: Bar[],
  lastPrice: number,
  kind: "고고저" | "저저고",
  opts: DiagonalOpts = {},
): DiagonalChannel | null {
  const n = weekly.length;
  if (n < 60) return null;
  const spaces: ("linear" | "log")[] = opts.space ? [opts.space] : ["linear", "log"];

  // 수동 앵커: 지정한 날짜(또는 가장 가까운 주봉)로 고정
  if (opts.anchorDates) {
    const findIdx = (ds: string): number => {
      let best = -1;
      let bestDiff = Infinity;
      for (let i = 0; i < n; i++) {
        const diff = Math.abs(new Date(weekly[i].ts).getTime() - new Date(ds).getTime());
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      }
      return best;
    };
    const [a, b, c] = opts.anchorDates.map(findIdx);
    if (a < 0 || b < 0 || c < 0 || a === b) return null;
    const out: DiagonalChannel[] = [];
    for (const sp of spaces) {
      const ch = makeChannel(weekly, lastPrice, kind, Math.min(a, b), Math.max(a, b), c, sp, true);
      if (ch) out.push(ch);
    }
    out.sort((x, z) => z.reactionRate - x.reactionRate || z.touchScoreNorm - x.touchScoreNorm);
    return out[0] ?? null;
  }

  const sig = significantPivots(weekly, 4);
  const base = sig.filter((p) => (kind === "고고저" ? p.kind === "high" : p.kind === "low"));
  if (base.length < 2 || sig.length < 3) return null;
  const candidates: DiagonalChannel[] = [];
  for (let i = 1; i < base.length; i++) {
    for (let j = 0; j < i; j++) {
      if (base[i].idx - base[j].idx < MIN_PAIR_SEP) continue;
      // 세 번째 앵커 후보: 본선에서 가장 멀리 벗어난 의미있는 피벗
      for (const sp of spaces) {
        let bestThird = -1;
        let bestDev = 0;
        const yy = (v: number) => (sp === "log" ? Math.log(v) : v);
        const pk = (i2: number) => (kind === "고고저" ? weekly[i2].h : weekly[i2].l);
        const mm = (yy(pk(base[i].idx)) - yy(pk(base[j].idx))) / (base[i].idx - base[j].idx);
        for (const o of sig) {
          if (o.idx <= base[j].idx) continue;
          const lineY = yy(pk(base[j].idx)) + mm * (o.idx - base[j].idx);
          const gap = yy(o.price) - lineY;
          if (Math.abs(gap) > Math.abs(bestDev)) {
            bestDev = gap;
            bestThird = o.idx;
          }
        }
        if (bestThird < 0) continue;
        const ch = makeChannel(weekly, lastPrice, kind, base[j].idx, base[i].idx, bestThird, sp, false);
        if (ch) candidates.push(ch);
      }
    }
  }
  if (candidates.length === 0) return null;
  // 반응률 우선(표본 10 이상), 그다음 밀도보정 터치, 그다음 현재가 근접도.
  const scoreOf = (c: DiagonalChannel) => (c.reactionSample >= 10 ? c.reactionRate : 0);
  candidates.sort(
    (a, b) =>
      scoreOf(b) - scoreOf(a) ||
      b.touchScoreNorm - a.touchScoreNorm ||
      Math.abs(a.nearest?.distPct ?? 99) - Math.abs(b.nearest?.distPct ?? 99),
  );
  return candidates[0].touchScore >= 3 ? candidates[0] : null;
}

// ─── touch detection ("밟아야 산다") ────────────────────────────────────────
export interface KeyLevel {
  label: string;
  price: number;
  source: "diagonal" | "fib" | "gap";
  /**
   * Can a touch of this level TRIGGER a signal? 빗각(주봉 채널) 라인만 해당한다 —
   * 이 매매법이 실제로 사는 자리이고, 백테스트에서 유일하게 양(+)의 초과수익을
   * 낸 레벨이다. 피보/갭은 관찰·목표용으로 표시만 한다.
   */
  trigger: boolean;
  /**
   * PRIME = 단독 터치만으로도 최상위 신호가 되는 자리. 사용자 기준:
   * 현재는 빗각 라인만 prime = 트리거. 피보는 관찰 레벨(백테스트에서 피보 단독
   * 터치는 음의 초과수익). 피보 값은 화면·프롬프트에 계속 노출된다.
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
  /** 저저고 채널 — 저항/목표 참고용 (매수 트리거 아님) */
  resistChannel: DiagonalChannel | null;
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
  opts: DiagonalOpts = {},
): TechAnalysis | null {
  if (daily.length < 40) return null;
  const price = daily[daily.length - 1].c;
  const asOf = daily[daily.length - 1].ts.slice(0, 10);

  const gaps = findGaps(daily, 150);
  const pivots = findPivots(daily, 3);
  const fib = buildFib(daily, gaps, pivots);
  // 고고저 = 매수(지지) 채널 — 이게 진입 트리거. 저저고 = 매도(저항) 채널로
  // 목표/저항 참고용. 리서치 확인: 고-고는 long side 매커니즘, 저-저-고는 저항
  // 쪽 매커니즘 — 사용자가 저저고로 매수했을 때 승률이 낮았던 이유가 이것.
  const diagonal = buildDiagonal(weekly, price, "고고저", opts);
  // 저저고(저항)는 항상 자동 — 수동 앵커는 매수 채널에만 적용한다.
  const resistChannel = buildDiagonal(weekly, price, "저저고");

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
  if (resistChannel) {
    for (const l of resistChannel.lines) {
      if (l.price > price && Math.abs((l.price - price) / price) <= 0.25) {
        keyLevels.push({
          label: `저저고 ${l.label}`,
          price: l.price,
          source: "diagonal",
          trigger: false, // 저항/목표 — 매수 트리거 아님
          prime: false,
        });
      }
    }
  }
  if (fib) {
    for (const l of fib.levels) {
      // 피보는 **관찰 레벨** — 진입 트리거가 아니다 (사용자 결정, 2026-08-20).
      // 백테스트: 피보 단독 터치는 초과수익 −0.23/−0.47/−0.62%(5/10/20일)로 음(-),
      // 손절/목표 운용에서도 빗각(+1.09%/거래)의 절반(+0.56%). 빗각만 트리거로 둔다.
      if (l.ratio === 0.382 || l.ratio === 0.5 || l.ratio === 0.618 || l.ratio === 0.786) {
        keyLevels.push({
          label: `피보 ${l.label}`,
          price: l.price,
          source: "fib",
          trigger: false,
          prime: false,
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
  } else if (freshTouch && freshTouch.confirmed && freshTouch.level.prime) {
    // prime(빗각 / 피보 0.618) 터치 + 확인만 최상위. 겹침(confluence)은 승격
    // 조건에서 제외했다 — 백테스트(30종목·5년·워크포워드)에서 겹침이 많을수록
    // 오히려 20일 초과수익이 나빴다(겹침1 +1.45% vs 겹침4 −1.66%). 겹침이 몰리는
    // 자리는 대개 하락으로 레벨이 압축된 훼손 차트였다. 참고 수치로만 표시한다.
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
    resistChannel,
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
