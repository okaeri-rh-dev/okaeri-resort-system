import { useCallback } from "react";

import { flexRender } from "@tanstack/react-table";

import { withErrorBoundary } from "@/components/ErrorBoundary";
import { TableEmptyState, TablePagination, TableSkeleton } from "@/components/patterns";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResponsiveView } from "@/hooks";
import { cn } from "@/lib/utils";

import { TableHeader as TableHeaderControls } from "./components/TableHeader";
import { useUnitsTable } from "./hooks/useUnitsTable";
import type { UnitsTableProps } from "./types";
import { exportUnitsToCSV } from "./utils/export";

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
function UnitsTableComponent({
  onAddUnit,
  onViewUnit,
  onEditUnit,
  pageSize = 10,
  className,
}: UnitsTableProps = {}) {
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
  } = useUnitsTable({ pageSize, onAddUnit, onViewUnit, onEditUnit });

  useResponsiveView(); // Used for responsive table rendering

  const handleExport = useCallback(() => {
    void exportUnitsToCSV(units);
  }, [units]);

  // Loading state
  if (isLoading) {
    return <TableSkeleton rows={6} columns={9} toolbar label="Loading cabins" />;
  }

  // Error state
  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-600">Error loading units: {error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary hover:bg-primary/90 mt-4 rounded px-4 py-2 text-white"
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
                      "transition-colors hover:bg-gray-50"
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
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <TablePagination table={table as any} totalItems={units.length} />
        </div>
      </Card>
    </div>
  );
}

// Export with error boundary - explicitly typed to preserve props
export const UnitsTable = withErrorBoundary(UnitsTableComponent, {
  level: "component",
  fallback: (
    <Card className="p-8 text-center">
      <p className="mb-4 text-red-600">Failed to load units table</p>
      <button
        onClick={() => window.location.reload()}
        className="bg-primary hover:bg-primary/90 rounded px-4 py-2 text-white"
      >
        Reload Page
      </button>
    </Card>
  ),
}) as React.ComponentType<UnitsTableProps>;

// Types are exported directly from types file when needed externally
export type { UnitsTableProps } from "./types";
