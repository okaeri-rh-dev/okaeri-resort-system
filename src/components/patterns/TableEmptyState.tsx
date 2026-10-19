import { Inbox, Search, TriangleAlert, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const variants: Record<
  "no-data" | "no-results" | "error",
  { icon: LucideIcon; className: string }
> = {
  "no-data": { icon: Inbox, className: "bg-muted text-muted-foreground" },
  "no-results": { icon: Search, className: "bg-muted text-muted-foreground" },
  error: { icon: TriangleAlert, className: "bg-danger text-danger-foreground" },
};

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface TableEmptyStateProps {
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** `no-data` for an empty list, `no-results` when filters hide everything, `error` when loading failed. */
  variant?: keyof typeof variants;
}

/**
 * The body of a table with no rows: an icon, a title, a line saying what to do, and up to two
 * actions.
 *
 * @example
 * ```tsx
 * <TableEmptyState
 *   variant="no-results"
 *   title="No bookings match"
 *   description="Try a different search or clear the filters."
 *   action={{ label: "Clear filters", onClick: clearFilters }}
 * />
 * ```
 */
export function TableEmptyState({
  title,
  description,
  action,
  secondaryAction,
  variant = "no-data",
}: TableEmptyStateProps) {
  const { icon: Icon, className } = variants[variant];

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div
        className={cn("mx-auto flex size-12 items-center justify-center rounded-full", className)}
      >
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-foreground mt-4 text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-4 flex items-center gap-2">
          {action && (
            <Button variant="outline" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
