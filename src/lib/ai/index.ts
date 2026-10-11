import { isAiApiConfigured } from "./config";
import { evaluateRules } from "./rule-engine";
import { fetchRemoteAnalysis } from "./remote-client";
import type { AiAnalysisInput, AiAnalysisOptions, AiAnalysisResult } from "./types";

export type {
  AiAnalysisInput,
  AiAnalysisOptions,
  AiAnalysisResult,
  AiProvider,
  AiSignal,
  AiSource,
  AiSensitivity,
  UnusualMovement,
  UnusualMovementKind,
} from "./types";
export { AI_API_CONFIG, isAiApiConfigured } from "./config";
export { evaluateRules } from "./rule-engine";
export { fetchRemoteAnalysis } from "./remote-client";

/**
 * Public entry point of the AI service layer.
 *
 * Strategy: try the organizer's remote AI API first (only when configured via
 * env vars). If it is unconfigured, unreachable, slow, or returns anything we
 * cannot validate, fall back silently to the local rule-based engine so the
 * app keeps producing alerts exactly as it does today.
 */
export async function analyzeStock(
  input: AiAnalysisInput,
  options: AiAnalysisOptions = {},
): Promise<AiAnalysisResult> {
  if (isAiApiConfigured()) {
    const remote = await fetchRemoteAnalysis(input, options);
    if (remote) return remote;
  }
  return evaluateRules(input, options);
}

/** Build an input object from a market-engine Stock + intraday series. */
export function buildAiInput(params: {
  symbol: string;
  currentPrice: number;
  changePercent: number;
  volume: number;
  averageVolume: number;
  recentHistory: number[];
  unusualMovement?: AiAnalysisInput["unusualMovement"];
}): AiAnalysisInput {
  return params;
}
