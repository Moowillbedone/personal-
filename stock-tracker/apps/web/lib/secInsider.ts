// SEC Form 4 (insider transactions) adapter — free via SEC EDGAR.
//
// Form 4 is filed within 2 business days of any trade by a corporate insider
// (officer, director, ≥10% owner). It's the most direct "smart money" feed
// available — when a CEO buys their own stock with personal cash, that's
// stronger evidence of conviction than any analyst rating.
//
// Pipeline:
//   1. lookupCik(symbol)            — reuses sec.ts cache
//   2. submissions JSON             — list recent Form 4 filings + dates
//   3. fetch each Form 4's XML doc  — pull transaction details
//   4. parse with regex             — Form 4 schema is fixed and well-known
//   5. classify + aggregate         — only count P (purchase) and S (sale);
//                                      ignore awards, gifts, option exercises
//
// Per-symbol parsed result is cached for 12h since insider data updates daily.
// Without this cache the daily AI scan would re-parse every Form 4 on every
// run, hammering SEC unnecessarily.

import { lookupCik, SEC_UA } from "./sec";

// SEC rate-limits at 10 req/sec per IP. We're well under that even when a
// symbol has many recent filings — limiting to 10 most-recent caps the
// per-symbol fan-out.
const MAX_FILINGS_PER_SYMBOL = 10;
const CACHE_TTL_MS = 12 * 3600 * 1000;

// Transaction codes we care about. The SEC defines ~20 codes; only P and S
// represent open-market discretionary trades (i.e., real signal). Other
// common codes (M = option exercise, A = grant, F = withholding for tax,
// G = gift, J = "other") add noise without signal.
//   P = open-market purchase  (BULLISH — paid cash)
//   S = open-market sale       (mixed — could be diversification or bearish)
const SIGNAL_CODES = new Set(["P", "S"]);

export type InsiderAction = "buy" | "sell";

export interface InsiderTransaction {
  /** ISO date the filing was submitted to SEC. */
  filedAt: string;
  /** ISO date of the actual trade (transactionDate in the filing). */
  tradedAt: string;
  insiderName: string;
  /** "CEO", "CFO", "Director", "10% Owner", or empty if not specified. */
  role: string;
  isOfficer: boolean;
  isDirector: boolean;
  isTenPercentOwner: boolean;
  action: InsiderAction;
  /** Raw transaction code (P / S) for debugging. */
  code: string;
  shares: number;
  pricePerShare: number;
  /** shares × pricePerShare in USD. */
  notionalUsd: number;
  /** Direct EDGAR link to the filing. */
  url: string;
}

export interface InsiderSummary {
  /** All P/S transactions in the lookback window, sorted recent-first. */
  transactions: InsiderTransaction[];
  /** Total notional bought (USD) across all P transactions. */
  totalBoughtUsd: number;
  /** Total notional sold (USD). */
  totalSoldUsd: number;
  /** netBoughtUsd = totalBoughtUsd - totalSoldUsd; positive = net buying. */
  netUsd: number;
  /** Distinct insiders who appear at least once in the window. */
  uniqueInsiders: number;
  /** Lookback window we actually scanned (calendar days). */
  windowDays: number;
}

const cache = new Map<string, { data: InsiderSummary; ts: number }>();

function emptySummary(windowDays: number): InsiderSummary {
  return {
    transactions: [],
    totalBoughtUsd: 0,
    totalSoldUsd: 0,
    netUsd: 0,
    uniqueInsiders: 0,
    windowDays,
  };
}

/** Strip whitespace + decode the small set of HTML entities Form 4 emits. */
function unescape(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function firstMatch(xml: string, re: RegExp): string {
  const m = re.exec(xml);
  return m ? unescape(m[1]) : "";
}

/**
 * Parse a Form 4 XML document into zero-or-more InsiderTransactions.
 * Form 4 is a fixed schema (https://www.sec.gov/info/edgar/forms/edgform.pdf
 * — section "Form 4 / 5"), so regex is sufficient and avoids adding an
 * XML parser dependency for what's effectively a single document type.
 *
 * One filing typically contains one reporting owner but may have multiple
 * transactions (e.g., a sale split across several prices in the same day).
 */
function parseForm4(xml: string, filingUrl: string): InsiderTransaction[] {
  const filedAt = firstMatch(xml, /<periodOfReport>([\s\S]*?)<\/periodOfReport>/i);

  // Reporting owner block — there can be multiple <reportingOwner> entries
  // but the relevant fields are usually in the first.
  const ownerName = firstMatch(xml, /<rptOwnerName>([\s\S]*?)<\/rptOwnerName>/i);
  const officerTitle = firstMatch(
    xml,
    /<officerTitle>([\s\S]*?)<\/officerTitle>/i,
  );
  const isDirector = /<isDirector>(?:1|true)<\/isDirector>/i.test(xml);
  const isOfficer = /<isOfficer>(?:1|true)<\/isOfficer>/i.test(xml);
  const isTenPercent = /<isTenPercentOwner>(?:1|true)<\/isTenPercentOwner>/i.test(xml);

  const role = officerTitle
    ? officerTitle
    : isDirector
      ? "Director"
      : isTenPercent
        ? "10% Owner"
        : "";

  const out: InsiderTransaction[] = [];
  // Walk every <nonDerivativeTransaction> block (those are direct equity
  // trades; <derivativeTransaction> covers options and other instruments
  // we deliberately skip — too noisy for a buy/sell signal).
  const blockRe = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml)) !== null) {
    const block = m[1];
    const code = firstMatch(block, /<transactionCode>([A-Z])<\/transactionCode>/i);
    if (!SIGNAL_CODES.has(code)) continue;

    const tradeDate = firstMatch(block, /<transactionDate>[\s\S]*?<value>([\s\S]*?)<\/value>/i);
    const sharesStr = firstMatch(
      block,
      /<transactionShares>[\s\S]*?<value>([\s\S]*?)<\/value>/i,
    );
    const priceStr = firstMatch(
      block,
      /<transactionPricePerShare>[\s\S]*?<value>([\s\S]*?)<\/value>/i,
    );
    const shares = Number(sharesStr);
    const price = Number(priceStr);
    if (!isFinite(shares) || shares <= 0) continue;
    if (!isFinite(price) || price <= 0) continue;

    out.push({
      filedAt,
      tradedAt: tradeDate || filedAt,
      insiderName: ownerName,
      role,
      isOfficer,
      isDirector,
      isTenPercentOwner: isTenPercent,
      action: code === "P" ? "buy" : "sell",
      code,
      shares,
      pricePerShare: price,
      notionalUsd: shares * price,
      url: filingUrl,
    });
  }
  return out;
}

/**
 * Pull recent Form 4 filings for symbol and parse each into transactions.
 * Returns an aggregate summary suitable for handing to the analyze prompt.
 *
 * `windowDays` filters by filing date (filedAt >= now - windowDays). Default
 * 90d gives enough history for "did the CEO bought before the run" without
 * dragging in stale year-old data.
 */
export async function getInsiderSummary(
  symbol: string,
  windowDays: number = 90,
): Promise<InsiderSummary> {
  const sym = symbol.toUpperCase();
  const cacheKey = `${sym}|${windowDays}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const cik = await lookupCik(sym);
  if (!cik) {
    const empty = emptySummary(windowDays);
    cache.set(cacheKey, { data: empty, ts: Date.now() });
    return empty;
  }

  let filings: { date: string; url: string }[] = [];
  try {
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const r = await fetch(url, {
      headers: { "user-agent": SEC_UA, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const empty = emptySummary(windowDays);
      cache.set(cacheKey, { data: empty, ts: Date.now() });
      return empty;
    }
    const data = (await r.json()) as {
      filings?: {
        recent?: {
          form?: string[];
          filingDate?: string[];
          accessionNumber?: string[];
          primaryDocument?: string[];
        };
      };
    };
    const f = data.filings?.recent;
    if (f?.form) {
      const cutoff = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
      for (let i = 0; i < f.form.length; i++) {
        if (f.form[i] !== "4") continue;
        const filedDate = f.filingDate?.[i] ?? "";
        if (!filedDate || new Date(filedDate) < cutoff) continue;
        const acc = (f.accessionNumber?.[i] ?? "").replace(/-/g, "");
        const doc = f.primaryDocument?.[i] ?? "";
        if (!acc || !doc) continue;
        const fileUrl = `https://www.sec.gov/Archives/edgar/data/${Number(
          cik,
        )}/${acc}/${doc}`;
        filings.push({ date: filedDate, url: fileUrl });
      }
    }
  } catch {
    const empty = emptySummary(windowDays);
    cache.set(cacheKey, { data: empty, ts: Date.now() });
    return empty;
  }

  // Cap to most-recent N — protects against rare cases where a 10%-owner
  // hedge fund files dozens of tiny trades in a quarter and would blow
  // through the SEC rate limit.
  filings = filings.slice(0, MAX_FILINGS_PER_SYMBOL);

  const transactions: InsiderTransaction[] = [];
  for (const filing of filings) {
    try {
      const r = await fetch(filing.url, {
        headers: { "user-agent": SEC_UA, accept: "application/xml,text/xml" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const xml = await r.text();
      transactions.push(...parseForm4(xml, filing.url));
    } catch {
      // skip individual failures — partial data is better than none
    }
  }

  // Sort recent-first by trade date.
  transactions.sort((a, b) => (a.tradedAt < b.tradedAt ? 1 : -1));

  let totalBoughtUsd = 0;
  let totalSoldUsd = 0;
  const insiders = new Set<string>();
  for (const t of transactions) {
    if (t.action === "buy") totalBoughtUsd += t.notionalUsd;
    else totalSoldUsd += t.notionalUsd;
    if (t.insiderName) insiders.add(t.insiderName);
  }

  const summary: InsiderSummary = {
    transactions,
    totalBoughtUsd,
    totalSoldUsd,
    netUsd: totalBoughtUsd - totalSoldUsd,
    uniqueInsiders: insiders.size,
    windowDays,
  };
  cache.set(cacheKey, { data: summary, ts: Date.now() });
  return summary;
}
