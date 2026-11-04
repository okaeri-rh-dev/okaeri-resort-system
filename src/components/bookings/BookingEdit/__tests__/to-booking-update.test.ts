import { describe, expect, it } from "vitest";

import type { BookingEditInput } from "@/lib/validation/entity-schemas";

import { toBookingUpdate } from "../to-booking-update";

process.env.TZ = "America/Los_Angeles";

const editInput: BookingEditInput = {
  guest_name: "Maria Santos",
  email: "maria@example.com",
  contact_number: "09171234567",
  check_in: new Date(2026, 9, 15),
  check_out: new Date(2026, 9, 17),
  unit_id: "11111111-1111-4111-8111-111111111111",
  num_guests: 2,
  payment_method: "GCash",
  special_requests: "Late arrival",
  booking_source: "Direct",
  total_amount: 5000,
};

describe("toBookingUpdate", () => {
  it("runs outside Manila so browser-local mistakes show", () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480);
  });

  it("sends the picked days as the stay", () => {
    const update = toBookingUpdate(editInput, 5000);

    expect(update.stay).toEqual({ check_in: "2026-10-15", check_out: "2026-10-17" });
  });

  it("sends only bookings columns", () => {
    const update = toBookingUpdate(editInput, 5000);

    expect(Object.keys(update).sort()).toEqual(
      [
        "contact_number",
        "email",
        "guest_name",
        "booking_source",
        "num_guests",
        "payment_method",
        "special_requests",
        "stay",
      ].sort()
    );
  });

  it("sends the total only when it changed", () => {
    expect(toBookingUpdate({ ...editInput, total_amount: 4200.5 }, 5000).total_amount).toBe(4200.5);
    expect(toBookingUpdate(editInput, 5000)).not.toHaveProperty("total_amount");
  });
});
