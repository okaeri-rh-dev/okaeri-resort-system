/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBookingStore } from "@/stores/useBookingStore";
import type { Booking } from "@/types";

import { useBookingsTable } from "../hooks/useBookingsTable";
import { exportBookings } from "../utils/export";

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("@/test/router-link-stub")).RouterLinkStub,
  useNavigate: () => vi.fn(),
}));

vi.mock("../utils/export", () => ({ exportBookings: vi.fn() }));

const { confirmed, cancelled } = vi.hoisted(() => ({
  confirmed: { booking_id: "b1", guest_name: "Ana Cruz", booking_status: "Confirmed" } as Booking,
  cancelled: { booking_id: "b2", guest_name: "Ben Reyes", booking_status: "Cancelled" } as Booking,
}));

vi.mock("@/stores/useBookingStore", async (importOriginal) => {
  const noopMutation = { mutate: vi.fn() };
  const bookingsResult = { data: [confirmed, cancelled], isLoading: false, error: null };
  return {
    ...(await importOriginal<typeof import("@/stores/useBookingStore")>()),
    useBookings: () => bookingsResult,
    useCancelBooking: () => noopMutation,
    useUpdateBookingStatus: () => noopMutation,
    useUploadPaymentProof: () => noopMutation,
  };
});

describe("useBookingsTable export", () => {
  beforeEach(() => {
    vi.mocked(exportBookings).mockClear();
    useBookingStore.setState({ filters: {}, searchQuery: "" });
  });

  it("exports only the bookings that match the active filters", async () => {
    useBookingStore.setState({ filters: { status: "Cancelled" } });
    const { result } = renderHook(() => useBookingsTable());

    await act(() => result.current.handleExport());

    expect(exportBookings).toHaveBeenCalledWith([cancelled]);
  });

  it("exports only the bookings that match the search", async () => {
    useBookingStore.setState({ searchQuery: "ana" });
    const { result } = renderHook(() => useBookingsTable());

    await act(() => result.current.handleExport());

    expect(exportBookings).toHaveBeenCalledWith([confirmed]);
  });

  it("exports the bookings in the table's sort order", async () => {
    const { result } = renderHook(() => useBookingsTable());

    act(() => result.current.table.setSorting([{ id: "guest_name", desc: true }]));
    await act(() => result.current.handleExport());

    expect(exportBookings).toHaveBeenCalledWith([cancelled, confirmed]);
  });
});
