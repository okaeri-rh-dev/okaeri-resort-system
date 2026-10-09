/**
 * Validation Schema for Multi-Unit Booking Form
 *
 * Provides Zod validation for the multi-unit booking creation flow
 *
 * @module MultiUnitBookingValidation
 */

import { z } from "zod";

import { emailRegex, philippinePhoneRegex } from "@/lib/validations";

/**
 * Base Multi-Unit Booking Form Schema (without refinements)
 *
 * Used for .pick() operations to create step-specific schemas
 */
const baseMultiUnitBookingSchema = z.object({
  // Step 1: Dates
  check_in: z.date({ message: "Check-in date is required" }),
  check_out: z.date({ message: "Check-out date is required" }),

  // Step 2: Primary Guest Information
  guest_name: z.string().min(2, "Guest name must be at least 2 characters").max(100),
  email: z.string().refine((val) => val === "" || emailRegex.test(val), "Invalid email address"),
  contact_number: z
    .string()
    .refine((val) => val === "" || philippinePhoneRegex.test(val), "Invalid phone number format"),

  // Step 4: Payment
  payment_method: z.enum(["Cash", "GCash", "BankTransfer", "CreditCard"]),
  payment_amount: z.number().positive("Payment amount must be greater than 0").optional(),
  payment_proof_url: z.string().url().optional(),

  // Optional fields
  special_requests: z.string().max(1000).optional(),
  internal_notes: z.string().max(1000).optional(),

  // Reporting flags
  is_walk_in: z.boolean(),
});

/**
 * Multi-Unit Booking Form Schema with Refinements
 *
 * Validates the entire multi-unit booking form data across all 4 steps
 */
export const multiUnitBookingSchema = baseMultiUnitBookingSchema.refine(
  (data) => new Date(data.check_out) > new Date(data.check_in),
  {
    message: "Check-out date must be after check-in date",
    path: ["check_out"],
  }
);

export type MultiUnitBookingFormData = z.infer<typeof multiUnitBookingSchema>;

/**
 * Step 1 validation (Dates only)
 */
export const step1Schema = baseMultiUnitBookingSchema.pick({
  check_in: true,
  check_out: true,
});

/**
 * Step 2 validation (Guest Information)
 */
export const step2Schema = baseMultiUnitBookingSchema.pick({
  guest_name: true,
  email: true,
  contact_number: true,
});
