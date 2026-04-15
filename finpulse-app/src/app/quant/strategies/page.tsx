"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { STRATEGIES } from "@/lib/quant";
import { getPortfolio } from "@/lib/portfolio-store";

export default function StrategiesPage() {
  const [activeStrategies, setActiveStrategies] = useState<string[]>([]);
  const [tab, setTab] = useState<"all" | "classic" | "chart-pattern">("all");

  useEffect(() => {
    setActiveStrategies(getPortfolio().activeStrategies);
  }, []);

  const filtered = tab === "all" ? STRATEGIES : STRATEGIES.filter(s => s.category === tab);

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <div className="bg-dark-card/80 backdrop-blur-xl sticky top-0 z-30 px-5 pt-12 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/quant" className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div>
            <h1 className="text-sm font-semibold">매매 전략 라이브러리</h1>
            <p className="text-[10px] text-dark-muted">{STRATEGIES.length}개 전략 · 백테스트 + 차트분석</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {([
            { key: "all", label: "전체" },
            { key: "classic", label: "클래식 전략" },
            { key: "chart-pattern", label: "차트 기술분석" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold transition ${tab === t.key ? "bg-accent text-white" : "bg-dark-border/50 text-dark-muted"}`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 fade-in space-y-3">
        {tab === "chart-pattern" && (
          <div className="bg-gradient-to-r from-accent/10 to-purple-500/10 rounded-2xl p-4 border border-accent/20 mb-1">
            <p className="text-xs font-bold text-accent mb-1">차트 기술적 분석</p>
            <p className="text-[10px] text-dark-muted leading-relaxed">
              즐겨찾기 종목에 자동 적용하여 매수/매도 타점을 실시간 제공합니다. 차트를 몰라도 시각적으로 매매 타이밍을 확인할 수 있습니다.
            </p>
          </div>
        )}
        {filtered.map((s) => {
          const isActive = activeStrategies.includes(s.id);
          return (
            <Link
              key={s.id}
              href={`/quant/strategies/${s.id}`}
              className="block bg-dark-card rounded-2xl p-4 border border-dark-border active:bg-dark-border/50 transition"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                  style={{ backgroundColor: `${s.color}20`, color: s.color }}
                >
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold">{s.name}</h3>
                    {isActive && (
                      <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-up/20 text-up">활성</span>
                    )}
                    {s.category === "chart-pattern" && (
                      <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-accent/20 text-accent">차트분석</span>
                    )}
                  </div>
                  <p className="text-[10px] text-dark-muted uppercase tracking-wider mb-1.5">{s.nameEn}</p>
                  <p className="text-xs text-dark-muted leading-relaxed">{s.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {s.params.map((p) => (
                      <span key={p.key} className="px-2 py-0.5 rounded-full text-[10px] bg-dark-border/50 text-dark-muted">
                        {p.label}: {p.defaultValue}
                      </span>
                    ))}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" className="mt-1 shrink-0"><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
