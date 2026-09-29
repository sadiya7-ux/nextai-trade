import { useId } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  up?: boolean;
  className?: string;
  strokeWidth?: number;
}

/** Minimal, dependency-free SVG sparkline with soft gradient fill. */
export function Sparkline({ data, up = true, className, strokeWidth = 1.6 }: SparklineProps) {
  const gradientId = useId();
  if (data.length < 2) return null;

  const w = 100;
  const h = 30;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 3 - ((v - min) / span) * (h - 6);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const color = up ? "var(--up)" : "var(--down)";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
