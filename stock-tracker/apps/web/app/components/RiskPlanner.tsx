"use client";

import { useId, useState } from "react";
import { calculateRiskBudget } from "@/lib/riskBudget";

interface Props {
  initialSymbol?: string;
  initialEntry?: number;
  initialStop?: number;
  initialTarget?: number;
}

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export default function RiskPlanner({ initialSymbol, initialEntry, initialStop, initialTarget }: Props) {
  const id = useId();
  const [fields, setFields] = useState({
    equity: "", riskPercent: "0.5", entry: initialEntry?.toString() ?? "",
    stop: initialStop?.toString() ?? "", target: initialTarget?.toString() ?? "",
    costBps: "10", maxAllocationPercent: "10",
  });
  const complete = Object.values(fields).every(value => value.trim() !== "");
  const result = complete ? calculateRiskBudget({
    equity: Number(fields.equity), riskPercent: Number(fields.riskPercent), entry: Number(fields.entry),
    stop: Number(fields.stop), target: Number(fields.target), costBps: Number(fields.costBps),
    maxAllocationPercent: Number(fields.maxAllocationPercent),
  }) : null;
  const inputs: { key: keyof typeof fields; label: string; placeholder?: string; step: string }[] = [
    { key: "equity", label: "계좌 평가액 ($)", placeholder: "10,000", step: "100" },
    { key: "riskPercent", label: "이번 거래 손실 예산 (%)", step: "0.1" },
    { key: "maxAllocationPercent", label: "계좌 대비 투입 한도 (%)", step: "1" },
    { key: "entry", label: "진입가 ($)", placeholder: "100", step: "0.01" },
    { key: "stop", label: "계획 손절가 ($)", placeholder: "95", step: "0.01" },
    { key: "target", label: "목표가 ($)", placeholder: "110", step: "0.01" },
    { key: "costBps", label: "편도 비용·슬리피지 (bp)", step: "1" },
  ];
  return (
    <section id="risk-planner" aria-labelledby={`${id}-title`} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-sky-400">계획 먼저, 주문은 다음</div>
          <h2 id={`${id}-title`} className="mt-1 text-lg font-semibold text-neutral-100">내 손실 예산으로 수량 계산{initialSymbol ? ` · ${initialSymbol}` : ""}</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-400">실제 거래할 종목의 가격을 입력하세요. AI 점수와 무관하게 손실 예산과 현금 투입 한도를 함께 적용합니다.</p>
        </div>
        <button type="button" className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800" onClick={() => setFields({ equity: "10000", riskPercent: "0.5", maxAllocationPercent: "10", entry: "100", stop: "95", target: "110", costBps: "10" })}>가상 예시 입력</button>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {inputs.map(({ key, label, placeholder, step }) => <label key={key} htmlFor={`${id}-${key}`} className="block text-xs text-neutral-400">
          {label}
          <input id={`${id}-${key}`} type="number" inputMode="decimal" min="0" step={step} value={fields[key]} placeholder={placeholder} onChange={e => setFields(previous => ({ ...previous, [key]: e.target.value }))} className="mt-1.5 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm tabular-nums text-neutral-100 focus:border-sky-500 focus:outline-none" />
        </label>)}
      </div>
      <div aria-live="polite" className="mt-4">
        {!result ? <p className="rounded-lg bg-neutral-900 p-4 text-sm text-neutral-400">계좌 평가액과 세 가지 가격을 입력하면 수량·계획 손실·비용 차감 손익비가 표시됩니다.</p>
          : !result.valid ? <ul className="rounded-lg border border-amber-900 bg-amber-950/20 p-3 text-sm text-amber-200">{result.errors.map(error => <li key={error}>{error}</li>)}</ul>
          : <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["계획 수량 (정수 주)", `${result.quantity.toLocaleString()}주`],
                ["매수 총액 (진입 비용 포함)", money(result.entryOutlay)],
                ["계획 손실 (양쪽 비용 포함)", money(result.plannedLoss)],
                ["비용 차감 손익비", `${result.netR.toFixed(2)}R`],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3"><div className="text-[11px] text-neutral-400">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums text-neutral-100">{value}</div></div>)}
            </div>
            <p className="mt-3 text-xs leading-5 text-neutral-400">손실 예산 {money(result.riskBudget)} · 투입 한도 {money(result.cashBudget)} · {result.limitingFactor === "risk" ? "손실 예산" : "투입 한도"}가 수량을 제한합니다. 목표가 청산 가정 손익 {money(result.netReward)}.</p>
            {result.quantity === 0 && <p className="mt-2 text-sm text-amber-300">현재 예산으로는 1주도 조건을 충족하지 못합니다. 거래를 보류하거나 계획을 다시 검토하세요.</p>}
            {result.netR <= 0 && <p className="mt-2 text-sm text-amber-300">목표가에 도달해도 입력한 거래 비용을 회수하지 못합니다.</p>}
          </>}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-neutral-500">기본 0.5%·10%는 편집 가능한 계산 예시입니다. 10bp = 편도 0.1%; 매수와 청산에 각각 적용됩니다. 수량은 두 예산으로 살 수 있는 정수 주 중 작은 값입니다. 단일 현금 매수 계획이며 기존 보유·대출·세금·환율은 포함하지 않습니다. 잔여 현금과 전체 보유 위험도 따로 확인하세요. 갭 하락·거래 정지로 실제 손실은 계획보다 커질 수 있습니다. 주문은 실행되지 않습니다.</p>
    </section>
  );
}
