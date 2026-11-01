import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Booking, BookingStatus } from "@/types";

import { Dashboard } from "../Dashboard";

const data = vi.hoisted(() => ({
  bookings: [] as Booking[],
  blocks: [] as {
    blackout_id: string;
    unit_id: string | null;
    start_date: string;
    end_date: string;
  }[],
}));

vi.mock("@/stores/useBookingStore", () => ({
  useAllBookings: () => ({
    data: data.bookings,
    isLoading: false,
    isFetching: false,
    dataUpdatedAt: Date.now(),
  }),
}));

vi.mock("@/lib/supabase", () => ({
  db: {
    blackouts: { inDateRange: async () => ({ data: data.blocks, error: null }) },
    units: {
      all: async () => ({
        data: ["1", "2", "3"].map((n) => ({ unit_id: `unit-${n}`, unit_name: `Cabin ${n}` })),
        error: null,
      }),
    },
  },
  handleSupabaseError: (error: unknown) => String(error),
}));

function booking(
  id: string,
  guestName: string,
  checkInDay: string,
  checkOutDay: string,
  overrides: Partial<Booking> & { status?: BookingStatus; unitCode?: string } = {}
): Booking {
  const { status = "Confirmed", unitCode = "C1", ...rest } = overrides;
  return {
    booking_id: id,
    booking_reference: `REF-${id}`,
    guest_name: guestName,
    contact_number: null,
    email: null,
    num_guests: 2,
    // 14:00 and 12:00 Manila (ADR 0002)
    check_in: `${checkInDay}T06:00:00Z`,
    check_out: `${checkOutDay}T04:00:00Z`,
    total_amount: 6000,
    booking_status: status,
    payment_status: "Pending",
    created_at: null,
    updated_at: null,
    booking_units: [
      {
        booking_unit_id: `${id}-u`,
        booking_id: id,
        unit_id: `unit-${unitCode}`,
        unit: { unit_id: `unit-${unitCode}`, unit_code: unitCode, unit_name: unitCode },
      } as NonNullable<Booking["booking_units"]>[number],
    ],
    payments: [],
    ...rest,
  };
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/admin/dashboard"] }),
  });
  render(<RouterProvider router={router} />);
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-11-10T10:00:00+08:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    data.bookings = [];
    data.blocks = [];
  });

  it("opens on today's check-ins, check-outs and stays", async () => {
    data.bookings = [
      booking("in", "Maria Santos", "2026-11-10", "2026-11-12"),
      booking("out", "Jose Rizal", "2026-11-08", "2026-11-10", { unitCode: "C2" }),
      booking("stay", "Ana Reyes", "2026-11-09", "2026-11-11", { unitCode: "C3" }),
      booking("later", "Ben Cruz", "2026-11-11", "2026-11-12"),
    ];
    renderDashboard();

    expect(await screen.findByRole("heading", { name: /^Today/ })).toBeVisible();
    const panel = screen.getByRole("region", { name: /^Today/ });
    expect(panel).toHaveTextContent("Check-ins (1)");
    expect(panel).toHaveTextContent("Maria Santos");
    expect(panel).toHaveTextContent("Check-outs (1)");
    expect(panel).toHaveTextContent("Jose Rizal");
    expect(panel).toHaveTextContent("Staying (1)");
    expect(panel).toHaveTextContent("Ana Reyes");
    expect(panel).not.toHaveTextContent("Ben Cruz");
  });

  it("shows a day picked in the calendar", async () => {
    const user = userEvent.setup();
    data.bookings = [booking("in", "Maria Santos", "2026-11-14", "2026-11-16")];
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: /^November 14, 2026/ }));

    const panel = screen.getByRole("region", { name: /^Saturday Nov 14/ });
    expect(panel).toHaveTextContent("Maria Santos");
    expect(screen.getByRole("button", { name: /^November 14, 2026/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("steps through days with the previous and next day buttons", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Next day" }));
    expect(screen.getByRole("region", { name: /^Wednesday Nov 11/ })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Previous day" }));
    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByRole("region", { name: /^Monday Nov 9/ })).toBeVisible();
  });

  it("says so on a day with nothing on", async () => {
    renderDashboard();

    expect(await screen.findByText("No check-ins or check-outs.")).toBeVisible();
  });

  it("links each row to its booking, with the balance and the verification pill", async () => {
    data.bookings = [
      booking("pending", "Maria Santos", "2026-11-10", "2026-11-12", {
        status: "Pending",
        is_guest_booking: true,
        unit_assignment_status: "pending",
        total_amount: 6000,
        payments: [
          { amount: 2000, status: "Active" },
          { amount: 1000, status: "Deleted" },
        ],
      }),
      booking("paid", "Jose Rizal", "2026-11-10", "2026-11-12", {
        unitCode: "C2",
        payment_status: "Completed",
        payments: [{ amount: 6000, status: "Active" }],
      }),
      booking("staff", "Ana Cruz", "2026-11-10", "2026-11-12", {
        unitCode: "C3",
        status: "Pending",
      }),
    ];
    renderDashboard();

    const staffRow = await screen.findByRole("link", { name: /Ana Cruz/ });
    expect(within(staffRow).queryByText("Waiting for verification")).not.toBeInTheDocument();

    const pendingRow = await screen.findByRole("link", { name: /Maria Santos/ });
    expect(pendingRow).toHaveAttribute("href", "/admin/bookings/pending");
    expect(pendingRow).toHaveTextContent("₱4,000");
    expect(within(pendingRow).getByText("Waiting for verification")).toBeVisible();

    const paidRow = screen.getByRole("link", { name: /Jose Rizal/ });
    expect(paidRow).toHaveAttribute("href", "/admin/bookings/paid");
    expect(paidRow).not.toHaveTextContent("₱");
    expect(within(paidRow).queryByText("Waiting for verification")).not.toBeInTheDocument();
  });

  it("links to the queue when bookings wait for verification", async () => {
    const inQueue = {
      status: "Pending" as const,
      is_guest_booking: true,
      unit_assignment_status: "pending",
    };
    data.bookings = [
      booking("p1", "Maria Santos", "2026-11-20", "2026-11-22", inQueue),
      booking("p2", "Jose Rizal", "2026-12-20", "2026-12-22", inQueue),
      booking("s1", "Ana Cruz", "2026-11-25", "2026-11-27", { status: "Pending" }),
    ];
    renderDashboard();

    const queueLine = await screen.findByRole("link", {
      name: "2 bookings waiting for verification",
    });
    expect(queueLine).toHaveAttribute("href", "/admin/bookings/queue");
  });

  it("shows no queue line when nothing waits", async () => {
    data.bookings = [booking("c1", "Maria Santos", "2026-11-20", "2026-11-22")];
    renderDashboard();

    await screen.findByRole("heading", { name: /^Today/ });
    expect(screen.queryByText(/waiting for verification/)).not.toBeInTheDocument();
  });

  it("shows the numbers of the month the calendar shows", async () => {
    const user = userEvent.setup();
    data.bookings = [
      // 3 cabins × 30 November nights = 90; 9 booked = 10%
      booking("nov", "Maria Santos", "2026-11-01", "2026-11-10"),
      booking("dec", "Jose Rizal", "2026-12-01", "2026-12-02"),
    ];
    renderDashboard();

    expect(await screen.findByText("10% occupancy · 1 confirmed")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("1% occupancy · 1 confirmed")).toBeVisible();
  });

  it("selects the day on a touch tap without opening the hover card", async () => {
    const user = userEvent.setup();
    data.bookings = [booking("in", "Maria Santos", "2026-11-14", "2026-11-16")];
    renderDashboard();

    const day = await screen.findByRole("button", { name: /^November 14, 2026, 1 booking/ });
    await user.pointer({ keys: "[TouchA]", target: day });
    // Past the hover card's open delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(screen.getByRole("region", { name: /^Saturday Nov 14/ })).toBeVisible();
    expect(screen.queryByText("November 14, 2026")).not.toBeInTheDocument();
  });

  it("names the blocked cabins of the day", async () => {
    data.blocks = [
      { blackout_id: "b1", unit_id: "unit-1", start_date: "2026-11-10", end_date: "2026-11-10" },
    ];
    renderDashboard();

    const panel = await screen.findByRole("region", { name: /^Today/ });
    expect(await within(panel).findByText("Blocked: Cabin 1")).toBeVisible();
  });
});
