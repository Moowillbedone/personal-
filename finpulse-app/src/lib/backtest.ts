/**
 * 백테스트 엔진
 * 전략 시그널 기반으로 가상 매매 시뮬레이션
 *
 * 수수료: 편도 0.1% (매수+매도 = 0.2%)
 * 슬리피지: 편도 0.05%
 * Sharpe Ratio: 무위험 수익률 연 3.5% 반영
 */

import { OHLCV, generateSignals, STRATEGIES } from "./quant";

const COMMISSION_RATE = 0.001; // 편도 0.1%
const SLIPPAGE_RATE = 0.0005; // 편도 0.05%
const RISK_FREE_ANNUAL = 0.035; // 연 3.5%
const RISK_FREE_DAILY = RISK_FREE_ANNUAL / 252;

export interface BacktestResult {
  trades: Trade[];
  equity: { time: number; value: number }[];
  totalReturn: number;
  cagr: number;
  mdd: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  avgHoldingDays: number;
  benchmarkReturn: number;
  totalCommission: number;
}

export interface Trade {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  returnPct: number;
  holdingDays: number;
  type: "long";
}

export function runBacktest(
  strategyId: string,
  candles: OHLCV[],
  params: Record<string, number>,
  initialCapital: number = 100000000 // 1억원
): BacktestResult {
  // 입력 검증
  if (!candles || candles.length < 2 || initialCapital <= 0) {
    return emptyResult(initialCapital);
  }

  const signals = generateSignals(strategyId, candles, params);
  const trades: Trade[] = [];
  const equity: { time: number; value: number }[] = [];

  let capital = initialCapital;
  let position = 0;
  let entryPrice = 0;
  let entryTime = 0;
  let inPosition = false;
  let totalCommission = 0;

  // 일별 equity 추적
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const signal = signals.find((s) => s.time === c.time);

    if (signal) {
      if (signal.type === "buy" && !inPosition) {
        // 매수: 수수료 + 슬리피지 반영
        const effectivePrice = c.close * (1 + SLIPPAGE_RATE);
        const maxShares = Math.floor(capital / (effectivePrice * (1 + COMMISSION_RATE)));
        if (maxShares > 0) {
          position = maxShares;
          const cost = position * effectivePrice;
          const commission = cost * COMMISSION_RATE;
          capital -= cost + commission;
          totalCommission += commission;
          entryPrice = effectivePrice;
          entryTime = c.time;
          inPosition = true;
        }
      } else if (signal.type === "sell" && inPosition) {
        // 매도: 수수료 + 슬리피지 반영
        const effectivePrice = c.close * (1 - SLIPPAGE_RATE);
        const proceeds = position * effectivePrice;
        const commission = proceeds * COMMISSION_RATE;
        capital += proceeds - commission;
        totalCommission += commission;

        const returnPct = ((effectivePrice - entryPrice) / entryPrice) * 100;
        const holdingDays = Math.max(1, Math.round((c.time - entryTime) / 86400));
        trades.push({
          entryTime,
          entryPrice,
          exitTime: c.time,
          exitPrice: effectivePrice,
          returnPct,
          holdingDays,
          type: "long",
        });
        position = 0;
        entryPrice = 0;
        inPosition = false;
      }
    }

    // equity = 현금 + 보유주식 시가
    const totalEquity = capital + position * c.close;
    equity.push({ time: c.time, value: totalEquity });
  }

  // 마지막에 포지션이 남아있으면 강제 청산
  if (inPosition && candles.length > 0) {
    const lastCandle = candles[candles.length - 1];
    const effectivePrice = lastCandle.close * (1 - SLIPPAGE_RATE);
    const proceeds = position * effectivePrice;
    const commission = proceeds * COMMISSION_RATE;
    capital += proceeds - commission;
    totalCommission += commission;

    const returnPct = ((effectivePrice - entryPrice) / entryPrice) * 100;
    const holdingDays = Math.max(1, Math.round((lastCandle.time - entryTime) / 86400));
    trades.push({
      entryTime,
      entryPrice,
      exitTime: lastCandle.time,
      exitPrice: effectivePrice,
      returnPct,
      holdingDays,
      type: "long",
    });

    // equity curve 마지막 값 업데이트 (강제 청산 후 최종 자본 반영)
    if (equity.length > 0) {
      equity[equity.length - 1].value = capital;
    }
  }

  // 성과 지표 계산
  const finalEquity = equity.length > 0 ? equity[equity.length - 1].value : initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

  // CAGR (최소 0.5년으로 클램핑하여 단기 데이터에서 폭발 방지)
  const totalDays = candles.length > 1 ? (candles[candles.length - 1].time - candles[0].time) / 86400 : 1;
  const years = Math.max(totalDays / 365, 0.5);
  const cagr = finalEquity > 0
    ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100
    : -100;

  // MDD (Maximum Drawdown)
  let peak = initialCapital;
  let mdd = 0;
  for (const e of equity) {
    if (e.value > peak) peak = e.value;
    const dd = ((peak - e.value) / peak) * 100;
    if (dd > mdd) mdd = dd;
  }

  // 승률
  const winTrades = trades.filter((t) => t.returnPct > 0).length;
  const winRate = trades.length > 0 ? (winTrades / trades.length) * 100 : 0;

  // 평균 보유일
  const avgHoldingDays = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
    : 0;

  // 샤프비율 (무위험 수익률 반영)
  const dailyReturns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    dailyReturns.push((equity[i].value - equity[i - 1].value) / equity[i - 1].value);
  }
  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const excessReturn = avgReturn - RISK_FREE_DAILY;
  const stdReturn = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / (dailyReturns.length - 1))
    : 1;
  const sharpeRatio = stdReturn > 0 ? (excessReturn / stdReturn) * Math.sqrt(252) : 0;

  // 벤치마크 (Buy & Hold)
  const benchmarkReturn = candles.length >= 2
    ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100
    : 0;

  return {
    trades,
    equity,
    totalReturn,
    cagr,
    mdd,
    sharpeRatio,
    winRate,
    totalTrades: trades.length,
    avgHoldingDays,
    benchmarkReturn,
    totalCommission,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function emptyResult(_cap: number): BacktestResult {
  return {
    trades: [],
    equity: [],
    totalReturn: 0,
    cagr: 0,
    mdd: 0,
    sharpeRatio: 0,
    winRate: 0,
    totalTrades: 0,
    avgHoldingDays: 0,
    benchmarkReturn: 0,
    totalCommission: 0,
  };
}

// 전략 ID로 전략 정보 가져오기
export function getStrategy(id: string) {
  return STRATEGIES.find((s) => s.id === id);
}

// 전략의 기본 파라미터 가져오기
export function getDefaultParams(strategyId: string): Record<string, number> {
  const strategy = getStrategy(strategyId);
  if (!strategy) return {};
  const params: Record<string, number> = {};
  for (const p of strategy.params) {
    params[p.key] = p.defaultValue;
  }
  return params;
}
