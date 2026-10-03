import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { toast } from "sonner";

import {
  useBatchUpdateUnitsStatus,
  useDeleteUnit,
  useUnits,
  useUpdateUnit,
} from "@/stores/useUnitStore";
import type { Unit, UnitStatus } from "@/types";

import { useUnitColumns } from "../components/UnitColumns";

interface UseUnitsTableOptions {
  pageSize?: number;
  onAddUnit?: () => void;
  onViewUnit?: (unit: Unit) => void;
  onEditUnit?: (unit: Unit) => void;
}

/**
 * Custom hook for managing units table state and logic
 * Handles filtering, sorting, pagination, and CRUD operations
 */
export function useUnitsTable(options: UseUnitsTableOptions = {}) {
  const { pageSize = 10, onAddUnit, onViewUnit, onEditUnit } = options;

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

  // Track previous unit IDs to detect deletions
  const previousUnitIdsRef = useRef<Set<string>>(new Set());

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

  // Stabilize the update handler with a ref to avoid recreating columns
  const updateMutationRef = useRef(updateUnitMutation);
  updateMutationRef.current = updateUnitMutation;

  // Handle unit updates
  const handleUpdateUnit = useCallback(
    async (unitId: string, updates: Partial<Unit>) => {
      try {
        await updateMutationRef.current.mutateAsync({ unitId, updates });
      } catch (error) {
        console.error("Failed to update unit:", error);
        toast.error("Failed to update unit. Please try again.");
      }
    },
    [] // No dependencies - uses ref for mutation
  );

  // Stabilize the delete handler with a ref
  const deleteMutationRef = useRef(deleteUnitMutation);
  deleteMutationRef.current = deleteUnitMutation;

  // Handle unit deletion
  const handleDeleteUnit = useCallback(
    async (unit: Unit) => {
      try {
        await deleteMutationRef.current.mutateAsync(unit.unit_id);
        // Remove deleted unit from selection
        setRowSelection((prev) => {
          const newSelection = { ...prev };
          delete newSelection[unit.unit_id];
          return newSelection;
        });
      } catch (error) {
        console.error("Failed to delete unit:", error);
        toast.error("Failed to delete unit. Please try again.");
      }
    },
    [] // No dependencies - uses ref for mutation
  );

  // Stabilize the batch mutation with a ref
  const batchMutationRef = useRef(batchUpdateMutation);
  batchMutationRef.current = batchUpdateMutation;

  // Handle batch status update
  const handleBatchStatusUpdate = useCallback(
    async (status: UnitStatus) => {
      // With ID-based selection, keys are unit IDs
      const selectedIds = Object.keys(rowSelection).filter((unitId) => rowSelection[unitId]);

      if (selectedIds.length === 0) return;

      try {
        await batchMutationRef.current.mutateAsync({ unitIds: selectedIds, status });
        setRowSelection({}); // Clear selection after batch update
      } catch (error) {
        console.error("Failed to update units status:", error);
        toast.error("Failed to update unit status. Please try again.");
      }
    },
    [rowSelection]
  );

  // Get columns configuration
  const columns = useUnitColumns({
    onUpdateUnit: handleUpdateUnit,
    isEditMode,
    onViewUnit,
    onEditUnit,
    onDeleteUnit: handleDeleteUnit,
  });

  // Create table instance with stable row IDs
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
    getRowId: (row) => row.unit_id, // Use unit_id as row ID for stable selection
    initialState: {
      pagination: {
        pageSize,
      },
    },
    enableRowSelection: true,
  });

  // Calculate selected count
  const selectedCount = Object.keys(rowSelection).filter((key) => rowSelection[key]).length;

  // Clean up selection only for deleted units
  useEffect(() => {
    const currentUnitIds = new Set<string>(units.map((unit) => unit.unit_id));
    const previousIds = previousUnitIdsRef.current;

    // Only clean up selection if units were actually deleted
    if (previousIds.size > 0) {
      const deletedIds = Array.from(previousIds).filter((id) => !currentUnitIds.has(id));

      if (deletedIds.length > 0) {
        setRowSelection((prev) => {
          const newSelection = { ...prev };
          deletedIds.forEach((id) => delete newSelection[id]);
          return newSelection;
        });
      }
    }

    // Update the ref for next comparison
    previousUnitIdsRef.current = currentUnitIds;
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
