import { describe, expect, it } from "vitest";

import { adaptBookingFromDB, type DbBooking } from "@/lib/database-adapters";

const walkInRow = {
  booking_id: "b-1",
  booking_reference: "WALK-1",
  guest_name: "Ramon Dela Cruz",
  num_guests: 4,
  check_in: "2026-10-11T06:00:00Z",
  check_out: "2026-10-12T04:00:00Z",
  total_amount: 9000,
  is_walk_in: true,
  booking_source: "Walk-in",
} as DbBooking;

describe("adaptBookingFromDB", () => {
  it.each([true, false])("keeps is_walk_in = %s", (isWalkIn) => {
    expect(adaptBookingFromDB({ ...walkInRow, is_walk_in: isWalkIn }).is_walk_in).toBe(isWalkIn);
  });

  it("keeps the booking source", () => {
    expect(adaptBookingFromDB(walkInRow).booking_source).toBe("Walk-in");
  });

  it("keeps the fields the verification queue reads", () => {
    const booking = adaptBookingFromDB({
      ...walkInRow,
      is_guest_booking: true,
      unit_assignment_status: "pending",
    });

    expect(booking.is_guest_booking).toBe(true);
    expect(booking.unit_assignment_status).toBe("pending");
  });

  it.each([
    { anonymized_at: "2026-11-01T00:00:00Z", pricing_metadata: { nights: 2, total: 9000 } },
    { anonymized_at: null, pricing_metadata: null },
  ])("keeps anonymized_at and pricing_metadata ($anonymized_at)", (fields) => {
    const booking = adaptBookingFromDB({ ...walkInRow, ...fields });

    expect(booking.anonymized_at).toBe(fields.anonymized_at);
    expect(booking.pricing_metadata).toEqual(fields.pricing_metadata);
  });
});
