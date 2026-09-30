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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
