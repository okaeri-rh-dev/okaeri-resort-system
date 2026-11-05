import { describe, expect, it } from "vitest";

import { multiUnitBookingResponseSchema } from "../guest-booking-multi-unit";

describe("multiUnitBookingResponseSchema", () => {
  it("parses a created booking response with its pricing", () => {
    const parsed = multiUnitBookingResponseSchema.parse({
      success: true,
      booking: {
        booking_id: "00000000-0000-0000-0000-000000000136",
        booking_reference: "BK-202610-A7B9C2",
        total_amount: 13000,
        downpayment_amount: 6500,
      },
      unit_requests: [{ guests_per_unit: 2 }],
      pricing_breakdown: {
        base_total: 12000,
        weekend_surcharge: 1000,
        extra_person_fees: 0,
        subtotal: 13000,
        discount_amount: 0,
        total: 13000,
        nights: 2,
      },
      message: "Booking created.",
      is_duplicate: false,
    });

    expect(parsed.is_duplicate).toBe(false);
  });

  it("parses a duplicate response, which returns the stored booking row and no pricing", () => {
    const parsed = multiUnitBookingResponseSchema.parse({
      success: true,
      booking: {
        id: "00000000-0000-0000-0000-000000000136",
        booking_reference: "BK-202610-A7B9C2",
        status: "Pending",
      },
      message: "Booking already created (duplicate detected)",
      is_duplicate: true,
    });

    expect(parsed).toMatchObject({
      is_duplicate: true,
      booking: { booking_reference: "BK-202610-A7B9C2", status: "Pending" },
    });
  });

  it("rejects a created response without its pricing breakdown", () => {
    const result = multiUnitBookingResponseSchema.safeParse({
      success: true,
      booking: {
        booking_id: "00000000-0000-0000-0000-000000000136",
        booking_reference: "BK-202610-A7B9C2",
        total_amount: 13000,
        downpayment_amount: 6500,
      },
      unit_requests: [{ guests_per_unit: 2 }],
      message: "Booking created.",
      is_duplicate: false,
    });

    expect(result.success).toBe(false);
  });
});
