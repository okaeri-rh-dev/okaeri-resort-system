import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useResponsiveView } from "@/hooks";
import {
  useExpenses,
  useDeleteExpense,
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

  // Responsive detection
  const { isMobile } = useResponsiveView();

  // Mutations
  const deleteExpense = useDeleteExpense();
  const exportExpenses = useExportExpenses();

  // Data
  const { data: expenses = [], error, isLoading } = useExpenses();

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

  // Handle delete
  const handleDelete = async (expense: Expense) => {
    if (!confirm(`Are you sure you want to delete this expense: ${expense.description}?`)) {
      return;
    }

    try {
      await deleteExpense.mutateAsync(expense.expense_id);
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  };

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
    [onViewExpense, onEditExpense]
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
    exportExpenses,
  };
}
