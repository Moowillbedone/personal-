"use client";

// 200일선 터치 스캐너 — dashboard block. Of the NASDAQ-100 + NYSE-100 universe,
// which names sit RIGHT ON their 200-period line (일봉/주봉 토글)?
//   🟢 선 위 터치 = 매수 후보 (장기 추세선 위 지지)
//   🟡 선 아래 터치 = 장기 주의 (추세선 아래로 눌림)
// SMA200 is precomputed daily by the worker; this only reads the table + live
// snapshots via /api/sma200. See that route + worker/sma200_scan.py.

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

interface Row {
  symbol: string;
  sector: string | null; // raw finnhubIndustry (mapped to Korean at render)
  price: number;
  sma200: number;
  distPct: number; // signed percent, e.g. +1.8 / −0.9
  changePct: number | null; // signed percent (당일등락)
}

interface Side {
  above: Row[];
  below: Row[];
}

interface Sma200Response {
  session: MarketSession;
  band: number;
  ready: boolean;
  degraded?: boolean; // true = live price feed failed (not a genuine empty scan)
  priced?: number;
  updatedAt: string | null;
  universe?: number;
  daily: Side;
  weekly: Side;
}

type Tab = "daily" | "weekly";

function RowList({ rows, tone }: { rows: Row[]; tone: "buy" | "warn" }) {
  const distColor = tone === "buy" ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-0">
        <div
          className={`${GRID} text-[10px] text-neutral-500 pb-1 mb-0.5 border-b border-neutral-800`}
        >
          <span>종목 · 섹터</span>
          <span className="text-right">현재가</span>
          <span className="text-right hidden sm:block">200선</span>
          <span className="text-right">이격도</span>
          <span className="text-right">당일</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-neutral-600 py-2">해당 종목 없음</p>
        ) : (
          rows.map((r) => (
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
                {koSector(r.sector) && (
                  <div className="text-[10px] text-neutral-500 leading-tight truncate">
                    {koSector(r.sector)}
                  </div>
                )}
              </div>
              <span className="text-right tabular-nums text-neutral-300">
                ${r.price.toFixed(2)}
              </span>
              <span className="text-right tabular-nums text-neutral-600 hidden sm:block">
                {r.sma200.toFixed(2)}
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
          ))
        )}
      </div>
    </div>
  );
}

export default function Sma200Panel() {
  const [tab, setTab] = useState<Tab>("daily");
  const [data, setData] = useState<Sma200Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/sma200", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Sma200Response;
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

  return (
    <section className="border border-neutral-800 rounded-lg bg-neutral-950 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">📈 200일선 터치 스캐너</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            나스닥100 + 뉴욕100 중 SMA200 ±{bandPct}% 이내 근접 종목
            {data?.universe ? ` · ${data.universe}종목 계산` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          {data && <div>{SESSION_LABEL[data.session]}</div>}
          {data?.updatedAt && (
            <div className="text-neutral-600">선값 {fmtUpdated(data.updatedAt)} 기준</div>
          )}
        </div>
      </div>

      {/* 일봉/주봉 토글 */}
      <div className="flex gap-1">
        {(
          [
            { k: "daily", label: "일봉 200일선" },
            { k: "weekly", label: "주봉 200일선" },
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
        <b className="text-neutral-300">이격도</b> = 현재가가 {tab === "weekly" ? "주봉" : "일봉"} 200일선에서 벗어난 정도
        <span className="text-neutral-600">(+ 위 / − 아래, 0%에 가까울수록 선에 “터치”)</span>
        {" · "}
        <b className="text-neutral-300">당일</b> = 오늘 등락률
        {" · "}
        <b className="text-neutral-300">200선</b> = SMA200 값
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
          시세 조회 일시 실패 — 잠시 후 새로고침 해주세요. (200일선 값은 정상,
          실시간 가격 피드만 일시 지연)
        </p>
      )}

      {data && data.ready && !data.degraded && side && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded border border-emerald-900/50 bg-emerald-950/20 p-3">
            <h3 className="text-xs font-semibold text-emerald-300 mb-1">
              🟢 선 위 터치 · 매수 후보 ({side.above.length})
            </h3>
            <p className="text-[11px] text-neutral-500 mb-1">
              200일선 위에서 지지받는 자리
            </p>
            <RowList rows={side.above} tone="buy" />
          </div>
          <div className="rounded border border-amber-900/50 bg-amber-950/20 p-3">
            <h3 className="text-xs font-semibold text-amber-300 mb-1">
              🟡 선 아래 터치 · 장기 주의 ({side.below.length})
            </h3>
            <p className="text-[11px] text-neutral-500 mb-1">
              추세선 아래로 눌린 자리 — 반등매수 가능하나 조심
            </p>
            <RowList rows={side.below} tone="warn" />
          </div>
        </div>
      )}

      <p className="text-[11px] text-neutral-600 leading-relaxed">
        SMA200은 매일 장 마감 후 일봉/주봉 각각 200개 종가(액면분할 조정)로
        계산됩니다. 섹터는 참고용 대분류. 참고 지표이며 매매 판단의 책임은
        본인에게 있습니다.
      </p>
    </section>
  );
}
