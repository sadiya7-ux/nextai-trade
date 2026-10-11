import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Runtime tests for the recorded portfolio-value history in src/lib/trading.ts.
 *
 * Each case loads the trading store in a fresh `bun` child process with a
 * localStorage shim, proving that:
 *  - legacy payloads (no `history` field) keep their cash/holdings/trades and
 *    simply gain an empty history — nothing is ever reset or backfilled,
 *  - malformed history entries are dropped without touching the account,
 *  - snapshots record genuine computed values at the exact times requested,
 *    appending a truthful (possibly flat) point per recording and reflecting
 *    real value changes after a trade,
 *  - no timer is started outside the browser (the child exits cleanly).
 */

const tradingModuleUrl = pathToFileURL(
  join(import.meta.dir, "..", "src", "lib", "trading.ts"),
).href;

interface Snapshot {
  at: number;
  value: number;
}

interface TradingState {
  cash: number;
  holdings: unknown[];
  trades: unknown[];
  history: Snapshot[];
}

interface ChildResult {
  portfolio: TradingState;
  recording: {
    h1: Snapshot[];
    h2: Snapshot[];
    h3: Snapshot[];
    buyOk: boolean;
  } | null;
}

function loadTrading(env: Record<string, string> = {}) {
  const script = `
    const store = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, String(v)),
        removeItem: (k) => void store.delete(k),
        clear: () => store.clear(),
        key: (i) => [...store.keys()][i] ?? null,
        get length() { return store.size; },
      },
    });
    if (process.env.SEED_LEGACY) store.set("nexttrade.portfolio", process.env.SEED_LEGACY);
    const m = await import(${JSON.stringify(tradingModuleUrl)});
    let recording = null;
    if (process.env.MODE === "record") {
      m.recordPortfolioSnapshot(1000);
      const h1 = m.getPortfolio().history;
      m.recordPortfolioSnapshot(2000); // unchanged value → truthful flat point
      const h2 = m.getPortfolio().history;
      const r = m.buyStock("RELIANCE", 1, 1, { now: 3000, marketStatus: "OPEN" });
      m.recordPortfolioSnapshot(4000); // real value change → must append
      const h3 = m.getPortfolio().history;
      recording = { h1, h2, h3, buyOk: r.ok };
    }
    console.log(JSON.stringify({ portfolio: m.getPortfolio(), recording }));
  `;

  const proc = Bun.spawnSync({
    cmd: ["bun", "-e", script],
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = proc.stdout.toString().trim();
  const stderr = proc.stderr.toString();
  const result = JSON.parse(stdout) as ChildResult;
  return { exitCode: proc.exitCode, result, stderr };
}

const LEGACY_ACCOUNT = JSON.stringify({
  cash: 42_000,
  holdings: [{ symbol: "TCS", quantity: 5, avgBuyPrice: 500 }],
  trades: [
    { id: "t_1", symbol: "TCS", side: "BUY", quantity: 5, price: 500, total: 2500, at: 1_690_000_000_000 },
  ],
});

describe("portfolio history compatibility", () => {
  test("legacy payload without a history field is preserved and gains an empty history", () => {
    const { exitCode, result, stderr } = loadTrading({ SEED_LEGACY: LEGACY_ACCOUNT });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(result.portfolio.cash).toBe(42_000);
    expect(result.portfolio.holdings).toEqual([{ symbol: "TCS", quantity: 5, avgBuyPrice: 500 }]);
    expect(result.portfolio.trades).toHaveLength(1);
    expect(result.portfolio.history).toEqual([]);
  });

  test("malformed history entries are dropped without resetting the account", () => {
    const seeded = JSON.parse(LEGACY_ACCOUNT) as Record<string, unknown>;
    seeded.history = [null, 42, { at: "not-a-number", value: 1 }, { at: 5, value: 100 }];
    const { exitCode, result } = loadTrading({ SEED_LEGACY: JSON.stringify(seeded) });
    expect(exitCode).toBe(0);
    expect(result.portfolio.cash).toBe(42_000);
    expect(result.portfolio.trades).toHaveLength(1);
    expect(result.portfolio.history).toEqual([{ at: 5, value: 100 }]);
  });
});

describe("portfolio snapshot recording", () => {
  test("records genuine values: baseline, flat cadence when unchanged, change after a trade", () => {
    const { exitCode, result, stderr } = loadTrading({ MODE: "record" });
    expect(stderr).toBe("");
    expect(exitCode).toBe(0); // also proves no non-browser timer keeps the process alive

    const recording = result.recording;
    expect(recording).not.toBeNull();
    if (!recording) return;

    // First recording: real baseline value of a fresh account.
    expect(recording.h1).toEqual([{ at: 1000, value: 100_000 }]);

    // Unchanged value later → a truthful flat point with its real timestamp
    // (never a synthesized one), so an idle portfolio still builds history.
    expect(recording.h2).toEqual([
      { at: 1000, value: 100_000 },
      { at: 2000, value: 100_000 },
    ]);

    // A trade at ₹1 when RELIANCE quotes ~₹1,428 genuinely changes the
    // mark-to-market value → the next recording appends the changed value.
    expect(recording.buyOk).toBe(true);
    expect(recording.h3).toHaveLength(3);
    expect(recording.h3[0]).toEqual({ at: 1000, value: 100_000 });
    expect(recording.h3[1]).toEqual({ at: 2000, value: 100_000 });
    expect(recording.h3[2].at).toBe(4000);
    expect(Number.isFinite(recording.h3[2].value)).toBe(true);
    expect(recording.h3[2].value).not.toBe(100_000);
    expect(result.portfolio.cash).toBe(99_999);
  });
});
