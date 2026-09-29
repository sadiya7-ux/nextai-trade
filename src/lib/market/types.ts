export type MarketStatus = "OPEN" | "CLOSED" | "PRE_OPEN";

export type Severity = "low" | "medium" | "high";

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  /** Last traded price (paise-accurate, always 2 decimals when formatted). */
  price: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  avgVolume: number;
}

export interface IndexQuote {
  symbol: string;
  name: string;
  value: number;
  previousClose: number;
  change: number;
  changePercent: number;
  sparkline: number[];
}

export interface StockAlert {
  id: string;
  symbol: string;
  title: string;
  message: string;
  severity: Severity;
  createdAt: number;
  kind: "movement" | "volume" | "momentum" | "market";
  read: boolean;
}

export interface Candle {
  time: string;
  price: number;
}

export type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y";
