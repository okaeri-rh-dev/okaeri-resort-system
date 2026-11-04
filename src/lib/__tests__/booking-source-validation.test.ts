import { describe, expect, it } from "vitest";

import { bookingEditSchema } from "@/lib/validation/entity-schemas";
import { multiUnitBookingSchema } from "@/lib/validation/multi-unit-booking";
import { completeBookingSchema } from "@/lib/validations";

describe("booking source validation across booking schemas", () => {
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

  it.each(["Walk-in", "Direct", "Airbnb"])("completeBookingSchema accepts %s", (source) => {
    const parsed = completeBookingSchema.parse({ ...baseCompleteInput, booking_source: source });
    expect(parsed.booking_source).toBe(source);
  });

  it("completeBookingSchema rejects Website", () => {
    expect(() =>
      completeBookingSchema.parse({ ...baseCompleteInput, booking_source: "Website" })
    ).toThrow();
  });

  it("completeBookingSchema rejects when booking_source is omitted", () => {
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

  it("multiUnitBookingSchema accepts Airbnb", () => {
    const parsed = multiUnitBookingSchema.parse({ ...baseMultiInput, booking_source: "Airbnb" });
    expect(parsed.booking_source).toBe("Airbnb");
  });

  it("multiUnitBookingSchema rejects Website", () => {
    expect(() =>
      multiUnitBookingSchema.parse({ ...baseMultiInput, booking_source: "Website" })
    ).toThrow();
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
    total_amount: 5000,
  };

  it("bookingEditSchema keeps a Website source", () => {
    const parsed = bookingEditSchema.parse({ ...baseEditInput, booking_source: "Website" });
    expect(parsed.booking_source).toBe("Website");
  });
});
