import type * as React from "react";

import { cn } from "@/lib/utils";

const titleSize = {
  admin: "text-2xl",
  guest: "text-3xl",
} as const;

export interface PageHeaderProps {
  /** The page's `h1`. */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Sits beside the title, such as a `StatusBadge`. */
  status?: React.ReactNode;
  /** Page-level actions, grouped and labelled "Page actions". */
  actions?: React.ReactNode;
  /** Admin page titles are display 2xl/600; guest page titles are display 3xl/600 (DESIGN.md, Type). */
  surface?: keyof typeof titleSize;
  /** Placement only (margin). */
  className?: string;
}

/**
 * The title block at the top of a page: an `h1` in the display face, an optional status beside
 * it, a description below and page actions to the side (wrapping under the title when narrow).
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="Payments"
 *   description="Downpayments and balances."
 *   actions={<Button>Record payment</Button>}
 * />
 * ```
 */
export function PageHeader({
  title,
  description,
  status,
  actions,
  surface = "admin",
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className={cn(
              "font-display text-foreground font-semibold tracking-tight break-words",
              titleSize[surface]
            )}
          >
            {title}
          </h1>
          {status}
        </div>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && (
        <div role="group" aria-label="Page actions" className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
