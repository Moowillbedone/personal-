export interface ScanCandidate {
  symbol: string;
  sector: string | null;
  price: number | null;
  grades: string | null;
  asOf?: string | null;
  stale?: boolean;
  retrace?: number | null;
}
/** A conservative research filter, deliberately not a return forecast. */
export function buildShortlist(rows: ScanCandidate[], now: number) {
  let excludedData = 0,
    excludedRules = 0;
  const eligible = rows
    .filter((r) => {
      const time = r.asOf ? Date.parse(r.asOf) : NaN;
      if (
        !Number.isFinite(time) ||
        time > now ||
        now - time > 45 * 60_000 ||
        r.stale !== false ||
        !Number.isFinite(r.price) ||
        r.price! <= 0
      ) {
        excludedData++;
        return false;
      }
      const grades = r.grades?.split(",");
      if (grades?.length !== 5 || grades.some((g) => g !== "pass")) {
        excludedRules++;
        return false;
      }
      return true;
    })
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  const sectors = new Map<string, number>(),
    symbols = new Set<string>();
  const candidates: ScanCandidate[] = [];
  for (const r of eligible) {
    const sector = r.sector || "미분류";
    if (symbols.has(r.symbol) || (sectors.get(sector) ?? 0) >= 2) continue;
    sectors.set(sector, (sectors.get(sector) ?? 0) + 1);
    symbols.add(r.symbol);
    candidates.push(r);
    if (candidates.length === 5) break;
  }
  return { candidates, excludedData, excludedRules };
}
