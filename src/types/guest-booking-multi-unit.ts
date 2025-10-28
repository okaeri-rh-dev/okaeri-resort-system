import { z } from "zod";

// ============================================
// Request Schemas (Zod Validation)
// ============================================

/**
 * Array-based model: each entry = 1 unit
 * NO quantity field
 */
export const unitRequestSchema = z.object({
  guests_per_unit: z
    .number()
    .int("Guest count must be a whole number")
    .min(1, "At least 1 guest per unit"),
  // Maximum validated dynamically from pricing_config.max_capacity_per_unit
  // IMPORTANT: All units have identical capacity
});

export type UnitRequest = z.infer<typeof unitRequestSchema>;

/**
 * Multi-unit booking request schema
 * Validates entire booking payload
 */
export const multiUnitBookingSchema = z
  .object({
    guest_name: z.string().min(2, "Name too short").max(100, "Name too long"),
    email: z.string().email("Invalid email").toLowerCase(),
    phone_number: z.string().regex(/^\+?[0-9\s\-()]{10,20}$/, "Invalid phone number format"),

    check_in: z
      .string()
      .datetime()
      .refine((date) => new Date(date) > new Date(), "Check-in must be in future"),
    check_out: z.string().datetime(),

    // Array: each entry = 1 unit (NO quantity field)
    unit_requests: z
      .array(unitRequestSchema)
      .min(1, "At least one unit required")
      .max(10, "Maximum 10 units per booking"),

    special_requests: z.string().max(1000, "Special requests too long").optional(),
    turnstile_token: z.string().min(1, "CAPTCHA token required"),
    terms_accepted: z.boolean().refine((val) => val === true, "Must accept terms"),
    idempotency_key: z.string().uuid().optional(),
    payment_proof_url: z.string().min(1, "Payment proof is required").optional(), // Chunk 008: Payment proof upload
  })
  .refine((data) => new Date(data.check_out) > new Date(data.check_in), {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

export type MultiUnitBookingRequest = z.infer<typeof multiUnitBookingSchema>;

// ============================================
// Response Types
// ============================================

export interface MultiUnitBookingResponse {
  success: boolean;
  booking: {
    booking_id: string;
    booking_reference: string;
    total_amount: number;
    downpayment_amount: number;
    discount_applied?: {
      percent: number;
      amount: number;
      rule_name: string;
    };
  };
  unit_requests: Array<{ guests_per_unit: number }>;
  pricing_breakdown: {
    base_total: number;
    weekend_surcharge: number;
    extra_person_fees: number;
    subtotal: number;
    discount_amount: number;
    total: number;
    nights: number;
  };
  message: string;
  is_duplicate?: boolean;
}

export interface DiscountRule {
  id: string;
  name: string;
  description?: string;
  conditions: Array<{
    type: "min_nights" | "date_range" | "advance_booking" | "unit_count";
    operator?: "gte" | "lte" | "between";
    value: any;
  }>;
  discount_type: "percentage" | "fixed" | "per_night";
  discount_value: number;
  priority: number;
  is_active: boolean;
}

export interface PricingConfig {
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;
  base_occupancy: number;
  max_capacity_per_unit: number;
  downpayment_percent: number;
  currency: string;
}

/**
 * Pricing preview response from server
 * Returned by /api/guest-booking/preview-pricing endpoint
 * Source: 02-api-specification.md lines 676-691
 */
export interface PricingPreview {
  nights: number; // Number of nights in stay
  total_units: number; // Total units requested
  total_guests: number; // Total guests across all units
  base_total: number; // Base rate × nights × units
  weekend_surcharge: number; // Extra charge for weekend nights (Fri/Sat)
  extra_person_fees: number; // Fees for guests above base_occupancy
  subtotal: number; // base_total + surcharges + fees
  discount?: {
    // Optional discount (best-of policy)
    percent: number; // Discount percentage (e.g., 5)
    amount: number; // Discount amount in currency
    rule_name: string; // Discount rule name (e.g., "7-Night Discount")
  };
  total: number; // Final total after discount
  downpayment_required: number; // Required downpayment amount
  downpayment_percent: number; // Downpayment percentage (default: 50)
}

/**
 * API response shape for preview endpoint
 */
export interface PricingPreviewResponse {
  success: boolean;
  pricing: PricingPreview;
  _note?: string; // Server note (e.g., "PREVIEW ONLY")
}

/**
 * Request payload for preview endpoint
 */
export interface PricingPreviewRequest {
  unit_requests: UnitRequest[];
  check_in: string; // ISO 8601 datetime string
  check_out: string; // ISO 8601 datetime string
}

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",
  INVALID_GUEST_COUNT: "INVALID_GUEST_COUNT",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  UNIT_LIMIT_EXCEEDED: "UNIT_LIMIT_EXCEEDED",
  TERMS_NOT_ACCEPTED: "TERMS_NOT_ACCEPTED",

  // Authentication errors (401)
  TURNSTILE_VERIFICATION_FAILED: "TURNSTILE_VERIFICATION_FAILED",

  // Conflict errors (409)
  DUPLICATE_BOOKING: "DUPLICATE_BOOKING",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ErrorResponse {
  success: false;
  error: string;
  error_code: ErrorCode;
  details?: unknown;
}
