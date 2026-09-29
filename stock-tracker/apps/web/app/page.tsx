"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import RiskPlanner from "@/app/components/RiskPlanner";
import { buildShortlist, type ScanCandidate } from "@/lib/investmentDesk";
import { koSector, fmtUpdated } from "@/app/stats/scannerShared";

interface Quality {
  status: string;
  reasons?: string[];
}
interface RegimeData {
  regime: "risk_on" | "neutral" | "risk_off" | null;
  price?: number;
  asOf?: string;
  barDate?: string;
  pctFromSma200?: number | null;
  vix?: number | null;
  vixDate?: string | null;
  reasons?: string[];
  dataQuality?: Quality;
  error?: string;
}
interface ScanData {
  ready: boolean;
  session: string;
  updatedAt: string | null;
  universe?: number;
  pullback: ScanCandidate[];
  forming: ScanCandidate[];
  dataQuality?: Quality;
}
const marketCopy = {
  risk_on: {
    label: "상승 추세",
    detail:
      "QQQ의 이동평균 조건을 충족했습니다. 개별 종목의 진입 조건은 별도로 확인하세요.",
    tone: "positive",
  },
  neutral: {
    label: "혼조 구간",
    detail:
      "추세 조건이 일치하지 않습니다. 조건이 명확해질 때까지 관찰할 수 있습니다.",
    tone: "caution",
  },
  risk_off: {
    label: "위험 확대",
    detail:
      "추세 또는 변동성 경고가 있습니다. 보유 위험과 손실 한도를 먼저 확인하세요.",
    tone: "negative",
  },
};

export default function InvestmentDesk() {
  const [regime, setRegime] = useState<RegimeData | null>(null);
  const [scan, setScan] = useState<ScanData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  const [now, setNow] = useState(0);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const read = async <T,>(url: string): Promise<T> => {
      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return res.json();
    };
    const results = await Promise.allSettled([
      read<RegimeData>("/api/regime"),
      read<ScanData>("/api/pullback-scan"),
    ]);
    clearTimeout(timeout);
    if (request.current !== controller) return;
    setRegime(results[0].status === "fulfilled" ? results[0].value : null);
    setScan(results[1].status === "fulfilled" ? results[1].value : null);
    setErrors(
      results.flatMap((r, i) =>
        r.status === "rejected"
          ? [i === 0 ? "시장 데이터 조회 실패" : "후보 데이터 조회 실패"]
          : [],
      ),
    );
    setNow(Date.now());
    setLastChecked(new Date().toISOString());
    setLoading(false);
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 180_000);
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);

  const usable =
    !!regime?.regime &&
    !regime.error &&
    !["stale", "unavailable"].includes(
      regime.dataQuality?.status ?? "unavailable",
    );
  const market = usable && regime?.regime ? marketCopy[regime.regime] : null;
  const shortlist = buildShortlist(scan?.pullback ?? [], now);
  const blocked = !usable || regime?.regime === "risk_off" || !scan?.ready;
  const candidates = blocked ? [] : shortlist.candidates;
  const total = (scan?.pullback?.length ?? 0) + (scan?.forming?.length ?? 0);

  return (
    <div className="desk">
      <div className="desk-heading">
        <div>
          <p className="eyebrow">INVESTMENT WORKSPACE</p>
          <h1>
            판단은 선명하게,
            <br className="sm:hidden" /> 위험은 먼저.
          </h1>
          <p className="desk-subtitle">미국주식 관찰 · 진입 계획 · 매매 복기</p>
        </div>
        <button className="desk-button" onClick={refresh} disabled={loading}>
          {loading ? "확인 중…" : "데이터 새로고침 ↻"}
        </button>
      </div>
      <section className="decision-strip" aria-live="polite">
        <div
          className={`status-dot ${loading ? "" : (market?.tone ?? "caution")}`}
        />
        <div>
          <strong>
            {loading
              ? "데이터를 확인하고 있습니다"
              : !usable
                ? "지금은 데이터 확인이 먼저입니다"
                : regime?.regime === "risk_off"
                  ? "오늘은 보유 위험부터 점검하세요"
                  : candidates.length
                    ? `조건을 충족한 ${candidates.length}개 종목을 검토할 수 있습니다`
                    : "엄격한 조건을 충족한 검토 후보가 없습니다"}
          </strong>
          <p>
            {loading
              ? "가격 기준 시각과 조건 충족 여부를 함께 확인합니다."
              : "조건에 맞는 종목이 없으면 관찰로 끝내도 됩니다. 표시 순서는 기대수익 순위가 아닙니다."}
          </p>
        </div>
        <Link href="/methodology" className="text-link">
          판정 기준 ↗
        </Link>
      </section>
      <div className="desk-top-grid">
        <section className="desk-card">
          <div className="section-heading">
            <h2>
              <span className="step">01</span>시장 환경
            </h2>
            <span className={`desk-badge ${market?.tone ?? "caution"}`}>
              {loading ? "확인 중" : (market?.label ?? "판단 보류")}
            </span>
          </div>
          <p className="card-description">
            {regime?.dataQuality?.status === "partial"
              ? "최신 VIX가 확인되지 않았습니다. 확인된 가격·추세와 함께 추가 위험 신호를 점검하세요."
              : (market?.detail ??
                "가격이 오래되거나 필요한 데이터가 없으면 시장 방향을 확정하지 않습니다.")}
          </p>
          <div className="market-metrics">
            <div>
              <span>QQQ 기준가</span>
              <strong>
                {usable && regime?.price ? `$${regime.price.toFixed(2)}` : "—"}
              </strong>
            </div>
            <div>
              <span>200일선 이격</span>
              <strong>
                {usable && regime?.pctFromSma200 != null
                  ? `${(regime.pctFromSma200 * 100).toFixed(1)}%`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>VIX · 일별 관측</span>
              <strong>
                {usable && regime?.vix != null ? regime.vix.toFixed(1) : "—"}
              </strong>
            </div>
          </div>
          <p className="data-caption">
            QQQ 완료 일봉 {regime?.barDate ?? "확인 불가"} · 뉴욕 거래일
            {regime?.vixDate ? ` · VIX ${regime.vixDate}` : " · VIX 미확인"}
          </p>
          {regime?.reasons?.length ? (
            <details className="desk-details">
              <summary>시장 판단 근거</summary>
              <ul>
                {[
                  ...regime.reasons,
                  ...(regime.dataQuality?.reasons ?? []),
                ].map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
        <section className="desk-card">
          <div className="section-heading">
            <h2>데이터 상태</h2>
            <span className="tiny-label">SOURCE CHECK</span>
          </div>
          <div className="quality-line">
            <span>시장 추세</span>
            <span
              className={
                usable && regime?.dataQuality?.status === "fresh"
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            >
              {loading
                ? "확인 중"
                : usable
                  ? regime?.dataQuality?.status === "partial"
                    ? "일부 데이터 미확인"
                    : "기준 시각 확인"
                  : "사용 보류"}
            </span>
          </div>
          <div className="quality-line">
            <span>15분봉 관찰 목록</span>
            <span>
              {scan?.ready
                ? `${scan.universe ?? "—"}종목 · ${scan.dataQuality?.status === "fresh" ? "시각 확인" : "시각 재확인 필요"}`
                : loading
                  ? "확인 중"
                  : "수집 확인 필요"}
            </span>
          </div>
          <div className="quality-line">
            <span>전략의 수익성</span>
            <span className="text-amber-300">검증 전</span>
          </div>
          <p className="data-caption">
            Alpaca 지연 SIP 봉 / IEX 시세 · FRED. IEX는 일부 거래소
            데이터입니다. AI 점수는 수익 확률이 아닙니다.
          </p>
          <p className="data-caption">
            화면 조회 {fmtUpdated(lastChecked) || "—"} KST · 조회 시각과 시세
            시각은 다릅니다.
          </p>
          {errors.length > 0 && (
            <p role="alert" className="text-xs text-amber-300 mt-3">
              {errors.join(" · ")}. 잠시 후 새로고침해 주세요.
            </p>
          )}
        </section>
      </div>
      <section className="desk-card">
        <div className="section-heading">
          <h2>
            <span className="step">02</span>오늘의 검토 목록{" "}
            <span className="count-pill">
              {loading ? "—" : candidates.length}
            </span>
          </h2>
          <Link href="/research" className="text-link">
            전체 탐색 ↗
          </Link>
        </div>
        <p className="card-description">
          시세 45분 이내 · 5개 기술 조건 모두 충족 · 최대 5개, 같은 섹터 최대
          2개. 실적 일정·유동성·손익비는 종목별 추가 확인이 필요합니다.
        </p>
        {loading ? (
          <div className="desk-empty">
            후보의 기준 시각을 확인하는 중입니다.
          </div>
        ) : candidates.length === 0 ? (
          <div className="desk-empty">
            <span className="empty-mark">—</span>
            <h3>
              {blocked
                ? "검토 목록을 보류했습니다"
                : "기다림도 하나의 판단입니다"}
            </h3>
            <p>
              {!usable
                ? "시장 데이터가 확인되면 후보 검토를 다시 시작합니다."
                : regime?.regime === "risk_off"
                  ? "위험 확대 구간에서는 자동으로 신규 검토 목록을 제시하지 않습니다."
                  : "시각이 불명확하거나 오래된 데이터, 미완성 조건은 검토 목록에서 제외합니다."}
            </p>
          </div>
        ) : (
          <div className="candidate-list">
            {candidates.map((r) => (
              <div className="candidate-row" key={r.symbol}>
                <div>
                  <Link
                    className="candidate-symbol"
                    href={`/trade?symbol=${encodeURIComponent(r.symbol)}`}
                  >
                    {r.symbol} ↗
                  </Link>
                  <p>{koSector(r.sector) || "섹터 미분류"}</p>
                </div>
                <div>
                  <span>판정 기준가</span>
                  <strong>${r.price!.toFixed(2)}</strong>
                </div>
                <div>
                  <span>시세 기준 · KST</span>
                  <strong className="!text-xs">
                    {fmtUpdated(r.asOf ?? null)}
                  </strong>
                </div>
                <Link
                  className="desk-button small"
                  href={`/trade?symbol=${encodeURIComponent(r.symbol)}`}
                >
                  근거 확인
                </Link>
              </div>
            ))}
          </div>
        )}
        <div className="candidate-footer">
          <span>
            관찰 원본 {scan?.ready ? `${total}개` : "미확인"} · 확인 대기{" "}
            {scan?.forming?.length ?? 0}개 · 시각/가격 제외{" "}
            {shortlist.excludedData}개 · 조건 미충족 {shortlist.excludedRules}개
          </span>
          <span>조건 충족은 매수 확정 신호가 아닙니다.</span>
        </div>
        <form className="symbol-search" action="/trade">
          <label htmlFor="desk-symbol">직접 종목 검토</label>
          <input
            id="desk-symbol"
            name="symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="예: AAPL"
            maxLength={10}
            pattern="[A-Z][A-Z0-9.\-]{0,9}"
            required
            autoComplete="off"
          />
          <button
            className="desk-button small"
            disabled={!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)}
          >
            분석 열기 ↗
          </button>
        </form>
      </section>
      <div className="section-heading mt-8">
        <h2>
          <span className="step">03</span>진입 전에 손실 한도 정하기
        </h2>
        <span className="tiny-label">RISK BEFORE RETURN</span>
      </div>
      <RiskPlanner />
      <section className="desk-card review-card">
        <div>
          <p className="eyebrow">04 · REVIEW YOUR PROCESS</p>
          <h2>내가 지킨 계획이 수익으로 이어졌는지.</h2>
          <p className="card-description">
            진입 근거와 무효화 가격을 매매 기록에 남기고, 청산 후 실제 손익을
            확인하세요. AI의 방향 적중과 내 계좌의 수익은 별도로 봅니다.
          </p>
        </div>
        <div className="review-links">
          <Link className="desk-button primary" href="/stats">
            매매 기록 · 성과 복기 ↗
          </Link>
          <Link className="text-link" href="/methodology">
            숫자를 읽는 방법
          </Link>
        </div>
      </section>
      <p className="desk-footnote">
        이 도구는 판단 근거와 위험을 정리합니다. 전략의 초과수익은 검증되지
        않았으며, 손절 주문도 갭·슬리피지로 계획한 손실을 초과할 수 있습니다.
      </p>
    </div>
  );
}
