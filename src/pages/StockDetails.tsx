import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Bot, CheckCircle2, Info, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceChart } from "@/components/charts/PriceChart";
import { AlertRow, ChangeIndicator, SeverityBadge } from "@/components/market/StockRow";
import {
  formatInr,
  formatPct,
  formatVolume,
  getAiAnalysis,
  getChangePercent,
  getMarketStatus,
  getStockCandles,
  getStockRangeCandles,
  useMarket,
} from "@/lib/market/engine";
import type { RangeKey } from "@/lib/market/types";
import { alertsForSymbol, formatTime, useNotifications, useWatchlist } from "@/lib/app-state";
import {
  buyStock,
  getConsecutiveLosses,
  sellStock,
  usePortfolio,
  validateOrder,
  type OrderCheck,
  type OrderCheckId,
} from "@/lib/trading";
import {
  buyVerificationReducer,
  canExecuteBuy,
  initialBuyVerification,
} from "@/lib/buy-verification";
import { assessRisk, buildRiskInput, type BuyRiskAssessment } from "@/lib/ai/risk";

const RANGES: RangeKey[] = ["1D", "1W", "1M", "3M", "1Y"];

function CheckRow({ ok, label, detail }: { ok: boolean; label?: string; detail: string }) {
  return (
    <div className="flex items-start gap-2 text-xs leading-5">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-up" />
      ) : (
        <XCircle className="mt-0.5 size-3.5 shrink-0 text-down" />
      )}
      <span className={ok ? "text-muted-foreground" : "text-down"}>
        {label ? <span className="font-medium text-foreground">{label}: </span> : null}
        {detail}
      </span>
    </div>
  );
}

function StepShell({
  n,
  title,
  ok,
  children,
}: {
  n: number;
  title: string;
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="size-4 text-up" />
        ) : (
          <XCircle className="size-4 text-down" />
        )}
        <p className="text-sm font-semibold">
          {n}. {title}
        </p>
        <span className={`ml-auto text-[11px] font-semibold tracking-wide ${ok ? "text-up" : "text-down"}`}>
          {ok ? "PASS" : "BLOCKED"}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default function StockDetails() {
  const { symbol = "" } = useParams();
  const market = useMarket();
  const { alerts, push } = useNotifications();
  const watchlist = useWatchlist();
  const portfolio = usePortfolio();

  const [range, setRange] = useState<RangeKey>("1D");
  const [quantity, setQuantity] = useState("1");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [verify, dispatchVerify] = useReducer(buyVerificationReducer, initialBuyVerification);
  const [cardAssessment, setCardAssessment] = useState<BuyRiskAssessment | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const assessmentKeyRef = useRef<string | null>(null);

  const stock = market.stocks[symbol.toUpperCase()];
  const series = useMemo(() => getStockRangeCandles(symbol.toUpperCase(), range), [symbol, range, market.version]);
  const relatedAlerts = alertsForSymbol(alerts, symbol.toUpperCase());
  const qty = Number(quantity);

  // Live hard-rule verdict for the order form — the exact same function that
  // execution re-runs immediately before filling the order.
  const validation = useMemo(
    () => validateOrder("BUY", stock?.symbol ?? symbol.toUpperCase(), qty, stock?.price ?? 0),
    [stock?.symbol, symbol, qty, stock?.price],
  );

  // AI risk assessment for the analysis card (throttled: only re-runs when the
  // symbol changes or price moves ≥0.5%, so a configured remote API is not
  // spammed on every 2s market tick).
  useEffect(() => {
    if (!stock) return;
    const change = getChangePercent(stock);
    const key = `${stock.symbol}:${Math.round(change * 2)}`;
    if (assessmentKeyRef.current === key) return;
    assessmentKeyRef.current = key;
    void assessRisk(buildRiskInput(stock, getStockCandles(stock.symbol).map((c) => c.price))).then((a) => {
      if (assessmentKeyRef.current === key) setCardAssessment(a);
    });
  }, [stock]);

  // In-app risk notification — created once per risky attempt (guarded by a
  // ref so re-renders never duplicate it).
  useEffect(() => {
    if (!stock || !verify.attemptId || verify.cancelled || !verify.assessment?.isRisky) return;
    const id = verify.attemptId;
    if (notifiedRef.current.has(id)) return;
    notifiedRef.current.add(id);
    const a = verify.assessment;
    push([
      {
        id: `risk_${id}`,
        symbol: a.symbol,
        kind: "movement",
        title: `Risky BUY: ${a.symbol} — ${a.riskLevel} risk`,
        message: `${a.title} ${a.explanation} Estimate based on available data, not a guarantee.`,
        severity: a.riskLevel,
        createdAt: Date.now(),
        read: false,
      },
    ]);
  }, [stock, verify.attemptId, verify.cancelled, verify.assessment, push]);

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
  const total = Number.isFinite(qty) && qty > 0 ? qty * stock.price : 0;
  // Only show an assessment that belongs to the stock currently on screen —
  // avoids a stale result (or a sync reset in an effect) when switching stocks.
  const visibleAssessment = cardAssessment?.symbol === stock.symbol ? cardAssessment : null;
  const attemptActive = verify.attemptId !== null && !verify.cancelled;
  const assessment = verify.assessment;
  const losses = attemptActive ? getConsecutiveLosses() : [];

  const check = (id: OrderCheckId): OrderCheck =>
    validation.checks.find((c) => c.id === id) ?? { id, label: id, ok: false, detail: "Check unavailable." };

  const startBuyVerification = () => {
    setFeedback(null);
    const attemptId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    dispatchVerify({ type: "START", attemptId });
    const input = buildRiskInput(stock, getStockCandles(stock.symbol).map((c) => c.price));
    void assessRisk(input).then((a) => dispatchVerify({ type: "ASSESS", attemptId, assessment: a }));
  };

  const cancelBuy = () => {
    dispatchVerify({ type: "CANCEL" });
    setFeedback({ ok: true, text: "BUY cancelled — no order was executed." });
  };

  const confirmAndExecuteBuy = () => {
    // Second confirmation. The reducer enforces the confirmation order and
    // canExecuteBuy enforces every hard rule — a blocked rule stops here even
    // with both confirmations given.
    const nextState = buyVerificationReducer(verify, { type: "CONFIRM" });
    if (!canExecuteBuy(nextState, validation)) {
      if (!validation.ok) {
        setFeedback({ ok: false, text: validation.errors[0] ?? "Order blocked by a trading rule." });
      }
      return;
    }
    dispatchVerify({ type: "CONFIRM" });
    // Final line of defence: buyStock re-runs all hard validations with the
    // current price and clock before executing.
    const result = buyStock(stock.symbol, qty, stock.price);
    if (result.ok) {
      setFeedback({
        ok: true,
        text: `BUY order filled: ${qty} ${stock.symbol} @ ${formatInr(stock.price)} (paper trade)`,
      });
      dispatchVerify({ type: "RESET" });
    } else {
      setFeedback({ ok: false, text: result.error ?? "Order failed." });
    }
  };

  const sell = () => {
    const result = sellStock(stock.symbol, qty, stock.price);
    setFeedback(
      result.ok
        ? { ok: true, text: `SELL order filled: ${qty} ${stock.symbol} @ ${formatInr(stock.price)} (paper trade)` }
        : { ok: false, text: result.error ?? "Order failed." },
    );
  };

  const step1Ok = check("price").ok;
  const step2Ok = check("quantity").ok && check("orderValue").ok;
  const step3 = check("funds");
  const step4Checks = [check("marketHours"), check("duplicate"), check("buyRateLimit"), check("losingStreak")];
  const step4Ok = step4Checks.every((c) => c.ok);
  const step5Ok = Boolean(assessment && verify.acknowledged);

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
            <CardDescription>
              {visibleAssessment
                ? "Risk estimate based on available data — not a guarantee, not investment advice."
                : "AI-generated analysis · not investment advice."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleAssessment ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={visibleAssessment.riskLevel} />
                  <span className="text-xs text-muted-foreground">
                    {visibleAssessment.riskLevel} risk · {(visibleAssessment.confidence * 100).toFixed(0)}% confidence ·{" "}
                    {visibleAssessment.source === "remote" ? "remote AI" : "local rule-based model"}
                  </span>
                </div>
                <p className="rounded-lg border bg-card/60 p-4 text-sm leading-6 text-muted-foreground">
                  {visibleAssessment.explanation}
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-muted-foreground">
                  {visibleAssessment.factors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  Estimate from {visibleAssessment.symbol} market data — not a prediction or guarantee of future losses.
                </p>
              </>
            ) : (
              <p className="rounded-lg border bg-card/60 p-4 text-sm leading-6 text-muted-foreground">
                {getAiAnalysis(stock)}
              </p>
            )}
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
                  disabled={attemptActive}
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

            {attemptActive ? (
              /* ---------- Five-step BUY verification ---------- */
              <div className="space-y-3 rounded-lg border border-gold/40 bg-gold/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <ShieldCheck className="size-4 text-gold" /> 5-step BUY verification
                  </p>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Paper trade</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md border bg-muted/30 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Order total</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">{formatInr(total)}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Available cash</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">{formatInr(portfolio.cash)}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cash after order</p>
                    <p className="font-mono text-sm font-semibold tabular-nums">{formatInr(validation.cashAfter)}</p>
                  </div>
                </div>

                {!validation.ok && (
                  <ul className="space-y-1 rounded-md border border-down/40 bg-down/10 p-2 text-xs leading-5 text-down">
                    {validation.errors.map((e) => (
                      <li key={e}>• {e}</li>
                    ))}
                  </ul>
                )}

                <StepShell n={1} title="Stock" ok={step1Ok}>
                  <CheckRow ok label="Symbol" detail={stock.symbol} />
                  <CheckRow
                    ok={step1Ok}
                    label="Current price"
                    detail={step1Ok ? formatInr(stock.price) : "Invalid execution price."}
                  />
                </StepShell>

                <StepShell n={2} title="Quantity & order value" ok={step2Ok}>
                  <CheckRow ok={check("quantity").ok} label="Quantity" detail={check("quantity").detail} />
                  <CheckRow ok={check("orderValue").ok} label="Order value" detail={check("orderValue").detail} />
                </StepShell>

                <StepShell n={3} title="Funds" ok={step3.ok}>
                  <CheckRow ok={step3.ok} label={step3.label} detail={step3.detail} />
                  <CheckRow ok={step3.ok} label="Cash after order" detail={formatInr(validation.cashAfter)} />
                </StepShell>

                <StepShell n={4} title="Trading rules" ok={step4Ok}>
                  {step4Checks.map((c) => (
                    <CheckRow key={c.id} ok={c.ok} label={c.label} detail={c.detail} />
                  ))}
                  {!check("losingStreak").ok && losses.length > 0 && (
                    <div className="mt-1.5 rounded-md border border-down/40 bg-down/10 p-2">
                      <p className="text-[11px] font-semibold text-down">
                        Relevant trading history — {losses.length} consecutive losing SELL trades:
                      </p>
                      <ul className="mt-1 space-y-0.5 text-[11px] leading-4 text-muted-foreground">
                        {losses.map((t) => (
                          <li key={t.id}>
                            {formatTime(t.at)} · SELL {t.quantity} {t.symbol} @ {formatInr(t.price)} · P&amp;L −
                            {formatInr(Math.abs(t.pnl ?? 0))}
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/portfolio"
                        className="mt-1.5 inline-block text-[11px] text-gold underline-offset-2 hover:underline"
                      >
                        View full trade history →
                      </Link>
                    </div>
                  )}
                </StepShell>

                <StepShell n={5} title="Risk review" ok={step5Ok}>
                  {!assessment ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Running AI risk assessment (remote AI if configured, rule-based fallback otherwise)…
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className={`rounded-md border p-3 ${assessment.isRisky ? "border-down/40 bg-down/10" : "border-up/40 bg-up/10"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={assessment.riskLevel} />
                          <span className={`text-xs font-semibold ${assessment.isRisky ? "text-down" : "text-up"}`}>
                            {assessment.riskLevel.toUpperCase()} risk —{" "}
                            {assessment.isRisky ? "risky BUY, extra confirmation required" : "standard confirmation"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{assessment.explanation}</p>
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs leading-5 text-muted-foreground">
                          {assessment.factors.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                          Estimate based on available data ({assessment.source === "remote" ? "remote AI" : "local rule-based model"} ·{" "}
                          {(assessment.confidence * 100).toFixed(0)}% confidence) — not a guarantee and not investment advice.
                        </p>
                      </div>

                      <label htmlFor="risk-ack" className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          id="risk-ack"
                          checked={verify.acknowledged}
                          onCheckedChange={() => dispatchVerify({ type: "ACKNOWLEDGE" })}
                        />
                        I understand the risks.
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" onClick={cancelBuy}>
                          Cancel
                        </Button>
                        <Button
                          disabled={!verify.acknowledged || !validation.ok}
                          onClick={confirmAndExecuteBuy}
                          className={
                            assessment.isRisky
                              ? "border-down/40 bg-down/10 text-down hover:bg-down/20"
                              : "border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
                          }
                          variant="outline"
                        >
                          {assessment.isRisky ? "Confirm risky BUY" : "Confirm BUY"}
                        </Button>
                      </div>
                    </div>
                  )}
                </StepShell>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="border-up/40 bg-up/10 text-up hover:bg-up/20"
                  variant="outline"
                  onClick={startBuyVerification}
                >
                  BUY
                </Button>
                <Button className="border-down/40 bg-down/10 text-down hover:bg-down/20" variant="outline" onClick={sell}>
                  SELL
                </Button>
              </div>
            )}

            {feedback && (
              <p className={feedback.ok ? "text-sm text-up" : "text-sm text-down"}>{feedback.text}</p>
            )}
            <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Simulated execution at the current mock price. No real money is involved. Hard trading rules (₹50,000 order cap, market hours, duplicate protection, 3-BUY/60s rate limit, consecutive-loss guard) are enforced on every order.
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
