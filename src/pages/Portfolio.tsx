import { useMemo } from "react";
import { Link } from "react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChangeIndicator } from "@/components/market/StockRow";
import { formatInr, getChangePercent, useMarket } from "@/lib/market/engine";
import { computePortfolio, holdingPnl, resetPortfolio, usePortfolio } from "@/lib/trading";
import { formatTime } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export default function Portfolio() {
  const market = useMarket();
  const portfolio = usePortfolio();
  const computed = computePortfolio(portfolio.holdings, market.stocks);

  const rows = portfolio.holdings.map((h) => {
    const stock = market.stocks[h.symbol];
    const price = stock?.price ?? h.avgBuyPrice;
    return { holding: h, stock, ...holdingPnl(h, price), change: stock ? getChangePercent(stock) : 0 };
  });

  const todayPnl = rows.reduce((acc, r) => acc + (r.stock ? (r.stock.price - r.stock.previousClose) * r.holding.quantity : 0), 0);

  // Honest performance curve: only the snapshots actually recorded by the
  // trading store — nothing is interpolated, no timestamps are fabricated
  // during render. When fewer than two genuine recordings exist the card
  // shows an empty state instead of a misleading line.
  const perf = useMemo(
    () => portfolio.history.map((s) => ({ time: s.at, value: s.value })),
    [portfolio.history],
  );

  const stats = [
    { label: "Portfolio value", value: formatInr(computed.portfolioValue) },
    { label: "Available cash", value: formatInr(computed.cash) },
    { label: "Invested amount", value: formatInr(computed.invested) },
    { label: "Today's P/L", value: `${todayPnl >= 0 ? "+" : "−"}${formatInr(Math.abs(todayPnl))}`, tone: todayPnl >= 0 ? "up" : "down" },
    { label: "Overall P/L", value: `${computed.overallPnl >= 0 ? "+" : "−"}${formatInr(Math.abs(computed.overallPnl))}`, tone: computed.overallPnl >= 0 ? "up" : "down" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Portfolio</h2>
          <p className="text-sm text-muted-foreground">Your paper-trading performance with virtual funds.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => resetPortfolio()}>
          Reset virtual portfolio
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("mt-1 font-mono text-xl font-semibold tabular-nums", "tone" in s && s.tone === "up" && "text-up", "tone" in s && s.tone === "down" && "text-down")}>
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Simulated portfolio history</CardTitle>
            <CardDescription>
              Recorded snapshots of your virtual portfolio value as it changes —
              simulated paper trading, not real performance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {perf.length < 2 ? (
              <div className="flex h-64 w-full flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-medium">No history recorded yet</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Your virtual portfolio value is snapshotted roughly every minute while
                  the app is open, so genuine history accumulates from now on. Past
                  values are never invented — the chart appears once at least two
                  snapshots have been recorded.
                </p>
              </div>
            ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perf} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "var(--popover-foreground)",
                    }}
                    formatter={(value: number | string) => [formatInr(Number(value)), "Value"]}
                    labelFormatter={(label: number | string) => `Recorded ${formatTime(Number(label))}`}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--gold)" strokeWidth={2} fill="url(#perfFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent trades</CardTitle>
            <CardDescription>Your last paper executions.</CardDescription>
          </CardHeader>
          <CardContent>
            {portfolio.trades.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No trades yet. Open a stock and place your first paper trade.
              </p>
            ) : (
              <div className="max-h-64 space-y-0 overflow-y-auto pr-1">
                {portfolio.trades.slice(0, 12).map((t) => (
                  <div key={t.id} className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0">
                    <div>
                      <p className="text-sm font-medium">
                        <span className={t.side === "BUY" ? "text-up" : "text-down"}>{t.side}</span> {t.symbol}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.quantity} @ {formatInr(t.price)} · {formatTime(t.at)}</p>
                    </div>
                    <p className="font-mono text-sm tabular-nums">{formatInr(t.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Holdings */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
          <CardDescription>Positions valued at live simulated prices.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No holdings yet.{" "}
              <Link to="/watchlist" className="text-gold underline-offset-4 hover:underline">
                Open a stock
              </Link>{" "}
              and place a paper BUY.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Avg buy</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead className="text-right">P/L %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.holding.symbol}>
                    <TableCell>
                      <Link to={`/stock/${r.holding.symbol}`} className="hover:text-gold">
                        <p className="font-semibold">{r.holding.symbol}</p>
                        <p className="text-xs text-muted-foreground">{r.stock?.name ?? r.holding.symbol}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.holding.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(r.holding.avgBuyPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="flex flex-col items-end">
                        <span>{formatInr(r.stock?.price ?? r.holding.avgBuyPrice)}</span>
                        {r.stock && <ChangeIndicator changePercent={r.change} />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(r.invested)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(r.current)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", r.pnl >= 0 ? "text-up" : "text-down")}>
                      {r.pnl >= 0 ? "+" : "−"}{formatInr(Math.abs(r.pnl))}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", r.pnl >= 0 ? "text-up" : "text-down")}>
                      {r.pnl >= 0 ? "+" : "−"}{Math.abs(r.pnlPct).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
