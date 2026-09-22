import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Wraps an edit page while its record loads, so each route doesn't repeat the
 * loading / missing / failed states.
 */
export function RecordLoader<T>({
  query,
  backTo,
  backLabel,
  missingLabel,
  children,
}: {
  query: UseQueryResult<T | null>;
  backTo: string;
  backLabel: string;
  /** Used in the "we couldn't find this X" message. */
  missingLabel: string;
  children: (row: T) => ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const failed = query.isError;
    return (
      <div className="panel mx-auto mt-10 max-w-md p-8 text-center">
        <h1 className="font-display text-lg font-semibold">
          {failed ? "Couldn't load this " + missingLabel : "This " + missingLabel + " no longer exists"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {failed
            ? (query.error as any)?.message || "Something went wrong fetching the record."
            : "It may have been deleted by someone else."}
        </p>
        <Button asChild className="mt-6 gap-1.5">
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" /> Back to {backLabel}
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children(query.data)}</>;
}
