/**
 * bookings.payment_status is derived by triggers (docs/adr/0001); the CHECK
 * constraint lists its values. PAYMENT_STATUSES narrows the column type and
 * must stay equal to it.
 */

import { describe, expect, it } from "vitest";

import { PAYMENT_STATUSES } from "@/types";

import { latestCheckConstraintValues } from "./check-constraint";

describe("payment_status parity", () => {
  it("PAYMENT_STATUSES equals the bookings_payment_status_check values", () => {
    expect([...PAYMENT_STATUSES].sort()).toEqual(
      latestCheckConstraintValues("bookings_payment_status_check").sort()
    );
  });
});
