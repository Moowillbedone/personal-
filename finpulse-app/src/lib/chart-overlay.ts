/**
 * 차트 오버레이 분석 엔진
 * 빗각 채널 (고고저) 전략 — PDF "빗각 채널 매수/매도 전략" 기반
 *
 * 핵심 원리:
 * 1. 역사적 고점 + 급등 변곡점(의미있는 고점)을 잇는 빗각선
 * 2. 해당 빗각선 기준 1:1 등간격 평행 채널 생성
 * 3. 채널 하단 = 매수 (손익비가 좋은 자리)
 * 4. 채널 상단 = 매도, 중간(하프) = 50% 분할 매도
 * 5. 손절 = 전 저점 꼬리 아래
 * 6. 빗각이 우하향이므로 시간이 갈수록 채널 상하단 가격이 변동
 */

export interface OverlayLine {
  from: { time: number; value: number };
  to: { time: number; value: number };
  color: string;
  width: number;
  style: "solid" | "dashed";
  label?: string;
}

export interface OverlayMarker {
  time: number;
  position: "aboveBar" | "belowBar";
  shape: "arrowUp" | "arrowDown" | "circle";
  color: string;
  text: string;
}

export interface ChannelAnalysis {
  lines: OverlayLine[];
  markers: OverlayMarker[];
  channels: {
    upper: { time: number; value: number }[];
    lower: { time: number; value: number }[];
    mid: { time: number; value: number }[];
  }[];
  info: {
    direction: "up" | "down" | "flat";
    currentZone: string;
    targetPrice: number | null;
    stopLoss: number | null;
    riskReward: number | null;
    halfTarget: number | null;   // 50% 분할매도 가격
    channelWidth: number | null; // 채널 폭
    slopePerBar: number | null;  // 봉당 빗각 기울기
  };
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ──────────────────────────────────────────────
// 스윙 고점/저점 탐지 (의미있는 피봇 포인트)
// ──────────────────────────────────────────────
function findSwings(candles: Candle[], lookback: number = 5): {
  highs: { idx: number; time: number; price: number; volume: number }[];
  lows: { idx: number; time: number; price: number; volume: number }[];
} {
  const highs: { idx: number; time: number; price: number; volume: number }[] = [];
  const lows: { idx: number; time: number; price: number; volume: number }[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }
    if (isHigh) highs.push({ idx: i, time: candles[i].time, price: candles[i].high, volume: candles[i].volume });
    if (isLow) lows.push({ idx: i, time: candles[i].time, price: candles[i].low, volume: candles[i].volume });
  }

  return { highs, lows };
}

// 급격한 거래량 동반 상승인지 확인 (변곡점 후보)
function isInflectionPoint(candles: Candle[], idx: number, avgVolume: number): boolean {
  if (idx < 3 || idx >= candles.length) return false;
  const c = candles[idx];
  const prevAvgClose = (candles[idx - 1].close + candles[idx - 2].close + candles[idx - 3].close) / 3;
  const priceJump = (c.close - prevAvgClose) / prevAvgClose;
  const volumeSpike = c.volume > avgVolume * 1.5;
  return priceJump > 0.02 && volumeSpike; // 2% 이상 상승 + 거래량 스파이크
}

// 쌍바닥 패턴 감지
function detectDoubleBottom(candles: Candle[], idx: number, tolerance: number = 0.03): boolean {
  if (idx < 10) return false;
  const currentLow = candles[idx].low;
  // 최근 10~30봉 내 비슷한 저점이 있는지
  for (let i = Math.max(0, idx - 30); i < idx - 5; i++) {
    const diff = Math.abs(candles[i].low - currentLow) / currentLow;
    if (diff < tolerance) return true;
  }
  return false;
}

/**
 * 빗각 채널 분석 (고고저 방식)
 * PDF 전략 완전 구현
 */
export function analyzeDiagonalChannel(candles: Candle[]): ChannelAnalysis {
  const lines: OverlayLine[] = [];
  const markers: OverlayMarker[] = [];
  const channels: ChannelAnalysis["channels"] = [];
  const emptyInfo = {
    direction: "flat" as const,
    currentZone: "데이터 부족",
    targetPrice: null, stopLoss: null, riskReward: null,
    halfTarget: null, channelWidth: null, slopePerBar: null,
  };

  if (candles.length < 30) {
    return { lines, markers, channels, info: emptyInfo };
  }

  // lookback을 데이터 길이에 맞게 동적 조정
  const lookback = candles.length > 200 ? 8 : candles.length > 100 ? 5 : 3;
  const { highs, lows } = findSwings(candles, lookback);

  if (highs.length < 2) {
    return { lines, markers, channels, info: { ...emptyInfo, currentZone: "스윙 포인트 부족" } };
  }

  // 평균 거래량 계산
  const avgVolume = candles.reduce((s, c) => s + c.volume, 0) / candles.length;

  // ─── 1단계: 의미 있는 고점 2개 선택 ───
  // PDF: "역사적 고점 + 갑작스러운 상승 변곡점"
  // 방법: 가장 높은 고점을 찾고, 두 번째로는 거래량 동반 상승(변곡점) 우선 선택
  const sortedHighs = [...highs].sort((a, b) => b.price - a.price);
  const pivotHigh1 = sortedHighs[0]; // 역사적 최고점

  // 두 번째 고점: 거래량 동반 변곡점 우선, 없으면 가격순
  const minDistance = Math.max(5, Math.floor(candles.length * 0.12));
  let pivotHigh2 = highs.find(
    h => Math.abs(h.idx - pivotHigh1.idx) >= minDistance && isInflectionPoint(candles, h.idx, avgVolume)
  );
  if (!pivotHigh2) {
    pivotHigh2 = sortedHighs.find(h => Math.abs(h.idx - pivotHigh1.idx) >= minDistance);
  }
  if (!pivotHigh2) pivotHigh2 = sortedHighs[1];
  if (!pivotHigh2) {
    return { lines, markers, channels, info: { ...emptyInfo, currentZone: "고점 부족" } };
  }

  // 시간순 정렬
  const [h1, h2] = pivotHigh1.idx < pivotHigh2.idx
    ? [pivotHigh1, pivotHigh2]
    : [pivotHigh2, pivotHigh1];

  // ─── 2단계: 빗각선 (고점→고점 트렌드라인) ───
  const slope = (h2.price - h1.price) / (h2.idx - h1.idx);
  const intercept = h1.price - slope * h1.idx;
  const lastIdx = candles.length - 1;

  // ─── 3단계: 채널 폭 계산 ───
  // PDF: 고점선에서 다음 변곡 저점까지의 거리를 채널 폭으로
  // 트렌드라인 아래 가장 먼 저점까지의 최대 거리를 채널 폭으로
  let maxDistBelow = 0;
  for (const low of lows) {
    const lineAtIdx = intercept + slope * low.idx;
    const dist = lineAtIdx - low.price;
    if (dist > maxDistBelow) maxDistBelow = dist;
  }

  // 합리적 범위로 보정
  const priceRange = Math.max(...candles.map(c => c.high)) - Math.min(...candles.map(c => c.low));
  const channelWidth = maxDistBelow > priceRange * 0.05
    ? maxDistBelow
    : priceRange * 0.2;

  // ─── 4단계: 1:1 등간격 채널 생성 ───
  // PDF: "각 채널과 채널 사이의 간격은 모두 1:1이다"
  const numChannelsAbove = 1;
  const numChannelsBelow = 3;

  for (let n = -numChannelsBelow; n <= numChannelsAbove; n++) {
    const offset = n * channelWidth;
    const chUpper: { time: number; value: number }[] = [];
    const chLower: { time: number; value: number }[] = [];
    const chMid: { time: number; value: number }[] = [];

    // 충분한 포인트로 매끄러운 라인 생성
    const step = Math.max(1, Math.floor(candles.length / 80));
    for (let i = 0; i <= lastIdx; i += step) {
      const basePrice = intercept + slope * i;
      const upper = basePrice - offset;
      const lower = upper - channelWidth;
      chUpper.push({ time: candles[i].time, value: upper });
      chLower.push({ time: candles[i].time, value: lower });
      chMid.push({ time: candles[i].time, value: (upper + lower) / 2 });
    }
    // 마지막 봉 추가
    const baseLast = intercept + slope * lastIdx;
    const upperLast = baseLast - offset;
    const lowerLast = upperLast - channelWidth;
    if (chUpper.length === 0 || chUpper[chUpper.length - 1].time !== candles[lastIdx].time) {
      chUpper.push({ time: candles[lastIdx].time, value: upperLast });
      chLower.push({ time: candles[lastIdx].time, value: lowerLast });
      chMid.push({ time: candles[lastIdx].time, value: (upperLast + lowerLast) / 2 });
    }

    channels.push({ upper: chUpper, lower: chLower, mid: chMid });
  }

  // ─── 5단계: 현재 가격의 채널 위치 판단 ───
  const currentPrice = candles[lastIdx].close;
  const currentBaseLine = intercept + slope * lastIdx;

  // 현재가가 어떤 채널에 있는지
  const channelPosition = (currentBaseLine - currentPrice) / channelWidth;
  const currentChannelIdx = Math.floor(channelPosition);
  const positionInChannel = channelPosition - currentChannelIdx; // 0=상단, 1=하단

  // PDF 전략 기반 현재 채널의 상/중/하단 가격
  // ★ 빗각이므로 시간이 지나면 이 가격들이 변한다는 점 반영
  const channelUpperPrice = currentBaseLine - currentChannelIdx * channelWidth;
  const channelLowerPrice = channelUpperPrice - channelWidth;
  const channelHalfPrice = (channelUpperPrice + channelLowerPrice) / 2;

  // 방향
  const direction: "up" | "down" | "flat" = slope > 0.001 ? "up" : slope < -0.001 ? "down" : "flat";

  // 현재 존 판정
  let currentZone = "";
  if (positionInChannel > 0.85) {
    currentZone = "🟢 채널 최하단 (적극 매수)";
  } else if (positionInChannel > 0.7) {
    currentZone = "🟢 채널 하단 (매수구간)";
  } else if (positionInChannel > 0.45) {
    currentZone = "🟡 채널 중간 (관망/보유)";
  } else if (positionInChannel > 0.2) {
    currentZone = "🟠 채널 중상단 (50% 익절)";
  } else {
    currentZone = "🔴 채널 상단 (매도구간)";
  }

  // ─── 6단계: 매수/매도 마커 생성 ───
  const markerLimit = 12;
  let buyCount = 0;
  let sellCount = 0;

  // 과거 채널 하단 터치 → 매수, 상단 → 매도
  for (let i = Math.max(lookback + 1, 10); i < candles.length - 1; i++) {
    if (buyCount + sellCount >= markerLimit) break;

    const lineAtI = intercept + slope * i;
    const chPos = (lineAtI - candles[i].low) / channelWidth;
    const chFrac = chPos - Math.floor(chPos);

    // 채널 하단 (85% 이상) + 다음 봉 양봉 반등
    if (chFrac > 0.85 && candles[i + 1].close > candles[i].close && buyCount < 6) {
      const isDouble = detectDoubleBottom(candles, i);
      markers.push({
        time: candles[i].time,
        position: "belowBar",
        shape: "arrowUp",
        color: "#22c55e",
        text: isDouble ? "쌍바닥 매수" : "채널 하단 매수",
      });
      buyCount++;
    }

    // 채널 상단 (15% 이내) + 다음 봉 음봉
    const chPosHigh = (lineAtI - candles[i].high) / channelWidth;
    const chFracHigh = chPosHigh - Math.floor(chPosHigh);
    if (chFracHigh < 0.15 && candles[i + 1].close < candles[i].close && sellCount < 4) {
      markers.push({
        time: candles[i].time,
        position: "aboveBar",
        shape: "arrowDown",
        color: "#ef4444",
        text: "채널 상단 매도",
      });
      sellCount++;
    }

    // 중간(하프) 도달 시 분할매도 시그널
    const chFracClose = ((lineAtI - candles[i].close) / channelWidth);
    const fracInCh = chFracClose - Math.floor(chFracClose);
    if (fracInCh > 0.35 && fracInCh < 0.55 && candles[i].close > candles[i - 1].close && candles[i + 1].close < candles[i].close && sellCount < 6) {
      markers.push({
        time: candles[i].time,
        position: "aboveBar",
        shape: "circle",
        color: "#f59e0b",
        text: "50% 익절",
      });
      sellCount++;
    }
  }

  // 현재 봉 시그널
  if (positionInChannel > 0.80) {
    const isBouncing = candles.length >= 2 && candles[lastIdx].close > candles[lastIdx - 1].close;
    const isDouble = detectDoubleBottom(candles, lastIdx);
    if (isBouncing) {
      markers.push({
        time: candles[lastIdx].time,
        position: "belowBar",
        shape: "arrowUp",
        color: "#22c55e",
        text: isDouble ? "🔥 쌍바닥 매수" : "🔥 매수 타점",
      });
    }
  }
  if (positionInChannel < 0.15) {
    markers.push({
      time: candles[lastIdx].time,
      position: "aboveBar",
      shape: "arrowDown",
      color: "#ef4444",
      text: "🔥 매도 타점",
    });
  }

  // 피봇 고점 마커
  markers.push({
    time: h1.time,
    position: "aboveBar",
    shape: "circle",
    color: "#f59e0b",
    text: "피봇1",
  });
  markers.push({
    time: h2.time,
    position: "aboveBar",
    shape: "circle",
    color: "#f59e0b",
    text: "피봇2",
  });

  // ─── 7단계: 손절가 / 목표가 / 손익비 계산 ───
  // PDF: "손절 = 전 저점의 하락 캔들 꼬리"
  const recentLows = lows.filter(l => l.idx > candles.length * 0.6);
  const stopLoss = recentLows.length > 0
    ? Math.min(...recentLows.map(l => l.price))
    : channelLowerPrice * 0.97; // 채널 하단 -3% 폴백

  // PDF: "최고 목표 매도가는 해당 채널의 최상단"
  // ★ 빗각이 우하향이면 시간이 지날수록 목표가 하락 → 현재 시점 기준
  const targetPrice = channelUpperPrice;
  const halfTarget = channelHalfPrice;

  // 손익비
  const risk = Math.max(0.01, currentPrice - stopLoss);
  const reward = targetPrice - currentPrice;
  const riskReward = risk > 0 && reward > 0 ? reward / risk : null;

  return {
    lines,
    markers,
    channels,
    info: {
      direction,
      currentZone,
      targetPrice: Math.round(targetPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      riskReward: riskReward ? Math.round(riskReward * 100) / 100 : null,
      halfTarget: Math.round(halfTarget * 100) / 100,
      channelWidth: Math.round(channelWidth * 100) / 100,
      slopePerBar: Math.round(slope * 10000) / 10000,
    },
  };
}
