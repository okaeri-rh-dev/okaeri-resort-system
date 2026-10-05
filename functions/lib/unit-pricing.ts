import { isWeekendNight } from "../../src/lib/pricing/weekend-night";

export interface UnitData {
  unit_id: string;
  unit_name?: string;
  base_rate: number | null;
  weekend_rate: number | null;
  extra_person_rate: number | null;
  base_occupancy: number | null;
}

// Default pricing values when unit rates are not configured
const DEFAULT_PRICING = {
  BASE_RATE: 2500, // ₱2,500 per night
  WEEKEND_RATE: 3000, // ₱3,000 per weekend night
  EXTRA_PERSON_RATE: 500, // ₱500 per extra person
  BASE_OCCUPANCY: 2, // 2 guests included
};

/**
 * Calculate pricing for a unit (from pricing endpoint logic)
 *
 * BUG-001 FIX: Added null checks and default values for unit rates
 * Previously: If unit rates were null/undefined, calculation returned ₱0.00
 * Now: Uses default rates when unit rates are not configured
 */
export function calculateUnitPricing(
  unit: UnitData,
  checkIn: string,
  checkOut: string,
  numGuests: number,
  pricingConfig?: {
    base_rate: number;
    weekend_rate: number;
    extra_person_rate: number;
    base_occupancy: number;
  } | null
): {
  unit_price: number;
  weekend_surcharge: number;
  extra_person_charge: number;
  subtotal: number;
  used_defaults: boolean;
} {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // ============================================================
  // BUG-001 FIX: Validate and default unit rates
  // BUG-002 FIX: Use pricing_config as primary rate source
  // (matching client MultiUnitBookingForm.tsx:203 and pricing quote API calculate.ts:238)
  // Priority: pricing_config → unit rate → hardcoded default
  // ============================================================
  const baseRate =
    pricingConfig?.base_rate ??
    (unit.base_rate && unit.base_rate > 0 ? unit.base_rate : DEFAULT_PRICING.BASE_RATE);
  // Weekend rate fallback matches client (MultiUnitBookingForm.tsx:204-208):
  // pricingConfig.weekend_rate → unit.weekend_rate → baseRate (no surcharge)
  const weekendRate =
    pricingConfig?.weekend_rate ??
    (unit.weekend_rate && unit.weekend_rate > 0 ? unit.weekend_rate : baseRate);
  const extraPersonRate =
    pricingConfig?.extra_person_rate ??
    (unit.extra_person_rate && unit.extra_person_rate >= 0
      ? unit.extra_person_rate
      : DEFAULT_PRICING.EXTRA_PERSON_RATE);
  const baseOccupancy =
    pricingConfig?.base_occupancy ??
    (unit.base_occupancy && unit.base_occupancy > 0
      ? unit.base_occupancy
      : DEFAULT_PRICING.BASE_OCCUPANCY);

  // Track if defaults were used (for logging/debugging)
  const usedDefaults =
    baseRate !== unit.base_rate ||
    weekendRate !== unit.weekend_rate ||
    extraPersonRate !== unit.extra_person_rate ||
    baseOccupancy !== unit.base_occupancy;

  if (usedDefaults) {
    console.warn("[PRICING] Using default rates for unit:", {
      unit_id: unit.unit_id,
      unit_name: unit.unit_name,
      original: {
        base_rate: unit.base_rate,
        weekend_rate: unit.weekend_rate,
        extra_person_rate: unit.extra_person_rate,
        base_occupancy: unit.base_occupancy,
      },
      defaults_applied: {
        base_rate: baseRate,
        weekend_rate: weekendRate,
        extra_person_rate: extraPersonRate,
        base_occupancy: baseOccupancy,
      },
    });
  }

  let unitPrice = 0;
  let weekendSurcharge = 0;

  // Calculate per-night pricing with weekend detection
  for (let i = 0; i < nights; i++) {
    const currentDate = new Date(checkInDate);
    currentDate.setDate(currentDate.getDate() + i);
    unitPrice += baseRate;
    if (isWeekendNight(currentDate) && weekendRate > baseRate) {
      weekendSurcharge += weekendRate - baseRate;
    }
  }

  // Calculate extra person fee
  const extraPersons = Math.max(0, numGuests - baseOccupancy);
  const extraPersonCharge = extraPersons * extraPersonRate * nights;

  const result = {
    unit_price: unitPrice,
    weekend_surcharge: weekendSurcharge,
    extra_person_charge: extraPersonCharge,
    subtotal: unitPrice + weekendSurcharge + extraPersonCharge,
    used_defaults: usedDefaults,
  };

  // Validate final pricing is positive
  if (result.subtotal <= 0) {
    console.error("[PRICING] Invalid pricing calculated:", {
      unit_id: unit.unit_id,
      nights,
      numGuests,
      result,
    });
  }

  return result;
}
