/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Organizer AI API base URL (optional). When unset, the app runs entirely
   * on the local rule-based engine. Provided via env config, never committed.
   */
  readonly VITE_AI_API_URL?: string;
  /**
   * Organizer AI API credential (optional). Provide through the platform's
   * Keys/API-keys UI — never hardcode or commit secrets to source control.
   */
  readonly VITE_AI_API_KEY?: string;
  /**
   * Supabase project URL. Set it in the Freebuff workspace Keys/API keys tab;
   * when missing the app shows a configuration notice instead of crashing.
   */
  readonly VITE_SUPABASE_URL?: string;
  /**
   * Supabase publishable (anon) key. Set it in the Freebuff workspace
   * Keys/API keys tab — never hardcode or commit it.
   */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
