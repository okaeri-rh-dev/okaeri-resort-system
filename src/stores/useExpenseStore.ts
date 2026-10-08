import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { expenseKeys } from "@/lib/query-keys";
import { uploadReceipt } from "@/lib/storage-security";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import { toISODateString } from "@/lib/timezone";
import type { Expense } from "@/types";
import type { TablesInsert } from "@/types/database.types";

// ============================================
// EXPENSE CATEGORIES
// ============================================

/**
 * @deprecated Use `useActiveExpenseCategories()` from `@/hooks/useExpenseCategories` instead.
 * Categories are now managed in the database via the expense_categories table.
 */
export const EXPENSE_CATEGORIES = [
  "Utilities",
  "Maintenance & Repairs",
  "Supplies & Inventory",
  "Staff & Payroll",
  "Marketing & Advertising",
  "Food & Beverage",
  "Cleaning & Laundry",
  "Insurance & Permits",
  "Professional Services",
  "Other",
] as const;

/**
 * @deprecated Use `string` type instead. Categories are now database-driven.
 */
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// ============================================
// ZUSTAND STORE
// ============================================
export interface ExpenseFilters {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

interface ExpenseStore {
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

  // Optimistic updates
  optimisticExpenses: Map<string, Expense>;
  addOptimisticExpense: (expense: Expense) => void;
  updateOptimisticExpense: (expenseId: string, updates: Partial<Expense>) => void;
  removeOptimisticExpense: (expenseId: string) => void;
  clearOptimisticExpenses: () => void;
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
        optimisticExpenses: new Map(),

        // Actions
        setSelectedExpense: (expense) => set({ selectedExpense: expense }),

        setFilters: (filters) => set({ filters }),

        resetFilters: () => set({ filters: {} }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),

        addOptimisticExpense: (expense) =>
          set((state) => {
            const newMap = new Map(state.optimisticExpenses);
            newMap.set(expense.expense_id, expense);
            return { optimisticExpenses: newMap };
          }),

        updateOptimisticExpense: (expenseId, updates) =>
          set((state) => {
            const newMap = new Map(state.optimisticExpenses);
            const existing = newMap.get(expenseId);
            if (existing) {
              newMap.set(expenseId, { ...existing, ...updates });
            }
            return { optimisticExpenses: newMap };
          }),

        removeOptimisticExpense: (expenseId) =>
          set((state) => {
            const newMap = new Map(state.optimisticExpenses);
            newMap.delete(expenseId);
            return { optimisticExpenses: newMap };
          }),

        clearOptimisticExpenses: () => set({ optimisticExpenses: new Map() }),
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

// ============================================
// TANSTACK QUERY HOOKS
// ============================================

// One expense with `date` mapped from expense_date; the detail and edit routes and useEntityEdit share this cache entry
export const expenseDetailQuery = (expenseId: string) =>
  queryOptions({
    queryKey: expenseKeys.detail(expenseId),
    queryFn: async () => {
      const { data, error } = await db.expenses.byId(expenseId);
      if (error) throw new Error(`Failed to load expense: ${handleSupabaseError(error)}`);
      return { ...data, date: data.expense_date };
    },
    staleTime: 30000,
  });

// Fetch all expenses
export const useExpenses = () => {
  const { filters, searchQuery, sortBy, sortOrder } = useExpenseStore();

  return useQuery({
    queryKey: expenseKeys.list({ filters, searchQuery, sortBy, sortOrder }),
    queryFn: async () => {
      let query = supabase.from("expenses").select("*");

      // Apply filters
      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.dateFrom) {
        query = query.gte("expense_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("expense_date", filters.dateTo);
      }
      if (filters.minAmount) {
        query = query.gte("amount", filters.minAmount);
      }
      if (filters.maxAmount) {
        query = query.lte("amount", filters.maxAmount);
      }

      // Apply search
      if (searchQuery) {
        query = query.or(`
          description.ilike.%${searchQuery}%,
          category.ilike.%${searchQuery}%,
          notes.ilike.%${searchQuery}%
        `);
      }

      // Apply sorting
      const column = {
        date: "expense_date",
        amount: "amount",
        category: "category",
        description: "description",
      }[sortBy];

      query = query.order(column, { ascending: sortOrder === "asc" });

      const { data, error } = await query;
      if (error) throw new Error(handleSupabaseError(error));

      // Map expense_date to date for compatibility with the Expense interface
      return (data || []).map((expense) => ({
        expense_id: expense.expense_id,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        date: expense.expense_date,
        receipt_url: expense.receipt_url || null,
        notes: expense.notes || null,
        created_at: expense.created_at || "",
        updated_at: expense.updated_at || "",
      })) as Expense[];
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });
};

// Fetch single expense
export const useExpense = (expenseId: string) => {
  return useQuery({ ...expenseDetailQuery(expenseId), enabled: !!expenseId });
};

// Fetch expense statistics
export const useExpenseStats = (dateRange?: { from: Date; to: Date }) => {
  return useQuery({
    queryKey: expenseKeys.stats(dateRange),
    queryFn: async () => {
      let query = supabase.from("expenses").select("amount, category, expense_date");

      if (dateRange) {
        query = query
          .gte("expense_date", toISODateString(dateRange.from))
          .lte("expense_date", toISODateString(dateRange.to));
      }

      const { data, error } = await query;
      if (error) throw new Error(handleSupabaseError(error));

      // Map expense_date to date for consistency
      const expenses = (data || []).map((expense) => ({
        ...expense,
        date: expense.expense_date,
      }));

      // Calculate statistics
      const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalCount = expenses.length;

      // Group by category
      const byCategory = expenses.reduce(
        (acc, expense) => {
          acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
          return acc;
        },
        {} as Record<string, number>
      );

      // Calculate monthly trends if date range is provided
      const monthlyTrends = dateRange
        ? expenses.reduce(
            (acc, expense) => {
              const month = expense.date.substring(0, 7); // YYYY-MM
              acc[month] = (acc[month] || 0) + expense.amount;
              return acc;
            },
            {} as Record<string, number>
          )
        : {};

      return {
        totalAmount,
        totalCount,
        averageAmount: totalCount > 0 ? totalAmount / totalCount : 0,
        byCategory,
        monthlyTrends,
      };
    },
    staleTime: 300000, // 5 minutes
  });
};

// Create expense
export const useCreateExpense = () => {
  const queryClient = useQueryClient();
  const addOptimistic = useExpenseStore((state) => state.addOptimisticExpense);

  return useMutation({
    mutationFn: async ({
      data,
      receiptFile,
    }: {
      data: Omit<Expense, "expense_id" | "created_at" | "updated_at">;
      receiptFile?: File;
    }) => {
      let receipt_url = data.receipt_url;

      // Upload receipt if provided
      if (receiptFile) {
        const uploadResult = await uploadReceipt(receiptFile, "expense-receipts");
        receipt_url = uploadResult.url;
      }

      // Map date to expense_date for database insertion
      const { date, ...restData } = data;
      const { data: newExpense, error } = await supabase
        .from("expenses")
        .insert({
          ...restData,
          description: restData.description || "",
          expense_date: date,
          receipt_url,
        } satisfies TablesInsert<"expenses">)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      // Map expense_date back to date for consistency
      return { ...newExpense, date: newExpense.expense_date };
    },
    onMutate: async ({ data }) => {
      await queryClient.cancelQueries({ queryKey: expenseKeys.all });

      const optimisticExpense: Expense = {
        ...data,
        expense_id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      addOptimistic(optimisticExpense);

      return { optimisticExpense };
    },
    onError: (_, __, context) => {
      if (context?.optimisticExpense) {
        useExpenseStore.getState().removeOptimisticExpense(context.optimisticExpense.expense_id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
};

// Update expense
export const useUpdateExpense = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useExpenseStore((state) => state.updateOptimisticExpense);

  return useMutation({
    mutationFn: async ({
      expenseId,
      updates,
      receiptFile,
    }: {
      expenseId: string;
      updates: Partial<Omit<Expense, "expense_id" | "created_at" | "updated_at">>;
      receiptFile?: File;
    }) => {
      let receipt_url = updates.receipt_url;

      // Upload new receipt if provided
      if (receiptFile) {
        const uploadResult = await uploadReceipt(receiptFile, "expense-receipts");
        receipt_url = uploadResult.url;
      }

      // Map date to expense_date if it exists in updates
      const { date, ...restUpdates } = updates;
      const dbUpdates: Record<string, unknown> = {
        ...restUpdates,
        receipt_url,
      };
      if (date !== undefined) {
        dbUpdates.expense_date = date;
      }

      const { data, error } = await supabase
        .from("expenses")
        .update(dbUpdates)
        .eq("expense_id", expenseId)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      // Map expense_date back to date for consistency
      return { ...data, date: data.expense_date };
    },
    onMutate: async ({ expenseId, updates }) => {
      await queryClient.cancelQueries({ queryKey: expenseKeys.all });

      const previousExpense = queryClient.getQueryData<Expense>(expenseKeys.detail(expenseId));

      updateOptimistic(expenseId, updates);

      return { previousExpense };
    },
    onError: (_, { expenseId }, context) => {
      if (context?.previousExpense) {
        updateOptimistic(expenseId, context.previousExpense);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
};

// Delete expense
export const useDeleteExpense = () => {
  const queryClient = useQueryClient();
  const removeOptimistic = useExpenseStore((state) => state.removeOptimisticExpense);

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from("expenses").delete().eq("expense_id", expenseId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onMutate: async (expenseId) => {
      await queryClient.cancelQueries({ queryKey: expenseKeys.all });
      removeOptimistic(expenseId);
      return { expenseId };
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
};

// Export expenses
export const useExportExpenses = () => {
  return useMutation({
    mutationFn: async (dateRange?: { from: Date; to: Date }) => {
      let query = supabase.from("expenses").select("*");

      if (dateRange) {
        query = query
          .gte("expense_date", toISODateString(dateRange.from))
          .lte("expense_date", toISODateString(dateRange.to));
      }

      const { data, error } = await query.order("expense_date", { ascending: false });

      if (error) throw new Error(handleSupabaseError(error));

      // Map database rows to Expense format and convert to CSV
      const expenses: Expense[] = (data || []).map((row) => ({
        expense_id: row.expense_id,
        category: row.category,
        description: row.description,
        amount: row.amount,
        date: row.expense_date,
        receipt_url: row.receipt_url || null,
        notes: row.notes || null,
        created_at: row.created_at || "",
        updated_at: row.updated_at || "",
      }));
      const csv = convertToCSV(expenses);
      downloadCSV(csv, `expenses-${toISODateString(new Date())}.csv`);
    },
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function convertToCSV(data: Expense[]): string {
  if (data.length === 0) return "";

  const headers = [
    "Expense Date",
    "Category",
    "Description",
    "Amount (PHP)",
    "Receipt URL",
    "Notes",
    "Created At",
  ];

  const rows = data.map((expense) => [
    expense.date,
    expense.category,
    expense.description || "",
    expense.amount.toFixed(2),
    expense.receipt_url || "",
    expense.notes || "",
    expense.created_at,
  ]);

  return [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
