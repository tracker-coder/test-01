import type { FormEvent, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/format";

/** A titled panel — one visual block per step of the invoice. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel p-5", className)}>
      <div className="mb-4">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** One label/value line inside the totals panel. */
export function SummaryRow({
  label,
  value,
  negative = false,
  strong = false,
}: {
  label: string;
  value: number | string;
  negative?: boolean;
  strong?: boolean;
}) {
  const text = typeof value === "number" ? formatPKR(value) : value;
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 text-sm",
        strong && "border-t pt-2.5 text-base font-semibold",
      )}
    >
      <span className={cn(!strong && "text-muted-foreground")}>{label}</span>
      <span className="tabular-nums">
        {negative && typeof value === "number" && value > 0 ? "−" : ""}
        {text}
      </span>
    </div>
  );
}

interface ShellProps {
  backTo: string;
  backLabel: string;
  title: string;
  description?: string;
  /** Contents of the sticky totals panel. */
  summary: ReactNode;
  /** The figure repeated in the mobile action bar. */
  totalLabel?: string;
  total: number;
  saveLabel: string;
  saving?: boolean;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}

/**
 * Full-page invoice editor layout.
 *
 * Replaces the old modal: the form gets the whole page, and the totals sit in a
 * panel that stays in view while items are added. On phones the panel drops
 * below the form and a compact action bar keeps the total and Save reachable.
 */
export function InvoiceFormShell({
  backTo, backLabel, title, description, summary,
  totalLabel = "Net total", total, saveLabel, saving = false, onSubmit, children,
}: ShellProps) {
  return (
    <form onSubmit={onSubmit} className="pb-24 sm:pb-0">
      <div className="mb-6 border-b pb-4">
        <Link
          to={backTo}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {backLabel}
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight">
              {title}
            </h1>
            {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
          </div>

          {/* Desktop actions; the mobile equivalent lives in the bottom bar. */}
          <div className="hidden items-center gap-2 sm:flex">
            <Button type="button" variant="ghost" asChild>
              <Link to={backTo}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : saveLabel}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-5">{children}</div>

        <aside className="w-full shrink-0 lg:w-[20rem]">
          <div className="panel p-5 lg:sticky lg:top-[5.5rem]">
            <h2 className="font-display text-base font-semibold">Summary</h2>
            <div className="mt-4 space-y-2.5">{summary}</div>
            <Button type="submit" disabled={saving} className="mt-5 hidden w-full lg:inline-flex">
              {saving ? "Saving…" : saveLabel}
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile action bar — total always visible, Save always reachable. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-surface/95 px-4 py-3 backdrop-blur-md sm:hidden">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {totalLabel}
          </div>
          <div className="truncate font-display text-lg font-semibold tabular-nums">
            {formatPKR(total)}
          </div>
        </div>
        <Button type="submit" disabled={saving} className="shrink-0">
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </form>
  );
}
