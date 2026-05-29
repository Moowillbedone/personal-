// POST /api/trades/bulk — record many trades in one request.
//
// Built for backfilling the journal: the user enters a batch of historical
// buys/sells (each with its own date) in the /stats bulk-entry grid and
// submits them together. Each row goes through the exact same validation +
// AI-analysis auto-link as a single POST /api/trades (shared via recordTrade),
// so a bulk insert and a one-off insert can never diverge.
//
// Partial success is allowed: valid rows are inserted, invalid rows are
// reported per-index. The client surfaces "N건 등록, M건 실패 (사유)".

import { NextRequest, NextResponse } from "next/server";
import { recordTrade, type TradeInputBody } from "@/lib/recordTrade";
import type { Trade } from "@/lib/trades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guardrail: a manual backfill is at most a few dozen rows. Cap so a malformed
// or malicious payload can't fan out into thousands of sequential DB writes.
const MAX_BULK_ROWS = 200;

interface BulkBody {
  trades?: TradeInputBody[];
}

interface RowResult {
  index: number;
  trade?: Trade;
  error?: string;
}

export async function POST(req: NextRequest) {
  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rows = body.trades;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "trades must be a non-empty array" },
      { status: 400 },
    );
  }
  if (rows.length > MAX_BULK_ROWS) {
    return NextResponse.json(
      { error: `too many rows (max ${MAX_BULK_ROWS})` },
      { status: 400 },
    );
  }

  // Insert sequentially: the auto-link does a per-row DB read anyway, and a
  // backfill batch is small, so the simplicity beats parallel fan-out here.
  const results: RowResult[] = [];
  const inserted: Trade[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = await recordTrade(rows[i]);
    if (r.error) {
      results.push({ index: i, error: r.error });
    } else {
      results.push({ index: i, trade: r.trade });
      if (r.trade) inserted.push(r.trade);
    }
  }

  const errorCount = results.filter((r) => r.error).length;
  return NextResponse.json({
    insertedCount: inserted.length,
    errorCount,
    inserted,
    results,
  });
}
