// src/hooks/entity/__tests__/useEntityDetail.test.ts

import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/supabase";

import { useEntityDetail } from "../useEntityDetail";

// Mock the Supabase db helpers
vi.mock("@/lib/supabase", () => ({
  db: {
    bookings: {
      byId: vi.fn(),
    },
    units: {
      byId: vi.fn(),
    },
    guests: {
      byId: vi.fn(),
    },
    payments: {
      byId: vi.fn(),
    },
    expenses: {
      byId: vi.fn(),
    },
  },
}));

describe("useEntityDetail", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for tests
        },
      },
    });
  });

  afterEach(() => {
    // Clear all mocks after each test
    vi.clearAllMocks();
  });

  // Helper to create a wrapper with QueryClientProvider
  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  describe("Booking entity", () => {
    it("fetches booking data successfully", async () => {
      const mockBooking = {
        booking_id: "123e4567-e89b-12d3-a456-426614174000",
        booking_reference: "BK-2024-001",
        booking_status: "Confirmed",
        guest_name: "John Doe",
      } as unknown as Awaited<ReturnType<typeof db.bookings.byId>>["data"];

      vi.mocked(db.bookings.byId).mockResolvedValue({
        data: mockBooking,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.bookings.byId>>);

      const { result } = renderHook(
        () => useEntityDetail("booking", "123e4567-e89b-12d3-a456-426614174000"),
        {
          wrapper: createWrapper(),
        }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for query to resolve
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockBooking);
      expect(db.bookings.byId).toHaveBeenCalledWith("123e4567-e89b-12d3-a456-426614174000");
    });

    it("handles booking not found error", async () => {
      vi.mocked(db.bookings.byId).mockResolvedValue({
        data: null,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.bookings.byId>>);

      const { result } = renderHook(() => useEntityDetail("booking", "nonexistent-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("not found");
    });

    it("handles database error", async () => {
      vi.mocked(db.bookings.byId).mockResolvedValue({
        data: null,
        error: {
          name: "PostgrestError",
          message: "Database connection failed",
          code: "500",
          details: "",
          hint: "",
        },
      } as unknown as Awaited<ReturnType<typeof db.bookings.byId>>);

      const { result } = renderHook(() => useEntityDetail("booking", "123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe("Database connection failed");
    });
  });

  describe("Unit entity", () => {
    it("fetches unit data successfully", async () => {
      const mockUnit = {
        unit_id: "unit-123",
        unit_name: "Deluxe Villa 1",
        unit_code: "DV-001",
        base_rate: 5000,
      } as unknown as Awaited<ReturnType<typeof db.units.byId>>["data"];

      vi.mocked(db.units.byId).mockResolvedValue({
        data: mockUnit,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.units.byId>>);

      const { result } = renderHook(() => useEntityDetail("unit", "unit-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockUnit);
      expect(db.units.byId).toHaveBeenCalledWith("unit-123");
    });
  });

  describe("Guest entity", () => {
    it("fetches guest data successfully", async () => {
      const mockGuest = {
        guest_id: "guest-123",
        guest_name: "Jane Smith",
        email: "jane@example.com",
        contact_number: "09171234567",
      } as unknown as Awaited<ReturnType<typeof db.guests.byId>>["data"];

      vi.mocked(db.guests.byId).mockResolvedValue({
        data: mockGuest,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.guests.byId>>);

      const { result } = renderHook(() => useEntityDetail("guest", "guest-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockGuest);
    });
  });

  describe("Payment entity", () => {
    it("fetches payment data successfully", async () => {
      const mockPayment = {
        payment_id: "payment-123",
        payment_amount: 5000,
        payment_method: "GCash",
        booking_id: "booking-123",
      } as unknown as Awaited<ReturnType<typeof db.payments.byId>>["data"];

      vi.mocked(db.payments.byId).mockResolvedValue({
        data: mockPayment,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.payments.byId>>);

      const { result } = renderHook(() => useEntityDetail("payment", "payment-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockPayment);
    });
  });

  describe("Expense entity", () => {
    it("fetches expense data successfully", async () => {
      const mockExpense = {
        expense_id: "expense-123",
        description: "Pool maintenance",
        amount: 2500,
        category: "Maintenance",
      } as unknown as Awaited<ReturnType<typeof db.expenses.byId>>["data"];

      vi.mocked(db.expenses.byId).mockResolvedValue({
        data: mockExpense,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.expenses.byId>>);

      const { result } = renderHook(() => useEntityDetail("expense", "expense-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockExpense);
    });
  });

  describe("Hook options", () => {
    it("respects enabled option when false", async () => {
      const { result } = renderHook(() => useEntityDetail("booking", "123", { enabled: false }), {
        wrapper: createWrapper(),
      });

      // Should not fetch when enabled is false
      expect(result.current.isFetching).toBe(false);
      expect(db.bookings.byId).not.toHaveBeenCalled();
    });

    it("respects enabled option when true", async () => {
      const mockBooking = { booking_id: "123", booking_reference: "BK-001" } as unknown as Awaited<
        ReturnType<typeof db.bookings.byId>
      >["data"];
      vi.mocked(db.bookings.byId).mockResolvedValue({
        data: mockBooking,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.bookings.byId>>);

      const { result } = renderHook(() => useEntityDetail("booking", "123", { enabled: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(db.bookings.byId).toHaveBeenCalled();
    });

    it("respects custom staleTime option", async () => {
      const mockBooking = { booking_id: "123", booking_reference: "BK-001" } as unknown as Awaited<
        ReturnType<typeof db.bookings.byId>
      >["data"];
      vi.mocked(db.bookings.byId).mockResolvedValue({
        data: mockBooking,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.bookings.byId>>);

      const { result } = renderHook(
        () =>
          useEntityDetail("booking", "123", {
            staleTime: 60_000, // 1 minute
          }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Check that data is cached
      expect(result.current.data).toEqual(mockBooking);
    });

    it("handles undefined entityId gracefully", async () => {
      const { result } = renderHook(() => useEntityDetail("booking", undefined), {
        wrapper: createWrapper(),
      });

      // Should not fetch when entityId is undefined
      expect(result.current.isFetching).toBe(false);
      expect(db.bookings.byId).not.toHaveBeenCalled();
    });
  });

  describe("Query key generation", () => {
    it("uses correct query key format", async () => {
      const mockBooking = { booking_id: "123", booking_reference: "BK-001" } as unknown as Awaited<
        ReturnType<typeof db.bookings.byId>
      >["data"];
      vi.mocked(db.bookings.byId).mockResolvedValue({
        data: mockBooking,
        error: null,
      } as unknown as Awaited<ReturnType<typeof db.bookings.byId>>);

      renderHook(() => useEntityDetail("booking", "123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        // Check that the query was added to cache with correct key
        const queryData = queryClient.getQueryData(["booking", "123"]);
        expect(queryData).toEqual(mockBooking);
      });
    });
  });

  describe("Error scenarios", () => {
    it("throws error for unknown entity type", async () => {
      // @ts-expect-error Testing invalid entity type
      const { result } = renderHook(() => useEntityDetail("invalid", "123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toContain("Unknown entity type");
    });

    it("handles missing entity ID", async () => {
      const { result } = renderHook(() => useEntityDetail("booking", ""), {
        wrapper: createWrapper(),
      });

      // Should not fetch with empty ID
      expect(result.current.isFetching).toBe(false);
    });
  });
});
