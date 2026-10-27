import { z } from "zod";

import { typeError } from "./validation/type-error";

// ============================================
// UTILITY VALIDATION FUNCTIONS
// ============================================

// Philippine phone number validation
export const philippinePhoneRegex = /^(\+63|0)(9\d{9}|[2-8]\d{8})$/;

// Email validation (more strict)
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Custom validation messages
const messages = {
  required: "This field is required",
  email: "Please enter a valid email address",
  phone: "Please enter a valid Philippine phone number (e.g., +639123456789 or 09123456789)",
  positive: "Must be a positive number",
  futureDate: "Date must be in the future",
  endAfterStart: "Check-out date must be after check-in date",
  minGuests: "At least 1 guest is required",
  maxFileSize: "File size must be less than 5MB",
  fileType: "Only PNG, JPG, and JPEG files are allowed",
  currency: "Please enter a valid amount (e.g., 1500.00)",
  minAmount: "Amount must be at least ₱100.00",
  maxAmount: "Amount cannot exceed ₱1,000,000.00",
  unitCode: "Unit code must be alphanumeric (e.g., A101, B205)",
  maxOccupancy: "Maximum occupancy cannot exceed 20 guests",
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be ${max} characters or less`,
};

// ============================================
// REUSABLE VALIDATION SCHEMAS
// ============================================

// Philippine peso amount validation

// Philippine phone number validation

// Email validation

// Name validation (supports Filipino names)
export const nameSchema = z
  .string()
  .min(2, messages.minLength(2))
  .max(100, messages.maxLength(100))
  .regex(
    /^[a-zA-Z\s\u00C0-\u017F-']+$/,
    "Name can only contain letters, spaces, hyphens, and apostrophes"
  );

// Date validation
export const dateSchema = z.date({
  error: typeError(messages.required, "Please select a valid date"),
});

// Future date validation

// File validation for payment proofs

// Optional file validation

// Unit code validation
export const unitCodeSchema = z
  .string()
  .min(1, messages.required)
  .max(10, messages.maxLength(10))
  .regex(/^[A-Z0-9]+$/, messages.unitCode);

// ============================================
// UNIT VALIDATION SCHEMAS
// ============================================

export const unitFormSchema = z.object({
  unit_name: z.string().min(1, messages.required).max(50, messages.maxLength(50)),

  unit_code: unitCodeSchema,

  unit_type: z.enum(["Standard", "Deluxe", "Suite", "Villa"] as const, {
    error: typeError("Please select a unit type"),
  }),

  base_occupancy: z
    .number()
    .min(1, "Base occupancy must be at least 1")
    .max(20, "Base occupancy cannot exceed 20"),

  max_occupancy: z.number().min(1, messages.minGuests).max(20, messages.maxOccupancy),

  base_rate: z.number().min(100, messages.minAmount).max(1000000, messages.maxAmount),

  weekend_rate: z.number().min(100, messages.minAmount).max(1000000, messages.maxAmount),

  extra_person_rate: z
    .number()
    .min(0, "Extra person rate cannot be negative")
    .max(50000, "Extra person rate cannot exceed ₱50,000"),
});

// Validation to ensure weekend rate is higher than base rate and occupancy constraints

// Unit form schema WITHOUT pricing validation (for global pricing mode)
// Used when pricing fields are hidden and auto-populated from global config
export const unitFormWithoutPricingValidationSchema = unitFormSchema
  .omit({ base_rate: true, weekend_rate: true, extra_person_rate: true })
  .extend({
    // Make pricing fields optional since they're auto-populated from global config
    base_rate: z.number().optional().default(0),
    weekend_rate: z.number().optional().default(0),
    extra_person_rate: z.number().optional().default(0),
  })
  .refine((data) => data.base_occupancy <= data.max_occupancy, {
    message: "Base occupancy cannot exceed maximum occupancy",
    path: ["base_occupancy"],
  });

// ============================================
// BOOKING VALIDATION SCHEMAS
// ============================================

// Base booking form schema

// Booking form with date validation

// Multi-step booking form schemas
const bookingStep1BaseSchema = z.object({
  unit_id: z.string().min(1, "Please select a unit"),
  check_in: dateSchema,
  check_out: dateSchema,
  num_guests: z.number().min(1, messages.minGuests).max(20),
});

export const bookingStep1Schema = bookingStep1BaseSchema.refine(
  (data) => data.check_out > data.check_in,
  {
    message: messages.endAfterStart,
    path: ["check_out"],
  }
);

export const bookingStep2Schema = z.object({
  guest_name: nameSchema,
  email: z.string().refine((val) => val === "" || emailRegex.test(val), messages.email),
  phone_number: z
    .string()
    .refine((val) => val === "" || philippinePhoneRegex.test(val), messages.phone),
});

export const bookingStep3Schema = z.object({
  special_requests: z.string().max(500, messages.maxLength(500)).optional(),
  payment_method: z.enum(["GCash", "BankTransfer", "Cash", "Card"] as const),
});

// Complete booking form schema (all steps combined)
export const completeBookingSchema = bookingStep1BaseSchema
  .merge(
    z.object({
      guest_name: nameSchema,
      email: z.string().refine((val) => val === "" || emailRegex.test(val), messages.email),
      contact_number: z
        .string()
        .refine((val) => val === "" || philippinePhoneRegex.test(val), messages.phone),
      is_walk_in: z.boolean(),
    })
  )
  .merge(bookingStep3Schema)
  .refine((data) => data.check_out > data.check_in, {
    message: messages.endAfterStart,
    path: ["check_out"],
  });

// ============================================
// AVAILABILITY CHECK SCHEMA
// ============================================

export type UnitFormData = z.infer<typeof unitFormSchema>;
export type CompleteBookingData = z.infer<typeof completeBookingSchema>;

// ============================================
// VALIDATION UTILITIES
// ============================================

// Parse currency string to number

// Format phone number for display
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return "";
  if (phone.startsWith("+63")) {
    return phone;
  }
  if (phone.startsWith("0")) {
    return `+63${phone.slice(1)}`;
  }
  return `+63${phone}`;
};
