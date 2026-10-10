import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePayments, usePaymentStore } from "../usePaymentStore";

const rows = [
  {
    payment_id: "p-1",
    notes: "Downpayment",
    booking: { booking_reference: "BK-1001", guest_name: "Maria Santos" },
  },
  {
    payment_id: "p-2",
    notes: null,
    booking: { booking_reference: "BK-1002", guest_name: "Jose Rizal" },
  },
];
const orderSpy = vi.fn();

vi.mock("@/lib/supabase", () => {
  const builder = {
    select: () => builder,
    neq: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    or: () => {
      throw new Error("search must not be sent as a PostgREST filter");
    },
    order: (column: string) => {
      orderSpy(column);
      return builder;
    },
    then: (resolve: (result: { data: typeof rows; error: null }) => unknown) =>
      resolve({ data: rows, error: null }),
  };
  return {
    supabase: { from: () => builder },
    supabaseAuth: {},
    handleSupabaseError: (error: { message: string }) => error.message,
  };
});

const renderPayments = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePayments(), { wrapper });
};

describe("usePayments", () => {
  beforeEach(() => {
    orderSpy.mockClear();
    act(() => {
      usePaymentStore.setState({ searchQuery: "", sortBy: "date", sortOrder: "desc", filters: {} });
    });
  });

  it("searches by booking reference, guest name and notes", async () => {
    act(() => usePaymentStore.getState().setSearchQuery("jose"));
    const { result } = renderPayments();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((payment) => payment.payment_id)).toEqual(["p-2"]);
  });

  it("matches notes and booking references case-insensitively", async () => {
    act(() => usePaymentStore.getState().setSearchQuery("DOWN"));
    const { result } = renderPayments();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((payment) => payment.payment_id)).toEqual(["p-1"]);
  });

  it("sorts by the payment's own status column", async () => {
    act(() => usePaymentStore.getState().setSortBy("status"));
    const { result } = renderPayments();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orderSpy).toHaveBeenCalledWith("status");
  });
});
