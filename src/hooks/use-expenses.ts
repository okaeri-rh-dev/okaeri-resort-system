/**
 * Custom hooks for expense operations using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, mutationKeys, invalidateQueries } from "@/lib/query-client";
import { useExpenseStore } from "@/stores/expenseStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { Expense, CreateExpenseData, UpdateExpenseData } from "@/types/common";

/**
 * Fetch all expenses for the active project
 */
export function useExpenses(filters?: any) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const fetchExpenses = useExpenseStore((state) => state.fetchExpenses);

  return useQuery({
    queryKey: queryKeys.expenses.list(activeProjectId!, filters),
    queryFn: () => fetchExpenses(filters),
    enabled: !!activeProjectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single expense by ID
 */
export function useExpense(expenseId: string) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const expenseStore = useExpenseStore();

  return useQuery({
    queryKey: queryKeys.expenses.detail(activeProjectId!, expenseId),
    queryFn: async () => {
      const existingExpense = expenseStore.expenses.find((e) => e.id === expenseId);
      if (existingExpense && Date.now() - expenseStore.lastFetch < 60000) {
        return existingExpense;
      }
      return expenseStore.fetchExpenseById(expenseId);
    },
    enabled: !!activeProjectId && !!expenseId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new expense with optimistic update and offline support
 */
export function useCreateExpense() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const createExpense = useExpenseStore((state) => state.createExpense);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.expenses.create(activeProjectId!),
    mutationFn: (data: CreateExpenseData) => createExpense(data),
    onMutate: async (newExpense) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.expenses.all(activeProjectId!),
      });

      const previousExpenses = queryClient.getQueryData(queryKeys.expenses.list(activeProjectId!));

      // Add optimistic expense
      queryClient.setQueryData(queryKeys.expenses.list(activeProjectId!), (old: Expense[] = []) => [
        ...old,
        {
          ...newExpense,
          id: `temp-${Date.now()}`,
          status: "DRAFT",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      return { previousExpenses };
    },
    onError: (err, newExpense, context) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(
          queryKeys.expenses.list(activeProjectId!),
          context.previousExpenses
        );
      }
      toast.error("Failed to create expense", err.message);
    },
    onSuccess: () => {
      toast.success("Expense created successfully");
      invalidateQueries.expenses(activeProjectId!);
    },
  });
}

/**
 * Update an existing expense with optimistic update
 */
export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const updateExpense = useExpenseStore((state) => state.updateExpense);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.expenses.update(activeProjectId!, ""),
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseData }) => updateExpense(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.expenses.detail(activeProjectId!, id),
      });

      const previousExpense = queryClient.getQueryData(
        queryKeys.expenses.detail(activeProjectId!, id)
      );

      queryClient.setQueryData(queryKeys.expenses.detail(activeProjectId!, id), (old: Expense) => ({
        ...old,
        ...data,
        updatedAt: new Date().toISOString(),
      }));

      return { previousExpense };
    },
    onError: (err, variables, context) => {
      if (context?.previousExpense) {
        queryClient.setQueryData(
          queryKeys.expenses.detail(activeProjectId!, variables.id),
          context.previousExpense
        );
      }
      toast.error("Failed to update expense", err.message);
    },
    onSuccess: (data, variables) => {
      toast.success("Expense updated successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.detail(activeProjectId!, variables.id),
      });
      invalidateQueries.expenses(activeProjectId!);
    },
  });
}

/**
 * Delete an expense
 */
export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const deleteExpense = useExpenseStore((state) => state.deleteExpense);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.expenses.delete(activeProjectId!, ""),
    mutationFn: (expenseId: string) => deleteExpense(expenseId),
    onSuccess: () => {
      toast.success("Expense deleted successfully");
      invalidateQueries.expenses(activeProjectId!);
    },
    onError: (err) => {
      toast.error("Failed to delete expense", err.message);
    },
  });
}

/**
 * Approve an expense
 */
export function useApproveExpense() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const approveExpense = useExpenseStore((state) => state.approveExpense);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.expenses.approve(activeProjectId!, ""),
    mutationFn: ({ expenseId, notes }: { expenseId: string; notes?: string }) =>
      approveExpense(expenseId, notes),
    onMutate: async ({ expenseId }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.expenses.detail(activeProjectId!, expenseId),
      });

      const previousExpense = queryClient.getQueryData<Expense>(
        queryKeys.expenses.detail(activeProjectId!, expenseId)
      );

      if (previousExpense) {
        queryClient.setQueryData(queryKeys.expenses.detail(activeProjectId!, expenseId), {
          ...previousExpense,
          status: "APPROVED",
          approvedAt: new Date().toISOString(),
        });
      }

      return { previousExpense };
    },
    onError: (err, variables, context) => {
      if (context?.previousExpense) {
        queryClient.setQueryData(
          queryKeys.expenses.detail(activeProjectId!, variables.expenseId),
          context.previousExpense
        );
      }
      toast.error("Failed to approve expense", err.message);
    },
    onSuccess: (data, variables) => {
      toast.success("Expense approved successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.detail(activeProjectId!, variables.expenseId),
      });
      invalidateQueries.expenses(activeProjectId!);
    },
  });
}

/**
 * Reject an expense
 */
export function useRejectExpense() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const rejectExpense = useExpenseStore((state) => state.rejectExpense);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: mutationKeys.expenses.reject(activeProjectId!, ""),
    mutationFn: ({ expenseId, reason }: { expenseId: string; reason: string }) =>
      rejectExpense(expenseId, reason),
    onSuccess: (data, variables) => {
      toast.success("Expense rejected");
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.detail(activeProjectId!, variables.expenseId),
      });
      invalidateQueries.expenses(activeProjectId!);
    },
    onError: (err) => {
      toast.error("Failed to reject expense", err.message);
    },
  });
}

/**
 * Fetch expense categories
 */
export function useExpenseCategories() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const fetchCategories = useExpenseStore((state) => state.fetchCategories);

  return useQuery({
    queryKey: queryKeys.expenses.categories(activeProjectId!),
    queryFn: () => fetchCategories(),
    enabled: !!activeProjectId,
    staleTime: 10 * 60 * 1000, // 10 minutes - categories don't change often
  });
}

/**
 * Create a new expense category
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const createCategory = useExpenseStore((state) => state.createCategory);
  const toast = useUIStore((state) => state.toast);

  return useMutation({
    mutationKey: ["expenses", "createCategory", activeProjectId],
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success("Category created successfully");
      queryClient.invalidateQueries({
        queryKey: queryKeys.expenses.categories(activeProjectId!),
      });
    },
    onError: (err) => {
      toast.error("Failed to create category", err.message);
    },
  });
}

/**
 * Fetch expense summary for a period
 */
export function useExpenseSummary(period?: string) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const fetchSummary = useExpenseStore((state) => state.fetchSummary);

  return useQuery({
    queryKey: queryKeys.expenses.summary(activeProjectId!, period),
    queryFn: () => fetchSummary(period),
    enabled: !!activeProjectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Sync offline expenses
 */
export function useSyncOfflineExpenses() {
  const syncOfflineExpenses = useExpenseStore((state) => state.syncOfflineExpenses);
  const toast = useUIStore((state) => state.toast);
  const queryClient = useQueryClient();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);

  return useMutation({
    mutationKey: ["expenses", "syncOffline"],
    mutationFn: () => syncOfflineExpenses(),
    onSuccess: (syncedCount) => {
      if (syncedCount > 0) {
        toast.success(`Synced ${syncedCount} offline expenses`);
        invalidateQueries.expenses(activeProjectId!);
      }
    },
    onError: (err) => {
      toast.error("Failed to sync offline expenses", err.message);
    },
  });
}

/**
 * Process offline queue - called when connection is restored
 */
export function useProcessOfflineQueue() {
  const processOfflineQueue = useExpenseStore((state) => state.processOfflineQueue);
  const offlineQueue = useExpenseStore((state) => state.offlineQueue);
  const isOnline = useExpenseStore((state) => state.isOnline);

  return useQuery({
    queryKey: ["expenses", "processOfflineQueue"],
    queryFn: () => processOfflineQueue(),
    enabled: isOnline && offlineQueue.length > 0,
    refetchInterval: 30000, // Try every 30 seconds
    staleTime: 0, // Always process when conditions are met
  });
}
