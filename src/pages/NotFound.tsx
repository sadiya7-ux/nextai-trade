import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <Logo size="lg" tagline />
      <p className="mt-10 font-mono text-7xl font-bold text-gold">404</p>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
