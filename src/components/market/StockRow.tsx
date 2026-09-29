import { Link } from "react-router";
import { ArrowDownRight, ArrowUpRight, Bell, BellOff, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/charts/Sparkline";
import { cn } from "@/lib/utils";
import {
  formatInr,
  formatPct,
  formatVolume,
  getChangePercent,
} from "@/lib/market/engine";
import type { IndexQuote, Stock, StockAlert } from "@/lib/market/types";

export function ChangeIndicator({ changePercent, className }: { changePercent: number; className?: string }) {
  const up = changePercent >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-sm font-medium tabular-nums", up ? "text-up" : "text-down", className)}>
      <Icon className="size-3.5" />
      {formatPct(changePercent)}
    </span>
  );
}

/** Dashboard index card (NIFTY / BANKNIFTY / SENSEX). */
export function IndexCard({ index }: { index: IndexQuote }) {
  const up = index.changePercent >= 0;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">{index.symbol}</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatIndexValue(index.value)}</p>
          <ChangeIndicator changePercent={index.changePercent} className="mt-1" />
        </div>
        <div className="w-24">
          <Sparkline data={index.sparkline} up={up} />
        </div>
      </div>
    </div>
  );
}

function formatIndexValue(v: number) {
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

/** Compact row used in Top Gainers / Top Losers panels. */
export function MoverRow({ stock, changePercent }: { stock: Stock; changePercent: number }) {
  return (
    <Link
      to={`/stock/${stock.symbol}`}
      className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{stock.symbol}</p>
        <p className="truncate text-xs text-muted-foreground">{stock.name}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums">{formatInr(stock.price)}</p>
        <ChangeIndicator changePercent={changePercent} className="justify-end" />
      </div>
    </Link>
  );
}

/** Watchlist row with mini chart + optional remove action. */
export function WatchlistRow({
  stock,
  series,
  onRemove,
}: {
  stock: Stock;
  series: number[];
  onRemove?: () => void;
}) {
  const change = getChangePercent(stock);
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-ring/40">
      <Link to={`/stock/${stock.symbol}`} className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0 flex-[1.4]">
          <p className="truncate text-sm font-semibold">{stock.symbol}</p>
          <p className="truncate text-xs text-muted-foreground">{stock.name}</p>
        </div>
        <div className="hidden w-20 text-right text-xs text-muted-foreground sm:block">
          <p>H {formatInr(stock.dayHigh)}</p>
          <p>L {formatInr(stock.dayLow)}</p>
        </div>
        <div className="hidden w-24 md:block">
          <Sparkline data={series} up={change >= 0} />
        </div>
        <div className="flex-[1] text-right">
          <p className="text-sm font-medium tabular-nums">{formatInr(stock.price)}</p>
          <ChangeIndicator changePercent={change} className="justify-end" />
        </div>
      </Link>
      {onRemove && (
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${stock.symbol} from watchlist`}>
          <X className="size-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

const SEVERITY_STYLES: Record<StockAlert["severity"], string> = {
  high: "bg-down/15 text-down border-down/30",
  medium: "bg-gold/15 text-gold border-gold/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function SeverityBadge({ severity }: { severity: StockAlert["severity"] }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", SEVERITY_STYLES[severity])}>
      {severity}
    </Badge>
  );
}

/** AI alert row (dashboard + notifications reuse this). */
export function AlertRow({
  alert,
  timeLabel,
  actions,
}: {
  alert: StockAlert;
  timeLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0">
      <div className="mt-0.5 shrink-0">
        <SeverityBadge severity={alert.severity} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-sm font-semibold">{alert.symbol}</p>
          <span className="text-xs text-muted-foreground">·</span>
          <p className="text-xs text-muted-foreground">{timeLabel ?? new Date(alert.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
          {!alert.read && <span className="size-1.5 rounded-full bg-gold" aria-label="unread" />}
        </div>
        <p className="mt-0.5 text-sm font-medium">{alert.title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{alert.message}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

/** Volume status chip for the AI agent monitoring list. */
export function VolumeStatus({ stock }: { stock: Stock }) {
  const ratio = stock.volume / stock.avgVolume;
  const label = ratio > 1.25 ? "Above normal" : ratio < 0.8 ? "Below normal" : "Normal";
  const tone = ratio > 1.25 ? "text-gold" : "text-muted-foreground";
  return (
    <span className={cn("text-xs font-medium tabular-nums", tone)}>
      {formatVolume(stock.volume)} · {label}
    </span>
  );
}

export function WatchButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <Button variant={active ? "secondary" : "outline"} size="sm" onClick={onClick}>
      {active ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
      {active ? "Remove" : "Add"}
    </Button>
  );
}
