/**
 * Business Validation Rules and Compliance Checking for Okaeri Resort System
 *
 * Comprehensive validation system for guest information, booking constraints,
 * payment validation, and Philippine business compliance requirements.
 *
 * Enhanced with XSS prevention through DOMPurify integration.
 *
 * @module BusinessValidation
 */

import type { Guest, Booking, BookingFormData, Unit, PaymentStatus } from "@/types";
import { getPhilippineTime, analyzeBookingPeriod } from "./date-helpers";
import {
  sanitizeText,
  sanitizeEmail as secureSanitizeEmail,
  sanitizePhoneNumber,
  sanitizeName,
  sanitizeFormData as secureSanitizeFormData,
} from "@/lib/security/sanitize";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ValidationResult<T = any> {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  data?: T; // Sanitized/processed data
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: "error" | "critical";
  metadata?: Record<string, any>;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  recommendation?: string;
  metadata?: Record<string, any>;
}

export interface ValidationRule<T> {
  name: string;
  description: string;
  category: "required" | "format" | "business" | "compliance";
  severity: "error" | "warning" | "critical";
  validate: (value: T, context?: ValidationContext) => ValidationResult;
  isActive: boolean;
}

export interface ValidationContext {
  existingBookings?: Booking[];
  existingGuests?: Guest[];
  units?: Unit[];
  userRole?: string;
  operatingMode?: "strict" | "lenient";
  skipBusinessRules?: boolean;
  skipComplianceChecks?: boolean;
}

export interface PhilippineComplianceResult {
  isCompliant: boolean;
  violations: ComplianceViolation[];
  recommendations: string[];
  requiredActions: ComplianceAction[];
}

export interface ComplianceViolation {
  violationType:
    | "data_privacy"
    | "tax_compliance"
    | "business_registration"
    | "consumer_protection";
  severity: "minor" | "major" | "critical";
  description: string;
  regulation: string;
  penaltyRisk: "low" | "medium" | "high";
  remediation: string[];
}

export interface ComplianceAction {
  actionType: "immediate" | "within_24h" | "within_week" | "periodic";
  description: string;
  responsible: string;
  deadline?: Date;
  priority: "low" | "medium" | "high" | "critical";
}

export interface BookingConstraints {
  minAdvanceBookingHours: number;
  maxAdvanceBookingDays: number;
  minStayNights: number;
  maxStayNights: number;
  maxGuestsPerUnit: number;
  blackoutDates: Date[];
  restrictedDates: Date[];
  cancellationDeadlineHours: number;
  modificationDeadlineHours: number;
}

export interface PaymentValidationOptions {
  requirePaymentProof: boolean;
  allowPartialPayments: boolean;
  maxPartialPaymentPercentage: number;
  acceptedPaymentMethods: string[];
  minimumPaymentAmount: number;
  maximumPaymentAmount: number;
}

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

export const DEFAULT_BOOKING_CONSTRAINTS: BookingConstraints = {
  minAdvanceBookingHours: 2, // 2 hours minimum advance booking
  maxAdvanceBookingDays: 365, // 1 year maximum advance booking
  minStayNights: 1,
  maxStayNights: 30,
  maxGuestsPerUnit: 8, // Resort-wide maximum
  blackoutDates: [],
  restrictedDates: [],
  cancellationDeadlineHours: 24,
  modificationDeadlineHours: 24,
};

export const DEFAULT_PAYMENT_OPTIONS: PaymentValidationOptions = {
  requirePaymentProof: true,
  allowPartialPayments: true,
  maxPartialPaymentPercentage: 50, // 50% max partial payment
  acceptedPaymentMethods: ["GCash", "BankTransfer", "Cash", "Card"],
  minimumPaymentAmount: 500, // PHP 500 minimum
  maximumPaymentAmount: 100000, // PHP 100,000 maximum per transaction
};

// ============================================
// GUEST INFORMATION VALIDATION
// ============================================

/**
 * Validates guest information according to Philippine data privacy laws
 *
 * @param guestData - Guest information to validate
 * @param context - Validation context
 * @returns Validation result with compliance information
 */
export const validateGuestInformation = (
  guestData: Partial<Guest>,
  context: ValidationContext = {}
): ValidationResult<Guest> => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required field validation
  if (!guestData.guest_name || guestData.guest_name.trim().length === 0) {
    errors.push({
      field: "guest_name",
      code: "REQUIRED",
      message: "Guest name is required",
      severity: "error",
    });
  }

  if (!guestData.email || !isValidEmail(guestData.email)) {
    errors.push({
      field: "email",
      code: "INVALID_EMAIL",
      message: "Valid email address is required",
      severity: "error",
    });
  }

  if (!guestData.phone_number || !isValidPhilippinePhoneNumber(guestData.phone_number)) {
    errors.push({
      field: "phone_number",
      code: "INVALID_PHONE",
      message: "Valid Philippine phone number is required",
      severity: "error",
    });
  }

  // Business rule validation
  if (guestData.guest_name && guestData.guest_name.length < 2) {
    errors.push({
      field: "guest_name",
      code: "TOO_SHORT",
      message: "Guest name must be at least 2 characters long",
      severity: "error",
    });
  }

  if (guestData.guest_name && guestData.guest_name.length > 100) {
    errors.push({
      field: "guest_name",
      code: "TOO_LONG",
      message: "Guest name cannot exceed 100 characters",
      severity: "error",
    });
  }

  // Name format validation
  if (guestData.guest_name && !isValidName(guestData.guest_name)) {
    warnings.push({
      field: "guest_name",
      code: "UNUSUAL_NAME_FORMAT",
      message: "Guest name format appears unusual",
      recommendation: "Verify name spelling and format with guest",
    });
  }

  // Email domain validation
  if (guestData.email && !isCommonEmailDomain(guestData.email)) {
    warnings.push({
      field: "email",
      code: "UNCOMMON_EMAIL_DOMAIN",
      message: "Email domain is uncommon",
      recommendation: "Verify email address with guest",
    });
  }

  // Duplicate check
  if (context.existingGuests && guestData.email) {
    const duplicate = context.existingGuests.find(
      (guest) => guest.email.toLowerCase() === guestData.email!.toLowerCase()
    );

    if (duplicate) {
      warnings.push({
        field: "email",
        code: "DUPLICATE_GUEST",
        message: "Guest with this email already exists",
        recommendation: "Consider updating existing guest record instead",
        metadata: { existingGuestId: duplicate.guest_id },
      });
    }
  }

  // Data privacy compliance (Philippine Data Privacy Act)
  const privacyCompliance = validateDataPrivacyCompliance(guestData);
  if (privacyCompliance.violations.length > 0) {
    errors.push(
      ...privacyCompliance.violations.map((violation) => ({
        field: "privacy_compliance",
        code: violation.violationType.toUpperCase(),
        message: violation.description,
        severity: violation.severity === "critical" ? ("critical" as const) : ("error" as const),
        metadata: { regulation: violation.regulation },
      }))
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    data: errors.length === 0 ? sanitizeGuestData(guestData) : undefined,
  };
};

/**
 * Validates Philippine phone number format
 *
 * @param phoneNumber - Phone number to validate
 * @returns True if valid Philippine phone number
 */
export const isValidPhilippinePhoneNumber = (phoneNumber: string): boolean => {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Philippine phone number patterns:
  // Mobile: 09XXXXXXXXX (11 digits)
  // Landline: 02XXXXXXXX or 0XXXXXXXXX (10-11 digits)
  // International: +639XXXXXXXXX or 639XXXXXXXXX
  const patterns = [
    /^09\d{9}$/, // Mobile numbers starting with 09
    /^639\d{9}$/, // International mobile format without +
    /^\+639\d{9}$/, // International mobile format with +
    /^02\d{8}$/, // Metro Manila landline
    /^0\d{9}$/, // Other area codes (10 digits total)
  ];

  return patterns.some((pattern) => pattern.test(cleaned) || pattern.test(phoneNumber));
};

/**
 * Validates email format and domain
 *
 * @param email - Email to validate
 * @returns True if valid email
 */
export const isValidEmail = (email: string): boolean => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email) && email.length <= 254;
};

/**
 * Validates name format
 *
 * @param name - Name to validate
 * @returns True if valid name format
 */
export const isValidName = (name: string): boolean => {
  // Allow letters, spaces, hyphens, apostrophes, and periods
  // Must not start or end with special characters
  const namePattern = /^[A-Za-z]+([A-Za-z\s\-'.]+)*[A-Za-z]+$|^[A-Za-z]+$/;
  return namePattern.test(name.trim());
};

/**
 * Checks if email domain is commonly used
 *
 * @param email - Email to check
 * @returns True if domain is common
 */
export const isCommonEmailDomain = (email: string): boolean => {
  const commonDomains = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "aol.com",
    "icloud.com",
    "protonmail.com",
    // Philippine-specific domains
    "yahoo.com.ph",
    "gmail.ph",
    "up.edu.ph",
    "ateneo.edu",
    "dlsu.edu.ph",
    "ust.edu.ph",
  ];

  const domain = email.split("@")[1]?.toLowerCase();
  return commonDomains.includes(domain);
};

/**
 * Sanitizes guest data by removing potentially harmful content
 * Enhanced with DOMPurify for XSS prevention
 *
 * @param guestData - Guest data to sanitize
 * @returns Sanitized guest data
 */
export const sanitizeGuestData = (guestData: Partial<Guest>): Guest => {
  const sanitized = { ...guestData };

  // Use secure sanitization for text fields
  if (sanitized.guest_name) {
    sanitized.guest_name = sanitizeName(sanitized.guest_name);
  }

  if (sanitized.email) {
    sanitized.email = secureSanitizeEmail(sanitized.email);
  }

  if (sanitized.phone_number) {
    // First sanitize, then normalize format
    const cleaned = sanitizePhoneNumber(sanitized.phone_number);
    sanitized.phone_number = normalizePhilippinePhoneNumber(cleaned);
  }

  // Sanitize any additional text fields
  const textFields = ["notes", "address", "company"] as const;
  textFields.forEach((field) => {
    if (field in sanitized && typeof sanitized[field as keyof Guest] === "string") {
      (sanitized as any)[field] = sanitizeText((sanitized as any)[field]);
    }
  });

  return sanitized as Guest;
};

/**
 * Normalizes Philippine phone number to standard format
 *
 * @param phoneNumber - Phone number to normalize
 * @returns Normalized phone number
 */
export const normalizePhilippinePhoneNumber = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Convert to +639XXXXXXXXX format for mobile numbers
  if (cleaned.startsWith("09") && cleaned.length === 11) {
    return `+63${cleaned.substring(1)}`;
  }

  // Convert international format without +
  if (cleaned.startsWith("639") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  // Return original if already in correct format or unrecognized
  return phoneNumber;
};

// ============================================
// BOOKING CONSTRAINT VALIDATION
// ============================================

/**
 * Validates booking constraints and business rules
 *
 * @param bookingData - Booking data to validate
 * @param context - Validation context
 * @param constraints - Booking constraints configuration
 * @returns Validation result
 */
export const validateBookingConstraints = (
  bookingData: BookingFormData,
  context: ValidationContext = {},
  constraints: BookingConstraints = DEFAULT_BOOKING_CONSTRAINTS
): ValidationResult<BookingFormData> => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const checkIn = new Date(bookingData.check_in);
  const checkOut = new Date(bookingData.check_out);
  const now = getPhilippineTime();

  // Date range validation
  const bookingPeriod = analyzeBookingPeriod(checkIn, checkOut);
  if (!bookingPeriod.isValidPeriod) {
    bookingPeriod.conflicts.forEach((error) => {
      errors.push({
        field: "date_range",
        code: "INVALID_DATE_RANGE",
        message: error,
        severity: "error",
      });
    });
  }

  // Advance booking validation
  const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilCheckIn < constraints.minAdvanceBookingHours) {
    errors.push({
      field: "check_in",
      code: "INSUFFICIENT_ADVANCE_BOOKING",
      message: `Bookings must be made at least ${constraints.minAdvanceBookingHours} hours in advance`,
      severity: "error",
      metadata: { hoursUntilCheckIn, minimumRequired: constraints.minAdvanceBookingHours },
    });
  }

  const daysUntilCheckIn = hoursUntilCheckIn / 24;
  if (daysUntilCheckIn > constraints.maxAdvanceBookingDays) {
    errors.push({
      field: "check_in",
      code: "EXCESSIVE_ADVANCE_BOOKING",
      message: `Bookings cannot be made more than ${constraints.maxAdvanceBookingDays} days in advance`,
      severity: "error",
      metadata: { daysUntilCheckIn, maximumAllowed: constraints.maxAdvanceBookingDays },
    });
  }

  // Stay duration validation (reuse previous calculation)

  if (bookingPeriod.totalNights < constraints.minStayNights) {
    errors.push({
      field: "stay_duration",
      code: "MINIMUM_STAY_NOT_MET",
      message: `Minimum stay is ${constraints.minStayNights} ${constraints.minStayNights === 1 ? "night" : "nights"}`,
      severity: "error",
      metadata: {
        actualNights: bookingPeriod.totalNights,
        minimumRequired: constraints.minStayNights,
      },
    });
  }

  if (bookingPeriod.totalNights > constraints.maxStayNights) {
    errors.push({
      field: "stay_duration",
      code: "MAXIMUM_STAY_EXCEEDED",
      message: `Maximum stay is ${constraints.maxStayNights} nights`,
      severity: "error",
      metadata: {
        actualNights: bookingPeriod.totalNights,
        maximumAllowed: constraints.maxStayNights,
      },
    });
  }

  // Guest count validation
  if (bookingData.num_guests < 1) {
    errors.push({
      field: "num_guests",
      code: "MINIMUM_GUESTS_NOT_MET",
      message: "At least 1 guest is required",
      severity: "error",
    });
  }

  if (bookingData.num_guests > constraints.maxGuestsPerUnit) {
    errors.push({
      field: "num_guests",
      code: "MAXIMUM_GUESTS_EXCEEDED",
      message: `Maximum ${constraints.maxGuestsPerUnit} guests allowed per unit`,
      severity: "error",
      metadata: {
        actualGuests: bookingData.num_guests,
        maximumAllowed: constraints.maxGuestsPerUnit,
      },
    });
  }

  // Unit-specific validation
  if (context.units && bookingData.unit_id) {
    const unit = context.units.find((u) => u.unit_id === bookingData.unit_id);
    if (unit) {
      if (bookingData.num_guests > unit.max_occupancy) {
        errors.push({
          field: "num_guests",
          code: "UNIT_CAPACITY_EXCEEDED",
          message: `This unit can accommodate maximum ${unit.max_occupancy} guests`,
          severity: "error",
          metadata: {
            unitCapacity: unit.max_occupancy,
            requestedGuests: bookingData.num_guests,
            unitName: unit.unit_name,
          },
        });
      }

      // Warning for near-capacity bookings
      if (bookingData.num_guests === unit.max_occupancy) {
        warnings.push({
          field: "num_guests",
          code: "AT_UNIT_CAPACITY",
          message: "Booking is at maximum unit capacity",
          recommendation: "Ensure all guests are comfortable with the accommodation size",
        });
      }

      // Unit availability check would go here
      // This would integrate with the availability utilities
    }
  }

  // Blackout date validation
  if (constraints.blackoutDates.length > 0) {
    const hasBlackoutConflict = constraints.blackoutDates.some((blackoutDate) => {
      return checkIn <= blackoutDate && checkOut > blackoutDate;
    });

    if (hasBlackoutConflict) {
      errors.push({
        field: "date_range",
        code: "BLACKOUT_DATE_CONFLICT",
        message: "Selected dates conflict with blackout periods",
        severity: "error",
      });
    }
  }

  // Special requests validation
  if (bookingData.special_requests && bookingData.special_requests.length > 500) {
    warnings.push({
      field: "special_requests",
      code: "LONG_SPECIAL_REQUESTS",
      message: "Special requests are quite lengthy",
      recommendation: "Consider breaking down into specific requirements",
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    data: errors.length === 0 ? bookingData : undefined,
  };
};

// ============================================
// PAYMENT VALIDATION
// ============================================

/**
 * Validates payment information and compliance
 *
 * @param paymentAmount - Payment amount
 * @param paymentMethod - Payment method
 * @param paymentStatus - Payment status
 * @param options - Payment validation options
 * @returns Validation result
 */
export const validatePayment = (
  paymentAmount: number,
  paymentMethod: string,
  _paymentStatus: PaymentStatus,
  options: PaymentValidationOptions = DEFAULT_PAYMENT_OPTIONS
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Amount validation
  if (paymentAmount <= 0) {
    errors.push({
      field: "payment_amount",
      code: "INVALID_AMOUNT",
      message: "Payment amount must be greater than zero",
      severity: "error",
    });
  }

  if (paymentAmount < options.minimumPaymentAmount) {
    errors.push({
      field: "payment_amount",
      code: "BELOW_MINIMUM",
      message: `Minimum payment amount is ₱${options.minimumPaymentAmount.toLocaleString()}`,
      severity: "error",
      metadata: { minimumAmount: options.minimumPaymentAmount },
    });
  }

  if (paymentAmount > options.maximumPaymentAmount) {
    errors.push({
      field: "payment_amount",
      code: "EXCEEDS_MAXIMUM",
      message: `Maximum payment amount is ₱${options.maximumPaymentAmount.toLocaleString()}`,
      severity: "error",
      metadata: { maximumAmount: options.maximumPaymentAmount },
    });
  }

  // Payment method validation
  if (!options.acceptedPaymentMethods.includes(paymentMethod)) {
    errors.push({
      field: "payment_method",
      code: "UNSUPPORTED_METHOD",
      message: `Payment method '${paymentMethod}' is not accepted`,
      severity: "error",
      metadata: { acceptedMethods: options.acceptedPaymentMethods },
    });
  }

  // High-value transaction warnings
  if (paymentAmount > 50000) {
    // PHP 50,000
    warnings.push({
      field: "payment_amount",
      code: "HIGH_VALUE_TRANSACTION",
      message: "High-value transaction requires additional verification",
      recommendation: "Verify payment source and guest identity",
      metadata: { requiresEnhancedVerification: true },
    });
  }

  // Cash payment warnings
  if (paymentMethod === "Cash" && paymentAmount > 20000) {
    // PHP 20,000
    warnings.push({
      field: "payment_method",
      code: "LARGE_CASH_PAYMENT",
      message: "Large cash payments require special handling",
      recommendation: "Follow cash handling procedures and issue proper receipts",
      metadata: { requiresCashHandlingProcedure: true },
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

// ============================================
// PHILIPPINE COMPLIANCE VALIDATION
// ============================================

/**
 * Validates compliance with Philippine Data Privacy Act
 *
 * @param guestData - Guest data to validate
 * @returns Compliance validation result
 */
export const validateDataPrivacyCompliance = (
  guestData: Partial<Guest>
): PhilippineComplianceResult => {
  const violations: ComplianceViolation[] = [];
  const recommendations: string[] = [];
  const requiredActions: ComplianceAction[] = [];

  // Check for excessive data collection
  const sensitiveFields = ["phone_number", "email"];
  const collectedSensitiveData = sensitiveFields.filter((field) => guestData[field as keyof Guest]);

  if (collectedSensitiveData.length > 0) {
    recommendations.push("Ensure guest consent is obtained for personal data collection");
    recommendations.push("Implement data retention policies in compliance with DPA");

    requiredActions.push({
      actionType: "immediate",
      description: "Display privacy notice and obtain guest consent",
      responsible: "Front desk staff",
      priority: "high",
    });
  }

  // Check for data minimization compliance
  const unnecessaryFields = ["total_spent", "total_bookings"]; // These might be calculated fields
  const hasUnnecessaryData = unnecessaryFields.some(
    (field) => guestData[field as keyof Guest] !== undefined
  );

  if (hasUnnecessaryData) {
    recommendations.push("Review data collection practices for necessity and proportionality");
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    recommendations,
    requiredActions,
  };
};

/**
 * Validates business registration compliance
 *
 * @param bookingAmount - Total booking amount
 * @param guestType - Type of guest (individual/corporate)
 * @returns Compliance result
 */
export const validateBusinessRegistrationCompliance = (
  bookingAmount: number,
  guestType: "individual" | "corporate" | "group"
): PhilippineComplianceResult => {
  const violations: ComplianceViolation[] = [];
  const recommendations: string[] = [];
  const requiredActions: ComplianceAction[] = [];

  // BIR registration requirements
  if (bookingAmount > 100000) {
    // PHP 100,000
    requiredActions.push({
      actionType: "immediate",
      description: "Issue proper receipts/invoices with BIR permit",
      responsible: "Accounting staff",
      priority: "critical",
    });
  }

  // Corporate client requirements
  if (guestType === "corporate") {
    recommendations.push("Request TIN and business registration documents");
    recommendations.push("Issue proper business-to-business invoices");

    requiredActions.push({
      actionType: "immediate",
      description: "Verify corporate client credentials",
      responsible: "Sales team",
      priority: "medium",
    });
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    recommendations,
    requiredActions,
  };
};

/**
 * Comprehensive validation for complete booking workflow
 *
 * @param bookingData - Complete booking data
 * @param context - Validation context
 * @returns Comprehensive validation result
 */
export const validateCompleteBooking = (
  bookingData: BookingFormData & { total_amount: number },
  context: ValidationContext = {}
): ValidationResult<BookingFormData & { total_amount: number }> => {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];

  // Guest information validation
  const guestValidation = validateGuestInformation(
    {
      guest_name: bookingData.guest_name,
      email: bookingData.email,
      phone_number: bookingData.contact_number,
    },
    context
  );

  allErrors.push(...guestValidation.errors);
  allWarnings.push(...guestValidation.warnings);

  // Booking constraints validation
  const constraintValidation = validateBookingConstraints(bookingData, context);
  allErrors.push(...constraintValidation.errors);
  allWarnings.push(...constraintValidation.warnings);

  // Payment validation
  if (bookingData.payment_method) {
    const paymentValidation = validatePayment(
      bookingData.total_amount,
      bookingData.payment_method,
      "Pending" // Default for new bookings
    );
    allErrors.push(...paymentValidation.errors);
    allWarnings.push(...paymentValidation.warnings);
  }

  // Business compliance validation
  const complianceResult = validateBusinessRegistrationCompliance(
    bookingData.total_amount,
    "individual" // Default guest type
  );

  // Convert compliance violations to validation errors
  complianceResult.violations.forEach((violation) => {
    allErrors.push({
      field: "compliance",
      code: violation.violationType.toUpperCase(),
      message: violation.description,
      severity: violation.severity === "critical" ? "critical" : "error",
      metadata: { regulation: violation.regulation },
    });
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    data: allErrors.length === 0 ? bookingData : undefined,
  };
};
