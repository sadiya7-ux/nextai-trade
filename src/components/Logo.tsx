import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  tagline?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: "size-7", word: "text-base" },
  md: { box: "size-9", word: "text-xl" },
  lg: { box: "size-14", word: "text-3xl" },
} as const;

/** NextTrade logo: compact N/arrow icon + white/gold wordmark. */
export function Logo({ size = "md", withWordmark = true, tagline = false, className }: LogoProps) {
  const s = SIZES[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img src={logo} alt="NextTrade" className={cn(s.box, "rounded-lg")} />
      {withWordmark && (
        <div className="flex flex-col leading-none">
          <span className={cn(s.word, "font-bold tracking-tight")}>
            <span className="text-foreground">Next</span>
            <span className="text-gold">Trade</span>
          </span>
          {tagline && (
            <span className="mt-1 text-[9px] font-medium tracking-[0.28em] text-muted-foreground">
              TRADE SMARTER. STAY AHEAD.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
