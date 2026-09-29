import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  LayoutDashboard,
  Bot,
  Briefcase,
  Menu,
  Settings as SettingsIcon,
  Star,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/local-auth";
import { useNotifications } from "@/lib/app-state";
import { useMarket } from "@/lib/market/engine";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/agent", label: "AI Agent", icon: Bot },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <NavLink to="/dashboard" onClick={onNavigate}>
          <Logo size="md" />
        </NavLink>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                isActive && "bg-accent text-foreground",
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-4">
        <NavLink to="/settings" onClick={onNavigate} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs font-semibold text-black" style={{ backgroundColor: user?.avatarColor ?? "#E9BC3F" }}>
              {(user?.name ?? "N T")
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </NavLink>
      </div>
    </div>
  );
}

function MarketStatusPill() {
  const market = useMarket();
  const status = market.marketStatus;
  const open = status === "OPEN";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
      <span className={cn("relative size-1.5 rounded-full", open ? "live-dot bg-up" : "bg-muted-foreground/50")} />
      <span className="text-muted-foreground">NSE</span>
      <span className={open ? "text-up" : "text-muted-foreground"}>{status === "OPEN" ? "OPEN" : status === "PRE_OPEN" ? "PRE-OPEN" : "CLOSED"}</span>
      <span className="hidden text-muted-foreground/70 sm:inline">09:15–15:30 IST</span>
    </span>
  );
}

function NotificationBell() {
  const { unreadCount } = useNotifications();
  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <NavLink to="/notifications" aria-label="Notifications">
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </NavLink>
    </Button>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pageTitle = NAV.find((n) => location.pathname.startsWith(n.to))?.label ??
    (location.pathname.startsWith("/stock/") ? "Stock" : "NextTrade");

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo size="sm" withWordmark={false} />
            </div>
            <h1 className="hidden text-sm font-semibold text-foreground md:block">{pageTitle}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <MarketStatusPill />
            <NotificationBell />
          </div>
        </header>

        {/* Page content with subtle page transition */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex-1 px-4 py-6 sm:px-6 lg:px-8"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
