// GET /api/regime — market-regime indicator for the swing console dashboard.
//
// Why: the user's own experience (2026-07 pivot): day trading works in
// up-markets, swing works better in down/chop — and averaging down a 2x
// leveraged ETF in a confirmed downtrend is the account-killer. So the
// console needs ONE authoritative traffic light that (a) recommends the
// trading mode and (b) gates the prescription engine's 물타기 rule.
//
// Method (free-tier friendly, no new dependencies):
//   - QQQ daily bars (~380d) from Alpaca → SMA20/50/200, 5d/20d returns,
//     20d realized volatility (annualized).
//   - VIX latest close from FRED (optional — fail-soft when FRED_API_KEY
//     is unset or the fetch fails; trend rules alone still classify).
//
// Classification (trend first, VIX as modifier):
//   risk_on : price > SMA50 AND SMA50 > SMA200 AND (VIX < 20 or unknown)
//   risk_off: price < SMA200 OR VIX >= 28
//   neutral : everything else (above 200d but below 50d, elevated VIX, ...)
//
// Caching: module-level 5-min TTL. The dashboard is the only consumer and
// regime changes on a daily timescale — no reason to hit Alpaca/FRED per
// page load (also keeps us far from rate limits).

import { NextResponse } from "next/server";
import { fetchAlpacaBars } from "@/lib/alpaca";
import { getMacroSnapshot } from "@/lib/fred";
import { completedDailyBars, dailyBarsQuality, type DataQuality } from "@/lib/dataQuality";
import { lastCompletedTradingDate, nyClock } from "@/lib/marketCalendar";
import type { Regime } from "@/lib/prescription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BENCH = "QQQ"; // NDX proxy — matches the NASDAQ-100 focus of the pivot
const CACHE_TTL_MS = 5 * 60 * 1000;

interface RegimePayload {
  asOf: string;
  barDate: string;
  calculatedAt: string;
  dataQuality: DataQuality;
  source: string;
  regime: Regime;
  benchmark: string;
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  pctFromSma20: number | null;
  pctFromSma50: number | null;
  pctFromSma200: number | null;
  ret5d: number | null;
  ret20d: number | null;
  realizedVol20d: number | null; // annualized fraction, e.g. 0.22 = 22%
  vix: number | null;
  vixDate: string | null;
  reasons: string[];
}

let cache: { data: RegimePayload; at: number } | null = null;

function smaLast(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  const tail = closes.slice(-n);
  return tail.reduce((a, b) => a + b, 0) / n;
}

function pctFrom(price: number, ref: number | null): number | null {
  if (ref == null || ref === 0) return null;
  return (price - ref) / ref;
}

function retOver(closes: number[], n: number): number | null {
  if (closes.length < n + 1) return null;
  const then = closes[closes.length - 1 - n];
  if (!then) return null;
  return (closes[closes.length - 1] - then) / then;
}

function realizedVol(closes: number[], n: number): number | null {
  if (closes.length < n + 1) return null;
  const tail = closes.slice(-(n + 1));
  const rets: number[] = [];
  for (let i = 1; i < tail.length; i++) {
    if (tail[i - 1] > 0) rets.push(Math.log(tail[i] / tail[i - 1]));
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({ ...cache.data, cached: true });
    }

    const [rawBars, macro] = await Promise.all([
      fetchAlpacaBars(BENCH, "1Day", 420, 420, "split"),
      getMacroSnapshot().catch(() => null), // fail-soft: null when FRED off/down
    ]);

    const bars = completedDailyBars(rawBars);
    const dataQuality = dailyBarsQuality(bars, 200);
    if (dataQuality.status !== "fresh") {
      return NextResponse.json({
        error: "시장 환경 계산에 필요한 최신 일봉을 확인할 수 없습니다.",
        regime: null, benchmark: BENCH, asOf: dataQuality.asOf, dataQuality,
      }, { status: 503 });
    }

    const closes = bars.map((b) => b.c);
    const price = closes[closes.length - 1];
    const sma20 = smaLast(closes, 20);
    const sma50 = smaLast(closes, 50);
    const sma200 = smaLast(closes, 200);
    const vixDate = macro?.vix?.date ?? null;
    const vixFresh = vixDate != null && vixDate >= lastCompletedTradingDate();
    const vix = vixFresh && Number.isFinite(macro?.vix?.value) ? macro!.vix!.value : null;
    if (vix == null) {
      dataQuality.status = "partial";
      dataQuality.reasons.push("최신 완료 거래일의 VIX를 확인하지 못해 적극적 위험 선호 판단을 보류합니다.");
    }

    const reasons: string[] = [];
    let regime: Regime;

    const above200 = sma200 != null ? price > sma200 : null;
    const above50 = sma50 != null ? price > sma50 : null;
    const goldenStack = sma50 != null && sma200 != null ? sma50 > sma200 : null;

    if (above200 === false) {
      regime = "risk_off";
      reasons.push(`${BENCH}가 200일선 아래 (장기 추세 기준 하회)`);
    } else if (vix != null && vix >= 28) {
      regime = "risk_off";
      reasons.push(`VIX ${vix.toFixed(1)} ≥ 28 (높은 변동성)`);
    } else if (above50 === true && goldenStack === true && (vix != null && vix < 20)) {
      regime = "risk_on";
      reasons.push(`${BENCH} > 50일선 > 200일선 (정배열 상승추세)`);
      if (vix != null) reasons.push(`VIX ${vix.toFixed(1)} < 20 (안정)`);
    } else {
      regime = "neutral";
      if (above50 === false) reasons.push(`${BENCH}가 50일선 아래 (단기 모멘텀 약화)`);
      if (goldenStack === false) reasons.push("50일선 < 200일선 (역배열)");
      if (vix != null && vix >= 20) reasons.push(`VIX ${vix.toFixed(1)} ≥ 20 (변동성 상승)`);
      if (vix == null) reasons.push("VIX 최신값 미확인 — 중립으로 제한");
      if (reasons.length === 0) reasons.push("추세 신호 혼조");
    }

    const data: RegimePayload = {
      asOf: bars[bars.length - 1].ts,
      barDate: nyClock(new Date(bars[bars.length - 1].ts)).date,
      calculatedAt: new Date().toISOString(),
      dataQuality,
      source: "Alpaca SIP · 분할 조정 · 완료 일봉",
      regime,
      benchmark: BENCH,
      price,
      sma20,
      sma50,
      sma200,
      pctFromSma20: pctFrom(price, sma20),
      pctFromSma50: pctFrom(price, sma50),
      pctFromSma200: pctFrom(price, sma200),
      ret5d: retOver(closes, 5),
      ret20d: retOver(closes, 20),
      realizedVol20d: realizedVol(closes, 20),
      vix,
      vixDate,
      reasons,
    };
    cache = { data, at: Date.now() };
    return NextResponse.json({ ...data, cached: false });
  } catch (err) {
    return NextResponse.json(
      { error: "시장 데이터를 불러오지 못했습니다.", regime: null, dataQuality: { status: "unavailable", asOf: null, reasons: ["가격 공급자 응답을 확인하지 못했습니다."] } },
      { status: 503 },
    );
  }
}
