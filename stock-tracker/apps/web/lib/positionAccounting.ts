/** Chronological average-cost accounting shared by server and client. Excludes fees/tax. */
export interface AccountingTrade {
  action: "buy" | "sell";
  qty: number;
  price: number;
  ts: string;
  created_at?: string;
}

export function accountTrades(trades: AccountingTrade[]) {
  let openQty = 0;
  let costBasisOpen = 0;
  let realizedPnl = 0;
  let totalBuyQty = 0;
  let totalSellQty = 0;
  let cyclePnl = 0;
  const realizedEvents: { ts: string; pnl: number }[] = [];
  const closedCycles: { ts: string; pnl: number }[] = [];
  for (const trade of trades) {
    if (!Number.isFinite(trade.qty) || trade.qty <= 0 || !Number.isFinite(trade.price) || trade.price <= 0 || !Number.isFinite(Date.parse(trade.ts))) {
      throw new Error("거래 기록의 수량·가격·시간을 확인하세요. 손익 계산을 보류합니다.");
    }
  }
  const ordered = [...trades].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts) || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  for (const trade of ordered) {
    if (trade.action === "buy") {
      totalBuyQty += trade.qty;
      openQty += trade.qty;
      costBasisOpen += trade.qty * trade.price;
      continue;
    }
    // Permit only numerical round-off, never implicit shorting or missing cost basis.
    const tolerance = Math.max(1, openQty, trade.qty) * Number.EPSILON * 16;
    if (openQty <= 0 || trade.qty - openQty > tolerance) {
      throw new Error("매도 이전의 매수 기록이 부족합니다. 전체 거래 내역을 확인해야 손익을 계산할 수 있습니다.");
    }
    const soldQty = Math.min(trade.qty, openQty);
    const average = costBasisOpen / openQty;
    const pnl = soldQty * (trade.price - average);
    realizedPnl += pnl;
    cyclePnl += pnl;
    totalSellQty += soldQty;
    costBasisOpen -= soldQty * average;
    openQty -= soldQty;
    realizedEvents.push({ ts: trade.ts, pnl });
    if (Math.abs(openQty) <= tolerance) {
      openQty = 0;
      costBasisOpen = 0;
      closedCycles.push({ ts: trade.ts, pnl: cyclePnl });
      cyclePnl = 0;
    }
  }
  return {
    openQty,
    avgBuyPrice: openQty > 0 ? costBasisOpen / openQty : null,
    costBasisOpen,
    realizedPnl,
    totalBuyQty,
    totalSellQty,
    tradeCount: trades.length,
    realizedEvents,
    closedCycles,
  };
}
