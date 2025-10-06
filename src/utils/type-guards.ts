// Type guard utilities for runtime type validation
// Provides type-safe alternatives to 'as any' casts

import type { UnitType, UnitStatus, BookingStatus, PaymentStatus, PaymentMethod } from "@/types";

// ============================================
// ENUM TYPE GUARDS
// ============================================

/**
 * Type guard to check if a string is a valid UnitType
 */
export function isUnitType(value: string): value is UnitType {
  return ["Standard", "Deluxe", "Suite", "Villa"].includes(value);
}

/**
 * Type guard to check if a string is a valid UnitStatus
 */
export function isUnitStatus(value: string): value is UnitStatus {
  return ["Available", "Occupied", "Maintenance", "Reserved"].includes(value);
}

/**
 * Type guard to check if a string is a valid BookingStatus
 */
export function isBookingStatus(value: string): value is BookingStatus {
  return ["Pending", "Confirmed", "CheckedIn", "CheckedOut", "Cancelled"].includes(value);
}

/**
 * Type guard to check if a string is a valid PaymentStatus
 */
export function isPaymentStatus(value: string): value is PaymentStatus {
  return ["Pending", "Partial", "Completed", "Refunded"].includes(value);
}

/**
 * Type guard to check if a string is a valid PaymentMethod
 */
export function isPaymentMethod(value: string): value is PaymentMethod {
  return ["Cash", "GCash", "BankTransfer", "Card", "Other"].includes(value);
}

// ============================================
// NULL SAFETY GUARDS
// ============================================

/**
 * Asserts that a value is not null or undefined
 * @throws Error if value is null or undefined
 */
export function assertNonNull<T>(value: T | null | undefined, fieldName?: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected non-null value${fieldName ? ` for ${fieldName}` : ""}`);
  }
  return value;
}

/**
 * Provides a default value if the input is null or undefined
 */
export function withDefault<T>(value: T | null | undefined, defaultValue: T): T {
  return value ?? defaultValue;
}

/**
 * Type guard to check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// ============================================
// ERROR TYPE GUARDS
// ============================================

/**
 * Type guard to check if an error is a standard Error object
 */
export function isError(value: unknown): value is Error {
  return (
    value instanceof Error || (typeof value === "object" && value !== null && "message" in value)
  );
}

/**
 * Safely extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

// ============================================
// OBJECT TYPE GUARDS
// ============================================

/**
 * Type guard to check if a value is a plain object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if an object has a specific property
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

// ============================================
// DATABASE TYPE CONVERTERS
// ============================================

/**
 * Safely converts a database string to UnitType with fallback
 */
export function toUnitType(
  value: string | null | undefined,
  fallback: UnitType = "Standard"
): UnitType {
  if (!value) return fallback;
  return isUnitType(value) ? value : fallback;
}

/**
 * Safely converts a database string to UnitStatus with fallback
 */
export function toUnitStatus(
  value: string | null | undefined,
  fallback: UnitStatus = "Available"
): UnitStatus {
  if (!value) return fallback;
  return isUnitStatus(value) ? value : fallback;
}

/**
 * Safely converts a database string to BookingStatus with fallback
 */
export function toBookingStatus(
  value: string | null | undefined,
  fallback: BookingStatus = "Pending"
): BookingStatus {
  if (!value) return fallback;
  return isBookingStatus(value) ? value : fallback;
}

/**
 * Safely converts a database string to PaymentStatus with fallback
 */
export function toPaymentStatus(
  value: string | null | undefined,
  fallback: PaymentStatus = "Pending"
): PaymentStatus {
  if (!value) return fallback;
  return isPaymentStatus(value) ? value : fallback;
}

/**
 * Safely converts a database string to PaymentMethod with fallback
 */
export function toPaymentMethod(
  value: string | null | undefined,
  fallback: PaymentMethod = "Cash"
): PaymentMethod {
  if (!value) return fallback;
  return isPaymentMethod(value) ? value : fallback;
}
