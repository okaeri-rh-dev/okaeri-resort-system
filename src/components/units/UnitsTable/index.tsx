import { useCallback } from "react";
import { flexRender } from "@tanstack/react-table";
import { withErrorBoundary } from "@/components/ErrorBoundary";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination, TableEmptyState } from "@/components/tables/utils";
import { UnitsTableSkeleton } from "@/components/skeletons";
import { useResponsiveView } from "@/hooks";
import { TableHeader as TableHeaderControls } from "./components/TableHeader";
import { useUnitsTable } from "./hooks/useUnitsTable";
import { exportUnitsToCSV } from "./utils/export";
import { cn } from "@/lib/utils";
import type { UnitsTableProps } from "./types";

/**
 * UnitsTable Component
 *
 * A modular, feature-rich table for managing resort units with:
 * - Inline editing capabilities
 * - Batch operations
 * - Advanced filtering and search
 * - Export functionality
 * - Responsive design
 * - Error boundaries
 *
 * Total lines: ~150 (down from 854)
 */
function UnitsTableComponent({ onAddUnit, pageSize = 10, className }: UnitsTableProps = {}) {
  const {
    table,
    units,
    isLoading,
    error,
    globalFilter,
    setGlobalFilter,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    isEditMode,
    setIsEditMode,
    selectedCount,
    handleBatchStatusUpdate,
  } = useUnitsTable({ pageSize, onAddUnit });

  useResponsiveView(); // Used for responsive table rendering

  const handleExport = useCallback(() => {
    exportUnitsToCSV(units);
  }, [units]);

  // Loading state
  if (isLoading) {
    return <UnitsTableSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-600">Error loading units: {error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          Retry
        </button>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Table Header with filters and actions */}
      <TableHeaderControls
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        isEditMode={isEditMode}
        onEditModeToggle={() => setIsEditMode(!isEditMode)}
        onExport={handleExport}
        onAddNew={onAddUnit}
        selectedCount={selectedCount}
        onBatchStatusUpdate={handleBatchStatusUpdate}
      />

      {/* Table Content */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      row.getIsSelected() && "bg-blue-50",
                      "hover:bg-gray-50 transition-colors"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getAllColumns().length} className="h-24">
                    <TableEmptyState
                      title="No units found"
                      description="Add your first unit to get started"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="border-t px-4 py-3">
          <TablePagination table={table} totalItems={units.length} />
        </div>
      </Card>
    </div>
  );
}

// Export with error boundary
export const UnitsTable = withErrorBoundary(UnitsTableComponent, {
  level: "component",
  fallback: (
    <Card className="p-8 text-center">
      <p className="text-red-600 mb-4">Failed to load units table</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
      >
        Reload Page
      </button>
    </Card>
  ),
});

// Re-export types and utilities
export type { UnitsTableProps } from "./types";
export { useUnitsTable } from "./hooks/useUnitsTable";
export { exportUnitsToCSV } from "./utils/export";
