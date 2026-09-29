import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WatchlistRow } from "@/components/market/StockRow";
import { STOCK_SEEDS } from "@/lib/market/seed";
import { useMarket } from "@/lib/market/engine";
import { useWatchlist } from "@/lib/app-state";

export default function Watchlist() {
  const market = useMarket();
  const watchlist = useWatchlist();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return STOCK_SEEDS.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [query]);

  const rows = watchlist.symbols
    .map((s) => ({ stock: market.stocks[s], series: market.intraday[s] ?? [] }))
    .filter((x) => x.stock);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">Watchlist</h2>
        <p className="text-sm text-muted-foreground">Track Indian stocks with live simulated prices.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a stock</CardTitle>
          <CardDescription>Search by symbol or company name.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try RELIANCE, TCS, HDFC Bank…"
              className="pl-9"
            />
          </div>
          {results.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              {results.map((s) => {
                const added = watchlist.has(s.symbol);
                return (
                  <div key={s.symbol} className="flex items-center justify-between border-b px-4 py-2.5 last:border-0">
                    <Link to={`/stock/${s.symbol}`} className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.symbol}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.name} · {s.sector}</p>
                    </Link>
                    <Button variant={added ? "secondary" : "outline"} size="sm" disabled={added} onClick={() => watchlist.add(s.symbol)}>
                      {added ? "Added" : <><Plus className="size-3.5" /> Add</>}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {query.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground">No stocks match “{query}”.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {rows.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Your watchlist is empty. Search above to add stocks.
            </CardContent>
          </Card>
        )}
        {rows.map(({ stock, series }) => (
          <WatchlistRow
            key={stock.symbol}
            stock={stock}
            series={series.slice(-40)}
            onRemove={() => watchlist.remove(stock.symbol)}
          />
        ))}
      </div>
    </div>
  );
}
