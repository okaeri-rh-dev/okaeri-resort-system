import { describe, expect, it } from "vitest";

import { bookingEditSchema } from "@/lib/validation/entity-schemas";
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

  it.each(["Walk-in", "Direct"])("completeBookingSchema accepts %s", (source) => {
    const parsed = completeBookingSchema.parse({ ...baseCompleteInput, booking_source: source });
    expect(parsed.booking_source).toBe(source);
  });

  it("completeBookingSchema accepts Airbnb with a payout and no payment method", () => {
    const { payment_method: _, ...input } = baseCompleteInput;
    const parsed = completeBookingSchema.parse({
      ...input,
      booking_source: "Airbnb",
      payout: 4800,
    });
    expect(parsed.payout).toBe(4800);
  });

  it.each([{}, { payout: 0 }])("completeBookingSchema rejects Airbnb with %o", (fields) => {
    expect(() =>
      completeBookingSchema.parse({ ...baseCompleteInput, booking_source: "Airbnb", ...fields })
    ).toThrow();
  });

  it("completeBookingSchema still needs a payment method for other sources", () => {
    const { payment_method: _, ...input } = baseCompleteInput;
    expect(() => completeBookingSchema.parse({ ...input, booking_source: "Direct" })).toThrow();
  });

  it("completeBookingSchema rejects Website", () => {
    expect(() =>
      completeBookingSchema.parse({ ...baseCompleteInput, booking_source: "Website" })
    ).toThrow();
  });

  it("completeBookingSchema rejects when booking_source is omitted", () => {
    expect(() => completeBookingSchema.parse(baseCompleteInput)).toThrow();
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
