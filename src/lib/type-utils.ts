import { z } from "zod";
import type {
  User,
  Project,
  Property,
  Booking,
  Expense,
  Guest,
  BookingStatus,
  PropertyStatus,
  ExpenseStatus,
  UserRole,
  ProjectRole,
  PaginatedResponse,
} from "@/types/common";

/**
 * Enhanced Type Guards and Utilities for Route Parameter Types
 * Provides runtime type checking and validation functions
 */

/**
 * Type guard to check if a value is a valid UUID
 */
export function isUUID(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard to check if a value is a valid email
 */
export function isEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Type guard to check if a value is a valid URL
 */
export function isURL(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if a value is a valid ISO datetime string
 */
export function isISODateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.toISOString() === value;
}

/**
 * Type guard to check if an object is a User
 */
export function isUser(obj: unknown): obj is User {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "email" in obj &&
    "name" in obj &&
    "role" in obj &&
    isUUID((obj as User).id) &&
    isEmail((obj as User).email) &&
    typeof (obj as User).name === "string" &&
    Object.values(UserRole).includes((obj as User).role)
  );
}

/**
 * Type guard to check if an object is a Project
 */
export function isProject(obj: unknown): obj is Project {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "name" in obj &&
    "slug" in obj &&
    "type" in obj &&
    "status" in obj &&
    "ownerId" in obj &&
    isUUID((obj as Project).id) &&
    typeof (obj as Project).name === "string" &&
    typeof (obj as Project).slug === "string" &&
    isUUID((obj as Project).ownerId)
  );
}

/**
 * Type guard to check if an object is a Property
 */
export function isProperty(obj: unknown): obj is Property {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "projectId" in obj &&
    "name" in obj &&
    "type" in obj &&
    "status" in obj &&
    "capacity" in obj &&
    isUUID((obj as Property).id) &&
    isUUID((obj as Property).projectId) &&
    typeof (obj as Property).name === "string" &&
    typeof (obj as Property).capacity === "number"
  );
}

/**
 * Type guard to check if an object is a Booking
 */
export function isBooking(obj: unknown): obj is Booking {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "projectId" in obj &&
    "propertyId" in obj &&
    "guestName" in obj &&
    "checkIn" in obj &&
    "checkOut" in obj &&
    "nights" in obj &&
    "guests" in obj &&
    "status" in obj &&
    "totalAmount" in obj &&
    isUUID((obj as Booking).id) &&
    isUUID((obj as Booking).projectId) &&
    isUUID((obj as Booking).propertyId) &&
    typeof (obj as Booking).guestName === "string" &&
    isISODateTime((obj as Booking).checkIn) &&
    isISODateTime((obj as Booking).checkOut) &&
    typeof (obj as Booking).nights === "number" &&
    typeof (obj as Booking).guests === "number" &&
    Object.values(BookingStatus).includes((obj as Booking).status) &&
    typeof (obj as Booking).totalAmount === "number"
  );
}

/**
 * Type guard to check if an object is an Expense
 */
export function isExpense(obj: unknown): obj is Expense {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "projectId" in obj &&
    "category" in obj &&
    "amount" in obj &&
    "description" in obj &&
    "date" in obj &&
    "status" in obj &&
    isUUID((obj as Expense).id) &&
    isUUID((obj as Expense).projectId) &&
    typeof (obj as Expense).amount === "number" &&
    typeof (obj as Expense).description === "string" &&
    isISODateTime((obj as Expense).date) &&
    Object.values(ExpenseStatus).includes((obj as Expense).status)
  );
}

/**
 * Type guard to check if an object is a Guest
 */
export function isGuest(obj: unknown): obj is Guest {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "projectId" in obj &&
    "name" in obj &&
    isUUID((obj as Guest).id) &&
    isUUID((obj as Guest).projectId) &&
    typeof (obj as Guest).name === "string"
  );
}

/**
 * Type guard to check if an object is a PaginatedResponse
 */
export function isPaginatedResponse<T>(
  obj: unknown,
  itemGuard: (item: unknown) => item is T
): obj is PaginatedResponse<T> {
  if (typeof obj !== "object" || obj === null) return false;

  const response = obj as PaginatedResponse<T>;

  return (
    Array.isArray(response.data) &&
    response.data.every(itemGuard) &&
    typeof response.meta === "object" &&
    response.meta !== null &&
    "total" in response.meta &&
    "page" in response.meta &&
    "limit" in response.meta &&
    "totalPages" in response.meta &&
    "hasNext" in response.meta &&
    "hasPrev" in response.meta &&
    typeof response.meta.total === "number" &&
    typeof response.meta.page === "number" &&
    typeof response.meta.limit === "number" &&
    typeof response.meta.totalPages === "number" &&
    typeof response.meta.hasNext === "boolean" &&
    typeof response.meta.hasPrev === "boolean"
  );
}

/**
 * Generic type assertion function with custom error messages
 */
export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  errorMessage?: string
): asserts value is T {
  if (!guard(value)) {
    throw new Error(errorMessage || `Type assertion failed`);
  }
}

/**
 * Safe type casting with fallback
 */
export function safeCast<T>(value: unknown, guard: (value: unknown) => value is T, fallback: T): T {
  return guard(value) ? value : fallback;
}

/**
 * Array type guard helper
 */
export function isArrayOf<T>(
  array: unknown,
  itemGuard: (item: unknown) => item is T
): array is T[] {
  return Array.isArray(array) && array.every(itemGuard);
}

/**
 * Partial type guard for objects that may have optional properties
 */
export function isPartialType<T extends Record<string, any>>(
  obj: unknown,
  requiredFields: (keyof T)[],
  fieldValidators: Partial<Record<keyof T, (value: unknown) => boolean>>
): obj is Partial<T> {
  if (typeof obj !== "object" || obj === null) return false;

  const typedObj = obj as Partial<T>;

  // Check required fields exist and are valid
  for (const field of requiredFields) {
    if (!(field in typedObj)) return false;
    const validator = fieldValidators[field];
    if (validator && !validator(typedObj[field])) return false;
  }

  // Check optional fields are valid if they exist
  for (const [field, validator] of Object.entries(fieldValidators)) {
    const key = field as keyof T;
    if (key in typedObj && typedObj[key] !== undefined && !validator(typedObj[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Route parameter validation helper with specific error types
 */
export class RouteValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly expectedType: string
  ) {
    super(`Invalid route parameter '${field}': expected ${expectedType}, got ${typeof value}`);
    this.name = "RouteValidationError";
  }
}

/**
 * Enhanced validation with detailed error reporting
 */
export function validateRouteParam<T>(
  value: unknown,
  validator: (value: unknown) => value is T,
  fieldName: string,
  expectedType: string
): T {
  if (!validator(value)) {
    throw new RouteValidationError(fieldName, value, expectedType);
  }
  return value;
}

/**
 * Utility to create type-safe enum validators
 */
export function createEnumValidator<T extends Record<string, string | number>>(enumObject: T) {
  const values = Object.values(enumObject) as Array<T[keyof T]>;

  return (value: unknown): value is T[keyof T] => {
    return values.includes(value as T[keyof T]);
  };
}

/**
 * Utility to create array of enum validators
 */
export function createEnumArrayValidator<T extends Record<string, string | number>>(enumObject: T) {
  const enumValidator = createEnumValidator(enumObject);

  return (value: unknown): value is Array<T[keyof T]> => {
    return Array.isArray(value) && value.every(enumValidator);
  };
}

/**
 * Schema-based validation with enhanced error handling
 */
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      throw new Error(`${context ? `${context}: ` : ""}Schema validation failed: ${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Safe schema validation that returns a result object
 */
export function safeValidateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      return { success: false, error: errorMessages };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Runtime type checking for development
 */
export function devAssert<T>(condition: T, message?: string): asserts condition {
  if (process.env.NODE_ENV === "development" && !condition) {
    throw new Error(message || "Development assertion failed");
  }
}

/**
 * Utility to check if a string is a valid sort order
 */
export const isSortOrder = createEnumValidator({ asc: "asc", desc: "desc" });

/**
 * Utility to check if a string is a valid date range
 */
export const isDateRange = createEnumValidator({
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  "1y": "1y",
  custom: "custom",
});

/**
 * Utility to check if a value is a valid positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * Utility to check if a value is a valid non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value) && value >= 0;
}

/**
 * Type-safe object property access
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  fallback: T[K]
): T[K] {
  return obj?.[key] ?? fallback;
}

/**
 * Deep equality check for objects (useful for React dependencies)
 */
export function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;

  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;

  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}
