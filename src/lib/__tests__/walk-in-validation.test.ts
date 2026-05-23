import { describe, expect, it } from "vitest";

import { bookingEditSchema } from "@/lib/validation/entity-schemas";
import { multiUnitBookingSchema } from "@/lib/validation/multi-unit-booking";
import { completeBookingSchema } from "@/lib/validations";

describe("is_walk_in validation across booking schemas", () => {
  const baseCompleteInput = {
    unit_id: "11111111-1111-1111-1111-111111111111",
    check_in: new Date("2099-01-01"),
    check_out: new Date("2099-01-02"),
    num_guests: 2,
    guest_name: "Jane Walk",
    email: "",
    contact_number: "",
    payment_method: "Cash" as const,
  };

  it("completeBookingSchema accepts is_walk_in=false", () => {
    const parsed = completeBookingSchema.parse({ ...baseCompleteInput, is_walk_in: false });
    expect(parsed.is_walk_in).toBe(false);
  });

  it("completeBookingSchema accepts is_walk_in=true", () => {
    const parsed = completeBookingSchema.parse({ ...baseCompleteInput, is_walk_in: true });
    expect(parsed.is_walk_in).toBe(true);
  });

  it("completeBookingSchema rejects when is_walk_in is omitted", () => {
    expect(() => completeBookingSchema.parse(baseCompleteInput)).toThrow();
  });

  const baseMultiInput = {
    check_in: new Date("2099-02-01"),
    check_out: new Date("2099-02-02"),
    guest_name: "Multi Walk",
    email: "",
    contact_number: "",
    payment_method: "Cash" as const,
  };

  it("multiUnitBookingSchema accepts is_walk_in=false", () => {
    const parsed = multiUnitBookingSchema.parse({ ...baseMultiInput, is_walk_in: false });
    expect(parsed.is_walk_in).toBe(false);
  });

  it("multiUnitBookingSchema accepts is_walk_in=true", () => {
    const parsed = multiUnitBookingSchema.parse({ ...baseMultiInput, is_walk_in: true });
    expect(parsed.is_walk_in).toBe(true);
  });

  const baseEditInput = {
    guest_name: "Edit Walk",
    email: "edit@example.com",
    contact_number: "+639170000000",
    check_in: new Date("2099-03-01"),
    check_out: new Date("2099-03-02"),
    unit_id: "22222222-2222-2222-2222-222222222222",
    num_guests: 1,
    payment_method: "Cash" as const,
  };

  it("bookingEditSchema accepts is_walk_in=false", () => {
    const parsed = bookingEditSchema.parse({ ...baseEditInput, is_walk_in: false });
    expect(parsed.is_walk_in).toBe(false);
  });

  it("bookingEditSchema accepts is_walk_in=true", () => {
    const parsed = bookingEditSchema.parse({ ...baseEditInput, is_walk_in: true });
    expect(parsed.is_walk_in).toBe(true);
  });
});
