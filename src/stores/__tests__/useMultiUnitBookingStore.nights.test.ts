import { describe, expect, it } from "vitest";

import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";

// src/stores/__tests__/useMultiUnitBookingStore.nights.test.ts
process.env.TZ = "America/Los_Angeles";

const unit = {
  unit_id: "u1",
  unit_name: "Cabin 1",
  base_rate: 10000,
  weekend_rate: 10000,
  extra_person_rate: 0,
  base_occupancy: 6,
  max_occupancy: 8,
};

describe("calculateUnitPricing night count", () => {
  it("runs in a time zone far from Manila", () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480);
  });

  it("counts one night for a stored 14:00 → 12:00 stay", () => {
    const pricing = useMultiUnitBookingStore
      .getState()

      .calculateUnitPricing(unit as any, "2026-12-20T06:00:00.000Z", "2026-12-21T04:00:00.000Z", 2);
    expect(pricing.nights).toBe(1);
  });
});
