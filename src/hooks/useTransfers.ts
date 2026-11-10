import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import { afterWrite } from "@/lib/after-write";
import { transferKeys } from "@/lib/query-keys";
import { ilikeAnyFilter } from "@/lib/search-filter";
import { handleSupabaseError, supabase } from "@/lib/supabase";
import type { AccountTransfer } from "@/types";
import type { TablesInsert } from "@/types/database.types";

interface TransferFilters {
  fromAccountId?: string;
  toAccountId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

const transferListQuery = ({
  filters = {},
  searchQuery = "",
  sortBy = "date",
  sortOrder = "desc",
}: {
  filters?: TransferFilters;
  searchQuery?: string;
  sortBy?: "date" | "amount" | "from" | "to";
  sortOrder?: "asc" | "desc";
} = {}) => {
  return queryOptions({
    queryKey: transferKeys.list({ filters, searchQuery, sortBy, sortOrder }),
    queryFn: async () => {
      let query = supabase.from("account_transfers").select(`
        *,
        from_account:accounts!account_transfers_from_account_id_fkey(
          account_id,
          account_name,
          account_code,
          account_type
        ),
        to_account:accounts!account_transfers_to_account_id_fkey(
          account_id,
          account_name,
          account_code,
          account_type
        )
      `);

      // Apply filters
      if (filters.fromAccountId) {
        query = query.eq("from_account_id", filters.fromAccountId);
      }
      if (filters.toAccountId) {
        query = query.eq("to_account_id", filters.toAccountId);
      }
      if (filters.dateFrom) {
        query = query.gte("transfer_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("transfer_date", filters.dateTo);
      }
      if (filters.minAmount) {
        query = query.gte("amount", filters.minAmount);
      }
      if (filters.maxAmount) {
        query = query.lte("amount", filters.maxAmount);
      }

      // Apply search
      if (searchQuery) {
        query = query.or(ilikeAnyFilter(["transfer_reference", "notes"], searchQuery));
      }

      // Apply sorting
      const column = {
        date: "transfer_date",
        amount: "amount",
        from: "from_account_id",
        to: "to_account_id",
      }[sortBy];

      query = query.order(column, { ascending: sortOrder === "asc" });

      const { data, error } = await query;
      if (error) throw new Error(handleSupabaseError(error));

      return (data || []) as AccountTransfer[];
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });
};

// Fetch all transfers with account relations
export const useTransfers = () => useQuery(transferListQuery());

// Create transfer
export const useCreateTransfer = () => {
  return useMutation({
    mutationFn: async (
      data: Omit<AccountTransfer, "transfer_id" | "transfer_reference" | "created_at">
    ) => {
      // Generate transfer reference using database function
      const { data: reference, error: refError } = await supabase.rpc(
        "generate_transfer_reference"
      );

      if (refError) throw new Error(handleSupabaseError(refError));

      const { data: newTransfer, error } = await supabase
        .from("account_transfers")
        .insert({
          transfer_reference: reference || `TRF-${Date.now()}`,
          from_account_id: data.from_account_id,
          to_account_id: data.to_account_id,
          amount: data.amount,
          transfer_date: data.transfer_date || new Date().toISOString(),
          notes: data.notes || null,
        } satisfies TablesInsert<"account_transfers">)
        .select(
          `
          *,
          from_account:accounts!account_transfers_from_account_id_fkey(*),
          to_account:accounts!account_transfers_to_account_id_fkey(*)
        `
        )
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return newTransfer as AccountTransfer;
    },
    onSettled: () => afterWrite("account_transfers"),
  });
};

// Delete transfer (for corrections)
export const useDeleteTransfer = () => {
  return useMutation({
    mutationFn: async (transferId: string) => {
      const { error } = await supabase
        .from("account_transfers")
        .delete()
        .eq("transfer_id", transferId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onSettled: () => afterWrite("account_transfers"),
  });
};
