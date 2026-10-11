import { describe, expect, it } from "vitest";

import type { BookingEditInput } from "@/lib/validation/entity-schemas";

import { toBookingUpdate } from "../to-booking-update";

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
  is_walk_in: false,
};

describe("toBookingUpdate", () => {
  it("stores the picked days as Manila check-in and check-out times", () => {
    const update = toBookingUpdate(editInput);

    expect(update.check_in).toBe("2026-10-15T06:00:00.000Z");
    expect(update.check_out).toBe("2026-10-17T04:00:00.000Z");
  });

  it("sends only bookings columns", () => {
    const update = toBookingUpdate(editInput);

    expect(Object.keys(update).sort()).toEqual(
      [
        "check_in",
        "check_out",
        "contact_number",
        "email",
        "guest_name",
        "is_walk_in",
        "num_guests",
        "payment_method",
        "special_requests",
      ].sort()
    );
  });
});
