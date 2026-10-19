import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const MAX_PAGE_BUTTONS = 5;

function visiblePageIndexes(pageIndex: number, pageCount: number): number[] {
  const count = Math.min(pageCount, MAX_PAGE_BUTTONS);
  const firstIndex =
    pageCount <= MAX_PAGE_BUTTONS || pageIndex < 3
      ? 0
      : pageIndex > pageCount - 4
        ? pageCount - MAX_PAGE_BUTTONS
        : pageIndex - 2;
  return Array.from({ length: count }, (_, offset) => firstIndex + offset);
}

export interface TablePaginationProps<TData> {
  table: Table<TData>;
  totalItems?: number;
}

/**
 * Pagination for a TanStack table: a "Showing x to y of z results" summary, previous and next
 * buttons and up to five page buttons around the current page.
 *
 * @example
 * ```tsx
 * <TablePagination table={table} totalItems={bookings.length} />
 * ```
 */
export function TablePagination<TData>({ table, totalItems = 0 }: TablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const startItem = totalItems === 0 ? 0 : pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className="border-border bg-card flex items-center justify-between gap-2 border-t px-4 py-3"
    >
      <p className="text-muted-foreground text-sm tabular-nums">
        Showing {startItem} to {endItem} of {totalItems} results
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>

        <div className="flex items-center gap-1">
          {visiblePageIndexes(pageIndex, table.getPageCount()).map((index) => (
            <Button
              key={index}
              variant={index === pageIndex ? "default" : "outline"}
              size="icon"
              onClick={() => table.setPageIndex(index)}
              aria-label={`Page ${index + 1}`}
              aria-current={index === pageIndex ? "page" : undefined}
              className="tabular-nums"
            >
              {index + 1}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
