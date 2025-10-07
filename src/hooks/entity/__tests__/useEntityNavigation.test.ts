// src/hooks/entity/__tests__/useEntityNavigation.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEntityNavigation } from "../useEntityNavigation";
import { useNavigate } from "@tanstack/react-router";

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
}));

describe("useEntityNavigation", () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  describe("navigateToDetail", () => {
    it("navigates to booking detail page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToDetail("booking", "booking-123");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/bookings/$bookingId",
        params: { bookingId: "booking-123" },
        search: undefined,
      });
    });

    it("navigates to unit detail page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToDetail("unit", "unit-456");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/units/$unitId",
        params: { unitId: "unit-456" },
        search: undefined,
      });
    });

    it("navigates to guest detail page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToDetail("guest", "guest-789");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/guests/$guestId",
        params: { guestId: "guest-789" },
        search: undefined,
      });
    });

    it("navigates to payment detail page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToDetail("payment", "payment-101");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/payments/$paymentId",
        params: { paymentId: "payment-101" },
        search: undefined,
      });
    });

    it("navigates to expense detail page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToDetail("expense", "expense-202");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/expenses/$expenseId",
        params: { expenseId: "expense-202" },
        search: undefined,
      });
    });

    it("passes search params when provided", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToDetail("booking", "booking-123", {
          tab: "payments",
          showRelated: true,
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/bookings/$bookingId",
        params: { bookingId: "booking-123" },
        search: {
          tab: "payments",
          showRelated: true,
        },
      });
    });
  });

  describe("navigateToEdit", () => {
    it("navigates to booking edit page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToEdit("booking", "booking-123");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/bookings/$bookingId/edit",
        params: { bookingId: "booking-123" },
      });
    });

    it("navigates to unit edit page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToEdit("unit", "unit-456");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/units/$unitId/edit",
        params: { unitId: "unit-456" },
      });
    });

    it("navigates to guest edit page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToEdit("guest", "guest-789");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/guests/$guestId/edit",
        params: { guestId: "guest-789" },
      });
    });

    it("navigates to payment edit page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToEdit("payment", "payment-101");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/payments/$paymentId/edit",
        params: { paymentId: "payment-101" },
      });
    });

    it("navigates to expense edit page", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToEdit("expense", "expense-202");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/expenses/$expenseId/edit",
        params: { expenseId: "expense-202" },
      });
    });
  });

  describe("navigateToList", () => {
    it("navigates to bookings list", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToList("booking");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/bookings",
      });
    });

    it("navigates to units list", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToList("unit");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/units",
      });
    });

    it("navigates to guests list", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToList("guest");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/guests",
      });
    });

    it("navigates to payments list", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToList("payment");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/payments",
      });
    });

    it("navigates to expenses list", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToList("expense");
      });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/expenses",
      });
    });
  });

  describe("Type safety", () => {
    it("ensures type-safe entity type parameter", () => {
      const { result } = renderHook(() => useEntityNavigation());

      // This should compile without errors
      act(() => {
        result.current.navigateToDetail("booking", "123");
        result.current.navigateToDetail("unit", "456");
        result.current.navigateToDetail("guest", "789");
        result.current.navigateToDetail("payment", "101");
        result.current.navigateToDetail("expense", "202");
      });

      // TypeScript will prevent invalid entity types at compile time
      // @ts-expect-error - Invalid entity type
      // result.current.navigateToDetail("invalid", "123");
    });
  });

  describe("Multiple navigation calls", () => {
    it("handles multiple navigation calls", () => {
      const { result } = renderHook(() => useEntityNavigation());

      act(() => {
        result.current.navigateToDetail("booking", "booking-1");
        result.current.navigateToEdit("unit", "unit-1");
        result.current.navigateToList("guest");
      });

      expect(mockNavigate).toHaveBeenCalledTimes(3);
      expect(mockNavigate).toHaveBeenNthCalledWith(1, {
        to: "/bookings/$bookingId",
        params: { bookingId: "booking-1" },
        search: undefined,
      });
      expect(mockNavigate).toHaveBeenNthCalledWith(2, {
        to: "/units/$unitId/edit",
        params: { unitId: "unit-1" },
      });
      expect(mockNavigate).toHaveBeenNthCalledWith(3, {
        to: "/guests",
      });
    });
  });
});
