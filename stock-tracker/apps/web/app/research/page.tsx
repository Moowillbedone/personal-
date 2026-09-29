"use client";
import { useState } from "react";
import Link from "next/link";
import PullbackScanPanel from "@/app/stats/PullbackScanPanel";
import Sma200Panel from "@/app/stats/Sma200Panel";
import IchimokuPanel from "@/app/stats/IchimokuPanel";
import SectorStrengthPanel from "@/app/stats/SectorStrengthPanel";
const tabs = ["눌림목", "200기간선", "일목 구름", "섹터 비교"];
export default function ResearchPage() {
  const [tab, setTab] = useState(0),
    [refresh, setRefresh] = useState(0);
  return (
    <div className="desk">
      <div className="desk-heading">
        <div>
          <p className="eyebrow">RESEARCH LIBRARY</p>
          <h1>필요한 근거만, 하나씩.</h1>
          <p className="desk-subtitle">
            기술 조건 탐색 도구 · 가격 패턴을 확인하는 참고 자료입니다.
          </p>
        </div>
        <button
          className="desk-button"
          onClick={() => setRefresh((r) => r + 1)}
        >
          새로고침 ↻
        </button>
      </div>
      <div className="research-tabs" role="tablist" aria-label="탐색 도구">
        {tabs.map((label, i) => (
          <button
            key={label}
            id={`research-tab-${i}`}
            role="tab"
            aria-selected={tab === i}
            aria-controls="research-panel"
            className={tab === i ? "selected" : ""}
            onClick={() => setTab(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="card-description mb-5">
        터치·반등·추세 점수의 수익성은 검증 전입니다. 섹터 등락률은 실제 자금
        유입액이 아니며, 지표가 많아져도 독립적인 근거가 늘어나는 것은 아닙니다.
      </p>
      <div
        id="research-panel"
        role="tabpanel"
        aria-labelledby={`research-tab-${tab}`}
        key={`${tab}-${refresh}`}
      >
        {tab === 0 ? (
          <PullbackScanPanel />
        ) : tab === 1 ? (
          <Sma200Panel />
        ) : tab === 2 ? (
          <IchimokuPanel />
        ) : (
          <SectorStrengthPanel />
        )}
      </div>
      <div className="flex flex-wrap gap-5 mt-6">
        <Link className="text-link" href="/techview">
          추세선 · 피보나치 상세 ↗
        </Link>
        <Link className="text-link" href="/signals">
          원시 이벤트 로그 ↗
        </Link>
        <Link className="text-link" href="/methodology">
          데이터와 검증 기준 ↗
        </Link>
      </div>
    </div>
  );
}
