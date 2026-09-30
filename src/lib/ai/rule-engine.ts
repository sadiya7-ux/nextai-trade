import { MOVE_THRESHOLDS, VOLUME_RATIO_THRESHOLDS } from "../market/agent";
import type { AiAnalysisInput, AiAnalysisOptions, AiAnalysisResult, AiSignal } from "./types";

/**
 * Local rule-based "AI" — the always-available fallback.
 *
 * Deterministic and synchronous: same input always yields the same result.
 * Uses the exact same thresholds as the mock agent in `market/agent.ts`, so
 * its output stays consistent with the alerts users already see.
 */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function evaluateRules(
  input: AiAnalysisInput,
  options: AiAnalysisOptions = {},
): AiAnalysisResult {
  const sensitivity = options.sensitivity ?? "medium";
  const moveT = MOVE_THRESHOLDS[sensitivity];
  const volT = VOLUME_RATIO_THRESHOLDS[sensitivity];

  const pct = Number.isFinite(input.changePercent) ? input.changePercent : 0;
  const ratio = input.averageVolume > 0 ? input.volume / input.averageVolume : 1;

  const signal: AiSignal = pct > 0.15 ? "bullish" : pct < -0.15 ? "bearish" : "neutral";
  const dirWord = signal === "bullish" ? "upward" : signal === "bearish" ? "downward" : "sideways";

  // Scores in 0–1: how far past the alert thresholds we are.
  const moveScore = clamp(Math.abs(pct) / (moveT * 3), 0, 1);
  const volScore = clamp((ratio - 1) / Math.max(0.001, volT * 1.8 - 1), 0, 1);
  const unusualBoost = input.unusualMovement?.detected ? 0.15 : 0;
  const score = clamp(Math.max(moveScore, volScore) + unusualBoost, 0, 1);

  const severity = score >= 0.66 ? "high" : score >= 0.33 ? "medium" : "low";
  const confidence = clamp(0.4 + score * 0.45, 0.35, 0.85); // rules never claim > 85%

  const kind = input.unusualMovement?.detected ? input.unusualMovement.kind : null;
  let title: string;
  if (kind === "volume") title = `${input.symbol}: unusual volume with ${dirWord} drift`;
  else if (kind === "momentum") title = `${input.symbol}: sustained ${dirWord} momentum`;
  else if (severity === "high") title = `${input.symbol}: high-severity ${dirWord} move`;
  else if (severity === "medium") title = `${input.symbol}: unusual ${dirWord} momentum`;
  else title = `${input.symbol}: steady ${dirWord} tape`;

  const explanation = [
    `${input.symbol} is trading ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% at ₹${input.currentPrice.toFixed(2)}.`,
    `Volume is ${ratio.toFixed(2)}× its average${ratio >= volT ? " — above the alert threshold" : ""}.`,
    kind ? `Detector flag: ${kind} anomaly.` : "No hard anomaly flag on the latest tick.",
    `Rule-based model reads ${dirWord} pressure with ${(confidence * 100).toFixed(0)}% confidence.`,
  ].join(" ");

  return {
    symbol: input.symbol,
    severity,
    title,
    explanation,
    signal,
    confidence,
    source: "rules",
  };
}
