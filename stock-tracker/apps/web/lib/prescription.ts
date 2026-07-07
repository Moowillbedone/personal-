// Prescription engine for the 2x-leveraged-ETF swing console (2026-07 pivot).
//
// Pure functions — no I/O. Takes a derived Position (from /api/trades/positions,
// which already computes unrealizedPct) plus the market regime, and returns a
// mechanical 처방 (prescription): what to do NOW with this position.
//
// Design principles (from the user's own trading rules):
//   - 분할매수/분할매도 is mandatory. Each BUY fill in trade_log = one tranche.
//     No schema change needed: tranche count is derived from fill history.
//   - +10~20% unrealized → 1차 분할익절 (sell ~⅓); +20%+ → 2차 익절.
//   - -10~-20% → 물타기 준비 구간 (watch); -20%~ → 물타기 (average down),
//     BUT ONLY IF (a) tranches remain (< MAX_TRANCHES buys so far) and
//     (b) the market regime is NOT risk_off. Averaging down a 2x ETF in a
//     confirmed downtrend is the single fastest way to blow up a small
//     account — the regime gate exists precisely to block that.
//   - -30%+ or tranches exhausted while falling → 손절/축소 검토 (danger).
//   - Time stop: leveraged ETFs bleed to volatility decay in chop. If the
//     position is old and going nowhere in a non-risk_on regime, flag it.
//
// All thresholds are exported so a future per-symbol settings UI can
// override them; today they are sensible defaults for 2x products.

export type Regime = "risk_on" | "neutral" | "risk_off";

export interface RxThresholds {
  tp1: number;        // 1차 분할익절 시작 (fraction, +0.10 = +10%)
  tp2: number;        // 2차 익절 / 추세 익절 라인
  watch: number;      // 물타기 준비 구간 시작 (negative)
  avgDown: number;    // 물타기 실행 라인 (negative)
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
  | "watch"      // 물타기 준비 (관찰)
  | "avg_down"   // 물타기 실행 구간
  | "avg_blocked"// 물타기 구간이지만 레짐/트랜치 사유로 차단
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
  // null = regime lookup FAILED. The 물타기 gate fails CLOSED on null:
  // unknown regime must never green-light averaging down a 2x ETF.
  regime: Regime | null;
}

function daysBetween(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000;
}

export function prescribe(
  input: RxInput,
  rx: RxThresholds = DEFAULT_RX,
  now: Date = new Date(),
): Prescription {
  const { unrealizedPct: pct, buyFillCount, regime } = input;

  if (pct == null) {
    return {
      level: "hold",
      severity: "info",
      badge: "가격 대기",
      action: "현재가 조회 실패 — 처방 보류",
      detail: "시세를 불러오지 못해 손익률을 계산할 수 없습니다. 새로고침 후 다시 확인하세요.",
    };
  }

  const pctLabel = `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;
  const tranchesLeft = Math.max(0, rx.maxTranches - buyFillCount);

  // ── Profit side ──────────────────────────────────────────────────────────
  if (pct >= rx.tp2) {
    return {
      level: "tp2",
      severity: "good",
      badge: "2차 익절",
      action: `평가 ${pctLabel} — 추가 ⅓ 분할익절 + 잔여분 트레일링`,
      detail:
        `+${(rx.tp2 * 100).toFixed(0)}% 라인 돌파. 1차에 이어 추가로 ⅓을 익절하고, ` +
        `잔여분은 고점 대비 -7~10% 트레일링 스탑으로 추세를 따라가세요. ` +
        `2배 레버리지는 되돌림도 2배 — 이익을 지키는 게 우선입니다.`,
    };
  }
  if (pct >= rx.tp1) {
    return {
      level: "tp1",
      severity: "good",
      badge: "1차 익절",
      action: `평가 ${pctLabel} — 보유분의 ⅓ 분할익절 권장`,
      detail:
        `+${(rx.tp1 * 100).toFixed(0)}~${(rx.tp2 * 100).toFixed(0)}% 구간. 첫 ⅓을 익절해 ` +
        `원금 일부를 회수하면 이후 물타기/홀드 판단이 심리적으로 쉬워집니다. ` +
        `잔여분 목표는 +${(rx.tp2 * 100).toFixed(0)}%.`,
    };
  }

  // ── Loss side ────────────────────────────────────────────────────────────
  if (pct <= rx.hardStop) {
    return {
      level: "stop",
      severity: "danger",
      badge: "손절 검토",
      action: `평가 ${pctLabel} — 포지션 축소/손절을 우선 검토`,
      detail:
        `${(rx.hardStop * 100).toFixed(0)}% 이하는 물타기로 복구할 구간이 아닙니다 ` +
        `(2배 ETF -30%는 기초지수 -15%+ 추세 전환 신호). ` +
        `절반 이상 축소 후, 레짐이 risk-on으로 돌아오면 재진입하는 편이 기대값이 높습니다.`,
    };
  }
  if (pct <= rx.avgDown) {
    if (regime == null) {
      return {
        level: "avg_blocked",
        severity: "danger",
        badge: "레짐 미확인",
        action: `평가 ${pctLabel} — 레짐 조회 실패: 물타기 보류 (fail-closed)`,
        detail:
          `물타기 구간(${(rx.avgDown * 100).toFixed(0)}% 이하)이지만 시장 레짐을 확인할 수 ` +
          `없습니다. 레짐 불명 상태에서 2배 ETF 트랜치 투입은 금지 — 새로고침으로 레짐 조회가 ` +
          `복구된 뒤 재판단하세요.`,
      };
    }
    if (regime === "risk_off") {
      return {
        level: "avg_blocked",
        severity: "danger",
        badge: "물타기 금지",
        action: `평가 ${pctLabel} — 레짐 risk-off: 물타기 차단, 축소 검토`,
        detail:
          `물타기 구간(${(rx.avgDown * 100).toFixed(0)}% 이하)이지만 시장 레짐이 하락추세입니다. ` +
          `확인된 하락추세에서 2배 ETF 물타기는 손실을 가속시킵니다. ` +
          `레짐이 중립 이상으로 회복될 때까지 신규 트랜치 투입 금지.`,
      };
    }
    if (tranchesLeft <= 0) {
      return {
        level: "avg_blocked",
        severity: "danger",
        badge: "트랜치 소진",
        action: `평가 ${pctLabel} — 분할매수 ${rx.maxTranches}회 소진, 추가 매수 금지`,
        detail:
          `계획된 ${rx.maxTranches}회 트랜치를 모두 사용했습니다. 여기서 더 사면 ` +
          `계획 밖 물타기 = 리스크 관리 붕괴. 홀드하되 ${(rx.hardStop * 100).toFixed(0)}% ` +
          `도달 시 손절 규칙을 기계적으로 실행하세요.`,
      };
    }
    return {
      level: "avg_down",
      severity: "warn",
      badge: "물타기 구간",
      action: `평가 ${pctLabel} — ${buyFillCount + 1}차 트랜치 투입 가능 (${tranchesLeft}회 남음)`,
      detail:
        `${(rx.avgDown * 100).toFixed(0)}% 이하 + 레짐 ${regime === "risk_on" ? "상승" : "중립"} → ` +
        `계획된 물타기 실행 구간입니다. 다음 트랜치를 투입하면 평단이 내려가 ` +
        `반등 시 익절 라인 도달이 빨라집니다. 단, 투입 후에도 하락 지속 시 ` +
        `${(rx.hardStop * 100).toFixed(0)}% 손절 규칙은 그대로 유지.`,
    };
  }
  if (pct <= rx.watch) {
    return {
      level: "watch",
      severity: "info",
      badge: "물타기 준비",
      action: `평가 ${pctLabel} — 관찰 구간, ${(rx.avgDown * 100).toFixed(0)}% 도달 시 물타기 검토`,
      detail:
        `${(rx.watch * 100).toFixed(0)}~${(rx.avgDown * 100).toFixed(0)}% 구간. 아직 물타기 라인 전입니다. ` +
        `미리 사면 트랜치를 낭비합니다 — 계획 라인까지 기다리세요. ` +
        `남은 트랜치: ${tranchesLeft}회.`,
    };
  }

  // ── Neutral zone: check time decay ──────────────────────────────────────
  if (
    input.firstBuyTs &&
    regime !== "risk_on" &&
    Math.abs(pct) < 0.05 &&
    daysBetween(input.firstBuyTs, now) >= rx.timeStopDays
  ) {
    return {
      level: "time_decay",
      severity: "warn",
      badge: "decay 주의",
      action: `${rx.timeStopDays}일+ 보유 & ±5% 박스 — 청산 후 재진입 검토`,
      detail:
        `추세 없는 구간에서 2배 ETF는 변동성 잠식(volatility decay)으로 기초지수보다 ` +
        `나쁘게 수렴합니다. 레짐이 risk-on이 아니면 박스권 장기보유의 기대값은 음수 — ` +
        `일단 나왔다가 방향이 나오면 다시 타는 것이 유리합니다.`,
    };
  }

  return {
    level: "hold",
    severity: "info",
    badge: "보유",
    action: `평가 ${pctLabel} — 계획 구간 내, 홀드`,
    detail:
      `익절 라인(+${(rx.tp1 * 100).toFixed(0)}%)과 물타기 준비 라인(${(rx.watch * 100).toFixed(0)}%) ` +
      `사이입니다. 다음 트랜치 ${tranchesLeft}회 보유 중. 라인 도달 전까지는 아무것도 하지 않는 것이 계획입니다.`,
  };
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
          "스윙 적극 구간 — 분할매수 트랜치 투입과 눌림목 진입에 유리. 데이 트레이딩도 롱 방향 우위.",
      };
    case "risk_off":
      return {
        emoji: "🔴",
        label: "하락 추세 (risk-off)",
        advice:
          "현금 우위 구간 — 신규 진입·물타기 금지. 기존 포지션은 축소 우선. 거래는 돈이 도는 테마섹터 데이 단타로 한정.",
      };
    default:
      return {
        emoji: "🟡",
        label: "중립 · 박스권",
        advice:
          "선별 구간 — 신규 진입은 자금이 도는 섹터로 한정하고 트랜치 크기 축소. 레버리지 장기보유는 decay 불리.",
      };
  }
}
