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
  is_walk_in: false,
};

describe("toBookingUpdate", () => {
  it("sends the picked days as the stay", () => {
    const update = toBookingUpdate(editInput);

    expect(update.stay).toEqual({ check_in: "2026-10-15", check_out: "2026-10-17" });
  });

  it("sends only bookings columns", () => {
    const update = toBookingUpdate(editInput);

    expect(Object.keys(update).sort()).toEqual(
      [
        "contact_number",
        "email",
        "guest_name",
        "is_walk_in",
        "num_guests",
        "payment_method",
        "special_requests",
        "stay",
      ].sort()
    );
  });
});
