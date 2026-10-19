import { useId, useState, type ReactNode } from "react";

import { ChevronDown, Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  /** Usually a `TableSearch`. */
  search: ReactNode;
  /** The filter controls, usually `FilterPopover`s. */
  filters: ReactNode;
  /** Shown on the Filters toggle when the bar is narrow. */
  activeFilterCount?: number;
  /** Shows a Clear filters button. Pass it only while something is filtered. */
  onClearFilters?: () => void;
  /** A result count or similar, beside the actions. */
  summary?: ReactNode;
  /** Bar-level commands such as Export CSV. */
  actions?: ReactNode;
  /** Placement only. */
  className?: string;
}

/**
 * The toolbar above a list: search, filters, a summary and actions. It follows its own width:
 * from 48rem the filters sit inline; narrower, they fold behind a Filters toggle that shows how
 * many are active, so product code never branches on width.
 *
 * @example
 * ```tsx
 * <FilterBar
 *   search={<TableSearch value={query} onChange={setQuery} placeholder="Search bookings" />}
 *   filters={<><StatusFilter /><DateFilter /></>}
 *   activeFilterCount={2}
 *   onClearFilters={hasFilters ? resetFilters : undefined}
 *   summary={<span>12 bookings</span>}
 *   actions={<Button variant="outline" size="sm">Export CSV</Button>}
 * />
 * ```
 */
export function FilterBar({
  search,
  filters,
  activeFilterCount = 0,
  onClearFilters,
  summary,
  actions,
  className,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const groupId = useId();

  return (
    <div className={cn("@container", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 @3xl:w-64 @3xl:flex-none">{search}</div>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={groupId}
          aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : undefined}
          onClick={() => setOpen(!open)}
          className="@3xl:hidden"
        >
          <Filter className="size-4" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs font-semibold tabular-nums">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={cn("size-3 transition-transform duration-150", open && "rotate-180")}
            aria-hidden="true"
          />
        </Button>
        <div
          id={groupId}
          className={cn(
            "grid w-full grid-cols-2 gap-2 @3xl:flex @3xl:w-auto @3xl:flex-wrap @3xl:items-center",
            !open && "@max-3xl:hidden"
          )}
        >
          {filters}
          {onClearFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="size-3" aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>
        {(summary || actions) && (
          <div className="flex w-full items-center justify-between gap-2 @3xl:ml-auto @3xl:w-auto">
            {summary}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
