import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubPaneWidth } from "@/test/pane-width";

import { PendingBookingsQueue } from "../PendingBookingsQueue";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={to.replace(/\$(\w+)/g, (_, key: string) => params[key])} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAuth: { getSession: async () => ({ data: { session: null } }) },
}));

const queuedBooking = {
  booking_id: "booking-1",
  booking_reference: "OKR-1042",
  guest_name: "Maria Santos",
  guest_contact: "maria@example.com",
  check_in_date: "2026-11-14",
  check_out_date: "2026-11-16",
  requested_unit_count: 2,
  total_amount: 12500,
  payment_status: "Pending",
  urgency_score: 92,
  urgency_level: "critical",
  created_at: "2026-10-20T08:00:00Z",
};

function renderQueue() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PendingBookingsQueue />
    </QueryClientProvider>
  );
}

describe("PendingBookingsQueue", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ bookings: [queuedBooking] }))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists each booking as a card on a narrow pane", async () => {
    stubPaneWidth(390);
    renderQueue();

    const list = await screen.findByRole("list", { name: "Pending bookings" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const [card] = within(list).getAllByRole("listitem");
    expect(within(card).getByText("OKR-1042")).toBeVisible();
    expect(within(card).getByText("Maria Santos")).toBeVisible();
    expect(within(card).getByText("Critical")).toBeVisible();
    expect(within(card).getByText("₱12,500.00")).toBeVisible();
    const action = within(card).getByRole("link", { name: "Review Payment" });
    expect(action).toHaveAttribute("href", "/admin/verify-payment/booking-1");
    expect(action).not.toHaveAttribute("title");
  });

  it("links a paid booking to cabin assignment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ bookings: [{ ...queuedBooking, payment_status: "Completed" }] }))
    );
    stubPaneWidth(390);
    renderQueue();

    const action = await screen.findByRole("link", { name: "Assign Cabins" });
    expect(action).toHaveAttribute("href", "/admin/bookings/booking-1/assign-units");
  });

  it("shows a table on a wide pane", async () => {
    stubPaneWidth(1280);
    renderQueue();

    const table = await screen.findByRole("table", { name: "Pending bookings" });
    expect(within(table).getByRole("columnheader", { name: "Urgency" })).toBeVisible();
    expect(within(table).getByRole("row", { name: /OKR-1042/ })).toBeVisible();
  });
});
