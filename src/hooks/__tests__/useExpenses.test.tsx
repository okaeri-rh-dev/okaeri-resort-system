import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExpenseStore } from "@/stores/useExpenseStore";

import { useExpenses } from "../useExpenses";

const searchSpy = vi.fn();

vi.mock("@/lib/supabase", () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    or: (filter: string) => {
      searchSpy(filter);
      return builder;
    },
    order: () => builder,
    then: (resolve: (result: { data: never[]; error: null }) => unknown) =>
      resolve({ data: [], error: null }),
  };
  return {
    db: {},
    supabase: { from: () => builder },
    handleSupabaseError: (error: { message: string }) => error.message,
  };
});

const renderExpenses = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useExpenses(), { wrapper });
};

const typeThenWait = async (query: string, thenWaitMs: number) => {
  await act(async () => {
    useExpenseStore.getState().setSearchQuery(query);
    await vi.advanceTimersByTimeAsync(thenWaitMs);
  });
};

describe("useExpenses", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers();
    act(() => {
      useExpenseStore.setState({ searchQuery: "", sortBy: "date", sortOrder: "desc", filters: {} });
    });
    searchSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("only searches once typing pauses for 300 ms", async () => {
    renderExpenses();

    await typeThenWait("c", 100);
    await typeThenWait("co", 100);
    await typeThenWait("cof", 299);

    expect(searchSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy.mock.calls[0][0]).toContain("cof");
  });
});
