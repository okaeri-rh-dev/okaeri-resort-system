import React from "react";

import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAllBookings } from "../useBookingStore";

const listFetches = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/lib/supabase", () => {
  const builder: Record<string, unknown> = {
    then: (resolve: (result: { data: never[]; error: null }) => unknown) => {
      listFetches.count += 1;
      return resolve({ data: [], error: null });
    },
  };
  builder.select = () => builder;
  builder.order = () => builder;
  return {
    db: {},
    supabase: { from: () => builder },
    handleSupabaseError: (error: { message: string }) => error.message,
  };
});

const MINUTE = 60_000;

function renderList() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAllBookings(), { wrapper });
}

describe("the bookings list refresh", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers();
    listFetches.count = 0;
    focusManager.setFocused(true);
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  it("refetches every 30 minutes", async () => {
    renderList();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(listFetches.count).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(30 * MINUTE));
    expect(listFetches.count).toBe(2);
  });

  it("refetches when the window regains focus", async () => {
    renderList();
    await act(() => vi.advanceTimersByTimeAsync(10 * MINUTE));
    expect(listFetches.count).toBe(1);

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(listFetches.count).toBe(2);
  });
});
