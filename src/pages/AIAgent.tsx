import { Bot } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router";
import { Sparkline } from "@/components/charts/Sparkline";
import { ChangeIndicator, SeverityBadge, VolumeStatus } from "@/components/market/StockRow";
import { formatInr, getChangePercent, useMarket } from "@/lib/market/engine";
import { AI_MONITORED, useAgentFeed, useSettings } from "@/lib/app-state";

export default function AIAgent() {
  const market = useMarket();
  const { events } = useAgentFeed();
  const { settings } = useSettings();

  const monitored = AI_MONITORED.map((s) => market.stocks[s]).filter(Boolean);
  const active = settings.agentEnabled;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Status header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">AI Trading Agent</h2>
            <Badge
              variant="outline"
              className={active ? "border-up/40 bg-up/10 text-up" : "border-border text-muted-foreground"}
            >
              <span className={`relative mr-1.5 size-1.5 rounded-full ${active ? "live-dot bg-up" : "bg-muted-foreground"}`} />
              {active ? "AI AGENT ACTIVE" : "PAUSED"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {active
              ? `Monitoring ${monitored.length} stocks · sensitivity ${settings.sensitivity}`
              : "Monitoring paused — enable it in Settings."}
          </p>
        </div>
        <Link to="/settings" className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
          Agent settings
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Monitoring list */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-gold" /> Monitoring list
            </CardTitle>
            <CardDescription>Live view of every stock under agent surveillance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {monitored.map((stock) => {
              const change = getChangePercent(stock);
              return (
                <Link
                  key={stock.symbol}
                  to={`/stock/${stock.symbol}`}
                  className="flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors hover:border-ring/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{stock.symbol}</p>
                    <p className="truncate text-xs text-muted-foreground">{stock.name}</p>
                  </div>
                  <div className="hidden w-24 md:block">
                    <Sparkline data={(market.intraday[stock.symbol] ?? []).slice(-40)} up={change >= 0} />
                  </div>
                  <div className="w-24 text-right">
                    <p className="text-sm font-medium tabular-nums">{formatInr(stock.price)}</p>
                    <ChangeIndicator changePercent={change} className="justify-end" />
                  </div>
                  <div className="hidden w-44 text-right lg:block">
                    <VolumeStatus stock={stock} />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Live activity feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity feed</CardTitle>
            <CardDescription>Live agent detections, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className={`size-2 rounded-full ${active ? "live-dot bg-gold" : "bg-muted-foreground"}`} />
                <p className="max-w-[220px] text-sm text-muted-foreground">
                  The agent is scanning the tape. Detections will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="max-h-[560px] space-y-0 overflow-y-auto pr-1">
                {events.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 border-b border-border/60 py-3 last:border-0">
                    <p className="w-16 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">{e.time}</p>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link to={`/stock/${e.symbol}`} className="truncate text-sm font-semibold hover:text-gold">
                          {e.symbol}
                        </Link>
                        <SeverityBadge severity={e.severity} />
                      </div>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{e.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
