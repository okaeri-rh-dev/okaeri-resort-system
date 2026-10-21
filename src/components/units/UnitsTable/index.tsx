import { useCallback } from "react";

import { flexRender, type Row } from "@tanstack/react-table";

import { withErrorBoundary } from "@/components/ErrorBoundary";
import {
  Button,
  Callout,
  Checkbox,
  DataTable,
  ListCard,
  ListCardRow,
  TableEmptyState,
  TablePagination,
  TableSkeleton,
} from "@/components/patterns";
import { cn } from "@/lib/utils";
import type { Unit } from "@/types";

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
      <Callout tone="danger" title="Couldn't load cabins">
        <p>{error.message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </Callout>
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

      <DataTable
        table={table}
        label="Cabins"
        renderCard={(row) => <UnitCard row={row} />}
        emptyState={
          <TableEmptyState
            title="No cabins found"
            description="Add your first cabin to get started"
          />
        }
      />

      <TablePagination table={table} totalItems={units.length} />
    </div>
  );
}

/** Renders one column's cell, so the card form shares the table's edit mode and actions. */
function renderCell(row: Row<Unit>, columnId: string) {
  const cell = row.getVisibleCells().find((visibleCell) => visibleCell.column.id === columnId);
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null;
}

function UnitCard({ row }: { row: Row<Unit> }) {
  const unit = row.original;
  return (
    <ListCard>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${unit.unit_name}`}
          />
          <div className="min-w-0">
            {renderCell(row, "unit_name")}
            <p className="text-muted-foreground text-sm tabular-nums">{unit.unit_code}</p>
          </div>
        </div>
        {renderCell(row, "actions")}
      </div>
      <ListCardRow label="Capacity" value={renderCell(row, "max_occupancy")} />
      <ListCardRow label="Status" value={renderCell(row, "unit_status")} />
    </ListCard>
  );
}

// Export with error boundary - explicitly typed to preserve props
export const UnitsTable = withErrorBoundary(UnitsTableComponent, {
  level: "component",
  fallback: (
    <Callout tone="danger" title="Couldn't load the cabins table">
      <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
        Reload Page
      </Button>
    </Callout>
  ),
}) as React.ComponentType<UnitsTableProps>;

// Types are exported directly from types file when needed externally
export type { UnitsTableProps } from "./types";
