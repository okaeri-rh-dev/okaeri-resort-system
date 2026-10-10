import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdatePayment } from "../usePaymentStore";

const updateSpy = vi.fn();

vi.mock("@/lib/supabase", () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: () => Promise.resolve({ data: { payment_id: "p-1", booking_id: "b-1" }, error: null }),
    update: (payload: unknown) => {
      updateSpy(payload);
      return builder;
    },
  };
  return {
    supabase: { from: () => builder },
    handleSupabaseError: (error: { message: string }) => error.message,
  };
});

vi.mock("@/lib/storage-security", () => ({
  uploadPaymentProof: vi.fn(() => Promise.resolve({ url: "https://storage.test/new-proof.jpg" })),
}));

const renderUpdateHook = () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUpdatePayment(), { wrapper });
};

describe("useUpdatePayment", () => {
  beforeEach(() => {
    updateSpy.mockClear();
  });

  it("leaves the existing proof alone when the edit sends none", async () => {
    const { result } = renderUpdateHook();

    await result.current.mutateAsync({ paymentId: "p-1", updates: { amount: 1500 } });

    expect(updateSpy).toHaveBeenCalledWith({ amount: 1500 });
  });

  it("replaces the proof when a new receipt is uploaded", async () => {
    const { result } = renderUpdateHook();
    const receiptFile = new File(["receipt"], "receipt.jpg", { type: "image/jpeg" });

    await result.current.mutateAsync({ paymentId: "p-1", updates: { amount: 1500 }, receiptFile });

    expect(updateSpy).toHaveBeenCalledWith({
      amount: 1500,
      proof_url: "https://storage.test/new-proof.jpg",
    });
  });
});
