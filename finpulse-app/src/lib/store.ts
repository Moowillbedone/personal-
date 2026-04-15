"use client";

export interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  targetPrice: number;
  condition: "above" | "below";
  currency: string;
  createdAt: string;
}

const WATCHLIST_KEY = "finpulse_watchlist";
const ALERTS_KEY = "finpulse_alerts";

export function getWatchlist(): string[] {
  if (typeof window === "undefined") return ["NVDA", "005930", "bitcoin"];
  const data = localStorage.getItem(WATCHLIST_KEY);
  return data ? JSON.parse(data) : ["NVDA", "005930", "bitcoin"];
}

function notifyWatchlistChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("watchlist-changed"));
  }
}

export function addToWatchlist(symbol: string) {
  const list = getWatchlist();
  if (!list.includes(symbol)) {
    list.push(symbol);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
    notifyWatchlistChange();
  }
}

export function removeFromWatchlist(symbol: string) {
  const list = getWatchlist().filter((s) => s !== symbol);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  notifyWatchlistChange();
}

export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().includes(symbol);
}

export function getAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(ALERTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addAlert(alert: Omit<PriceAlert, "id" | "createdAt">) {
  const alerts = getAlerts();
  alerts.push({ ...alert, id: Date.now().toString(), createdAt: new Date().toISOString() });
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function removeAlert(id: string) {
  const alerts = getAlerts().filter((a) => a.id !== id);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}
