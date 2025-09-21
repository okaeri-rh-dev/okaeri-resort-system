import { z } from "zod";

// ============================================
// UTILITY VALIDATION FUNCTIONS
// ============================================

// Philippine phone number validation
const philippinePhoneRegex = /^(\+63|0)(9\d{9}|[2-8]\d{8})$/;

// Email validation (more strict)
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
export const currencySchema = z
  .string()
  .min(1, messages.required)
  .regex(/^\d+(\.\d{1,2})?$/, messages.currency)
  .refine((val) => {
    const num = parseFloat(val);
    return num >= 100 && num <= 1000000;
  }, "Amount must be between ₱100.00 and ₱1,000,000.00");

// Philippine phone number validation
export const phoneSchema = z
  .string()
  .min(1, messages.required)
  .regex(philippinePhoneRegex, messages.phone);

// Email validation
export const emailSchema = z.string().min(1, messages.required).regex(emailRegex, messages.email);

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
  required_error: messages.required,
  invalid_type_error: "Please select a valid date",
});

// Future date validation
export const futureDateSchema = dateSchema.refine((date) => date > new Date(), messages.futureDate);

// File validation for payment proofs
export const fileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= 5 * 1024 * 1024, messages.maxFileSize)
  .refine(
    (file) => ["image/png", "image/jpeg", "image/jpg"].includes(file.type),
    messages.fileType
  );

// Optional file validation
export const optionalFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= 5 * 1024 * 1024, messages.maxFileSize)
  .refine((file) => ["image/png", "image/jpeg", "image/jpg"].includes(file.type), messages.fileType)
  .optional();

// Unit code validation
export const unitCodeSchema = z
  .string()
  .min(1, messages.required)
  .max(10, messages.maxLength(10))
  .regex(/^[A-Z0-9]+$/, messages.unitCode);

// ============================================
// GUEST VALIDATION SCHEMAS
// ============================================

export const guestSchema = z.object({
  guest_name: nameSchema,
  email: emailSchema,
  phone_number: phoneSchema,
});

export const guestQuickFormSchema = guestSchema.extend({
  check_existing: z.boolean(),
});

// ============================================
// UNIT VALIDATION SCHEMAS
// ============================================

export const unitFormSchema = z.object({
  unit_name: z.string().min(1, messages.required).max(50, messages.maxLength(50)),

  unit_code: unitCodeSchema,

  unit_type: z.enum(["Standard", "Deluxe", "Suite", "Villa"] as const, {
    required_error: "Please select a unit type",
  }),

  max_occupancy: z.number().min(1, messages.minGuests).max(20, messages.maxOccupancy),

  base_rate: z.number().min(100, messages.minAmount).max(1000000, messages.maxAmount),

  weekend_rate: z.number().min(100, messages.minAmount).max(1000000, messages.maxAmount),

  amenities: z.array(z.string()).min(1, "Please select at least one amenity"),
});

// Validation to ensure weekend rate is higher than base rate
export const unitFormWithRateValidationSchema = unitFormSchema.refine(
  (data) => data.weekend_rate >= data.base_rate,
  {
    message: "Weekend rate should be equal to or higher than base rate",
    path: ["weekend_rate"],
  }
);

// ============================================
// BOOKING VALIDATION SCHEMAS
// ============================================

// Base booking form schema
export const bookingFormBaseSchema = z.object({
  unit_id: z.string().min(1, "Please select a unit"),

  guest_name: nameSchema,

  contact_number: phoneSchema,

  email: emailSchema,

  num_guests: z.number().min(1, messages.minGuests).max(20, "Number of guests cannot exceed 20"),

  special_requests: z.string().max(500, messages.maxLength(500)).optional(),

  payment_method: z.enum(["GCash", "BankTransfer", "Cash", "Card"] as const).optional(),
});

// Booking form with date validation
export const bookingFormSchema = bookingFormBaseSchema
  .extend({
    check_in: dateSchema,
    check_out: dateSchema,
  })
  .refine((data) => data.check_out > data.check_in, {
    message: messages.endAfterStart,
    path: ["check_out"],
  })
  .refine((data) => data.check_in >= new Date(new Date().setHours(0, 0, 0, 0)), {
    message: "Check-in date cannot be in the past",
    path: ["check_in"],
  });

// Multi-step booking form schemas
const bookingStep1BaseSchema = z.object({
  unit_id: z.string().min(1, "Please select a unit"),
  check_in: dateSchema,
  check_out: dateSchema,
  num_guests: z.number().min(1, messages.minGuests).max(20),
});

export const bookingStep1Schema = bookingStep1BaseSchema
  .refine((data) => data.check_out > data.check_in, {
    message: messages.endAfterStart,
    path: ["check_out"],
  })
  .refine((data) => data.check_in >= new Date(new Date().setHours(0, 0, 0, 0)), {
    message: "Check-in date cannot be in the past",
    path: ["check_in"],
  });

export const bookingStep2Schema = guestSchema;

export const bookingStep3Schema = z.object({
  special_requests: z.string().max(500, messages.maxLength(500)).optional(),
  payment_method: z.enum(["GCash", "BankTransfer", "Cash", "Card"] as const),
});

// Complete booking form schema (all steps combined)
export const completeBookingSchema = bookingStep1BaseSchema
  .merge(
    bookingStep2Schema.extend({
      contact_number: phoneSchema, // Add contact_number field
    })
  )
  .merge(bookingStep3Schema)
  .refine((data) => data.check_out > data.check_in, {
    message: messages.endAfterStart,
    path: ["check_out"],
  })
  .refine((data) => data.check_in >= new Date(new Date().setHours(0, 0, 0, 0)), {
    message: "Check-in date cannot be in the past",
    path: ["check_in"],
  });

// ============================================
// PAYMENT VALIDATION SCHEMAS
// ============================================

export const paymentUploadSchema = z.object({
  booking_id: z.string().min(1, "Booking ID is required"),

  payment_amount: z.number().min(100, messages.minAmount).max(1000000, messages.maxAmount),

  payment_method: z.enum(["GCash", "BankTransfer", "Cash", "Card"] as const, {
    required_error: "Please select a payment method",
  }),

  payment_proof: fileSchema,

  notes: z.string().max(300, messages.maxLength(300)).optional(),
});

// Payment proof only (for existing payments)
export const paymentProofSchema = z.object({
  payment_proof: fileSchema,
  notes: z.string().max(300, messages.maxLength(300)).optional(),
});

// ============================================
// SEARCH AND FILTER SCHEMAS
// ============================================

export const bookingFiltersSchema = z.object({
  status: z
    .enum(["Pending", "Confirmed", "CheckedIn", "CheckedOut", "Cancelled"] as const)
    .optional(),
  payment_status: z.enum(["Pending", "Partial", "Completed", "Refunded"] as const).optional(),
  unit_id: z.string().optional(),
  guest_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
});

export const unitFiltersSchema = z.object({
  status: z.enum(["Available", "Occupied", "Maintenance", "Reserved"] as const).optional(),
  type: z.enum(["Studio", "One Bedroom", "Two Bedroom", "Villa"] as const).optional(),
  min_rate: z.number().min(0).optional(),
  max_rate: z.number().min(0).optional(),
  min_occupancy: z.number().min(1).optional(),
});

// ============================================
// UPDATE SCHEMAS
// ============================================

export const updateBookingStatusSchema = z.object({
  booking_status: z.enum(["Pending", "Confirmed", "CheckedIn", "CheckedOut", "Cancelled"] as const),
  internal_notes: z.string().max(500, messages.maxLength(500)).optional(),
});

export const updatePaymentStatusSchema = z.object({
  payment_status: z.enum(["Pending", "Partial", "Completed", "Refunded"] as const),
  payment_method: z.enum(["Cash", "GCash", "BankTransfer", "Card", "Other"] as const).optional(),
  payment_proof_url: z.string().url().optional(),
});

// ============================================
// AVAILABILITY CHECK SCHEMA
// ============================================

export const availabilityCheckSchema = z
  .object({
    unit_id: z.string().min(1, "Unit ID is required"),
    check_in: dateSchema,
    check_out: dateSchema,
    booking_id: z.string().optional(), // For excluding current booking when editing
  })
  .refine((data) => data.check_out > data.check_in, {
    message: messages.endAfterStart,
    path: ["check_out"],
  });

// ============================================
// TYPE INFERENCE
// ============================================

// Export inferred types for use in components
export type GuestFormData = z.infer<typeof guestSchema>;
export type GuestQuickFormData = z.infer<typeof guestQuickFormSchema>;
export type UnitFormData = z.infer<typeof unitFormSchema>;
export type BookingFormData = z.infer<typeof bookingFormSchema>;
export type BookingStep1Data = z.infer<typeof bookingStep1Schema>;
export type BookingStep2Data = z.infer<typeof bookingStep2Schema>;
export type BookingStep3Data = z.infer<typeof bookingStep3Schema>;
export type CompleteBookingData = z.infer<typeof completeBookingSchema>;
export type PaymentUploadData = z.infer<typeof paymentUploadSchema>;
export type PaymentProofData = z.infer<typeof paymentProofSchema>;
export type BookingFiltersData = z.infer<typeof bookingFiltersSchema>;
export type UnitFiltersData = z.infer<typeof unitFiltersSchema>;
export type UpdateBookingStatusData = z.infer<typeof updateBookingStatusSchema>;
export type UpdatePaymentStatusData = z.infer<typeof updatePaymentStatusSchema>;
export type AvailabilityCheckData = z.infer<typeof availabilityCheckSchema>;

// ============================================
// VALIDATION UTILITIES
// ============================================

// Format currency for display
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

// Parse currency string to number
export const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/[^\d.]/g, ""));
};

// Format phone number for display
export const formatPhoneNumber = (phone: string): string => {
  if (phone.startsWith("+63")) {
    return phone;
  }
  if (phone.startsWith("0")) {
    return `+63${phone.slice(1)}`;
  }
  return `+63${phone}`;
};

// Validate date range doesn't conflict with existing bookings
export const validateDateRange = async (
  _unitId: string,
  _checkIn: Date,
  _checkOut: Date,
  _excludeBookingId?: string
): Promise<boolean> => {
  // This would typically make an API call to check availability
  // For now, returning true - implement actual availability check
  return true;
};

// Check if dates are within business rules (e.g., max advance booking)
export const validateBusinessRules = (checkIn: Date, checkOut: Date): string[] => {
  const errors: string[] = [];
  const today = new Date();
  const maxAdvanceDays = 365; // 1 year advance booking
  const minStayDays = 1;
  const maxStayDays = 30;

  // Check advance booking limit
  const daysDifference = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDifference > maxAdvanceDays) {
    errors.push(`Bookings can only be made up to ${maxAdvanceDays} days in advance`);
  }

  // Check stay duration
  const stayDuration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  if (stayDuration < minStayDays) {
    errors.push(`Minimum stay is ${minStayDays} day(s)`);
  }
  if (stayDuration > maxStayDays) {
    errors.push(`Maximum stay is ${maxStayDays} days`);
  }

  return errors;
};
