import type { ExpenseFilters } from "@/stores/useExpenseStore";
import type { Expense } from "@/types";

export interface ExpensesTableProps {
  onViewExpense?: (expense: Expense) => void;
  onEditExpense?: (expense: Expense) => void;
  className?: string;
}

export interface ExpenseFiltersProps {
  filters: ExpenseFilters;
  setFilters: (filters: ExpenseFilters) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
  onExport: () => void;
  isExporting?: boolean;
  totalCount: number;
}

export interface ExpenseCardProps {
  expense: Expense;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}
