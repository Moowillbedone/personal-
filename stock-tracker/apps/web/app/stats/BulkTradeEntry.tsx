"use client";

// Bulk trade backfill grid for the /stats dashboard.
//
// The user often skips logging trades in the moment, then wants to enter a
// whole batch at once. This is a spreadsheet-style grid: one row per buy/sell
// event, each with its OWN date (so "bought 5/12, 5/14, 5/24" is just three
// rows), ticker, qty, and price. As rows fill in, a live preview computes
// realized P&L per row and per ticker using the SAME weighted-average cost
// basis as the rest of the app (lib/trades.ts) — so the preview total ties out
// to what the dashboard will show after submit. Submitting POSTs the whole
// batch to /api/trades/bulk.
//
// Niceties beyond the basic ask: paste-from-spreadsheet, auto-appended blank
// row, an optional leverage/derivative underlying column, and partial-success
// handling that keeps failed rows on screen for correction.

import { useMemo, useState } from "react";

const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

interface RowDraft {
  id: string;
  date: string; // YYYY-MM-DD
  action: "buy" | "sell";
  ticker: string;
  qty: string;
  price: string;
  underlying: string; // optional (derivative/leverage underlying, e.g. TSLA)
  notes: string;
}

interface BulkResult {
  insertedCount: number;
  errorCount: number;
  results: { index: number; error?: string }[];
}

let _uid = 0;
function uid(): string {
  _uid += 1;
  return `r${Date.now().toString(36)}_${_uid}`;
}

function todayStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function blankRow(): RowDraft {
  return {
    id: uid(),
    date: todayStr(),
    action: "buy",
    ticker: "",
    qty: "",
    price: "",
    underlying: "",
    notes: "",
  };
}

/** A row the user hasn't meaningfully started — ignored for validation + submit. */
function isBlank(r: RowDraft): boolean {
  return (
    !r.ticker.trim() &&
    !r.qty.trim() &&
    !r.price.trim() &&
    !r.underlying.trim() &&
    !r.notes.trim()
  );
}

interface RowErrors {
  ticker?: boolean;
  qty?: boolean;
  price?: boolean;
  date?: boolean;
  underlying?: boolean;
}

function validateRow(r: RowDraft, derivative: boolean): RowErrors {
  const e: RowErrors = {};
  if (!SYMBOL_RE.test(r.ticker.trim().toUpperCase())) e.ticker = true;
  const q = Number(r.qty);
  if (!isFinite(q) || q <= 0) e.qty = true;
  const p = Number(r.price);
  if (!isFinite(p) || p <= 0) e.price = true;
  if (!r.date || isNaN(new Date(r.date).getTime())) e.date = true;
  if (derivative && r.underlying.trim()) {
    const u = r.underlying.trim().toUpperCase();
    if (!SYMBOL_RE.test(u) || u === r.ticker.trim().toUpperCase())
      e.underlying = true;
  }
  return e;
}

function isReady(r: RowDraft, derivative: boolean): boolean {
  return !isBlank(r) && Object.keys(validateRow(r, derivative)).length === 0;
}

function fmtMoney(v: number): string {
  return `$${v.toFixed(2)}`;
}
function fmtPnl(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : "−"}$${Math.abs(v).toFixed(2)}`;
}
function pnlClass(v: number | null | undefined): string {
  if (v == null) return "text-neutral-500";
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-neutral-300";
}

function normalizeAction(raw: string): "buy" | "sell" {
  const s = raw.trim().toLowerCase();
  if (["sell", "s", "매도", "sold", "매도함"].includes(s)) return "sell";
  return "buy";
}

/** Accept 2024-05-12 / 2024.05.12 / 2024/05/12 → YYYY-MM-DD. */
function normalizeDate(raw: string): string {
  const s = raw.trim().replace(/[./]/g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return raw.trim();
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export default function BulkTradeEntry({ onDone }: { onDone?: () => void }) {
  const [rows, setRows] = useState<RowDraft[]>([blankRow()]);
  const [derivative, setDerivative] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function updateRow(id: string, patch: Partial<RowDraft>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      // Keep a trailing blank row so the user never runs out of space.
      const last = next[next.length - 1];
      if (last && !isBlank(last)) next.push(blankRow());
      return next;
    });
    setResult(null);
  }

  function removeRow(id: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      return next.length ? next : [blankRow()];
    });
  }

  function clearAll() {
    setRows([blankRow()]);
    setResult(null);
    setSubmitError(null);
  }

  function applyPaste() {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed: RowDraft[] = [];
    let sawUnderlying = false;
    for (const line of lines) {
      const cells = line.split(/\t|,/).map((c) => c.trim());
      if (cells.length < 5) continue; // need at least date,ticker,action,qty,price
      const [date, ticker, action, qty, price, underlying, ...rest] = cells;
      if (underlying && underlying.trim()) sawUnderlying = true;
      parsed.push({
        id: uid(),
        date: normalizeDate(date),
        action: normalizeAction(action),
        ticker: ticker.toUpperCase(),
        qty: qty.replace(/[^0-9.]/g, ""),
        price: price.replace(/[^0-9.]/g, ""),
        underlying: (underlying ?? "").toUpperCase(),
        notes: rest.join(", "),
      });
    }
    if (parsed.length === 0) return;
    if (sawUnderlying) setDerivative(true);
    setRows((prev) => [...prev.filter((r) => !isBlank(r)), ...parsed, blankRow()]);
    setPasteText("");
    setShowPaste(false);
    setResult(null);
  }

  // ── live preview: realized P&L per row + per-ticker summary ──────────────
  // Mirrors lib/trades.ts: realized P&L uses the weighted-average buy price
  // taken over ALL buys for that ticker in the grid, so per-row sell P&L sums
  // exactly to the per-ticker realized total (and to the dashboard later).
  const preview = useMemo(() => {
    const ready = rows
      .filter((r) => isReady(r, derivative))
      .map((r) => ({
        id: r.id,
        date: r.date,
        action: r.action,
        ticker: r.ticker.trim().toUpperCase(),
        qty: Number(r.qty),
        price: Number(r.price),
      }));

    // Global weighted-average buy price per ticker.
    const buyQty = new Map<string, number>();
    const buyCost = new Map<string, number>();
    for (const r of ready) {
      if (r.action === "buy") {
        buyQty.set(r.ticker, (buyQty.get(r.ticker) ?? 0) + r.qty);
        buyCost.set(r.ticker, (buyCost.get(r.ticker) ?? 0) + r.qty * r.price);
      }
    }
    const avgBuy = (t: string): number | null => {
      const q = buyQty.get(t) ?? 0;
      return q > 0 ? (buyCost.get(t) ?? 0) / q : null;
    };

    const rowPnl = new Map<string, number | null>();
    const sellQty = new Map<string, number>();
    const sellRev = new Map<string, number>();
    for (const r of ready) {
      if (r.action === "sell") {
        const a = avgBuy(r.ticker);
        rowPnl.set(r.id, a != null ? (r.price - a) * r.qty : null);
        sellQty.set(r.ticker, (sellQty.get(r.ticker) ?? 0) + r.qty);
        sellRev.set(r.ticker, (sellRev.get(r.ticker) ?? 0) + r.qty * r.price);
      } else {
        rowPnl.set(r.id, null);
      }
    }

    const tickers = new Set<string>([...buyQty.keys(), ...sellQty.keys()]);
    const perTicker = [...tickers]
      .map((t) => {
        const bq = buyQty.get(t) ?? 0;
        const sq = sellQty.get(t) ?? 0;
        const a = avgBuy(t);
        const realized = a != null ? (sellRev.get(t) ?? 0) - a * sq : 0;
        return {
          ticker: t,
          openQty: bq - sq,
          avgBuy: a,
          invested: buyCost.get(t) ?? 0,
          realized,
        };
      })
      .sort((x, y) => x.ticker.localeCompare(y.ticker));

    const totals = {
      invested: [...buyCost.values()].reduce((s, v) => s + v, 0),
      proceeds: [...sellRev.values()].reduce((s, v) => s + v, 0),
      realized: perTicker.reduce((s, p) => s + p.realized, 0),
      readyCount: ready.length,
      buyCount: ready.filter((r) => r.action === "buy").length,
      sellCount: ready.filter((r) => r.action === "sell").length,
    };

    return { rowPnl, perTicker, totals };
  }, [rows, derivative]);

  async function submit() {
    const readyRows = rows.filter((r) => isReady(r, derivative));
    if (readyRows.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    setResult(null);
    try {
      const payload = readyRows.map((r) => ({
        symbol: r.ticker.trim().toUpperCase(),
        action: r.action,
        qty: Number(r.qty),
        price: Number(r.price),
        mode: "real" as const,
        // Date-only backfill: anchor at local noon so converting to UTC never
        // shifts the calendar date (KST/any tz within ±12h stays same day).
        ts: new Date(`${r.date}T12:00:00`).toISOString(),
        notes: r.notes.trim() || null,
        underlying_symbol:
          derivative && r.underlying.trim()
            ? r.underlying.trim().toUpperCase()
            : null,
      }));
      const res = await fetch("/api/trades/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trades: payload }),
      });
      const data = (await res.json()) as BulkResult | { error: string };
      if ("error" in data) {
        setSubmitError(data.error);
        return;
      }
      setResult(data);
      // Drop the rows that inserted OK; keep failed ones on screen so the user
      // can fix and resubmit without re-typing (and without double-inserting
      // the ones that already went in).
      const failedIdx = new Set(
        data.results.filter((r) => r.error).map((r) => r.index),
      );
      const succeededIds = new Set(
        readyRows.filter((_, i) => !failedIdx.has(i)).map((r) => r.id),
      );
      setRows((prev) => {
        const kept = prev.filter((r) => !succeededIds.has(r.id));
        const withBlank =
          kept.length === 0 || !isBlank(kept[kept.length - 1])
            ? [...kept, blankRow()]
            : kept;
        return withBlank;
      });
      if (data.insertedCount > 0) onDone?.();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const readyCount = preview.totals.readyCount;
  const colCount = derivative ? 9 : 8;

  return (
    <details className="border border-sky-900/60 bg-sky-950/10 rounded-lg overflow-hidden">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-sky-200 hover:bg-sky-950/20 flex items-center gap-2">
        <span>➕ 매매 일괄 등록 (누락분 백필)</span>
        <span className="text-[11px] font-normal text-neutral-500">
          날짜별 매수/매도를 한 번에 입력 — 실현손익 자동 계산
        </span>
      </summary>

      <div className="px-4 pb-4 pt-1 space-y-3">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={derivative}
              onChange={(e) => setDerivative(e.target.checked)}
            />
            <span className="text-neutral-300">파생/레버리지 매매 (기초자산 입력)</span>
          </label>
          <button
            onClick={() => setShowPaste((v) => !v)}
            className="px-2 py-1 border border-neutral-700 rounded hover:border-sky-500 hover:text-sky-300 text-neutral-400"
          >
            📋 스프레드시트 붙여넣기
          </button>
          <button
            onClick={() => setRows((prev) => [...prev, blankRow()])}
            className="px-2 py-1 border border-neutral-700 rounded hover:border-emerald-500 hover:text-emerald-300 text-neutral-400"
          >
            + 행 추가
          </button>
          <button
            onClick={clearAll}
            className="px-2 py-1 border border-neutral-800 rounded hover:border-rose-500 hover:text-rose-300 text-neutral-500 ml-auto"
          >
            전체 지우기
          </button>
        </div>

        {/* paste panel */}
        {showPaste && (
          <div className="border border-neutral-800 rounded p-3 bg-neutral-950/40 space-y-2">
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              엑셀/구글시트에서 복사해 붙여넣으세요. 열 순서:{" "}
              <code className="text-neutral-300">
                날짜, 티커, 구분(매수/매도), 수량, 단가
                {derivative ? ", 기초자산" : ""}, 메모(선택)
              </code>
              . 탭 또는 쉼표 구분, 날짜는 2024-05-12 / 2024.05.12 형식.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              placeholder={"2024-05-12\tTSLA\t매수\t10\t182.5\n2024-05-24\tTSLA\t매도\t10\t201.3"}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-600"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={applyPaste}
                disabled={!pasteText.trim()}
                className="px-3 py-1 text-xs rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white font-semibold"
              >
                채우기
              </button>
              <button
                onClick={() => {
                  setPasteText("");
                  setShowPaste(false);
                }}
                className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-y-1">
            <thead className="text-neutral-500">
              <tr>
                <th className="text-left font-normal px-1 pb-1">날짜</th>
                <th className="text-left font-normal px-1 pb-1">구분</th>
                <th className="text-left font-normal px-1 pb-1">티커</th>
                {derivative && (
                  <th className="text-left font-normal px-1 pb-1">기초자산</th>
                )}
                <th className="text-right font-normal px-1 pb-1">수량</th>
                <th className="text-right font-normal px-1 pb-1">단가 ($)</th>
                <th className="text-right font-normal px-1 pb-1">금액</th>
                <th className="text-right font-normal px-1 pb-1">실현손익</th>
                <th className="text-left font-normal px-1 pb-1">메모</th>
                <th className="px-1 pb-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const blank = isBlank(r);
                const errs = blank ? {} : validateRow(r, derivative);
                const qN = Number(r.qty);
                const pN = Number(r.price);
                const amount =
                  isFinite(qN) && isFinite(pN) && qN > 0 && pN > 0
                    ? qN * pN
                    : null;
                const rowReady = isReady(r, derivative);
                const pnl = rowReady ? preview.rowPnl.get(r.id) ?? null : null;
                const inputBase =
                  "bg-neutral-900 border rounded px-1.5 py-1 focus:outline-none focus:border-sky-600";
                const errCls = (bad?: boolean) =>
                  bad ? "border-rose-700/70" : "border-neutral-700";
                return (
                  <tr key={r.id} className="align-middle">
                    <td className="px-1">
                      <input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRow(r.id, { date: e.target.value })}
                        className={`${inputBase} ${errCls(errs.date)} w-[130px] text-neutral-200`}
                      />
                    </td>
                    <td className="px-1">
                      <select
                        value={r.action}
                        onChange={(e) =>
                          updateRow(r.id, {
                            action: e.target.value as "buy" | "sell",
                          })
                        }
                        className={`${inputBase} border-neutral-700 w-[68px] font-semibold ${
                          r.action === "buy" ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        <option value="buy">매수</option>
                        <option value="sell">매도</option>
                      </select>
                    </td>
                    <td className="px-1">
                      <input
                        type="text"
                        value={r.ticker}
                        onChange={(e) =>
                          updateRow(r.id, {
                            ticker: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="TSLA"
                        maxLength={10}
                        className={`${inputBase} ${errCls(errs.ticker)} w-[84px] uppercase text-sky-300 font-semibold`}
                      />
                    </td>
                    {derivative && (
                      <td className="px-1">
                        <input
                          type="text"
                          value={r.underlying}
                          onChange={(e) =>
                            updateRow(r.id, {
                              underlying: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="(선택)"
                          maxLength={10}
                          title="AI가 분석한 기초자산 (예: TSLL 매매 시 TSLA)"
                          className={`${inputBase} ${errCls(errs.underlying)} w-[84px] uppercase text-violet-300`}
                        />
                      </td>
                    )}
                    <td className="px-1 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={r.qty}
                        onChange={(e) =>
                          updateRow(r.id, {
                            qty: e.target.value.replace(/^-+/, ""),
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "-") e.preventDefault();
                        }}
                        placeholder="10"
                        className={`${inputBase} ${errCls(errs.qty)} w-[72px] text-right text-neutral-200`}
                      />
                    </td>
                    <td className="px-1 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={r.price}
                        onChange={(e) =>
                          updateRow(r.id, {
                            price: e.target.value.replace(/^-+/, ""),
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "-") e.preventDefault();
                        }}
                        placeholder="182.50"
                        className={`${inputBase} ${errCls(errs.price)} w-[84px] text-right text-neutral-200`}
                      />
                    </td>
                    <td className="px-1 text-right text-neutral-300 whitespace-nowrap tabular-nums">
                      {amount != null ? fmtMoney(amount) : "—"}
                    </td>
                    <td
                      className={`px-1 text-right whitespace-nowrap tabular-nums font-semibold ${pnlClass(
                        pnl,
                      )}`}
                    >
                      {r.action === "sell"
                        ? pnl != null
                          ? fmtPnl(pnl)
                          : rowReady
                            ? "—"
                            : ""
                        : ""}
                    </td>
                    <td className="px-1">
                      <input
                        type="text"
                        value={r.notes}
                        onChange={(e) => updateRow(r.id, { notes: e.target.value })}
                        placeholder="메모(선택)"
                        className={`${inputBase} border-neutral-700 w-[140px] text-neutral-300`}
                      />
                    </td>
                    <td className="px-1 text-right">
                      <button
                        onClick={() => removeRow(r.id)}
                        className="text-neutral-700 hover:text-rose-400"
                        title="행 삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* sell-without-basis hint */}
        {preview.perTicker.some(
          (p) => p.avgBuy == null && p.openQty < 0,
        ) && (
          <p className="text-[11px] text-amber-400/80">
            ⚠️ 매수 행 없이 매도만 입력된 티커가 있어 실현손익을 계산할 수 없습니다(—).
            같은 티커의 매수도 함께 입력하면 자동 계산됩니다. (이미 DB에 매수가 있다면
            제출 후 대시보드에서 정확히 반영됩니다.)
          </p>
        )}

        {/* live preview summary */}
        {readyCount > 0 && (
          <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-950/40 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs uppercase text-neutral-400">
                미리보기 (입력분 {readyCount}건 · 매수 {preview.totals.buyCount} /
                매도 {preview.totals.sellCount})
              </h3>
              <span className="text-[11px] text-neutral-600">
                가중평균 단가 기준 · 제출 전 예상치
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <PreviewTile label="총 매수금액" value={fmtMoney(preview.totals.invested)} />
              <PreviewTile label="총 매도금액" value={fmtMoney(preview.totals.proceeds)} />
              <PreviewTile
                label="예상 실현손익"
                value={fmtPnl(preview.totals.realized)}
                valueClass={pnlClass(preview.totals.realized)}
              />
            </div>
            {preview.perTicker.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-neutral-500 border-b border-neutral-800">
                    <tr>
                      <th className="text-left py-1 pr-2">티커</th>
                      <th className="text-right py-1 px-2">순보유</th>
                      <th className="text-right py-1 px-2">평균매수가</th>
                      <th className="text-right py-1 px-2">매수금액</th>
                      <th className="text-right py-1 pl-2">실현손익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.perTicker.map((p) => (
                      <tr key={p.ticker} className="border-b border-neutral-900">
                        <td className="py-1 pr-2 text-sky-300 font-semibold">
                          {p.ticker}
                        </td>
                        <td className="text-right py-1 px-2 text-neutral-300 tabular-nums">
                          {p.openQty.toFixed(Math.abs(p.openQty) < 1 ? 4 : 2)}
                        </td>
                        <td className="text-right py-1 px-2 text-neutral-300 tabular-nums">
                          {p.avgBuy != null ? fmtMoney(p.avgBuy) : "—"}
                        </td>
                        <td className="text-right py-1 px-2 text-neutral-400 tabular-nums">
                          {fmtMoney(p.invested)}
                        </td>
                        <td
                          className={`text-right py-1 pl-2 font-semibold tabular-nums ${pnlClass(
                            p.realized,
                          )}`}
                        >
                          {p.realized !== 0 ? fmtPnl(p.realized) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* submit + result */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={submit}
            disabled={submitting || readyCount === 0}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-sm font-semibold"
          >
            {submitting ? "등록 중…" : `${readyCount}건 등록`}
          </button>
          {result && (
            <span className="text-xs">
              <span className="text-emerald-400 font-semibold">
                ✓ {result.insertedCount}건 등록
              </span>
              {result.errorCount > 0 && (
                <span className="text-rose-400 ml-2">
                  · {result.errorCount}건 실패 (행 유지됨)
                </span>
              )}
            </span>
          )}
          {submitError && (
            <span className="text-xs text-rose-400">{submitError}</span>
          )}
        </div>

        {result && result.errorCount > 0 && (
          <ul className="text-[11px] text-rose-300/80 space-y-0.5">
            {result.results
              .filter((r) => r.error)
              .slice(0, 10)
              .map((r) => (
                <li key={r.index}>
                  • {r.index + 1}번째 입력행: {r.error}
                </li>
              ))}
          </ul>
        )}

        <p className="text-[11px] text-neutral-600 leading-relaxed">
          시간 정보 없는 날짜는 정오 기준으로 저장됩니다. 실현손익은 같은 티커
          매수의 가중평균 단가로 계산되며, 제출 후 「내 매매 성과」·누적 곡선에
          자동 반영됩니다. 24시간 내 AI 추천이 있으면 자동 연결됩니다.
        </p>
      </div>
    </details>
  );
}

function PreviewTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-neutral-800 rounded p-2 bg-neutral-950/40">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className={`mt-0.5 text-base font-semibold tabular-nums ${valueClass ?? "text-neutral-100"}`}>
        {value}
      </div>
    </div>
  );
}
