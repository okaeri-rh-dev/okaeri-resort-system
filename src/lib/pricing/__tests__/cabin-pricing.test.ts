import { describe, expect, it } from "vitest";

import { cabinRates, priceCabin } from "../cabin-pricing";

const UNIT = { base_rate: 2000, weekend_rate: 2500, extra_person_rate: 300, base_occupancy: 2 };
const CONFIG = { base_rate: 3000, weekend_rate: 3500, extra_person_rate: 500, base_occupancy: 4 };

describe("cabinRates", () => {
  it("prefers the pricing config over the unit's own rates", () => {
    expect(cabinRates(UNIT, CONFIG)).toEqual(CONFIG);
  });

  it("falls back to the unit's rates without a config", () => {
    expect(cabinRates(UNIT)).toEqual(UNIT);
  });

  it("uses the base rate for a missing weekend rate and 0 for a missing extra-person rate", () => {
    expect(
      cabinRates({
        base_rate: 2000,
        base_occupancy: 2,
        weekend_rate: null,
        extra_person_rate: null,
      })
    ).toEqual({ base_rate: 2000, weekend_rate: 2000, extra_person_rate: 0, base_occupancy: 2 });
  });
});

describe("priceCabin", () => {
  // 2026-10-09 is a Friday: Fri and Sat are weekend nights.
  it("adds the weekend surcharge and the extra-person fee per night", () => {
    expect(priceCabin(UNIT, "2026-10-09", "2026-10-12", 3)).toEqual({
      nights: 3,
      base_total: 6000,
      weekend_surcharge: 1000,
      extra_person_fee: 900,
      unit_total: 7900,
    });
  });

  it("charges no extra-person fee at or under base occupancy", () => {
    expect(priceCabin(UNIT, "2026-10-12", "2026-10-13", 2).unit_total).toBe(2000);
  });
});
