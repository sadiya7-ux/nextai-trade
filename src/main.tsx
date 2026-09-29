import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import React, { StrictMode, lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import "./index.css";
import { AuthProvider, useAuth } from "@/lib/local-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { startEngine, getSnapshot } from "@/lib/market/engine";
import { startAgentBridge } from "@/lib/app-state";
import { AppShell } from "@/components/layout/AppShell";
import type { ReactNode } from "react";

const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Watchlist = lazy(() => import("./pages/Watchlist.tsx"));
const StockDetails = lazy(() => import("./pages/StockDetails.tsx"));
const AIAgent = lazy(() => import("./pages/AIAgent.tsx"));
const Portfolio = lazy(() => import("./pages/Portfolio.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

/** Redirects signed-out visitors of protected routes to /auth?returnTo=... */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-pulse rounded-full bg-gold/60" />
      </div>
    );
  }
  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <>{children}</>;
}

/** Signed-in users skip the auth page. */
function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
    </div>
  );
}

/** Silent error boundary — runtime errors render a message, never a blank page. */
class RootErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "Unknown runtime error" };
  }
  componentDidCatch(err: Error) {
    console.error("[NextTrade] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Something went wrong</p>
            <p className="mt-2 text-xs text-muted-foreground">{this.state.message}</p>
            <button
              className="mt-4 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

/** Boots the mock market engine + AI agent bridge once. */
function MarketBoot() {
  useEffect(() => {
    startEngine();
    startAgentBridge(() => getSnapshot().stocks);
  }, []);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <VlyToolbar />
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <RouteSyncer />
            <MarketBoot />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route
                  path="/auth"
                  element={
                    <RedirectIfAuthed>
                      <AuthPage />
                    </RedirectIfAuthed>
                  }
                />
                <Route
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/watchlist" element={<Watchlist />} />
                  <Route path="/stock/:symbol" element={<StockDetails />} />
                  <Route path="/agent" element={<AIAgent />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
