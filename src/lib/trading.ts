import { useSyncExternalStore } from "react";
import { formatInr, getMarketStatus } from "./market/engine";
import type { MarketStatus, Stock } from "./market/types";

/**
 * Paper-trading engine + store. All money is virtual (₹1,00,000 starting
 * balance). State persists to localStorage. No real orders are ever placed.
 *
 * GUARDRAILS: every order — BUY or SELL — must pass `validateOrder`
 * immediately before execution. The same function powers the five-step BUY
 * verification UI, so what the checklist shows is exactly what execution
 * enforces. Risk confirmations in the UI can never bypass these checks.
 */

export const STARTING_BALANCE = 100_000;

// ---------------- Trading guardrails (hard rules) ----------------

/** No single order (BUY or SELL) may exceed this value (qty × price). */
export const MAX_ORDER_VALUE = 50_000;
/** Max successful BUY orders across all symbols per rolling window. */
export const BUY_RATE_LIMIT = 3;
export const BUY_RATE_WINDOW_MS = 60_000;
/** BUYs are blocked after this many consecutive losing SELL trades. */
export const MAX_CONSECUTIVE_LOSSES = 3;
/** An identical order (symbol+side+qty+price) inside this window is a duplicate. */
export const DUPLICATE_ORDER_WINDOW_MS = 1_000;

export type OrderSide = "BUY" | "SELL";

/**
 * Injectable clock / market state so tests can deterministically exercise
 * market-hours and rolling-window behaviour. Production callers omit it and
 * get the real clock.
 */
export interface OrderContext {
  now?: number;
  marketStatus?: MarketStatus;
}

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
  /** Realized P&L on SELL trades (sell price vs avg buy price). Drives the
   * consecutive-loss guard. Absent on BUYs and on legacy records. */
  pnl?: number;
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
    // Only *add* missing fields — never silently reset an existing account.
    if (!Array.isArray(parsed.trades)) parsed.trades = [];
    return parsed;
  } catch {
    return defaultPortfolio();
  }
}

let state: PortfolioState = loadPortfolio();
const listeners = new Set<() => void>();

/** Rolling timestamps of successful BUYs (in-memory by design: a reload of
 * the page starts a fresh rate-limit window, but never resets balances or
 * trade history). */
let buyTimestamps: number[] = [];

function persist() {
  try {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(state));
  } catch {
    // storage full / unavailable (e.g. private mode) — state stays in memory
  }
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

/** Explicit user action (Portfolio page button). Never called on startup. */
export function resetPortfolio() {
  buyTimestamps = [];
  setPortfolio(defaultPortfolio());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------- Validation ----------------

export type OrderCheckId =
  | "price"
  | "quantity"
  | "orderValue"
  | "marketHours"
  | "duplicate"
  | "funds"
  | "buyRateLimit"
  | "losingStreak";

export interface OrderCheck {
  id: OrderCheckId;
  label: string;
  ok: boolean;
  detail: string;
}

export interface OrderValidation {
  ok: boolean;
  side: OrderSide;
  symbol: string;
  quantity: number;
  price: number;
  orderValue: number;
  /** Cash remaining after a BUY (or added by a SELL) at this price. */
  cashAfter: number;
  checks: OrderCheck[];
  /** Details of every failing check, in enforcement priority order. */
  errors: string[];
}

function countBuysInWindow(now: number): number {
  return buyTimestamps.filter((t) => t > now - BUY_RATE_WINDOW_MS).length;
}

/** Successful BUYs in the rolling 60s window (for UI display). */
export function getBuyRateUsage(ctx: OrderContext = {}): { used: number; limit: number } {
  return { used: countBuysInWindow(ctx.now ?? Date.now()), limit: BUY_RATE_LIMIT };
}

/**
 * Trailing consecutive losing SELL trades, newest first.
 *
 * Reset condition (the only one): a completed SELL that is NOT a loss
 * (break-even or profit) ends the streak. BUYs neither extend nor reset it.
 * The streak is derived from trade history — it is never reset silently.
 */
export function getConsecutiveLosses(): Trade[] {
  const losses: Trade[] = [];
  for (const t of state.trades) {
    if (t.side !== "SELL") continue;
    if (t.pnl === undefined || t.pnl >= 0) break;
    losses.push(t);
  }
  return losses;
}

/**
 * Central order validation. Runs every applicable hard rule for an order and
 * returns per-check results so the UI can render the five-step checklist from
 * exactly the same verdict execution uses.
 */
export function validateOrder(
  side: OrderSide,
  symbol: string,
  quantity: number,
  price: number,
  ctx: OrderContext = {},
): OrderValidation {
  const now = ctx.now ?? Date.now();
  const status = ctx.marketStatus ?? getMarketStatus(new Date(now));
  const checks: OrderCheck[] = [];

  // 1. Price must be a finite positive number.
  const priceOk = Number.isFinite(price) && price > 0;
  checks.push({
    id: "price",
    label: "Execution price",
    ok: priceOk,
    detail: priceOk ? formatInr(price) : "Invalid execution price.",
  });

  // 2. Quantity must be a finite positive number.
  const qtyOk = Number.isFinite(quantity) && quantity > 0;
  checks.push({
    id: "quantity",
    label: "Quantity",
    ok: qtyOk,
    detail: qtyOk ? `${quantity} share${quantity === 1 ? "" : "s"}` : "Enter a valid quantity.",
  });

  // 3. Order value = quantity × price, capped at ₹50,000 for BUY and SELL.
  const orderValue = priceOk && qtyOk ? round2(quantity * price) : 0;
  const valueKnown = priceOk && qtyOk;
  const capOk = valueKnown && orderValue <= MAX_ORDER_VALUE;
  checks.push({
    id: "orderValue",
    label: `Order value (max ${formatInr(MAX_ORDER_VALUE, 0)})`,
    ok: capOk,
    detail: !valueKnown
      ? "Cannot compute order value — invalid quantity or price."
      : capOk
        ? formatInr(orderValue)
        : `Order value ${formatInr(orderValue)} exceeds the ${formatInr(MAX_ORDER_VALUE, 0)} per-order limit.`,
  });

  // 4. Market hours (NSE 09:15–15:30 IST, Mon–Fri).
  const marketOk = status === "OPEN";
  checks.push({
    id: "marketHours",
    label: "Market hours",
    ok: marketOk,
    detail: marketOk
      ? "Market is OPEN (NSE 09:15–15:30 IST)."
      : `Market is ${status} — orders execute only during market hours (09:15–15:30 IST, Mon–Fri).`,
  });

  // 5. Duplicate-order protection: identical order repeated within 1 second.
  const dupStart = now - DUPLICATE_ORDER_WINDOW_MS;
  const duplicate = state.trades.some(
    (t) => t.at >= dupStart && t.symbol === symbol && t.side === side && t.quantity === quantity && t.price === price,
  );
  checks.push({
    id: "duplicate",
    label: "Duplicate order",
    ok: !duplicate,
    detail: duplicate
      ? "An identical order was placed in the last second — duplicate blocked."
      : "No duplicate detected.",
  });

  // 6. Funds (BUY) / holdings (SELL) — existing protections, preserved.
  let fundsOk: boolean;
  let fundsDetail: string;
  if (side === "BUY") {
    fundsOk = valueKnown && orderValue <= state.cash;
    fundsDetail = fundsOk
      ? `Available cash ${formatInr(state.cash)} → ${formatInr(round2(state.cash - orderValue))} after this order.`
      : valueKnown && orderValue > state.cash
        ? "Insufficient virtual balance for this order."
        : "Enter a valid quantity.";
  } else {
    const h = state.holdings.find((x) => x.symbol === symbol);
    if (!h) {
      fundsOk = false;
      fundsDetail = "You don't hold this stock.";
    } else if (!qtyOk) {
      fundsOk = false;
      fundsDetail = "Enter a valid quantity.";
    } else if (quantity > h.quantity) {
      fundsOk = false;
      fundsDetail = `You only hold ${h.quantity} shares.`;
    } else {
      fundsOk = true;
      fundsDetail = `You hold ${h.quantity} share${h.quantity === 1 ? "" : "s"} of ${symbol}.`;
    }
  }
  checks.push({ id: "funds", label: side === "BUY" ? "Funds" : "Holdings", ok: fundsOk, detail: fundsDetail });

  // BUY-only hard rules.
  if (side === "BUY") {
    const used = countBuysInWindow(now);
    const rateOk = used < BUY_RATE_LIMIT;
    checks.push({
      id: "buyRateLimit",
      label: `BUY rate limit (${BUY_RATE_LIMIT} per 60s)`,
      ok: rateOk,
      detail: rateOk
        ? `${used} of ${BUY_RATE_LIMIT} BUYs used in the last 60 seconds.`
        : `Rate limit reached: ${used} successful BUYs in the last 60 seconds. The fourth BUY is rejected until an earlier BUY falls outside the window.`,
    });

    const losses = getConsecutiveLosses();
    const streakOk = losses.length < MAX_CONSECUTIVE_LOSSES;
    checks.push({
      id: "losingStreak",
      label: `Consecutive-loss guard (${MAX_CONSECUTIVE_LOSSES} losing SELLs)`,
      ok: streakOk,
      detail: streakOk
        ? losses.length > 0
          ? `${losses.length} of ${MAX_CONSECUTIVE_LOSSES} consecutive losing SELLs — BUYs still allowed.`
          : "No consecutive losing SELL streak."
        : `BUYs are blocked after ${losses.length} consecutive losing SELL trades. Changing the stock or quantity does not help — complete a SELL that is not a loss (break-even or profit) to reset the streak. It is never reset silently.`,
    });
  }

  const errors = checks.filter((c) => !c.ok).map((c) => c.detail);
  return {
    ok: errors.length === 0,
    side,
    symbol,
    quantity,
    price,
    orderValue,
    cashAfter: valueKnown
      ? round2(side === "BUY" ? state.cash - orderValue : state.cash + orderValue)
      : state.cash,
    checks,
    errors,
  };
}

export interface TradeResult {
  ok: boolean;
  error?: string;
}

/** BUY: validates every hard rule immediately before executing. */
export function buyStock(symbol: string, quantity: number, price: number, ctx: OrderContext = {}): TradeResult {
  const validation = validateOrder("BUY", symbol, quantity, price, ctx);
  if (!validation.ok) return { ok: false, error: validation.errors[0] };

  const now = ctx.now ?? Date.now();
  const total = validation.orderValue;
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
    at: now,
  };
  setPortfolio({ cash: round2(state.cash - total), holdings, trades: [trade, ...state.trades].slice(0, 100) });
  // Record only successful BUYs — failed/rejected orders never count.
  buyTimestamps = [...buyTimestamps.filter((t) => t > now - BUY_RATE_WINDOW_MS), now];
  return { ok: true };
}

/** SELL: validates every hard rule immediately before executing. */
export function sellStock(symbol: string, quantity: number, price: number, ctx: OrderContext = {}): TradeResult {
  const validation = validateOrder("SELL", symbol, quantity, price, ctx);
  if (!validation.ok) return { ok: false, error: validation.errors[0] };

  const holding = state.holdings.find((h) => h.symbol === symbol);
  if (!holding) return { ok: false, error: "You don't hold this stock." };

  const now = ctx.now ?? Date.now();
  const total = validation.orderValue;
  const holdings = [...state.holdings];
  const idx = holdings.findIndex((h) => h.symbol === symbol);
  const remaining = holding.quantity - quantity;
  if (remaining === 0) holdings.splice(idx, 1);
  else holdings[idx] = { ...holding, quantity: remaining };
  const trade: Trade = {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    symbol,
    side: "SELL",
    quantity,
    price,
    total,
    at: now,
    pnl: round2((price - holding.avgBuyPrice) * quantity),
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
