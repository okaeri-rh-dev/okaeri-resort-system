/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types";

import { BookingSheet } from "../components/BookingSheet";

const router = vi.hoisted(() => ({
  search: {} as { booking?: string },
  navigate: vi.fn(() => Promise.resolve()),
}));
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

vi.mock("@/hooks/useBookings", () => ({ useAllBookings: () => list }));

vi.mock("@/hooks/usePaymentProofUrl", () => ({
  usePaymentProofUrl: () => ({ data: "https://storage.test/proof.jpg", isError: false }),
  paymentProofKind: () => "image",
}));

vi.mock("@/components/admin/LazyPaymentProofView", () => ({
  LazyPaymentProofView: () => <img alt="Proof full size" width={1} height={1} />,
}));

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

const openSheet = (overrides: Partial<Booking> = {}) => {
  router.search = { booking: "booking-1" };
  list.data = [{ ...pending, ...overrides }];
  renderSheet();
};

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

  it("opens the full page from the top bar, closing the sheet first", async () => {
    openSheet();

    const fullPage = screen.getByRole("link", { name: "Open full page" });
    expect(fullPage).toHaveTextContent("Full page");
    await userEvent.click(fullPage);

    expect(router.navigate).toHaveBeenNthCalledWith(1, expect.objectContaining({ replace: true }));
    expect(router.navigate).toHaveBeenNthCalledWith(2, {
      to: "/admin/bookings/$bookingId",
      params: { bookingId: "booking-1" },
      state: { fromBookingsList: true },
    });
  });

  it("titles the sheet with the guest name and shows the shared header line", () => {
    openSheet({ payments: [{ amount: 1000, status: "Active" }] } as Partial<Booking>);

    expect(screen.getByRole("dialog", { name: "Maria Santos" })).toBeInTheDocument();
    expect(screen.getByText("OKR-1")).toBeInTheDocument();
    expect(screen.getByText("₱4,000.00 due")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /bookings/i })).not.toBeInTheDocument();
  });

  it("shows Stay, Guest and the payment summary with no Edit buttons, rows or History", () => {
    openSheet({
      payment_status: "Partial",
      payments: [{ amount: 1000, status: "Active" }],
    } as Partial<Booking>);

    expect(screen.getByRole("region", { name: "Stay" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Guest" })).toBeInTheDocument();
    const payments = within(screen.getByRole("region", { name: "Payments" }));
    expect(payments.getByText("Received")).toBeInTheDocument();
    expect(payments.getByText("Outstanding balance")).toBeInTheDocument();
    expect(payments.getByText("Partial")).toBeInTheDocument();
    expect(payments.queryByText("Method")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/History/)).not.toBeInTheDocument();
  });

  it("shows Notes only when a note has text", () => {
    openSheet();
    expect(screen.queryByRole("region", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("shows Notes with its text when the internal note is set", () => {
    openSheet({ internal_notes: "Paid by GCash at the gate" });
    expect(
      within(screen.getByRole("region", { name: "Notes" })).getByText("Paid by GCash at the gate")
    ).toBeInTheDocument();
  });

  it("shows the guest's chosen method only while the booking is Pending", () => {
    openSheet({ payment_method: "GCash" });
    expect(screen.getByText("Guest chose GCash")).toBeInTheDocument();
  });

  it("hides the guest's chosen method once the booking is Confirmed", () => {
    openSheet({ payment_method: "GCash", booking_status: "Confirmed" });
    expect(screen.queryByText(/Guest chose/)).not.toBeInTheDocument();
  });

  it("opens the payment proof in a modal dialog", async () => {
    openSheet({ payment_proof_url: "booking-1/proof.jpg" });

    await userEvent.click(screen.getByRole("button", { name: "View payment proof" }));

    const proof = screen.getByRole("dialog", { name: "Payment proof" });
    expect(within(proof).getByRole("img", { name: "Proof full size" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /proof/i })).not.toBeInTheDocument();
  });

  it("shows an anonymized booking with no actions and personal fields removed", () => {
    openSheet({ anonymized_at: "2026-11-01T00:00:00Z", email: null, contact_number: null });

    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for OKR-1" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Guest" })).getByText("Personal details removed.")
    ).toBeInTheDocument();
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
