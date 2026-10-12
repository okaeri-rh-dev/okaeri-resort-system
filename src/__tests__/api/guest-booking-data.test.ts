import { describe, expect, it } from "vitest";

import { multiUnitBookingSchema } from "@/types/guest-booking-multi-unit";

import { toGuestBookingData } from "../../../functions/lib/guest-booking-data";

const pricing = {
  total: 7000,
  downpayment_required: 3500,
  discount: null,
  unit_breakdown: [
    {
      unit_index: 1,
      guests: 2,
      subtotal: 7000,
      extra_person_fees: 0,
      total: 7000,
      downpayment: 3500,
    },
  ],
};

describe("toGuestBookingData", () => {
  it("stores the stay as Manila 14:00 / 12:00 with the proof and idempotency key", () => {
    const data = toGuestBookingData({
      bookingReference: "BK-202703-ABC123",
      guestName: "Ana Cruz",
      email: "ana@example.com",
      phoneNumber: "+639171234567",
      checkInDay: "2027-03-10",
      checkOutDay: "2027-03-12",
      numGuests: 2,
      specialRequests: null,
      pricing,
      paymentProofUrl: "TEMP-abc_1.png",
      idempotencyKey: "4b7f0c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
    });

    expect(data).toMatchObject({
      check_in: "2027-03-10T06:00:00.000Z",
      check_out: "2027-03-12T04:00:00.000Z",
      total_amount: 7000,
      downpayment_required: 3500,
      discount_percent: null,
      discount_amount: null,
      pricing_snapshot: pricing,
      payment_proof_url: "TEMP-abc_1.png",
      idempotency_key: "4b7f0c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
    });
  });
});

describe("multiUnitBookingSchema stay days", () => {
  const base = {
    guest_name: "Ana Cruz",
    email: "ana@example.com",
    phone_number: "+639171234567",
    unit_requests: [{ guests_per_unit: 2 }],
    turnstile_token: "token",
    terms_accepted: true,
  };

  it("accepts Manila days", () => {
    const result = multiUnitBookingSchema.safeParse({
      ...base,
      check_in: "2099-03-10",
      check_out: "2099-03-12",
    });
    expect(result.success).toBe(true);
  });

  it("rejects instants", () => {
    const result = multiUnitBookingSchema.safeParse({
      ...base,
      check_in: "2099-03-09T16:00:00.000Z",
      check_out: "2099-03-11T16:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
