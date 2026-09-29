/** Descriptive observation helpers; none of these estimate future win odds. */
export function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function mean(values: number[]): number | null {
  const valid = values.filter(finiteNumber);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function newYorkDate(iso: string): string | null {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Keep the first observation, preventing repeated scans from inflating n.
 * Longer horizons still overlap and cross-symbol market returns correlate. */
export function firstPerSymbolSession<T>(rows: T[], symbol: (row: T) => string, timestamp: (row: T) => string, group: (row: T) => string): T[] {
  const seen = new Set<string>();
  return [...rows].sort((a, b) => Date.parse(timestamp(a)) - Date.parse(timestamp(b))).filter((row) => {
    const day = newYorkDate(timestamp(row));
    if (!day || !symbol(row)) return false;
    const key = `${symbol(row)}|${day}|${group(row)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Reconstruct the reference horizon price, then compare with actual fill.
 * This is a gross markout diagnostic, never realized account P&L. A sell
 * markout measures avoided price movement, not profit on a short position. */
export function fillMarkout(action: "buy" | "sell", referenceReturn: number | null, referencePrice: number | null, fillPrice: number): number | null {
  if (!finiteNumber(referenceReturn) || !finiteNumber(referencePrice) || referencePrice <= 0 || !finiteNumber(fillPrice) || fillPrice <= 0) return null;
  const forwardPrice = referencePrice * (1 + referenceReturn);
  if (!Number.isFinite(forwardPrice) || forwardPrice <= 0) return null;
  const markout = (forwardPrice - fillPrice) / fillPrice;
  return action === "buy" ? markout : -markout;
}
