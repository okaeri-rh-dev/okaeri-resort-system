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
  useCabinStatesTonight,
  useDeleteUnit,
  useUnits,
  useUpdateUnit,
} from "@/stores/useUnitStore";
import type { Unit } from "@/types";

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
  const { data: units = [], isLoading: unitsLoading, error: unitsError } = useUnits();
  const {
    data: cabinStates,
    isLoading: statesLoading,
    error: statesError,
  } = useCabinStatesTonight();
  const isLoading = unitsLoading || statesLoading;
  const error = unitsError ?? statesError;
  const updateUnitMutation = useUpdateUnit();
  const deleteUnitMutation = useDeleteUnit();

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
  const [tonightFilter, setTonightFilter] = useState("all");

  // Filter units based on custom filters
  const filteredUnits = useMemo(() => {
    let filtered = [...units];

    if (typeFilter !== "all") {
      filtered = filtered.filter((unit) => unit.unit_type === typeFilter);
    }

    if (tonightFilter !== "all") {
      filtered = filtered.filter((unit) => cabinStates?.get(unit.unit_id)?.state === tonightFilter);
    }

    return filtered;
  }, [units, cabinStates, typeFilter, tonightFilter]);

  // Stabilize the update handler with a ref to avoid recreating columns
  const updateMutationRef = useRef(updateUnitMutation);
  updateMutationRef.current = updateUnitMutation;

  // Handle unit updates
  const handleUpdateUnit = useCallback(
    (unitId: string, updates: Partial<Unit>) => {
      updateMutationRef.current.mutate(
        { unitId, updates },
        {
          onError: (error) => {
            console.error("Failed to update unit:", error);
            toast.error("Failed to update unit. Please try again.");
          },
        }
      );
    },
    [] // No dependencies - uses ref for mutation
  );

  // Stabilize the delete handler with a ref
  const deleteMutationRef = useRef(deleteUnitMutation);
  deleteMutationRef.current = deleteUnitMutation;

  // Handle unit deletion
  const handleDeleteUnit = useCallback(
    (unit: Unit) => {
      deleteMutationRef.current.mutate(unit.unit_id, {
        onSuccess: () => {
          setRowSelection((prev) => {
            const newSelection = { ...prev };
            delete newSelection[unit.unit_id];
            return newSelection;
          });
        },
        onError: (error) => {
          console.error("Failed to delete unit:", error);
          toast.error("Failed to delete unit. Please try again.");
        },
      });
    },
    [] // No dependencies - uses ref for mutation
  );

  // Get columns configuration
  const columns = useUnitColumns({
    cabinStates,
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
    tonightFilter,
    setTonightFilter,

    // Edit mode
    isEditMode,
    setIsEditMode,

    // Selection
    selectedCount,
    rowSelection,

    // Actions
    handleUpdateUnit,
    handleDeleteUnit,
    onAddUnit,

    // Mutations state
    isUpdating: updateUnitMutation.isPending,
    isDeleting: deleteUnitMutation.isPending,
  };
}
