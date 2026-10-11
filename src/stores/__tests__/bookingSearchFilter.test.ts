import { describe, expect, it } from "vitest";

import { bookingSearchFilter } from "../useBookingStore";

describe("bookingSearchFilter", () => {
  it("matches the search against guest name, reference, email and phone number", () => {
    expect(bookingSearchFilter("0917")).toBe(
      "guest_name.ilike.%0917%,booking_reference.ilike.%0917%,email.ilike.%0917%,contact_number.ilike.%0917%"
    );
  });
});
