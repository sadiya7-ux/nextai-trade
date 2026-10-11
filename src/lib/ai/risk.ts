import { MOVE_THRESHOLDS, VOLUME_RATIO_THRESHOLDS } from "../market/agent";
import type { Severity, Stock } from "../market/types";
import { analyzeStock } from "./index";
import { evaluateRules } from "./rule-engine";
import type { AiAnalysisInput, AiAnalysisResult } from "./types";

/**
 * Buy-side risk assessment built on the AI service layer.
 *
 * Wraps `analyzeStock` (remote-first, rule-based fallback — see index.ts) and
 * adds what the trading UI needs: the list of factors that triggered the
 * warning and a risky/not-risky verdict for the confirmation flow.
 *
 * IMPORTANT: this is an *estimate based on available data* — never a
 * prediction or guarantee of future losses. All numbers come from the current
 * market data (or the mock engine until the real market API is connected).
 */

export interface BuyRiskAssessment {
  symbol: string;
  riskLevel: Severity;
  title: string;
  explanation: string;
  /** Factors that triggered the warning (what pushed severity up). */
  factors: string[];
  /** 0–1, capped by the engine — rules never claim > 85%. */
  confidence: number;
  source: AiAnalysisResult["source"];
  /** Medium or high severity ⇒ risky BUY ⇒ two-step confirmation required. */
  isRisky: boolean;
}

/** Medium/high severity requires the risky-BUY confirmation flow. */
export function isRiskySeverity(severity: Severity): boolean {
  return severity !== "low";
}

/** Build the AI input from a live stock + its recent intraday series. */
export function buildRiskInput(stock: Stock, recentHistory: number[]): AiAnalysisInput {
  const changePercent =
    stock.previousClose > 0 ? ((stock.price - stock.previousClose) / stock.previousClose) * 100 : 0;
  const ratio = stock.avgVolume > 0 ? stock.volume / stock.avgVolume : 1;
  const moveT = MOVE_THRESHOLDS.medium;
  const volT = VOLUME_RATIO_THRESHOLDS.medium;

  let unusualMovement: AiAnalysisInput["unusualMovement"];
  if (ratio >= volT) {
    unusualMovement = {
      detected: true,
      kind: "volume",
      magnitude: ratio,
      direction: "up",
      note: `Volume running at ${ratio.toFixed(2)}× its average.`,
    };
  } else if (Math.abs(changePercent) >= moveT) {
    unusualMovement = {
      detected: true,
      kind: "movement",
      magnitude: Math.abs(changePercent),
      direction: changePercent > 0 ? "up" : "down",
      note: `${Math.abs(changePercent).toFixed(2)}% move versus previous close.`,
    };
  }

  return {
    symbol: stock.symbol,
    currentPrice: stock.price,
    changePercent,
    volume: stock.volume,
    averageVolume: stock.avgVolume,
    recentHistory,
    unusualMovement,
  };
}

/** The factors that pushed the assessment above baseline (or a clear all-ok). */
export function riskFactors(input: AiAnalysisInput): string[] {
  const factors: string[] = [];
  const moveT = MOVE_THRESHOLDS.medium;
  const volT = VOLUME_RATIO_THRESHOLDS.medium;

  const pct = Number.isFinite(input.changePercent) ? input.changePercent : 0;
  const ratio = input.averageVolume > 0 ? input.volume / input.averageVolume : 1;

  if (Math.abs(pct) >= moveT) {
    factors.push(`Price move: ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% vs previous close (alert threshold ±${moveT}%).`);
  }
  if (ratio >= volT) {
    factors.push(`Volume spike: ${ratio.toFixed(2)}× average volume (alert threshold ${volT}×).`);
  }
  if (input.unusualMovement?.detected) {
    const u = input.unusualMovement;
    factors.push(`Unusual ${u.kind} flagged by the agent: ${u.note ?? `${u.magnitude.toFixed(2)} magnitude`}.`);
  }
  if (input.recentHistory.length >= 5) {
    const window = input.recentHistory.slice(-30);
    const hi = Math.max(...window);
    const lo = Math.min(...window);
    const swing = lo > 0 ? ((hi - lo) / lo) * 100 : 0;
    if (swing >= 1.5) {
      factors.push(`Recent price history swung ${swing.toFixed(2)}% across the last ${window.length} ticks.`);
    }
  }
  if (factors.length === 0) {
    factors.push("No alert-threshold factors triggered — price, volume and momentum are within normal ranges.");
  }
  return factors;
}

function toAssessment(input: AiAnalysisInput, analysis: AiAnalysisResult): BuyRiskAssessment {
  return {
    symbol: analysis.symbol,
    riskLevel: analysis.severity,
    title: analysis.title,
    explanation: analysis.explanation,
    factors: riskFactors(input),
    confidence: analysis.confidence,
    source: analysis.source,
    isRisky: isRiskySeverity(analysis.severity),
  };
}

/** Synchronous assessment via the local rule engine (always available). */
export function assessRiskSync(input: AiAnalysisInput): BuyRiskAssessment {
  return toAssessment(input, evaluateRules(input));
}

/**
 * Remote-first assessment (`analyzeStock`): uses the organizer's AI API when
 * configured, otherwise — or on any failure — the local rule-based engine.
 * Never throws.
 */
export async function assessRisk(input: AiAnalysisInput): Promise<BuyRiskAssessment> {
  try {
    return toAssessment(input, await analyzeStock(input));
  } catch {
    return assessRiskSync(input);
  }
}
