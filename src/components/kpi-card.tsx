import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/format";
import type { ReactNode } from "react";

interface KPICardProps {
  label: string;
  value: number | string;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive";
  currency?: boolean;
  icon?: ReactNode;
}

export function KPICard({ label, value, hint, tone = "default", currency = true, icon }: KPICardProps) {
  const display = currency && typeof value === "number" ? formatPKR(value) : value;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className={cn(
        "mt-2 font-display text-2xl font-semibold tabular-nums",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning-foreground",
        tone === "destructive" && "text-destructive",
      )}>
        {display}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
