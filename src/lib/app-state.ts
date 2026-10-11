import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/supabaseClient";
import { useAuth } from "./local-auth";
import { capAlerts, evaluateTick, FEED_LIMIT, type AgentConfig } from "./market/agent";
import type { Stock, StockAlert } from "./market/types";
import { AI_MONITORED, DEFAULT_WATCHLIST } from "./market/seed";

/**
 * Client-side app state: watchlist, notifications (AI alerts), settings and
 * the AI agent activity feed. Everything persists to localStorage and is
 * mock-only; swap the persistence layer or connect push services later.
 */

function createStore<T>(key: string, initial: T) {
  function load(): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      return { ...initial, ...(JSON.parse(raw) as T) };
    } catch {
      return initial;
    }
  }
  let state: T = load();
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: T) => {
      state = next;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // storage full/unavailable — state stays in memory
      }
      listeners.forEach((l) => l());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ---------------- Watchlist ----------------

// ---------------- Watchlist ----------------

export function useWatchlist() {
  const { user } = useAuth();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadWatchlist() {
      if (!user) {
        setSymbols([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("watchlists")
        .select("symbol")
        .eq("user_id", user.id);

      if (!active) return;

      if (error) {
        console.error("Failed to load watchlist:", error);
        setSymbols([]);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        const defaults = DEFAULT_WATCHLIST.map((symbol) => ({
          user_id: user.id,
          symbol,
        }));

        const { data: inserted } = await supabase
          .from("watchlists")
          .insert(defaults)
          .select("symbol");

        if (active) {
          setSymbols(
            inserted?.map((row) => row.symbol) ?? [...DEFAULT_WATCHLIST]
          );
        }
      } else {
        setSymbols(data.map((row) => row.symbol));
      }

      setLoading(false);
    }

    loadWatchlist();

    return () => {
      active = false;
    };
  }, [user]);

  const add = async (symbol: string) => {
    if (!user || symbols.includes(symbol)) return;

    setSymbols((current) => [...current, symbol]);

    const { error } = await supabase.from("watchlists").insert({
      user_id: user.id,
      symbol,
    });

    if (error) {
      console.error("Failed to add watchlist stock:", error);
      setSymbols((current) => current.filter((s) => s !== symbol));
    }
  };

  const remove = async (symbol: string) => {
    if (!user) return;

    setSymbols((current) => current.filter((s) => s !== symbol));

    const { error } = await supabase
      .from("watchlists")
      .delete()
      .eq("user_id", user.id)
      .eq("symbol", symbol);

    if (error) {
      console.error("Failed to remove watchlist stock:", error);
      setSymbols((current) => [...current, symbol]);
    }
  };

  const toggle = async (symbol: string) => {
    if (symbols.includes(symbol)) {
      await remove(symbol);
    } else {
      await add(symbol);
    }
  };

  return {
    symbols,
    has: (symbol: string) => symbols.includes(symbol),
    toggle,
    add,
    remove,
    loading,
  };
}
// ---------------- Notifications / AI alerts ----------------

interface NotificationsState {
  alerts: StockAlert[];
}

const notificationsStore = createStore<NotificationsState>(
  "nexttrade.notifications",
  { alerts: seedAlerts() },
);

function seedAlerts(): StockAlert[] {
  const now = Date.now();
  const mins = (m: number) => now - m * 60_000;

  const mk = (
    i: number,
    symbol: string,
    kind: StockAlert["kind"],
    title: string,
    message: string,
    severity: StockAlert["severity"],
    at: number,
  ): StockAlert => ({
    id: `seed_${i}`,
    symbol,
    kind,
    title,
    message,
    severity,
    createdAt: at,
    read: false,
  });

  return capAlerts([
    mk(
      0,
      "RELIANCE",
      "movement",
      "Unusual price movement",
      "RELIANCE moved 2.3% in 5 minutes. The AI agent flagged short-term volatility around the ₹1,430 level.",
      "high",
      mins(6),
    ),
    mk(
      1,
      "INFY",
      "volume",
      "Volume spike detected",
      "Unusual volume detected in INFY — trading 38% above the normal range.",
      "medium",
      mins(11),
    ),
    mk(
      2,
      "ICICIBANK",
      "momentum",
      "Momentum signal",
      "ICICIBANK showing strong upward momentum — six consecutive ticks higher.",
      "medium",
      mins(17),
    ),
    mk(
      3,
      "SBIN",
      "movement",
      "Momentum signal",
      "SBIN momentum signal detected after a 0.9% move in the last 15 minutes.",
      "low",
      mins(24),
    ),
    mk(
      4,
      "MARKET",
      "market",
      "Market volatility increased",
      "Broad-market volatility is elevated. The AI agent recommends caution on intraday positions.",
      "medium",
      mins(39),
    ),
  ]);
}

export function useNotifications() {
  const state = useSyncExternalStore(
    notificationsStore.subscribe,
    notificationsStore.get,
    notificationsStore.get,
  );

  const sorted = capAlerts(state.alerts);

  return {
    alerts: sorted,
    unreadCount: sorted.filter((a) => !a.read).length,

    markRead: (id: string) =>
      notificationsStore.set({
        alerts: state.alerts.map((a) =>
          a.id === id ? { ...a, read: true } : a,
        ),
      }),

    markAllRead: () =>
      notificationsStore.set({
        alerts: state.alerts.map((a) => ({ ...a, read: true })),
      }),

    remove: (id: string) =>
      notificationsStore.set({
        alerts: state.alerts.filter((a) => a.id !== id),
      }),

    push: (alerts: StockAlert[]) => {
      if (alerts.length === 0) return;

      notificationsStore.set({
        alerts: capAlerts([...alerts, ...state.alerts]),
      });
    },

    clear: () => notificationsStore.set({ alerts: [] }),
  };
}

export function alertsForSymbol(
  alerts: StockAlert[],
  symbol: string,
): StockAlert[] {
  return alerts.filter((a) => a.symbol === symbol).slice(0, 10);
}

// ---------------- Settings ----------------

export interface Settings {
  agentEnabled: boolean;
  sensitivity: AgentConfig["sensitivity"];
  alertsAI: boolean;
  alertsPrice: boolean;
  alertsMarket: boolean;
  name: string;
}

const DEFAULT_SETTINGS: Settings = {
  agentEnabled: true,
  sensitivity: "medium",
  alertsAI: true,
  alertsPrice: true,
  alertsMarket: true,
  name: "",
};

const settingsStore = createStore<Settings>(
  "nexttrade.settings",
  DEFAULT_SETTINGS,
);

export function useSettings() {
  const settings = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.get,
    settingsStore.get,
  );

  return {
    settings,

    update: (patch: Partial<Settings>) =>
      settingsStore.set({ ...settings, ...patch }),
  };
}

// ---------------- AI agent activity feed ----------------

export interface AgentEvent {
  id: string;
  symbol: string;
  time: string;
  message: string;
  severity: StockAlert["severity"];
  at: number;
}

interface FeedState {
  events: AgentEvent[];
}

const feedStore = createStore<FeedState>("nexttrade.agentFeed", {
  events: [],
});

export function useAgentFeed() {
  const state = useSyncExternalStore(
    feedStore.subscribe,
    feedStore.get,
    feedStore.get,
  );

  return {
    events: state.events.slice(0, FEED_LIMIT),

    pushFromAlerts: (alerts: StockAlert[]) => {
      if (alerts.length === 0) return;

      const events: AgentEvent[] = alerts.map((a) => ({
        id: a.id,
        symbol: a.symbol,
        time: formatTime(a.createdAt),
        message: a.title,
        severity: a.severity,
        at: a.createdAt,
      }));

      feedStore.set({
        events: [...events, ...state.events].slice(0, FEED_LIMIT),
      });
    },

    clear: () => feedStore.set({ events: [] }),
  };
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ---------------- Agent runner ----------------

let agentTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Bridges the market engine to the AI agent + notification stores.
 * Runs on an interval so it works even when no page is subscribed to ticks.
 */
export function startAgentBridge(
  getStocks: () => Record<string, Stock>,
) {
  if (agentTimer) return;

  agentTimer = setInterval(() => {
    const s = settingsStore.get();

    const config: AgentConfig = {
      enabled: s.agentEnabled,
      sensitivity: s.sensitivity,
    };

    const { alerts } = evaluateTick(getStocks(), config);

    if (alerts.length === 0) return;

    const filtered = alerts.filter((a) => {
      if (a.kind === "market") return s.alertsMarket;
      if (a.kind === "volume") return s.alertsPrice;
      return s.alertsAI;
    });

    if (filtered.length === 0) return;

    const notifState = notificationsStore.get();

    notificationsStore.set({
      alerts: capAlerts([...filtered, ...notifState.alerts]),
    });

    const feedState = feedStore.get();

    const events: AgentEvent[] = filtered.map((a) => ({
      id: `${a.id}_feed`,
      symbol: a.symbol,
      time: formatTime(a.createdAt),
      message: a.title,
      severity: a.severity,
      at: a.createdAt,
    }));

    feedStore.set({
      events: [...events, ...feedState.events].slice(0, FEED_LIMIT),
    });
  }, 6_000);
}

export function stopAgentBridge() {
  if (agentTimer) {
    clearInterval(agentTimer);
    agentTimer = null;
  }
}

export { AI_MONITORED };