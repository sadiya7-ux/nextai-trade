import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, Bot, LineChart, ShieldCheck, Star, Wallet } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarket, formatInr, formatPct, getChangePercent } from "@/lib/market/engine";

const FEATURES = [
  {
    icon: Bot,
    title: "AI market agent",
    description: "Monitors intraday activity, flags unusual price moves, volume spikes and momentum shifts — with a plain-language explanation for every alert.",
  },
  {
    icon: LineChart,
    title: "Live market view",
    description: "NIFTY 50, BANK NIFTY and Sensex at a glance, with movers, watchlists and interactive charts across 1D to 1Y timeframes.",
  },
  {
    icon: Wallet,
    title: "Paper trading",
    description: "Start with ₹1,00,000 in virtual funds. Practice BUY and SELL with correct position math — no real money, ever.",
  },
];

const STEPS = [
  { n: "01", title: "Sign up free", body: "Create an account in seconds. Your workspace, watchlist and virtual funds are ready immediately." },
  { n: "02", title: "Track the market", body: "Follow Indian large-caps, add stocks to your watchlist and let the AI agent watch them with you." },
  { n: "03", title: "Act on alerts", body: "Get severity-rated AI alerts, review the reasoning, and practice the trade with virtual money." },
];

function Ticker() {
  const { stocks } = useMarket();
  const items = Object.values(stocks);
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-border/60 bg-card/50 py-3" aria-hidden>
      <div className="animate-marquee flex w-max gap-10 px-4">
        {row.map((s, i) => {
          const change = getChangePercent(s);
          return (
            <span key={`${s.symbol}-${i}`} className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="font-semibold">{s.symbol}</span>
              <span className="tabular-nums text-muted-foreground">{formatInr(s.price)}</span>
              <span className={change >= 0 ? "tabular-nums text-up" : "tabular-nums text-down"}>{formatPct(change)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo size="md" />
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/auth?mode=login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/auth?mode=signup">Get started</Link>
          </Button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60"
          style={{ background: "radial-gradient(60% 60% at 50% 0%, color-mix(in oklch, var(--gold) 14%, transparent), transparent 70%)" }}
        />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge variant="outline" className="mb-6 gap-2 border-gold/40 bg-gold/10 text-gold">
            <span className="relative size-1.5 rounded-full bg-gold live-dot" />
            AI agent monitoring NIFTY 50 leaders
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            Trade smarter. <span className="text-gradient-gold">Stay ahead.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            NextTrade is an AI-powered intraday companion for Indian stock-market users. It watches the market,
            explains unusual moves in plain language, and lets you practice trading with virtual money.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/auth?mode=signup">
                Start paper trading <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth?mode=login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">₹1,00,000 virtual balance · Paper trading only · No real orders</p>
        </motion.div>
      </section>

      <Ticker />

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="bg-card p-7"
            >
              <div className="flex size-10 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-card/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Three steps from signup to your first AI-guided paper trade.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative border-l border-border pl-6">
                <span className="absolute -left-[7px] top-1 size-3.5 rounded-full border-2 border-gold bg-background" />
                <p className="font-mono text-xs text-gold">{s.n}</p>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center sm:px-6">
        <div className="rounded-2xl border bg-card p-10 sm:p-14">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
            <Star className="size-5" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">Ready to trade smarter?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Join NextTrade and practice AI-guided intraday trading with zero risk.
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link to="/auth?mode=signup">
              Create free account <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">
              NextTrade is a simulation platform for learning purposes. Market data shown is mock data.
              Nothing here is investment advice and no profits are guaranteed.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Paper trading only
            </span>
            <span>© {new Date().getFullYear()} NextTrade</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
