import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { afterWrite } from "@/lib/after-write";
import { expenseCategoryKeys } from "@/lib/query-keys";
import { db, handleSupabaseError } from "@/lib/supabase";
import type { ExpenseCategoryConfig } from "@/types";

const expenseCategoriesQuery = () =>
  queryOptions({
    queryKey: expenseCategoryKeys.list(),
    queryFn: async () => {
      const { data, error } = await db.expenseCategories.all();
      if (error) throw error;
      return data as ExpenseCategoryConfig[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

// Longer stale time since categories rarely change
const activeExpenseCategoriesQuery = () =>
  queryOptions({
    queryKey: expenseCategoryKeys.active(),
    queryFn: async () => {
      const { data, error } = await db.expenseCategories.active();
      if (error) throw error;
      return data as ExpenseCategoryConfig[];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

/**
 * Hook to fetch all expense categories (including archived) for admin settings
 */
export function useExpenseCategories() {
  return useQuery(expenseCategoriesQuery());
}

/**
 * Hook to fetch active expense categories only (for expense form dropdowns)
 */
export function useActiveExpenseCategories() {
  return useQuery(activeExpenseCategoriesQuery());
}

/**
 * Hook to create a new expense category
 */
export function useCreateExpenseCategory() {
  return useMutation({
    mutationFn: async (data: { name: string; display_order?: number; is_active?: boolean }) => {
      const { data: result, error } = await db.expenseCategories.create(data);
      if (error) throw error;
      return result as ExpenseCategoryConfig;
    },
    onSettled: () => afterWrite("expense_categories"),
    onSuccess: (data) => {
      toast.success("Category created", {
        description: `${data.name} has been added successfully.`,
      });
    },
    onError: (error) => {
      const message = handleSupabaseError(error);
      // Provide specific message for duplicate name
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        toast.error("Duplicate category", {
          description: "A category with this name already exists.",
        });
      } else {
        toast.error("Error creating category", {
          description: message,
        });
      }
    },
  });
}

/**
 * Hook to update an existing expense category
 */
export function useUpdateExpenseCategory() {
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<ExpenseCategoryConfig, "name" | "display_order" | "is_active">>;
    }) => {
      const { data, error } = await db.expenseCategories.update(id, updates);
      if (error) throw error;
      return data as ExpenseCategoryConfig;
    },
    onSettled: () => afterWrite("expense_categories"),
    onSuccess: (data) => {
      toast.success("Category updated", {
        description: `${data.name} has been updated successfully.`,
      });
    },
    onError: (error) => {
      const message = handleSupabaseError(error);
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        toast.error("Duplicate category", {
          description: "A category with this name already exists.",
        });
      } else {
        toast.error("Error updating category", {
          description: message,
        });
      }
    },
  });
}

/**
 * Hook to archive (soft delete) an expense category
 */
export function useArchiveExpenseCategory() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.expenseCategories.archive(id);
      if (error) throw error;
      return data as ExpenseCategoryConfig;
    },
    onSettled: () => afterWrite("expense_categories"),
    onSuccess: (data) => {
      toast.success("Category archived", {
        description: `${data.name} has been archived.`,
      });
    },
    onError: (error) => {
      toast.error("Error archiving category", {
        description: handleSupabaseError(error),
      });
    },
  });
}

/**
 * Hook to restore an archived expense category
 */
export function useRestoreExpenseCategory() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db.expenseCategories.restore(id);
      if (error) throw error;
      return data as ExpenseCategoryConfig;
    },
    onSettled: () => afterWrite("expense_categories"),
    onSuccess: (data) => {
      toast.success("Category restored", {
        description: `${data.name} has been restored.`,
      });
    },
    onError: (error) => {
      toast.error("Error restoring category", {
        description: handleSupabaseError(error),
      });
    },
  });
}
