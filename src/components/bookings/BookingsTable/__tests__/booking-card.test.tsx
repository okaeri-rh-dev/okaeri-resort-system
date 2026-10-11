import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types";

import { BookingCard } from "../components/BookingCard";

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
// Polyfill on both global and window — Floating UI (used by Radix dropdown)
// reads window.ResizeObserver, and vi.clearAllMocks() in the global setup
// strips the vi.fn-based mock between tests.
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;
if (typeof window !== "undefined") {
  (window as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}

const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

interface RoleFlags {
  canEdit: boolean;
  canDelete: boolean;
  canConfirmBookings: boolean;
}

const ownerRole: RoleFlags = { canEdit: true, canDelete: true, canConfirmBookings: true };
const managerRole: RoleFlags = { canEdit: true, canDelete: false, canConfirmBookings: true };
const staffRole: RoleFlags = { canEdit: false, canDelete: false, canConfirmBookings: false };

let currentRole: RoleFlags = ownerRole;

vi.mock("@/hooks", () => ({
  useUserRole: () => currentRole,
}));

const baseBooking: Booking = {
  booking_id: "11111111-1111-1111-1111-111111111111",
  booking_reference: "BK-TEST-001",
  guest_id: null,
  guest_name: "Jonah Soriano-Tan",
  contact_number: "+639170000000",
  email: null,
  num_guests: 2,
  check_in: new Date("2026-06-26T00:00:00Z").toISOString(),
  check_out: new Date("2026-06-27T00:00:00Z").toISOString(),
  total_amount: 10000,
  booking_status: "Pending",
  payment_status: "Pending",
  payment_method: null,
  payment_proof_url: null,
  special_requests: null,
  internal_notes: null,
  is_multi_unit: false,
  is_walk_in: false,
  unit_count: 1,
  pricing_metadata: null,
  created_at: null,
  updated_at: null,
  booking_units: [],
  guest: null,
};

interface RenderOptions {
  booking?: Partial<Booking>;
  role?: RoleFlags;
}

const renderCard = ({ booking = {}, role = ownerRole }: RenderOptions = {}) => {
  currentRole = role;
  const updateBookingStatus = { mutate: vi.fn() };
  const onUploadPayment = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <BookingCard
      booking={{ ...baseBooking, ...booking }}
      onUploadPayment={onUploadPayment}
      onCancel={onCancel}
      updateBookingStatus={updateBookingStatus}
    />
  );
  return { ...utils, updateBookingStatus, onUploadPayment, onCancel };
};

beforeEach(() => {
  navigateMock.mockClear();
  currentRole = ownerRole;
});

describe("BookingCard primary action", () => {
  it("shows Confirm primary button for Pending booking when user can confirm", () => {
    renderCard({ booking: { booking_status: "Pending" }, role: managerRole });
    const buttons = screen.getAllByRole("button", { name: /confirm/i });
    // One primary button (menu is closed, so no menu item visible)
    expect(buttons).toHaveLength(1);
  });

  it("Confirm primary button fires updateBookingStatus with Confirmed", async () => {
    const user = userEvent.setup();
    const { updateBookingStatus } = renderCard({
      booking: { booking_status: "Pending" },
      role: managerRole,
    });
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(updateBookingStatus.mutate).toHaveBeenCalledWith({
      bookingId: baseBooking.booking_id,
      status: "Confirmed",
    });
  });

  it("falls back to Upload Payment primary for Confirmed booking with incomplete payment", () => {
    renderCard({
      booking: { booking_status: "Confirmed", payment_status: "Pending" },
    });
    expect(screen.getByRole("button", { name: /upload payment/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
  });

  it("Upload Payment primary fires onUploadPayment", async () => {
    const user = userEvent.setup();
    const { onUploadPayment } = renderCard({
      booking: { booking_status: "Confirmed", payment_status: "Pending" },
    });
    await user.click(screen.getByRole("button", { name: /upload payment/i }));
    expect(onUploadPayment).toHaveBeenCalledTimes(1);
  });

  it("hides action zone when booking is Confirmed and payment is Completed", () => {
    renderCard({
      booking: { booking_status: "Confirmed", payment_status: "Completed" },
    });
    expect(screen.queryByRole("button", { name: /upload payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
  });

  it("hides action zone for Cancelled booking", () => {
    renderCard({ booking: { booking_status: "Cancelled" } });
    expect(screen.queryByRole("button", { name: /upload payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
  });

  it("hides Confirm primary when user lacks canConfirmBookings on a Pending booking", () => {
    renderCard({
      booking: { booking_status: "Pending", payment_status: "Pending" },
      role: { canEdit: true, canDelete: false, canConfirmBookings: false },
    });
    // No Confirm primary, falls through to Upload Payment because payment incomplete
    expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload payment/i })).toBeInTheDocument();
  });
});

describe("BookingCard ⋯ menu role gating", () => {
  it("never offers Delete", async () => {
    const user = userEvent.setup();
    renderCard({ role: ownerRole });
    const trigger = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-ellipsis"));
    await user.click(trigger!);
    expect(await screen.findByText("Edit Booking")).toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("cancels only after the confirmation dialog is accepted", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderCard({ role: managerRole });
    const trigger = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-ellipsis"));
    await user.click(trigger!);
    await user.click(await screen.findByText("Cancel"));
    expect(onCancel).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Cancel booking" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("offers no Cancel for a CheckedIn booking", async () => {
    const user = userEvent.setup();
    renderCard({ booking: { booking_status: "CheckedIn" }, role: managerRole });
    const trigger = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-ellipsis"));
    await user.click(trigger!);
    expect(await screen.findByText("Edit Booking")).toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("excludes Confirm from menu when canConfirmBookings is false", async () => {
    const user = userEvent.setup();
    renderCard({
      booking: { booking_status: "Pending" },
      role: { canEdit: true, canDelete: false, canConfirmBookings: false },
    });
    const moreButtons = screen.getAllByRole("button");
    const trigger = moreButtons.find((b) => b.querySelector("svg.lucide-ellipsis"));
    expect(trigger).toBeDefined();
    await user.click(trigger!);
    expect(await screen.findByText("Edit Booking")).toBeInTheDocument();
    // No "Confirm" menu item should exist
    expect(screen.queryByText(/^Confirm$/)).not.toBeInTheDocument();
  });

  it("renders no ⋯ menu when user has no actions (staff with completed payment)", () => {
    renderCard({
      booking: { booking_status: "Confirmed", payment_status: "Completed" },
      role: staffRole,
    });
    // Staff has no actions: canEdit=false, canDelete=false, canConfirmBookings=false,
    // payment is Completed so Upload Payment is also unavailable
    const moreButtons = screen.queryAllByRole("button");
    const trigger = moreButtons.find((b) => b.querySelector("svg.lucide-ellipsis"));
    expect(trigger).toBeUndefined();
  });
});

describe("BookingCard info-zone navigation", () => {
  it("clicking the info zone navigates to the booking detail route", async () => {
    const user = userEvent.setup();
    renderCard();
    const infoZone = screen.getByRole("button", {
      name: /view booking BK-TEST-001/i,
    });
    await user.click(infoZone);
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/admin/bookings/$bookingId",
      params: { bookingId: baseBooking.booking_id },
    });
  });

  it("clicking the primary Confirm button does not also trigger info-zone navigation", async () => {
    const user = userEvent.setup();
    renderCard({ booking: { booking_status: "Pending" }, role: managerRole });
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe("BookingCard date and pluralization formatting", () => {
  it("renders same-month date range in shortened form", () => {
    renderCard({
      booking: {
        check_in: "2026-06-26T12:00:00Z",
        check_out: "2026-06-27T12:00:00Z",
      },
    });
    expect(screen.getByText(/Jun 26 → 27/)).toBeInTheDocument();
  });

  it("renders cross-month date range with both months", () => {
    renderCard({
      booking: {
        check_in: "2026-06-30T12:00:00Z",
        check_out: "2026-07-02T12:00:00Z",
      },
    });
    expect(screen.getByText(/Jun 30 → Jul 2/)).toBeInTheDocument();
  });

  it("uses singular 'night' and 'guest' when count is 1", () => {
    renderCard({
      booking: {
        check_in: "2026-06-26T12:00:00Z",
        check_out: "2026-06-27T12:00:00Z",
        num_guests: 1,
      },
    });
    expect(screen.getByText(/1 night/)).toBeInTheDocument();
    expect(screen.getByText(/1 guest$/)).toBeInTheDocument();
  });

  it("uses plural 'nights' and 'guests' when count is greater than 1", () => {
    renderCard({
      booking: {
        check_in: "2026-06-26T12:00:00Z",
        check_out: "2026-06-29T12:00:00Z",
        num_guests: 3,
      },
    });
    expect(screen.getByText(/3 nights/)).toBeInTheDocument();
    expect(screen.getByText(/3 guests/)).toBeInTheDocument();
  });
});
