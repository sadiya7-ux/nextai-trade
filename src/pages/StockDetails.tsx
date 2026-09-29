import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Bot, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceChart } from "@/components/charts/PriceChart";
import { AlertRow, ChangeIndicator } from "@/components/market/StockRow";
import {
  formatInr,
  formatPct,
  formatVolume,
  getAiAnalysis,
  getChangePercent,
  getMarketStatus,
  getStockRangeCandles,
  useMarket,
} from "@/lib/market/engine";
import type { RangeKey } from "@/lib/market/types";
import { alertsForSymbol, useNotifications, useWatchlist } from "@/lib/app-state";
import { buyStock, sellStock, usePortfolio } from "@/lib/trading";
import { checkOrder } from "@/lib/guard";
const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y"];

export default function StockDetails() {
  const { symbol = "" } = useParams();
  const market = useMarket();
  const { alerts } = useNotifications();
  const watchlist = useWatchlist();
  const portfolio = usePortfolio();

  const [range, setRange] = useState<RangeKey>("1D");
  const [quantity, setQuantity] = useState("1");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const stock = market.stocks[symbol.toUpperCase()];
  const series = useMemo(() => getStockRangeCandles(symbol.toUpperCase(), range), [symbol, range, market.version]);
  const relatedAlerts = alertsForSymbol(alerts, symbol.toUpperCase());

  if (!stock) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">Stock not found</p>
            <p className="mt-1 text-sm text-muted-foreground">“{symbol}” isn't in the NextTrade universe.</p>
            <Button className="mt-6" variant="outline" asChild>
              <Link to="/watchlist">Back to watchlist</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const change = getChangePercent(stock);
  const inWatchlist = watchlist.has(stock.symbol);
  const holding = portfolio.holdings.find((h) => h.symbol === stock.symbol);
  const marketStatus = getMarketStatus();
  const qty = Number(quantity);
  const total = Number.isFinite(qty) && qty > 0 ? qty * stock.price : 0;

  const trade = (which: "BUY" | "SELL") => {
  setSide(which);
  // ⭐ THE GUARD — checks the order before anything happens
  const guard = checkOrder({
    symbol: stock.symbol,
    side: which,
    quantity: qty,
    price: stock.price,
    cash: portfolio.cash,
  });
  if (!guard.allowed) {
    setFeedback({ ok: false, text: "⛔ " + guard.message });
    return; // order never executes
  }
  const result =
    which === "BUY" ? buyStock(stock.symbol, qty, stock.price) : sellStock(stock.symbol, qty, stock.price);
    setFeedback(
      result.ok
        ? { ok: true, text: `${which} order filled: ${qty} ${stock.symbol} @ ${formatInr(stock.price)} (paper trade)` }
        : { ok: false, text: result.error ?? "Order failed." },
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <Link to="/watchlist" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Watchlist
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{stock.symbol}</h2>
              <Badge variant="outline" className="text-muted-foreground">{stock.sector}</Badge>
              <Badge variant="outline" className={marketStatus === "OPEN" ? "border-up/40 bg-up/10 text-up" : "text-muted-foreground"}>
                {marketStatus}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{stock.name}</p>
          </div>
          <Button variant={inWatchlist ? "secondary" : "outline"} size="sm" onClick={() => watchlist.toggle(stock.symbol)}>
            {inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          </Button>
        </div>
      </div>

      {/* Price stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Current price</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{formatInr(stock.price)}</p>
          <ChangeIndicator changePercent={change} className="mt-1" />
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Today's high / low</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatInr(stock.dayHigh)}</p>
          <p className="font-mono text-lg font-semibold tabular-nums text-muted-foreground">{formatInr(stock.dayLow)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Volume</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatVolume(stock.volume)}</p>
          <p className="text-xs text-muted-foreground">Avg {formatVolume(stock.avgVolume)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Prev close</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatInr(stock.previousClose)}</p>
          <p className={change >= 0 ? "text-sm text-up" : "text-sm text-down"}>{formatPct(change)} today</p>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Price chart</CardTitle>
            <CardDescription>Simulated {stock.symbol} price history.</CardDescription>
          </div>
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r} value={r} className="px-3">{r}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <PriceChart data={series} up={change >= 0} height={340} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* AI analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-gold" /> AI analysis
            </CardTitle>
            <CardDescription>AI-generated analysis · not investment advice.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-lg border bg-card/60 p-4 text-sm leading-6 text-muted-foreground">
              {getAiAnalysis(stock)}
            </p>
          </CardContent>
        </Card>

        {/* Paper trading */}
        <Card>
          <CardHeader>
            <CardTitle>Paper trading</CardTitle>
            <CardDescription>
              Virtual money only. {holding ? `You hold ${holding.quantity} @ ${formatInr(holding.avgBuyPrice)} avg.` : `Available cash ${formatInr(portfolio.cash)}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Order value</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm tabular-nums">
                  {formatInr(total)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button className="border-up/40 bg-up/10 text-up hover:bg-up/20" variant="outline" onClick={() => trade("BUY")}>
                BUY
              </Button>
              <Button className="border-down/40 bg-down/10 text-down hover:bg-down/20" variant="outline" onClick={() => trade("SELL")}>
                SELL
              </Button>
            </div>
            {feedback && (
              <p className={feedback.ok ? "text-sm text-up" : "text-sm text-down"}>{feedback.text}</p>
            )}
            <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Simulated execution at the current mock price. No real money is involved.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent AI alerts for this stock */}
      <Card>
        <CardHeader>
          <CardTitle>Recent AI alerts</CardTitle>
          <CardDescription>Agent signals for {stock.symbol}.</CardDescription>
        </CardHeader>
        <CardContent>
          {relatedAlerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No alerts for {stock.symbol} yet.</p>
          ) : (
            relatedAlerts.map((a) => <AlertRow key={a.id} alert={a} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
