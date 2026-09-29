import { useSyncExternalStore } from "react";
import type { Stock } from "./market/types";

/**
 * Paper-trading engine + store. All money is virtual (₹1,00,000 starting
 * balance). State persists to localStorage. No real orders are ever placed.
 */

export const STARTING_BALANCE = 100_000;

export interface Holding {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  at: number;
}

export interface PortfolioState {
  cash: number;
  holdings: Holding[];
  trades: Trade[];
}

const PORTFOLIO_KEY = "nexttrade.portfolio";

function defaultPortfolio(): PortfolioState {
  return { cash: STARTING_BALANCE, holdings: [], trades: [] };
}

function loadPortfolio(): PortfolioState {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    if (!raw) return defaultPortfolio();
    const parsed = JSON.parse(raw) as PortfolioState;
    if (typeof parsed.cash !== "number" || !Array.isArray(parsed.holdings)) return defaultPortfolio();
    return parsed;
  } catch {
    return defaultPortfolio();
  }
}

let state: PortfolioState = loadPortfolio();
const listeners = new Set<() => void>();

function persist() {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(state));
}

function setPortfolio(next: PortfolioState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function subscribePortfolio(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPortfolio(): PortfolioState {
  return state;
}

export function resetPortfolio() {
  setPortfolio(defaultPortfolio());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface TradeResult {
  ok: boolean;
  error?: string;
}

export function buyStock(symbol: string, quantity: number, price: number): TradeResult {
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "Enter a valid quantity." };
  const total = round2(quantity * price);
  if (total > state.cash) {
    return { ok: false, error: "Insufficient virtual balance for this order." };
  }
  const holdings = [...state.holdings];
  const idx = holdings.findIndex((h) => h.symbol === symbol);
  if (idx >= 0) {
    const h = holdings[idx];
    const newQty = h.quantity + quantity;
    holdings[idx] = {
      ...h,
      quantity: newQty,
      avgBuyPrice: round2((h.avgBuyPrice * h.quantity + price * quantity) / newQty),
    };
  } else {
    holdings.push({ symbol, quantity, avgBuyPrice: price });
  }
  const trade: Trade = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    side: "BUY",
    quantity,
    price,
    total,
    at: Date.now(),
  };
  setPortfolio({ cash: round2(state.cash - total), holdings, trades: [trade, ...state.trades].slice(0, 100) });
  return { ok: true };
}

export function sellStock(symbol: string, quantity: number, price: number): TradeResult {
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "Enter a valid quantity." };
  const idx = state.holdings.findIndex((h) => h.symbol === symbol);
  if (idx < 0) return { ok: false, error: "You don't hold this stock." };
  const h = state.holdings[idx];
  if (quantity > h.quantity) return { ok: false, error: `You only hold ${h.quantity} shares.` };
  const total = round2(quantity * price);
  const holdings = [...state.holdings];
  const remaining = h.quantity - quantity;
  if (remaining === 0) holdings.splice(idx, 1);
  else holdings[idx] = { ...h, quantity: remaining };
  const trade: Trade = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    side: "SELL",
    quantity,
    price,
    total,
    at: Date.now(),
  };
  setPortfolio({ cash: round2(state.cash + total), holdings, trades: [trade, ...state.trades].slice(0, 100) });
  return { ok: true };
}

// ---------- calculations ----------

export interface PortfolioComputed {
  cash: number;
  invested: number;
  holdingsValue: number;
  portfolioValue: number;
  overallPnl: number;
  overallPnlPct: number;
}

export function computePortfolio(holdings: Holding[], stocks: Record<string, Stock>): PortfolioComputed {
  let invested = 0;
  let holdingsValue = 0;
  for (const h of holdings) {
    invested += h.quantity * h.avgBuyPrice;
    const price = stocks[h.symbol]?.price ?? h.avgBuyPrice;
    holdingsValue += h.quantity * price;
  }
  invested = round2(invested);
  holdingsValue = round2(holdingsValue);
  const portfolioValue = round2(state.cash + holdingsValue);
  const overallPnl = round2(portfolioValue - STARTING_BALANCE);
  return {
    cash: state.cash,
    invested,
    holdingsValue,
    portfolioValue,
    overallPnl,
    overallPnlPct: invested > 0 ? ((holdingsValue - invested) / invested) * 100 : 0,
  };
}

export function holdingPnl(h: Holding, price: number) {
  const invested = round2(h.quantity * h.avgBuyPrice);
  const current = round2(h.quantity * price);
  const pnl = round2(current - invested);
  return { invested, current, pnl, pnlPct: invested > 0 ? (pnl / invested) * 100 : 0 };
}

/** React hook for components that need reactive portfolio state. */
export function usePortfolio(): PortfolioState {
  return useSyncExternalStore(subscribePortfolio, getPortfolio, getPortfolio);
}
