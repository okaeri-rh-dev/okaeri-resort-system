import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const columnWidths = ["w-28", "w-48", "w-24", "w-28", "w-20"];
const columnWidth = (index: number, count: number) =>
  index === count - 1 ? "w-16" : columnWidths[index % columnWidths.length];

function ToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="ml-auto h-8 w-24" />
    </div>
  );
}

function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <Skeleton className="h-4 w-40" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="size-9" />
        ))}
      </div>
    </div>
  );
}

function RowsSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-md border">
      <div className="border-border bg-muted flex h-10 items-center gap-4 border-b px-4">
        {Array.from({ length: columns }, (_, column) => (
          <Skeleton key={column} className={cn("h-3", columnWidth(column, columns))} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="border-border flex h-14 items-center gap-4 border-b px-4 last:border-b-0"
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={cn("h-4", columnWidth(column, columns))} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, card) => (
        <div key={card} className="border-border bg-card space-y-3 rounded-xl border p-4">
          <div className="flex items-start justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          {Array.from({ length: columns }, (_, line) => (
            <div key={line} className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  /** `cards` matches a list shown as cards on a narrow pane. */
  layout?: "table" | "cards";
  /** Adds a search and filter bar above. */
  toolbar?: boolean;
  /** Adds a pagination bar below. */
  pagination?: boolean;
  /** What screen readers hear while it shows. */
  label?: string;
  /** Placement only. */
  className?: string;
}

/**
 * The loading state of a table or list, shaped like the final layout so nothing jumps when the
 * data arrives. It is a polite `status` region named by `label`.
 *
 * @example
 * ```tsx
 * if (isLoading) return <TableSkeleton rows={8} columns={7} toolbar pagination label="Loading bookings" />;
 * ```
 */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  layout = "table",
  toolbar = false,
  pagination = false,
  label = "Loading",
  className,
}: TableSkeletonProps) {
  return (
    <div role="status" aria-label={label} className={cn("space-y-4", className)}>
      <div aria-hidden="true" className="space-y-4">
        {toolbar && <ToolbarSkeleton />}
        {layout === "cards" ? (
          <CardsSkeleton rows={rows} columns={columns} />
        ) : (
          <RowsSkeleton rows={rows} columns={columns} />
        )}
        {pagination && <PaginationSkeleton />}
      </div>
    </div>
  );
}
