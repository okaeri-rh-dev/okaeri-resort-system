/**
 * The generated types give bookings.booking_status as `string`, so the CHECK
 * constraint is the only source of truth for its values. Code compared it to
 * values the CHECK rejects ("Completed", "pending") and silently matched
 * nothing. BOOKING_STATUSES narrows the column type; this keeps it equal to
 * the latest CHECK definition in the migrations.
 */

import { describe, expect, it } from "vitest";

import { BOOKING_STATUSES } from "@/types";

import { latestCheckConstraintValues } from "./check-constraint";

describe("booking_status parity", () => {
  it("BOOKING_STATUSES equals the bookings_booking_status_check values", () => {
    expect([...BOOKING_STATUSES].sort()).toEqual(
      latestCheckConstraintValues("bookings_booking_status_check").sort()
    );
  });
});
