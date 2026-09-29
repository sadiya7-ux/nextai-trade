// src/lib/guard.ts — THE GUARD 🛡️
// Every BUY/SELL must pass checkOrder() before executing.
// Math decides. No AI here — AI explains later.

export type GuardVerdict = {
  allowed: boolean;
  rule: string;
  message: string;
};

const ORDER_LIMIT = 50000; // ₹ max per order

// Guard remembers its last approved order (for duplicate check)
let lastApproved: { symbol: string; side: string; time: number } = {
  symbol: "",
  side: "",
  time: 0,
};

export function checkOrder(input: {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  cash: number;
}): GuardVerdict {
  const value = input.quantity * input.price;
  const now = Date.now();

  // Rule 1 — order too big
  if (value > ORDER_LIMIT) {
    return {
      allowed: false,
      rule: "TOO_BIG",
      message: `Order too big: ₹${value.toLocaleString("en-IN")} exceeds your ₹50,000 per-order limit.`,
    };
  }

  // Rule 2 — not enough cash (buys only)
  if (input.side === "BUY" && value > input.cash) {
    return {
      allowed: false,
      rule: "NO_CASH",
      message: `Not enough cash: you have ₹${input.cash.toLocaleString("en-IN")}, this order needs ₹${value.toLocaleString("en-IN")}.`,
    };
  }

  // Rule 3 — duplicate within 60 seconds
  if (
    lastApproved.symbol === input.symbol &&
    lastApproved.side === input.side &&
    now - lastApproved.time < 60000
  ) {
    return {
      allowed: false,
      rule: "DUPLICATE",
      message: "You placed this same order less than a minute ago — possible double-click.",
    };
  }

  // Rule 4 — no new buys after 3:10 PM (market closes 3:20)
  const t = new Date();
  const minutes = t.getHours() * 60 + t.getMinutes();
  if (input.side === "BUY" && minutes >= 15 * 60 + 10) {
    return {
      allowed: false,
      rule: "CLOSING",
      message: "Market closes at 3:20 PM — no new buys after 3:10 PM.",
    };
  }

  // All clear — remember this order, then allow
  lastApproved = { symbol: input.symbol, side: input.side, time: now };
  return { allowed: true, rule: "", message: "" };
}