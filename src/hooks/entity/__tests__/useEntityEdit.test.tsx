// src/hooks/entity/__tests__/useEntityEdit.test.ts

import type { ReactNode } from "react";

import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";

import { useEntityEdit } from "../useEntityEdit";

// Mock rows use the app types, which differ from the generated row types the db helpers return
function createSuccessResponse<T>(data: T) {
  return {
    data,
    error: null,
    count: null,
    status: 200,
    statusText: "OK",
  } as PostgrestSingleResponse<never>;
}

// Helper to create Postgrest error response
function createErrorResponse<T>(error: {
  message: string;
  code: string;
  details?: string;
  hint?: string;
  name?: string;
}): PostgrestSingleResponse<T> {
  return {
    data: null,
    error: {
      message: error.message,
      code: error.code,
      details: error.details || "",
      hint: error.hint || "",
      name: error.name || "PostgrestError",
    },
    count: null,
    status: 500,
    statusText: "Internal Server Error",
  };
}

// Mock factories for complete database rows
const createMockBooking = (overrides: Record<string, unknown> = {}) => ({
  booking_id: "booking-123",
  booking_reference: "BKG-2024-001",
  booking_status: "Confirmed",
  check_in: "2024-12-20T14:00:00Z",
  check_out: "2024-12-22T11:00:00Z",
  contact_number: "+63 912 345 6789",
  created_at: "2024-01-01T00:00:00Z",
  email: "test@example.com",
  guest_id: "guest-123",
  guest_name: "Test Guest",
  is_guest_booking: false,
  is_multi_unit: false,
  num_guests: 2,
  payment_method: null,
  payment_proof_url: null,
  payment_status: "Pending",
  special_requests: null,
  total_amount: 4500,
  base_amount: 4000,
  total_surcharges: 500,
  discount_amount: 0,
  tax_amount: 0,
  unit_count: 1,
  unit_id: "unit-123",
  updated_at: "2024-01-01T00:00:00Z",
  upload_status: null,
  uploaded_at: null,
  internal_notes: null,
  upload_expires_at: null,
  ...overrides,
});

const createMockUnit = (overrides: Record<string, unknown> = {}) => ({
  unit_id: "unit-123",
  unit_code: "DEL-1",
  unit_name: "Deluxe Room 1",
  unit_type: "Deluxe",
  unit_status: "Available",
  base_occupancy: 2,
  max_occupancy: 4,
  base_rate: 5000,
  extra_person_rate: 500,
  weekend_rate: 6000,
  amenities: null,
  cleaning_fee: null,
  description: null,
  images: null,
  policies: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockGuest = (overrides: Record<string, unknown> = {}) => ({
  guest_id: "guest-123",
  guest_name: "Test Guest",
  email: "test@example.com",
  phone_number: "+63 912 345 6789",
  contact_number: "+63 912 345 6789",
  address: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  total_bookings: 5,
  total_spent: 25000,
  ...overrides,
});

const createMockPayment = (overrides: Record<string, unknown> = {}) => ({
  payment_id: "payment-123",
  booking_id: "booking-123",
  amount: 4500,
  payment_method: "Cash",
  payment_date: "2024-01-01T00:00:00Z",
  payment_status: "Completed",
  notes: null,
  proof_url: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockExpense = (overrides: Record<string, unknown> = {}) => ({
  expense_id: "expense-123",
  description: "Test Expense",
  amount: 2500,
  category: "Supplies",
  expense_date: "2024-01-01",
  vendor: null,
  payment_method: null,
  notes: null,
  receipt_url: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

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
      const updatedBooking = createMockBooking({
        booking_id: entityId,
        ...updateData,
        booking_reference: "BK-001",
      });

      vi.mocked(db.bookings.update).mockResolvedValue(createSuccessResponse(updatedBooking));

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.bookings.update).toHaveBeenCalledWith(entityId, updateData);
      expect(result.current.data).toEqual(updatedBooking);
    });

    it("performs optimistic update", async () => {
      const entityId = "booking-123";
      const initialData = createMockBooking({
        booking_id: entityId,
        guest_name: "Original Name",
        email: "original@example.com",
      });
      const updateData = { guest_name: "Optimistic Name" };

      queryClient.setQueryData(queryKeys.entity("booking", entityId), initialData);

      // Delay the API response
      let resolvePromise: (value: unknown) => void = () => {};
      const delayedPromise = new Promise<unknown>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(db.bookings.update).mockReturnValue(delayedPromise as never);

      // Resolve after 100ms
      setTimeout(() => {
        resolvePromise(createSuccessResponse({ ...initialData, ...updateData }));
      }, 100);

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
      });

      // Check immediate optimistic update after mutation starts
      await waitFor(() => {
        const optimisticData = queryClient.getQueryData(queryKeys.entity("booking", entityId));
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

      queryClient.setQueryData(queryKeys.entity("booking", entityId), initialData);

      vi.mocked(db.bookings.update).mockResolvedValue(
        createErrorResponse({
          message: "Update failed",
          code: "500",
        })
      );

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
      const currentData = queryClient.getQueryData(queryKeys.entity("booking", entityId));
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
      const updatedUnit = createMockUnit({ unit_id: entityId, ...updateData });

      vi.mocked(db.units.update).mockResolvedValue(createSuccessResponse(updatedUnit));

      const { result } = renderHook(() => useEntityEdit("unit", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
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
      const updatedGuest = createMockGuest({ guest_id: entityId, ...updateData });

      vi.mocked(db.guests.update).mockResolvedValue(createSuccessResponse(updatedGuest));

      const { result } = renderHook(() => useEntityEdit("guest", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
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
      const updatedPayment = createMockPayment({ payment_id: entityId, ...updateData });

      vi.mocked(db.payments.update).mockResolvedValue(createSuccessResponse(updatedPayment));

      const { result } = renderHook(() => useEntityEdit("payment", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
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
      const updatedExpense = createMockExpense({ expense_id: entityId, ...updateData });

      vi.mocked(db.expenses.update).mockResolvedValue(createSuccessResponse(updatedExpense));

      const { result } = renderHook(() => useEntityEdit("expense", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.expenses.update).toHaveBeenCalledWith(entityId, updateData);
    });

    it("writes the app-level date field to the expense_date column", async () => {
      const entityId = "expense-123";
      vi.mocked(db.expenses.update).mockResolvedValue(
        createSuccessResponse(createMockExpense({ expense_id: entityId }))
      );

      const { result } = renderHook(() => useEntityEdit("expense", entityId), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({ amount: 500, date: "2026-01-15" });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.expenses.update).toHaveBeenCalledWith(entityId, {
        amount: 500,
        expense_date: "2026-01-15",
      });
    });
  });

  describe("Callback options", () => {
    it("calls onSuccess callback", async () => {
      const entityId = "booking-123";
      const updateData = { guest_name: "Success Test" };
      const updatedData = createMockBooking({ booking_id: entityId, ...updateData });
      const onSuccess = vi.fn();

      vi.mocked(db.bookings.update).mockResolvedValue(createSuccessResponse(updatedData));

      const { result } = renderHook(() => useEntityEdit("booking", entityId, { onSuccess }), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(updateData);
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

      vi.mocked(db.bookings.update).mockResolvedValue(
        createErrorResponse({
          message: "Update failed",
          code: "500",
        })
      );

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
      const updatedData = createMockBooking({ booking_id: entityId, ...updateData });

      vi.mocked(db.bookings.update).mockResolvedValue(createSuccessResponse(updatedData));

      // Set initial data
      queryClient.setQueryData(
        queryKeys.entity("booking", entityId),
        createMockBooking({ booking_id: entityId, guest_name: "Old" })
      );

      const { result } = renderHook(() => useEntityEdit("booking", entityId), {
        wrapper: createWrapper(),
      });

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      act(() => {
        result.current.mutate(updateData);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.entity("booking", entityId),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.entities("booking") });
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
        result.current.mutate(updateData as never);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain("Unknown entity type");
    });

    it("handles database error gracefully", async () => {
      const entityId = "booking-123";
      const updateData = { guest_name: "Test" };

      vi.mocked(db.bookings.update).mockResolvedValue(
        createErrorResponse({
          message: "Database constraint violation",
          code: "23505",
        })
      );

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
