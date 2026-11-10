import { keepPreviousData, queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/useDebouncedValue";
import { afterWrite } from "@/lib/after-write";
import { throwDetailLoadError } from "@/lib/detail-load-error";
import { expenseKeys } from "@/lib/query-keys";
import { ilikeAnyFilter } from "@/lib/search-filter";
import { uploadReceipt } from "@/lib/storage-security";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import { toISODateString } from "@/lib/timezone";
import { useExpenseStore, type ExpenseStore } from "@/stores/useExpenseStore";
import type { Expense } from "@/types";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

// One expense with `date` mapped from expense_date; the detail and edit routes and useEntityEdit share this cache entry
export const expenseDetailQuery = (expenseId: string) =>
  queryOptions({
    queryKey: expenseKeys.detail(expenseId),
    queryFn: async () => {
      const { data, error } = await db.expenses.byId(expenseId);
      if (error) throwDetailLoadError(error, "expense");
      return { ...data, date: data.expense_date };
    },
    staleTime: 30000,
  });

// Fetch all expenses
const expenseListQuery = ({
  filters,
  searchQuery,
  sortBy,
  sortOrder,
}: Pick<ExpenseStore, "filters" | "searchQuery" | "sortBy" | "sortOrder">) =>
  queryOptions({
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
        query = query.or(ilikeAnyFilter(["description", "category", "notes"], searchQuery));
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
    placeholderData: keepPreviousData,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });

export const useExpenses = () => {
  const { filters, searchQuery, sortBy, sortOrder } = useExpenseStore();
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  return useQuery(
    expenseListQuery({ filters, searchQuery: debouncedSearchQuery, sortBy, sortOrder })
  );
};

// Fetch single expense

// Fetch expense statistics
const expenseStatsQuery = (dateRange?: { from: Date; to: Date }) =>
  queryOptions({
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

export const useExpenseStats = (dateRange?: { from: Date; to: Date }) => {
  return useQuery(expenseStatsQuery(dateRange));
};

// Create expense
export const useCreateExpense = () => {
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
      const { date, account: _account, ...restData } = data;
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
    onSettled: () => afterWrite("expenses"),
  });
};

// Update expense
export const useUpdateExpense = () => {
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
      const { date, description, account: _account, ...restUpdates } = updates;
      const dbUpdates: TablesUpdate<"expenses"> = {
        ...restUpdates,
        receipt_url,
      };
      if (date !== undefined) {
        dbUpdates.expense_date = date;
      }
      if (description !== undefined) {
        dbUpdates.description = description ?? "";
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
    onSettled: () => afterWrite("expenses"),
  });
};

// Delete expense
export const useDeleteExpense = () => {
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from("expenses").delete().eq("expense_id", expenseId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onSettled: () => afterWrite("expenses"),
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
