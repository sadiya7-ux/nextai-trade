import { useSyncExternalStore } from "react";
import {
  AI_MONITORED,
  INDEX_SEEDS,
  RANGE_LABELS,
  STOCK_SEEDS,
  generateHistory,
  seedIndex,
  seedStock,
} from "./seed";
import type {
  Candle,
  IndexQuote,
  MarketStatus,
  RangeKey,
  Stock,
} from "./types";

/**
 * Mock market engine.
 *
 * This module is the single source of truth for quotes. It exposes a
 * `subscribe` + snapshot API so a real market-data provider (Upstox, broker
 * websocket, REST polling...) can replace `startEngine` later without touching
 * any UI component.
 */

const ENGINE_VERSION = 1;
const BASE_TICK_MS = 2_000; // live simulation heartbeat

interface MarketState {
  stocks: Record<string, Stock>;
  indices: IndexQuote[];
  marketStatus: MarketStatus;
  intraday: Record<string, number[]>; // running 1D series per symbol
  version: number;
}

let state: MarketState = initState();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

/** IST-based market clock (NSE hours 09:15–15:30, Mon–Fri). */
export function getMarketStatus(now = new Date()): MarketStatus {
  const ist = new Date(now.getTime() + 330 * 60_000); // IST = UTC+5:30
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return "CLOSED";
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (minutes >= 540 && minutes < 555) return "PRE_OPEN";
  if (minutes >= 555 && minutes <= 930) return "OPEN";
  return "CLOSED";
}

function initState(): MarketState {
  const stocks: Record<string, Stock> = {};
  const intraday: Record<string, number[]> = {};
  STOCK_SEEDS.forEach((seed, i) => {
    const stock = seedStock(seed, i * 13 + 5);
    stocks[seed.symbol] = stock;
    intraday[seed.symbol] = generateHistory(
      stock.price,
      60,
      i * 13 + 5 + 1,
      1.4,
    );
  });
  const indices = INDEX_SEEDS.map((seed, i) => seedIndex(seed, i * 29 + 3));
  return { stocks, indices, marketStatus: getMarketStatus(), intraday, version: ENGINE_VERSION };
}

function notify() {
  listeners.forEach((l) => l());
}

function randomWalk(value: number, volPct: number): number {
  const shock = (Math.random() - 0.5) * 2 * volPct;
  return Math.max(1, value * (1 + shock / 100));
}

function tick() {
  const nextStocks: Record<string, Stock> = {};
  const nextIntraday: Record<string, number[]> = {};
  for (const seed of STOCK_SEEDS) {
    const cur = state.stocks[seed.symbol];
    const vol = 0.12 * seed.vol; // percent per tick
    const price = randomWalk(cur.price, vol);
    nextStocks[seed.symbol] = {
      ...cur,
      price,
      dayHigh: Math.max(cur.dayHigh, price),
      dayLow: Math.min(cur.dayLow, price),
      volume: cur.volume + Math.round(cur.avgVolume * (0.0004 + Math.random() * 0.0012) * seed.vol),
    };
    const series = state.intraday[seed.symbol];
    nextIntraday[seed.symbol] = [...series.slice(-120), price];
  }
  const indices = state.indices.map((idx) => {
    const vol = idx.symbol === "BANK NIFTY" ? 0.05 : 0.035;
    const value = randomWalk(idx.value, vol);
    const sparkline = [...idx.sparkline.slice(-40), value];
    return {
      ...idx,
      value,
      change: value - idx.previousClose,
      changePercent: ((value - idx.previousClose) / idx.previousClose) * 100,
      sparkline,
    };
  });
  state = {
    ...state,
    stocks: nextStocks,
    intraday: nextIntraday,
    indices,
    marketStatus: getMarketStatus(),
    version: state.version + 1,
  };
  notify();
}

export function startEngine() {
  if (timer) return;
  timer = setInterval(tick, BASE_TICK_MS);
}

export function stopEngine() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  startEngine();
  return () => {
    listeners.delete(listener);
    // Keep the engine running; other subscribers may remain.
  };
}

export function getSnapshot(): MarketState {
  return state;
}

/** React hook: subscribes the component to live mock market updates. */
export function useMarket(): MarketState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useStock(symbol: string | undefined): Stock | undefined {
  const market = useMarket();
  return symbol ? market.stocks[symbol] : undefined;
}

// ---------- formatting helpers ----------

export function formatInr(value: number, decimals = 2): string {
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatIndexValue(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatVolume(value: number): string {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(2)} L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} K`;
  return String(value);
}

// ---------- derived data ----------

export function getChangePercent(stock: Stock): number {
  return ((stock.price - stock.previousClose) / stock.previousClose) * 100;
}

export function getMovers(stocks: Record<string, Stock>) {
  const list = Object.values(stocks).map((s) => ({
    stock: s,
    changePercent: getChangePercent(s),
  }));
  const gainers = [...list].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const losers = [...list].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
  return { gainers, losers };
}

/** Precomputed 1D chart for a symbol (deterministic + live tail). */
export function getStockCandles(symbol: string): Candle[] {
  const series = state.intraday[symbol] ?? [];
  return distributeLabels(series, RANGE_LABELS["1D"]);
}

/** Maps a small set of axis labels across a longer series, proportionally. */
function distributeLabels(values: number[], labels: string[]): Candle[] {
  return values.map((price, i) => ({
    price,
    time: labels[Math.min(labels.length - 1, Math.floor((i / Math.max(1, values.length - 1)) * (labels.length - 1)))] ?? "",
  }));
}

/** Deterministic longer-range history for range filters. */
export function getStockRangeCandles(symbol: string, range: RangeKey): Candle[] {
  const seed = STOCK_SEEDS.find((s) => s.symbol === symbol);
  if (!seed) return [];
  if (range === "1D") return getStockCandles(symbol);
  const pointsByRange: Record<Exclude<RangeKey, "1D">, number> = {
    "1W": 30,
    "1M": 40,
    "3M": 45,
    "1Y": 60,
  };
  const volByRange: Record<Exclude<RangeKey, "1D">, number> = {
    "1W": 3.5,
    "1M": 7,
    "3M": 11,
    "1Y": 22,
  };
  const seedNum = STOCK_SEEDS.indexOf(seed) * 13 + 5 + range.length * 41;
  const anchor = state.stocks[symbol]?.price ?? seed.basePrice;
  const values = generateHistory(anchor, pointsByRange[range], seedNum, volByRange[range]);
  return distributeLabels(values, RANGE_LABELS[range]);
}

export function getIndexSparkline(symbol: string): number[] {
  return state.indices.find((i) => i.symbol === symbol)?.sparkline ?? [];
}

/** AI analysis blurb for a stock — template-driven mock "AI" text. */
export function getAiAnalysis(stock: Stock): string {
  const change = getChangePercent(stock);
  const volRatio = stock.volume / stock.avgVolume;
  const dirWord = change >= 0 ? "upward" : "downward";
  const trendWord = Math.abs(change) > 1.2 ? "strong" : "steady";
  const volWord = volRatio > 1.1 ? "higher-than-average" : "near-average";
  return `${stock.symbol} is showing ${trendWord} short-term ${dirWord} momentum with ${volWord} volume. The AI agent detected unusual activity during the recent price movement and is monitoring ${stock.symbol} for continuation or reversal around ₹${stock.price.toFixed(0)}.`;
}

/** Symbols the AI agent watches (mock config). */
export function monitoredSymbols(): string[] {
  return AI_MONITORED;
}
