import { Fragment, useRef, type ReactNode } from "react";

import { flexRender, type Row, type RowData, type Table } from "@tanstack/react-table";

import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  Table as TablePrimitive,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { useContainerWidth } from "./useContainerWidth";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the generics must match TanStack's declaration to merge
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Cell and header alignment. Money and counts are `right`. */
    align?: "left" | "center" | "right";
    /** Sticks to the end edge when the table scrolls sideways, such as a row menu column. */
    pinned?: boolean;
  }
}

// Collapsed table borders don't move with a sticky cell, so the divider is an inset shadow. The
// hover tint is translucent, so it layers over the card fill to keep content from showing through.
const pinnedDivider = "sticky right-0 z-10 shadow-[inset_1px_0_0_var(--border)]";
const pinnedHead = cn(pinnedDivider, "bg-muted");
const pinnedCell = cn(
  pinnedDivider,
  "bg-card group-hover:bg-linear-to-r group-hover:from-muted/50 group-hover:to-muted/50"
);

/** Below this pane width the rows render as cards (the M3 compact class). */
const CARD_LAYOUT_MAX_WIDTH = 600;

export interface DataTableProps<TData> {
  /** A TanStack table. Its row model (sorted, filtered, paginated) is what both forms render. */
  table: Table<TData>;
  /** One row as a card, for panes narrower than ~600px. Usually a `ListCard`. */
  renderCard: (row: Row<TData>) => ReactNode;
  /** Accessible name for the table and for the card list. */
  label: string;
  /** Shown when the row model is empty: below the headers as a table, alone as cards. */
  emptyState?: ReactNode;
  /** In table form, a full-width row under each expanded row (`row.getIsExpanded()`). */
  renderExpandedRow?: (row: Row<TData>) => ReactNode;
  /** Placement only. */
  className?: string;
}

/**
 * A list of records that is a table in a wide pane and a stack of cards in a narrow one. It
 * measures its own width, so it reads well on a phone and in a narrow side pane alike; product
 * code passes a card renderer and never branches on width. One form renders at a time.
 *
 * Rows are 40px with tabular figures. Set `meta: { align: "right" }` on money and count columns,
 * and format money with `formatCurrency` (`₱2,500.00`). Set `meta: { pinned: true }` on a row menu
 * column so it stays in view when a slim pane scrolls the table sideways. Render `TablePagination`
 * after it when the table paginates; it applies to both forms.
 *
 * @example
 * ```tsx
 * <DataTable
 *   table={table}
 *   label="Bookings"
 *   renderCard={(row) => <BookingCard booking={row.original} />}
 *   emptyState={<TableEmptyState title="No bookings yet" />}
 * />
 * ```
 */
export function DataTable<TData>({
  table,
  renderCard,
  label,
  emptyState,
  renderExpandedRow,
  className,
}: DataTableProps<TData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);
  const rows = table.getRowModel().rows;

  let content: ReactNode = null;
  if (width !== null && width < CARD_LAYOUT_MAX_WIDTH) {
    content =
      rows.length === 0 ? (
        emptyState
      ) : (
        <ul aria-label={label} className="space-y-4">
          {rows.map((row) => (
            <li key={row.id}>{renderCard(row)}</li>
          ))}
        </ul>
      );
  } else if (width !== null) {
    content = (
      <div className="border-border bg-card overflow-hidden rounded-md border">
        <TablePrimitive aria-label={label} className="tabular-nums">
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      textAlign: header.column.columnDef.meta?.align,
                      width:
                        header.column.columnDef.size === undefined ? undefined : header.getSize(),
                    }}
                    className={cn(
                      "h-10 text-xs tracking-wide uppercase",
                      header.column.columnDef.meta?.pinned && pinnedHead
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow className="group h-10 duration-150">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{ textAlign: cell.column.columnDef.meta?.align }}
                      className={cn(
                        "text-foreground px-4 py-2 text-sm",
                        cell.column.columnDef.meta?.pinned && pinnedCell
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {renderExpandedRow && row.getIsExpanded() && (
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={row.getVisibleCells().length} className="p-0">
                      {renderExpandedRow(row)}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </TablePrimitive>
        {rows.length === 0 && emptyState ? <div className="p-8">{emptyState}</div> : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("w-full min-w-0", className)}>
      {content}
    </div>
  );
}
