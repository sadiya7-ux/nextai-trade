import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/local-auth";

type Mode = "login" | "signup";

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const returnTo = params.get("returnTo");
  const destination = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";

  const validate = (): string | null => {
    if (mode === "signup" && name.trim().length < 2) return "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    // Simulate a short async auth call so the UI shows intent.
    window.setTimeout(() => {
      const result =
        mode === "signup" ? signUp(name, email, password, remember) : signIn(email, password, remember);
      setBusy(false);
      if (result.ok) navigate(destination, { replace: true });
      else setError(result.error ?? "Something went wrong.");
    }, 350);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center px-6">
        <Link to="/" aria-label="NextTrade home">
          <Logo size="md" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <Card className="shadow-none">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Sign in to your NextTrade workspace."
                  : "Start with ₹1,00,000 in virtual funds. Paper trading only."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun Mehta" autoComplete="name" required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                    Remember me
                  </label>
                  {mode === "login" && (
                    <button
                      type="button"
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      onClick={() => setError("This is a local mock — just sign in with any saved account.")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                {error && <p className="text-sm text-down">{error}</p>}

                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {mode === "login" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    New to NextTrade?{" "}
                    <button className="font-medium text-gold underline-offset-4 hover:underline" onClick={() => { setMode("signup"); setError(null); }}>
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button className="font-medium text-gold underline-offset-4 hover:underline" onClick={() => { setMode("login"); setError(null); }}>
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing you agree this is a demo platform with mock data and virtual money only.
          </p>
        </div>
      </main>
    </div>
  );
}
