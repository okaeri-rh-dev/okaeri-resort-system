import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { accountKeys } from "@/lib/query-keys";
import { handleSupabaseError, supabase } from "@/lib/supabase";
import type { Account, AccountType, AccountWithBalance } from "@/types";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

// ============================================
// ZUSTAND STORE
// ============================================
interface AccountFilters {
  accountType?: AccountType;
  isActive?: boolean;
}

interface AccountStore {
  // Local state
  selectedAccount: Account | null;
  filters: AccountFilters;
  searchQuery: string;
  sortBy: "name" | "balance" | "type" | "created";
  sortOrder: "asc" | "desc";

  // Actions
  setSelectedAccount: (account: Account | null) => void;
  setFilters: (filters: AccountFilters) => void;
  resetFilters: () => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: "name" | "balance" | "type" | "created") => void;
  setSortOrder: (order: "asc" | "desc") => void;

  // Optimistic updates
  optimisticAccounts: Map<string, Account>;
  addOptimisticAccount: (account: Account) => void;
  updateOptimisticAccount: (accountId: string, updates: Partial<Account>) => void;
  removeOptimisticAccount: (accountId: string) => void;
  clearOptimisticAccounts: () => void;
}

export const useAccountStore = create<AccountStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedAccount: null,
        filters: { isActive: true },
        searchQuery: "",
        sortBy: "name",
        sortOrder: "asc",
        optimisticAccounts: new Map(),

        // Actions
        setSelectedAccount: (account) => set({ selectedAccount: account }),

        setFilters: (filters) => set({ filters }),

        resetFilters: () => set({ filters: { isActive: true } }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSortBy: (sortBy) => set({ sortBy }),

        setSortOrder: (order) => set({ sortOrder: order }),

        addOptimisticAccount: (account) =>
          set((state) => {
            const newMap = new Map(state.optimisticAccounts);
            newMap.set(account.account_id, account);
            return { optimisticAccounts: newMap };
          }),

        updateOptimisticAccount: (accountId, updates) =>
          set((state) => {
            const newMap = new Map(state.optimisticAccounts);
            const existing = newMap.get(accountId);
            if (existing) {
              newMap.set(accountId, { ...existing, ...updates });
            }
            return { optimisticAccounts: newMap };
          }),

        removeOptimisticAccount: (accountId) =>
          set((state) => {
            const newMap = new Map(state.optimisticAccounts);
            newMap.delete(accountId);
            return { optimisticAccounts: newMap };
          }),

        clearOptimisticAccounts: () => set({ optimisticAccounts: new Map() }),
      }),
      {
        name: "account-store",
        partialize: (state) => ({
          filters: state.filters,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
        }),
      }
    )
  )
);

// Fetch all accounts

const activeAccountsQuery = () =>
  queryOptions({
    queryKey: accountKeys.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("account_name", { ascending: true });

      if (error) throw new Error(handleSupabaseError(error));
      return (data || []) as Account[];
    },
    staleTime: 300000, // 5 minutes - accounts don't change often
    refetchOnWindowFocus: false,
  });

// Fetch active accounts only (for selectors)
export const useActiveAccounts = () => useQuery(activeAccountsQuery());

const accountDetailQuery = (accountId: string) =>
  queryOptions({
    queryKey: accountKeys.detail(accountId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("account_id", accountId)
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data as Account;
    },
    staleTime: 60000,
  });

// Fetch single account

const accountBalancesQuery = (asOfDate?: Date) =>
  queryOptions({
    queryKey: accountKeys.balancesAsOf(asOfDate?.toISOString()),
    queryFn: async (): Promise<AccountWithBalance[]> => {
      const { data, error } = await supabase.rpc("get_all_account_balances", {
        p_as_of_date: asOfDate?.toISOString() || new Date().toISOString(),
      });

      if (error) throw new Error(handleSupabaseError(error));
      // accounts_account_type_check limits account_type to the AccountType values
      return (data ?? []).map((row) => ({ ...row, account_type: row.account_type as AccountType }));
    },
    staleTime: 30000, // 30 seconds - balances can change frequently
    refetchOnWindowFocus: true,
  });

// Fetch all accounts with calculated balances
export const useAccountBalances = (asOfDate?: Date) => useQuery(accountBalancesQuery(asOfDate));

const selectActiveAccounts = (accounts: AccountWithBalance[]) =>
  accounts.filter((account) => account.is_active);

export const useActiveAccountBalances = (asOfDate?: Date) =>
  useQuery({ ...accountBalancesQuery(asOfDate), select: selectActiveAccounts });

// Create account
export const useCreateAccount = () => {
  const queryClient = useQueryClient();
  const addOptimistic = useAccountStore((state) => state.addOptimisticAccount);

  return useMutation({
    mutationFn: async (data: Omit<Account, "account_id" | "created_at" | "updated_at">) => {
      const { data: newAccount, error } = await supabase
        .from("accounts")
        .insert({
          account_name: data.account_name,
          account_code: data.account_code,
          account_type: data.account_type,
          description: data.description || null,
          initial_balance: data.initial_balance || 0,
          is_active: data.is_active ?? true,
          display_order: data.display_order || 0,
        } satisfies TablesInsert<"accounts">)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return newAccount as Account;
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: accountKeys.all });

      const optimisticAccount: Account = {
        ...data,
        account_id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      addOptimistic(optimisticAccount);

      return { optimisticAccount };
    },
    onError: (_, __, context) => {
      if (context?.optimisticAccount) {
        useAccountStore.getState().removeOptimisticAccount(context.optimisticAccount.account_id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
};

// Update account
export const useUpdateAccount = () => {
  const queryClient = useQueryClient();
  const updateOptimistic = useAccountStore((state) => state.updateOptimisticAccount);

  return useMutation({
    mutationFn: async ({
      accountId,
      updates,
    }: {
      accountId: string;
      updates: Partial<Omit<Account, "account_id" | "created_at" | "updated_at">>;
    }) => {
      const { data, error } = await supabase
        .from("accounts")
        .update(updates)
        .eq("account_id", accountId)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data as Account;
    },
    onMutate: async ({ accountId, updates }) => {
      await queryClient.cancelQueries({ queryKey: accountKeys.all });

      const previousAccount = queryClient.getQueryData(accountDetailQuery(accountId).queryKey);

      updateOptimistic(accountId, updates);

      return { previousAccount };
    },
    onError: (_, { accountId }, context) => {
      if (context?.previousAccount) {
        updateOptimistic(accountId, context.previousAccount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
};

// Delete account (soft delete - set is_active to false)
export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  const removeOptimistic = useAccountStore((state) => state.removeOptimisticAccount);

  return useMutation({
    mutationFn: async (accountId: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("accounts")
        .update({ is_active: false } satisfies TablesUpdate<"accounts">)
        .eq("account_id", accountId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onMutate: async (accountId) => {
      await queryClient.cancelQueries({ queryKey: accountKeys.all });
      removeOptimistic(accountId);
      return { accountId };
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
};

// Reactivate account
export const useReactivateAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase
        .from("accounts")
        .update({ is_active: true } satisfies TablesUpdate<"accounts">)
        .eq("account_id", accountId)
        .select()
        .single();

      if (error) throw new Error(handleSupabaseError(error));
      return data as Account;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
};
