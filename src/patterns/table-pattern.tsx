import { memo, useCallback, useState, type ReactNode } from "react";

import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { DataFetchingWrapper } from "./data-fetching-pattern";

export interface Column<T> {
  key: string;
  header: string;
  accessor: (item: T) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  className?: string;
}

interface TableWrapperProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  keyExtractor: (item: T, index: number) => string | number;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onRowClick?: (item: T) => void;
  actions?: (item: T) => ReactNode;
  emptyMessage?: string;
  className?: string;
}

/**
 * Reusable table wrapper with sorting, loading states, and error handling
 */
export function TableWrapper<T>({
  data,
  columns,
  isLoading,
  isError,
  error,
  keyExtractor,
  onSort,
  sortKey,
  sortDirection,
  onRowClick,
  actions,
  emptyMessage = "No data available",
  className,
}: TableWrapperProps<T>) {
  const handleSort = useCallback(
    (key: string) => {
      if (!onSort) return;

      const newDirection = sortKey === key && sortDirection === "asc" ? "desc" : "asc";
      onSort(key, newDirection);
    },
    [onSort, sortKey, sortDirection]
  );

  return (
    <DataFetchingWrapper
      data={data}
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={(d) => d.length === 0}
      emptyComponent={
        <div className="py-12 text-center">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      }
    >
      {(items) => (
        <ErrorBoundary level="component">
          <div className={cn("overflow-x-auto", className)}>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(
                        column.className,
                        column.sortable && "cursor-pointer select-none"
                      )}
                      style={{ width: column.width }}
                      onClick={() => column.sortable && handleSort(column.key)}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          column.align === "center" && "justify-center",
                          column.align === "right" && "justify-end"
                        )}
                      >
                        {column.header}
                        {column.sortable &&
                          sortKey === column.key &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </TableHead>
                  ))}
                  {actions && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <MemoizedTableRow
                    key={keyExtractor(item, index)}
                    item={item as unknown}
                    columns={columns as unknown as Column<unknown>[]}
                    onClick={() => onRowClick?.(item)}
                    actions={actions as unknown as ((item: unknown) => ReactNode) | undefined}
                    clickable={!!onRowClick}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </ErrorBoundary>
      )}
    </DataFetchingWrapper>
  );
}

/**
 * Memoized table row for performance optimization
 */
const MemoizedTableRow = memo(
  function TableRowComponent<T>({
    item,
    columns,
    onClick,
    actions,
    clickable,
  }: {
    item: T;
    columns: Column<T>[];
    onClick?: () => void;
    actions?: (item: T) => ReactNode;
    clickable?: boolean;
  }) {
    return (
      <TableRow onClick={onClick} className={cn(clickable && "cursor-pointer hover:bg-gray-50")}>
        {columns.map((column) => (
          <TableCell
            key={column.key}
            className={cn(
              column.className,
              column.align === "center" && "text-center",
              column.align === "right" && "text-right"
            )}
          >
            {column.accessor(item)}
          </TableCell>
        ))}
        {actions && <TableCell>{actions(item)}</TableCell>}
      </TableRow>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for better performance
    return Object.is(prevProps.item, nextProps.item) && prevProps.clickable === nextProps.clickable;
  }
);

interface ActionMenuProps {
  actions: Array<{
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    destructive?: boolean;
    disabled?: boolean;
  }>;
}

/**
 * Standard action menu for table rows
 */
export function TableActionMenu({ actions }: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded p-1 hover:bg-gray-100">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(action.destructive && "text-red-600 focus:bg-red-50")}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface VirtualizedTableProps<T> extends Omit<TableWrapperProps<T>, "data"> {
  data: T[];
  itemHeight: number;
  containerHeight: number;
}

/**
 * Virtualized table for large datasets
 * Uses windowing technique for performance
 */
export function VirtualizedTable<T>({
  data,
  columns,
  itemHeight,
  containerHeight,
  ...props
}: VirtualizedTableProps<T>) {
  // Simple virtualization - can be enhanced with react-window
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, data.length);
  const visibleData = data.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      className="relative overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: data.length * itemHeight }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          <TableWrapper
            {...props}
            data={visibleData}
            columns={columns}
            isLoading={false}
            isError={false}
          />
        </div>
      </div>
    </div>
  );
}
