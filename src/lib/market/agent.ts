import { AI_MONITORED } from "./seed";
import { getChangePercent, getMarketStatus } from "./engine";
import type { Severity, Stock, StockAlert } from "./types";

/**
 * Mock AI agent.
 *
 * Watches the monitored symbols each market tick and emits alerts when simple
 * mock conditions fire (fast % move in a short window, volume ratio above
 * normal, directional momentum). Designed to be swapped for a real agent later:
 * `evaluateTick(stocks, previous)` is the only seam.
 */

const COOLDOWN_MS = 45_000; // per symbol+kind
const MAX_ALERTS = 60;
const MAX_FEED = 40;

export interface AgentConfig {
  enabled: boolean;
  sensitivity: "low" | "medium" | "high";
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = { enabled: true, sensitivity: "medium" };

/** % move thresholds per sensitivity. */
const MOVE_THRESHOLDS: Record<AgentConfig["sensitivity"], number> = {
  low: 1.2,
  medium: 0.8,
  high: 0.45,
};

const VOLUME_RATIO_THRESHOLDS: Record<AgentConfig["sensitivity"], number> = {
  low: 1.45,
  medium: 1.25,
  high: 1.1,
};

export interface AgentEvaluation {
  alerts: StockAlert[];
}

interface AgentMemory {
  lastPrice: Record<string, number>;
  priceWindow: Record<string, number[]>; // recent prices for short-window moves
  lastAlertAt: Record<string, number>;
  lastVolatilityAlertAt: number;
}

let memory: AgentMemory = { lastPrice: {}, priceWindow: {}, lastAlertAt: {}, lastVolatilityAlertAt: 0 };

export function resetAgentMemory() {
  memory = { lastPrice: {}, priceWindow: {}, lastAlertAt: {}, lastVolatilityAlertAt: 0 };
}

let alertSeq = 0;

function makeAlert(
  stock: Stock,
  kind: StockAlert["kind"],
  title: string,
  message: string,
  severity: Severity,
  now: number,
): StockAlert {
  alertSeq += 1;
  return {
    id: `alert_${now}_${alertSeq}`,
    symbol: stock.symbol,
    title,
    message,
    severity,
    createdAt: now,
    kind,
    read: false,
  };
}

function severityFor(magnitude: number, thresholds: number[]): Severity {
  if (magnitude >= thresholds[2]) return "high";
  if (magnitude >= thresholds[1]) return "medium";
  return "low";
}

/** One evaluation pass over the current market snapshot. Returns new alerts. */
export function evaluateTick(
  stocks: Record<string, Stock>,
  config: AgentConfig,
  now = Date.now(),
): AgentEvaluation {
  const alerts: StockAlert[] = [];
  if (!config.enabled) {
    memory.lastPrice = {};
    return { alerts };
  }
  const status = getMarketStatus(new Date(now));
  const moveT = MOVE_THRESHOLDS[config.sensitivity];
  const volT = VOLUME_RATIO_THRESHOLDS[config.sensitivity];

  for (const symbol of AI_MONITORED) {
    const stock = stocks[symbol];
    if (!stock) continue;

    const window = (memory.priceWindow[symbol] ?? []).slice(-15);
    const prev = memory.lastPrice[symbol];
    const nextWindow = prev !== undefined ? [...window, stock.price] : [stock.price];
    memory.lastPrice[symbol] = stock.price;
    memory.priceWindow[symbol] = nextWindow;

    // --- Fast price movement over the short window ---
    if (nextWindow.length >= 6) {
      const first = nextWindow[0];
      const movePct = Math.abs(((stock.price - first) / first) * 100);
      if (movePct >= moveT) {
        const key = `${symbol}:movement`;
        if (now - (memory.lastAlertAt[key] ?? 0) > COOLDOWN_MS) {
          memory.lastAlertAt[key] = now;
          const dir = stock.price >= first ? "moved" : "dropped";
          const severity = severityFor(movePct, [moveT, moveT * 1.8, moveT * 3]);
          alerts.push(
            makeAlert(
              stock,
              "movement",
              "Unusual price movement",
              `${stock.symbol} ${dir} ${movePct.toFixed(1)}% in 5 minutes. The AI agent flagged short-term volatility in ${stock.symbol}.`,
              severity,
              now,
            ),
          );
        }
      }
    }

    // --- Volume spike ---
    const ratio = stock.volume / stock.avgVolume;
    if (ratio >= volT) {
      const key = `${symbol}:volume`;
      if (now - (memory.lastAlertAt[key] ?? 0) > COOLDOWN_MS * 2) {
        memory.lastAlertAt[key] = now;
        const severity = severityFor(ratio, [volT, volT * 1.3, volT * 1.8]);
        alerts.push(
          makeAlert(
            stock,
            "volume",
            "Volume spike detected",
            `Unusual volume detected in ${stock.symbol} — trading at ${(ratio * 100 - 100).toFixed(0)}% above the normal range.`,
            severity,
            now,
          ),
        );
      }
    }

    // --- Momentum (consecutive same-direction ticks) ---
    if (nextWindow.length >= 8) {
      const last6 = nextWindow.slice(-6);
      const rising = last6.every((p, i) => i === 0 || p >= last6[i - 1]);
      const falling = last6.every((p, i) => i === 0 || p <= last6[i - 1]);
      if (rising || falling) {
        const key = `${symbol}:momentum`;
        if (now - (memory.lastAlertAt[key] ?? 0) > COOLDOWN_MS * 3) {
          memory.lastAlertAt[key] = now;
          const change = getChangePercent(stock);
          const dir = rising ? "upward" : "downward";
          alerts.push(
            makeAlert(
              stock,
              "momentum",
              "Momentum signal",
              `${stock.symbol} showing strong ${dir} momentum${change >= 0 ? "" : ""} — six consecutive ticks ${rising ? "higher" : "lower"}.`,
              change !== 0 && Math.abs(change) > 1 ? "high" : "medium",
              now,
            ),
          );
        }
      }
    }
  }

  // --- Market-wide volatility note (occasional) ---
  const moves = Object.values(stocks).map((s) => Math.abs(getChangePercent(s)));
  const avgMove = moves.reduce((a, b) => a + b, 0) / Math.max(1, moves.length);
  if (status === "OPEN" && avgMove > 0.9 && now - memory.lastVolatilityAlertAt > 180_000) {
    memory.lastVolatilityAlertAt = now;
    alerts.push(
      makeAlert(
        stocks[AI_MONITORED[0]],
        "market",
        "Market volatility increased",
        `Broad-market volatility is elevated — average stock move is ${avgMove.toFixed(2)}%. The AI agent recommends caution on intraday positions.`,
        "medium",
        now,
      ),
    );
  }

  return { alerts };
}

/** Trim helper shared by stores that keep alert lists. */
export function capAlerts<T extends { createdAt: number }>(list: T[], max: number = MAX_ALERTS): T[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, max);
}

export const FEED_LIMIT = MAX_FEED;
