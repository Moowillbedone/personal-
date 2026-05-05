// Static fallback mapping: ticker → SPDR sector ETF + peer tickers.
// Covers top US large-caps. For unknown symbols we return null and skip
// the sector context in the prompt — never throw.

export interface SectorInfo {
  sector: string;
  etf: string;
  peers: string[]; // up to 5 large peers in the same sector
}

const SECTORS: Record<string, SectorInfo> = {
  TECH: {
    sector: "Information Technology",
    etf: "XLK",
    peers: ["AAPL", "MSFT", "NVDA", "AVGO", "ORCL"],
  },
  SEMI: {
    sector: "Semiconductors",
    etf: "SOXX",
    peers: ["NVDA", "AVGO", "AMD", "TSM", "ASML"],
  },
  COMM: {
    sector: "Communication Services",
    etf: "XLC",
    peers: ["META", "GOOGL", "NFLX", "DIS", "TMUS"],
  },
  CONS_DISC: {
    sector: "Consumer Discretionary",
    etf: "XLY",
    peers: ["AMZN", "TSLA", "HD", "MCD", "NKE"],
  },
  CONS_STAPLE: {
    sector: "Consumer Staples",
    etf: "XLP",
    peers: ["WMT", "PG", "KO", "PEP", "COST"],
  },
  FIN: {
    sector: "Financials",
    etf: "XLF",
    peers: ["JPM", "BAC", "WFC", "GS", "MS"],
  },
  HEALTH: {
    sector: "Health Care",
    etf: "XLV",
    peers: ["LLY", "JNJ", "UNH", "MRK", "PFE"],
  },
  INDUS: {
    sector: "Industrials",
    etf: "XLI",
    peers: ["GE", "CAT", "HON", "UPS", "BA"],
  },
  ENERGY: {
    sector: "Energy",
    etf: "XLE",
    peers: ["XOM", "CVX", "COP", "EOG", "SLB"],
  },
  UTIL: {
    sector: "Utilities",
    etf: "XLU",
    peers: ["NEE", "DUK", "SO", "AEP", "EXC"],
  },
  REIT: {
    sector: "Real Estate",
    etf: "XLRE",
    peers: ["PLD", "AMT", "EQIX", "WELL", "SPG"],
  },
  MATERIALS: {
    sector: "Materials",
    etf: "XLB",
    peers: ["LIN", "SHW", "FCX", "ECL", "NEM"],
  },
};

const TICKER_TO_SECTOR: Record<string, keyof typeof SECTORS> = {
  // Tech
  AAPL: "TECH", MSFT: "TECH", ORCL: "TECH", CRM: "TECH", ADBE: "TECH",
  IBM: "TECH", NOW: "TECH", INTU: "TECH", PANW: "TECH", CRWD: "TECH",
  // Semis
  NVDA: "SEMI", AVGO: "SEMI", AMD: "SEMI", TSM: "SEMI", ASML: "SEMI",
  INTC: "SEMI", QCOM: "SEMI", MU: "SEMI", LRCX: "SEMI", AMAT: "SEMI",
  KLAC: "SEMI", MRVL: "SEMI", ARM: "SEMI", SMCI: "SEMI",
  // Comm
  META: "COMM", GOOGL: "COMM", GOOG: "COMM", NFLX: "COMM", DIS: "COMM",
  TMUS: "COMM", T: "COMM", VZ: "COMM",
  // Cons Disc
  AMZN: "CONS_DISC", TSLA: "CONS_DISC", HD: "CONS_DISC", MCD: "CONS_DISC",
  NKE: "CONS_DISC", LOW: "CONS_DISC", SBUX: "CONS_DISC", BKNG: "CONS_DISC",
  TJX: "CONS_DISC", CMG: "CONS_DISC",
  // Cons Staples
  WMT: "CONS_STAPLE", PG: "CONS_STAPLE", KO: "CONS_STAPLE", PEP: "CONS_STAPLE",
  COST: "CONS_STAPLE", PM: "CONS_STAPLE", MO: "CONS_STAPLE", MDLZ: "CONS_STAPLE",
  // Fin
  JPM: "FIN", BAC: "FIN", WFC: "FIN", GS: "FIN", MS: "FIN",
  C: "FIN", BLK: "FIN", AXP: "FIN", SCHW: "FIN", V: "FIN", MA: "FIN",
  // Health
  LLY: "HEALTH", JNJ: "HEALTH", UNH: "HEALTH", MRK: "HEALTH", PFE: "HEALTH",
  ABBV: "HEALTH", TMO: "HEALTH", ABT: "HEALTH", DHR: "HEALTH", BMY: "HEALTH",
  // Indus
  GE: "INDUS", CAT: "INDUS", HON: "INDUS", UPS: "INDUS", BA: "INDUS",
  RTX: "INDUS", DE: "INDUS", LMT: "INDUS",
  // Energy
  XOM: "ENERGY", CVX: "ENERGY", COP: "ENERGY", EOG: "ENERGY", SLB: "ENERGY",
  // Util
  NEE: "UTIL", DUK: "UTIL", SO: "UTIL", AEP: "UTIL", EXC: "UTIL",
  // REIT
  PLD: "REIT", AMT: "REIT", EQIX: "REIT", WELL: "REIT", SPG: "REIT",
  // Materials
  LIN: "MATERIALS", SHW: "MATERIALS", FCX: "MATERIALS", ECL: "MATERIALS", NEM: "MATERIALS",
};

export function getSectorInfo(symbol: string): SectorInfo | null {
  const key = TICKER_TO_SECTOR[symbol.toUpperCase()];
  if (!key) return null;
  return SECTORS[key];
}

// Broad market reference set — always pulled regardless of sector.
export const MARKET_TICKERS = ["SPY", "QQQ", "IWM", "DIA", "VIXY", "TLT", "UUP", "GLD", "USO"];
