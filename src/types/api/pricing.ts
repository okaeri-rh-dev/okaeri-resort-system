/**
 * Pricing API Types
 *
 * These types define the contract for the pricing calculation API endpoint.
 * Used by both the frontend hooks and the serverless function.
 */

/**
 * Request payload for pricing calculation
 */
export interface PricingCalculateRequest {
  /** Check-in date in YYYY-MM-DD format */
  check_in: string;

  /** Check-out date in YYYY-MM-DD format */
  check_out: string;

  /** Number of guests for the booking */
  guest_count: number;

  /** Unit ID for single unit pricing (optional) */
  unit_id?: string;

  /** Custom pricing parameters when unit_id is not provided */
  custom_pricing?: {
    base_rate: number;
    weekend_rate: number;
    extra_person_rate: number;
    base_occupancy: number;
  };

  /** Multiple unit requests for multi-unit bookings */
  unit_requests?: Array<{
    unit_id: string;
    guest_count: number;
  }>;
}

/**
 * Nightly rate breakdown for transparency
 */
export interface NightlyBreakdown {
  /** Date in YYYY-MM-DD format */
  date: string;

  /** Whether this is a weekend night (Friday/Saturday) */
  isWeekend: boolean;

  /** Base rate before seasonal adjustment */
  baseRate: number;

  /** Seasonal multiplier applied (0.5 to 3.0) */
  seasonalMultiplier: number;

  /** Final rate after all adjustments */
  finalRate: number;

  /** Name of the seasonal rate applied, if any */
  seasonName: string | null;
}

/**
 * Pricing calculation result for a single unit/request
 */
export interface PricingResult {
  /** Number of nights in the booking */
  nights: number;

  /** Detailed breakdown by night (for admin visibility) */
  nightlyBreakdown: NightlyBreakdown[];

  /** Subtotal before extra person charges */
  subtotal: number;

  /** Number of extra persons beyond base occupancy */
  extraPersons: number;

  /** Total charge for extra persons */
  extraPersonTotal: number;

  /** Final total amount */
  total: number;

  /** Required downpayment amount */
  downpayment: number;

  /** Remaining balance after downpayment */
  balance: number;

  /** Currency code */
  currency: string;
}

/**
 * Pricing result for multi-unit bookings
 */
export interface MultiUnitPricingResult {
  /** Individual unit pricing details */
  units: Array<{
    unit_id: string;
    unit_name: string;
    pricing: PricingResult;
  }>;

  /** Aggregated total amount */
  total: number;

  /** Aggregated downpayment */
  downpayment: number;

  /** Number of nights (same for all units) */
  nights: number;

  /** Currency code */
  currency: string;
}

/**
 * Successful pricing calculation response
 */
export interface PricingCalculateResponse {
  success: true;

  /** Pricing calculation result */
  pricing: PricingResult | MultiUnitPricingResult;

  /** User-friendly notice about seasonal rates */
  notice: string | null;

  /** ISO timestamp when calculation was performed */
  calculated_at: string;

  /** Whether this result was served from cache */
  cached?: boolean;
}

/**
 * Error response from pricing API
 */
export interface PricingErrorResponse {
  success?: false;
  error:
    | "VALIDATION_ERROR"
    | "RATE_LIMIT_EXCEEDED"
    | "UNIT_NOT_FOUND"
    | "CALCULATION_ERROR"
    | "METHOD_NOT_ALLOWED";
  message: string;
  errors?: Record<string, string[]>;
  // Debug information can contain any type of data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug?: any;
}

/**
 * Union type for all possible API responses
 */
export type PricingApiResponse = PricingCalculateResponse | PricingErrorResponse;

/**
 * Helper type guards
 */
export function isSuccessResponse(
  response: PricingApiResponse
): response is PricingCalculateResponse {
  return "success" in response && response.success === true;
}

export function isErrorResponse(response: PricingApiResponse): response is PricingErrorResponse {
  return "error" in response;
}

export function isMultiUnitPricing(
  pricing: PricingResult | MultiUnitPricingResult
): pricing is MultiUnitPricingResult {
  return "units" in pricing;
}

/**
 * Pricing cache entry structure
 */
export interface PricingCacheEntry {
  pricing: PricingResult | MultiUnitPricingResult;
  notice: string | null;
  calculated_at: string;
}

/**
 * Rate limit tracking structure
 */
export interface RateLimitEntry {
  count: number;
  resetAt: number;
}
