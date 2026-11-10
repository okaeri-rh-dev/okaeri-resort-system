/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types";

import { BookingSheet } from "../components/BookingSheet";

const router = vi.hoisted(() => ({ search: {} as { booking?: string }, navigate: vi.fn() }));
const list = vi.hoisted(() => ({
  data: [] as Booking[],
  isFetching: false,
  isStale: false,
}));

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("@/test/router-link-stub")).RouterLinkStub,
  useNavigate: () => router.navigate,
  useSearch: () => router.search,
}));

vi.mock("@/stores/useBookingStore", () => ({ useAllBookings: () => list }));

vi.mock("@/hooks", () => ({ useUserRole: () => ({ role: "manager", userId: "user-1" }) }));

const pending = {
  booking_id: "booking-1",
  booking_reference: "OKR-1",
  guest_name: "Maria Santos",
  booking_status: "Pending",
  booking_source: "Walk-in",
  check_in: "2026-10-01T06:00:00Z",
  check_out: "2026-10-03T04:00:00Z",
  total_amount: 5000,
  payments: [],
  booking_units: [],
} as unknown as Booking;

const renderSheet = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BookingSheet
        updateBookingStatus={{ mutate: vi.fn() }}
        onRecordPayment={vi.fn()}
        onCancel={vi.fn()}
      />
    </QueryClientProvider>
  );

describe("BookingSheet", () => {
  beforeEach(() => {
    router.navigate.mockClear();
    Object.assign(list, { data: [], isFetching: false, isStale: false });
  });

  it("shows the booking's main action and its menu", () => {
    router.search = { booking: "booking-1" };
    list.data = [pending];
    renderSheet();

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for OKR-1" })).toBeInTheDocument();
  });

  it("drops an unknown booking id from the URL", () => {
    router.search = { booking: "missing" };
    renderSheet();

    expect(router.navigate).toHaveBeenCalledOnce();
  });

  it("keeps a just-saved booking's id while the list waits for its refetch", () => {
    router.search = { booking: "just-saved" };
    list.isStale = true;
    renderSheet();

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
