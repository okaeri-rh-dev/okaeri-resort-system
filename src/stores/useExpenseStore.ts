import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { Expense } from "@/types";

export interface ExpenseFilters {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface ExpenseStore {
  // Local state
  selectedExpense: Expense | null;
  filters: ExpenseFilters;
  searchQuery: string;
  sortBy: "date" | "amount" | "category" | "description";
  sortOrder: "asc" | "desc";

  // Actions
  setSelectedExpense: (expense: Expense | null) => void;
  setFilters: (filters: ExpenseFilters) => void;
  resetFilters: () => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "date" | "amount" | "category" | "description") => void;
  setSortOrder: (order: "asc" | "desc") => void;
}

export const useExpenseStore = create<ExpenseStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedExpense: null,
        filters: {},
        searchQuery: "",
        sortBy: "date",
        sortOrder: "desc",

        // Actions
        setSelectedExpense: (expense) => set({ selectedExpense: expense }),

        setFilters: (filters) => set({ filters }),

        resetFilters: () => set({ filters: {} }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),
      }),
      {
        name: "expense-store",
        partialize: (state) => ({
          filters: state.filters,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        }),
      }
    )
  )
);
