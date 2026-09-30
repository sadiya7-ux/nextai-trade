/**
 * AI API configuration — read from Vite env vars, never hardcoded.
 *
 * With nothing configured the app runs 100% on the local rule-based engine.
 *
 * TODO(organizer-api): when the organizer shares the real API details, set
 *   VITE_AI_API_URL  → base URL of their endpoint
 *   VITE_AI_API_KEY  → credential, via the platform Keys/API-keys tab (never
 *                      committed to git).
 * TODO(organizer-auth): if the API uses something other than a static key
 *   (OAuth, signed requests...), replace `apiKey` handling in remote-client.ts.
 */

const env = import.meta.env;

export interface AiApiConfig {
  /** Base URL of the organizer AI API. `undefined` ⇒ remote calls disabled. */
  baseUrl: string | undefined;
  /** Credential for the API. `undefined` ⇒ no auth header is sent. */
  apiKey: string | undefined;
  /** Hard cap per remote call; on timeout the rule engine answers instead. */
  timeoutMs: number;
}

export const AI_API_CONFIG: AiApiConfig = {
  baseUrl: env.VITE_AI_API_URL?.trim() || undefined,
  apiKey: env.VITE_AI_API_KEY?.trim() || undefined,
  timeoutMs: 8_000,
};

/** True only when a real endpoint has been provided via env. */
export function isAiApiConfigured(): boolean {
  return Boolean(AI_API_CONFIG.baseUrl);
}
