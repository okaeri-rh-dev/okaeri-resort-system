/**
 * Dynamic Pricing Calculation System for Cloudflare Workers
 *
 * ⚠️ WORKERS ONLY - This module is designed for Cloudflare Workers context.
 *
 * This module provides pricing calculations with database integration
 * for seasonal rates, accepting a Supabase client instance.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, eachDayOfInterval, format } from "date-fns";

import type { Database } from "@/types/database.types";

import { isWeekendNight } from "../../src/lib/pricing/weekend-night";

type PricingConfig = Pick<
  Database["public"]["Tables"]["pricing_config"]["Row"],
  | "base_rate"
  | "weekend_rate"
  | "extra_person_rate"
  | "base_occupancy"
  | "downpayment_percent"
  | "currency"
>;

type SeasonalRate = Pick<
  Database["public"]["Tables"]["seasonal_rates"]["Row"],
  "name" | "start_date" | "end_date" | "multiplier" | "priority"
>;

export const toCentavo = (amount: number) => Math.round(amount * 100) / 100;

/**
 * Calculate the total price for a booking with seasonal adjustments
 */
export async function calculateBookingPrice(
  supabase: SupabaseClient<Database>,
  params: {
    checkIn: Date;
    checkOut: Date;
    guestCount: number;
    config: PricingConfig;
  }
) {
  const { checkIn, checkOut, guestCount, config } = params;
  const {
    base_rate: baseRate,
    weekend_rate: weekendRate,
    extra_person_rate: extraPersonRate,
    base_occupancy: baseOccupancy,
  } = config;

  const nights = eachDayOfInterval({ start: checkIn, end: addDays(checkOut, -1) });
  const seasons = await fetchActiveSeasons(supabase);

  const nightlyBreakdown = nights.map((date) => {
    const weekendNight = isWeekendNight(date);
    const baseNightRate = weekendNight ? weekendRate : baseRate;
    const season = seasonForNight(seasons, date);
    const seasonalMultiplier = season?.multiplier ?? 1;

    return {
      date: format(date, "yyyy-MM-dd"),
      isWeekend: weekendNight,
      baseRate: baseNightRate,
      seasonalMultiplier,
      finalRate: toCentavo(baseNightRate * seasonalMultiplier),
      seasonName: season?.name ?? null,
    };
  });

  // Calculate subtotal
  const subtotal = toCentavo(nightlyBreakdown.reduce((sum, night) => sum + night.finalRate, 0));

  // Calculate extra person charges
  const extraPersons = Math.max(0, guestCount - baseOccupancy);
  const extraPersonTotal = toCentavo(extraPersons * extraPersonRate * nights.length);

  // Calculate totals
  const total = toCentavo(subtotal + extraPersonTotal);
  const downpayment = toCentavo(total * (config.downpayment_percent / 100));

  return {
    nights: nights.length,
    nightlyBreakdown,
    subtotal,
    extraPersons,
    extraPersonTotal,
    total,
    downpayment,
    balance: toCentavo(total - downpayment),
    currency: config.currency,
  };
}

const MISSING_TABLE_CODES = ["42P01", "PGRST205"];

async function fetchActiveSeasons(supabase: SupabaseClient<Database>): Promise<SeasonalRate[]> {
  const { data, error } = await supabase
    .from("seasonal_rates")
    .select("name, start_date, end_date, multiplier, priority")
    .eq("is_active", true);

  // shortcut: prod has no seasonal_rates table, so a missing table means no seasons; remove once deferred item 5 (guardrails plan) is decided
  if (error && MISSING_TABLE_CODES.includes(error.code)) {
    console.warn("[PRICING] seasonal_rates table missing, pricing without seasons");
    return [];
  }
  if (error) throw new Error(`Seasonal rates lookup failed: ${error.message}`);
  return data;
}

// Seasons recur every year: start_date and end_date are MM-DD, and a season may wrap past Dec 31
function seasonForNight(seasons: SeasonalRate[], night: Date): SeasonalRate | null {
  const monthDay = format(night, "MM-dd");
  const covering = seasons.filter(({ start_date: start, end_date: end }) =>
    start <= end ? monthDay >= start && monthDay <= end : monthDay >= start || monthDay <= end
  );
  covering.sort((a, b) => b.priority - a.priority);
  const [top, runnerUp] = covering;
  if (top && runnerUp && top.priority === runnerUp.priority) {
    throw new Error(
      `Seasons ${top.name} and ${runnerUp.name} overlap on ${monthDay} with equal priority`
    );
  }
  return top ?? null;
}
