// Curated sector & theme baskets for the "강세 섹터" (leading sectors) panel.
//
// HONESTY NOTE — how strength is measured (no fabrication):
//   We do NOT infer "hot themes" from news scraping or vague signals. Sector
//   strength here is the AVERAGE today-return of each basket's actual
//   constituent stocks (breadth-confirmed direction), plus aggregate
//   dollar-volume (거래대금) as the money-flow magnitude. A basket ranks high
//   only when its real constituents are really up today, on real volume —
//   all from live Alpaca quotes. The trade-off is that this is a FIXED,
//   curated universe: a genuinely novel theme not listed below will not
//   auto-appear. That limitation is surfaced to the user in the panel.
//
// Each basket carries a reference ETF (shown as context, not used for ranking)
// and a list of liquid, US-listed constituents. Every ticker below was probed
// live against the Alpaca snapshot API and confirmed to return price+volume.
// Any symbol that stops resolving at runtime is silently skipped — never
// fabricated.

export interface SectorBasket {
  key: string;
  /** Korean label shown in the UI. */
  labelKo: string;
  /** English label (subtitle / disambiguation). */
  labelEn: string;
  /**
   * Reference ETF — clickable context chip, NOT part of the ranking math.
   * Optional: some themes (e.g. 비만·GLP-1) have no clean, liquid dedicated
   * ETF, and forcing a loosely-related sector ETF would misrepresent the
   * theme's return. We leave it undefined rather than ship a misleading proxy.
   */
  etf?: string;
  /** Broad GICS sector vs. a narrower thematic basket. */
  kind: "sector" | "theme";
  /** Liquid US-listed constituents (verified live on Alpaca). */
  constituents: string[];
}

export const SECTOR_BASKETS: SectorBasket[] = [
  // ── GICS sectors (SPDR ETF reference) ──────────────────────────────────
  {
    key: "tech",
    labelKo: "기술",
    labelEn: "Technology",
    etf: "XLK",
    kind: "sector",
    constituents: ["AAPL", "MSFT", "ORCL", "CRM", "ADBE", "NOW", "IBM", "INTU", "PANW", "CRWD", "CSCO", "ACN"],
  },
  {
    key: "semi",
    labelKo: "반도체",
    labelEn: "Semiconductors",
    etf: "SOXX",
    kind: "sector",
    constituents: ["NVDA", "AVGO", "AMD", "TSM", "ASML", "MU", "QCOM", "LRCX", "AMAT", "KLAC", "MRVL", "ARM"],
  },
  {
    key: "comm",
    labelKo: "커뮤니케이션",
    labelEn: "Communication",
    etf: "XLC",
    kind: "sector",
    constituents: ["META", "GOOGL", "NFLX", "DIS", "TMUS", "T", "VZ", "CMCSA"],
  },
  {
    key: "cons_disc",
    labelKo: "자유소비재",
    labelEn: "Consumer Discretionary",
    etf: "XLY",
    kind: "sector",
    constituents: ["AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "BKNG", "TJX", "CMG"],
  },
  {
    key: "cons_staple",
    labelKo: "필수소비재",
    labelEn: "Consumer Staples",
    etf: "XLP",
    kind: "sector",
    constituents: ["WMT", "COST", "PG", "KO", "PEP", "PM", "MO", "MDLZ", "CL"],
  },
  {
    key: "fin",
    labelKo: "금융",
    labelEn: "Financials",
    etf: "XLF",
    kind: "sector",
    constituents: ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP", "SCHW", "V", "MA"],
  },
  {
    key: "health",
    labelKo: "헬스케어",
    labelEn: "Health Care",
    etf: "XLV",
    kind: "sector",
    constituents: ["LLY", "JNJ", "UNH", "MRK", "ABBV", "TMO", "ABT", "DHR", "PFE", "BMY", "AMGN"],
  },
  {
    key: "indus",
    labelKo: "산업재",
    labelEn: "Industrials",
    etf: "XLI",
    kind: "sector",
    constituents: ["GE", "CAT", "HON", "UPS", "BA", "RTX", "DE", "LMT", "UNP", "ETN"],
  },
  {
    key: "energy",
    labelKo: "에너지",
    labelEn: "Energy",
    etf: "XLE",
    kind: "sector",
    constituents: ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "WMB", "OXY"],
  },
  {
    key: "util",
    labelKo: "유틸리티",
    labelEn: "Utilities",
    etf: "XLU",
    kind: "sector",
    constituents: ["NEE", "DUK", "SO", "AEP", "EXC", "SRE", "D", "VST", "CEG"],
  },
  {
    key: "reit",
    labelKo: "부동산",
    labelEn: "Real Estate",
    etf: "XLRE",
    kind: "sector",
    constituents: ["PLD", "AMT", "EQIX", "WELL", "SPG", "O", "PSA", "CCI", "DLR"],
  },
  {
    key: "materials",
    labelKo: "소재",
    labelEn: "Materials",
    etf: "XLB",
    kind: "sector",
    constituents: ["LIN", "SHW", "FCX", "ECL", "NEM", "APD", "DOW", "NUE"],
  },

  // ── Hot themes (narrower baskets, where rotation often shows first) ─────
  {
    key: "space",
    labelKo: "우주·방산",
    labelEn: "Space & Defense",
    etf: "ARKX",
    kind: "theme",
    constituents: ["RKLB", "ASTS", "LUNR", "RDW", "PL", "RTX", "LMT", "NOC", "KTOS", "LHX"],
  },
  {
    key: "nuclear",
    labelKo: "원자력·우라늄",
    labelEn: "Nuclear & Uranium",
    etf: "NLR",
    kind: "theme",
    constituents: ["CEG", "VST", "CCJ", "OKLO", "SMR", "LEU", "NRG", "BWXT", "NNE"],
  },
  {
    key: "quantum",
    labelKo: "양자컴퓨팅",
    labelEn: "Quantum Computing",
    etf: "QTUM",
    kind: "theme",
    constituents: ["IONQ", "RGTI", "QBTS", "QUBT", "ARQQ"],
  },
  {
    key: "crypto",
    labelKo: "크립토·블록체인",
    labelEn: "Crypto & Blockchain",
    etf: "BITQ",
    kind: "theme",
    constituents: ["COIN", "MSTR", "MARA", "RIOT", "CLSK", "HOOD", "HUT", "CIFR"],
  },
  {
    key: "cyber",
    labelKo: "사이버보안",
    labelEn: "Cybersecurity",
    etf: "CIBR",
    kind: "theme",
    constituents: ["PANW", "CRWD", "ZS", "FTNT", "NET", "S", "OKTA", "CYBR"],
  },
  {
    key: "obesity",
    labelKo: "비만·GLP-1",
    labelEn: "Obesity / GLP-1",
    // No clean liquid dedicated ETF — ranked purely on constituents (honest).
    kind: "theme",
    constituents: ["LLY", "NVO", "VKTX", "AMGN", "HIMS"],
  },
  {
    key: "ai_power",
    labelKo: "AI인프라·전력",
    labelEn: "AI Infra & Power",
    // Data-center buildout: power equipment, cooling, electrification, nuclear
    // power supply. No single clean ETF captures it — constituent-ranked.
    kind: "theme",
    constituents: ["VRT", "GEV", "ETN", "POWL", "PWR", "TLN", "CEG", "VST"],
  },
];

/** Every unique symbol (constituents + reference ETFs) needing a snapshot. */
export function allBasketSymbols(): string[] {
  const set = new Set<string>();
  for (const b of SECTOR_BASKETS) {
    if (b.etf) set.add(b.etf);
    for (const c of b.constituents) set.add(c);
  }
  return Array.from(set);
}
