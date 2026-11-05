import { beforeEach, describe, expect, it } from "vitest";

import type { CreatedMultiUnitBookingResponse } from "@/types/guest-booking-multi-unit";

import { readConfirmationSnapshot, saveConfirmationSnapshot } from "../confirmation-snapshot";

const createdResponse: CreatedMultiUnitBookingResponse = {
  success: true,
  booking: {
    booking_id: "00000000-0000-0000-0000-000000000092",
    booking_reference: "BK-202610-A7B9C2",
    total_amount: 13000,
    downpayment_amount: 6500,
    discount_applied: { percent: 10, amount: 1300, rule_name: "Early bird" },
  },
  unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 4 }],
  pricing_breakdown: {
    base_total: 12000,
    weekend_surcharge: 1300,
    extra_person_fees: 1000,
    subtotal: 14300,
    discount_amount: 1300,
    total: 13000,
    nights: 2,
  },
  message: "Booking created.",
  is_duplicate: false,
};

const submitted = {
  check_in: "2026-12-04",
  check_out: "2026-12-06",
  special_requests: "Late arrival, around 9 PM",
  payment_proof_url: "TEMP-1761000000.png",
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("booking confirmation snapshot", () => {
  it("reads back what the guest booked, for the same reference", () => {
    saveConfirmationSnapshot(createdResponse, submitted);

    expect(readConfirmationSnapshot("BK-202610-A7B9C2")).toEqual({
      booking_reference: "BK-202610-A7B9C2",
      check_in: "2026-12-04T06:00:00.000Z",
      check_out: "2026-12-06T04:00:00.000Z",
      unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 4 }],
      special_requests: "Late arrival, around 9 PM",
      downpayment_amount: 6500,
      discount_applied: { percent: 10, amount: 1300, rule_name: "Early bird" },
      pricing_breakdown: createdResponse.pricing_breakdown,
      payment_proof_attached: true,
    });
  });

  it("has nothing for another reference", () => {
    saveConfirmationSnapshot(createdResponse, submitted);

    expect(readConfirmationSnapshot("BK-202610-ZZZZZZ")).toBeNull();
  });

  it("keeps nothing for a duplicate submit, whose response has no pricing", () => {
    saveConfirmationSnapshot(
      {
        success: true,
        booking: { booking_reference: "BK-202610-A7B9C2", status: "Pending" },
        is_duplicate: true,
      },
      submitted
    );

    expect(readConfirmationSnapshot("BK-202610-A7B9C2")).toBeNull();
  });
});
