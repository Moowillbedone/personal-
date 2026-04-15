"use client";

/**
 * 포트폴리오 로컬 스토리지
 * 모의투자 데이터 관리
 */

export interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  strategyId: string;
}

export interface TradeHistory {
  id: string;
  time: string;
  symbol: string;
  name: string;
  type: "buy" | "sell";
  price: number;
  quantity: number;
  total: number;
  strategyId: string;
}

export interface Portfolio {
  initialCapital: number;
  cash: number;
  positions: Position[];
  trades: TradeHistory[];
  activeStrategies: string[];
  createdAt: string;
}

const PORTFOLIO_KEY = "finpulse_portfolio";

const DEFAULT_PORTFOLIO: Portfolio = {
  initialCapital: 100000000,
  cash: 100000000,
  positions: [],
  trades: [],
  activeStrategies: [],
  createdAt: new Date().toISOString(),
};

export function getPortfolio(): Portfolio {
  if (typeof window === "undefined") return DEFAULT_PORTFOLIO;
  const data = localStorage.getItem(PORTFOLIO_KEY);
  if (!data) return DEFAULT_PORTFOLIO;
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_PORTFOLIO;
  }
}

export function savePortfolio(portfolio: Portfolio) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(portfolio));
}

export function resetPortfolio(initialCapital: number = 100000000) {
  const p: Portfolio = {
    ...DEFAULT_PORTFOLIO,
    initialCapital,
    cash: initialCapital,
    createdAt: new Date().toISOString(),
  };
  savePortfolio(p);
  return p;
}

export function addTrade(
  symbol: string,
  name: string,
  type: "buy" | "sell",
  price: number,
  quantity: number,
  strategyId: string
): Portfolio {
  const portfolio = getPortfolio();
  const total = price * quantity;

  if (type === "buy") {
    if (portfolio.cash < total) return portfolio; // 잔고 부족
    portfolio.cash -= total;

    const existing = portfolio.positions.find((p) => p.symbol === symbol);
    if (existing) {
      const newTotal = existing.quantity + quantity;
      existing.avgPrice = (existing.avgPrice * existing.quantity + price * quantity) / newTotal;
      existing.quantity = newTotal;
      existing.currentPrice = price;
    } else {
      portfolio.positions.push({ symbol, name, quantity, avgPrice: price, currentPrice: price, strategyId });
    }
  } else {
    const existing = portfolio.positions.find((p) => p.symbol === symbol);
    if (!existing || existing.quantity < quantity) return portfolio;
    portfolio.cash += total;
    existing.quantity -= quantity;
    existing.currentPrice = price;
    if (existing.quantity === 0) {
      portfolio.positions = portfolio.positions.filter((p) => p.symbol !== symbol);
    }
  }

  portfolio.trades.push({
    id: Date.now().toString(),
    time: new Date().toISOString(),
    symbol,
    name,
    type,
    price,
    quantity,
    total,
    strategyId,
  });

  savePortfolio(portfolio);
  return portfolio;
}

export function updatePositionPrice(symbol: string, currentPrice: number) {
  const portfolio = getPortfolio();
  const pos = portfolio.positions.find((p) => p.symbol === symbol);
  if (pos) {
    pos.currentPrice = currentPrice;
    savePortfolio(portfolio);
  }
}

export function getPortfolioStats(portfolio: Portfolio) {
  const totalPositionValue = portfolio.positions.reduce(
    (sum, p) => sum + p.quantity * p.currentPrice,
    0
  );
  const totalValue = portfolio.cash + totalPositionValue;
  const totalReturn = ((totalValue - portfolio.initialCapital) / portfolio.initialCapital) * 100;
  const totalPnL = totalValue - portfolio.initialCapital;

  return {
    totalValue,
    totalReturn,
    totalPnL,
    totalPositionValue,
    positionCount: portfolio.positions.length,
    tradeCount: portfolio.trades.length,
  };
}

export function toggleStrategy(strategyId: string) {
  const portfolio = getPortfolio();
  const idx = portfolio.activeStrategies.indexOf(strategyId);
  if (idx >= 0) {
    portfolio.activeStrategies.splice(idx, 1);
  } else {
    portfolio.activeStrategies.push(strategyId);
  }
  savePortfolio(portfolio);
  return portfolio;
}
