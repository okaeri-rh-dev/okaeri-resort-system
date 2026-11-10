import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { flexRender, type Column, type Row, type RowData, type Table } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  Table as TablePrimitive,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { staleProps } from "./stale-props";
import { useContainerWidth } from "./useContainerWidth";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the generics must match TanStack's declaration to merge
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Cell and header alignment. Money and counts are `right`. */
    align?: "left" | "center" | "right";
    /** Sticks to the end edge when the table scrolls sideways, such as a row menu column. */
    pinned?: boolean;
    /** `low` columns all hide together while the full table is wider than its pane. */
    priority?: "low";
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
const TABLE_ROW_HEIGHT = 40;
const CARD_HEIGHT_ESTIMATE = 200;
const CARD_GAP = 16;

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
  /** Rows are a previous result while new ones load (`isPlaceholderData`): dims them and sets `aria-busy`. */
  isStale?: boolean;
  /**
   * Renders only the rows in view of the page's `<main>` scroller, for long lists. The table
   * header sticks to the top of `<main>`, so the table does not scroll sideways: its cells are
   * denser (8px a side), give it `priority: "low"` columns to fit slim panes, and it shows cards
   * when even the slim table does not fit. Pass `size="compact"` to its `StatusBadge`s.
   * `renderExpandedRow` is not supported.
   */
  virtualize?: boolean;
  /**
   * In table form, a click anywhere on a row that is not on a link or button. Mouse only: give
   * the row a link or button for keyboard users too.
   */
  onRowClick?: (row: Row<TData>) => void;
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
 * column so it stays in view when a slim pane scrolls the table sideways. Set
 * `meta: { priority: "low" }` on columns that can go when the full table does not fit, so the
 * pinned column does not cover data. Render `TablePagination`
 * after it when the table paginates; it applies to both forms. A long list sets `virtualize`
 * instead of paginating.
 *
 * Keep the table's `data` and `columns` stable across renders (`useMemo`, `useCallback` for the
 * handlers they close over). A new `data` array each render, such as `rows?.filter(...) ?? []`,
 * makes TanStack reset the page in a loop and freezes the screen. New `columns` remount every
 * cell, which closes an open row menu.
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
  isStale = false,
  virtualize = false,
  onRowClick,
  className,
}: DataTableProps<TData>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);
  const rows = table.getRowModel().rows;

  const tableRef = useRef<HTMLTableElement>(null);
  // The pane widths the full table and the slim one (low-priority columns hidden) need, stored
  // while that form shows so the decision does not flicker at the edge. Ids, not array identity:
  // some callers rebuild `columns` or `data` each render, which would loop.
  // shortcut: a same-id refetch with narrower content keeps the columns hidden until the pane
  // reaches the stored width; key on data identity once every caller memoizes `data`.
  const [tableFit, setTableFit] = useState<{
    columnAndRowIds: string;
    fullWidth?: number;
    slimWidth?: number;
  } | null>(null);
  const leafColumns = table.getAllLeafColumns();
  const hasLowPriority = leafColumns.some((column) => column.columnDef.meta?.priority === "low");
  const columnAndRowIds = [...leafColumns, ...rows].map(({ id }) => id).join(" ");
  const fit = tableFit?.columnAndRowIds === columnAndRowIds ? tableFit : null;
  const hideLowPriority = width !== null && hasLowPriority && width < (fit?.fullWidth ?? 0);
  // A virtualized table cannot scroll sideways, so one that does not fit even slim is cut off.
  const slimTableOverflows = virtualize && width !== null && width < (fit?.slimWidth ?? 0);
  const isCards = width !== null && (width < CARD_LAYOUT_MAX_WIDTH || slimTableOverflows);

  // The list's offset inside `<main>`: the page header and filters above it can change height.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const list = containerRef.current;
    const main = list?.closest("main");
    if (!virtualize || !list || !main) return;
    const offset =
      list.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
    if (offset !== scrollMargin) setScrollMargin(offset);
  });

  const virtualizer = useVirtualizer({
    enabled: virtualize && width !== null,
    count: virtualize ? rows.length : 0,
    getScrollElement: () => containerRef.current?.closest("main") ?? null,
    // Keyed by form too, so a card height is never reused as a row height.
    getItemKey: (index) => `${isCards ? "card" : "row"}:${rows[index]?.id ?? index}`,
    estimateSize: () => (isCards ? CARD_HEIGHT_ESTIMATE : TABLE_ROW_HEIGHT),
    gap: isCards ? CARD_GAP : 0,
    // Rendering ahead keeps fast scrolls filled, and a short list renders whole.
    overscan: 10,
    scrollMargin,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const shownRows = virtualize
    ? virtualItems.flatMap((item) => {
        const row = rows[item.index];
        return row ? [{ row, item }] : [];
      })
    : rows.map((row) => ({ row, item: undefined }));
  const headerRowCount = table.getHeaderGroups().length;
  const firstItem = virtualItems.at(0);
  const lastItem = virtualItems.at(-1);
  const topSpacer = firstItem ? firstItem.start - scrollMargin : 0;
  const bottomSpacer = lastItem ? virtualizer.getTotalSize() - (lastItem.end - scrollMargin) : 0;

  // Filtered here, not through TanStack's `columnVisibility`, which is the caller's state.
  const isShown = (column: Column<TData>) =>
    !(hideLowPriority && column.columnDef.meta?.priority === "low");

  // The table can grow with no render of its own (a late web font, say), so measure again then
  const [, remeasure] = useState(0);
  const showsTable = !isCards && width !== null;
  const measuresFit = hasLowPriority || virtualize;
  useEffect(() => {
    const tableElement = tableRef.current;
    if (!measuresFit || !showsTable || !tableElement) return;
    const observer = new ResizeObserver(() => remeasure((count) => count + 1));
    observer.observe(tableElement);
    return () => observer.disconnect();
  }, [measuresFit, showsTable]);

  useLayoutEffect(() => {
    // The `overflow-auto` div that the `Table` primitive wraps around `<table>`.
    const scroller = tableRef.current?.parentElement;
    if (!measuresFit || !scroller || width === null) return;

    const overflow = scroller.scrollWidth - scroller.clientWidth;
    if (overflow <= 0) return;
    const neededWidth = width + overflow;
    const isSlim = hideLowPriority || !hasLowPriority;
    const fullWidth = isSlim ? fit?.fullWidth : neededWidth;
    const slimWidth = virtualize && isSlim ? neededWidth : fit?.slimWidth;
    if (fit && fullWidth === fit.fullWidth && slimWidth === fit.slimWidth) return;
    setTableFit({ columnAndRowIds, fullWidth, slimWidth });
  });

  let content: ReactNode = null;
  if (isCards) {
    content =
      rows.length === 0 ? (
        emptyState
      ) : virtualize ? (
        <ul aria-label={label} className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {shownRows.map(({ row, item }) => (
            <li
              key={item?.key ?? row.id}
              ref={virtualizer.measureElement}
              data-index={item?.index}
              aria-setsize={rows.length}
              aria-posinset={(item?.index ?? 0) + 1}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${(item?.start ?? 0) - scrollMargin}px)` }}
            >
              {renderCard(row)}
            </li>
          ))}
        </ul>
      ) : (
        <ul aria-label={label} className="space-y-4">
          {rows.map((row) => (
            <li key={row.id}>{renderCard(row)}</li>
          ))}
        </ul>
      );
  } else if (width !== null) {
    content = (
      <div
        className={cn(
          "border-border bg-card rounded-md border",
          // A scroll box would trap the sticky header; clip keeps the rounded corners without one.
          virtualize ? "overflow-clip [&>div]:overflow-visible" : "overflow-hidden"
        )}
      >
        <TablePrimitive
          ref={tableRef}
          aria-label={label}
          aria-rowcount={virtualize ? headerRowCount + rows.length : undefined}
          className="tabular-nums"
        >
          <TableHeader className={cn("bg-muted", virtualize && "sticky top-0 z-20")}>
            {table.getHeaderGroups().map((headerGroup, headerIndex) => (
              <TableRow
                key={headerGroup.id}
                aria-rowindex={virtualize ? headerIndex + 1 : undefined}
                className="hover:bg-transparent"
              >
                {headerGroup.headers
                  .filter((header) => isShown(header.column))
                  .map((header) => (
                    <TableHead
                      key={header.id}
                      style={{
                        textAlign: header.column.columnDef.meta?.align,
                        width:
                          header.column.columnDef.size === undefined ? undefined : header.getSize(),
                      }}
                      className={cn(
                        "h-10 text-xs tracking-wide uppercase",
                        virtualize && "px-2",
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
            {topSpacer > 0 && <tr aria-hidden="true" style={{ height: topSpacer }} />}
            {shownRows.map(({ row, item }) => {
              const cells = row.getVisibleCells().filter((cell) => isShown(cell.column));
              return (
                <Fragment key={item?.key ?? row.id}>
                  <TableRow
                    ref={item ? virtualizer.measureElement : undefined}
                    data-index={item?.index}
                    aria-rowindex={item ? headerRowCount + item.index + 1 : undefined}
                    onClick={
                      onRowClick &&
                      ((event) => {
                        const target = event.target as Element;
                        // Clicks inside a menu portal bubble through React too, so check the DOM.
                        if (!event.currentTarget.contains(target)) return;
                        if (target.closest("a, button, input, select, textarea, [role=menuitem]"))
                          return;
                        onRowClick(row);
                      })
                    }
                    className={cn("group h-10 duration-150", onRowClick && "cursor-pointer")}
                  >
                    {cells.map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{ textAlign: cell.column.columnDef.meta?.align }}
                        className={cn(
                          "text-foreground py-2 text-sm",
                          virtualize ? "px-2" : "px-4",
                          cell.column.columnDef.meta?.pinned && pinnedCell
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {!virtualize && renderExpandedRow && row.getIsExpanded() && (
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell colSpan={cells.length} className="p-0">
                        {renderExpandedRow(row)}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {bottomSpacer > 0 && <tr aria-hidden="true" style={{ height: bottomSpacer }} />}
          </TableBody>
        </TablePrimitive>
        {rows.length === 0 && emptyState ? <div className="p-8">{emptyState}</div> : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} {...staleProps(isStale, "w-full min-w-0", className)}>
      {content}
    </div>
  );
}
