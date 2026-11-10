import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import { afterWrite } from "@/lib/after-write";
import { accountKeys } from "@/lib/query-keys";
import { handleSupabaseError, supabase } from "@/lib/supabase";
import type { Account, AccountType, AccountWithBalance } from "@/types";
import type { TablesInsert, TablesUpdate } from "@/types/database.types";

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

const ACCOUNT_TYPES: readonly AccountType[] = ["Bank", "E-Wallet", "Cash"];

const isAccountType = (value: string): value is AccountType =>
  ACCOUNT_TYPES.some((accountType) => accountType === value);

const accountBalancesQuery = (asOfDate?: Date) =>
  queryOptions({
    queryKey: accountKeys.balancesAsOf(asOfDate?.toISOString()),
    queryFn: async (): Promise<AccountWithBalance[]> => {
      const { data, error } = await supabase.rpc("get_all_account_balances", {
        p_as_of_date: asOfDate?.toISOString() || new Date().toISOString(),
      });

      if (error) throw new Error(handleSupabaseError(error));
      return (data ?? []).map((row) => {
        if (!isAccountType(row.account_type)) {
          throw new Error(`Unknown account type: ${row.account_type}`);
        }
        return { ...row, account_type: row.account_type };
      });
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
    onSettled: () => afterWrite("accounts"),
  });
};

// Update account
export const useUpdateAccount = () => {
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
    onSettled: () => afterWrite("accounts"),
  });
};

// Delete account (soft delete - set is_active to false)
export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: async (accountId: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from("accounts")
        .update({ is_active: false } satisfies TablesUpdate<"accounts">)
        .eq("account_id", accountId);

      if (error) throw new Error(handleSupabaseError(error));
    },
    onSettled: () => afterWrite("accounts"),
  });
};

// Reactivate account
export const useReactivateAccount = () => {
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
    onSettled: () => afterWrite("accounts"),
  });
};
