/**
 * Expense Store
 * Manages expense state with optimistic updates and offline support
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import { Money } from "@/lib/money";
import type {
  Expense,
  ExpenseCategory,
  ExpenseStatus,
} from "@/features/financial/types/financial.types";

interface ExpenseFilters {
  startDate?: Date;
  endDate?: Date;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  vendorId?: string;
  search?: string;
}

interface ExpenseSummary {
  totalAmount: Money;
  totalVat: Money;
  totalEwt: Money;
  byCategory: Record<ExpenseCategory, Money>;
  count: number;
}

interface ExpenseState {
  // Data
  expenses: Expense[];
  selectedExpense: Expense | null;
  filters: ExpenseFilters;
  summary: ExpenseSummary | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  optimisticExpenses: Expense[];

  // Actions
  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  selectExpense: (expense: Expense | null) => void;

  // Optimistic updates
  addOptimisticExpense: (expense: Expense) => void;
  confirmOptimisticExpense: (tempId: string, realExpense: Expense) => void;
  revertOptimisticExpense: (tempId: string) => void;

  // Filters
  setFilters: (filters: ExpenseFilters) => void;
  clearFilters: () => void;

  // Summary
  setSummary: (summary: ExpenseSummary) => void;
  updateSummary: () => void;

  // UI State
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useExpenseStore = create<ExpenseState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      expenses: [],
      selectedExpense: null,
      filters: {},
      summary: null,
      isLoading: false,
      error: null,
      optimisticExpenses: [],

      // Actions
      setExpenses: (expenses) =>
        set((state) => {
          state.expenses = expenses;
          state.error = null;
        }),

      addExpense: (expense) =>
        set((state) => {
          state.expenses.push(expense);
        }),

      updateExpense: (id, updates) =>
        set((state) => {
          const index = state.expenses.findIndex((e) => e.id === id);
          if (index !== -1) {
            state.expenses[index] = { ...state.expenses[index], ...updates };
          }
        }),

      deleteExpense: (id) =>
        set((state) => {
          state.expenses = state.expenses.filter((e) => e.id !== id);
          if (state.selectedExpense?.id === id) {
            state.selectedExpense = null;
          }
        }),

      selectExpense: (expense) =>
        set((state) => {
          state.selectedExpense = expense;
        }),

      // Optimistic updates
      addOptimisticExpense: (expense) =>
        set((state) => {
          state.optimisticExpenses.push(expense);
        }),

      confirmOptimisticExpense: (tempId, realExpense) =>
        set((state) => {
          state.optimisticExpenses = state.optimisticExpenses.filter((e) => e.id !== tempId);
          state.expenses.push(realExpense);
        }),

      revertOptimisticExpense: (tempId) =>
        set((state) => {
          state.optimisticExpenses = state.optimisticExpenses.filter((e) => e.id !== tempId);
        }),

      // Filters
      setFilters: (filters) =>
        set((state) => {
          state.filters = filters;
        }),

      clearFilters: () =>
        set((state) => {
          state.filters = {};
        }),

      // Summary
      setSummary: (summary) =>
        set((state) => {
          state.summary = summary;
        }),

      updateSummary: () =>
        set((state) => {
          const allExpenses = [...state.expenses, ...state.optimisticExpenses];

          if (allExpenses.length === 0) {
            state.summary = null;
            return;
          }

          let totalAmount = new Money(0);
          let totalVat = new Money(0);
          let totalEwt = new Money(0);
          const byCategory: Partial<Record<ExpenseCategory, Money>> = {};

          for (const expense of allExpenses) {
            const amount =
              expense.amount instanceof Money ? expense.amount : new Money(expense.amount);
            const vat =
              expense.vatAmount instanceof Money
                ? expense.vatAmount
                : new Money(expense.vatAmount || 0);
            const ewt =
              expense.ewtAmount instanceof Money
                ? expense.ewtAmount
                : new Money(expense.ewtAmount || 0);

            totalAmount = totalAmount.add(amount);
            totalVat = totalVat.add(vat);
            totalEwt = totalEwt.add(ewt);

            if (!byCategory[expense.category]) {
              byCategory[expense.category] = new Money(0);
            }
            byCategory[expense.category] = byCategory[expense.category]!.add(amount);
          }

          state.summary = {
            totalAmount,
            totalVat,
            totalEwt,
            byCategory: byCategory as Record<ExpenseCategory, Money>,
            count: allExpenses.length,
          };
        }),

      // UI State
      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading;
        }),

      setError: (error) =>
        set((state) => {
          state.error = error;
          state.isLoading = false;
        }),

      clearError: () =>
        set((state) => {
          state.error = null;
        }),
    })),
    {
      name: "expense-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filters: state.filters,
        selectedExpense: state.selectedExpense,
      }),
    }
  )
);
