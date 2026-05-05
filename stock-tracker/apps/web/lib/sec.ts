// SEC EDGAR 8-K filing fetcher — free, no key required.
// SEC requires a descriptive User-Agent with contact info per their fair-access policy.
// We do a CIK lookup once per symbol then list recent 8-Ks.

const UA = "stock-tracker (personal use) contact@example.com";
const CIK_LOOKUP_URL = "https://www.sec.gov/cgi-bin/browse-edgar";

export interface FilingItem {
  formType: string;       // '8-K', '10-Q', etc.
  filedAt: string;        // ISO
  description: string;    // primary description
  url: string;            // EDGAR link
}

// Cache CIK lookups in memory (process-wide, safe for short-lived dev/serverless invocations).
const cikCache = new Map<string, string | null>();

async function lookupCik(symbol: string): Promise<string | null> {
  const sym = symbol.toUpperCase();
  if (cikCache.has(sym)) return cikCache.get(sym) ?? null;
  try {
    const url = `${CIK_LOOKUP_URL}?action=getcompany&CIK=${encodeURIComponent(sym)}&type=8-K&dateb=&owner=include&count=1&output=atom`;
    const r = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/atom+xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      cikCache.set(sym, null);
      return null;
    }
    const xml = await r.text();
    // CIK appears as <cik>0000320193</cik> in the atom feed
    const m = /<cik>(\d{1,10})<\/cik>/i.exec(xml);
    const cik = m ? m[1].padStart(10, "0") : null;
    cikCache.set(sym, cik);
    return cik;
  } catch {
    cikCache.set(sym, null);
    return null;
  }
}

export async function fetchRecent8K(symbol: string, limit = 5): Promise<FilingItem[]> {
  const cik = await lookupCik(symbol);
  if (!cik) return [];
  try {
    // SEC submissions JSON gives a clean machine-readable index of recent filings.
    const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const r = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      filings?: { recent?: { form?: string[]; filingDate?: string[]; primaryDocDescription?: string[]; accessionNumber?: string[]; primaryDocument?: string[] } };
    };
    const f = data.filings?.recent;
    if (!f?.form) return [];
    const out: FilingItem[] = [];
    for (let i = 0; i < f.form.length && out.length < limit; i++) {
      if (f.form[i] !== "8-K") continue;
      const acc = (f.accessionNumber?.[i] ?? "").replace(/-/g, "");
      const doc = f.primaryDocument?.[i] ?? "";
      out.push({
        formType: f.form[i],
        filedAt: f.filingDate?.[i] ?? "",
        description: f.primaryDocDescription?.[i] ?? "",
        url: acc
          ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${doc}`
          : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=8-K`,
      });
    }
    return out;
  } catch {
    return [];
  }
}
