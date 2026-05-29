"use client";

// 강세 섹터 (leading sectors) panel — self-fetching market-context block for
// the dashboard. Ranks curated sector/theme baskets by the mean today-return
// of their real constituents, exposes per-sector top-5 by 거래량(volume) and
// 거래대금(dollar-volume), a relative-volume (자금 유입) badge, and a context
// news headline. Honest about its method and limits (see the footnote it
// renders + lib/sectorBaskets.ts).

import { useEffect, useRef, useState } from "react";

interface StockRow {
  symbol: string;
  price: number;
  changePct: number | null;
  volume: number;
  dollarVolume: number;
  relVol: number | null;
}

interface Headline {
  headline: string;
  source: string;
  url: string;
  createdAt: string;
}

interface SectorRow {
  key: string;
  labelKo: string;
  labelEn: string;
  etf: string | null;
  kind: "sector" | "theme";
  avgReturn: number | null;
  etfReturn: number | null;
  breadthUp: number;
  breadthTotal: number;
  totalDollarVolume: number;
  relVol: number | null;
  pricedCount: number;
  topByVolume: StockRow[];
  topByDollarVolume: StockRow[];
  headline: Headline | null;
}

interface SectorStrengthResponse {
  asOf: string;
  session: "pre" | "regular" | "after" | "closed";
  relVolProjected: boolean;
  sectorCount: number;
  sectors: SectorRow[];
}

type SortKey = "strength" | "dollar";

const SESSION_LABEL: Record<SectorStrengthResponse["session"], string> = {
  pre: "프리마켓 · 실시간",
  regular: "장중 · 실시간",
  after: "애프터마켓 · 실시간",
  closed: "장마감 · 최근 세션 기준",
};

function pctText(v: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}

function pctColor(v: number | null): string {
  if (v == null || !isFinite(v)) return "text-neutral-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-neutral-400";
}

function relVolText(v: number | null): string {
  if (v == null || !isFinite(v) || v <= 0) return "—";
  return `${v.toFixed(1)}×`;
}

/** Color the relative-volume by how unusual it is. */
function relVolColor(v: number | null): string {
  if (v == null || !isFinite(v)) return "text-neutral-600";
  if (v >= 2) return "text-amber-300";
  if (v >= 1.3) return "text-amber-400/80";
  if (v >= 0.8) return "text-neutral-400";
  return "text-neutral-600";
}

/** Compact USD: $1.2B / $345M / $12K. */
function money(v: number): string {
  if (!isFinite(v) || v <= 0) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/** Compact share count: 12.3M / 345K / 1,234. */
function shares(v: number): string {
  if (!isFinite(v) || v <= 0) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

/** "3시간 전" style relative time. */
function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.round(hrs / 24)}일 전`;
}

function MiniTable({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: StockRow[];
  metric: "volume" | "dollarVolume";
}) {
  return (
    <div className="flex-1 min-w-[210px]">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">{title}</div>
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-600">데이터 없음</p>
      ) : (
        <ol className="space-y-0.5">
          {rows.map((r, i) => (
            <li key={r.symbol} className="flex items-center gap-2 text-xs">
              <span className="text-neutral-600 w-3 text-right">{i + 1}</span>
              <a
                href={`/ticker/${r.symbol}`}
                className="font-medium text-neutral-200 hover:text-sky-300 w-14"
              >
                {r.symbol}
              </a>
              <span className="text-neutral-400 tabular-nums w-16 text-right">
                {metric === "volume" ? shares(r.volume) : money(r.dollarVolume)}
              </span>
              <span
                className={`tabular-nums w-10 text-right ${relVolColor(r.relVol)}`}
                title="상대 거래량 (평균 대비)"
              >
                {relVolText(r.relVol)}
              </span>
              <span className={`tabular-nums w-16 text-right ${pctColor(r.changePct)}`}>
                {pctText(r.changePct)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SectorRowItem({
  row,
  rank,
  expanded,
  onToggle,
}: {
  row: SectorRow;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const breadthPct =
    row.breadthTotal > 0 ? Math.round((row.breadthUp / row.breadthTotal) * 100) : null;
  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-900/60 transition-colors text-left"
      >
        <span
          className={`text-sm font-bold tabular-nums w-6 text-center ${
            rank <= 3 ? "text-amber-300" : "text-neutral-500"
          }`}
        >
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-neutral-100">{row.labelKo}</span>
            {row.kind === "theme" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-900/60">
                테마
              </span>
            )}
            <span className="text-[11px] text-neutral-600">{row.labelEn}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-500 flex-wrap">
            <span>거래대금 {money(row.totalDollarVolume)}</span>
            {row.relVol != null && (
              <span className={relVolColor(row.relVol)}>· 거래량 {relVolText(row.relVol)} 평균</span>
            )}
            {breadthPct != null && (
              <span>
                · 상승 {row.breadthUp}/{row.breadthTotal} ({breadthPct}%)
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-base font-bold tabular-nums ${pctColor(row.avgReturn)}`}>
            {pctText(row.avgReturn)}
          </div>
          <div className="text-[10px] text-neutral-600">평균 등락</div>
        </div>
        <span className="text-neutral-600 text-xs w-4 text-center">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="border-t border-neutral-800 bg-neutral-950/40 px-3 py-3">
          <div className="flex gap-6 flex-wrap">
            <MiniTable title="거래량 TOP 5" rows={row.topByVolume} metric="volume" />
            <MiniTable title="거래대금 TOP 5" rows={row.topByDollarVolume} metric="dollarVolume" />
          </div>

          {row.headline && (
            <a
              href={row.headline.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded border border-neutral-800 bg-neutral-900/40 px-2.5 py-2 hover:border-neutral-700"
            >
              <div className="text-[10px] uppercase tracking-wide text-neutral-600 mb-0.5">
                📰 참고 뉴스 · 순위와 무관
              </div>
              <div className="text-xs text-neutral-300 leading-snug">{row.headline.headline}</div>
              <div className="text-[10px] text-neutral-600 mt-0.5">
                {row.headline.source} · {ago(row.headline.createdAt)}
              </div>
            </a>
          )}

          <div className="mt-2 text-[11px] text-neutral-600">
            {row.etf ? (
              <>
                기준 ETF{" "}
                <a href={`/ticker/${row.etf}`} className="text-neutral-400 hover:text-sky-300">
                  {row.etf}
                </a>{" "}
                {row.etfReturn != null && (
                  <span className={pctColor(row.etfReturn)}>{pctText(row.etfReturn)}</span>
                )}
                <span className="text-neutral-700"> · </span>
              </>
            ) : (
              <span className="text-neutral-700">전용 ETF 없음 · </span>
            )}
            <span className="text-neutral-700">구성 {row.pricedCount}종목 평가</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SectorStrengthPanel() {
  const [data, setData] = useState<SectorStrengthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("strength");
  const [refreshing, setRefreshing] = useState(false);
  const didAutoExpand = useRef(false);

  // Fetch (initial + interval refresh). Preserves expand/sort state across
  // refreshes; only auto-expands the leader once, on first successful load.
  useEffect(() => {
    let cancelled = false;

    const load = (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      fetch("/api/sector-strength")
        .then((r) => r.json())
        .then((d: SectorStrengthResponse | { error: string }) => {
          if (cancelled) return;
          if ("error" in d) {
            setError(d.error);
          } else {
            setError(null);
            setData(d);
            if (!didAutoExpand.current && d.sectors[0]) {
              setExpanded(new Set([d.sectors[0].key]));
              didAutoExpand.current = true;
            }
          }
        })
        .catch((e) => !cancelled && setError((e as Error).message))
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
          setRefreshing(false);
        });
    };

    load(false);
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-refresh every 60s while the market is active (pre/regular/after).
  // Closed → data won't change, so we don't poll.
  const session = data?.session;
  useEffect(() => {
    if (!session || session === "closed") return;
    const id = setInterval(() => {
      fetch("/api/sector-strength")
        .then((r) => r.json())
        .then((d: SectorStrengthResponse | { error: string }) => {
          if (!("error" in d)) {
            setData(d);
            setError(null);
          }
        })
        .catch(() => {
          /* keep last good data on a transient refresh failure */
        });
    }, 60_000);
    return () => clearInterval(id);
  }, [session]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const sorted = [...(data?.sectors ?? [])].sort((a, b) => {
    if (sortBy === "dollar") return b.totalDollarVolume - a.totalDollarVolume;
    if (a.avgReturn == null) return 1;
    if (b.avgReturn == null) return -1;
    return b.avgReturn - a.avgReturn;
  });
  const visible = showAll ? sorted : sorted.slice(0, 5);

  return (
    <section className="border border-amber-900/50 bg-amber-950/[0.07] rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-sm font-semibold text-amber-200">
          🔥 강세 섹터 · 실시간 자금 흐름
          {refreshing && <span className="ml-2 text-[10px] text-neutral-600">갱신 중…</span>}
        </h2>
        {data && (
          <span className="text-[11px] text-neutral-500">
            {SESSION_LABEL[data.session]} · {new Date(data.asOf).toLocaleTimeString("ko-KR")}
            {data.session !== "closed" && <span className="text-neutral-600"> · 60초 자동갱신</span>}
          </span>
        )}
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        각 섹터·테마 <span className="text-neutral-300">구성 종목의 당일 평균 등락률</span>로 강세를 측정하고,
        섹터별로 <span className="text-neutral-300">거래량·거래대금 상위 5종목</span>을 노출합니다.
      </p>

      {/* Sort toggle */}
      {data && !loading && (
        <div className="flex items-center gap-2 text-[11px] mb-3">
          <span className="text-neutral-600">정렬:</span>
          {(
            [
              ["strength", "강세순"],
              ["dollar", "거래대금순"],
            ] as Array<[SortKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2 py-0.5 border rounded ${
                sortBy === key
                  ? "border-amber-600 text-amber-200 bg-amber-950/40"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">섹터 시세 불러오는 중…</p>}
      {error && !data && (
        <div className="border border-rose-800 bg-rose-950/40 text-rose-200 rounded p-2 text-xs">
          섹터 데이터를 불러오지 못했습니다: {error}
        </div>
      )}

      {data && !loading && (
        <>
          <div className="space-y-1.5">
            {visible.map((row, i) => (
              <SectorRowItem
                key={row.key}
                row={row}
                rank={i + 1}
                expanded={expanded.has(row.key)}
                onToggle={() => toggle(row.key)}
              />
            ))}
          </div>

          {sorted.length > 5 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
            >
              {showAll ? "상위 5개만 보기 ▴" : `전체 ${sorted.length}개 섹터·테마 보기 ▾`}
            </button>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-neutral-600 border-t border-neutral-800/80 pt-2">
            ⚠️ 가격은 Alpaca 무료 IEX(실시간), <b className="text-neutral-500">거래량은 통합 거래소 일봉</b>(장중 약 15분 지연) 기준. <b className="text-neutral-500">강세</b> = 구성 종목 당일 등락률 평균(상승
            종목 수로 신뢰도 확인), <b className="text-neutral-500">거래대금</b> = 당일 거래량 × 현재가,{" "}
            <b className="text-neutral-500">상대 거래량(N×)</b> = {data.relVolProjected ? "당일 거래량을 장중 진행률로 환산한 추정치를 " : ""}
            20일 평균 대비{data.relVolProjected ? " 비교" : ""} (프리마켓은 비교 불가로 제외). 뉴스는 강세 <b className="text-neutral-500">이유 참고용</b>이며 순위 산정에는 쓰지 않습니다.
            큐레이션된 {data.sectorCount}개 섹터·테마만 평가하므로 목록에 없는 신생 테마는 자동으로 잡히지 않습니다.
          </p>
        </>
      )}
    </section>
  );
}
