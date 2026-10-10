// src/lib/validation/entity-schemas.ts

import { z } from "zod";

import { sanitizeText } from "@/lib/security/sanitize";

// ============================================
// BOOKING EDIT SCHEMA
// ============================================

/**
 * Validation schema for booking edit/create forms
 * Includes XSS prevention via DOMPurify transforms
 */
export const bookingEditSchema = z
  .object({
    guest_name: z.string().min(1, "Guest name is required").max(200, "Name too long"),
    email: z.string().email("Invalid email address"),
    contact_number: z.string().min(10, "Valid phone number required").max(20, "Phone too long"),
    check_in: z.date({ required_error: "Check-in date is required" }),
    check_out: z.date({ required_error: "Check-out date is required" }),
    unit_id: z.string().uuid("Valid unit required"),
    num_guests: z
      .number({ required_error: "Number of guests is required" })
      .int()
      .min(1, "At least 1 guest required")
      .max(20, "Maximum 20 guests"),
    payment_method: z.enum(["Cash", "GCash", "BankTransfer", "Card"], {
      required_error: "Payment method is required",
    }),
    special_requests: z
      .string()
      .transform((val) => sanitizeText(val))
      .optional(),
    is_walk_in: z.boolean(),
  })
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });

export type BookingEditInput = z.infer<typeof bookingEditSchema>;

// ============================================
// UNIT EDIT SCHEMA
// ============================================

// Unit edit schema WITHOUT pricing validation (for global pricing mode)
// Used when pricing fields are hidden and auto-populated from global config
export const unitEditWithoutPricingSchema = z.object({
  unit_name: z.string().min(1, "Unit name is required").max(100, "Name too long"),
  unit_code: z
    .string()
    .min(1, "Unit code is required")
    .max(20, "Code too long")
    .transform((val) => val.toUpperCase()),
  unit_type: z.string().min(1, "Unit type is required").max(50, "Type too long"),
  max_occupancy: z
    .number({ required_error: "Max occupancy is required" })
    .int()
    .min(1, "At least 1 guest capacity")
    .max(20, "Maximum 20 guests"),
  // Pricing fields are optional since they're auto-populated from global config
  base_rate: z.number().optional().default(0),
  weekend_rate: z.number().optional().default(0),
  extra_person_rate: z.number().optional().default(0),
  amenities: z.array(z.string()).optional(),
});

export type UnitEditWithoutPricingInput = z.infer<typeof unitEditWithoutPricingSchema>;

// ============================================
// GUEST EDIT SCHEMA
// ============================================

/**
 * Validation schema for guest edit/create forms
 */
export const guestEditSchema = z.object({
  guest_name: z.string().min(1, "Guest name is required").max(200, "Name too long"),
  email: z.string().email("Invalid email address"),
  contact_number: z.string().min(10, "Valid phone number required").max(20, "Phone too long"),
});

export type GuestEditInput = z.infer<typeof guestEditSchema>;

// ============================================
// PAYMENT EDIT SCHEMA
// ============================================

/**
 * Validation schema for payment edit/create forms
 */
export const paymentEditSchema = z.object({
  payment_amount: z
    .number({ required_error: "Amount is required" })
    .positive("Amount must be positive"),
  payment_method: z.enum(["Cash", "GCash", "BankTransfer", "Card"], {
    required_error: "Payment method is required",
  }),
  payment_proof_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  notes: z
    .string()
    .max(1000, "Notes too long")
    .transform((val) => sanitizeText(val))
    .optional(),
});

export type PaymentEditInput = z.infer<typeof paymentEditSchema>;

// ============================================
// EXPENSE EDIT SCHEMA
// ============================================

/**
 * Validation schema for expense edit/create forms
 */
export const expenseEditSchema = z.object({
  description: z
    .string()
    .min(1, "Description is required")
    .max(200, "Description too long")
    .transform((val) => sanitizeText(val)),
  amount: z.number({ required_error: "Amount is required" }).positive("Amount must be positive"),
  expense_date: z.date({ required_error: "Date is required" }),
  category: z.string().min(1, "Category is required").max(50, "Category too long"),
  receipt_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  unit_id: z.string().uuid("Valid unit ID required").optional(),
  notes: z
    .string()
    .max(1000, "Notes too long")
    .transform((val) => sanitizeText(val))
    .optional(),
});

export type ExpenseEditInput = z.infer<typeof expenseEditSchema>;
