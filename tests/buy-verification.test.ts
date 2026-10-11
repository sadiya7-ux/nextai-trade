import { describe, expect, test } from "bun:test";
import {
  buyVerificationReducer,
  canExecuteBuy,
  initialBuyVerification,
  type BuyVerificationState,
} from "../src/lib/buy-verification";
import type { BuyRiskAssessment } from "../src/lib/ai/risk";
import type { OrderValidation } from "../src/lib/trading";

/**
 * Flow tests for the five-step BUY verification state machine: both
 * confirmations, cancellation after either confirmation, and the rule that a
 * failing hard validation always wins even after confirming twice.
 */

const risky: BuyRiskAssessment = {
  symbol: "RELIANCE",
  riskLevel: "high",
  title: "High-severity move",
  explanation: "Sharp move on elevated volume.",
  factors: ["Price move: +2.10%"],
  confidence: 0.8,
  source: "rules",
  isRisky: true,
};

const lowRisk: BuyRiskAssessment = {
  symbol: "RELIANCE",
  riskLevel: "low",
  title: "Steady tape",
  explanation: "Nothing unusual detected.",
  factors: ["No alert-threshold factors triggered"],
  confidence: 0.5,
  source: "rules",
  isRisky: false,
};

const passValidation = { ok: true } as OrderValidation;
const blockedValidation = { ok: false, errors: ["Market is CLOSED"] } as OrderValidation;

function start(attemptId = "a1"): BuyVerificationState {
  return buyVerificationReducer(initialBuyVerification, { type: "START", attemptId });
}

function startWithAssessment(a: BuyRiskAssessment, attemptId = "a1"): BuyVerificationState {
  let s = start(attemptId);
  s = buyVerificationReducer(s, { type: "ASSESS", attemptId, assessment: a });
  return s;
}

describe("confirmation ordering", () => {
  test("cannot confirm before the assessment arrives", () => {
    const s = start();
    const after = buyVerificationReducer(s, { type: "ACKNOWLEDGE" });
    expect(after.acknowledged).toBe(false);
    const confirmed = buyVerificationReducer(after, { type: "CONFIRM" });
    expect(confirmed.confirmed).toBe(false);
    expect(canExecuteBuy(confirmed, passValidation)).toBe(false);
  });

  test("stale assessment (wrong attempt id) is ignored", () => {
    const s = start("a1");
    const after = buyVerificationReducer(s, { type: "ASSESS", attemptId: "other", assessment: risky });
    expect(after.assessment).toBeNull();
    expect(canExecuteBuy(after, passValidation)).toBe(false);
  });

  test("second confirmation is rejected until the first is given", () => {
    const s = startWithAssessment(risky);
    const confirmedFirst = buyVerificationReducer(s, { type: "CONFIRM" });
    expect(confirmedFirst.confirmed).toBe(false);
    expect(canExecuteBuy(confirmedFirst, passValidation)).toBe(false);
  });

  test("risky BUY needs 'I understand the risks' then 'Confirm risky BUY'", () => {
    let s = startWithAssessment(risky);
    s = buyVerificationReducer(s, { type: "ACKNOWLEDGE" });
    expect(s.acknowledged).toBe(true);
    expect(canExecuteBuy(s, passValidation)).toBe(false); // second confirm still missing
    s = buyVerificationReducer(s, { type: "CONFIRM" });
    expect(s.confirmed).toBe(true);
    expect(canExecuteBuy(s, passValidation)).toBe(true);
  });

  test("low-risk BUY still requires the explicit risk acknowledgment", () => {
    let s = startWithAssessment(lowRisk);
    const noAck = buyVerificationReducer(s, { type: "CONFIRM" });
    expect(noAck.confirmed).toBe(false);
    s = buyVerificationReducer(noAck, { type: "ACKNOWLEDGE" });
    s = buyVerificationReducer(s, { type: "CONFIRM" });
    expect(canExecuteBuy(s, passValidation)).toBe(true);
  });
});

describe("hard rules always win", () => {
  test("a failing validation blocks execution even after both confirmations", () => {
    let s = startWithAssessment(risky);
    s = buyVerificationReducer(s, { type: "ACKNOWLEDGE" });
    s = buyVerificationReducer(s, { type: "CONFIRM" });
    expect(s.confirmed).toBe(true);
    expect(canExecuteBuy(s, blockedValidation)).toBe(false);
  });
});

describe("cancellation leaves the order unexecuted", () => {
  test("cancel after the first confirmation", () => {
    let s = startWithAssessment(risky);
    s = buyVerificationReducer(s, { type: "ACKNOWLEDGE" });
    s = buyVerificationReducer(s, { type: "CANCEL" });
    expect(s.cancelled).toBe(true);
    expect(s.confirmed).toBe(false);
    expect(canExecuteBuy(s, passValidation)).toBe(false);
  });

  test("cancel after both confirmations", () => {
    let s = startWithAssessment(risky);
    s = buyVerificationReducer(s, { type: "ACKNOWLEDGE" });
    s = buyVerificationReducer(s, { type: "CONFIRM" });
    expect(canExecuteBuy(s, passValidation)).toBe(true);
    s = buyVerificationReducer(s, { type: "CANCEL" });
    expect(s.confirmed).toBe(false);
    expect(s.acknowledged).toBe(false);
    expect(canExecuteBuy(s, passValidation)).toBe(false);
  });

  test("no attempt ⇒ never executable", () => {
    expect(canExecuteBuy(initialBuyVerification, passValidation)).toBe(false);
  });

  test("RESET returns to the initial state for the next order", () => {
    let s = startWithAssessment(risky);
    s = buyVerificationReducer(s, { type: "ACKNOWLEDGE" });
    s = buyVerificationReducer(s, { type: "CONFIRM" });
    s = buyVerificationReducer(s, { type: "RESET" });
    expect(s).toEqual(initialBuyVerification);
  });
});
