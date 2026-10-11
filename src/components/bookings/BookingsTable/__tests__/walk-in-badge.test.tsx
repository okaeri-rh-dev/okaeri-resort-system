/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types";

import { BookingCard } from "../components/BookingCard";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks", () => ({
  useUserRole: () => ({
    canEdit: true,
    canDelete: true,
    canConfirmBookings: true,
  }),
}));

const noopMutation = { mutate: vi.fn() };

const baseBooking: Booking = {
  booking_id: "11111111-1111-1111-1111-111111111111",
  booking_reference: "BK-TEST-001",
  guest_id: null,
  guest_name: "Walk-in Tester",
  contact_number: "+639170000000",
  email: null,
  num_guests: 2,
  check_in: new Date("2099-01-01").toISOString(),
  check_out: new Date("2099-01-02").toISOString(),
  total_amount: 2500,
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

const renderCard = (overrides: Partial<Booking>) =>
  render(
    <BookingCard
      booking={{ ...baseBooking, ...overrides }}
      onUploadPayment={() => undefined}
      onCancel={() => undefined}
      updateBookingStatus={noopMutation}
    />
  );

describe("BookingCard walk-in badge", () => {
  it("renders the Walk-in badge when is_walk_in is true", () => {
    renderCard({ is_walk_in: true });
    expect(screen.getByText("Walk-in")).toBeInTheDocument();
  });

  it("does not render the Walk-in badge when is_walk_in is false", () => {
    renderCard({ is_walk_in: false });
    expect(screen.queryByText("Walk-in")).not.toBeInTheDocument();
  });

  it("does not render the Walk-in badge when is_walk_in is omitted (legacy bookings)", () => {
    const legacy = { ...baseBooking };
    delete (legacy as { is_walk_in?: boolean }).is_walk_in;
    render(
      <BookingCard
        booking={legacy}
        onUploadPayment={() => undefined}
        onCancel={() => undefined}
        updateBookingStatus={noopMutation}
      />
    );
    expect(screen.queryByText("Walk-in")).not.toBeInTheDocument();
  });
});
