import type { Severity } from "../market/types";

/**
 * AI service layer — shared contract.
 *
 * Every provider (the local rule engine today, the organizer's remote AI API
 * tomorrow) consumes `AiAnalysisInput` and produces `AiAnalysisResult`.
 * Nothing else in the app should depend on which provider answered.
 */

export type AiSensitivity = "low" | "medium" | "high";

export type AiSignal = "bullish" | "bearish" | "neutral";

/** Which engine produced a result. */
export type AiSource = "remote" | "rules";

export type UnusualMovementKind = "movement" | "volume" | "momentum" | "market";

/** Flag raised by detectors (the mock agent / future real feed). */
export interface UnusualMovement {
  detected: boolean;
  kind: UnusualMovementKind;
  /** % move for "movement"/"momentum", volume ÷ averageVolume for "volume". */
  magnitude: number;
  direction: "up" | "down" | "flat";
  /** Optional human-readable note from the detector. */
  note?: string;
}

/** What the service accepts for one analysis (matches the organizer spec). */
export interface AiAnalysisInput {
  symbol: string;
  currentPrice: number;
  /** % change vs previous close. */
  changePercent: number;
  volume: number;
  averageVolume: number;
  /** Recent intraday prices, oldest first. */
  recentHistory: number[];
  unusualMovement?: UnusualMovement;
}

/** What the service returns for one analysis (matches the organizer spec). */
export interface AiAnalysisResult {
  symbol: string;
  severity: Severity;
  title: string;
  explanation: string;
  signal: AiSignal;
  /** 0–1. */
  confidence: number;
  /** Extra provenance field so the UI can show which engine answered. */
  source: AiSource;
}

/** Any engine that can turn an input into a result (null ⇒ caller falls back). */
export interface AiProvider {
  readonly name: AiSource;
  analyze(input: AiAnalysisInput): Promise<AiAnalysisResult | null>;
}

export interface AiAnalysisOptions {
  sensitivity?: AiSensitivity;
}
