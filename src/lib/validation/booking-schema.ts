import { z } from "zod";

/**
 * Unit request validation schema
 * Array-based model: each entry = 1 unit (NO quantity field)
 */
export const unitRequestSchema = z.object({
  guests_per_unit: z
    .number({
      required_error: "Guest count is required",
      invalid_type_error: "Guest count must be a number",
    })
    .int("Guest count must be a whole number")
    .min(1, "At least 1 guest per unit")
    .max(20, "Maximum 20 guests per unit"),
});

export type UnitRequest = z.infer<typeof unitRequestSchema>;

/**
 * Philippine phone number validation
 * Supports: +639171234567, 09171234567, +63-917-123-4567
 */
const philippinePhoneRegex =
  /^\+?63\s?[-.]?\d{3}\s?[-.]?\d{3}\s?[-.]?\d{4}$|^0\d{3}\s?[-.]?\d{3}\s?[-.]?\d{4}$/;

/**
 * Complete multi-unit booking validation schema
 * Enforces array-based model and server-side pricing authority
 */
export const multiUnitBookingSchema = z
  .object({
    // Contact Information
    guest_name: z
      .string({
        required_error: "Guest name is required",
      })
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be less than 100 characters")
      .trim(),

    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .toLowerCase()
      .trim(),

    phone_number: z
      .string({
        required_error: "Phone number is required",
      })
      .regex(philippinePhoneRegex, "Invalid Philippine phone number format"),

    // Booking Dates
    check_in: z
      .string({
        required_error: "Check-in date is required",
      })
      .datetime("Invalid date format")
      .refine(
        (date) => {
          const checkIn = new Date(date);
          const now = new Date();
          now.setHours(0, 0, 0, 0); // Compare dates only
          return checkIn >= now;
        },
        {
          message: "Check-in date must be today or in the future",
        }
      ),

    check_out: z
      .string({
        required_error: "Check-out date is required",
      })
      .datetime("Invalid date format"),

    // Unit Requests (Array-based model)
    unit_requests: z
      .array(unitRequestSchema, {
        required_error: "At least one unit is required",
      })
      .min(1, "At least one unit is required")
      .max(10, "Maximum 10 units per booking"),

    // Optional Fields
    special_requests: z
      .string()
      .max(1000, "Special requests must be less than 1000 characters")
      .optional()
      .transform((val) => val?.trim() || undefined),

    payment_proof_url: z.string().url("Invalid payment proof URL").optional().nullable(),

    // Security and Compliance
    turnstile_token: z
      .string({
        required_error: "Security verification required",
      })
      .min(1, "Security verification required"),

    terms_accepted: z
      .boolean({
        required_error: "You must accept the terms and conditions",
      })
      .refine((val) => val === true, {
        message: "You must accept the terms and conditions",
      }),

    idempotency_key: z.string().uuid("Invalid idempotency key").optional(),
  })
  .refine(
    (data) => {
      // Check-out must be after check-in
      const checkIn = new Date(data.check_in);
      const checkOut = new Date(data.check_out);
      return checkOut > checkIn;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["check_out"],
    }
  )
  .refine(
    (data) => {
      // Minimum 1 night stay
      const checkIn = new Date(data.check_in);
      const checkOut = new Date(data.check_out);
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 1;
    },
    {
      message: "Minimum stay is 1 night",
      path: ["check_out"],
    }
  );

export type MultiUnitBookingRequest = z.infer<typeof multiUnitBookingSchema>;

/**
 * Step field mapping for multi-step form validation
 */
export const STEP_FIELDS = {
  1: ["check_in", "check_out"] as const, // Dates step
  2: ["unit_requests"] as const, // Units step
  3: ["guest_name", "email", "phone_number", "special_requests"] as const, // Contact step
  4: ["payment_proof_url"] as const, // Payment proof step (optional)
  5: ["terms_accepted", "turnstile_token"] as const, // Review step
} as const;
