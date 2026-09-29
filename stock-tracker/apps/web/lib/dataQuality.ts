import { lastCompletedTradingDate, nyClock, type MarketSession } from "./marketCalendar";

export interface DataQuality {
  status: "fresh" | "stale" | "unavailable" | "partial";
  asOf: string | null;
  checkedAt: string;
  ageSeconds: number | null;
  reasons: string[];
}

export function timestampQuality(asOf: string | null | undefined, maxAgeMs: number, now = new Date()): DataQuality {
  const time = asOf ? Date.parse(asOf) : NaN;
  const age = now.getTime() - time;
  const valid = Number.isFinite(time) && age >= -60_000;
  const stale = valid && age > maxAgeMs;
  return {
    status: !valid ? "unavailable" : stale ? "stale" : "fresh",
    asOf: valid ? asOf! : null,
    checkedAt: now.toISOString(),
    ageSeconds: valid ? Math.max(0, Math.floor(age / 1000)) : null,
    reasons: !valid ? ["유효한 원천 데이터 시각이 없습니다."] : stale ? ["원천 데이터의 허용 지연 시간을 초과했습니다."] : [],
  };
}

export function snapshotQuality(asOf: string | null, price: number | null, session: MarketSession, now = new Date()): DataQuality {
  const q = timestampQuality(asOf, session === "regular" ? 2 * 60_000 : session === "closed" ? 4 * 86_400_000 : 5 * 60_000, now);
  if (price == null || !Number.isFinite(price) || price <= 0) {
    q.status = "unavailable";
    q.reasons.push("유효한 거래 가격이 없습니다.");
  }
  if (session === "closed") {
    if (q.status === "fresh") q.status = "partial";
    q.reasons.push("장 마감 중의 마지막 관측 가격입니다. 주문 가격은 증권사에서 다시 확인하세요.");
  }
  return q;
}

export function dailyBarsQuality(bars: { ts: string; c: number }[], minimum: number, now = new Date()): DataQuality {
  const latest = bars.at(-1)?.ts ?? null;
  const q = timestampQuality(latest, Infinity, now);
  const expected = lastCompletedTradingDate(now);
  if (q.status !== "unavailable" && latest && nyClock(new Date(latest)).date < expected) {
    q.status = "stale";
    q.reasons.push(`최근 완료 거래일(${expected})의 일봉이 없습니다.`);
  }
  if (bars.length < minimum) {
    q.status = "unavailable";
    q.reasons.push(`계산에 필요한 일봉 ${minimum}개 중 ${bars.length}개만 있습니다.`);
  }
  return q;
}

export function completedDailyBars<T extends { ts: string }>(bars: T[], now = new Date()): T[] {
  const latestDate = lastCompletedTradingDate(now);
  return bars.filter((b) => Number.isFinite(Date.parse(b.ts)) && nyClock(new Date(b.ts)).date <= latestDate);
}

/** Legacy scanner timestamps are computation times, never price timestamps. */
export function scannerQuality(computedAt: string | null, intraday: boolean, session: MarketSession, now = new Date()): DataQuality {
  const q = timestampQuality(computedAt, intraday && session === "regular" ? 45 * 60_000 : 4 * 86_400_000, now);
  if (q.status === "fresh") q.status = "partial";
  q.reasons.push("저장된 시각은 계산 시각입니다. 원천 봉 시각은 기록되지 않아 최신 가격 기준인지 확인할 수 없습니다.");
  return q;
}

export function aggregateQuality(qualities: DataQuality[], now = new Date()): DataQuality {
  const known = qualities.map((q) => q.asOf).filter((s): s is string => s != null).sort();
  const unavailable = qualities.filter((q) => q.status === "unavailable").length;
  const stale = qualities.filter((q) => q.status === "stale").length;
  const status = !qualities.length || unavailable === qualities.length ? "unavailable"
    : stale === qualities.length ? "stale"
    : qualities.some((q) => q.status !== "fresh") ? "partial" : "fresh";
  const oldest = known[0] ?? null;
  return { ...timestampQuality(oldest, Infinity, now), status,
    reasons: Array.from(new Set(qualities.flatMap((q) => q.reasons))),
  };
}
