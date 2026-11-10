import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { afterWrite } from "@/lib/after-write";

import {
  useCreateAccount,
  useDeleteAccount,
  useReactivateAccount,
  useUpdateAccount,
} from "../useAccounts";
import { useCreateExpense, useDeleteExpense, useUpdateExpense } from "../useExpenses";
import { useCreateTransfer, useDeleteTransfer } from "../useTransfers";

vi.mock("@/lib/after-write", () => ({ afterWrite: vi.fn() }));

const supabaseResult = vi.hoisted(() => ({ error: null as { message: string } | null }));

vi.mock("@/lib/supabase", () => {
  const settle = () => ({ data: { expense_date: "2026-11-06" }, error: supabaseResult.error });
  const builder: Record<string, unknown> = {
    then: (resolve: (result: ReturnType<typeof settle>) => unknown) => resolve(settle()),
  };
  for (const method of ["insert", "update", "delete", "select", "eq", "single"]) {
    builder[method] = () => builder;
  }
  return {
    db: {},
    supabase: { from: () => builder, rpc: async () => ({ data: "TRF-1", error: null }) },
    handleSupabaseError: (error: { message: string }) => error.message,
  };
});

const mutations = [
  ["useCreateAccount", useCreateAccount, { account_name: "Cash" }, "accounts"],
  ["useUpdateAccount", useUpdateAccount, { accountId: "a1", updates: {} }, "accounts"],
  ["useDeleteAccount", useDeleteAccount, "a1", "accounts"],
  ["useReactivateAccount", useReactivateAccount, "a1", "accounts"],
  ["useCreateTransfer", useCreateTransfer, { amount: 100 }, "account_transfers"],
  ["useDeleteTransfer", useDeleteTransfer, "t1", "account_transfers"],
  ["useCreateExpense", useCreateExpense, { data: { amount: 100 } }, "expenses"],
  ["useUpdateExpense", useUpdateExpense, { expenseId: "e1", updates: {} }, "expenses"],
  ["useDeleteExpense", useDeleteExpense, "e1", "expenses"],
] as const;

const runMutation = async (useHook: () => { mutate: (input: never) => void }, input: unknown) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useHook(), { wrapper });
  result.current.mutate(input as never);
  await waitFor(() => expect(afterWrite).toHaveBeenCalled());
};

describe("money mutations report their writes", () => {
  beforeEach(() => {
    vi.mocked(afterWrite).mockClear();
  });

  it.each(mutations)("%s reports its table after a save", async (_, useHook, input, table) => {
    supabaseResult.error = null;
    await runMutation(useHook as never, input);
    expect(afterWrite).toHaveBeenCalledExactlyOnceWith(table);
  });

  it.each(mutations)(
    "%s reports its table after a failed save",
    async (_, useHook, input, table) => {
      supabaseResult.error = { message: "boom" };
      await runMutation(useHook as never, input);
      expect(afterWrite).toHaveBeenCalledExactlyOnceWith(table);
    }
  );
});
