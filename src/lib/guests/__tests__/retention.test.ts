import { describe, expect, it } from "vitest";

import { anonymizeBlockers } from "../retention";

const now = new Date("2026-10-21T00:00:00Z");
const booking = (
  overrides: Partial<{ booking_status: string; payment_status: string; check_out: string }>
) => ({
  booking_status: "CheckedOut",
  payment_status: "Completed",
  check_out: "2025-01-02T04:00:00Z",
  ...overrides,
});

describe("anonymizeBlockers", () => {
  it("finds nothing for settled past stays", () => {
    expect(anonymizeBlockers([booking({})], now)).toEqual({
      hasCurrentOrFutureBooking: false,
      openBalanceCount: 0,
    });
  });

  it("flags a current or future booking unless cancelled", () => {
    expect(
      anonymizeBlockers(
        [booking({ check_out: "2026-11-01T04:00:00Z", booking_status: "Confirmed" })],
        now
      ).hasCurrentOrFutureBooking
    ).toBe(true);
    expect(
      anonymizeBlockers(
        [booking({ check_out: "2026-11-01T04:00:00Z", booking_status: "Cancelled" })],
        now
      ).hasCurrentOrFutureBooking
    ).toBe(false);
  });

  it("counts open balances on bookings that are not cancelled", () => {
    expect(
      anonymizeBlockers(
        [
          booking({ payment_status: "Partial" }),
          booking({ payment_status: "Pending" }),
          booking({ payment_status: "Pending", booking_status: "Cancelled" }),
        ],
        now
      ).openBalanceCount
    ).toBe(2);
  });
});
