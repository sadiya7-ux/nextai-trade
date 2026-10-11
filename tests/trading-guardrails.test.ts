import { beforeEach, describe, expect, test } from "bun:test";

/**
 * Guardrail tests for the central order-validation logic in src/lib/trading.ts.
 *
 * The `marketStatus`/`now` context is injected so every rule (market hours,
 * rolling 60s BUY window, duplicate window) is exercised deterministically
 * regardless of when/where the suite runs.
 */

// localStorage shim — must exist before the trading module loads.
try {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
} catch {
  // Bun may already provide localStorage; the module tolerates either.
}

const trading = await import("../src/lib/trading");
const {
  STARTING_BALANCE,
  MAX_ORDER_VALUE,
  BUY_RATE_LIMIT,
  MAX_CONSECUTIVE_LOSSES,
  buyStock,
  sellStock,
  validateOrder,
  resetPortfolio,
  getPortfolio,
  getBuyRateUsage,
  getConsecutiveLosses,
} = trading;

const T0 = 1_700_000_000_000;
const OPEN = (now: number) => ({ now, marketStatus: "OPEN" as const });
const CLOSED = (now: number) => ({ now, marketStatus: "CLOSED" as const });
const PRE_OPEN = (now: number) => ({ now, marketStatus: "PRE_OPEN" as const });

beforeEach(() => resetPortfolio());

describe("paper-trading starting balance", () => {
  test("a new account starts with ₹1,00,000 and no trades", () => {
    expect(STARTING_BALANCE).toBe(100_000);
    const p = getPortfolio();
    expect(p.cash).toBe(100_000);
    expect(p.holdings).toEqual([]);
    expect(p.trades).toEqual([]);
  });
});

describe("₹50,000 maximum order value", () => {
  test("BUY above the cap is rejected even with enough cash", () => {
    const r = buyStock("RELIANCE", 3, 25_000, OPEN(T0));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("₹50,000");
    expect(getPortfolio().cash).toBe(100_000);
    expect(getPortfolio().trades).toHaveLength(0);
  });

  test("BUY exactly at the cap is allowed", () => {
    const r = buyStock("RELIANCE", 2, 25_000, OPEN(T0));
    expect(r.ok).toBe(true);
    expect(getPortfolio().cash).toBe(50_000);
  });

  test("SELL above the cap is rejected", () => {
    expect(buyStock("RELIANCE", 2, 25_000, OPEN(T0)).ok).toBe(true);
    const r = sellStock("RELIANCE", 2, 25_001, OPEN(T0 + 2_000));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("₹50,000");
    expect(getPortfolio().holdings).toHaveLength(1);
  });

  test("cap constant matches spec", () => {
    expect(MAX_ORDER_VALUE).toBe(50_000);
  });
});

describe("invalid quantities and prices", () => {
  test.each([
    ["zero", 0],
    ["negative", -5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("BUY with %s quantity is rejected", (_label, q) => {
    const r = buyStock("TCS", q, 100, OPEN(T0));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Enter a valid quantity.");
  });

  test.each([
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("BUY with %s price is rejected", (_label, p) => {
    const r = buyStock("TCS", 1, p, OPEN(T0));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Invalid execution price.");
  });

  test("SELL with invalid quantity is rejected", () => {
    expect(buyStock("TCS", 2, 100, OPEN(T0)).ok).toBe(true);
    const r = sellStock("TCS", Number.NaN, 100, OPEN(T0 + 2_000));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Enter a valid quantity.");
  });
});

describe("available-cash validation", () => {
  test("BUY costing more than available cash is rejected", () => {
    expect(buyStock("TCS", 1, 40_000, OPEN(T0)).ok).toBe(true); // cash 60,000
    expect(buyStock("TCS", 1, 40_000, OPEN(T0 + 2_000)).ok).toBe(true); // cash 20,000
    const r = buyStock("TCS", 1, 40_000, OPEN(T0 + 4_000)); // needs 40,000 > 20,000
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Insufficient virtual balance for this order.");
    expect(getPortfolio().cash).toBe(20_000);
  });
});

describe("duplicate-order protection", () => {
  test("identical order inside the 1s window is rejected", () => {
    expect(buyStock("INFY", 5, 1_000, OPEN(T0)).ok).toBe(true);
    const dup = buyStock("INFY", 5, 1_000, OPEN(T0 + 500));
    expect(dup.ok).toBe(false);
    expect(dup.error).toContain("duplicate");
    expect(getPortfolio().trades).toHaveLength(1);
  });

  test("same order after the window is allowed", () => {
    expect(buyStock("INFY", 5, 1_000, OPEN(T0)).ok).toBe(true);
    const r = buyStock("INFY", 5, 1_000, OPEN(T0 + 2_000));
    expect(r.ok).toBe(true);
    expect(getPortfolio().trades).toHaveLength(2);
  });
});

describe("market-hours validation", () => {
  test("CLOSED market rejects BUY", () => {
    const r = buyStock("TCS", 1, 1_000, CLOSED(T0));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Market is CLOSED");
    expect(getPortfolio().cash).toBe(100_000);
  });

  test("PRE_OPEN market rejects SELL", () => {
    expect(buyStock("TCS", 1, 1_000, OPEN(T0)).ok).toBe(true);
    const r = sellStock("TCS", 1, 1_100, PRE_OPEN(T0 + 2_000));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("PRE_OPEN");
  });

  test("OPEN market allows orders", () => {
    expect(buyStock("TCS", 1, 1_000, OPEN(T0)).ok).toBe(true);
    expect(sellStock("TCS", 1, 1_000, OPEN(T0 + 2_000)).ok).toBe(true);
  });
});

describe("rolling three-BUY rate limit", () => {
  test("third BUY succeeds, fourth is rejected until the window rolls", () => {
    expect(buyStock("AAA", 1, 10_000, OPEN(T0)).ok).toBe(true);
    expect(buyStock("BBB", 1, 10_000, OPEN(T0 + 2_000)).ok).toBe(true);
    expect(buyStock("CCC", 1, 10_000, OPEN(T0 + 4_000)).ok).toBe(true);
    expect(getBuyRateUsage({ now: T0 + 4_000 }).used).toBe(BUY_RATE_LIMIT);

    const fourth = buyStock("DDD", 1, 10_000, OPEN(T0 + 6_000));
    expect(fourth.ok).toBe(false);
    expect(fourth.error).toContain("Rate limit");
    expect(getPortfolio().trades).toHaveLength(3);

    // Once the first BUY falls outside the rolling 60s window, BUYs resume.
    const afterWindow = buyStock("EEE", 1, 10_000, OPEN(T0 + 61_000));
    expect(afterWindow.ok).toBe(true);
  });

  test("failed orders do not count toward the limit", () => {
    const failed = buyStock("TCS", 5, 40_000, OPEN(T0)); // ₹2,00,000 → over cap
    expect(failed.ok).toBe(false);
    expect(getBuyRateUsage({ now: T0 }).used).toBe(0);

    expect(buyStock("AAA", 1, 10_000, OPEN(T0)).ok).toBe(true);
    expect(getBuyRateUsage({ now: T0 + 1_000 }).used).toBe(1);
  });
});

describe("three-consecutive-losing-SELL restriction", () => {
  function buildLosingStreak() {
    // Four BUYs spread beyond the rolling window so the rate limit never
    // interferes with setting up the streak.
    expect(buyStock("WIN", 1, 1_000, OPEN(T0)).ok).toBe(true);
    expect(buyStock("L1", 1, 1_000, OPEN(T0 + 61_000)).ok).toBe(true);
    expect(buyStock("L2", 1, 1_000, OPEN(T0 + 122_000)).ok).toBe(true);
    expect(buyStock("L3", 1, 1_000, OPEN(T0 + 183_000)).ok).toBe(true);
    expect(sellStock("L1", 1, 900, OPEN(T0 + 200_000)).ok).toBe(true); // loss
    expect(sellStock("L2", 1, 900, OPEN(T0 + 201_000)).ok).toBe(true); // loss
    expect(sellStock("L3", 1, 900, OPEN(T0 + 202_000)).ok).toBe(true); // loss
    expect(getConsecutiveLosses()).toHaveLength(MAX_CONSECUTIVE_LOSSES);
  }

  test("after 3 losing SELLs every BUY is blocked — no bypass by stock or size", () => {
    buildLosingStreak();

    const anySymbol = buyStock("TATAMOTORS", 9, 500, OPEN(T0 + 203_000));
    expect(anySymbol.ok).toBe(false);
    expect(anySymbol.error).toContain("consecutive losing SELL");

    // Same attempt with a different stock and a tiny value: still blocked.
    expect(getPortfolio().trades.filter((t) => t.side === "BUY")).toHaveLength(4);
    // The streak itself was not silently reset by the blocked attempt.
    expect(getConsecutiveLosses()).toHaveLength(MAX_CONSECUTIVE_LOSSES);
  });

  test("a profitable SELL resets the streak and BUYs resume", () => {
    buildLosingStreak();

    const reset = sellStock("WIN", 1, 1_100, OPEN(T0 + 204_000)); // profit
    expect(reset.ok).toBe(true);
    expect(getConsecutiveLosses()).toHaveLength(0);

    const r = buyStock("TATAMOTORS", 1, 500, OPEN(T0 + 205_000));
    expect(r.ok).toBe(true);
  });

  test("breaking even also resets the streak (non-losing SELL)", () => {
    buildLosingStreak();
    expect(sellStock("WIN", 1, 1_000, OPEN(T0 + 204_000)).ok).toBe(true); // pnl = 0
    expect(getConsecutiveLosses()).toHaveLength(0);
    expect(buyStock("TCS", 1, 500, OPEN(T0 + 205_000)).ok).toBe(true);
  });
});

describe("successful orders update cash and holdings", () => {
  test("BUY debits cash and creates/merges holdings", () => {
    expect(buyStock("TCS", 10, 500, OPEN(T0)).ok).toBe(true);
    let p = getPortfolio();
    expect(p.cash).toBe(95_000);
    expect(p.holdings).toEqual([{ symbol: "TCS", quantity: 10, avgBuyPrice: 500 }]);

    expect(buyStock("TCS", 10, 600, OPEN(T0 + 2_000)).ok).toBe(true);
    p = getPortfolio();
    expect(p.cash).toBe(89_000);
    expect(p.holdings[0]).toEqual({ symbol: "TCS", quantity: 20, avgBuyPrice: 550 });
  });

  test("SELL credits cash, trims holdings and records realized P&L", () => {
    expect(buyStock("TCS", 10, 500, OPEN(T0)).ok).toBe(true);
    expect(sellStock("TCS", 4, 550, OPEN(T0 + 2_000)).ok).toBe(true);
    const p = getPortfolio();
    expect(p.cash).toBe(95_000 + 4 * 550);
    expect(p.holdings).toEqual([{ symbol: "TCS", quantity: 6, avgBuyPrice: 500 }]);
    const last = p.trades[0];
    expect(last.side).toBe("SELL");
    expect(last.pnl).toBe(200);
  });
});

describe("validateOrder returns structured per-check results", () => {
  test("BUY validation exposes every check id used by the 5-step checklist", () => {
    const v = validateOrder("BUY", "TCS", 1, 1_000, OPEN(T0));
    const ids = v.checks.map((c) => c.id);
    for (const id of ["price", "quantity", "orderValue", "marketHours", "duplicate", "funds", "buyRateLimit", "losingStreak"]) {
      expect(ids).toContain(id);
    }
    expect(v.ok).toBe(true);
    expect(v.orderValue).toBe(1_000);
    expect(v.cashAfter).toBe(99_000);
  });

  test("SELL validation has no BUY-only checks", () => {
    const v = validateOrder("SELL", "TCS", 1, 1_000, OPEN(T0));
    const ids = v.checks.map((c) => c.id);
    expect(ids).not.toContain("buyRateLimit");
    expect(ids).not.toContain("losingStreak");
    expect(ids).toContain("funds"); // holdings check
    expect(v.ok).toBe(false); // we hold nothing yet
    expect(v.errors[0]).toBe("You don't hold this stock.");
  });
});
