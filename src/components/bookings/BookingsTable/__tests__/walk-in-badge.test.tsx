/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Booking } from "@/types";

import { BookingCard } from "../components/BookingCard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a data-testid="mock-link" {...rest}>
      {children}
    </a>
  ),
}));

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

describe("BookingCard walk-in badge", () => {
  it("renders the Walk-in badge when is_walk_in is true", () => {
    render(
      <BookingCard
        booking={{ ...baseBooking, is_walk_in: true }}
        onUploadPayment={() => undefined}
        onCancel={() => undefined}
      />
    );
    expect(screen.getByText("Walk-in")).toBeInTheDocument();
  });

  it("does not render the Walk-in badge when is_walk_in is false", () => {
    render(
      <BookingCard
        booking={{ ...baseBooking, is_walk_in: false }}
        onUploadPayment={() => undefined}
        onCancel={() => undefined}
      />
    );
    expect(screen.queryByText("Walk-in")).not.toBeInTheDocument();
  });

  it("does not render the Walk-in badge when is_walk_in is omitted (legacy bookings)", () => {
    const legacy = { ...baseBooking };
    delete (legacy as { is_walk_in?: boolean }).is_walk_in;
    render(
      <BookingCard booking={legacy} onUploadPayment={() => undefined} onCancel={() => undefined} />
    );
    expect(screen.queryByText("Walk-in")).not.toBeInTheDocument();
  });
});
