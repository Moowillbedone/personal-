"use client";

// Tech View — 기술분석 탭.
//   ① 스캐너: 나스닥100 + 뉴욕100 중 "라인 터치" 셋업에 해당하는 종목 리스트
//      (워커가 일/주봉으로 매일 사전계산 → /api/techview-scan)
//   ② 개별 분석: 티커 입력 → /api/techview (갭·피보·빗각·터치 + AI 시나리오)

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import TechReportCard, { type TechResponse } from "@/app/techview/TechReportCard";
import { koSector, fmtUpdated } from "@/app/stats/scannerShared";

interface ScanRow {
  symbol: string;
  sector: string | null;
  price: number | null;
  setup: string;
  nearestLabel: string | null;
  nearestDistPct: number | null;
  targetUpsidePct: number | null;
  note: string | null;
}
interface ScanResponse {
  ready: boolean;
  updatedAt: string | null;
  universe?: number;
  counts: Record<string, number>;
  rows: ScanRow[];
}

const SETUP_META: Record<string, { label: string; cls: string }> = {
  touch_confirmed: { label: "🎯 터치+확인", cls: "border-emerald-700 bg-emerald-950/30 text-emerald-300" },
  touch_pending: { label: "🟡 터치·확인대기", cls: "border-amber-700 bg-amber-950/30 text-amber-300" },
  at_level: { label: "🔵 라인 위", cls: "border-sky-700 bg-sky-950/30 text-sky-300" },
  approaching: { label: "👀 근접", cls: "border-neutral-600 bg-neutral-900 text-neutral-300" },
};

function TechViewInner() {
  const params = useSearchParams();
  const [symbol, setSymbol] = useState("");
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<TechResponse | null>(null);

  // 앵커 수동 고정 (종목별로 브라우저에 저장) — 빗각 앵커는 주관적이라, 검증된
  // 자기 앵커를 박아두면 이후 그 종목은 항상 그 채널로 분석된다.
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [a3, setA3] = useState("");
  const [space, setSpace] = useState<"linear" | "log">("linear");
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [scanLoading, setScanLoading] = useState(true);

  const anchorKey = (sym: string) => `techview:anchors:${sym}`;

  const run = useCallback(async (sym: string, override?: { a1: string; a2: string; a3: string; space: "linear" | "log" }) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    // 저장된 앵커가 있으면 자동 적용
    let pinned = override;
    if (!pinned && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(anchorKey(s));
        if (raw) pinned = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }
    if (pinned) {
      setA1(pinned.a1);
      setA2(pinned.a2);
      setA3(pinned.a3);
      setSpace(pinned.space);
    }
    setRunning(true);
    setErr(null);
    try {
      const res = await fetch("/api/techview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          pinned && pinned.a1 && pinned.a2 && pinned.a3
            ? { symbol: s, anchors: [pinned.a1, pinned.a2, pinned.a3], space: pinned.space }
            : { symbol: s },
        ),
      });
      const raw = await res.text();
      let data: TechResponse | { error: string } | null = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!data) {
        setErr(
          res.status === 504 || res.status === 408
            ? "분석이 시간 내 완료되지 못했습니다. 잠시 후 다시 시도해 주세요."
            : `분석 서버 오류 (HTTP ${res.status}).`,
        );
      } else if ("error" in data) {
        setErr(data.error);
      } else {
        setReport(data);
      }
    } catch (e) {
      setErr(`요청 실패: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }, []);

  // ?symbol=XXX 로 들어오면 자동 분석 (Trade 탭의 [기술분석] 버튼 연동)
  useEffect(() => {
    const s = params.get("symbol")?.trim().toUpperCase();
    if (s && /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)) {
      setSymbol(s);
      run(s);
    }
  }, [params, run]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/techview-scan", { cache: "no-store" });
        const json = (await res.json()) as ScanResponse;
        if (alive) setScan(json);
      } catch {
        /* scanner is optional */
      } finally {
        if (alive) setScanLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">📐 Tech View · 기술분석</h1>
        <p className="text-xs text-neutral-500 mt-1">
          주봉 <b className="text-neutral-400">고고저 빗각 채널</b> + 갭하락 기준{" "}
          <b className="text-neutral-400">피보나치 되돌림</b> +{" "}
          <b className="text-neutral-400">라인 터치 확인</b>(밟아야 산다) → 갭 메움 목표까지의
          시나리오를 산출합니다.
        </p>
      </div>

      {/* 개별 티커 분석 */}
      <section className="border border-neutral-800 rounded-lg bg-neutral-950 p-4 space-y-3">
        <div className="text-sm font-semibold">티커 분석</div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") run(symbol);
            }}
            placeholder="TSLA"
            className="w-40 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => run(symbol)}
            disabled={running || !symbol.trim()}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded text-sm font-semibold"
          >
            {running ? "분석 중…" : "📐 기술분석"}
          </button>
        </div>
        {err && (
          <div className="border border-rose-800 bg-rose-950/50 text-rose-200 rounded p-3 text-sm">
            {err}
          </div>
        )}

        {/* 빗각 앵커 직접 고정 */}
        <details className="border border-neutral-800 rounded bg-neutral-900/40 px-3 py-2">
          <summary className="text-xs text-neutral-400 cursor-pointer">
            📐 빗각 앵커 직접 고정 (주봉 날짜 3개) — 자동 작도가 내 선과 다를 때
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              고-고-저 순서로 주봉 날짜를 넣으세요. ①② = 기울기를 정하는 같은 종류 두 지점
              (역사적 의미가 있는 고점 등), ③ = 1:1 채널 폭을 정하는 변곡점. 저장하면 이 종목은
              이후 항상 이 앵커로 분석됩니다. <b className="text-neutral-400">예: TSLA 2020-02-03 / 2020-06-08 / 2020-08-31 (linear)</b>
            </p>
            <div className="flex gap-2 flex-wrap items-center">
              {([["① 고", a1, setA1], ["② 고", a2, setA2], ["③ 변곡", a3, setA3]] as const).map(
                ([lb, v, set]) => (
                  <label key={lb} className="text-[11px] text-neutral-500">
                    {lb}
                    <input
                      value={v}
                      onChange={(e) => set(e.target.value)}
                      placeholder="2020-02-03"
                      className="ml-1 w-28 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200"
                    />
                  </label>
                ),
              )}
              <select
                value={space}
                onChange={(e) => setSpace(e.target.value as "linear" | "log")}
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
              >
                <option value="linear">선형(등간격)</option>
                <option value="log">로그(등비율)</option>
              </select>
              <button
                onClick={() => {
                  if (!symbol.trim() || !a1 || !a2 || !a3) return;
                  const v = { a1, a2, a3, space };
                  try {
                    window.localStorage.setItem(anchorKey(symbol.trim().toUpperCase()), JSON.stringify(v));
                  } catch {
                    /* ignore */
                  }
                  run(symbol, v);
                }}
                className="px-3 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
              >
                저장 + 분석
              </button>
              <button
                onClick={() => {
                  try {
                    window.localStorage.removeItem(anchorKey(symbol.trim().toUpperCase()));
                  } catch {
                    /* ignore */
                  }
                  setA1("");
                  setA2("");
                  setA3("");
                  run(symbol, undefined);
                }}
                className="px-3 py-1 text-xs text-neutral-400 hover:text-neutral-200"
              >
                고정 해제(자동)
              </button>
            </div>
          </div>
        </details>
      </section>

      {report && <TechReportCard r={report} />}

      {/* 스캐너 */}
      <section className="border border-neutral-800 rounded-lg bg-neutral-950 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">🔎 터치 셋업 스캐너 (일봉·주봉)</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              나스닥100 + 뉴욕100 중 핵심 라인(빗각·피보)에 터치했거나 근접한 종목
              {scan?.universe ? ` · ${scan.universe}종목 스캔` : ""}
            </p>
          </div>
          {scan?.updatedAt && (
            <div className="text-xs text-neutral-600">판정 {fmtUpdated(scan.updatedAt)} 기준</div>
          )}
        </div>

        {scanLoading && <p className="text-xs text-neutral-500 py-4">불러오는 중…</p>}
        {!scanLoading && (!scan || !scan.ready) && (
          <p className="text-xs text-neutral-500 py-4">
            데이터 준비 중 — 워커가 계산한 뒤(매일 장 마감 후) 표시됩니다. 그 전에는 위에서 티커를
            직접 입력해 분석하세요.
          </p>
        )}

        {!scanLoading && scan?.ready && (
          <>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {Object.entries(SETUP_META).map(([k, m]) => (
                <span key={k} className={`px-2 py-0.5 border rounded ${m.cls}`}>
                  {m.label} {scan.counts?.[k] ?? 0}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-0">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-2 sm:gap-x-3 text-[10px] text-neutral-500 pb-1 mb-0.5 border-b border-neutral-800">
                  <span>종목 · 섹터</span>
                  <span className="text-right">가격</span>
                  <span className="text-right">핵심라인</span>
                  <span className="text-right">갭목표</span>
                </div>
                {scan.rows.length === 0 ? (
                  <p className="text-xs text-neutral-600 py-2">해당 종목 없음</p>
                ) : (
                  scan.rows.map((r) => {
                    const m = SETUP_META[r.setup];
                    const sec = koSector(r.sector);
                    return (
                      <div
                        key={r.symbol}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-2 sm:gap-x-3 items-center py-1.5 text-xs sm:text-sm border-b border-neutral-800/40 last:border-0"
                      >
                        <div className="min-w-0">
                          <a
                            href={`/techview?symbol=${r.symbol}`}
                            className="font-semibold hover:underline"
                          >
                            {r.symbol}
                          </a>
                          <div className="text-[10px] leading-tight flex items-center gap-1 min-w-0">
                            {m && <span className={`shrink-0 ${m.cls.split(" ").pop()}`}>{m.label}</span>}
                            {sec && <span className="text-neutral-500 shrink-0">· {sec}</span>}
                            {r.note && (
                              <span className="text-neutral-500 truncate min-w-0">· {r.note}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-right tabular-nums text-neutral-300">
                          {r.price != null ? `$${r.price.toFixed(2)}` : "—"}
                        </span>
                        <span className="text-right tabular-nums text-neutral-400">
                          {r.nearestLabel ? (
                            <>
                              {r.nearestLabel}
                              {r.nearestDistPct != null && (
                                <span className="text-neutral-600">
                                  {" "}
                                  {r.nearestDistPct >= 0 ? "+" : ""}
                                  {r.nearestDistPct}%
                                </span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                        <span className="text-right tabular-nums text-sky-400">
                          {r.targetUpsidePct != null ? `+${r.targetUpsidePct}%` : "—"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        <p className="text-[11px] text-neutral-600 leading-relaxed">
          스캐너는 기계적 판정만 제공합니다(AI 시나리오 없음). 종목을 클릭하면 그 티커의 상세
          기술분석(AI 시나리오 포함)이 실행됩니다.
        </p>
      </section>
    </div>
  );
}

export default function TechViewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">불러오는 중…</p>}>
      <TechViewInner />
    </Suspense>
  );
}
