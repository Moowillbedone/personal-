/** Long-only, unlevered cash sizing. Costs/slippage are an estimate per side. */
export interface RiskBudgetInput {
  equity: number;
  riskPercent: number;
  entry: number;
  stop: number;
  target: number;
  costBps: number;
  maxAllocationPercent: number;
}

export type RiskBudgetResult = { valid: false; errors: string[] } | {
  valid: true;
  quantity: number;
  riskBudget: number;
  cashBudget: number;
  notional: number;
  entryOutlay: number;
  plannedLoss: number;
  netReward: number;
  netR: number;
  riskPerShare: number;
  riskLimitedQuantity: number;
  cashLimitedQuantity: number;
  limitingFactor: "risk" | "allocation";
};

export function calculateRiskBudget(input: RiskBudgetInput): RiskBudgetResult {
  const { equity, riskPercent, entry, stop, target, costBps, maxAllocationPercent } = input;
  if (![equity, riskPercent, entry, stop, target, costBps, maxAllocationPercent].every(Number.isFinite)) {
    return { valid: false, errors: ["모든 항목에 유효한 숫자를 입력하세요."] };
  }
  const errors: string[] = [];
  if (equity <= 0) errors.push("계좌 평가액은 0보다 커야 합니다.");
  if (riskPercent <= 0 || riskPercent > 100) errors.push("손실 예산은 0 초과 100% 이하여야 합니다.");
  if (maxAllocationPercent <= 0 || maxAllocationPercent > 100) errors.push("투입 한도는 0 초과 100% 이하여야 합니다.");
  if (entry <= 0 || stop <= 0 || target <= 0) errors.push("가격은 모두 0보다 커야 합니다.");
  if (stop >= entry) errors.push("매수 계획의 손절가는 진입가보다 낮아야 합니다.");
  if (target <= entry) errors.push("목표가는 진입가보다 높아야 합니다.");
  if (costBps < 0 || costBps >= 10000) errors.push("편도 비용은 0 이상 10,000bp 미만이어야 합니다.");
  if (errors.length) return { valid: false, errors };

  const costRate = costBps / 10000;
  const cashPerShare = entry * (1 + costRate);
  const riskPerShare = cashPerShare - stop * (1 - costRate);
  const rewardPerShare = target * (1 - costRate) - cashPerShare;
  const riskBudget = equity * riskPercent / 100;
  const cashBudget = equity * maxAllocationPercent / 100;
  const riskLimitedQuantity = Math.floor(riskBudget / riskPerShare);
  const cashLimitedQuantity = Math.floor(cashBudget / cashPerShare);
  const quantity = Math.min(riskLimitedQuantity, cashLimitedQuantity);
  const result = {
    valid: true as const,
    quantity,
    riskBudget,
    cashBudget,
    notional: quantity * entry,
    entryOutlay: quantity * cashPerShare,
    plannedLoss: quantity * riskPerShare,
    netReward: quantity * rewardPerShare,
    netR: rewardPerShare / riskPerShare,
    riskPerShare,
    riskLimitedQuantity,
    cashLimitedQuantity,
    limitingFactor: riskLimitedQuantity <= cashLimitedQuantity ? "risk" as const : "allocation" as const,
  };
  if (!Number.isSafeInteger(quantity) || Object.values(result).some(v => typeof v === "number" && !Number.isFinite(v))) {
    return { valid: false, errors: ["입력값의 범위가 너무 큽니다. 가격과 계좌 평가액을 확인하세요."] };
  }
  return result;
}
