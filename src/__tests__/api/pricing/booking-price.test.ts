import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { calculateBookingPrice, fetchActiveSeasons } from "../../../../functions/lib/pricing";
import { queryChain } from "../setup";

const CONFIG = {
  base_rate: 3000,
  weekend_rate: 3500,
  extra_person_rate: 500,
  base_occupancy: 2,
  downpayment_percent: 50,
  currency: "PHP",
};

const SEASONS = [
  { name: "Peak Summer", start_date: "03-01", end_date: "05-31", multiplier: 1.5, priority: 10 },
  { name: "Holy Week", start_date: "03-25", end_date: "04-01", multiplier: 1.8, priority: 15 },
  { name: "Christmas", start_date: "12-20", end_date: "01-02", multiplier: 2, priority: 20 },
];

const seasonsTable = (result: unknown) =>
  ({ from: () => queryChain(result) }) as unknown as SupabaseClient;

// Local midnight, as eachDayOfInterval sees it. 2026-10-08 is a Thursday.
const day = (isoDay: string) => new Date(`${isoDay}T00:00:00`);

const oneNight = { checkIn: day("2026-03-26"), checkOut: day("2026-03-27"), guestCount: 2 };

describe("calculateBookingPrice", () => {
  it("prices from the config it is given", () => {
    const price = calculateBookingPrice({
      checkIn: day("2026-10-08"),
      checkOut: day("2026-10-10"),
      guestCount: 3,
      config: CONFIG,
      seasons: [],
    });

    // Thu ₱3,000 + Fri ₱3,500 + 1 extra guest × ₱500 × 2 nights
    expect(price.total).toBe(7500);
    expect(price.downpayment).toBe(3750);
  });

  it("applies the highest-priority season per night", () => {
    const price = calculateBookingPrice({
      checkIn: day("2026-03-24"),
      checkOut: day("2026-03-26"),
      guestCount: 2,
      config: CONFIG,
      seasons: SEASONS,
    });

    // Tue in Peak Summer ₱3,000 × 1.5; Wed in Holy Week (inside Peak Summer) ₱3,000 × 1.8
    expect(price.nightlyBreakdown.map((night) => night.seasonName)).toEqual([
      "Peak Summer",
      "Holy Week",
    ]);
    expect(price.total).toBe(9900);
  });

  it("applies a season that wraps into the next year", () => {
    const price = calculateBookingPrice({
      checkIn: day("2026-12-31"),
      checkOut: day("2027-01-01"),
      guestCount: 2,
      config: CONFIG,
      seasons: SEASONS,
    });

    expect(price.total).toBe(6000);
  });

  it("fails when two seasons tie on the top priority for a night", () => {
    const tied = [...SEASONS, { ...SEASONS[1], name: "Town Fiesta" }];

    expect(() => calculateBookingPrice({ ...oneNight, config: CONFIG, seasons: tied })).toThrow(
      /Holy Week.*Town Fiesta/
    );
  });

  it("measures the weekend surcharge against the base rate, with the season applied", () => {
    // Fri 2026-03-27 in Holy Week: (₱3,500 − ₱3,000) × 1.8
    const price = calculateBookingPrice({
      checkIn: day("2026-03-27"),
      checkOut: day("2026-03-28"),
      guestCount: 2,
      config: CONFIG,
      seasons: SEASONS,
    });

    expect(price.weekendSurcharge).toBe(900);
  });

  it("rounds amounts to the centavo", () => {
    const season = {
      name: "Fiesta",
      start_date: "03-26",
      end_date: "03-26",
      multiplier: 1.1,
      priority: 1,
    };

    const price = calculateBookingPrice({
      ...oneNight,
      config: { ...CONFIG, base_rate: 3333, downpayment_percent: 33 },
      seasons: [season],
    });

    expect(price.total).toBe(3666.3);
    expect(price.downpayment).toBe(1209.88);
    expect(price.balance).toBe(2456.42);
  });
});

describe("fetchActiveSeasons", () => {
  it("fails when the query fails", async () => {
    const failing = seasonsTable({ data: null, error: { code: "57014", message: "timeout" } });

    await expect(fetchActiveSeasons(failing)).rejects.toThrow(/timeout/);
  });

  // Prod has no seasonal_rates table yet
  it.each(["42P01", "PGRST205"])(
    "returns no seasons when the table is missing (%s)",
    async (code) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const missing = seasonsTable({
        data: null,
        error: { code, message: "relation does not exist" },
      });

      await expect(fetchActiveSeasons(missing)).resolves.toEqual([]);
    }
  );
});
