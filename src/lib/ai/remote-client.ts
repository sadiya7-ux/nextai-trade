import { AI_API_CONFIG } from "./config";
import type { AiAnalysisInput, AiAnalysisOptions, AiAnalysisResult } from "./types";

/**
 * Remote AI API client.
 *
 * IMPORTANT: no endpoint, key, or request/response schema is invented here.
 * Everything below is a safe no-op scaffold until the organizer shares the
 * real API documentation. Any failure (missing config, network, timeout,
 * unexpected payload) resolves to `null` so the rule engine takes over
 * silently — the app never breaks because the API is down.
 */

/** Timeout wrapper so a hanging endpoint cannot freeze the agent bridge. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`AI API timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Ask the organizer's AI API to analyze one stock.
 *
 * Returns `null` whenever the API is unavailable or answers unexpectedly —
 * callers must treat `null` as "fall back to the rule engine".
 */
export async function fetchRemoteAnalysis(
  input: AiAnalysisInput,
  options: AiAnalysisOptions = {},
): Promise<AiAnalysisResult | null> {
  // Nothing configured ⇒ remote layer is simply off.
  if (!AI_API_CONFIG.baseUrl) return null;

  try {
    // ------------------------------------------------------------------
    // TODO(organizer-endpoint): replace this placeholder path with the real
    // organizer API endpoint, e.g. `${AI_API_CONFIG.baseUrl}/v1/analyze`.
    // The URL below intentionally does NOT resolve to anything real.
    // ------------------------------------------------------------------
    const endpoint = `${AI_API_CONFIG.baseUrl}/__organizer_ai_endpoint_pending__`;

    // ------------------------------------------------------------------
    // TODO(organizer-auth): wire the real authentication method here once
    // documented (static bearer key, custom header, HMAC signature...).
    // The placeholder below sends no credential unless an API key exists.
    // ------------------------------------------------------------------
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (AI_API_CONFIG.apiKey) {
      headers.Authorization = `Bearer ${AI_API_CONFIG.apiKey}`;
    }

    // ------------------------------------------------------------------
    // TODO(organizer-request-mapping): map AiAnalysisInput to the organizer's
    // exact request schema (field names, casing, units). Current payload is a
    // best-guess placeholder and MUST be replaced with the documented shape.
    // ------------------------------------------------------------------
    const body = JSON.stringify({
      symbol: input.symbol,
      currentPrice: input.currentPrice,
      changePercent: input.changePercent,
      volume: input.volume,
      averageVolume: input.averageVolume,
      recentHistory: input.recentHistory,
      unusualMovement: input.unusualMovement ?? null,
      sensitivity: options.sensitivity ?? "medium",
    });

    const response = await withTimeout(
      fetch(endpoint, { method: "POST", headers, body }),
      AI_API_CONFIG.timeoutMs,
    );

    if (!response.ok) return null; // silent: rule engine handles it

    const raw: unknown = await response.json();

    // ------------------------------------------------------------------
    // TODO(organizer-response-mapping): map the documented response schema to
    // AiAnalysisResult (symbol, severity low|medium|high, title, explanation,
    // signal, confidence). The mapping below assumes the organizer's payload
    // already matches our contract exactly — replace with real field mapping
    // + validation when the docs arrive.
    // ------------------------------------------------------------------
    const result = raw as Partial<AiAnalysisResult> | null;
    if (
      !result ||
      typeof result.symbol !== "string" ||
      (result.severity !== "low" && result.severity !== "medium" && result.severity !== "high") ||
      typeof result.title !== "string" ||
      typeof result.explanation !== "string" ||
      (result.signal !== "bullish" && result.signal !== "bearish" && result.signal !== "neutral") ||
      typeof result.confidence !== "number"
    ) {
      return null; // payload not conforming to contract ⇒ fallback
    }

    return {
      symbol: result.symbol,
      severity: result.severity,
      title: result.title,
      explanation: result.explanation,
      signal: result.signal,
      confidence: Math.min(1, Math.max(0, result.confidence)),
      source: "remote",
    };
  } catch {
    // Silent by design: network errors, CORS, timeouts, bad JSON.
    return null;
  }
}
