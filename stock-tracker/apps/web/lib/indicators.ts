// Pure technical-indicator calculations from OHLC bars.
// All functions are tolerant of short input arrays (return null when insufficient).

export interface Bar {
  ts: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  // Seed with SMA of first `period` values
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
  }
  return e;
}

export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  let avgG = gains / period;
  let avgL = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgG = (avgG * (period - 1) + g) / period;
    avgL = (avgL * (period - 1) + l) / period;
  }
  if (avgL === 0) return 100;
  const rs = avgG / avgL;
  return 100 - 100 / (1 + rs);
}

export function macd(closes: number[]): { macd: number; signal: number; hist: number } | null {
  if (closes.length < 35) return null;
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  if (e12 == null || e26 == null) return null;
  const macdLine = e12 - e26;
  // Signal: EMA(9) of macd line — simplified by computing macd line over a window
  const macdSeries: number[] = [];
  for (let i = 26; i <= closes.length; i++) {
    const window = closes.slice(0, i);
    const a = ema(window, 12);
    const b = ema(window, 26);
    if (a != null && b != null) macdSeries.push(a - b);
  }
  const sig = ema(macdSeries, 9);
  if (sig == null) return null;
  return { macd: macdLine, signal: sig, hist: macdLine - sig };
}

export function bollinger(
  closes: number[],
  period = 20,
  mult = 2,
): { upper: number; mid: number; lower: number; pctB: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mean + mult * sd;
  const lower = mean - mult * sd;
  const last = closes[closes.length - 1];
  const pctB = (last - lower) / (upper - lower); // 0=lower, 1=upper
  return { upper, mid: mean, lower, pctB };
}

export function atr(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h;
    const l = bars[i].l;
    const pc = bars[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // Wilder's smoothing
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) {
    a = (a * (period - 1) + trs[i]) / period;
  }
  return a;
}

export interface FiftyTwoWeek {
  high: number;
  low: number;
  pctFromHigh: number; // negative if below high, e.g. -0.12 = 12% below 52w high
  pctFromLow: number; // positive if above low
}

export function fiftyTwoWeek(bars: Bar[]): FiftyTwoWeek | null {
  // Use up to 252 trading days
  if (bars.length === 0) return null;
  const window = bars.slice(-252);
  let hi = -Infinity;
  let lo = Infinity;
  for (const b of window) {
    if (b.h > hi) hi = b.h;
    if (b.l < lo) lo = b.l;
  }
  const last = window[window.length - 1].c;
  return {
    high: hi,
    low: lo,
    pctFromHigh: (last - hi) / hi,
    pctFromLow: (last - lo) / lo,
  };
}

export interface VolumeProfile {
  avg20: number | null;
  avg60: number | null;
  todayRatio20: number | null; // today vol / 20-day avg
}

export function volumeProfile(bars: Bar[]): VolumeProfile {
  if (bars.length === 0) return { avg20: null, avg60: null, todayRatio20: null };
  const vols = bars.map((b) => b.v);
  const today = vols[vols.length - 1];
  const a20 = sma(vols.slice(0, -1), 20);
  const a60 = sma(vols.slice(0, -1), 60);
  return {
    avg20: a20,
    avg60: a60,
    todayRatio20: a20 ? today / a20 : null,
  };
}

export interface IndicatorBundle {
  rsi14: number | null;
  macd: { macd: number; signal: number; hist: number } | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  bollinger: { upper: number; mid: number; lower: number; pctB: number } | null;
  atr14: number | null;
  fiftyTwoWeek: FiftyTwoWeek | null;
  volume: VolumeProfile;
}

export function computeAll(bars: Bar[]): IndicatorBundle {
  const closes = bars.map((b) => b.c);
  return {
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    bollinger: bollinger(closes, 20, 2),
    atr14: atr(bars, 14),
    fiftyTwoWeek: fiftyTwoWeek(bars),
    volume: volumeProfile(bars),
  };
}
