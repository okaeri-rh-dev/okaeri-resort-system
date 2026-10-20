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
} as DbBooking;

describe("adaptBookingFromDB", () => {
  it.each([true, false])("keeps is_walk_in = %s", (isWalkIn) => {
    expect(adaptBookingFromDB({ ...walkInRow, is_walk_in: isWalkIn }).is_walk_in).toBe(isWalkIn);
  });
});
