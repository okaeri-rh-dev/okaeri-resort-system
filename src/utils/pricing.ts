/**
 * Dynamic Pricing Calculation System for Okaeri Resort System
 *
 * Handles dynamic rate calculations including weekday/weekend pricing,
 * seasonal adjustments, multi-night discounts, promotions, and
 * Philippine tax compliance requirements.
 *
 * @module PricingCalculations
 */

import type { Unit } from "@/types";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PricingConfig {
  weekendMultiplier: number;
  seasonalRates: SeasonalRate[];
  discountRules: DiscountRule[];
  taxRates: TaxConfiguration;
  occupancyRates: OccupancyRate[];
  promotions: Promotion[];
}

export interface SeasonalRate {
  seasonId: string;
  name: string;
  startDate: string; // MM-DD format
  endDate: string; // MM-DD format
  multiplier: number;
  unitTypes?: string[]; // If undefined, applies to all unit types
  priority: number; // Higher priority overrides lower priority
}

export interface DiscountRule {
  ruleId: string;
  name: string;
  discountType: "percentage" | "fixed" | "per_night";
  value: number;
  conditions: DiscountCondition[];
  isActive: boolean;
  stackable: boolean; // Can be combined with other discounts
  maxDiscount?: number; // Maximum discount amount
}

export interface DiscountCondition {
  type: "min_nights" | "advance_booking" | "unit_type" | "guest_type" | "date_range" | "custom";
  operator: "gte" | "lte" | "eq" | "in" | "between";
  value: any;
  description: string;
}

export interface OccupancyRate {
  guestCount: number;
  baseOccupancy: number;
  multiplier: number; // Additional rate for extra guests
}

export interface Promotion {
  promotionId: string;
  name: string;
  description: string;
  discountType: "percentage" | "fixed" | "bogo" | "upgrade";
  discountValue: number;
  validFrom: Date;
  validTo: Date;
  unitTypes?: string[];
  minNights?: number;
  maxNights?: number;
  isActive: boolean;
  usageLimit?: number;
  usedCount: number;
}

export interface TaxConfiguration {
  vatRate: number; // VAT percentage (12% in Philippines)
  localTaxRate: number; // Local government tax
  serviceTaxRate: number; // Service tax if applicable
  withholdingTaxRate: number; // For corporate bookings
  isVatInclusive: boolean; // Whether prices include VAT
}

export interface PricingBreakdown {
  baseRate: number;
  weekendRate: number;
  seasonalRate: number;
  discountedRate: number;
  nightlyRates: NightlyRate[];
  subtotal: number;
  extraPersonCharge: number; // Total extra person charges
  extraPersonsCount: number; // Number of extra persons
  discounts: AppliedDiscount[];
  taxes: TaxBreakdown;
  totalAmount: number;
  totalNights: number;
  averageNightlyRate: number;
}

export interface NightlyRate {
  date: Date;
  dayOfWeek: string;
  baseRate: number;
  isWeekend: boolean;
  seasonalMultiplier: number;
  finalRate: number;
  appliedDiscounts: string[];
}

export interface AppliedDiscount {
  discountId: string;
  name: string;
  type: "percentage" | "fixed" | "per_night";
  value: number;
  amount: number;
  description: string;
}

export interface TaxBreakdown {
  vatAmount: number;
  localTaxAmount: number;
  serviceTaxAmount: number;
  withholdingTaxAmount: number;
  totalTaxAmount: number;
  breakdown: string[];
}

export interface PricingOptions {
  checkIn: Date;
  checkOut: Date;
  guestCount: number;
  unitType?: string;
  guestType?: "individual" | "corporate" | "group";
  promotionCode?: string;
  includeTaxes?: boolean;
  currency?: string;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  weekendMultiplier: 1.3, // 30% increase for weekends (Fri-Sat)

  seasonalRates: [
    {
      seasonId: "peak_summer",
      name: "Peak Summer Season",
      startDate: "03-01", // March 1
      endDate: "05-31", // May 31
      multiplier: 1.5,
      priority: 10,
    },
    {
      seasonId: "christmas_new_year",
      name: "Christmas & New Year",
      startDate: "12-20", // December 20
      endDate: "01-02", // January 2
      multiplier: 2.0,
      priority: 20,
    },
    {
      seasonId: "holy_week",
      name: "Holy Week",
      startDate: "03-25", // Approximate - would need dynamic calculation
      endDate: "04-01",
      multiplier: 1.8,
      priority: 15,
    },
    {
      seasonId: "low_season",
      name: "Low Season",
      startDate: "06-01", // June 1
      endDate: "09-30", // September 30
      multiplier: 0.8, // 20% discount
      priority: 5,
    },
  ],

  discountRules: [
    {
      ruleId: "early_bird",
      name: "Early Bird Discount",
      discountType: "percentage",
      value: 15,
      conditions: [
        {
          type: "advance_booking",
          operator: "gte",
          value: 30, // 30 days in advance
          description: "Book at least 30 days in advance",
        },
        {
          type: "min_nights",
          operator: "gte",
          value: 3,
          description: "Minimum 3 nights stay",
        },
      ],
      isActive: true,
      stackable: false,
      maxDiscount: 5000, // PHP 5000 maximum
    },
    {
      ruleId: "extended_stay",
      name: "Extended Stay Discount",
      discountType: "percentage",
      value: 20,
      conditions: [
        {
          type: "min_nights",
          operator: "gte",
          value: 7,
          description: "Minimum 7 nights stay",
        },
      ],
      isActive: true,
      stackable: false,
    },
    {
      ruleId: "last_minute",
      name: "Last Minute Deal",
      discountType: "percentage",
      value: 25,
      conditions: [
        {
          type: "advance_booking",
          operator: "lte",
          value: 2, // Book within 2 days
          description: "Book within 2 days of check-in",
        },
      ],
      isActive: true,
      stackable: false,
    },
  ],

  taxRates: {
    vatRate: 12, // 12% VAT in Philippines
    localTaxRate: 1, // 1% local government tax
    serviceTaxRate: 0, // No service tax for accommodation
    withholdingTaxRate: 1, // 1% withholding tax for corporate
    isVatInclusive: false, // Prices exclude VAT by default
  },

  occupancyRates: [
    { guestCount: 1, baseOccupancy: 2, multiplier: 0.8 }, // Single occupancy discount
    { guestCount: 2, baseOccupancy: 2, multiplier: 1.0 }, // Standard rate
    { guestCount: 3, baseOccupancy: 2, multiplier: 1.2 }, // Extra guest rate
    { guestCount: 4, baseOccupancy: 2, multiplier: 1.4 }, // Extra guest rate
  ],

  promotions: [],
};

// ============================================
// CORE PRICING FUNCTIONS
// ============================================

/**
 * Calculates comprehensive pricing breakdown for a booking
 *
 * @param unit - Unit to price
 * @param options - Pricing options including dates and guest count
 * @param config - Pricing configuration (uses default if not provided)
 * @returns Complete pricing breakdown
 */
export const calculatePricing = (
  unit: Unit,
  options: PricingOptions,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PricingBreakdown => {
  const { checkIn, checkOut, guestCount, guestType = "individual", includeTaxes = true } = options;

  // Calculate nightly rates
  const nightlyRates = calculateNightlyRates(unit, checkIn, checkOut, config);

  // Calculate base subtotal
  const subtotal = nightlyRates.reduce((sum, rate) => sum + rate.finalRate, 0);

  // Calculate extra person charges
  const extraPersonsCount = Math.max(0, guestCount - unit.base_occupancy);
  const extraPersonCharge = extraPersonsCount * unit.extra_person_rate * nightlyRates.length;

  // Add extra person charges to subtotal
  const subtotalWithExtraPersons = subtotal + extraPersonCharge;

  // Apply discounts
  const discounts = calculateApplicableDiscounts(
    unit,
    options,
    subtotalWithExtraPersons,
    nightlyRates.length,
    config
  );

  const totalDiscountAmount = discounts.reduce((sum, discount) => sum + discount.amount, 0);
  const discountedSubtotal = subtotalWithExtraPersons - totalDiscountAmount;

  // Calculate taxes
  const taxes = calculateTaxes(discountedSubtotal, guestType, config.taxRates);

  const totalAmount = includeTaxes ? discountedSubtotal + taxes.totalTaxAmount : discountedSubtotal;

  return {
    baseRate: unit.base_rate,
    weekendRate: unit.weekend_rate,
    seasonalRate: Math.max(...nightlyRates.map((r) => r.finalRate)),
    discountedRate: discountedSubtotal / nightlyRates.length,
    nightlyRates,
    subtotal: subtotalWithExtraPersons,
    extraPersonCharge,
    extraPersonsCount,
    discounts,
    taxes,
    totalAmount,
    totalNights: nightlyRates.length,
    averageNightlyRate: totalAmount / nightlyRates.length,
  };
};

/**
 * Calculates nightly rates for each night of the stay
 *
 * @param unit - Unit to price
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param config - Pricing configuration
 * @returns Array of nightly rates
 */
export const calculateNightlyRates = (
  unit: Unit,
  checkIn: Date,
  checkOut: Date,
  config: PricingConfig
): NightlyRate[] => {
  const nightlyRates: NightlyRate[] = [];
  const currentDate = new Date(checkIn);

  while (currentDate < checkOut) {
    const dayOfWeek = currentDate.toLocaleDateString("en-US", { weekday: "long" });
    const isWeekend = currentDate.getDay() === 5 || currentDate.getDay() === 6; // Friday or Saturday

    // Start with appropriate base rate
    let rate = isWeekend ? unit.weekend_rate : unit.base_rate;

    // Apply weekend multiplier if configured and not already weekend rate
    if (isWeekend && unit.weekend_rate === unit.base_rate) {
      rate = unit.base_rate * config.weekendMultiplier;
    }

    // Apply seasonal multipliers
    const seasonalMultiplier = getSeasonalMultiplier(currentDate, config.seasonalRates);
    const finalRate = rate * seasonalMultiplier;

    nightlyRates.push({
      date: new Date(currentDate),
      dayOfWeek,
      baseRate: isWeekend ? unit.weekend_rate : unit.base_rate,
      isWeekend,
      seasonalMultiplier,
      finalRate,
      appliedDiscounts: [], // Populated later when discounts are applied
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return nightlyRates;
};

/**
 * Gets seasonal multiplier for a specific date
 *
 * @param date - Date to check
 * @param seasonalRates - Array of seasonal rates
 * @returns Multiplier for the date (1.0 if no seasonal rate applies)
 */
export const getSeasonalMultiplier = (date: Date, seasonalRates: SeasonalRate[]): number => {
  const dateString = formatDateForSeason(date);

  // Find applicable seasonal rates
  const applicableRates = seasonalRates.filter((rate) => {
    return isDateInSeasonalRange(dateString, rate.startDate, rate.endDate);
  });

  if (applicableRates.length === 0) {
    return 1.0;
  }

  // Return highest priority rate
  const selectedRate = applicableRates.reduce((highest, current) =>
    current.priority > highest.priority ? current : highest
  );

  return selectedRate.multiplier;
};

/**
 * Formats date for seasonal comparison (MM-DD format)
 *
 * @param date - Date to format
 * @returns Formatted date string
 */
const formatDateForSeason = (date: Date): string => {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${month}-${day}`;
};

/**
 * Checks if a date falls within a seasonal range
 *
 * @param dateString - Date in MM-DD format
 * @param startDate - Season start in MM-DD format
 * @param endDate - Season end in MM-DD format
 * @returns True if date is in range
 */
const isDateInSeasonalRange = (dateString: string, startDate: string, endDate: string): boolean => {
  // Handle year-crossing seasons (e.g., Christmas/New Year)
  if (startDate > endDate) {
    return dateString >= startDate || dateString <= endDate;
  }
  return dateString >= startDate && dateString <= endDate;
};

/**
 * Calculates occupancy multiplier based on guest count
 *
 * @param guestCount - Number of guests
 * @param maxOccupancy - Maximum occupancy of unit
 * @param config - Pricing configuration
 * @returns Occupancy multiplier
 */
export const calculateOccupancyMultiplier = (
  guestCount: number,
  maxOccupancy: number,
  config: PricingConfig
): number => {
  // Find applicable occupancy rate
  const occupancyRate = config.occupancyRates.find(
    (rate) => rate.guestCount === guestCount && rate.baseOccupancy <= maxOccupancy
  );

  return occupancyRate?.multiplier || 1.0;
};

/**
 * Calculates applicable discounts for a booking
 *
 * @param unit - Unit being booked
 * @param options - Pricing options
 * @param subtotal - Subtotal before discounts
 * @param totalNights - Total number of nights
 * @param config - Pricing configuration
 * @returns Array of applicable discounts
 */
export const calculateApplicableDiscounts = (
  unit: Unit,
  options: PricingOptions,
  subtotal: number,
  totalNights: number,
  config: PricingConfig
): AppliedDiscount[] => {
  const appliedDiscounts: AppliedDiscount[] = [];

  const advanceBookingDays = Math.floor(
    (options.checkIn.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check each discount rule
  for (const rule of config.discountRules) {
    if (!rule.isActive) continue;

    const meetsConditions = rule.conditions.every((condition) =>
      evaluateDiscountCondition(condition, {
        unit,
        options,
        totalNights,
        advanceBookingDays,
        subtotal,
      })
    );

    if (meetsConditions) {
      const discountAmount = calculateDiscountAmount(rule, subtotal, totalNights);

      if (discountAmount > 0) {
        appliedDiscounts.push({
          discountId: rule.ruleId,
          name: rule.name,
          type: rule.discountType,
          value: rule.value,
          amount: discountAmount,
          description: `${rule.name}: ${formatDiscountDescription(rule)}`,
        });

        // If discount is not stackable, stop here
        if (!rule.stackable) {
          break;
        }
      }
    }
  }

  return appliedDiscounts;
};

/**
 * Evaluates a discount condition
 *
 * @param condition - Discount condition to evaluate
 * @param context - Context data for evaluation
 * @returns True if condition is met
 */
const evaluateDiscountCondition = (
  condition: DiscountCondition,
  context: {
    unit: Unit;
    options: PricingOptions;
    totalNights: number;
    advanceBookingDays: number;
    subtotal: number;
  }
): boolean => {
  const { unit, options, totalNights, advanceBookingDays } = context;

  switch (condition.type) {
    case "min_nights":
      return evaluateOperator(totalNights, condition.operator, condition.value);

    case "advance_booking":
      return evaluateOperator(advanceBookingDays, condition.operator, condition.value);

    case "unit_type":
      return condition.operator === "eq"
        ? unit.unit_type === condition.value
        : condition.operator === "in" && condition.value.includes(unit.unit_type);

    case "guest_type":
      return options.guestType === condition.value;

    case "date_range": {
      const checkInDate = formatDateForSeason(options.checkIn);
      if (condition.operator === "between") {
        return isDateInSeasonalRange(checkInDate, condition.value.start, condition.value.end);
      }
      return false;
    }

    default:
      return false;
  }
};

/**
 * Evaluates comparison operators
 *
 * @param value - Value to compare
 * @param operator - Comparison operator
 * @param target - Target value
 * @returns Comparison result
 */
const evaluateOperator = (value: any, operator: string, target: any): boolean => {
  switch (operator) {
    case "gte":
      return value >= target;
    case "lte":
      return value <= target;
    case "eq":
      return value === target;
    case "in":
      return Array.isArray(target) && target.includes(value);
    default:
      return false;
  }
};

/**
 * Calculates discount amount based on discount rule
 *
 * @param rule - Discount rule
 * @param subtotal - Subtotal before discount
 * @param totalNights - Total number of nights
 * @returns Discount amount
 */
const calculateDiscountAmount = (
  rule: DiscountRule,
  subtotal: number,
  totalNights: number
): number => {
  let discountAmount = 0;

  switch (rule.discountType) {
    case "percentage":
      discountAmount = subtotal * (rule.value / 100);
      break;

    case "fixed":
      discountAmount = rule.value;
      break;

    case "per_night":
      discountAmount = rule.value * totalNights;
      break;
  }

  // Apply maximum discount limit if specified
  if (rule.maxDiscount && discountAmount > rule.maxDiscount) {
    discountAmount = rule.maxDiscount;
  }

  return Math.round(discountAmount * 100) / 100; // Round to 2 decimal places
};

/**
 * Formats discount description for display
 *
 * @param rule - Discount rule
 * @returns Formatted description
 */
const formatDiscountDescription = (rule: DiscountRule): string => {
  switch (rule.discountType) {
    case "percentage":
      return `${rule.value}% off`;
    case "fixed":
      return `₱${rule.value.toLocaleString()} off`;
    case "per_night":
      return `₱${rule.value.toLocaleString()} off per night`;
    default:
      return "";
  }
};

/**
 * Calculates tax breakdown for Philippine compliance
 *
 * @param subtotal - Subtotal amount
 * @param guestType - Type of guest (individual/corporate)
 * @param taxConfig - Tax configuration
 * @returns Tax breakdown
 */
export const calculateTaxes = (
  subtotal: number,
  guestType: "individual" | "corporate" | "group",
  taxConfig: TaxConfiguration
): TaxBreakdown => {
  let vatAmount = 0;
  let localTaxAmount = 0;
  let serviceTaxAmount = 0;
  let withholdingTaxAmount = 0;

  const taxableAmount = subtotal;

  // Calculate VAT
  if (taxConfig.isVatInclusive) {
    // VAT is already included in the price
    vatAmount = (taxableAmount * taxConfig.vatRate) / (100 + taxConfig.vatRate);
  } else {
    // VAT is added to the price
    vatAmount = (taxableAmount * taxConfig.vatRate) / 100;
  }

  // Calculate local government tax
  localTaxAmount = (taxableAmount * taxConfig.localTaxRate) / 100;

  // Calculate service tax (if applicable)
  serviceTaxAmount = (taxableAmount * taxConfig.serviceTaxRate) / 100;

  // Calculate withholding tax (for corporate bookings)
  if (guestType === "corporate") {
    withholdingTaxAmount = (taxableAmount * taxConfig.withholdingTaxRate) / 100;
  }

  const totalTaxAmount = vatAmount + localTaxAmount + serviceTaxAmount + withholdingTaxAmount;

  const breakdown: string[] = [];
  if (vatAmount > 0) breakdown.push(`VAT (${taxConfig.vatRate}%): ₱${vatAmount.toFixed(2)}`);
  if (localTaxAmount > 0)
    breakdown.push(`Local Tax (${taxConfig.localTaxRate}%): ₱${localTaxAmount.toFixed(2)}`);
  if (serviceTaxAmount > 0)
    breakdown.push(`Service Tax (${taxConfig.serviceTaxRate}%): ₱${serviceTaxAmount.toFixed(2)}`);
  if (withholdingTaxAmount > 0)
    breakdown.push(
      `Withholding Tax (${taxConfig.withholdingTaxRate}%): ₱${withholdingTaxAmount.toFixed(2)}`
    );

  return {
    vatAmount: Math.round(vatAmount * 100) / 100,
    localTaxAmount: Math.round(localTaxAmount * 100) / 100,
    serviceTaxAmount: Math.round(serviceTaxAmount * 100) / 100,
    withholdingTaxAmount: Math.round(withholdingTaxAmount * 100) / 100,
    totalTaxAmount: Math.round(totalTaxAmount * 100) / 100,
    breakdown,
  };
};

/**
 * Formats pricing breakdown for display
 *
 * @param breakdown - Pricing breakdown
 * @param currency - Currency symbol (default: ₱)
 * @returns Formatted pricing breakdown
 */
export const formatPricingBreakdown = (
  breakdown: PricingBreakdown,
  currency: string = "₱"
): Record<string, string> => {
  const result: Record<string, string> = {
    subtotal: `${currency}${(breakdown.subtotal - breakdown.extraPersonCharge).toLocaleString()}`,
    totalNights: `${breakdown.totalNights} ${breakdown.totalNights === 1 ? "night" : "nights"}`,
  };

  // Add extra person charges if applicable
  if (breakdown.extraPersonsCount > 0) {
    result.extraPersons = `${breakdown.extraPersonsCount} extra ${breakdown.extraPersonsCount === 1 ? "person" : "persons"}: ${currency}${breakdown.extraPersonCharge.toLocaleString()}`;
  }

  // Add subtotal with extras
  if (breakdown.extraPersonCharge > 0) {
    result.subtotalWithExtras = `${currency}${breakdown.subtotal.toLocaleString()}`;
  }

  // Add discounts
  result.discounts =
    breakdown.discounts.length > 0
      ? breakdown.discounts
          .map((d) => `${d.name}: -${currency}${d.amount.toLocaleString()}`)
          .join(", ")
      : "None";

  // Add taxes and totals
  result.taxes = `${currency}${breakdown.taxes.totalTaxAmount.toLocaleString()}`;
  result.total = `${currency}${breakdown.totalAmount.toLocaleString()}`;
  result.averageNightly = `${currency}${breakdown.averageNightlyRate.toLocaleString()}`;

  return result;
};

/**
 * Calculates price comparison for multiple units
 *
 * @param units - Array of units to compare
 * @param options - Pricing options
 * @param config - Pricing configuration
 * @returns Array of pricing comparisons
 */
export const calculatePriceComparison = (
  units: Unit[],
  options: PricingOptions,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): Array<{ unit: Unit; pricing: PricingBreakdown; pricePerGuest: number }> => {
  return units
    .map((unit) => {
      const pricing = calculatePricing(unit, options, config);
      const pricePerGuest = pricing.totalAmount / options.guestCount;

      return {
        unit,
        pricing,
        pricePerGuest,
      };
    })
    .sort((a, b) => a.pricing.totalAmount - b.pricing.totalAmount);
};

// ============================================
// MULTI-UNIT BOOKING UTILITIES (PHASE 4.5)
// ============================================

/**
 * Calculates the number of weekend nights in a date range
 *
 * Counts Friday and Saturday nights for accurate weekend surcharge calculation.
 * Used by multi-unit booking add-unit operations.
 *
 * @param checkIn - Check-in date (ISO 8601 string or Date)
 * @param checkOut - Check-out date (ISO 8601 string or Date)
 * @returns Number of weekend nights (Friday and Saturday)
 *
 * @example
 * // Thu Jan 4 to Mon Jan 8, 2024 (includes Fri 5th and Sat 6th)
 * calculateWeekendNights('2024-01-04', '2024-01-08'); // Returns: 2
 *
 * @example
 * // Mon to Wed (no weekends)
 * calculateWeekendNights('2024-01-08', '2024-01-10'); // Returns: 0
 */
export function calculateWeekendNights(checkIn: string | Date, checkOut: string | Date): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  let weekendNights = 0;

  // Iterate through each night (check-in to check-out)
  const currentDate = new Date(start);
  while (currentDate < end) {
    const dayOfWeek = currentDate.getDay();

    // Friday (5) or Saturday (6) = weekend nights
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      weekendNights++;
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return weekendNights;
}

/**
 * Calculates extra person fee based on guest count
 *
 * Used for multi-unit bookings where each unit may have different guest assignments.
 *
 * @param numGuests - Number of guests assigned to unit
 * @param baseOccupancy - Base occupancy of unit (included in base rate)
 * @param extraPersonRate - Rate per extra person per night
 * @returns Total extra person fee (not multiplied by nights)
 *
 * @example
 * // 4 guests, base occupancy 2, ₱500/extra person
 * calculateExtraPersonFee(4, 2, 500); // Returns: 1000 (2 extra guests * ₱500)
 *
 * @example
 * // 2 guests, base occupancy 2 (no extra charge)
 * calculateExtraPersonFee(2, 2, 500); // Returns: 0
 */
export function calculateExtraPersonFee(
  numGuests: number,
  baseOccupancy: number,
  extraPersonRate: number
): number {
  const extraGuests = Math.max(0, numGuests - baseOccupancy);
  return extraGuests * extraPersonRate;
}
