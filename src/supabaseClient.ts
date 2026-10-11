import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client — configured exclusively through Vite environment variables:
 *
 *   VITE_SUPABASE_URL              — Supabase project URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY  — Supabase publishable (anon) key
 *
 * Configure them in this Freebuff workspace's "Keys / API keys" tab (or a
 * local .env you manage yourself). Never hardcode them in source and never
 * commit them.
 *
 * When the variables are missing or invalid the app must NOT crash with an
 * unhandled `supabaseUrl is required` exception: instead we export a `null`
 * client plus a clear `supabaseConfigError`, and the UI shows a configuration
 * notice while the rest of the app keeps working. When configuration is
 * valid, `supabase` is a normal SupabaseClient and auth behaves as before.
 */

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function initSupabase(): { client: SupabaseClient | null; error: string | null } {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url) {
    return {
      client: null,
      error:
        "Missing environment variable VITE_SUPABASE_URL (your Supabase project URL).",
    };
  }
  if (!isValidHttpUrl(url)) {
    return {
      client: null,
      error: "VITE_SUPABASE_URL is not a valid http(s) URL.",
    };
  }
  if (!key) {
    return {
      client: null,
      error:
        "Missing environment variable VITE_SUPABASE_PUBLISHABLE_KEY (your Supabase publishable/anon key).",
    };
  }

  // Both values present and well-formed: normal client, auth fully functional.
  return { client: createClient(url, key), error: null };
}

const initialized = initSupabase();

/** The Supabase client, or `null` when configuration is missing/invalid. */
export const supabase: SupabaseClient | null = initialized.client;

/** Human-readable configuration error, or `null` when Supabase is configured. */
export const supabaseConfigError: string | null = initialized.error;

if (initialized.error) {
  console.error(
    `[NextTrade] Supabase is not configured — ${initialized.error} ` +
      `Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the ` +
      `Freebuff workspace "Keys / API keys" tab, then reload the preview. ` +
      `Authentication and watchlist sync stay disabled until then.`,
  );
}
