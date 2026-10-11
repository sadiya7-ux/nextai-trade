import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Runtime tests for src/supabaseClient.ts configuration handling.
 *
 * Each case loads the module in a fresh `bun` child process with a controlled
 * environment, proving that:
 *  - missing/invalid configuration never throws (exit code 0, no crash),
 *  - the exported error names the exact environment variables, and
 *  - valid configuration produces a real Supabase client.
 */

const clientModuleUrl = pathToFileURL(
  join(import.meta.dir, "..", "src", "supabaseClient.ts"),
).href;

function loadClient(env: Record<string, string | undefined>) {
  // Clean slate: strip any VITE_SUPABASE_* inherited from the workspace so the
  // test is deterministic even after the user configures real credentials.
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith("VITE_SUPABASE_")) {
      childEnv[key] = value;
    }
  }
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) childEnv[key] = value;
  }

  const script =
    `const m = await import(${JSON.stringify(clientModuleUrl)});` +
    `console.log(JSON.stringify({` +
    ` configured: m.supabase !== null,` +
    ` error: m.supabaseConfigError,` +
    ` clientType: m.supabase ? m.supabase.constructor.name : null,` +
    `}));`;

  const proc = Bun.spawnSync({
    cmd: ["bun", "-e", script],
    env: childEnv,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = proc.stdout.toString().trim();
  const stderr = proc.stderr.toString();
  const result = JSON.parse(stdout) as {
    configured: boolean;
    error: string | null;
    clientType: string | null;
  };
  return { exitCode: proc.exitCode, result, stderr };
}

describe("supabaseClient configuration handling", () => {
  test("missing env vars: no crash, clear error naming VITE_SUPABASE_URL", () => {
    const { exitCode, result, stderr } = loadClient({
      VITE_SUPABASE_URL: undefined,
      VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
    expect(exitCode).toBe(0); // module loads without an uncaught exception
    expect(result.configured).toBe(false);
    expect(result.error).toContain("VITE_SUPABASE_URL");
    expect(stderr).toContain("Supabase is not configured");
    expect(stderr).toContain("Keys / API keys");
  });

  test("URL without key: no crash, error names VITE_SUPABASE_PUBLISHABLE_KEY", () => {
    const { exitCode, result } = loadClient({
      VITE_SUPABASE_URL: "https://example-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
    });
    expect(exitCode).toBe(0);
    expect(result.configured).toBe(false);
    expect(result.error).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
  });

  test("invalid URL: no crash, clear validation error", () => {
    const { exitCode, result } = loadClient({
      VITE_SUPABASE_URL: "not-a-url",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-key",
    });
    expect(exitCode).toBe(0);
    expect(result.configured).toBe(false);
    expect(result.error).toContain("not a valid");
  });

  test("valid configuration: client is created and error is null", () => {
    const { exitCode, result } = loadClient({
      VITE_SUPABASE_URL: "https://example-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    });
    expect(exitCode).toBe(0);
    expect(result.configured).toBe(true);
    expect(result.error).toBeNull();
    expect(result.clientType).toBe("SupabaseClient");
  });
});
