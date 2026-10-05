/**
 * Dynamic Pricing Calculation System with Database Integration
 *
 * ⚠️ FRONTEND ONLY - This module is designed for React/Vite frontend context.
 * For Cloudflare Workers pricing calculations, use functions/lib/pricing.ts instead.
 *
 * This module provides pricing calculations that integrate with
 * seasonal rates stored in the database, replacing hardcoded values.
 * It uses the frontend Supabase client (with VITE_* environment variables).
 */

import { addDays, eachDayOfInterval, format } from "date-fns";

import { isWeekendNight } from "@/lib/pricing/weekend-night";
import { db } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type PricingConfig = Database["public"]["Tables"]["pricing_config"]["Row"];

/**
 * Calculate the total price for a booking with seasonal adjustments
 */
export async function calculateBookingPrice(params: {
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  baseRate?: number;
  weekendRate?: number;
  extraPersonRate?: number;
  baseOccupancy?: number;
}) {
  const {
    checkIn,
    checkOut,
    guestCount,
    baseRate: overrideBaseRate,
    weekendRate: overrideWeekendRate,
    extraPersonRate: overrideExtraPersonRate,
    baseOccupancy: overrideBaseOccupancy,
  } = params;

  // Fetch pricing config (use overrides if provided, for unit-specific rates)
  const pricingConfig = await fetchPricingConfig();

  const baseRate = overrideBaseRate ?? pricingConfig.base_rate;
  const weekendRate = overrideWeekendRate ?? pricingConfig.weekend_rate;
  const extraPersonRate = overrideExtraPersonRate ?? pricingConfig.extra_person_rate;
  const baseOccupancy = overrideBaseOccupancy ?? pricingConfig.base_occupancy;

  // Get all dates in the booking period
  const nights = eachDayOfInterval({ start: checkIn, end: addDays(checkOut, -1) });

  // Calculate nightly rates with seasonal adjustments
  const nightlyBreakdown = await Promise.all(
    nights.map(async (date) => {
      const weekendNight = isWeekendNight(date);
      const baseNightRate = weekendNight ? weekendRate : baseRate;

      // Get seasonal multiplier for this date
      const seasonalMultiplier = await getSeasonalMultiplier(date);

      const finalRate = baseNightRate * seasonalMultiplier;

      return {
        date: format(date, "yyyy-MM-dd"),
        isWeekend: weekendNight,
        baseRate: baseNightRate,
        seasonalMultiplier,
        finalRate,
        seasonName: await getSeasonName(date),
      };
    })
  );

  // Calculate subtotal
  const subtotal = nightlyBreakdown.reduce((sum, night) => sum + night.finalRate, 0);

  // Calculate extra person charges
  const extraPersons = Math.max(0, guestCount - baseOccupancy);
  const extraPersonTotal = extraPersons * extraPersonRate * nights.length;

  // Calculate totals
  const total = subtotal + extraPersonTotal;
  const downpayment = total * (pricingConfig.downpayment_percent / 100);

  return {
    nights: nights.length,
    nightlyBreakdown,
    subtotal,
    extraPersons,
    extraPersonTotal,
    total,
    downpayment,
    balance: total - downpayment,
    currency: pricingConfig.currency,
  };
}

/**
 * Get the seasonal multiplier for a specific date
 */
export async function getSeasonalMultiplier(date: Date): Promise<number> {
  try {
    const seasonalRate = await db.seasonalRates.forDate(date);
    return seasonalRate?.multiplier || 1.0;
  } catch (error) {
    console.error("Error fetching seasonal rate:", error);
    return 1.0; // Default to no adjustment if error
  }
}

/**
 * Get the season name for a specific date
 */
async function getSeasonName(date: Date): Promise<string | null> {
  try {
    const seasonalRate = await db.seasonalRates.forDate(date);
    return seasonalRate?.name || null;
  } catch (error) {
    console.error("Error fetching season name:", error);
    return null;
  }
}

/**
 * Fetch pricing configuration from database
 */
async function fetchPricingConfig(): Promise<PricingConfig> {
  const { data, error } = await db.pricingConfig.get();

  if (error || !data) {
    // Return defaults if no config exists
    return {
      id: "",
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
  }

  return data;
}

/**
 * Get all seasonal rates that apply to a date range
 */
export async function getSeasonalRatesForDateRange(
  startDate: Date,
  endDate: Date
): Promise<{ date: string; season: string | null; multiplier: number }[]> {
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  const ratesForDates = await Promise.all(
    dates.map(async (date) => {
      const seasonalRate = await db.seasonalRates.forDate(date);
      return {
        date: format(date, "yyyy-MM-dd"),
        season: seasonalRate?.name || null,
        multiplier: seasonalRate?.multiplier || 1.0,
      };
    })
  );

  return ratesForDates;
}

/**
 * Calculate price for a single night with all adjustments
 */
export async function calculateSingleNightPrice(
  date: Date,
  baseRate: number,
  weekendRate: number,
  extraPersons: number = 0,
  extraPersonRate: number = 0
): Promise<{
  date: string;
  baseRate: number;
  finalRate: number;
  seasonalMultiplier: number;
  extraPersonCharge: number;
  total: number;
}> {
  const weekendNight = isWeekendNight(date);
  const nightBaseRate = weekendNight ? weekendRate : baseRate;
  const seasonalMultiplier = await getSeasonalMultiplier(date);
  const finalRate = nightBaseRate * seasonalMultiplier;
  const extraPersonCharge = extraPersons * extraPersonRate;

  return {
    date: format(date, "yyyy-MM-dd"),
    baseRate: nightBaseRate,
    finalRate,
    seasonalMultiplier,
    extraPersonCharge,
    total: finalRate + extraPersonCharge,
  };
}

/**
 * Preview pricing for a date range (useful for calendar display)
 */
export async function previewPricingCalendar(
  year: number,
  month: number
): Promise<Map<string, { price: number; season: string | null }>> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month

  const pricingConfig = await fetchPricingConfig();
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  const priceMap = new Map<string, { price: number; season: string | null }>();

  for (const date of dates) {
    const weekendNight = isWeekendNight(date);
    const baseRate = weekendNight ? pricingConfig.weekend_rate : pricingConfig.base_rate;
    const seasonalRate = await db.seasonalRates.forDate(date);
    const finalPrice = baseRate * (seasonalRate?.multiplier || 1.0);

    priceMap.set(format(date, "yyyy-MM-dd"), {
      price: finalPrice,
      season: seasonalRate?.name || null,
    });
  }

  return priceMap;
}
