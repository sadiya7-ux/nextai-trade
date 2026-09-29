export function aiExplain(rule: string): string {
  switch (rule) {
    case "TOO_BIG":
      return "This order is far larger than your usual trades. Large single orders can cause outsized losses, so it was blocked for your safety.";
    case "NO_CASH":
      return "Your balance cannot cover this order. Reduce the quantity to stay within your funds.";
    case "DUPLICATE":
      return "You placed this exact order seconds ago — usually a double-click mistake, so it was stopped.";
    case "CLOSING":
      return "New buys near market close often end in panic selling. Place this order tomorrow morning instead.";
    case "ANGER":
      return "You've lost 3 trades in a row and this order is bigger than usual — a pattern called tilt. A short break protects your remaining capital.";
    default:
      return "";
  }
}