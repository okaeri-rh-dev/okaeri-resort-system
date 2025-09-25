import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  useUnits,
  useUpdateUnit,
  useDeleteUnit,
  useBatchUpdateUnitsStatus,
} from "@/stores/useUnitStore";
import type { Unit, UnitStatus } from "@/types";
import { useUnitColumns } from "../components/UnitColumns";

interface UseUnitsTableOptions {
  pageSize?: number;
  onAddUnit?: () => void;
}

/**
 * Custom hook for managing units table state and logic
 * Handles filtering, sorting, pagination, and CRUD operations
 */
export function useUnitsTable(options: UseUnitsTableOptions = {}) {
  const { pageSize = 10, onAddUnit } = options;

  // Query hooks
  const { data: units = [], isLoading, error } = useUnits();
  const updateUnitMutation = useUpdateUnit();
  const deleteUnitMutation = useDeleteUnit();
  const batchUpdateMutation = useBatchUpdateUnitsStatus();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  // Custom filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filter units based on custom filters
  const filteredUnits = useMemo(() => {
    let filtered = [...units];

    if (typeFilter !== "all") {
      filtered = filtered.filter((unit) => unit.unit_type === typeFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((unit) => unit.unit_status === statusFilter);
    }

    return filtered;
  }, [units, typeFilter, statusFilter]);

  // Handle unit updates
  const handleUpdateUnit = useCallback(
    async (unitId: string, updates: Partial<Unit>) => {
      try {
        await updateUnitMutation.mutateAsync({ id: unitId, updates });
      } catch (error) {
        console.error("Failed to update unit:", error);
      }
    },
    [updateUnitMutation]
  );

  // Handle unit deletion
  const handleDeleteUnit = useCallback(
    async (unitId: string) => {
      try {
        await deleteUnitMutation.mutateAsync(unitId);
      } catch (error) {
        console.error("Failed to delete unit:", error);
      }
    },
    [deleteUnitMutation]
  );

  // Handle batch status update
  const handleBatchStatusUpdate = useCallback(
    async (status: UnitStatus) => {
      const selectedIds = Object.keys(rowSelection)
        .filter((key) => rowSelection[key])
        .map((index) => filteredUnits[parseInt(index)]?.unit_id)
        .filter(Boolean);

      if (selectedIds.length === 0) return;

      try {
        await batchUpdateMutation.mutateAsync({ unitIds: selectedIds, status });
        setRowSelection({});
      } catch (error) {
        console.error("Failed to update units status:", error);
      }
    },
    [rowSelection, filteredUnits, batchUpdateMutation]
  );

  // Get columns configuration
  const columns = useUnitColumns({
    onUpdateUnit: handleUpdateUnit,
    isEditMode,
  });

  // Create table instance
  const table = useReactTable({
    data: filteredUnits,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
    enableRowSelection: true,
  });

  // Calculate selected count
  const selectedCount = Object.keys(rowSelection).filter((key) => rowSelection[key]).length;

  // Reset selection when data changes
  useEffect(() => {
    setRowSelection({});
  }, [units]);

  return {
    // Table instance
    table,

    // Data state
    units: filteredUnits,
    isLoading,
    error,

    // Filters
    globalFilter,
    setGlobalFilter,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,

    // Edit mode
    isEditMode,
    setIsEditMode,

    // Selection
    selectedCount,
    rowSelection,

    // Actions
    handleUpdateUnit,
    handleDeleteUnit,
    handleBatchStatusUpdate,
    onAddUnit,

    // Mutations state
    isUpdating: updateUnitMutation.isPending,
    isDeleting: deleteUnitMutation.isPending,
    isBatchUpdating: batchUpdateMutation.isPending,
  };
}
