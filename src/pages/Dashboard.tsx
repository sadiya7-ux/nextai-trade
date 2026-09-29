import { useMemo } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { Bot, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceChart } from "@/components/charts/PriceChart";
import {
  AlertRow,
  ChangeIndicator,
  IndexCard,
  MoverRow,
  WatchlistRow,
} from "@/components/market/StockRow";
import {
  getChangePercent,
  getMovers,
  useMarket,
} from "@/lib/market/engine";
import { useNotifications, useWatchlist } from "@/lib/app-state";

export default function Dashboard() {
  const market = useMarket();
  const watchlist = useWatchlist();
  const { alerts } = useNotifications();

  const { gainers, losers } = useMemo(() => getMovers(market.stocks), [market.stocks]);
  const nifty = market.indices[0];
  const niftySeries = useMemo(
    () => nifty.sparkline.map((v, i) => ({ time: String(i), price: v })),
    [nifty.sparkline],
  );
  const watchlistStocks = watchlist.symbols
    .map((s) => ({ stock: market.stocks[s], series: market.intraday[s] ?? [] }))
    .filter((x) => x.stock);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Market overview</h2>
        <p className="text-sm text-muted-foreground">Live simulated Indian market data, updated every few seconds.</p>
      </div>

      {/* Index cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {market.indices.map((idx) => (
          <IndexCard key={idx.symbol} index={idx} />
        ))}
      </div>

      {/* Chart + movers */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>NIFTY 50</CardTitle>
              <CardDescription className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-lg font-semibold text-foreground tabular-nums">
                  {nifty.value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <ChangeIndicator changePercent={nifty.changePercent} />
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PriceChart data={niftySeries} up={nifty.changePercent >= 0} height={300} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top gainers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 pt-0">
              {gainers.map(({ stock, changePercent }) => (
                <MoverRow key={stock.symbol} stock={stock} changePercent={changePercent} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top losers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0.5 pt-0">
              {losers.map(({ stock, changePercent }) => (
                <MoverRow key={stock.symbol} stock={stock} changePercent={changePercent} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Watchlist preview */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>My watchlist</CardTitle>
            <CardDescription>Your tracked stocks with live prices.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/watchlist">Manage watchlist</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {watchlistStocks.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Your watchlist is empty. <Link to="/watchlist" className="text-gold underline-offset-4 hover:underline">Add stocks</Link> to track them here.
            </p>
          )}
          {watchlistStocks.map(({ stock, series }) => (
            <motion.div key={stock.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <WatchlistRow stock={stock} series={series.slice(-40)} />
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* AI alerts */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-gold" /> AI alerts
            </CardTitle>
            <CardDescription>Recent unusual activity detected by the agent.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/agent">Open AI agent</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No alerts yet — the agent is watching the market.</p>
          ) : (
            alerts.slice(0, 5).map((a) => <AlertRow key={a.id} alert={a} />)
          )}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 pb-4 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        All market data is simulated for demonstration. NextTrade supports paper trading only — no real orders are placed and no returns are guaranteed.
      </p>
    </div>
  );
}
