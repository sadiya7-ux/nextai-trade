import type { BuyRiskAssessment } from "./ai/risk";
import type { OrderValidation } from "./trading";

/**
 * BUY verification flow state machine.
 *
 * The five-step checklist (stock → quantity → funds → trading rules → risk)
 * is enforced through this reducer so the confirmation semantics are pure and
 * testable without a DOM:
 *
 *  1. START          — user opens the verification panel for one attempt.
 *  2. ASSESS         — AI/rule-based risk assessment arrives for that attempt.
 *  3. ACKNOWLEDGE    — first explicit confirmation: "I understand the risks."
 *  4. CONFIRM        — second confirmation ("Confirm risky BUY" for risky
 *                      orders, "Confirm BUY" otherwise). Requires step 3.
 *  5. CANCEL         — dismisses the attempt; the order is never executed.
 *
 * Hard order validations live in `validateOrder` (src/lib/trading.ts) and
 * always win: `canExecuteBuy` requires `validation.ok`, and `buyStock`
 * re-runs every check again right before executing — so a blocked rule can
 * never be overridden by confirming twice.
 */

export interface BuyVerificationState {
  attemptId: string | null;
  /** AI risk assessment for the current attempt (null while loading). */
  assessment: BuyRiskAssessment | null;
  /** First confirmation: "I understand the risks." */
  acknowledged: boolean;
  /** Second confirmation: "Confirm (risky) BUY." */
  confirmed: boolean;
  cancelled: boolean;
}

export const initialBuyVerification: BuyVerificationState = {
  attemptId: null,
  assessment: null,
  acknowledged: false,
  confirmed: false,
  cancelled: false,
};

export type BuyVerificationAction =
  | { type: "START"; attemptId: string }
  | { type: "ASSESS"; attemptId: string; assessment: BuyRiskAssessment }
  | { type: "ACKNOWLEDGE" }
  | { type: "CONFIRM" }
  | { type: "CANCEL" }
  | { type: "RESET" };

export function buyVerificationReducer(
  state: BuyVerificationState,
  action: BuyVerificationAction,
): BuyVerificationState {
  switch (action.type) {
    case "START":
      return {
        attemptId: action.attemptId,
        assessment: null,
        acknowledged: false,
        confirmed: false,
        cancelled: false,
      };
    case "ASSESS":
      // Ignore stale results (attempt already replaced or dismissed).
      if (state.attemptId !== action.attemptId || state.cancelled) return state;
      return { ...state, assessment: action.assessment };
    case "ACKNOWLEDGE":
      if (!state.attemptId || state.cancelled || !state.assessment) return state;
      return { ...state, acknowledged: true };
    case "CONFIRM":
      if (!state.attemptId || state.cancelled || !state.assessment) return state;
      // Risk assessment must be reviewed (acknowledged) before any confirm.
      if (!state.acknowledged) return state;
      return { ...state, confirmed: true };
    case "CANCEL":
      if (!state.attemptId) return state;
      // Cancelling after any confirmation leaves the order unexecuted.
      return { ...state, cancelled: true, acknowledged: false, confirmed: false };
    case "RESET":
      return initialBuyVerification;
  }
}

/**
 * The single execution gate for a BUY. A state that was cancelled — even
 * after both confirmations — can never execute, and a failing hard
 * validation always wins regardless of confirmations.
 */
export function canExecuteBuy(state: BuyVerificationState, validation: OrderValidation): boolean {
  return Boolean(
    state.attemptId &&
      !state.cancelled &&
      state.assessment &&
      state.acknowledged &&
      state.confirmed &&
      validation.ok,
  );
}
