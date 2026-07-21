// Shared helpers for the dashboard "touch scanner" panels (200일선 · 선행스팬B).
// Kept in one place so the sector map, formatters, and grid layout can't drift
// between panels.

export type MarketSession = "pre" | "regular" | "after" | "closed";

export const SESSION_LABEL: Record<MarketSession, string> = {
  pre: "프리마켓 · 실시간",
  regular: "장중 · 실시간",
  after: "애프터마켓 · 실시간",
  closed: "장마감 · 최근 세션 기준",
};

export function changeText(v: number | null): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function changeColor(v: number | null): string {
  if (v == null || !isFinite(v)) return "text-neutral-500";
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

// Map a raw finnhubIndustry string → short Korean sector label. Keyword-based
// (substring) so it's resilient to Finnhub's exact wording; ORDER MATTERS —
// more specific rules first (semiconductor before technology, oil before
// energy). Unmapped values fall back to the raw string so nothing is blank.
const SECTOR_RULES: [RegExp, string][] = [
  [/semiconductor/, "반도체"],
  [/software|saas/, "소프트웨어"],
  [/internet|interactive media/, "인터넷"],
  [/biotech/, "바이오"], // must precede /technology/ — "bioTECHNOLOGY" would else match 기술
  [/it services|information technology|technology/, "기술·IT"],
  [/hardware|computer|electronic equipment|consumer electronics/, "하드웨어"],
  [/aerospace|defense|defence/, "항공·방산"],
  [/bank/, "은행"],
  [/insurance/, "보험"],
  [/financial exchanges|capital markets|asset management|investment/, "금융·자산"],
  [/financial/, "금융"],
  [/pharmaceutic/, "제약"],
  [/health|medical|life sciences|managed care|hospital/, "헬스케어"],
  [/oil|gas|petroleum|drilling/, "석유·가스"],
  [/energy|renewable|solar/, "에너지"],
  [/electric utilities|util/, "유틸리티"],
  [/real estate|reit/, "부동산"],
  [/chemical/, "화학"],
  [/metal|mining|steel|gold/, "금속·광업"],
  [/airline/, "항공"],
  [/auto/, "자동차"],
  [/retail|e-commerce|distributor|distribution/, "유통·소매"],
  [/hotel|restaurant|leisure|travel|gaming|casino/, "호텔·레저"],
  [/tobacco/, "담배"],
  [/beverage|food|agricult|grocery/, "식음료"],
  [/apparel|luxury|textile|footwear/, "의류·소비재"],
  [/household|consumer products|personal products|cosmetic/, "생활소비재"],
  [/media|entertainment|broadcast|publishing/, "미디어"],
  [/telecom|communication/, "통신"],
  [/machinery|industrial|manufactur|electrical equipment|conglomerate/, "산업재"],
  [/transport|logistics|rail|marine|trucking|shipping|airport/, "운송·물류"],
  [/construction|building|engineering|homebuild|cement/, "건설·건자재"],
  [/professional services|commercial services|business services|consulting/, "서비스"],
];

export function koSector(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  for (const [re, ko] of SECTOR_RULES) if (re.test(s)) return ko;
  return raw; // fallback: show the raw industry string
}

export function fmtUpdated(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

// Column template shared by the scanner row lists. col1 (종목·섹터) flexes and
// can shrink/truncate; the numeric columns hold a small min-width, right-aligned.
// Wrapped in overflow-x-auto by callers so a narrow phone scrolls inside the
// card. On phones the 3rd column (the reference line value) is hidden — the
// panels tag it `hidden sm:block` — so 4 columns fit ~360px; from sm up all 5.
export const SCANNER_GRID =
  "grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(2.6rem,auto))] sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(2.6rem,auto))] gap-x-2 sm:gap-x-3";
