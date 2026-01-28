/**
 * Pricing Test Data Fixtures
 *
 * Helpers for calculating expected prices and testing pricing integrity.
 * Mirrors the server-side pricing logic for E2E test assertions.
 */

import { calculateNights, countWeekendNights, isWeekendNight } from "./booking-data";

/**
 * Price breakdown structure returned by pricing calculations
 */
export interface PriceBreakdown {
  baseAmount: number;
  weekendSurcharge: number;
  seasonalMultiplier: number;
  extraPersonFees: number;
  subtotal: number;
  totalAmount: number;
  nightlyBreakdown: NightlyRate[];
}

/**
 * Per-night rate breakdown
 */
export interface NightlyRate {
  date: string;
  baseRate: number;
  isWeekend: boolean;
  seasonalMultiplier: number;
  finalRate: number;
}

/**
 * Unit pricing configuration
 */
export interface UnitPricingConfig {
  baseRate: number;
  weekendRate: number;
  baseOccupancy: number;
  maxOccupancy: number;
  extraPersonRate: number;
}

/**
 * Seasonal rate configuration
 */
export interface SeasonalRateConfig {
  id?: string;
  name: string;
  multiplier: number;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

/**
 * Default pricing configuration for tests
 */
export const DEFAULT_PRICING: UnitPricingConfig = {
  baseRate: 3500, // PHP per night
  weekendRate: 4500, // PHP per night (Fri/Sat)
  baseOccupancy: 2,
  maxOccupancy: 10,
  extraPersonRate: 500, // PHP per person per night
};

/**
 * Test pricing configurations for different scenarios
 */
export const TEST_PRICING_CONFIGS: Record<string, UnitPricingConfig> = {
  standard: DEFAULT_PRICING,
  budget: {
    baseRate: 2500,
    weekendRate: 3000,
    baseOccupancy: 2,
    maxOccupancy: 4,
    extraPersonRate: 300,
  },
  premium: {
    baseRate: 5000,
    weekendRate: 6500,
    baseOccupancy: 4,
    maxOccupancy: 10,
    extraPersonRate: 750,
  },
  familySuite: {
    baseRate: 7000,
    weekendRate: 9000,
    baseOccupancy: 6,
    maxOccupancy: 12,
    extraPersonRate: 500,
  },
};

/**
 * Seasonal rate configurations for testing
 */
export const SEASONAL_CONFIGS: Record<string, Omit<SeasonalRateConfig, "startDate" | "endDate">> = {
  peakSummer: {
    name: "Peak Summer Season",
    multiplier: 1.5,
    isActive: true,
  },
  holyWeek: {
    name: "Holy Week Premium",
    multiplier: 2.0,
    isActive: true,
  },
  lowSeason: {
    name: "Low Season Discount",
    multiplier: 0.85,
    isActive: true,
  },
  christmas: {
    name: "Christmas Holiday",
    multiplier: 1.75,
    isActive: true,
  },
  newYear: {
    name: "New Year Premium",
    multiplier: 2.0,
    isActive: true,
  },
};

/**
 * Generate seasonal config with dynamic dates
 */
export function createSeasonalConfig(
  config: keyof typeof SEASONAL_CONFIGS,
  startDaysFromNow: number,
  durationDays: number
): SeasonalRateConfig {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + startDaysFromNow);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);

  return {
    ...SEASONAL_CONFIGS[config],
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

/**
 * Check if a date falls within a seasonal rate period
 */
export function isInSeasonalPeriod(
  date: Date | string,
  seasonalConfig: SeasonalRateConfig
): boolean {
  const checkDate = typeof date === "string" ? new Date(date) : date;
  const start = new Date(seasonalConfig.startDate);
  const end = new Date(seasonalConfig.endDate);

  // Set all to midnight for accurate comparison
  checkDate.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return checkDate >= start && checkDate <= end;
}

/**
 * Get the applicable seasonal multiplier for a date
 */
export function getSeasonalMultiplier(
  date: Date | string,
  seasonalRates: SeasonalRateConfig[]
): number {
  const activeRate = seasonalRates.find(
    (rate) => rate.isActive !== false && isInSeasonalPeriod(date, rate)
  );
  return activeRate?.multiplier || 1.0;
}

/**
 * Calculate the rate for a single night
 */
export function calculateNightlyRate(
  date: Date | string,
  pricing: UnitPricingConfig,
  seasonalRates: SeasonalRateConfig[] = []
): NightlyRate {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const dateStr = dateObj.toISOString().split("T")[0];
  const isWeekend = isWeekendNight(dateObj);
  const baseRate = isWeekend ? pricing.weekendRate : pricing.baseRate;
  const seasonalMultiplier = getSeasonalMultiplier(dateObj, seasonalRates);
  const finalRate = Math.round(baseRate * seasonalMultiplier);

  return {
    date: dateStr,
    baseRate,
    isWeekend,
    seasonalMultiplier,
    finalRate,
  };
}

/**
 * Calculate extra person fees for the entire stay
 */
export function calculateExtraPersonFees(
  nights: number,
  guestCount: number,
  pricing: UnitPricingConfig
): number {
  const extraGuests = Math.max(0, guestCount - pricing.baseOccupancy);
  return extraGuests * pricing.extraPersonRate * nights;
}

/**
 * Calculate expected price for a booking
 *
 * This mirrors the server-side pricing calculation for E2E assertions.
 * The actual final price should come from the server, but this helps
 * verify the calculation is correct.
 */
export function calculateExpectedPrice(
  checkIn: Date | string,
  checkOut: Date | string,
  guestCount: number,
  pricing: UnitPricingConfig = DEFAULT_PRICING,
  seasonalRates: SeasonalRateConfig[] = []
): PriceBreakdown {
  const checkInDate = typeof checkIn === "string" ? new Date(checkIn) : checkIn;
  const checkOutDate = typeof checkOut === "string" ? new Date(checkOut) : checkOut;

  const nights = calculateNights(checkInDate, checkOutDate);
  const nightlyBreakdown: NightlyRate[] = [];

  let baseAmount = 0;
  let weekendSurcharge = 0;
  let totalSeasonalMultiplier = 0;

  // Calculate each night
  const currentDate = new Date(checkInDate);
  while (currentDate < checkOutDate) {
    const nightRate = calculateNightlyRate(currentDate, pricing, seasonalRates);
    nightlyBreakdown.push(nightRate);

    // Track base vs weekend rates
    if (nightRate.isWeekend) {
      weekendSurcharge += pricing.weekendRate - pricing.baseRate;
      baseAmount += pricing.baseRate;
    } else {
      baseAmount += pricing.baseRate;
    }

    totalSeasonalMultiplier += nightRate.seasonalMultiplier;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const averageSeasonalMultiplier = totalSeasonalMultiplier / nights;
  const subtotal = nightlyBreakdown.reduce((sum, night) => sum + night.finalRate, 0);
  const extraPersonFees = calculateExtraPersonFees(nights, guestCount, pricing);
  const totalAmount = subtotal + extraPersonFees;

  return {
    baseAmount,
    weekendSurcharge,
    seasonalMultiplier: averageSeasonalMultiplier,
    extraPersonFees,
    subtotal,
    totalAmount,
    nightlyBreakdown,
  };
}

/**
 * Calculate price for multiple units
 */
export function calculateMultiUnitPrice(
  checkIn: Date | string,
  checkOut: Date | string,
  guestCount: number,
  unitPricings: UnitPricingConfig[],
  seasonalRates: SeasonalRateConfig[] = []
): {
  unitBreakdowns: PriceBreakdown[];
  grandTotal: number;
} {
  const unitBreakdowns = unitPricings.map((pricing) =>
    calculateExpectedPrice(checkIn, checkOut, guestCount, pricing, seasonalRates)
  );

  const grandTotal = unitBreakdowns.reduce((sum, breakdown) => sum + breakdown.totalAmount, 0);

  return {
    unitBreakdowns,
    grandTotal,
  };
}

/**
 * Format price as Philippine Peso
 */
export function formatPHP(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse PHP formatted string to number
 */
export function parsePHP(formatted: string): number {
  // Remove currency symbol, commas, and whitespace
  const cleaned = formatted.replace(/[^\d.-]/g, "");
  return parseFloat(cleaned) || 0;
}

/**
 * Verify price is within acceptable tolerance (for floating point comparisons)
 */
export function isPriceEqual(actual: number, expected: number, tolerance: number = 1): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * Create test data for rate change scenarios
 */
export interface RateChangeTestData {
  originalRate: number;
  newRate: number;
  changeDate: string;
}

export function createRateChangeTestData(
  originalRate: number,
  newRate: number,
  changeDaysFromNow: number = 0
): RateChangeTestData {
  const changeDate = new Date();
  changeDate.setDate(changeDate.getDate() + changeDaysFromNow);

  return {
    originalRate,
    newRate,
    changeDate: changeDate.toISOString().split("T")[0],
  };
}
