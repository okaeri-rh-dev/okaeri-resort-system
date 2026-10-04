import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { handleSupabaseError, supabase } from "@/lib/supabase";
import type { AccountTransfer } from "@/types";
import type { TablesInsert } from "@/types/database.types";

// ============================================
// ZUSTAND STORE
// ============================================
interface TransferFilters {
  fromAccountId?: string;
  toAccountId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

interface TransferStore {
  // Local state
  selectedTransfer: AccountTransfer | null;
  filters: TransferFilters;
  searchQuery: string;
  sortBy: "date" | "amount" | "from" | "to";
  sortOrder: "asc" | "desc";

  // Actions
  setSelectedTransfer: (transfer: AccountTransfer | null) => void;
  setFilters: (filters: TransferFilters) => void;
  resetFilters: () => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "date" | "amount" | "from" | "to") => void;
  setSortOrder: (order: "asc" | "desc") => void;

  // Optimistic updates
  optimisticTransfers: Map<string, AccountTransfer>;
  addOptimisticTransfer: (transfer: AccountTransfer) => void;
  removeOptimisticTransfer: (transferId: string) => void;
  clearOptimisticTransfers: () => void;
}

export const useTransferStore = create<TransferStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedTransfer: null,
        filters: {},
        searchQuery: "",
        sortBy: "date",
        sortOrder: "desc",
        optimisticTransfers: new Map(),

        // Actions
        setSelectedTransfer: (transfer) => set({ selectedTransfer: transfer }),

        setFilters: (filters) => set({ filters }),

        resetFilters: () => set({ filters: {} }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),

        addOptimisticTransfer: (transfer) =>
          set((state) => {
            const newMap = new Map(state.optimisticTransfers);
            newMap.set(transfer.transfer_id, transfer);
            return { optimisticTransfers: newMap };
          }),

        removeOptimisticTransfer: (transferId) =>
          set((state) => {
            const newMap = new Map(state.optimisticTransfers);
            newMap.delete(transferId);
            return { optimisticTransfers: newMap };
          }),

        clearOptimisticTransfers: () => set({ optimisticTransfers: new Map() }),
      }),
      {
        name: "transfer-store",
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

// Fetch all transfers with account relations
export const useTransfers = () => {
  const { filters, searchQuery, sortBy, sortOrder } = useTransferStore();

  return useQuery({
    queryKey: ["transfers", filters, searchQuery, sortBy, sortOrder],
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
        query = query.or(`
          transfer_reference.ilike.%${searchQuery}%,
          notes.ilike.%${searchQuery}%
        `);
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

// Fetch single transfer
export const useTransfer = (transferId: string) => {
  return useQuery({
    queryKey: ["transfers", transferId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_transfers")
        .select(
          `
          *,
          from_account:accounts!account_transfers_from_account_id_fkey(*),
          to_account:accounts!account_transfers_to_account_id_fkey(*)
        `
        )
        .eq("transfer_id", transferId)
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data as AccountTransfer;
    },
    enabled: !!transferId,
    staleTime: 60000,
  });
};

// Fetch transfers for a specific account (both incoming and outgoing)
export const useAccountTransfers = (accountId: string) => {
  return useQuery({
    queryKey: ["transfers", "account", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_transfers")
        .select(
          `
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
        `
        )
        .or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`)
        .order("transfer_date", { ascending: false });

      if (error) throw new Error(handleSupabaseError(error));
      return (data || []) as AccountTransfer[];
    },
    enabled: !!accountId,
    staleTime: 60000,
  });
};

// Create transfer
export const useCreateTransfer = () => {
  const queryClient = useQueryClient();
  const addOptimistic = useTransferStore((state) => state.addOptimisticTransfer);

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
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["transfers"] });
      await queryClient.cancelQueries({ queryKey: ["accounts", "balances"] });

      const optimisticTransfer: AccountTransfer = {
        ...data,
        transfer_id: `temp-${Date.now()}`,
        transfer_reference: `TRF-PENDING`,
        created_at: new Date().toISOString(),
      };

      addOptimistic(optimisticTransfer);

      return { optimisticTransfer };
    },
    onError: (_, __, context) => {
      if (context?.optimisticTransfer) {
        useTransferStore
          .getState()
          .removeOptimisticTransfer(context.optimisticTransfer.transfer_id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts", "balances"] });
    },
  });
};

// Delete transfer (for corrections)
export const useDeleteTransfer = () => {
  const queryClient = useQueryClient();
  const removeOptimistic = useTransferStore((state) => state.removeOptimisticTransfer);

  return useMutation({
    mutationFn: async (transferId: string) => {
      const { error } = await supabase
        .from("account_transfers")
        .delete()
        .eq("transfer_id", transferId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onMutate: async (transferId) => {
      await queryClient.cancelQueries({ queryKey: ["transfers"] });
      await queryClient.cancelQueries({ queryKey: ["accounts", "balances"] });
      removeOptimistic(transferId);
      return { transferId };
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts", "balances"] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts", "balances"] });
    },
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Format transfer direction for display
export const getTransferDirection = (
  transfer: AccountTransfer,
  accountId: string
): "incoming" | "outgoing" => {
  return transfer.to_account_id === accountId ? "incoming" : "outgoing";
};

// Get CSS class for transfer direction
export const getTransferDirectionClass = (direction: "incoming" | "outgoing"): string => {
  return direction === "incoming" ? "text-green-600" : "text-red-600";
};

// Format transfer amount with direction sign
export const formatTransferAmount = (
  amount: number,
  direction: "incoming" | "outgoing"
): string => {
  const sign = direction === "incoming" ? "+" : "-";
  return `${sign}₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
