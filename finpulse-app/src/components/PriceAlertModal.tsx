"use client";
import { useState } from "react";
import { addAlert } from "@/lib/store";

interface Props {
  symbol: string;
  name: string;
  currentPrice: number;
  currency: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function PriceAlertModal({ symbol, name, currentPrice, currency, onClose, onConfirm }: Props) {
  const [condition, setCondition] = useState<"above" | "below">("above");
  const [price, setPrice] = useState(currentPrice.toString());

  function handleSubmit() {
    addAlert({ symbol, name, targetPrice: parseFloat(price), condition, currency });
    onConfirm();
  }

  return (
    <div className="fixed inset-0 max-w-[430px] mx-auto z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-dark-card rounded-t-3xl p-6 border-t border-dark-border">
        <div className="w-10 h-1 rounded-full bg-dark-border mx-auto mb-5" />
        <h3 className="font-bold text-base mb-5">가격 알림 설정</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-dark-muted mb-1.5 block">종목</label>
            <div className="bg-dark-bg rounded-xl p-3 border border-dark-border flex items-center gap-2">
              <span className="text-sm font-medium">{symbol}</span>
              <span className="text-xs text-dark-muted">{name}</span>
              <span className="text-xs text-dark-muted ml-auto">현재가 {currency}{currentPrice.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-dark-muted mb-1.5 block">조건</label>
            <div className="flex gap-2">
              <button onClick={() => setCondition("above")} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${condition === "above" ? "bg-accent text-white" : "bg-dark-bg border border-dark-border text-dark-muted"}`}>이상</button>
              <button onClick={() => setCondition("below")} className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${condition === "below" ? "bg-accent text-white" : "bg-dark-bg border border-dark-border text-dark-muted"}`}>이하</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-dark-muted mb-1.5 block">목표 가격</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-dark-muted text-sm">{currency}</span>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-dark-bg border border-dark-border rounded-xl py-3 pl-8 pr-4 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
          </div>
        </div>
        <button onClick={handleSubmit} className="w-full py-4 rounded-2xl bg-gradient-to-r from-accent to-purple-500 font-semibold text-sm mt-6">알림 설정하기</button>
      </div>
    </div>
  );
}
