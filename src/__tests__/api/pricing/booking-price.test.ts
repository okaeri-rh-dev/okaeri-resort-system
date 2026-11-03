import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { calculateBookingPrice } from "../../../../functions/lib/pricing";
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

let seasonQueries = 0;

function stubSupabase(seasonsResult: unknown = { data: [], error: null }) {
  seasonQueries = 0;
  return {
    from: (table: string) => {
      if (table !== "seasonal_rates") throw new Error(`unexpected query on ${table}`);
      seasonQueries++;
      return queryChain(seasonsResult);
    },
  } as unknown as SupabaseClient;
}

// Local midnight, as eachDayOfInterval sees it. 2026-10-08 is a Thursday.
const day = (isoDay: string) => new Date(`${isoDay}T00:00:00`);

describe("calculateBookingPrice", () => {
  it("prices from the config it is given, without loading one", async () => {
    const price = await calculateBookingPrice(stubSupabase(), {
      checkIn: day("2026-10-08"),
      checkOut: day("2026-10-10"),
      guestCount: 3,
      config: CONFIG,
    });

    // Thu ₱3,000 + Fri ₱3,500 + 1 extra guest × ₱500 × 2 nights
    expect(price.total).toBe(7500);
    expect(price.downpayment).toBe(3750);
  });

  it("applies the highest-priority season per night with one query for the stay", async () => {
    const price = await calculateBookingPrice(stubSupabase({ data: SEASONS, error: null }), {
      checkIn: day("2026-03-24"),
      checkOut: day("2026-03-26"),
      guestCount: 2,
      config: CONFIG,
    });

    // Tue in Peak Summer ₱3,000 × 1.5; Wed in Holy Week (inside Peak Summer) ₱3,000 × 1.8
    expect(price.nightlyBreakdown.map((night) => night.seasonName)).toEqual([
      "Peak Summer",
      "Holy Week",
    ]);
    expect(price.total).toBe(9900);
    expect(seasonQueries).toBe(1);
  });

  it("applies a season that wraps into the next year", async () => {
    const price = await calculateBookingPrice(stubSupabase({ data: SEASONS, error: null }), {
      checkIn: day("2026-12-31"),
      checkOut: day("2027-01-01"),
      guestCount: 2,
      config: CONFIG,
    });

    expect(price.total).toBe(6000);
  });

  const oneNight = { checkIn: day("2026-03-26"), checkOut: day("2026-03-27"), guestCount: 2 };

  it("fails when the seasons query fails", async () => {
    const failing = stubSupabase({ data: null, error: { code: "57014", message: "timeout" } });

    await expect(calculateBookingPrice(failing, { ...oneNight, config: CONFIG })).rejects.toThrow(
      /timeout/
    );
  });

  it("fails when two seasons tie on the top priority for a night", async () => {
    const tied = [...SEASONS, { ...SEASONS[1], name: "Town Fiesta" }];

    await expect(
      calculateBookingPrice(stubSupabase({ data: tied, error: null }), {
        ...oneNight,
        config: CONFIG,
      })
    ).rejects.toThrow(/Holy Week.*Town Fiesta/);
  });

  // Prod has no seasonal_rates table yet
  it.each(["42P01", "PGRST205"])(
    "prices without seasons when the table is missing (%s)",
    async (code) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const missing = stubSupabase({
        data: null,
        error: { code, message: "relation does not exist" },
      });

      const price = await calculateBookingPrice(missing, { ...oneNight, config: CONFIG });

      expect(price.total).toBe(3000);
    }
  );

  it("rounds amounts to the centavo", async () => {
    const season = {
      name: "Fiesta",
      start_date: "03-26",
      end_date: "03-26",
      multiplier: 1.1,
      priority: 1,
    };

    const price = await calculateBookingPrice(stubSupabase({ data: [season], error: null }), {
      ...oneNight,
      config: { ...CONFIG, base_rate: 3333, downpayment_percent: 33 },
    });

    expect(price.total).toBe(3666.3);
    expect(price.downpayment).toBe(1209.88);
    expect(price.balance).toBe(2456.42);
  });
});
