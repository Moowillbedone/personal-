/**
 * 퀀트 전략 엔진
 * 기술적 지표 계산 + 매매 시그널 생성
 * + 차트 기술적 분석 (고고저/저저고, 매물대, 엘리어트 파동, 삼각수렴)
 */

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  time: number;
  type: "buy" | "sell";
  price: number;
  reason: string;
  strength: "strong" | "medium" | "weak";
}

// ════════════════════════════════════════
// 기본 지표
// ════════════════════════════════════════

export function sma(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j];
      result.push(sum / period);
    }
  }
  return result;
}

export function ema(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[j];
      result.push(sum / period);
    } else {
      const prev = result[i - 1]!;
      result.push(data[i] * k + prev * (1 - k));
    }
  }
  return result;
}

// RSI (Wilder's Smoothing) - 수정: off-by-one 버그 해결
export function rsi(closes: number[], period: number = 14): (number | null)[] {
  if (closes.length < period + 1) return closes.map(() => null);
  const result: (number | null)[] = new Array(closes.length).fill(null);

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  // 첫 RSI: period개의 변화량 → closes[period] 인덱스
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period] = calcRsi(avgGain, avgLoss);

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    result[i + 1] = calcRsi(avgGain, avgLoss);
  }
  return result;
}

function calcRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// 볼린저 밴드 - 수정: 표본 표준편차(N-1) 사용
export function bollingerBands(
  closes: number[], period: number = 20, mult: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (middle[i] === null) {
      upper.push(null); lower.push(null);
    } else {
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += (closes[j] - middle[i]!) ** 2;
      }
      const std = Math.sqrt(sumSq / (period - 1)); // 표본 표준편차
      upper.push(middle[i]! + mult * std);
      lower.push(middle[i]! - mult * std);
    }
  }
  return { upper, middle, lower };
}

// MACD
export function macd(
  closes: number[], fast: number = 12, slow: number = 26, signal: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);

  const macdLine: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(emaFast[i]! - emaSlow[i]!);
    } else {
      macdLine.push(null);
    }
  }

  const validMacd = macdLine.filter((v) => v !== null) as number[];
  const signalLine = ema(validMacd, signal);

  const alignedSignal: (number | null)[] = [];
  let sIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      alignedSignal.push(null);
    } else {
      alignedSignal.push(signalLine[sIdx] ?? null);
      sIdx++;
    }
  }

  const histogram: (number | null)[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null && alignedSignal[i] !== null) {
      histogram.push(macdLine[i]! - alignedSignal[i]!);
    } else {
      histogram.push(null);
    }
  }

  return { macd: macdLine, signal: alignedSignal, histogram };
}

export function momentum(closes: number[], period: number = 20): (number | null)[] {
  return closes.map((c, i) => {
    if (i < period) return null;
    return ((c - closes[i - period]) / closes[i - period]) * 100;
  });
}

// ════════════════════════════════════════
// 차트 기술적 분석 지표
// ════════════════════════════════════════

// ATR (Average True Range)
export function atr(candles: OHLCV[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [null];
  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trueRanges.push(tr);
    if (i < period) {
      result.push(null);
    } else if (i === period) {
      result.push(trueRanges.reduce((a, b) => a + b, 0) / period);
    } else {
      result.push((result[i - 1]! * (period - 1) + tr) / period);
    }
  }
  return result;
}

// 스윙 고점/저점 검출
function findSwingPoints(candles: OHLCV[], lookback: number = 5): {
  swingHighs: { idx: number; price: number }[];
  swingLows: { idx: number; price: number }[];
} {
  const swingHighs: { idx: number; price: number }[] = [];
  const swingLows: { idx: number; price: number }[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) swingHighs.push({ idx: i, price: candles[i].high });
    if (isLow) swingLows.push({ idx: i, price: candles[i].low });
  }

  return { swingHighs, swingLows };
}

// 매물대 (Volume Profile) 분석
function volumeProfile(candles: OHLCV[], bins: number = 20): {
  levels: { price: number; volume: number; strength: number }[];
  poc: number; // Point of Control (최대거래량 가격)
} {
  if (candles.length === 0) return { levels: [], poc: 0 };
  const allHighs = candles.map(c => c.high);
  const allLows = candles.map(c => c.low);
  const maxPrice = Math.max(...allHighs);
  const minPrice = Math.min(...allLows);
  const step = (maxPrice - minPrice) / bins;
  if (step === 0) return { levels: [], poc: candles[0].close };

  const profile: number[] = new Array(bins).fill(0);

  for (const c of candles) {
    const lowBin = Math.max(0, Math.floor((c.low - minPrice) / step));
    const highBin = Math.min(bins - 1, Math.floor((c.high - minPrice) / step));
    const volumePerBin = c.volume / Math.max(1, highBin - lowBin + 1);
    for (let b = lowBin; b <= highBin; b++) {
      profile[b] += volumePerBin;
    }
  }

  const maxVol = Math.max(...profile);
  const levels = profile.map((vol, i) => ({
    price: minPrice + (i + 0.5) * step,
    volume: vol,
    strength: maxVol > 0 ? vol / maxVol : 0,
  }));

  const pocIdx = profile.indexOf(maxVol);
  const poc = minPrice + (pocIdx + 0.5) * step;

  return { levels, poc };
}

// ════════════════════════════════════════
// 전략 정의
// ════════════════════════════════════════

export interface Strategy {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  color: string;
  category: "classic" | "chart-pattern";
  params: StrategyParam[];
}

export interface StrategyParam {
  key: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
}

export const STRATEGIES: Strategy[] = [
  // ── 클래식 전략 ──
  {
    id: "golden-cross", name: "골든크로스/데드크로스", nameEn: "Golden Cross",
    description: "단기 이동평균선이 장기 이동평균선을 상향 돌파하면 매수, 하향 돌파하면 매도하는 추세 추종 전략",
    icon: "X", color: "#f59e0b", category: "classic",
    params: [
      { key: "shortPeriod", label: "단기 MA", defaultValue: 5, min: 3, max: 20, step: 1 },
      { key: "longPeriod", label: "장기 MA", defaultValue: 20, min: 10, max: 60, step: 5 },
    ],
  },
  {
    id: "rsi-reversal", name: "RSI 과매수/과매도", nameEn: "RSI Reversal",
    description: "RSI가 과매도 구간(30 이하)에서 매수, 과매수 구간(70 이상)에서 매도하는 역추세 전략",
    icon: "R", color: "#8b5cf6", category: "classic",
    params: [
      { key: "period", label: "RSI 기간", defaultValue: 14, min: 7, max: 28, step: 1 },
      { key: "oversold", label: "과매도", defaultValue: 30, min: 15, max: 40, step: 5 },
      { key: "overbought", label: "과매수", defaultValue: 70, min: 60, max: 85, step: 5 },
    ],
  },
  {
    id: "bollinger-revert", name: "볼린저밴드 회귀", nameEn: "Bollinger Reversion",
    description: "가격이 하단밴드에 닿으면 매수, 상단밴드에 닿으면 매도하는 평균 회귀 전략",
    icon: "B", color: "#06b6d4", category: "classic",
    params: [
      { key: "period", label: "BB 기간", defaultValue: 20, min: 10, max: 30, step: 5 },
      { key: "stdDev", label: "표준편차", defaultValue: 2, min: 1, max: 3, step: 0.5 },
    ],
  },
  {
    id: "macd-cross", name: "MACD 크로스", nameEn: "MACD Crossover",
    description: "MACD 라인이 시그널 라인을 상향 돌파하면 매수, 하향 돌파하면 매도",
    icon: "M", color: "#22c55e", category: "classic",
    params: [
      { key: "fast", label: "Fast EMA", defaultValue: 12, min: 5, max: 20, step: 1 },
      { key: "slow", label: "Slow EMA", defaultValue: 26, min: 20, max: 50, step: 1 },
      { key: "signal", label: "Signal", defaultValue: 9, min: 5, max: 15, step: 1 },
    ],
  },
  {
    id: "dual-momentum", name: "듀얼 모멘텀", nameEn: "Dual Momentum",
    description: "절대 모멘텀(양수 수익률)과 상대 모멘텀을 결합하여 수익성과 안정성을 동시에 추구",
    icon: "D", color: "#ef4444", category: "classic",
    params: [
      { key: "lookback", label: "관측 기간(일)", defaultValue: 60, min: 20, max: 120, step: 10 },
      { key: "threshold", label: "절대 모멘텀 기준(%)", defaultValue: 0, min: -5, max: 5, step: 1 },
    ],
  },
  // ── 차트 패턴 분석 전략 ──
  {
    id: "hh-ll", name: "고고저/저저고 (HH/LL)", nameEn: "Higher Highs & Lower Lows",
    description: "고점이 높아지고 저점이 높아지면 상승추세(매수), 고점이 낮아지고 저점이 낮아지면 하락추세(매도). 추세 전환의 핵심 패턴",
    icon: "↗", color: "#10b981", category: "chart-pattern",
    params: [
      { key: "lookback", label: "스윙 검출 봉수", defaultValue: 5, min: 3, max: 10, step: 1 },
    ],
  },
  {
    id: "volume-profile", name: "매물대 분석", nameEn: "Volume Profile",
    description: "거래량이 집중된 가격대(매물대)를 분석. 매물대 하단 지지 매수, 매물대 상단 돌파 매수. POC(최대거래량가격) 기반 전략",
    icon: "V", color: "#f97316", category: "chart-pattern",
    params: [
      { key: "bins", label: "매물대 구간수", defaultValue: 20, min: 10, max: 40, step: 5 },
      { key: "period", label: "분석 기간(봉)", defaultValue: 60, min: 20, max: 120, step: 10 },
    ],
  },
  {
    id: "elliott-wave", name: "엘리어트 파동", nameEn: "Elliott Wave",
    description: "파동이론 기반 분석. 5파 충격파동 완료 후 조정파동 매도, 조정 A-B-C 완료 후 새로운 충격파 매수. 파동 카운팅 자동화",
    icon: "W", color: "#6366f1", category: "chart-pattern",
    params: [
      { key: "lookback", label: "스윙 검출 봉수", defaultValue: 5, min: 3, max: 8, step: 1 },
      { key: "minWaveRatio", label: "최소 파동 비율(%)", defaultValue: 3, min: 1, max: 10, step: 1 },
    ],
  },
  {
    id: "triangle-conv", name: "삼각수렴 돌파", nameEn: "Triangle Convergence",
    description: "삼각수렴 패턴(대칭/상승/하강)을 자동 감지. 수렴 후 상향 돌파 시 매수, 하향 돌파 시 매도. 돌파 방향이 핵심",
    icon: "△", color: "#ec4899", category: "chart-pattern",
    params: [
      { key: "lookback", label: "스윙 검출 봉수", defaultValue: 5, min: 3, max: 8, step: 1 },
      { key: "minPoints", label: "최소 접점 수", defaultValue: 4, min: 3, max: 6, step: 1 },
    ],
  },
];

// ════════════════════════════════════════
// 시그널 생성
// ════════════════════════════════════════

export function generateSignals(
  strategyId: string,
  candles: OHLCV[],
  params: Record<string, number>
): Signal[] {
  const closes = candles.map((c) => c.close);
  const signals: Signal[] = [];

  switch (strategyId) {
    case "golden-cross": {
      const short = sma(closes, params.shortPeriod || 5);
      const long = sma(closes, params.longPeriod || 20);
      for (let i = 1; i < candles.length; i++) {
        if (short[i] !== null && long[i] !== null && short[i - 1] !== null && long[i - 1] !== null) {
          if (short[i - 1]! <= long[i - 1]! && short[i]! > long[i]!) {
            signals.push({ time: candles[i].time, type: "buy", price: candles[i].close, reason: "골든크로스", strength: "strong" });
          } else if (short[i - 1]! >= long[i - 1]! && short[i]! < long[i]!) {
            signals.push({ time: candles[i].time, type: "sell", price: candles[i].close, reason: "데드크로스", strength: "strong" });
          }
        }
      }
      break;
    }

    case "rsi-reversal": {
      const rsiVals = rsi(closes, params.period ?? 14);
      const oversold = params.oversold ?? 30;
      const overbought = params.overbought ?? 70;
      for (let i = 1; i < candles.length; i++) {
        if (rsiVals[i] !== null && rsiVals[i - 1] !== null) {
          if (rsiVals[i - 1]! < oversold && rsiVals[i]! >= oversold) {
            signals.push({ time: candles[i].time, type: "buy", price: candles[i].close, reason: `RSI ${rsiVals[i]!.toFixed(0)} 과매도 탈출`, strength: rsiVals[i - 1]! < oversold - 5 ? "strong" : "medium" });
          } else if (rsiVals[i - 1]! > overbought && rsiVals[i]! <= overbought) {
            signals.push({ time: candles[i].time, type: "sell", price: candles[i].close, reason: `RSI ${rsiVals[i]!.toFixed(0)} 과매수 탈출`, strength: rsiVals[i - 1]! > overbought + 5 ? "strong" : "medium" });
          }
        }
      }
      break;
    }

    case "bollinger-revert": {
      const bb = bollingerBands(closes, params.period || 20, params.stdDev || 2);
      for (let i = 1; i < candles.length; i++) {
        if (bb.lower[i] !== null && bb.upper[i] !== null) {
          if (candles[i].low <= bb.lower[i]! && candles[i].close > bb.lower[i]!) {
            signals.push({ time: candles[i].time, type: "buy", price: candles[i].close, reason: "하단밴드 터치 반등", strength: "medium" });
          } else if (candles[i].high >= bb.upper[i]! && candles[i].close < bb.upper[i]!) {
            signals.push({ time: candles[i].time, type: "sell", price: candles[i].close, reason: "상단밴드 터치 하락", strength: "medium" });
          }
        }
      }
      break;
    }

    case "macd-cross": {
      const m = macd(closes, params.fast || 12, params.slow || 26, params.signal || 9);
      for (let i = 1; i < candles.length; i++) {
        if (m.histogram[i] !== null && m.histogram[i - 1] !== null) {
          // 히스토그램이 음→양 전환 = 매수, 양→음 전환 = 매도
          if (m.histogram[i - 1]! <= 0 && m.histogram[i]! > 0) {
            const strength = Math.abs(m.histogram[i]!) > Math.abs(m.macd[i]! * 0.1) ? "strong" : "medium";
            signals.push({ time: candles[i].time, type: "buy", price: candles[i].close, reason: "MACD 골든크로스", strength });
          } else if (m.histogram[i - 1]! >= 0 && m.histogram[i]! < 0) {
            const strength = Math.abs(m.histogram[i]!) > Math.abs(m.macd[i]! * 0.1) ? "strong" : "medium";
            signals.push({ time: candles[i].time, type: "sell", price: candles[i].close, reason: "MACD 데드크로스", strength });
          }
        }
      }
      break;
    }

    case "dual-momentum": {
      const lookback = params.lookback || 60;
      const threshold = (params.threshold || 0) / 100;
      for (let i = lookback; i < candles.length; i += 20) {
        const absRet = (candles[i].close - candles[i - lookback].close) / candles[i - lookback].close;
        if (absRet > threshold) {
          signals.push({ time: candles[i].time, type: "buy", price: candles[i].close,
            reason: `절대 모멘텀 ${(absRet * 100).toFixed(1)}%`, strength: absRet > 0.15 ? "strong" : "medium" });
        } else {
          signals.push({ time: candles[i].time, type: "sell", price: candles[i].close,
            reason: `모멘텀 하락 ${(absRet * 100).toFixed(1)}%`, strength: absRet < -0.1 ? "strong" : "weak" });
        }
      }
      break;
    }

    // ── 차트 패턴 전략들 ──
    case "hh-ll": {
      const lb = params.lookback || 5;
      const { swingHighs, swingLows } = findSwingPoints(candles, lb);
      // 고고저(HH-HL) 패턴: 직전 고점보다 현재 고점 높고, 직전 저점보다 현재 저점 높으면 상승추세
      for (let i = 1; i < swingHighs.length; i++) {
        const lowNear = swingLows.filter(l => l.idx > (swingHighs[i - 1]?.idx || 0) && l.idx < swingHighs[i].idx);
        const prevLow = swingLows.filter(l => l.idx < swingHighs[i - 1]?.idx).pop();
        const curLow = lowNear[lowNear.length - 1];
        if (!prevLow || !curLow) continue;

        if (swingHighs[i].price > swingHighs[i - 1].price && curLow.price > prevLow.price) {
          // Higher High + Higher Low → 상승추세 확인, 매수
          signals.push({
            time: candles[swingHighs[i].idx].time, type: "buy",
            price: candles[swingHighs[i].idx].close,
            reason: `HH-HL 상승추세 (고점 ${swingHighs[i].price.toFixed(0)})`,
            strength: "strong",
          });
        } else if (swingHighs[i].price < swingHighs[i - 1].price && curLow && curLow.price < prevLow.price) {
          // Lower High + Lower Low → 하락추세, 매도
          signals.push({
            time: candles[swingHighs[i].idx].time, type: "sell",
            price: candles[swingHighs[i].idx].close,
            reason: `LH-LL 하락추세 (저점 ${curLow.price.toFixed(0)})`,
            strength: "strong",
          });
        }
      }
      break;
    }

    case "volume-profile": {
      const period = params.period || 60;
      const bins = params.bins || 20;
      // 슬라이딩 윈도우로 매물대 분석
      for (let i = period; i < candles.length; i += Math.max(5, Math.floor(period / 4))) {
        const slice = candles.slice(i - period, i);
        const vp = volumeProfile(slice, bins);
        const price = candles[i].close;
        const poc = vp.poc;

        // 강한 매물대(상위 30%) 가격 수준 찾기
        const strongLevels = vp.levels.filter(l => l.strength > 0.5);
        const supportLevels = strongLevels.filter(l => l.price < price).sort((a, b) => b.price - a.price);
        const resistLevels = strongLevels.filter(l => l.price > price).sort((a, b) => a.price - b.price);

        // POC 근처에서 지지 매수
        if (price <= poc * 1.02 && price >= poc * 0.98 && i > period + 5) {
          const prevPrice = candles[i - 5].close;
          if (prevPrice < price) {
            signals.push({
              time: candles[i].time, type: "buy", price,
              reason: `POC(${poc.toFixed(0)}) 지지 반등`,
              strength: "strong",
            });
          }
        }

        // 매물대 상단 돌파 매수
        if (resistLevels.length > 0) {
          const nearResist = resistLevels[0];
          if (price > nearResist.price && candles[i - 1].close <= nearResist.price) {
            signals.push({
              time: candles[i].time, type: "buy", price,
              reason: `매물대 ${nearResist.price.toFixed(0)} 돌파`,
              strength: nearResist.strength > 0.7 ? "strong" : "medium",
            });
          }
        }

        // 매물대 하단 이탈 매도
        if (supportLevels.length > 0) {
          const nearSupport = supportLevels[0];
          if (price < nearSupport.price && candles[i - 1].close >= nearSupport.price) {
            signals.push({
              time: candles[i].time, type: "sell", price,
              reason: `지지대 ${nearSupport.price.toFixed(0)} 이탈`,
              strength: nearSupport.strength > 0.7 ? "strong" : "medium",
            });
          }
        }
      }
      break;
    }

    case "elliott-wave": {
      const lb = params.lookback || 5;
      const minRatio = (params.minWaveRatio || 3) / 100;
      const { swingHighs, swingLows } = findSwingPoints(candles, lb);

      // 모든 스윙 포인트를 시간순으로 정렬
      const allSwings = [
        ...swingHighs.map(s => ({ ...s, type: "high" as const })),
        ...swingLows.map(s => ({ ...s, type: "low" as const })),
      ].sort((a, b) => a.idx - b.idx);

      // 연속 스윙에서 파동 패턴 감지
      // 5파 상승 완료: L1-H1-L2-H2-L3-H3(5파고점) → 매도
      // ABC 조정 완료: H-L(A)-H(B)-L(C) → 매수
      for (let i = 5; i < allSwings.length; i++) {
        const pts = allSwings.slice(i - 5, i + 1);

        // 5파 상승 패턴: low-high-low-high-low-high (6포인트)
        if (pts[0].type === "low" && pts[5].type === "high") {
          const wave1 = (pts[1].price - pts[0].price) / pts[0].price;
          const wave3 = (pts[3].price - pts[2].price) / pts[2].price;
          const wave5 = (pts[5].price - pts[4].price) / pts[4].price;

          // 파동 유효성: 3파가 1파보다 크고, 각 파동이 최소 비율 이상
          if (wave1 > minRatio && wave3 > minRatio && wave5 > minRatio &&
              wave3 > wave1 * 0.8 && // 3파가 1파의 80% 이상
              pts[2].price > pts[0].price && // 2파 저점이 1파 시작보다 높음
              pts[4].price > pts[2].price) { // 4파 저점이 2파 저점보다 높음
            signals.push({
              time: candles[pts[5].idx].time, type: "sell",
              price: candles[pts[5].idx].close,
              reason: `5파 상승 완료 (${(wave5 * 100).toFixed(1)}% 5파)`,
              strength: wave5 < wave3 * 0.6 ? "strong" : "medium", // 5파가 3파보다 약하면 강한 매도
            });
          }
        }

        // ABC 조정 패턴: high-low-high-low (4포인트, i-3~i)
        if (i >= 3 && allSwings[i - 3].type === "high" && allSwings[i].type === "low") {
          const subPts = allSwings.slice(i - 3, i + 1);
          const waveA = (subPts[0].price - subPts[1].price) / subPts[0].price;
          const waveB = (subPts[2].price - subPts[1].price) / subPts[1].price;
          const waveC = (subPts[2].price - subPts[3].price) / subPts[2].price;

          // ABC 유효성: B파 반등이 A파의 38~78%, C파가 A파 수준
          if (waveA > minRatio && waveC > minRatio &&
              waveB > waveA * 0.3 && waveB < waveA * 0.8 &&
              waveC > waveA * 0.6) {
            signals.push({
              time: candles[subPts[3].idx].time, type: "buy",
              price: candles[subPts[3].idx].close,
              reason: `ABC 조정 완료 (C파 ${(waveC * 100).toFixed(1)}%)`,
              strength: "strong",
            });
          }
        }
      }
      break;
    }

    case "triangle-conv": {
      const lb = params.lookback || 5;
      const minPts = params.minPoints || 4;
      const { swingHighs, swingLows } = findSwingPoints(candles, lb);

      if (swingHighs.length >= minPts / 2 && swingLows.length >= minPts / 2) {
        // 최근 스윙 포인트에서 수렴 패턴 감지
        const recentHighs = swingHighs.slice(-Math.ceil(minPts / 2));
        const recentLows = swingLows.slice(-Math.ceil(minPts / 2));

        if (recentHighs.length >= 2 && recentLows.length >= 2) {
          // 고점 추세선 기울기 (음수면 하강)
          const highSlope = (recentHighs[recentHighs.length - 1].price - recentHighs[0].price) /
            Math.max(1, recentHighs[recentHighs.length - 1].idx - recentHighs[0].idx);
          // 저점 추세선 기울기 (양수면 상승)
          const lowSlope = (recentLows[recentLows.length - 1].price - recentLows[0].price) /
            Math.max(1, recentLows[recentLows.length - 1].idx - recentLows[0].idx);

          // 수렴 조건: 고점 하강 or 저점 상승 (둘 다면 대칭삼각형)
          const isConverging = highSlope < 0 || lowSlope > 0;
          const range1 = recentHighs[0].price - recentLows[0].price;
          const range2 = recentHighs[recentHighs.length - 1].price - recentLows[recentLows.length - 1].price;
          const narrowing = range2 < range1 * 0.8; // 범위가 20% 이상 축소

          if (isConverging && narrowing) {
            // 현재 가격이 수렴 상단을 돌파하면 매수
            const lastIdx = Math.max(
              recentHighs[recentHighs.length - 1].idx,
              recentLows[recentLows.length - 1].idx
            );

            for (let i = lastIdx + 1; i < candles.length && i < lastIdx + 20; i++) {
              const projectedHigh = recentHighs[recentHighs.length - 1].price + highSlope * (i - recentHighs[recentHighs.length - 1].idx);
              const projectedLow = recentLows[recentLows.length - 1].price + lowSlope * (i - recentLows[recentLows.length - 1].idx);

              if (candles[i].close > projectedHigh && candles[i - 1].close <= projectedHigh) {
                const triangleType = highSlope < 0 && lowSlope > 0 ? "대칭삼각형" :
                  highSlope < 0 ? "하강삼각형" : "상승삼각형";
                signals.push({
                  time: candles[i].time, type: "buy", price: candles[i].close,
                  reason: `${triangleType} 상단 돌파`,
                  strength: "strong",
                });
                break;
              } else if (candles[i].close < projectedLow && candles[i - 1].close >= projectedLow) {
                const triangleType = highSlope < 0 && lowSlope > 0 ? "대칭삼각형" :
                  highSlope < 0 ? "하강삼각형" : "상승삼각형";
                signals.push({
                  time: candles[i].time, type: "sell", price: candles[i].close,
                  reason: `${triangleType} 하단 이탈`,
                  strength: "strong",
                });
                break;
              }
            }
          }
        }
      }
      break;
    }

    // momentum-rank → macd-cross로 교체했으므로 제거
  }

  return signals;
}
