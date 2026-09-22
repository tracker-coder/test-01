import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/format";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "destructive" | "info";

interface KPICardProps {
  label: string;
  value: number | string;
  hint?: ReactNode;
  tone?: Tone;
  currency?: boolean;
  icon?: ReactNode;
  /** Percentage change vs the previous period. Positive renders up, negative down. */
  delta?: number | null;
  /** Dims the card and shows a placeholder bar while data loads. */
  loading?: boolean;
}

const TONE_ICON: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/12 text-info",
};

const TONE_VALUE: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-foreground",
  destructive: "text-destructive",
  info: "text-info",
};

export function KPICard({
  label,
  value,
  hint,
  tone = "default",
  currency = true,
  icon,
  delta,
  loading = false,
}: KPICardProps) {
  const display = currency && typeof value === "number" ? formatPKR(value) : value;
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const up = hasDelta && delta! >= 0;

  return (
    <div className="panel group p-4 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              TONE_ICON[tone],
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-3 h-7 w-24 animate-pulse rounded-md bg-muted" />
      ) : (
        <div
          className={cn(
            "mt-2 font-display text-xl font-semibold leading-tight tabular-nums sm:text-[1.6rem]",
            TONE_VALUE[tone],
          )}
        >
          {display}
        </div>
      )}

      {(hint || hasDelta) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {hasDelta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                up ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {up ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {up ? "+" : ""}
              {delta!.toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}
