import { describe, expect, it } from "vitest";

import { multiUnitBookingSchema, unitRequestSchema } from "@/lib/validation/booking-schema";
import { pricingConfigSchema } from "@/lib/validation/pricing-schema";

function messageAt(
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  field: string
) {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("missing and wrong-type messages", () => {
  it("says a missing number is required and a non-number is not a number", () => {
    expect(messageAt(unitRequestSchema.safeParse({}), "guests_per_unit")).toBe(
      "Guest count is required"
    );
    expect(
      messageAt(unitRequestSchema.safeParse({ guests_per_unit: "2" }), "guests_per_unit")
    ).toBe("Guest count must be a number");
  });

  it("keeps the check messages for a value of the right type", () => {
    expect(messageAt(unitRequestSchema.safeParse({ guests_per_unit: 0 }), "guests_per_unit")).toBe(
      "At least 1 guest per unit"
    );
  });

  it("says a missing booking field is required", () => {
    const result = multiUnitBookingSchema.safeParse({});
    expect(messageAt(result, "guest_name")).toBe("Guest name is required");
    expect(messageAt(result, "check_in")).toBe("Check-in date is required");
    expect(messageAt(result, "unit_requests")).toBe("At least one unit is required");
    expect(messageAt(result, "terms_accepted")).toBe("You must accept the terms and conditions");
  });

  it("uses the invalid-date message for a value that is not a date", () => {
    expect(messageAt(multiUnitBookingSchema.safeParse({ check_in: "tomorrow" }), "check_in")).toBe(
      "Invalid date format"
    );
  });

  it("keeps the pricing messages, including the PHP currency lock", () => {
    const result = pricingConfigSchema.safeParse({ weekend_rate: "high", currency: "USD" });
    expect(messageAt(result, "base_rate")).toBe("Base rate is required");
    expect(messageAt(result, "weekend_rate")).toBe("Weekend rate must be a number");
    expect(messageAt(result, "currency")).toBe("Currency must be PHP for Philippine resort");
  });
});
