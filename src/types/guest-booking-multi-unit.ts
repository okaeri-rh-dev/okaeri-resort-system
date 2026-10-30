import { z } from "zod";

import { isManilaDay, manilaDayOf } from "@/lib/bookings/stay";

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
      .refine(isManilaDay, "Expected a YYYY-MM-DD day")
      .refine((day) => day >= manilaDayOf(new Date()), "Check-in must be today or in the future"),
    check_out: z.string().refine(isManilaDay, "Expected a YYYY-MM-DD day"),

    // Array: each entry = 1 unit (NO quantity field)
    unit_requests: z
      .array(unitRequestSchema)
      .min(1, "At least one unit required")
      .max(10, "Maximum 10 units per booking"),

    special_requests: z.string().max(1000, "Special requests too long").optional(),
    turnstile_token: z.string().min(1, "CAPTCHA token required"),
    terms_accepted: z.boolean().refine((val) => val === true, "Must accept terms"),
    idempotency_key: z.guid().optional(),
    payment_proof_url: z.string().min(1, "Payment proof is required").optional(), // Chunk 008: Payment proof upload
  })
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

// ============================================
// Response Schemas
// ============================================

export const createdMultiUnitBookingResponseSchema = z.object({
  success: z.literal(true),
  booking: z.object({
    booking_id: z.string(),
    booking_reference: z.string(),
    total_amount: z.number(),
    downpayment_amount: z.number(),
    discount_applied: z
      .object({
        percent: z.number(),
        amount: z.number(),
        rule_name: z.string(),
      })
      .optional(),
  }),
  unit_requests: z.array(unitRequestSchema),
  pricing_breakdown: z.object({
    base_total: z.number(),
    weekend_surcharge: z.number(),
    extra_person_fees: z.number(),
    subtotal: z.number(),
    discount_amount: z.number(),
    total: z.number(),
    nights: z.number(),
  }),
  message: z.string(),
  is_duplicate: z.literal(false),
});

// Same idempotency key within 48 hours: the Worker returns the stored bookings row, with no pricing.
const duplicateMultiUnitBookingResponseSchema = z.object({
  success: z.literal(true),
  booking: z.looseObject({ booking_reference: z.string() }),
  message: z.string(),
  is_duplicate: z.literal(true),
});

export const multiUnitBookingResponseSchema = z.discriminatedUnion("is_duplicate", [
  createdMultiUnitBookingResponseSchema,
  duplicateMultiUnitBookingResponseSchema,
]);

export type CreatedMultiUnitBookingResponse = z.infer<typeof createdMultiUnitBookingResponseSchema>;
export type DuplicateMultiUnitBookingResponse = z.infer<
  typeof duplicateMultiUnitBookingResponseSchema
>;

export interface PricingConfig {
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;
  base_occupancy: number;
  max_capacity_per_unit: number;
  downpayment_percent: number;
  currency: string;
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
  DATES_UNAVAILABLE: "DATES_UNAVAILABLE",
  DUPLICATE_BOOKING: "DUPLICATE_BOOKING",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
