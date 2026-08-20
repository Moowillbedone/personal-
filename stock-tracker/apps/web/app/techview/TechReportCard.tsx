"use client";

// 기술분석 리포트 카드 — /techview 탭과 Trade 탭에서 공용으로 쓰는 결과 카드.
// 갭 · 피보나치 · 주봉 고고저 빗각 채널 · 터치 이벤트를 기계적 사실로 보여주고,
// 그 위에 AI 시나리오(진입/대기/목표)를 얹는다. 데이터는 /api/techview.

export interface TechGap {
  date: string;
  kind: "up" | "down";
  top: number;
  bottom: number;
  sizePct: number;
  filledPct: number;
  filled: boolean;
}
export interface TechFib {
  anchorHigh: number;
  anchorHighDate: string;
  anchorLow: number;
  anchorLowDate: string;
  anchoredOnGap: boolean;
  levels: { ratio: number; label: string; price: number }[];
}
export interface TechDiagonal {
  kind: "고고저" | "저저고";
  slopeLogPerWeek: number;
  anchor1: { ts: string; price: number };
  anchor2: { ts: string; price: number };
  anchor3: { ts: string; price: number };
  space: "linear" | "log";
  manual: boolean;
  widthRatio: number;
  lines: { label: string; price: number; half: boolean }[];
  nearest: { label: string; price: number; distPct: number } | null;
  touchScore: number;
  touchScoreNorm: number;
  reactionRate: number;
  reactionSample: number;
}
export interface TechTouch {
  level: { label: string; price: number; source: string };
  date: string;
  barsAgo: number;
  wickRatio: number;
  confirmed: boolean;
}
export interface TechAnalysisDto {
  symbol: string;
  price: number;
  asOf: string;
  gaps: TechGap[];
  targetGap: TechGap | null;
  fib: TechFib | null;
  diagonal: TechDiagonal | null;
  resistChannel: TechDiagonal | null;
  touches: TechTouch[];
  setup: string;
  nearestDistPct: number | null;
  nearestLabel: string | null;
  targetUpsidePct: number | null;
  notes: string[];
}
export interface TechPlan {
  entryLow: number;
  entryHigh: number;
  stop: number;
  target1: number;
  target2: number;
  rr: number | null;
}
export interface TechResponse {
  symbol: string;
  session: string | null;
  livePrice: number | null;
  earnings: { date: string; daysUntil: number } | null;
  tech: TechAnalysisDto;
  setupLabel: string;
  ai: {
    headline: string;
    summary: string;
    scenario: string;
    confidence: number;
    cautions: string[];
  };
  plan: TechPlan | null;
}

const SETUP_STYLE: Record<string, string> = {
  touch_confirmed: "border-emerald-700 bg-emerald-950/40 text-emerald-200",
  touch_pending: "border-amber-700 bg-amber-950/40 text-amber-200",
  at_level: "border-sky-700 bg-sky-950/40 text-sky-200",
  approaching: "border-neutral-600 bg-neutral-900/60 text-neutral-200",
  extended: "border-neutral-700 bg-neutral-900/50 text-neutral-400",
  no_structure: "border-neutral-700 bg-neutral-900/50 text-neutral-400",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "rose" | "emerald" }) {
  const c = tone === "rose" ? "text-rose-300" : tone === "emerald" ? "text-emerald-300" : "text-neutral-200";
  return (
    <div className="border border-neutral-800 rounded px-2 py-1.5">
      <div className="text-[10px] text-neutral-500">{label}</div>
      <div className={`font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

export default function TechReportCard({ r }: { r: TechResponse }) {
  const t = r.tech;
  const style = SETUP_STYLE[t.setup] ?? SETUP_STYLE.approaching;
  const d = t.diagonal;

  return (
    <section className="border border-neutral-800 rounded-lg bg-neutral-950 overflow-hidden">
      <div className={`border-b p-4 ${style}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-bold">
            {r.symbol} · {r.setupLabel}
          </span>
          <span className="text-xs opacity-80">신뢰도 {(r.ai.confidence * 100).toFixed(0)}%</span>
        </div>
        {r.ai.headline && <p className="text-sm mt-1 font-semibold">{r.ai.headline}</p>}
        <p className="text-xs mt-1 opacity-80">
          기준가 ${t.price} ({t.asOf} 일봉 종가)
          {r.livePrice != null && r.livePrice !== t.price ? ` · 현재 $${r.livePrice.toFixed(2)}` : ""}
        </p>
        {r.earnings && r.earnings.daysUntil <= 7 && (
          <p className="text-xs mt-1 text-amber-300">
            ⚠️ 어닝 D-{r.earnings.daysUntil} ({r.earnings.date})
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {r.ai.summary && <p className="text-sm leading-relaxed text-neutral-200">{r.ai.summary}</p>}

        {r.ai.scenario && (
          <div className="rounded border border-sky-800 bg-sky-950/40 px-3 py-2">
            <span className="text-[11px] uppercase tracking-wider text-sky-400">지금 할 일</span>
            <p className="text-sm text-sky-100 mt-0.5">{r.ai.scenario}</p>
          </div>
        )}

        {/* 주봉 고고저 빗각 */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
            📐 주봉 {d?.kind ?? "고고저"} 빗각 채널 ({d?.space === "log" ? "로그" : "선형"} · 1:1)
            {d?.manual && <span className="ml-1 text-sky-400">· 내 앵커 고정</span>}
          </div>
          {d ? (
            <>
              <div className="text-[11px] text-neutral-500 mb-1">
                앵커 {d.anchor1.ts}(${d.anchor1.price}) → {d.anchor2.ts}(${d.anchor2.price}) 기울기 ·{" "}
                {d.anchor3.ts}(${d.anchor3.price}) 평행 · 폭 {d.widthRatio}
                {d.space === "log" ? "×" : "$"} ·{" "}
                <span className="text-neutral-400">
                  과거 터치 {d.touchScore}회 · <b>반응률 {d.reactionRate}%</b>
                  {d.reactionSample > 0 ? ` (n=${d.reactionSample})` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.lines.map((l) => {
                  const isNear = d.nearest?.label === l.label;
                  return (
                    <span
                      key={l.label}
                      className={`text-xs px-2 py-0.5 border rounded ${
                        isNear
                          ? "border-sky-600 bg-sky-950/50 text-sky-200"
                          : l.half
                            ? "border-neutral-800 bg-neutral-900/60 text-neutral-500"
                            : "border-neutral-700 bg-neutral-900 text-neutral-400"
                      }`}
                    >
                      {l.label} <span className="tabular-nums">${l.price}</span>
                      {isNear && d.nearest ? (
                        <span className="text-neutral-500">
                          {" "}
                          ({d.nearest.distPct >= 0 ? "+" : ""}
                          {d.nearest.distPct}%)
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-neutral-600">주봉 데이터/피벗 부족으로 빗각 산출 불가</p>
          )}
        </div>

        {/* 피보나치 */}
        {t.fib && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
              📊 피보나치 되돌림 (관찰 레벨 — 진입 트리거 아님)
            </div>
            <div className="text-[11px] text-neutral-500 mb-1">
              고점 ${t.fib.anchorHigh} ({t.fib.anchorHighDate}
              {t.fib.anchoredOnGap ? " · 갭하락 캔들" : ""}) → 저점 ${t.fib.anchorLow} (
              {t.fib.anchorLowDate})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.fib.levels.map((l) => {
                const key = l.ratio === 0.382 || l.ratio === 0.618;
                return (
                  <span
                    key={l.label}
                    className={`text-xs px-2 py-0.5 border rounded ${
                      key
                        ? "border-amber-700/70 bg-amber-950/30 text-amber-200"
                        : "border-neutral-700 bg-neutral-900 text-neutral-400"
                    }`}
                  >
                    {l.label} <span className="tabular-nums">${l.price}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 갭 */}
        {t.gaps.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
              🕳 갭 (목표 구간)
            </div>
            <ul className="space-y-1 text-xs">
              {t.gaps.slice(0, 4).map((g) => (
                <li key={g.date} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-neutral-500">{g.date}</span>
                  <span className={g.kind === "down" ? "text-rose-400" : "text-emerald-400"}>
                    {g.kind === "down" ? "갭하락" : "갭상승"} {g.sizePct}%
                  </span>
                  <span className="text-neutral-300 tabular-nums">
                    ${g.bottom}~${g.top}
                  </span>
                  <span className={g.filled ? "text-neutral-600" : "text-sky-400"}>
                    {g.filledPct}% 메움{g.filled ? " (충족)" : " (미충족)"}
                  </span>
                </li>
              ))}
            </ul>
            {t.targetGap && (
              <p className="text-[11px] text-sky-300 mt-1">
                🎯 목표 갭 ${t.targetGap.bottom}~${t.targetGap.top}
                {t.targetUpsidePct != null ? ` · 현재가 대비 +${t.targetUpsidePct}%` : ""}
              </p>
            )}
          </div>
        )}

        {/* 터치 이벤트 */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
            👣 라인 터치 (&ldquo;밟아야 산다&rdquo;)
          </div>
          {t.touches.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {t.touches.map((tc, i) => (
                <li key={`${tc.date}-${i}`} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-neutral-500">{tc.date}</span>
                  <span className="text-neutral-200">
                    {tc.level.label} ${tc.level.price}
                  </span>
                  <span className="text-neutral-500">아래꼬리 {(tc.wickRatio * 100).toFixed(0)}%</span>
                  <span className={tc.confirmed ? "text-emerald-400" : "text-amber-400"}>
                    {tc.confirmed ? "✅ 확인 양봉" : "⏳ 확인 대기"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-600">
              최근 10봉 내 핵심 라인 터치 없음 — 아직 &ldquo;밟지&rdquo; 않았습니다
              {t.nearestLabel && t.nearestDistPct != null
                ? ` (가장 가까운 ${t.nearestLabel}까지 ${t.nearestDistPct >= 0 ? "+" : ""}${t.nearestDistPct}%)`
                : ""}
            </p>
          )}
        </div>

        {/* 플랜 */}
        {r.plan && (
          <div className="rounded border border-neutral-700 bg-neutral-900/50 p-3">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1.5">
              매매 플랜 (터치 매매 기준)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <Stat label="진입(밟을 자리)" value={`$${r.plan.entryLow}~${r.plan.entryHigh}`} />
              <Stat label="손절" value={`$${r.plan.stop}`} tone="rose" />
              <Stat label="목표1 / 2" value={`$${r.plan.target1} / $${r.plan.target2}`} tone="emerald" />
              <Stat label="손익비 R:R" value={r.plan.rr != null ? `${r.plan.rr}` : "—"} />
            </div>
          </div>
        )}

        {r.ai.cautions?.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-1">주의</div>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-neutral-400">
              {r.ai.cautions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-neutral-600 leading-relaxed">
          갭·피보나치·터치는 일봉(액면분할 조정)에서, 빗각 채널은 주봉 피벗에서 기계적으로 산출됩니다.
          빗각은 작도 기준(앵커 선택)에 따라 달라질 수 있어 절대적 가격이 아니라 <b>구간</b>으로 보세요.
          참고 지표이며 매매 판단·책임은 본인에게 있습니다.
        </p>
      </div>
    </section>
  );
}
