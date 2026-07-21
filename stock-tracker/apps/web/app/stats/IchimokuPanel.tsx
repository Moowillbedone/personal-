"use client";

// 일목균형표 선행스팬 B 터치 스캐너 — dashboard block, parallel to Sma200Panel.
// Of the NASDAQ-100 + NYSE-100 universe, which names sit RIGHT ON their
// Ichimoku Leading Span B (선행스팬 B) — the longer, stickier cloud edge?
//   🟢 스팬B 위 터치 = 지지 후보 (구름 위에서 지지받는 그림)
//   🟡 스팬B 아래 터치 = 저항·주의 (구름 아래로 눌린 그림)
// Span B (52-hi+lo)/2 is projected 26 bars forward — the value drawn under
// today's price. Spans are precomputed daily by the worker (sma200_scan.py);
// this only reads the table + live snapshots via /api/ichimoku.

import { useEffect, useState } from "react";
import {
  SESSION_LABEL,
  changeText,
  changeColor,
  koSector,
  fmtUpdated,
  SCANNER_GRID as GRID,
  type MarketSession,
} from "@/app/stats/scannerShared";

type Cloud = "above" | "in" | "below" | null;

interface Row {
  symbol: string;
  sector: string | null;
  price: number;
  spanB: number;
  spanA: number | null;
  distPct: number; // signed percent
  changePct: number | null; // signed percent
  cloud: Cloud;
}

interface Side {
  above: Row[];
  below: Row[];
}

interface IchimokuResponse {
  session: MarketSession;
  band: number;
  ready: boolean;
  degraded?: boolean;
  priced?: number;
  updatedAt: string | null;
  universeDaily?: number;
  universeWeekly?: number;
  daily: Side;
  weekly: Side;
}

type Tab = "daily" | "weekly";

function cloudLabel(c: Cloud): { label: string; color: string } | null {
  switch (c) {
    case "above":
      return { label: "구름 위", color: "text-emerald-400" };
    case "below":
      return { label: "구름 아래", color: "text-red-400" };
    case "in":
      return { label: "구름 속", color: "text-amber-400" };
    default:
      return null;
  }
}

function RowList({ rows, tone }: { rows: Row[]; tone: "buy" | "warn" }) {
  const distColor = tone === "buy" ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-0">
        <div
          className={`${GRID} text-[10px] text-neutral-500 pb-1 mb-0.5 border-b border-neutral-800`}
        >
          <span>종목 · 섹터 · 구름</span>
          <span className="text-right">현재가</span>
          <span className="text-right hidden sm:block">스팬B</span>
          <span className="text-right">이격도</span>
          <span className="text-right">당일</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-neutral-600 py-2">해당 종목 없음</p>
        ) : (
          rows.map((r) => {
            const sec = koSector(r.sector);
            const cl = cloudLabel(r.cloud);
            return (
              <div
                key={r.symbol}
                className={`${GRID} items-center py-1.5 text-xs sm:text-sm border-b border-neutral-800/40 last:border-0`}
              >
                <div className="min-w-0">
                  <a
                    href={`/trade?symbol=${r.symbol}`}
                    className="font-semibold hover:underline"
                  >
                    {r.symbol}
                  </a>
                  {(sec || cl) && (
                    <div className="text-[10px] text-neutral-500 leading-tight truncate">
                      {sec}
                      {sec && cl ? " · " : ""}
                      {cl && <span className={cl.color}>{cl.label}</span>}
                    </div>
                  )}
                </div>
                <span className="text-right tabular-nums text-neutral-300">
                  ${r.price.toFixed(2)}
                </span>
                <span className="text-right tabular-nums text-neutral-600 hidden sm:block">
                  {r.spanB.toFixed(2)}
                </span>
                <span className={`text-right tabular-nums ${distColor}`}>
                  {r.distPct >= 0 ? "+" : ""}
                  {r.distPct.toFixed(2)}%
                </span>
                <span
                  className={`text-right tabular-nums ${changeColor(r.changePct)}`}
                >
                  {changeText(r.changePct)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function IchimokuPanel() {
  const [tab, setTab] = useState<Tab>("daily");
  const [data, setData] = useState<IchimokuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/ichimoku", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as IchimokuResponse;
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const side = data ? (tab === "daily" ? data.daily : data.weekly) : null;
  const bandPct = data ? (data.band * 100).toFixed(1) : "3.0";
  const tfLabel = tab === "weekly" ? "주봉" : "일봉";
  const universeCount = data
    ? tab === "weekly"
      ? data.universeWeekly
      : data.universeDaily
    : undefined;

  return (
    <section className="border border-neutral-800 rounded-lg bg-neutral-950 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">☁️ 일목균형표 · 선행스팬B 터치 스캐너</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            나스닥100 + 뉴욕100 중 선행스팬B ±{bandPct}% 이내 근접 종목
            {universeCount ? ` · ${tfLabel} ${universeCount}종목 계산` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          {data && <div>{SESSION_LABEL[data.session]}</div>}
          {data?.updatedAt && (
            <div className="text-neutral-600">스팬값 {fmtUpdated(data.updatedAt)} 기준</div>
          )}
        </div>
      </div>

      {/* 일봉/주봉 토글 */}
      <div className="flex gap-1">
        {(
          [
            { k: "daily", label: "일봉 스팬B" },
            { k: "weekly", label: "주봉 스팬B" },
          ] as { k: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`text-xs px-3 py-1.5 rounded border ${
              tab === t.k
                ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 각 수치 의미 범례 */}
      <div className="text-[11px] text-neutral-500 leading-relaxed border border-neutral-800/70 rounded bg-neutral-900/40 px-2.5 py-1.5">
        <b className="text-neutral-300">이격도</b> = 현재가가 {tfLabel} 선행스팬B에서 벗어난 정도
        <span className="text-neutral-600">(+ 위 / − 아래, 0%에 가까울수록 스팬B에 “터치”)</span>
        {" · "}
        <b className="text-neutral-300">당일</b> = 오늘 등락률
        {" · "}
        <b className="text-neutral-300">스팬B</b> = 선행스팬B 값
        {" · "}
        <b className="text-neutral-300">구름</b> = 가격의 구름(Kumo) 위치(<span className="text-emerald-400">위</span>=강세 / <span className="text-amber-400">속</span>=중립 / <span className="text-red-400">아래</span>=약세)
      </div>

      {loading && <p className="text-xs text-neutral-500 py-4">불러오는 중…</p>}
      {error && (
        <p className="text-xs text-red-400 py-4">불러오기 실패: {error}</p>
      )}
      {data && !data.ready && !loading && (
        <p className="text-xs text-neutral-500 py-4">
          데이터 준비 중 — 다음 계산(장 마감 후, 매일 KST 06:30) 이후 표시됩니다.
        </p>
      )}
      {data && data.ready && data.degraded && !loading && (
        <p className="text-xs text-amber-400 py-4">
          시세 조회 일시 실패 — 잠시 후 새로고침 해주세요. (스팬값은 정상,
          실시간 가격 피드만 일시 지연)
        </p>
      )}

      {data && data.ready && !data.degraded && side && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded border border-emerald-900/50 bg-emerald-950/20 p-3">
            <h3 className="text-xs font-semibold text-emerald-300 mb-1">
              🟢 스팬B 위 터치 · 지지 후보 ({side.above.length})
            </h3>
            <p className="text-[11px] text-neutral-500 mb-1">
              선행스팬B 위에서 지지받는 자리 — 특히 “구름 위”면 강세 지지
            </p>
            <RowList rows={side.above} tone="buy" />
          </div>
          <div className="rounded border border-amber-900/50 bg-amber-950/20 p-3">
            <h3 className="text-xs font-semibold text-amber-300 mb-1">
              🟡 스팬B 아래 터치 · 저항·주의 ({side.below.length})
            </h3>
            <p className="text-[11px] text-neutral-500 mb-1">
              선행스팬B 아래로 눌린 자리 — 구름이 저항, 반등 시 매물 주의
            </p>
            <RowList rows={side.below} tone="warn" />
          </div>
        </div>
      )}

      <p className="text-[11px] text-neutral-600 leading-relaxed">
        선행스팬B = 최근 52기간 (고+저)/2 를 <b>26기간 앞으로 투영</b>한 값 — 오늘
        가격이 실제로 닿는 구름 하단/상단. 스팬A보다 주기가 길어 매물대로서
        신뢰도가 높습니다(표준 9/26/52/26). 매일 장 마감 후 일봉·주봉 각각 계산
        (액면분할 조정). 참고 지표이며 매매 판단의 책임은 본인에게 있습니다.
      </p>
    </section>
  );
}
