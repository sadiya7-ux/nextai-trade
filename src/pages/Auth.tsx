
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/local-auth";
import { supabase } from "@/supabaseClient";

type Mode = "login" | "signup" | "forgot" | "reset";

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const { signIn, signUp } = useAuth();

  const initialMode =
    params.get("mode") === "signup"
      ? "signup"
      : params.get("mode") === "reset"
        ? "reset"
        : "login";

  const [mode, setMode] = useState<Mode>(initialMode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const returnTo = params.get("returnTo");

  const destination =
    returnTo &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//")
      ? returnTo
      : "/dashboard";

  const validate = (): string | null => {
    if (mode === "signup" && name.trim().length < 2) {
      return "Please enter your name.";
    }

    if (
      mode === "login" ||
      mode === "signup"
    ) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return "Enter a valid email address.";
      }

      if (password.length < 6) {
        return "Password must be at least 6 characters.";
      }
    }

    if (mode === "reset" && newPassword.length < 6) {
      return "Password must be at least 6 characters.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const err = validate();

    if (err) {
      setError(err);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    if (mode === "forgot") {
      const trimmedEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError("Enter a valid email address.");
        setBusy(false);
        return;
      }

      const redirectUrl = `${window.location.origin}/auth?mode=reset`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          trimmedEmail,
          {
            redirectTo: redirectUrl,
          }
        );

      setBusy(false);

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMessage(
        "Password reset email sent. Check your inbox."
      );

      return;
    }

    if (mode === "reset") {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      setBusy(false);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setMessage(
        "Password updated successfully. You can now sign in."
      );

      setNewPassword("");

      setTimeout(() => {
        setMode("login");
        setMessage(null);
      }, 1500);

      return;
    }

    const result =
      mode === "signup"
        ? await signUp(name, email, password, remember)
        : await signIn(email, password, remember);

    setBusy(false);

    if (result.ok) {
      navigate(destination, { replace: true });
    } else {
      setError(
        result.error ?? "Something went wrong."
      );
    }
  };

  const showLoginForm =
    mode === "login" || mode === "signup";

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
                {mode === "login" && "Welcome back"}
                {mode === "signup" && "Create your account"}
                {mode === "forgot" && "Forgot password?"}
                {mode === "reset" && "Set a new password"}
              </CardTitle>

              <CardDescription>
                {mode === "login" &&
                  "Sign in to your NextTrade workspace."}

                {mode === "signup" &&
                  "Start with ₹1,00,000 in virtual funds. Paper trading only."}

                {mode === "forgot" &&
                  "Enter your email and we'll send you a password reset link."}

                {mode === "reset" &&
                  "Choose a new password for your NextTrade account."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Full name
                    </Label>

                    <Input
                      id="name"
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      placeholder="Arjun Mehta"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}

                {(mode === "login" ||
                  mode === "signup" ||
                  mode === "forgot") && (
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email
                    </Label>

                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value)
                      }
                      placeholder="name@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                )}

                {mode === "login" ||
                mode === "signup" ? (
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Password
                    </Label>

                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="••••••••"
                      autoComplete={
                        mode === "login"
                          ? "current-password"
                          : "new-password"
                      }
                      required
                    />
                  </div>
                ) : null}

                {mode === "reset" && (
                  <div className="space-y-2">
                    <Label htmlFor="new-password">
                      New password
                    </Label>

                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) =>
                        setNewPassword(e.target.value)
                      }
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                )}

                {mode === "login" && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={remember}
                        onCheckedChange={(v) =>
                          setRemember(v === true)
                        }
                      />

                      Remember me
                    </label>

                    <button
                      type="button"
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setMessage(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-down">
                    {error}
                  </p>
                )}

                {message && (
                  <p className="text-sm text-green-600">
                    {message}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={busy}
                >
                  {busy && (
                    <Loader2 className="size-4 animate-spin" />
                  )}

                  {mode === "login" && "Sign in"}
                  {mode === "signup" && "Create account"}
                  {mode === "forgot" &&
                    "Send reset link"}
                  {mode === "reset" &&
                    "Update password"}
                </Button>
              </form>

              <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">
                {mode === "login" && (
                  <>
                    New to NextTrade?{" "}
                    <button
                      className="font-medium text-gold underline-offset-4 hover:underline"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                        setMessage(null);
                      }}
                    >
                      Create an account
                    </button>
                  </>
                )}

                {mode === "signup" && (
                  <>
                    Already have an account?{" "}
                    <button
                      className="font-medium text-gold underline-offset-4 hover:underline"
                      onClick={() => {
                        setMode("login");
                        setError(null);
                        setMessage(null);
                      }}
                    >
                      Sign in
                    </button>
                  </>
                )}

                {(mode === "forgot" ||
                  mode === "reset") && (
                  <button
                    className="font-medium text-gold underline-offset-4 hover:underline"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing you agree this is a demo platform
            with market data and virtual money only.
          </p>
        </div>
      </main>
    </div>
  );
}

