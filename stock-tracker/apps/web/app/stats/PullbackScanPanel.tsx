"use client";

// 눌림목 스캐너 — dashboard block. Of the NASDAQ-100 + NYSE-100 universe, which
// names are (15분봉) 🟢 눌림목 지지(pullback, buyable) or 🟡 형성 중(forming, watch)?
// Classification is recomputed every ~15 min during the US session (incl.
// pre-market) by worker/pullback_intraday.py; this reads /api/pullback-scan.
// The live multi-timeframe analysis (1m~1d) is on the Trade tab — click a symbol.

import { useEffect, useState } from "react";
import {
  SESSION_LABEL,
  changeText,
  changeColor,
  koSector,
  fmtUpdated,
  type MarketSession,
} from "@/app/stats/scannerShared";

interface Row {
  symbol: string;
  sector: string | null;
  price: number | null;
  changePct: number | null;
  retrace: number | null; // percent
  grades: string | null; // "trend,volume,structure,support,confirmation"
}

interface ScanResponse {
  session: MarketSession;
  ready: boolean;
  degraded?: boolean;
  priced?: number;
  updatedAt: string | null;
  universe?: number;
  counts: { pullback: number; forming: number; downtrend: number; no_uptrend: number };
  pullback: Row[];
  forming: Row[];
}

const GRADE_ICON: Record<string, string> = { pass: "✅", warn: "⚠️", fail: "❌" };
const CRITERIA_SHORT = ["추세", "량", "구조", "지지", "확인"];

const GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-2 sm:gap-x-3";

function Grades({ grades }: { grades: string | null }) {
  if (!grades) return <span className="text-neutral-600">—</span>;
  const g = grades.split(",");
  return (
    <span className="tabular-nums tracking-tight" title={g.map((x, i) => `${CRITERIA_SHORT[i]}:${x}`).join(" · ")}>
      {g.map((x, i) => (
        <span key={i}>{GRADE_ICON[x] ?? "·"}</span>
      ))}
    </span>
  );
}

function RowList({ rows, tone }: { rows: Row[]; tone: "buy" | "watch" }) {
  const retrColor = tone === "buy" ? "text-emerald-400" : "text-amber-400";
  return (
    <div className="overflow-x-auto">
      <div className="min-w-0">
        <div className={`${GRID} text-[10px] text-neutral-500 pb-1 mb-0.5 border-b border-neutral-800`}>
          <span>종목 · 섹터 · 되돌림</span>
          <span className="text-right">현재가</span>
          <span className="text-right">당일</span>
          <span className="text-right">5기준 ①②③④⑤</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-neutral-600 py-2">해당 종목 없음</p>
        ) : (
          rows.map((r) => {
            const sec = koSector(r.sector);
            return (
              <div key={r.symbol} className={`${GRID} items-center py-1.5 text-xs sm:text-sm border-b border-neutral-800/40 last:border-0`}>
                <div className="min-w-0">
                  <a href={`/trade?symbol=${r.symbol}`} className="font-semibold hover:underline">{r.symbol}</a>
                  <div className="text-[10px] text-neutral-500 leading-tight truncate">
                    {sec}
                    {sec && r.retrace != null ? " · " : ""}
                    {r.retrace != null && <span className={retrColor}>되돌림 {r.retrace}%</span>}
                  </div>
                </div>
                <span className="text-right tabular-nums text-neutral-300">{r.price != null ? `$${r.price.toFixed(2)}` : "—"}</span>
                <span className={`text-right tabular-nums ${changeColor(r.changePct)}`}>{changeText(r.changePct)}</span>
                <span className="text-right"><Grades grades={r.grades} /></span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function PullbackScanPanel() {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/pullback-scan", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ScanResponse;
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

  return (
    <section className="border border-neutral-800 rounded-lg bg-neutral-950 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">🎯 눌림목 스캐너 (15분봉 · 장중 갱신)</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            나스닥100 + 뉴욕100 중 상승추세 내 건강한 눌림 후보
            {data?.universe ? ` · ${data.universe}종목 스캔` : ""}
            {data?.counts ? ` · 하락 ${data.counts.downtrend}·무추세 ${data.counts.no_uptrend} 제외` : ""}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          {data && <div>{SESSION_LABEL[data.session]}</div>}
          {data?.updatedAt && <div className="text-neutral-600">판정 {fmtUpdated(data.updatedAt)} 갱신</div>}
        </div>
      </div>

      <div className="text-[11px] text-neutral-500 leading-relaxed border border-neutral-800/70 rounded bg-neutral-900/40 px-2.5 py-1.5 space-y-1">
        <div>
          <b className="text-neutral-300">5기준 아이콘</b> — 왼쪽→오른쪽 순서 · <span className="text-emerald-400">✅ 충족</span> · <span className="text-amber-400">⚠️ 주의</span> · <span className="text-red-400">❌ 위반</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-neutral-400">
          <span><b className="text-neutral-300">①</b> 추세 (상승추세인가)</span>
          <span><b className="text-neutral-300">②</b> 거래량 (마름 vs 붙음)</span>
          <span><b className="text-neutral-300">③</b> 저점구조 (되돌림·저점유지)</span>
          <span><b className="text-neutral-300">④</b> 지지밀집 (의미있는 자리)</span>
          <span><b className="text-neutral-300">⑤</b> 확인캔들 (반응 왔나)</span>
        </div>
        <div className="text-neutral-600">
          되돌림 = 직전 상승분 대비 눌린 깊이 · 종목 클릭 → Trade 탭 <b className="text-neutral-500">실시간 멀티 타임프레임</b> 정밀 분석
        </div>
      </div>

      {loading && <p className="text-xs text-neutral-500 py-4">불러오는 중…</p>}
      {error && <p className="text-xs text-red-400 py-4">불러오기 실패: {error}</p>}
      {data && !data.ready && !loading && (
        <p className="text-xs text-neutral-500 py-4">
          데이터 준비 중 — 미국 세션 중(프리장 포함) 약 15분마다 갱신됩니다.
        </p>
      )}
      {data && data.ready && data.degraded && !loading && (
        <p className="text-xs text-amber-400 py-4">시세 조회 일시 실패 — 잠시 후 새로고침 해주세요.</p>
      )}

      {data && data.ready && !data.degraded && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded border border-emerald-900/50 bg-emerald-950/20 p-3">
            <h3 className="text-xs font-semibold text-emerald-300 mb-1">
              🟢 눌림목 지지 · 진입 후보 ({data.counts.pullback})
            </h3>
            <p className="text-[11px] text-neutral-500 mb-1">추세·거래량·저점·지지·확인 대체로 충족</p>
            <RowList rows={data.pullback} tone="buy" />
          </div>
          <div className="rounded border border-amber-900/50 bg-amber-950/20 p-3">
            <h3 className="text-xs font-semibold text-amber-300 mb-1">
              🟡 형성 중 · 확인 대기 ({data.counts.forming})
            </h3>
            <p className="text-[11px] text-neutral-500 mb-1">추세는 살아있으나 확인캔들 등 미완 — 관망</p>
            <RowList rows={data.forming} tone="watch" />
          </div>
        </div>
      )}

      <p className="text-[11px] text-neutral-600 leading-relaxed">
        15분봉 기준 기계적 판정이며, 미국 세션 동안(프리장 포함) 약 15분마다 갱신됩니다(데이터 ~15분 지연).
        &ldquo;지지 후보&rdquo;도 진입 전 Trade 탭에서 멀티 타임프레임 확인을 권합니다. 참고 지표이며 매매 판단·책임은 본인에게 있습니다.
      </p>
    </section>
  );
}
