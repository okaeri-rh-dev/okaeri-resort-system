// src/__tests__/architecture/pricing-parity.test.ts
/**
 * The same stay must cost the same on every live pricing path:
 * - the staff booking form (useMultiUnitBookingStore.calculateUnitPricing),
 * - booking creation, which stores the price (functions/lib/unit-pricing.ts),
 * - the quote / guest-booking calculator (functions/lib/pricing.ts).
 *
 * Seasonal multipliers are out of scope: only functions/lib/pricing.ts applies
 * them (see the guardrails plan, Decisions & Deferrals), so its stub returns
 * no seasonal rate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { isWeekendNight } from "@/lib/pricing/weekend-night";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import type { BookingUnit } from "@/types/multi-unit-booking";

import { calculateBookingPrice } from "../../../functions/lib/pricing";
import { calculateUnitPricing as calculateStoredUnitPricing } from "../../../functions/lib/unit-pricing";

const PRICING_CONFIG = {
  id: "default",
  base_rate: 3000,
  weekend_rate: 3500,
  extra_person_rate: 500,
  base_occupancy: 2,
  max_capacity_per_unit: 10,
  downpayment_percent: 50,
  currency: "PHP",
  created_at: null,
  updated_at: null,
};

// 2026-10-08 is a Thursday.
const STAYS = [
  { label: "Thu→Fri", checkIn: "2026-10-08", checkOut: "2026-10-09", weekendNights: 0 },
  { label: "Fri→Sun", checkIn: "2026-10-09", checkOut: "2026-10-11", weekendNights: 2 },
  { label: "Sat→Sun", checkIn: "2026-10-10", checkOut: "2026-10-11", weekendNights: 1 },
  { label: "Sun→Mon", checkIn: "2026-10-11", checkOut: "2026-10-12", weekendNights: 0 },
  { label: "Mon→Mon", checkIn: "2026-10-12", checkOut: "2026-10-19", weekendNights: 2 },
];

const GUEST_COUNTS = [2, 4];

function stubSupabase(): SupabaseClient {
  const query = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      lte: () => chain,
      gte: () => chain,
      single: async () =>
        table === "pricing_config"
          ? { data: PRICING_CONFIG, error: null }
          : { data: null, error: { message: "no rows" } },
    };
    return chain;
  };
  return { from: query } as unknown as SupabaseClient;
}

function formUnit(): BookingUnit {
  return {
    unit_id: "unit-1",
    unit_name: "Cabin 1",
    unit_code: "C1",
    unit_type: "cabin",
    max_occupancy: 6,
    base_occupancy: PRICING_CONFIG.base_occupancy,
    base_rate: PRICING_CONFIG.base_rate,
    weekend_rate: PRICING_CONFIG.weekend_rate,
    extra_person_rate: PRICING_CONFIG.extra_person_rate,
    pricing: { nights: 0, base_total: 0, weekend_surcharge: 0, extra_person_fee: 0, unit_total: 0 },
    availability: { is_available: true, checking: false },
  };
}

function expectedTotal(stay: (typeof STAYS)[number], guests: number): number {
  const nights = (Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86_400_000;
  const weekdayNights = nights - stay.weekendNights;
  const extraPersons = Math.max(0, guests - PRICING_CONFIG.base_occupancy);
  return (
    weekdayNights * PRICING_CONFIG.base_rate +
    stay.weekendNights * PRICING_CONFIG.weekend_rate +
    extraPersons * PRICING_CONFIG.extra_person_rate * nights
  );
}

describe("isWeekendNight", () => {
  it("is true for Friday and Saturday nights only", () => {
    const week = [
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ];
    expect(week.map((day) => isWeekendNight(new Date(`${day}T00:00:00`)))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });
});

describe("pricing parity", () => {
  for (const stay of STAYS) {
    for (const guests of GUEST_COUNTS) {
      it(`${stay.label}, ${guests} guests: form, stored and quote totals agree`, async () => {
        const formTotal = useMultiUnitBookingStore
          .getState()
          .calculateUnitPricing(formUnit(), stay.checkIn, stay.checkOut, guests).unit_total;

        const storedTotal = calculateStoredUnitPricing(
          {
            unit_id: "unit-1",
            base_rate: null,
            weekend_rate: null,
            extra_person_rate: null,
            base_occupancy: null,
          },
          stay.checkIn,
          stay.checkOut,
          guests,
          PRICING_CONFIG
        ).subtotal;

        const quote = await calculateBookingPrice(stubSupabase(), {
          checkIn: new Date(stay.checkIn),
          checkOut: new Date(stay.checkOut),
          guestCount: guests,
        });

        expect({ form: formTotal, stored: storedTotal, quote: quote.total }).toEqual({
          form: expectedTotal(stay, guests),
          stored: expectedTotal(stay, guests),
          quote: expectedTotal(stay, guests),
        });
      });
    }
  }
});
