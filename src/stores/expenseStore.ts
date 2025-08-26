/**
 * Expense tracking store using Zustand with offline support
 * Handles comprehensive expense management with approval workflows
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Expense,
  ExpenseStatus,
  ExpenseCategory,
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseSummary,
  OfflineExpense,
  PaginatedResponse,
  FilterParams,
} from "@/types/common";
import { apiClient } from "@/api/client";
import { useProjectStore } from "./projectStore";
import { useUIStore } from "./uiStore";

interface ExpenseState {
  // Expenses data
  expenses: Expense[];
  optimisticExpenses: Expense[];
  totalExpenses: number;
  currentPage: number;
  pageSize: number;

  // Categories
  categories: Array<{
    id: string;
    name: string;
    value: ExpenseCategory;
    description?: string;
    budget?: number;
    spent?: number;
  }>;

  // Offline queue
  offlineQueue: OfflineExpense[];

  // Summary data
  summary: ExpenseSummary | null;
  budgets: Map<ExpenseCategory, { budget: number; spent: number }>;

  // UI state
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isSyncing: boolean;
  error: string | null;
  lastFetch: number | null;
  lastSync: number | null;

  // Filters
  filters: FilterParams;
}

interface ExpenseActions {
  // CRUD operations
  fetchExpenses: (params?: FilterParams) => Promise<void>;
  fetchExpenseById: (expenseId: string) => Promise<Expense>;
  createExpense: (data: CreateExpenseData) => Promise<Expense>;
  updateExpense: (expenseId: string, data: UpdateExpenseData) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;

  // Approval workflow
  approveExpense: (expenseId: string, notes?: string) => Promise<void>;
  rejectExpense: (expenseId: string, reason: string) => Promise<void>;
  submitForApproval: (expenseId: string) => Promise<void>;

  // Category management
  fetchCategories: () => Promise<void>;
  createCategory: (data: {
    name: string;
    value: ExpenseCategory;
    description?: string;
    budget?: number;
  }) => Promise<void>;
  updateCategoryBudget: (category: ExpenseCategory, budget: number) => Promise<void>;

  // Summary and analytics
  fetchSummary: (period?: { from: Date; to: Date }) => Promise<void>;
  getSummaryByCategory: (category?: ExpenseCategory) => number;
  getSummaryByPeriod: (from: Date, to: Date) => ExpenseSummary | null;
  getBudgetStatus: (category: ExpenseCategory) => {
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
  };

  // Receipt management
  attachReceipt: (expenseId: string, receiptUrl: string) => Promise<void>;
  removeReceipt: (expenseId: string) => Promise<void>;

  // Offline support
  queueOfflineExpense: (data: CreateExpenseData) => void;
  syncOfflineExpenses: () => Promise<void>;
  removeFromQueue: (tempId: string) => void;
  clearOfflineQueue: () => void;

  // Optimistic updates
  addOptimisticExpense: (expense: Expense) => void;
  removeOptimisticExpense: (expenseId: string) => void;
  clearOptimisticExpenses: () => void;

  // State management
  setExpenses: (expenses: Expense[]) => void;
  setFilters: (filters: FilterParams) => void;
  setPagination: (page: number, size: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;

  // Utility
  getExpenseById: (expenseId: string) => Expense | undefined;
  getExpensesByCategory: (category: ExpenseCategory) => Expense[];
  getExpensesByStatus: (status: ExpenseStatus) => Expense[];
  getExpensesByProperty: (propertyId: string) => Expense[];
  getPendingApprovals: () => Expense[];
  refreshIfNeeded: () => Promise<void>;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Generate temporary ID for optimistic updates
let tempIdCounter = 0;
const generateTempId = () => `temp-expense-${Date.now()}-${++tempIdCounter}`;

// Maximum retry attempts for offline sync
const MAX_RETRY_ATTEMPTS = 3;

export const useExpenseStore = create<ExpenseState & ExpenseActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        expenses: [],
        optimisticExpenses: [],
        totalExpenses: 0,
        currentPage: 1,
        pageSize: 20,
        categories: [],
        offlineQueue: [],
        summary: null,
        budgets: new Map(),
        isLoading: false,
        isCreating: false,
        isUpdating: false,
        isSyncing: false,
        error: null,
        lastFetch: null,
        lastSync: null,
        filters: {},

        // CRUD operations
        fetchExpenses: async (params?: FilterParams) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
            if (params) state.filters = params;
          });

          try {
            const response = await apiClient.get<PaginatedResponse<Expense>>(
              `/projects/${activeProjectId}/expenses`,
              {
                page: get().currentPage,
                limit: get().pageSize,
                ...get().filters,
              }
            );

            set((state) => {
              state.expenses = response.data.data;
              state.totalExpenses = response.data.meta.total;
              state.lastFetch = Date.now();
              state.isLoading = false;
            });

            // Sync offline expenses if any
            if (get().offlineQueue.length > 0) {
              get().syncOfflineExpenses();
            }
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to fetch expenses";
            });
            useUIStore.getState().toast.error("Failed to fetch expenses", error.message);
            throw error;
          }
        },

        fetchExpenseById: async (expenseId: string) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await apiClient.get<Expense>(
              `/projects/${activeProjectId}/expenses/${expenseId}`
            );
            const expense = response.data;

            set((state) => {
              const index = state.expenses.findIndex((e) => e.id === expenseId);
              if (index !== -1) {
                state.expenses[index] = expense;
              } else {
                state.expenses.push(expense);
              }
              state.isLoading = false;
            });

            return expense;
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Failed to fetch expense";
            });
            useUIStore.getState().toast.error("Failed to fetch expense", error.message);
            throw error;
          }
        },

        createExpense: async (data: CreateExpenseData) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          // Create optimistic expense
          const tempId = generateTempId();
          const optimisticExpense: Expense = {
            id: tempId,
            projectId: activeProjectId,
            ...data,
            status: ExpenseStatus.PENDING,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set((state) => {
            state.isCreating = true;
            state.error = null;
            state.optimisticExpenses.unshift(optimisticExpense);
          });

          try {
            const response = await apiClient.post<Expense>(
              `/projects/${activeProjectId}/expenses`,
              data
            );
            const expense = response.data;

            set((state) => {
              // Remove optimistic expense
              state.optimisticExpenses = state.optimisticExpenses.filter((e) => e.id !== tempId);
              // Add real expense
              state.expenses.unshift(expense);
              state.totalExpenses++;
              state.isCreating = false;

              // Update budget spent amount
              const budgetInfo = state.budgets.get(expense.category);
              if (budgetInfo) {
                state.budgets.set(expense.category, {
                  ...budgetInfo,
                  spent: budgetInfo.spent + expense.amount,
                });
              }
            });

            useUIStore.getState().toast.success("Expense created successfully");
            return expense;
          } catch (error: any) {
            // If network error, add to offline queue
            if (error.code === "NETWORK_ERROR") {
              get().queueOfflineExpense(data);
              set((state) => {
                state.optimisticExpenses = state.optimisticExpenses.filter((e) => e.id !== tempId);
                state.isCreating = false;
              });
              useUIStore
                .getState()
                .toast.info("Expense saved offline", "Will sync when connection is restored");
              return optimisticExpense;
            }

            set((state) => {
              // Remove optimistic expense on error
              state.optimisticExpenses = state.optimisticExpenses.filter((e) => e.id !== tempId);
              state.isCreating = false;
              state.error = error.message || "Failed to create expense";
            });
            useUIStore.getState().toast.error("Failed to create expense", error.message);
            throw error;
          }
        },

        updateExpense: async (expenseId: string, data: UpdateExpenseData) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          // Store original expense for rollback
          const originalExpense = get().expenses.find((e) => e.id === expenseId);
          if (!originalExpense) {
            throw new Error("Expense not found");
          }

          set((state) => {
            state.isUpdating = true;
            state.error = null;
            // Optimistic update
            const index = state.expenses.findIndex((e) => e.id === expenseId);
            if (index !== -1) {
              state.expenses[index] = { ...state.expenses[index]!, ...data };
            }
          });

          try {
            const response = await apiClient.patch<Expense>(
              `/projects/${activeProjectId}/expenses/${expenseId}`,
              data
            );
            const updatedExpense = response.data;

            set((state) => {
              const index = state.expenses.findIndex((e) => e.id === expenseId);
              if (index !== -1) {
                state.expenses[index] = updatedExpense;
              }
              state.isUpdating = false;

              // Update budget if category or amount changed
              if (
                originalExpense.category !== updatedExpense.category ||
                originalExpense.amount !== updatedExpense.amount
              ) {
                // Subtract old amount from old category
                const oldBudget = state.budgets.get(originalExpense.category);
                if (oldBudget) {
                  state.budgets.set(originalExpense.category, {
                    ...oldBudget,
                    spent: oldBudget.spent - originalExpense.amount,
                  });
                }

                // Add new amount to new category
                const newBudget = state.budgets.get(updatedExpense.category);
                if (newBudget) {
                  state.budgets.set(updatedExpense.category, {
                    ...newBudget,
                    spent: newBudget.spent + updatedExpense.amount,
                  });
                }
              }
            });

            useUIStore.getState().toast.success("Expense updated successfully");
          } catch (error: any) {
            set((state) => {
              // Rollback on error
              const index = state.expenses.findIndex((e) => e.id === expenseId);
              if (index !== -1) {
                state.expenses[index] = originalExpense;
              }
              state.isUpdating = false;
              state.error = error.message || "Failed to update expense";
            });
            useUIStore.getState().toast.error("Failed to update expense", error.message);
            throw error;
          }
        },

        deleteExpense: async (expenseId: string) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          // Store original expense for rollback
          const originalExpense = get().expenses.find((e) => e.id === expenseId);
          if (!originalExpense) {
            throw new Error("Expense not found");
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
            // Optimistic delete
            state.expenses = state.expenses.filter((e) => e.id !== expenseId);
            state.totalExpenses--;

            // Update budget
            const budgetInfo = state.budgets.get(originalExpense.category);
            if (budgetInfo) {
              state.budgets.set(originalExpense.category, {
                ...budgetInfo,
                spent: budgetInfo.spent - originalExpense.amount,
              });
            }
          });

          try {
            await apiClient.delete(`/projects/${activeProjectId}/expenses/${expenseId}`);

            set((state) => {
              state.isLoading = false;
            });

            useUIStore.getState().toast.success("Expense deleted successfully");
          } catch (error: any) {
            set((state) => {
              // Rollback on error
              state.expenses.push(originalExpense);
              state.totalExpenses++;

              // Restore budget
              const budgetInfo = state.budgets.get(originalExpense.category);
              if (budgetInfo) {
                state.budgets.set(originalExpense.category, {
                  ...budgetInfo,
                  spent: budgetInfo.spent + originalExpense.amount,
                });
              }

              state.isLoading = false;
              state.error = error.message || "Failed to delete expense";
            });
            useUIStore.getState().toast.error("Failed to delete expense", error.message);
            throw error;
          }
        },

        // Approval workflow
        approveExpense: async (expenseId: string, notes?: string) => {
          await get().updateExpense(expenseId, {
            status: ExpenseStatus.APPROVED,
            notes: notes ? `Approved: ${notes}` : undefined,
          });
        },

        rejectExpense: async (expenseId: string, reason: string) => {
          await get().updateExpense(expenseId, {
            status: ExpenseStatus.REJECTED,
            notes: `Rejected: ${reason}`,
          });
        },

        submitForApproval: async (expenseId: string) => {
          await get().updateExpense(expenseId, {
            status: ExpenseStatus.PENDING,
          });
        },

        // Category management
        fetchCategories: async () => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          try {
            const response = await apiClient.get<
              Array<{
                id: string;
                name: string;
                value: ExpenseCategory;
                description?: string;
                budget?: number;
                spent?: number;
              }>
            >(`/projects/${activeProjectId}/expense-categories`);

            set((state) => {
              state.categories = response.data;

              // Update budgets map
              response.data.forEach((category) => {
                if (category.budget !== undefined) {
                  state.budgets.set(category.value, {
                    budget: category.budget,
                    spent: category.spent || 0,
                  });
                }
              });
            });
          } catch (error: any) {
            useUIStore.getState().toast.error("Failed to fetch categories", error.message);
            throw error;
          }
        },

        createCategory: async (data) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          try {
            const response = await apiClient.post(
              `/projects/${activeProjectId}/expense-categories`,
              data
            );

            set((state) => {
              state.categories.push(response.data);

              if (data.budget !== undefined) {
                state.budgets.set(data.value, {
                  budget: data.budget,
                  spent: 0,
                });
              }
            });

            useUIStore.getState().toast.success("Category created successfully");
          } catch (error: any) {
            useUIStore.getState().toast.error("Failed to create category", error.message);
            throw error;
          }
        },

        updateCategoryBudget: async (category: ExpenseCategory, budget: number) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          try {
            await apiClient.patch(`/projects/${activeProjectId}/expense-categories/${category}`, {
              budget,
            });

            set((state) => {
              const budgetInfo = state.budgets.get(category) || { spent: 0 };
              state.budgets.set(category, { ...budgetInfo, budget });
            });

            useUIStore.getState().toast.success("Budget updated successfully");
          } catch (error: any) {
            useUIStore.getState().toast.error("Failed to update budget", error.message);
            throw error;
          }
        },

        // Summary and analytics
        fetchSummary: async (period?: { from: Date; to: Date }) => {
          const { activeProjectId } = useProjectStore.getState();
          if (!activeProjectId) {
            throw new Error("No active project selected");
          }

          try {
            const params = period
              ? {
                  from: period.from.toISOString(),
                  to: period.to.toISOString(),
                }
              : {};

            const response = await apiClient.get<ExpenseSummary>(
              `/projects/${activeProjectId}/expenses/summary`,
              params
            );

            set((state) => {
              state.summary = response.data;
            });
          } catch (error: any) {
            useUIStore.getState().toast.error("Failed to fetch summary", error.message);
            throw error;
          }
        },

        getSummaryByCategory: (category?: ExpenseCategory) => {
          const expenses = [...get().expenses, ...get().optimisticExpenses];

          if (!category) {
            return expenses.reduce((sum, e) => sum + e.amount, 0);
          }

          return expenses
            .filter((e) => e.category === category)
            .reduce((sum, e) => sum + e.amount, 0);
        },

        getSummaryByPeriod: (from: Date, to: Date) => {
          const expenses = [...get().expenses, ...get().optimisticExpenses].filter((e) => {
            const date = new Date(e.date);
            return date >= from && date <= to;
          });

          if (expenses.length === 0) return null;

          const byCategory: Record<ExpenseCategory, number> = {} as any;
          const byMonth: Record<string, number> = {};
          const byProperty: Record<string, number> = {};
          const vendorMap = new Map<string, { amount: number; count: number }>();

          expenses.forEach((expense) => {
            // By category
            byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;

            // By month
            const monthKey = new Date(expense.date).toISOString().slice(0, 7);
            byMonth[monthKey] = (byMonth[monthKey] || 0) + expense.amount;

            // By property
            if (expense.propertyId) {
              byProperty[expense.propertyId] =
                (byProperty[expense.propertyId] || 0) + expense.amount;
            }

            // Top vendors
            if (expense.vendor) {
              const vendorInfo = vendorMap.get(expense.vendor) || {
                amount: 0,
                count: 0,
              };
              vendorMap.set(expense.vendor, {
                amount: vendorInfo.amount + expense.amount,
                count: vendorInfo.count + 1,
              });
            }
          });

          const topVendors = Array.from(vendorMap.entries())
            .map(([vendor, info]) => ({ vendor, ...info }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);

          const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
          const monthCount = Object.keys(byMonth).length || 1;

          return {
            totalAmount,
            byCategory,
            byMonth,
            byProperty,
            averageMonthly: totalAmount / monthCount,
            topVendors,
          };
        },

        getBudgetStatus: (category: ExpenseCategory) => {
          const budgetInfo = get().budgets.get(category);
          if (!budgetInfo) {
            return {
              budget: 0,
              spent: 0,
              remaining: 0,
              percentage: 0,
            };
          }

          const remaining = budgetInfo.budget - budgetInfo.spent;
          const percentage =
            budgetInfo.budget > 0 ? (budgetInfo.spent / budgetInfo.budget) * 100 : 0;

          return {
            budget: budgetInfo.budget,
            spent: budgetInfo.spent,
            remaining,
            percentage,
          };
        },

        // Receipt management
        attachReceipt: async (expenseId: string, receiptUrl: string) => {
          await get().updateExpense(expenseId, { receiptUrl });
        },

        removeReceipt: async (expenseId: string) => {
          await get().updateExpense(expenseId, { receiptUrl: undefined });
        },

        // Offline support
        queueOfflineExpense: (data: CreateExpenseData) => {
          const tempId = generateTempId();
          const offlineExpense: OfflineExpense = {
            tempId,
            data,
            timestamp: Date.now(),
            retryCount: 0,
          };

          set((state) => {
            state.offlineQueue.push(offlineExpense);
          });
        },

        syncOfflineExpenses: async () => {
          const queue = get().offlineQueue;
          if (queue.length === 0) return;

          set((state) => {
            state.isSyncing = true;
          });

          const failedItems: OfflineExpense[] = [];
          const successCount = queue.length;

          for (const item of queue) {
            if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
              failedItems.push(item);
              continue;
            }

            try {
              await get().createExpense(item.data);
              // Remove from queue after successful creation
              get().removeFromQueue(item.tempId);
            } catch (error: any) {
              // Increment retry count and keep in queue
              set((state) => {
                const index = state.offlineQueue.findIndex((q) => q.tempId === item.tempId);
                if (index !== -1) {
                  state.offlineQueue[index]!.retryCount++;
                  state.offlineQueue[index]!.error = error.message;
                }
              });
              failedItems.push({ ...item, retryCount: item.retryCount + 1 });
            }
          }

          set((state) => {
            state.isSyncing = false;
            state.lastSync = Date.now();
          });

          const syncedCount = successCount - failedItems.length;
          if (syncedCount > 0) {
            useUIStore
              .getState()
              .toast.success(`Synced ${syncedCount} offline expense${syncedCount > 1 ? "s" : ""}`);
          }

          if (failedItems.length > 0) {
            useUIStore
              .getState()
              .toast.warning(
                `Failed to sync ${failedItems.length} expense${failedItems.length > 1 ? "s" : ""}`,
                "Will retry later"
              );
          }
        },

        removeFromQueue: (tempId: string) => {
          set((state) => {
            state.offlineQueue = state.offlineQueue.filter((q) => q.tempId !== tempId);
          });
        },

        clearOfflineQueue: () => {
          set((state) => {
            state.offlineQueue = [];
          });
        },

        // Optimistic updates
        addOptimisticExpense: (expense: Expense) => {
          set((state) => {
            state.optimisticExpenses.unshift(expense);
          });
        },

        removeOptimisticExpense: (expenseId: string) => {
          set((state) => {
            state.optimisticExpenses = state.optimisticExpenses.filter((e) => e.id !== expenseId);
          });
        },

        clearOptimisticExpenses: () => {
          set((state) => {
            state.optimisticExpenses = [];
          });
        },

        // State management
        setExpenses: (expenses: Expense[]) => {
          set((state) => {
            state.expenses = expenses;
          });
        },

        setFilters: (filters: FilterParams) => {
          set((state) => {
            state.filters = filters;
          });
        },

        setPagination: (page: number, size: number) => {
          set((state) => {
            state.currentPage = page;
            state.pageSize = size;
          });
        },

        setLoading: (loading: boolean) => {
          set((state) => {
            state.isLoading = loading;
          });
        },

        setError: (error: string | null) => {
          set((state) => {
            state.error = error;
          });
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        reset: () => {
          set((state) => {
            state.expenses = [];
            state.optimisticExpenses = [];
            state.totalExpenses = 0;
            state.currentPage = 1;
            state.categories = [];
            state.offlineQueue = [];
            state.summary = null;
            state.budgets.clear();
            state.filters = {};
            state.error = null;
            state.lastFetch = null;
            state.lastSync = null;
          });
        },

        // Utility functions
        getExpenseById: (expenseId: string) => {
          return (
            get().expenses.find((e) => e.id === expenseId) ||
            get().optimisticExpenses.find((e) => e.id === expenseId)
          );
        },

        getExpensesByCategory: (category: ExpenseCategory) => {
          return [...get().expenses, ...get().optimisticExpenses].filter(
            (e) => e.category === category
          );
        },

        getExpensesByStatus: (status: ExpenseStatus) => {
          return [...get().expenses, ...get().optimisticExpenses].filter(
            (e) => e.status === status
          );
        },

        getExpensesByProperty: (propertyId: string) => {
          return [...get().expenses, ...get().optimisticExpenses].filter(
            (e) => e.propertyId === propertyId
          );
        },

        getPendingApprovals: () => {
          return [...get().expenses, ...get().optimisticExpenses].filter(
            (e) => e.status === ExpenseStatus.PENDING
          );
        },

        refreshIfNeeded: async () => {
          const { lastFetch } = get();
          const now = Date.now();

          if (!lastFetch || now - lastFetch > CACHE_DURATION) {
            await get().fetchExpenses();
          }
        },
      })),
      {
        name: "expense-storage",
        partialize: (state) => ({
          filters: state.filters,
          currentPage: state.currentPage,
          pageSize: state.pageSize,
          offlineQueue: state.offlineQueue,
        }),
      }
    ),
    {
      name: "ExpenseStore",
    }
  )
);

// Selector hooks for better performance
export const useExpenses = () =>
  useExpenseStore((state) => [...state.expenses, ...state.optimisticExpenses]);
export const useExpenseLoading = () =>
  useExpenseStore((state) => state.isLoading || state.isCreating || state.isUpdating);
export const useExpenseError = () => useExpenseStore((state) => state.error);
export const useExpenseCategories = () => useExpenseStore((state) => state.categories);
export const useExpenseSummary = () => useExpenseStore((state) => state.summary);
export const useOfflineQueue = () => useExpenseStore((state) => state.offlineQueue);
export const usePendingApprovals = () => useExpenseStore((state) => state.getPendingApprovals());
