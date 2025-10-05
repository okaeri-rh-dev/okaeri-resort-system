/**
 * Comprehensive validation schemas for guest booking
 * Includes security measures against common attacks
 */

import { z } from "zod";
import DOMPurify from "dompurify";
import { isDisposableEmail } from "../disposable-emails";

/**
 * Philippine phone number validation
 */
const phPhoneRegex = /^(\+63|0)?9\d{9}$/;

/**
 * Sanitize string input to prevent XSS
 */
const sanitizeString = (val: string): string => {
  return DOMPurify.sanitize(val, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content only
  });
};

/**
 * Validate phone number (Philippine format)
 */
const validatePhoneNumber = (phone: string): boolean => {
  // Remove spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-()]/g, "");

  // Check Philippine format
  if (phPhoneRegex.test(cleaned)) {
    return true;
  }

  // Allow international format for foreign guests
  const internationalRegex = /^\+?[1-9]\d{7,14}$/;
  return internationalRegex.test(cleaned);
};

/**
 * Guest information schema with enhanced security
 */
export const guestInfoSchema = z.object({
  first_name: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters")
    .transform(sanitizeString)
    .refine(
      (val) => /^[a-zA-Z\s'\-À-ÿĀ-žА-я]+$/.test(val),
      "First name contains invalid characters"
    ),

  last_name: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be less than 50 characters")
    .transform(sanitizeString)
    .refine(
      (val) => /^[a-zA-Z\s'\-À-ÿĀ-žА-я]+$/.test(val),
      "Last name contains invalid characters"
    ),

  email: z
    .string()
    .email("Invalid email address")
    .toLowerCase()
    .max(100, "Email must be less than 100 characters")
    .refine((email) => !email.includes("+"), "Email addresses with + are not allowed")
    .refine(
      (email) => !isDisposableEmail(email),
      "Disposable email addresses are not allowed. Please use a permanent email address."
    )
    .refine((email) => {
      // Prevent SQL injection patterns in email
      const sqlPatterns = [
        /['";]/,
        /\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|EXEC|SCRIPT)\b/i,
        /-{2,}/, // SQL comments
        /\/\*/, // SQL block comments
      ];
      return !sqlPatterns.some((pattern) => pattern.test(email));
    }, "Email contains invalid characters"),

  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .max(20, "Phone number must be less than 20 characters")
    .transform((val) => val.replace(/[\s\-()]/g, ""))
    .refine(validatePhoneNumber, "Invalid phone number format"),

  notes: z
    .string()
    .max(500, "Notes must be less than 500 characters")
    .transform(sanitizeString)
    .optional(),
});

/**
 * Booking details schema with security validations
 */
export const bookingDetailsSchema = z.object({
  unit_id: z
    .string()
    .uuid("Invalid unit ID format")
    .refine((val) => !val.includes("'") && !val.includes('"'), "Invalid unit ID"),

  check_in_date: z
    .string()
    .datetime()
    .refine((date) => {
      const checkIn = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return checkIn >= today;
    }, "Check-in date must be today or in the future")
    .refine((date) => {
      // Prevent dates too far in the future (2 years max)
      const checkIn = new Date(date);
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 2);
      return checkIn <= maxDate;
    }, "Check-in date cannot be more than 2 years in the future"),

  check_out_date: z.string().datetime(),

  guest_count: z
    .number()
    .int("Guest count must be a whole number")
    .min(1, "At least 1 guest required")
    .max(20, "Maximum 20 guests allowed"),

  payment_amount: z
    .number()
    .positive("Payment amount must be positive")
    .max(1000000, "Payment amount exceeds maximum allowed")
    .refine((val) => Number.isFinite(val) && !Number.isNaN(val), "Invalid payment amount"),

  payment_method: z.enum(["gcash", "bank_transfer", "credit_card", "cash", "maya", "paypal"], {
    errorMap: () => ({ message: "Invalid payment method selected" }),
  }),

  payment_reference: z
    .string()
    .max(100, "Payment reference too long")
    .transform(sanitizeString)
    .optional(),
});

/**
 * File upload validation schema
 */
export const fileUploadSchema = z.object({
  file_name: z
    .string()
    .max(255, "File name too long")
    .refine((name) => {
      // Prevent path traversal attacks
      const dangerous = ["../", "..\\", "..", "/", "\\"];
      return !dangerous.some((pattern) => name.includes(pattern));
    }, "Invalid file name")
    .refine((name) => {
      // Only allow safe file extensions
      const allowed = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
      const ext = name.toLowerCase().substring(name.lastIndexOf("."));
      return allowed.includes(ext);
    }, "File type not allowed"),

  file_type: z.enum(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"], {
    errorMap: () => ({ message: "Invalid file type" }),
  }),

  file_size: z
    .number()
    .positive("File size must be positive")
    .max(2 * 1024 * 1024, "File must be less than 2MB"),
});

/**
 * Combined guest booking schema
 */
export const guestBookingSchema = z
  .object({
    // Guest information
    guest_name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be less than 100 characters")
      .transform(sanitizeString),

    email: z
      .string()
      .email("Invalid email address")
      .toLowerCase()
      .refine((email) => !isDisposableEmail(email), "Disposable email addresses are not allowed"),

    phone_number: z
      .string()
      .transform((val) => val.replace(/[\s\-()]/g, ""))
      .refine(validatePhoneNumber, "Invalid phone number"),

    // Booking details
    unit_id: z.string().uuid("Invalid unit ID"),
    check_in: z.string().datetime(),
    check_out: z.string().datetime(),
    num_guests: z.number().min(1).max(20),

    special_requests: z.string().max(500).transform(sanitizeString).optional(),

    // Security
    turnstile_token: z.string().min(1, "CAPTCHA verification required"),

    // File info
    file_name: z.string().max(255),
    file_type: z.enum(["image/jpeg", "image/png", "image/jpg", "image/webp", "application/pdf"]),
    file_size: z.number().max(2 * 1024 * 1024),

    // Terms
    terms_accepted: z
      .boolean()
      .optional()
      .refine((val) => val === true, "You must accept the terms and conditions"),
  })
  .refine(
    (data) => {
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
      const checkIn = new Date(data.check_in);
      const checkOut = new Date(data.check_out);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      return nights <= 30; // Max 30 nights
    },
    {
      message: "Maximum booking duration is 30 nights",
      path: ["check_out"],
    }
  );

/**
 * Status check validation schema
 */
export const statusCheckSchema = z.object({
  booking_reference: z.string().regex(/^BK-\d{4}-[A-Z0-9]{6}$/, "Invalid booking reference format"),

  email: z.string().email("Invalid email address").toLowerCase().max(100),

  turnstile_token: z.string().optional(), // Optional, required after rate limiting
});

/**
 * Validate and sanitize search query
 */
export function validateSearchQuery(query: string): string {
  // Remove SQL injection attempts
  const sqlPatterns = [
    /['";]/g,
    /\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|EXEC|SCRIPT)\b/gi,
    /-{2,}/g,
    /\/\*/g,
    /\*\//g,
  ];

  let sanitized = query;
  for (const pattern of sqlPatterns) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Limit length and sanitize HTML
  sanitized = sanitized.substring(0, 100);
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  return sanitized.trim();
}

/**
 * Type exports for use in components
 */
export type GuestInfo = z.infer<typeof guestInfoSchema>;
export type BookingDetails = z.infer<typeof bookingDetailsSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type GuestBooking = z.infer<typeof guestBookingSchema>;
export type StatusCheck = z.infer<typeof statusCheckSchema>;
