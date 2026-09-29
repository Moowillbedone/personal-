// Rule-based review reminders, not an expected-return model or an order instruction.
// No price loss or market regime alone authorizes adding capital.

export type Regime = "risk_on" | "neutral" | "risk_off";

export interface RxThresholds {
  tp1: number;        // 1차 분할익절 시작 (fraction, +0.10 = +10%)
  tp2: number;        // 2차 익절 / 추세 익절 라인
  watch: number;      // 손실 검토 알림 (negative)
  avgDown: number;    // 추가 자본 투입 보류 알림 (legacy field name)
  hardStop: number;   // 손절 검토 강권 라인 (negative)
  maxTranches: number; // 최대 분할매수 횟수 (이후 물타기 금지)
  timeStopDays: number; // 이 일수 이상 & ±5% 박스면 decay 경고
}

export const DEFAULT_RX: RxThresholds = {
  tp1: 0.10,
  tp2: 0.20,
  watch: -0.10,
  avgDown: -0.20,
  hardStop: -0.30,
  maxTranches: 3,
  timeStopDays: 10,
};

export type RxLevel =
  | "tp2"        // 2차+ 익절 구간
  | "tp1"        // 1차 분할익절 구간
  | "hold"       // 보유 (특이사항 없음)
  | "watch"      // 손실 검토
  | "avg_down"   // legacy compatibility; never emitted
  | "avg_blocked"// 추가 매수 근거와 전체 손실 예산 필요
  | "stop"       // 손절/축소 검토
  | "time_decay"; // 레버리지 decay 시간 손절 경고

export interface Prescription {
  level: RxLevel;
  severity: "good" | "info" | "warn" | "danger";
  badge: string;    // short pill text, e.g. "1차 익절"
  action: string;   // one-line imperative, Korean
  detail: string;   // why + how (tranche math), Korean
}

export interface RxInput {
  unrealizedPct: number | null; // fraction (0.12 = +12%) — OPEN-CYCLE basis
  buyFillCount: number;         // number of BUY fills = tranches used
  openQty: number;
  firstBuyTs?: string | null;   // ISO of the earliest open-cycle buy (for time stop)
  // null = market regime unavailable; no regime authorizes extra capital alone.
  regime: Regime | null;
  /** Only show daily-reset holding-period warnings for an identified leveraged product. */
  isLeveraged?: boolean;
}

function daysBetween(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000;
}

export function prescribe(
  input: RxInput,
  rx: RxThresholds = DEFAULT_RX,
  now: Date = new Date(),
): Prescription {
  const pct = input.unrealizedPct;
  if (pct == null || !Number.isFinite(pct)) {
    return { level: "hold", severity: "info", badge: "가격 대기", action: "현재가 확인 전 판단 보류", detail: "시세와 거래 내역을 확인한 뒤 손익 및 손실 예산을 다시 계산하세요." };
  }
  const pctLabel = `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;
  if (pct <= rx.hardStop) {
    return { level: "stop", severity: "danger", badge: "위험 재검토", action: `평가 ${pctLabel} — 손실 예산과 청산 계획 확인`, detail: "큰 손실은 추가 매수의 근거가 아닙니다. 최초 매수 이유가 무효가 되었는지와 계좌 전체 손실을 확인하세요. 이 알림의 고정 비율은 종목별 손절 계획을 대체하지 않습니다." };
  }
  if (pct <= rx.avgDown) {
    return { level: "avg_blocked", severity: "danger", badge: "추가 매수 보류", action: `평가 ${pctLabel} — 가격 하락만으로 물타기하지 않기`, detail: "시장 추세와 남은 분할 횟수만으로 추가 매수의 수익성을 판단할 수 없습니다. 새로운 진입 근거, 기존 보유분을 합한 최대 손실, 현금 여력과 계획 손절가가 확인되기 전에는 추가 투입을 보류하세요." };
  }
  if (pct <= rx.watch) {
    return { level: "watch", severity: "warn", badge: "손실 점검", action: `평가 ${pctLabel} — 원래의 무효화 조건 확인`, detail: "손실 확대를 기다렸다가 자동으로 추가 매수하는 규칙은 사용하지 않습니다. 현재 계좌 손실 예산과 진입 전에 정한 손절 조건을 대조하세요." };
  }
  if (pct >= rx.tp1) {
    return { level: pct >= rx.tp2 ? "tp2" : "tp1", severity: "good", badge: "이익 관리 점검", action: `평가 ${pctLabel} — 미리 정한 익절 계획 확인`, detail: "고정 수익률에 도달했다는 사실만으로 최적 매도 비중을 알 수 없습니다. 실제 진입가 기준 손익비, 비용, 목표가와 잔여 위험을 확인하고 사전에 정한 분할 청산 계획과 비교하세요." };
  }
  if (input.isLeveraged && input.firstBuyTs && daysBetween(input.firstBuyTs, now) >= rx.timeStopDays) {
    return { level: "time_decay", severity: "warn", badge: "보유기간 점검", action: `${rx.timeStopDays}일 이상 보유 — 상품의 일일 재설정 구조 확인`, detail: "일일 목표 배율 상품의 여러 날 누적 수익률은 기초자산 수익률의 단순 배수와 다를 수 있습니다. 경로·변동성·비용에 따라 달라지며, 특정 시장 구간의 기대수익을 이 규칙으로 단정할 수 없습니다." };
  }
  return { level: "hold", severity: "info", badge: "계획 점검", action: `평가 ${pctLabel} — 진입 근거와 손실 예산 확인`, detail: "현재 손익률만으로 보유의 유불리를 판정하지 않습니다. 가격 기준시각, 다음 실적 발표, 계획 손절가와 포지션 규모를 확인하세요." };
}

// ── Regime-level mode advice (dashboard header) ───────────────────────────
export interface ModeAdvice {
  emoji: string;
  label: string;
  advice: string;
}

export function regimeAdvice(regime: Regime): ModeAdvice {
  switch (regime) {
    case "risk_on":
      return {
        emoji: "🟢",
        label: "상승 추세 (risk-on)",
        advice:
          "추세 지표가 상승 조건에 해당합니다. 수익 우위를 보장하지 않으며 진입 전 개별 근거·비용·손실 예산을 확인하세요.",
      };
    case "risk_off":
      return {
        emoji: "🔴",
        label: "하락 추세 (risk-off)",
        advice:
          "추세 지표가 하락 조건에 해당합니다. 기존 보유 위험과 현금 여력을 먼저 확인하고 손실 만회를 위한 추가 거래를 경계하세요.",
      };
    default:
      return {
        emoji: "🟡",
        label: "중립 · 박스권",
        advice:
          "추세 지표의 방향이 뚜렷하지 않습니다. 거래할 근거가 부족하면 관찰을 유지하고 일일 재설정 상품의 보유기간 위험을 확인하세요.",
      };
  }
}
