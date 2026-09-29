import type { Candle, IndexQuote, RangeKey, Stock } from "./types";

/**
 * Static universe of Indian stocks used by the mock market.
 * `basePrice` is a realistic price level the simulation reverts around.
 */
export interface StockSeed {
  symbol: string;
  name: string;
  sector: string;
  basePrice: number;
  /** Relative intraday volatility factor. */
  vol: number;
  avgVolume: number;
}

export const STOCK_SEEDS: StockSeed[] = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy", basePrice: 1428, vol: 1.0, avgVolume: 9_800_000 },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd", sector: "IT", basePrice: 3102, vol: 0.8, avgVolume: 2_600_000 },
  { symbol: "INFY", name: "Infosys Ltd", sector: "IT", basePrice: 1596, vol: 1.1, avgVolume: 5_200_000 },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Banking", basePrice: 1712, vol: 0.9, avgVolume: 7_400_000 },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Banking", basePrice: 1284, vol: 1.0, avgVolume: 8_100_000 },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking", basePrice: 842, vol: 1.2, avgVolume: 12_500_000 },
  { symbol: "ITC", name: "ITC Ltd", sector: "FMCG", basePrice: 408, vol: 0.7, avgVolume: 14_200_000 },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecom", basePrice: 1645, vol: 0.9, avgVolume: 4_300_000 },
  { symbol: "LT", name: "Larsen & Toubro Ltd", sector: "Infrastructure", basePrice: 3610, vol: 1.0, avgVolume: 1_900_000 },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", sector: "Banking", basePrice: 1129, vol: 1.1, avgVolume: 6_700_000 },
];

export const DEFAULT_WATCHLIST = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN"];

/** Stocks the AI agent monitors. */
export const AI_MONITORED = DEFAULT_WATCHLIST;

export const INDEX_SEEDS = [
  { symbol: "NIFTY 50", name: "Nifty 50", base: 24850, vol: 0.4 },
  { symbol: "BANK NIFTY", name: "Nifty Bank", base: 53480, vol: 0.55 },
  { symbol: "SENSEX", name: "BSE Sensex", base: 81260, vol: 0.38 },
];

export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Deterministic, mean-reverting random-walk used for all mock histories. */
export function generateHistory(
  basePrice: number,
  points: number,
  seed: number,
  volatilityPct: number,
): number[] {
  const rand = seededRandom(seed);
  const out: number[] = [];
  let value = basePrice * (1 - (volatilityPct / 100) * 0.9);
  for (let i = 0; i < points; i++) {
    const drift = (basePrice - value) * 0.045;
    const noise = (rand() - 0.5) * 2 * basePrice * (volatilityPct / 100) * 0.16;
    value = Math.max(1, value + drift + noise);
    out.push(value);
  }
  // Land the series at the base price so day charts meet the live quote.
  const err = basePrice - out[out.length - 1];
  for (let i = 0; i < points; i++) out[i] += err * ((i + 1) / points);
  return out;
}

export function historyToCandles(values: number[], labels: string[]): Candle[] {
  return values.map((price, i) => ({ time: labels[i] ?? "", price }));
}

export function seedStock(seed: StockSeed, seedNum: number, dayVolatility = 1.9): Stock {
  const history = generateHistory(seed.basePrice, 80, seedNum + seed.symbol.length * 31, dayVolatility);
  const price = history[history.length - 1];
  const previousClose = history[0];
  const dayHigh = Math.max(...history);
  const dayLow = Math.min(...history);
  const volumeFactor = 0.65 + seededRandom(seedNum + 7)() * 0.5; // start below the spike threshold
  return {
    symbol: seed.symbol,
    name: seed.name,
    sector: seed.sector,
    price,
    previousClose,
    open: history[Math.floor(history.length * 0.2)],
    dayHigh,
    dayLow,
    volume: Math.round(seed.avgVolume * volumeFactor),
    avgVolume: seed.avgVolume,
  };
}

export function seedIndex(
  seed: { symbol: string; name: string; base: number; vol: number },
  seedNum: number,
): IndexQuote {
  const history = generateHistory(seed.base, 40, seedNum + seed.symbol.length * 97, seed.vol);
  const value = history[history.length - 1];
  const previousClose = history[0];
  return {
    symbol: seed.symbol,
    name: seed.name,
    value,
    previousClose,
    change: value - previousClose,
    changePercent: ((value - previousClose) / previousClose) * 100,
    sparkline: history,
  };
}

export const RANGE_LABELS: Record<RangeKey, string[]> = {
  "1D": ["09:15", "10:00", "10:45", "11:30", "12:15", "13:00", "13:45", "14:30", "15:15", "15:30"],
  "1W": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "1M": ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
  "3M": ["Jul", "Aug", "Sep"],
  "1Y": ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
};
