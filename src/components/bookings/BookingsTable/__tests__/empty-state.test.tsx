/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toStayInstants, type BookingsSearch } from "@/lib/bookings";
import { stubPaneWidth } from "@/test/pane-width";
import type { Booking } from "@/types";

import { BookingsTable } from "..";

const router = vi.hoisted(() => ({
  search: {} as BookingsSearch,
  navigate: vi.fn(),
}));
const loaded = vi.hoisted(() => ({ bookings: [] as Booking[] }));

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("@/test/router-link-stub")).RouterLinkStub,
  useNavigate: () => router.navigate,
  useSearch: () => router.search,
}));

vi.mock("@/stores/useBookingStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/useBookingStore")>()),
  ...(await import("@/test/booking-store-stub")).bookingStoreHookStubs([]),
  useAllBookings: () => ({ data: loaded.bookings, isLoading: false, error: null }),
}));

vi.mock("@/stores/useUnitStore", () => ({ useUnits: () => ({ data: [] }) }));

const checkedOut = {
  booking_id: "booking-1",
  booking_reference: "OKR-1",
  guest_name: "Maria Santos",
  booking_status: "CheckedOut",
  ...toStayInstants("2026-10-01", "2026-10-03"),
} as Booking;

describe("BookingsTable empty state", () => {
  beforeEach(() => {
    stubPaneWidth(1024);
    router.search = {};
    router.navigate.mockClear();
    loaded.bookings = [checkedOut];
  });

  it("shows 'No bookings yet' when there are no bookings", () => {
    loaded.bookings = [];
    render(<BookingsTable />);

    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("clears the search and filters and keeps the view when nothing matches", async () => {
    router.search = { view: "past", q: "nonexistent-xyz", source: ["airbnb"] };
    render(<BookingsTable />);

    expect(screen.getByText("No bookings match")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    const [{ search }] = router.navigate.mock.lastCall!;
    expect(search(router.search)).toEqual({ view: "past" });
  });

  it("offers no Clear filters when only the view is empty", () => {
    router.search = { view: "cancelled" };
    render(<BookingsTable />);

    expect(screen.getByText("No bookings in this view.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});
