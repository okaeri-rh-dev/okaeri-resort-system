import { useCallback, useMemo, useState } from "react";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { useResponsiveView } from "@/hooks";
import {
  useDeleteExpense,
  useExpenses,
  useExpenseStats,
  useExpenseStore,
  useExportExpenses,
} from "@/stores/useExpenseStore";
import type { Expense } from "@/types";

import type { ExpensesTableProps } from "../types";
import { getColumns } from "../utils/columns";

export function useExpensesTable({ onViewExpense, onEditExpense }: ExpensesTableProps) {
  // Store state
  const { filters, setFilters, resetFilters, searchQuery, setSearchQuery } = useExpenseStore();

  // Local state
  const [sorting, setSorting] = useState<SortingState>([
    { id: "date", desc: true }, // Default sort by date descending
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Responsive detection
  const { isMobile } = useResponsiveView();

  // Mutations
  const deleteExpense = useDeleteExpense();
  const exportExpenses = useExportExpenses();

  // Data
  const { data: expenses = [], error, isLoading } = useExpenses();

  // Get total count (unfiltered) for empty state differentiation
  const { data: expenseStats } = useExpenseStats();
  const totalUnfilteredCount = expenseStats?.totalCount ?? 0;

  // Filter expenses based on store filters
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (expense) =>
          expense.description?.toLowerCase().includes(query) ||
          expense.category.toLowerCase().includes(query) ||
          expense.notes?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter((expense) => expense.category === filters.category);
    }

    // Apply amount range
    if (filters.minAmount !== undefined) {
      filtered = filtered.filter((expense) => expense.amount >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      filtered = filtered.filter((expense) => expense.amount <= filters.maxAmount!);
    }

    // Apply date range
    if (filters.dateFrom) {
      filtered = filtered.filter((expense) => expense.date >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      filtered = filtered.filter((expense) => expense.date <= filters.dateTo!);
    }

    return filtered;
  }, [expenses, searchQuery, filters]);

  // Handle delete - opens confirmation dialog
  const handleDelete = useCallback((expense: Expense) => {
    setExpenseToDelete(expense);
    setDeleteDialogOpen(true);
  }, []);

  // Confirm delete - executes the actual deletion
  const confirmDelete = useCallback(async () => {
    if (!expenseToDelete) return;

    try {
      await deleteExpense.mutateAsync(expenseToDelete.expense_id);
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  }, [deleteExpense, expenseToDelete]);

  // Handle export
  const handleExport = async () => {
    try {
      await exportExpenses.mutateAsync(undefined);
    } catch (error) {
      console.error("Failed to export expenses:", error);
    }
  };

  // Get columns
  const columns = useMemo(
    () => getColumns({ onViewExpense, onEditExpense, onDelete: handleDelete }),
    [onViewExpense, onEditExpense, handleDelete]
  );

  // Create table
  const table = useReactTable({
    data: filteredExpenses,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return {
    table,
    expenses: filteredExpenses,
    totalUnfilteredCount,
    isLoading,
    error,
    isMobile,
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    resetFilters,
    handleExport,
    handleDelete,
    confirmDelete,
    exportExpenses,
    // Delete dialog state
    deleteDialogOpen,
    setDeleteDialogOpen,
    expenseToDelete,
    isDeleting: deleteExpense.isPending,
  };
}
