/**
 * Optimized Table Components with React.memo
 * Performance-optimized wrappers for table components
 */

import React, { memo, useCallback, useMemo } from "react";
import type { ReactNode } from "react";

// ============================================
// MEMOIZED TABLE ROW COMPONENT
// ============================================

interface TableRowProps<T> {
  item: T;
  columns: Array<{
    key: string;
    header: string;
    accessor: (item: T) => ReactNode;
  }>;
  onRowClick?: (item: T) => void;
  rowClassName?: string;
  getRowKey: (item: T) => string;
}

/**
 * Memoized table row component with deep comparison
 * Prevents unnecessary re-renders when parent state changes
 */
export const MemoizedTableRow = memo(
  <T extends Record<string, unknown>>({
    item,
    columns,
    onRowClick,
    rowClassName = "",
    getRowKey,
  }: TableRowProps<T>) => {
    const handleClick = useCallback(() => {
      if (onRowClick) {
        onRowClick(item);
      }
    }, [item, onRowClick]);

    const rowKey = getRowKey(item);

    return (
      <tr
        key={rowKey}
        onClick={handleClick}
        className={`hover:bg-gray-50 transition-colors ${rowClassName} ${
          onRowClick ? "cursor-pointer" : ""
        }`}
      >
        {columns.map((column) => (
          <td key={`${rowKey}-${column.key}`} className="px-4 py-3 text-sm text-gray-900">
            {column.accessor(item)}
          </td>
        ))}
      </tr>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for deep equality check
    const prevKey = prevProps.getRowKey(prevProps.item);
    const nextKey = nextProps.getRowKey(nextProps.item);

    if (prevKey !== nextKey) return false;

    // Check if the item data has changed (shallow comparison)
    const prevItemStr = JSON.stringify(prevProps.item);
    const nextItemStr = JSON.stringify(nextProps.item);

    return (
      prevItemStr === nextItemStr &&
      prevProps.rowClassName === nextProps.rowClassName &&
      prevProps.columns.length === nextProps.columns.length
    );
  }
);

MemoizedTableRow.displayName = "MemoizedTableRow";

// ============================================
// MEMOIZED TABLE COMPONENT
// ============================================

interface OptimizedTableProps<T> {
  data: T[];
  columns: Array<{
    key: string;
    header: string;
    accessor: (item: T) => ReactNode;
    sortable?: boolean;
  }>;
  onRowClick?: (item: T) => void;
  getRowKey: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  onSort?: (column: string, direction: "asc" | "desc") => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
}

/**
 * Optimized table component with virtualization support
 * Memoizes data processing and prevents unnecessary re-renders
 */
export const OptimizedTable = memo(
  <T extends Record<string, unknown>>({
    data,
    columns,
    onRowClick,
    getRowKey,
    isLoading = false,
    emptyMessage = "No data available",
    className = "",
    onSort,
    sortColumn,
    sortDirection,
  }: OptimizedTableProps<T>) => {
    // Memoize processed data
    const processedData = useMemo(() => {
      return data || [];
    }, [data]);

    // Memoize column headers
    const headers = useMemo(() => {
      return columns.map((column) => (
        <th
          key={column.key}
          className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
            column.sortable ? "cursor-pointer hover:text-gray-700" : ""
          }`}
          onClick={() => {
            if (column.sortable && onSort) {
              const newDirection =
                sortColumn === column.key && sortDirection === "asc" ? "desc" : "asc";
              onSort(column.key, newDirection);
            }
          }}
        >
          <div className="flex items-center gap-1">
            {column.header}
            {column.sortable && sortColumn === column.key && (
              <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
            )}
          </div>
        </th>
      ));
    }, [columns, onSort, sortColumn, sortDirection]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      );
    }

    if (processedData.length === 0) {
      return <div className="text-center py-8 text-gray-500">{emptyMessage}</div>;
    }

    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>{headers}</tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedData.map((item) => (
              <MemoizedTableRow
                key={getRowKey(item)}
                item={item}
                columns={columns}
                onRowClick={onRowClick}
                getRowKey={getRowKey}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

OptimizedTable.displayName = "OptimizedTable";

// ============================================
// VIRTUALIZED TABLE FOR LARGE DATASETS
// ============================================

interface VirtualizedTableProps<T> extends OptimizedTableProps<T> {
  rowHeight?: number;
  visibleRows?: number;
}

/**
 * Virtualized table component for handling large datasets
 * Only renders visible rows for maximum performance
 */
export const VirtualizedTable = memo(
  <T extends Record<string, unknown>>({
    data,
    rowHeight = 48,
    visibleRows = 20,
    ...props
  }: VirtualizedTableProps<T>) => {
    const [scrollTop, setScrollTop] = React.useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }, []);

    const { startIndex, endIndex, topPadding, bottomPadding } = useMemo(() => {
      const start = Math.floor(scrollTop / rowHeight);
      const end = Math.min(start + visibleRows + 1, data.length);

      return {
        startIndex: start,
        endIndex: end,
        topPadding: start * rowHeight,
        bottomPadding: (data.length - end) * rowHeight,
      };
    }, [scrollTop, rowHeight, visibleRows, data.length]);

    const visibleData = useMemo(() => {
      return data.slice(startIndex, endIndex);
    }, [data, startIndex, endIndex]);

    return (
      <div
        ref={containerRef}
        className="overflow-auto"
        style={{ height: visibleRows * rowHeight }}
        onScroll={handleScroll}
      >
        <div style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
          <OptimizedTable {...props} data={visibleData} />
        </div>
      </div>
    );
  }
);

VirtualizedTable.displayName = "VirtualizedTable";

// ============================================
// HOOKS FOR TABLE OPTIMIZATION
// ============================================

/**
 * Hook for managing table sorting state
 */
export function useTableSort<T>(
  data: T[],
  defaultSortColumn?: string,
  defaultSortDirection: "asc" | "desc" = "asc"
) {
  const [sortColumn, setSortColumn] = React.useState(defaultSortColumn);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(defaultSortDirection);

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aValue = (a as any)[sortColumn];
      const bValue = (b as any)[sortColumn];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  const handleSort = useCallback((column: string, direction: "asc" | "desc") => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  return {
    sortedData,
    sortColumn,
    sortDirection,
    handleSort,
  };
}

/**
 * Hook for managing table pagination
 */
export function useTablePagination<T>(data: T[], itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return data.slice(start, end);
  }, [data, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(data.length / itemsPerPage);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  return {
    paginatedData,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
  };
}
