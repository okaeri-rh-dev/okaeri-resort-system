// src/hooks/entity/__tests__/useEntityEdit.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEntityEdit } from "../useEntityEdit";
import { db } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/audit-logger";
import type { ReactNode } from "react";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  db: {
    bookings: {
      update: vi.fn(),
    },
    units: {
      update: vi.fn(),
    },
    guests: {
      update: vi.fn(),
    },
    payments: {
      update: vi.fn(),
    },
    expenses: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit-logger", () => ({
  logAuditEvent: vi.fn(() => Promise.resolve()),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useEntityEdit", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  describe("Booking entity", () => {
    it("updates booking successfully", async () => {
      const entityId = "booking-123";
      const updateData = {
        guest_name: "Updated Name",
        email: "updated@example.com",
      };
      const updatedBooking = {
        booking_id: entityId,
        ...updateData,
        booking_reference: "BK-001",
      };

      vi.mocked(db.bookings.update).mockResolvedValue({
        data: updatedBooking,
        error: null,
      });

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      let mutationPromise: Promise<any>;
      act(() => {
        mutationPromise = result.current.mutateAsync(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.bookings.update).toHaveBeenCalledWith(entityId, updateData);
      expect(result.current.data).toEqual(updatedBooking);
    });

    it("logs audit event on successful update", async () => {
      const entityId = "booking-123";
      const updateData = { guest_name: "New Name" };
      const updatedBooking = { booking_id: entityId, ...updateData };

      // Set up initial cached data
      queryClient.setQueryData(["booking", entityId], {
        booking_id: entityId,
        guest_name: "Old Name",
      });

      vi.mocked(db.bookings.update).mockResolvedValue({
        data: updatedBooking,
        error: null,
      });

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutateAsync(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(logAuditEvent).toHaveBeenCalled();
    });

    it("performs optimistic update", async () => {
      const entityId = "booking-123";
      const initialData = {
        booking_id: entityId,
        guest_name: "Original Name",
        email: "original@example.com",
      };
      const updateData = { guest_name: "Optimistic Name" };

      queryClient.setQueryData(["booking", entityId], initialData);

      // Delay the API response
      vi.mocked(db.bookings.update).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { ...initialData, ...updateData }, error: null }), 100)
          )
      );

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
      });

      // Check immediate optimistic update after mutation starts
      await waitFor(() => {
        const optimisticData = queryClient.getQueryData(["booking", entityId]);
        expect(optimisticData).toMatchObject({ guest_name: "Optimistic Name" });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("rolls back on error", async () => {
      const entityId = "booking-123";
      const initialData = { booking_id: entityId, guest_name: "Original" };
      const updateData = { guest_name: "Failed Update" };

      queryClient.setQueryData(["booking", entityId], initialData);

      vi.mocked(db.bookings.update).mockResolvedValue({
        data: null,
        error: { message: "Update failed", code: "500" },
      });

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Data should be rolled back
      const currentData = queryClient.getQueryData(["booking", entityId]);
      expect(currentData).toEqual(initialData);
    });
  });

  describe("Unit entity", () => {
    it("updates unit successfully", async () => {
      const entityId = "unit-123";
      const updateData = {
        unit_name: "Updated Villa",
        base_rate: 6000,
      };
      const updatedUnit = { unit_id: entityId, ...updateData };

      vi.mocked(db.units.update).mockResolvedValue({
        data: updatedUnit,
        error: null,
      });

      const { result } = renderHook(() => useEntityEdit("unit", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutateAsync(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.units.update).toHaveBeenCalledWith(entityId, updateData);
    });
  });

  describe("Guest entity", () => {
    it("updates guest successfully", async () => {
      const entityId = "guest-123";
      const updateData = {
        email: "newemail@example.com",
        contact_number: "09171234567",
      };
      const updatedGuest = { guest_id: entityId, ...updateData };

      vi.mocked(db.guests.update).mockResolvedValue({
        data: updatedGuest,
        error: null,
      });

      const { result } = renderHook(() => useEntityEdit("guest", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutateAsync(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.guests.update).toHaveBeenCalledWith(entityId, updateData);
    });
  });

  describe("Payment entity", () => {
    it("updates payment successfully", async () => {
      const entityId = "payment-123";
      const updateData = {
        payment_amount: 7500,
        payment_method: "Cash" as const,
      };
      const updatedPayment = { payment_id: entityId, ...updateData };

      vi.mocked(db.payments.update).mockResolvedValue({
        data: updatedPayment,
        error: null,
      });

      const { result } = renderHook(() => useEntityEdit("payment", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutateAsync(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.payments.update).toHaveBeenCalledWith(entityId, updateData);
    });
  });

  describe("Expense entity", () => {
    it("updates expense successfully", async () => {
      const entityId = "expense-123";
      const updateData = {
        description: "Updated maintenance",
        amount: 3000,
      };
      const updatedExpense = { expense_id: entityId, ...updateData };

      vi.mocked(db.expenses.update).mockResolvedValue({
        data: updatedExpense,
        error: null,
      });

      const { result } = renderHook(() => useEntityEdit("expense", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutateAsync(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.expenses.update).toHaveBeenCalledWith(entityId, updateData);
    });
  });

  describe("Callback options", () => {
    it("calls onSuccess callback", async () => {
      const entityId = "booking-123";
      const updateData = { guest_name: "Success Test" };
      const updatedData = { booking_id: entityId, ...updateData };
      const onSuccess = vi.fn();

      vi.mocked(db.bookings.update).mockResolvedValue({
        data: updatedData,
        error: null,
      });

      const { result } = renderHook(() => useEntityEdit("booking", entityId, { onSuccess }), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutateAsync(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledWith(updatedData);
    });

    it("calls onError callback", async () => {
      const entityId = "booking-123";
      const updateData = { guest_name: "Error Test" };
      const onError = vi.fn();

      vi.mocked(db.bookings.update).mockResolvedValue({
        data: null,
        error: { message: "Update failed" },
      });

      const { result } = renderHook(() => useEntityEdit("booking", entityId, { onError }), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe("Query invalidation", () => {
    it("invalidates entity query on success", async () => {
      const entityId = "booking-123";
      const updateData = { guest_name: "Invalidate Test" };
      const updatedData = { booking_id: entityId, ...updateData };

      vi.mocked(db.bookings.update).mockResolvedValue({
        data: updatedData,
        error: null,
      });

      // Set initial data
      queryClient.setQueryData(["booking", entityId], { booking_id: entityId, guest_name: "Old" });

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      act(() => {
        result.current.mutateAsync(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["booking", entityId] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["booking"] });
    });
  });

  describe("Error handling", () => {
    it("throws error for unknown entity type", async () => {
      const entityId = "test-123";
      const updateData = { field: "value" };

      // @ts-expect-error Testing invalid entity type
      const { result } = renderHook(() => useEntityEdit("invalid", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain("Unknown entity type");
    });

    it("handles database error gracefully", async () => {
      const entityId = "booking-123";
      const updateData = { guest_name: "Test" };

      vi.mocked(db.bookings.update).mockResolvedValue({
        data: null,
        error: {
          message: "Database constraint violation",
          code: "23505",
        },
      });

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("Database constraint violation");
    });
  });
});
