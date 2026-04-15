"use client";
import { useEffect, useRef, useState, memo, useCallback } from "react";
import { analyzeDiagonalChannel, type ChannelAnalysis } from "@/lib/chart-overlay";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  symbol: string;
  market?: string;
}

/**
 * 타임프레임 체계:
 * Yahoo Finance 제한사항 반영
 * - 1m: 최대 8일
 * - 5m: 최대 60일
 * - 15m: 최대 60일
 * - 60m(1h): 제한 없음
 * - 4h: 제한 없음 (Yahoo는 사실상 지원)
 * - 1d: 제한 없음
 * - 1wk: 제한 없음
 * - 1mo: 제한 없음
 */
const TIMEFRAMES = [
  { label: "1분",  interval: "1m",  range: "1d",  group: "intraday" },
  { label: "5분",  interval: "5m",  range: "5d",  group: "intraday" },
  { label: "15분", interval: "15m", range: "5d",  group: "intraday" },
  { label: "1시간", interval: "60m", range: "1mo", group: "intraday" },
  { label: "4시간", interval: "4h",  range: "6mo", group: "intraday" },
  { label: "일봉",  interval: "1d",  range: "6mo", group: "daily" },
  { label: "주봉",  interval: "1wk", range: "2y",  group: "weekly" },
  { label: "월봉",  interval: "1mo", range: "5y",  group: "monthly" },
];

const OVERLAY_STRATEGIES = [
  { id: "none", label: "없음", icon: "" },
  { id: "diagonal-channel", label: "빗각 채널", icon: "📐" },
];

function StockChart({ symbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);
  const [tfIdx, setTfIdx] = useState(5); // 기본: 일봉
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [chartData, setChartData] = useState<Candle[]>([]);
  const [overlayStrategy, setOverlayStrategy] = useState("none");
  const [showOverlayMenu, setShowOverlayMenu] = useState(false);
  const [channelInfo, setChannelInfo] = useState<ChannelAnalysis["info"] | null>(null);

  // 현재 TF 설정
  const tf = TIMEFRAMES[tfIdx];
  const currentRange = tf.range;
  const currentInterval = tf.interval;
  const isIntraday = ["1m", "5m", "15m", "60m", "4h"].includes(currentInterval);

  // 1) 데이터 fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/chart/${encodeURIComponent(symbol)}?range=${currentRange}&interval=${currentInterval}`)
      .then((res) => res.ok ? res.json() : Promise.reject(res.status))
      .then((data) => {
        if (!cancelled && data.candles?.length > 0) {
          setChartData(data.candles);
          setLoading(false);
        } else if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [symbol, currentRange, currentInterval]);

  // 2) 차트 렌더링
  const renderChart = useCallback(async () => {
    if (!containerRef.current || chartData.length === 0) return;

    const { createChart, CandlestickSeries, HistogramSeries, LineSeries } = await import("lightweight-charts");
    type UTCTimestamp = import("lightweight-charts").UTCTimestamp;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 360,
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(55, 65, 81, 0.3)" },
        horzLines: { color: "rgba(55, 65, 81, 0.3)" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "rgba(55, 65, 81, 0.5)" },
      timeScale: {
        borderColor: "rgba(55, 65, 81, 0.5)",
        timeVisible: isIntraday,
      },
    });
    chartRef.current = chart;

    // ── 캔들스틱 ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeries.setData(chartData.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open, high: c.high, low: c.low, close: c.close,
    })));

    // ── MA5 / MA20 ──
    if (chartData.length >= 5) {
      const ma5Series = chart.addSeries(LineSeries, {
        color: "#f59e0b", lineWidth: 1,
        crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
      });
      const ma5: { time: UTCTimestamp; value: number }[] = [];
      for (let i = 4; i < chartData.length; i++) {
        let sum = 0;
        for (let j = i - 4; j <= i; j++) sum += chartData[j].close;
        ma5.push({ time: chartData[i].time as UTCTimestamp, value: sum / 5 });
      }
      ma5Series.setData(ma5);
    }
    if (chartData.length >= 20) {
      const ma20Series = chart.addSeries(LineSeries, {
        color: "#6366f1", lineWidth: 1,
        crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
      });
      const ma20: { time: UTCTimestamp; value: number }[] = [];
      for (let i = 19; i < chartData.length; i++) {
        let sum = 0;
        for (let j = i - 19; j <= i; j++) sum += chartData[j].close;
        ma20.push({ time: chartData[i].time as UTCTimestamp, value: sum / 20 });
      }
      ma20Series.setData(ma20);
    }

    // ── 거래량 ──
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#6366f180",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeries.setData(chartData.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? "#22c55e40" : "#ef444440",
    })));

    // ══════════════════════════════════════
    // 차트 오버레이 (빗각 채널)
    // 빗각 채널은 주봉~일봉에서 가장 정확 (PDF: 주봉 기준 추천)
    // ══════════════════════════════════════
    if (overlayStrategy === "diagonal-channel" && chartData.length >= 30) {
      const analysis = analyzeDiagonalChannel(chartData);
      setChannelInfo(analysis.info);

      for (const channel of analysis.channels) {
        const upperSeries = chart.addSeries(LineSeries, {
          color: "rgba(245, 158, 11, 0.4)",
          lineWidth: 1, lineStyle: 2,
          crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
        });
        upperSeries.setData(channel.upper.map(p => ({ time: p.time as UTCTimestamp, value: p.value })));

        const lowerSeries = chart.addSeries(LineSeries, {
          color: "rgba(34, 197, 94, 0.4)",
          lineWidth: 1, lineStyle: 2,
          crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
        });
        lowerSeries.setData(channel.lower.map(p => ({ time: p.time as UTCTimestamp, value: p.value })));

        const midSeries = chart.addSeries(LineSeries, {
          color: "rgba(156, 163, 175, 0.15)",
          lineWidth: 1, lineStyle: 3,
          crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
        });
        midSeries.setData(channel.mid.map(p => ({ time: p.time as UTCTimestamp, value: p.value })));
      }

      if (analysis.markers.length > 0) {
        const { createSeriesMarkers } = await import("lightweight-charts");
        const sortedMarkers = analysis.markers
          .sort((a, b) => a.time - b.time)
          .map(m => ({
            time: m.time as UTCTimestamp,
            position: m.position,
            shape: m.shape,
            color: m.color,
            text: m.text,
          }));
        createSeriesMarkers(candleSeries, sortedMarkers);
      }
    } else {
      setChannelInfo(null);
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (el && chart) chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => { ro.disconnect(); chart.remove(); };
  }, [chartData, overlayStrategy, isIntraday]);

  useEffect(() => {
    renderChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [renderChart]);

  return (
    <div className="rounded-2xl overflow-hidden border border-dark-border bg-dark-card">
      {/* 타임프레임 통합 바 */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        <div className="flex gap-0.5 flex-1 overflow-x-auto no-scrollbar">
          {TIMEFRAMES.map((t, i) => (
            <button
              key={t.interval}
              onClick={() => setTfIdx(i)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                tfIdx === i ? "bg-accent text-white" : "bg-dark-border/50 text-dark-muted hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* 오버레이 전략 버튼 */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowOverlayMenu(!showOverlayMenu)}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition ${overlayStrategy !== "none" ? "bg-amber-500 text-white" : "bg-dark-border/50 text-dark-muted"}`}
          >
            {overlayStrategy !== "none" ? "📐" : "📊"}
          </button>
          {showOverlayMenu && (
            <div className="absolute right-0 top-9 bg-dark-card border border-dark-border rounded-xl shadow-xl z-20 py-1 min-w-[120px]">
              {OVERLAY_STRATEGIES.map((s) => (
                <button key={s.id} onClick={() => { setOverlayStrategy(s.id); setShowOverlayMenu(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-[10px] font-semibold transition ${overlayStrategy === s.id ? "text-accent" : "text-dark-muted hover:text-white"}`}
                >{s.icon} {s.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-between px-3 pb-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-dark-muted">
            <span className="w-3 h-0.5 bg-yellow-500 inline-block rounded" /> MA5
          </span>
          <span className="flex items-center gap-1 text-[10px] text-dark-muted">
            <span className="w-3 h-0.5 bg-accent inline-block rounded" /> MA20
          </span>
          {overlayStrategy === "diagonal-channel" && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <span className="w-3 h-0.5 bg-amber-400 inline-block rounded" /> 채널
            </span>
          )}
        </div>
        <span className="text-[9px] text-dark-muted">{tf.range}</span>
      </div>

      {/* 빗각 채널 분석 정보 */}
      {channelInfo && (
        <div className="mx-3 mb-2 p-2.5 bg-dark-bg/80 rounded-xl border border-dark-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-amber-400">📐 빗각 채널 분석</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              channelInfo.currentZone.includes("매수") ? "bg-up/20 text-up" :
              channelInfo.currentZone.includes("매도") ? "bg-down/20 text-down" :
              channelInfo.currentZone.includes("익절") ? "bg-amber-500/20 text-amber-400" :
              "bg-dark-border text-dark-muted"
            }`}>
              {channelInfo.currentZone}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <p className="text-[9px] text-dark-muted">목표 매도가</p>
              <p className="text-[11px] font-bold text-up">{channelInfo.targetPrice?.toLocaleString() || "-"}</p>
            </div>
            <div>
              <p className="text-[9px] text-dark-muted">50% 익절</p>
              <p className="text-[11px] font-bold text-amber-400">{channelInfo.halfTarget?.toLocaleString() || "-"}</p>
            </div>
            <div>
              <p className="text-[9px] text-dark-muted">손절가</p>
              <p className="text-[11px] font-bold text-down">{channelInfo.stopLoss?.toLocaleString() || "-"}</p>
            </div>
            <div>
              <p className="text-[9px] text-dark-muted">손익비</p>
              <p className={`text-[11px] font-bold ${(channelInfo.riskReward || 0) >= 2 ? "text-up" : (channelInfo.riskReward || 0) >= 1 ? "text-yellow-400" : "text-down"}`}>
                {channelInfo.riskReward ? `1:${channelInfo.riskReward.toFixed(1)}` : "-"}
              </p>
            </div>
          </div>
          {channelInfo.slopePerBar !== null && channelInfo.slopePerBar !== 0 && (
            <p className="text-[9px] text-dark-muted mt-1.5 border-t border-dark-border/30 pt-1">
              채널 기울기: {channelInfo.slopePerBar > 0 ? "↗" : "↘"} 봉당 {Math.abs(channelInfo.slopePerBar).toFixed(4)}
              {channelInfo.slopePerBar < 0 && " (우하향 → 시간경과시 목표가 하락)"}
            </p>
          )}
        </div>
      )}

      {/* 시그널 가이드 (빗각 채널 활성 시에만 표시) */}
      {channelInfo && (
        <div className="mx-3 mb-2 p-3 bg-dark-bg/60 rounded-xl border border-dark-border/30">
          <p className="text-[10px] font-bold text-dark-muted mb-2">차트 시그널 가이드</p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-[11px] shrink-0">🟡 피봇1,2</span>
              <p className="text-[9px] text-dark-muted">빗각 채널의 기준이 되는 두 개의 의미있는 고점입니다. 역사적 최고점과 거래량 동반 변곡점을 연결하여 채널 기울기를 결정합니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[11px] shrink-0">🟢 채널 하단 매수</span>
              <p className="text-[9px] text-dark-muted">가격이 채널 하단(85% 이하)에 닿은 후 다음 봉에서 양봉 반등이 나온 시점입니다. 손익비가 가장 좋은 매수 타점입니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[11px] shrink-0">🟢 쌍바닥 매수</span>
              <p className="text-[9px] text-dark-muted">채널 하단에서 반등 + 최근 10~30봉 내 비슷한 가격대 저점이 존재(더블바텀). 일반 하단 매수보다 신뢰도가 높습니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[11px] shrink-0">🔴 채널 상단 매도</span>
              <p className="text-[9px] text-dark-muted">가격이 채널 상단(15% 이내)에 도달 후 다음 봉에서 음봉이 나온 시점입니다. 목표가 도달로 매도가 권장됩니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[11px] shrink-0">🟠 50% 익절</span>
              <p className="text-[9px] text-dark-muted">채널 중간(하프라인, 35~55%) 도달 시 보유분의 50%를 분할매도하는 시점입니다. 수익 확보 후 나머지는 상단까지 홀딩합니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[11px] shrink-0">🔥 매수/매도 타점</span>
              <p className="text-[9px] text-dark-muted">현재(최신) 봉 기준 실시간 시그널입니다. 채널 위치에 따라 지금 매수 또는 매도가 유리한 구간임을 나타냅니다.</p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-dark-border/30 space-y-1">
            <p className="text-[9px] text-dark-muted">
              <span className="text-amber-400">━━</span> 채널 상단선 &nbsp;
              <span className="text-up">━━</span> 채널 하단선 &nbsp;
              <span className="text-gray-500">┈┈</span> 채널 중간선(하프)
            </p>
            <p className="text-[9px] text-dark-muted">
              ※ 빗각 채널은 우하향 기울기일 때 시간이 지날수록 목표가가 낮아집니다. 주봉·일봉에서 가장 정확합니다.
            </p>
          </div>
        </div>
      )}

      {/* 차트 영역 */}
      <div style={{ height: 360, position: "relative" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <p className="text-sm text-dark-muted mb-2">차트 데이터를 불러올 수 없습니다</p>
            <p className="text-[10px] text-dark-muted mb-2">({tf.label} 데이터를 불러오지 못했습니다)</p>
            <button onClick={() => setTfIdx(5)} className="text-xs text-accent font-semibold">일봉으로 전환</button>
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}

export default memo(StockChart);
