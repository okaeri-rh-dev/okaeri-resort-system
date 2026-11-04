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
  booking_source: "Direct",
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

describe("BookingCard source badge", () => {
  it.each(["Walk-in", "Airbnb", "Website"] as const)("shows one %s badge", (source) => {
    renderCard({ booking_source: source });
    expect(screen.getAllByText(source)).toHaveLength(1);
  });

  it("shows no source badge on a Direct booking", () => {
    renderCard({ booking_source: "Direct" });
    expect(screen.queryByText("Direct")).not.toBeInTheDocument();
  });
});
