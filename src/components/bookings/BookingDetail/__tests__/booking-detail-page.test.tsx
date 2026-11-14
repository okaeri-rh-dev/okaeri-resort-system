/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types";

import { BookingDetailPage } from "..";

const user = vi.hoisted(() => ({ role: "manager" as string, userId: "user-1" }));

vi.mock("@tanstack/react-router", async () => ({
  Link: (await import("@/test/router-link-stub")).RouterLinkStub,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks", () => ({ useUserRole: () => user }));

vi.mock("@/hooks/useBookings", () => ({
  useUpdateBookingStatus: () => ({ mutate: vi.fn() }),
  useCancelBooking: () => ({ mutate: vi.fn() }),
  useUploadPaymentProof: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/components/entity-detail", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DetailAuditSection: () => <section>Audit trail</section>,
}));

const booking = {
  booking_id: "booking-1",
  booking_reference: "OKR-1",
  guest_id: "guest-1",
  guest_name: "Maria Santos",
  email: "maria@example.com",
  contact_number: "09171234567",
  num_guests: 6,
  booking_status: "Pending",
  booking_source: "Walk-in",
  payment_status: "Partial",
  check_in: "2026-11-13T06:00:00Z",
  check_out: "2026-11-16T04:00:00Z",
  total_amount: 9000,
  special_requests: "Late arrival",
  internal_notes: null,
  payments: [
    { amount: 3000, status: "Active" },
    { amount: 1000, status: "Deleted" },
  ],
  booking_units: [
    {
      booking_unit_id: "bu-1",
      unit_id: "unit-1",
      assigned_guests: 4,
      unit: { unit_code: "C1", unit_name: "Cabin 1" },
    },
    {
      booking_unit_id: "bu-2",
      unit_id: "unit-2",
      assigned_guests: 2,
      unit: { unit_code: "C2", unit_name: "Cabin 2" },
    },
  ],
} as unknown as Booking;

const renderPage = (overrides: Partial<Booking> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BookingDetailPage booking={{ ...booking, ...overrides }} bookingId="booking-1" />
    </QueryClientProvider>
  );

const card = (title: string) => within(screen.getByRole("region", { name: title }));

describe("BookingDetailPage", () => {
  beforeEach(() => {
    user.role = "manager";
  });

  it("shows the guest name once and the booking line with the amount due", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute(
      "href",
      "/admin/bookings"
    );
    expect(screen.getByRole("heading", { level: 1, name: "Maria Santos" })).toBeInTheDocument();
    expect(screen.getAllByText("Maria Santos")).toHaveLength(1);
    expect(screen.getByText("OKR-1")).toBeInTheDocument();
    expect(screen.getByText("Walk-in")).toBeInTheDocument();
    expect(screen.getByText("₱6,000.00 due")).toBeInTheDocument();
  });

  it("shows the stay with weekdays, its length and one row for each cabin", () => {
    renderPage();
    const stay = card("Stay");

    expect(stay.getByText("Fri, Nov 13")).toBeInTheDocument();
    expect(stay.getByText("Mon, Nov 16")).toBeInTheDocument();
    expect(stay.getByText("3 nights · 6 guests")).toBeInTheDocument();
    const cabins = within(stay.getByRole("list", { name: "Cabins" })).getAllByRole("listitem");
    expect(cabins.map((row) => row.textContent)).toEqual([
      "C1Cabin 14 guests",
      "C2Cabin 22 guests",
    ]);
  });

  it("shows the guest's contact details with a tap-to-call phone and the guest record", () => {
    renderPage({ airbnb_confirmation_code: "HMABC123" });
    const guest = card("Guest");

    expect(guest.getByRole("link", { name: /0917/ })).toHaveAttribute("href", "tel:09171234567");
    expect(guest.getByText("maria@example.com")).toBeInTheDocument();
    expect(guest.getByText("HMABC123")).toBeInTheDocument();
    expect(guest.getByRole("link", { name: /View guest/ })).toBeInTheDocument();
  });

  it("shows both notes, with None for an empty one", () => {
    renderPage();
    const notes = card("Notes");

    expect(notes.getByText("Late arrival")).toBeInTheDocument();
    expect(notes.getByText("Internal note").nextSibling).toHaveTextContent("None");
  });

  it("sums only counted payments and shows Paid when nothing is owed", () => {
    const { unmount } = renderPage();
    let payments = card("Payments");
    expect(payments.getByText("Partial")).toBeInTheDocument();
    expect(payments.getByText("₱3,000.00")).toBeInTheDocument();
    expect(payments.getByText("₱6,000.00")).toBeInTheDocument();
    unmount();

    renderPage({ payments: [{ amount: 9000, status: "Active" }] });
    payments = card("Payments");
    expect(payments.getByText("Paid")).toBeInTheDocument();
    expect(screen.queryByText(/due$/)).not.toBeInTheDocument();
  });

  it("gives a manager the list's main action and overflow menu", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for OKR-1" })).toBeInTheDocument();
  });

  it("gives staff no main action on a Pending booking, but keeps the menu", () => {
    user.role = "staff";
    renderPage();

    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for OKR-1" })).toBeInTheDocument();
  });

  it("offers Check out on a checked-in booking", () => {
    user.role = "staff";
    renderPage({ booking_status: "CheckedIn" });

    expect(screen.getByRole("button", { name: "Check out" })).toBeInTheDocument();
  });

  it("shows no action bar when a settled booking leaves staff nothing to do", () => {
    user.role = "staff";
    renderPage({ booking_status: "CheckedOut", payments: [{ amount: 9000, status: "Active" }] });

    expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
  });

  it("shows an anonymized booking read-only with personal details removed", () => {
    renderPage({
      anonymized_at: "2026-11-01T00:00:00Z",
      guest_name: "Removed guest",
      email: null,
      contact_number: null,
      special_requests: null,
    });

    expect(screen.getByText("Anonymized")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
    expect(card("Guest").getByText("Personal details removed.")).toBeInTheDocument();
    expect(card("Notes").getByText("Personal details removed.")).toBeInTheDocument();
  });

  it("shows no Edit buttons yet", () => {
    renderPage();

    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
  });
});
