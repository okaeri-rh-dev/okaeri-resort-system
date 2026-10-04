/**
 * Comprehensive Type Guard Library
 *
 * This module provides reusable type guards for safely narrowing `unknown` types
 * throughout the application. All type guards follow the pattern:
 *
 * function isType(value: unknown): value is Type
 *
 * @module type-guards
 */

// =============================================================================
// BASIC TYPE GUARDS
// =============================================================================

/**
 * Check if value is a non-null object (excludes arrays)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Check if value is a number (and not NaN)
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Check if value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

// =============================================================================
// PROPERTY CHECKING TYPE GUARDS
// =============================================================================

/**
 * Check if object has a specific property
 */
export function hasProperty<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return isObject(value) && key in value;
}

/**
 * Check if object has all specified properties
 */
export function hasProperties<K extends string>(
  value: unknown,
  keys: K[]
): value is Record<K, unknown> {
  if (!isObject(value)) return false;
  return keys.every((key) => key in value);
}

/**
 * Check if object has a property with a specific type
 */
export function hasStringProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, string> {
  return hasProperty(value, key) && isString((value as Record<K, unknown>)[key]);
}

export function hasNumberProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, number> {
  return hasProperty(value, key) && isNumber((value as Record<K, unknown>)[key]);
}

export function hasBooleanProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, boolean> {
  return hasProperty(value, key) && isBoolean((value as Record<K, unknown>)[key]);
}

// =============================================================================
// ERROR TYPE GUARDS
// =============================================================================

/**
 * Check if value is an Error object
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Check if value has error-like properties
 */
export function isErrorLike(value: unknown): value is { message: string; name?: string } {
  return hasStringProperty(value, "message");
}

/**
 * Check if value is a Zod error
 */
export function isZodError(
  value: unknown
): value is { issues: Array<{ message: string; path: (string | number)[] }> } {
  return hasProperty(value, "issues") && isArray((value as { issues: unknown }).issues);
}

// =============================================================================
// API RESPONSE TYPE GUARDS
// =============================================================================

/**
 * Check if value is a successful API response
 */
export function isApiResponse<T = unknown>(value: unknown): value is { data: T; error: null } {
  return hasProperty(value, "data") && hasProperty(value, "error");
}

/**
 * Check if value is an error API response
 */
export function isApiError(value: unknown): value is { data: null; error: { message: string } } {
  return (
    hasProperty(value, "error") &&
    isObject((value as { error: unknown }).error) &&
    hasStringProperty((value as { error: unknown }).error, "message")
  );
}

// =============================================================================
// PERFORMANCE API TYPE GUARDS
// =============================================================================

/**
 * Check if value is a PerformanceNavigationTiming entry
 */
export function isNavigationTiming(value: unknown): value is PerformanceNavigationTiming {
  return (
    hasProperty(value, "duration") &&
    hasProperty(value, "loadEventEnd") &&
    hasProperty(value, "domContentLoadedEventEnd") &&
    hasProperty(value, "responseStart")
  );
}

/**
 * Check if value is a PerformanceResourceTiming entry
 */
export function isResourceTiming(value: unknown): value is PerformanceResourceTiming {
  return (
    hasProperty(value, "duration") &&
    hasProperty(value, "name") &&
    hasProperty(value, "transferSize")
  );
}

/**
 * Check if value is a PerformancePaintTiming entry
 */
export function isPaintTiming(value: unknown): value is PerformancePaintTiming {
  return (
    hasProperty(value, "name") &&
    hasProperty(value, "startTime") &&
    isString((value as { name: unknown }).name) &&
    ["first-paint", "first-contentful-paint"].includes((value as { name: string }).name)
  );
}

/**
 * Check if value is a Layout Shift entry
 */
export interface LayoutShift {
  value: number;
  hadRecentInput?: boolean;
  sources?: Array<{ node?: Node }>;
}

export function isLayoutShift(value: unknown): value is LayoutShift {
  return hasNumberProperty(value, "value") && (value as { value: number }).value >= 0;
}

/**
 * Check if value is a First Input Delay entry
 */
export interface FirstInputDelay {
  processingStart: number;
  startTime: number;
  duration: number;
}

export function isFirstInputDelay(value: unknown): value is FirstInputDelay {
  return (
    hasNumberProperty(value, "processingStart") &&
    hasNumberProperty(value, "startTime") &&
    hasNumberProperty(value, "duration")
  );
}

// =============================================================================
// DOM EVENT TYPE GUARDS
// =============================================================================

/**
 * Check if value is a DOM Event
 */
export function isDOMEvent(value: unknown): value is Event {
  return value instanceof Event;
}

/**
 * Check if value is a KeyboardEvent
 */
export function isKeyboardEvent(value: unknown): value is KeyboardEvent {
  return value instanceof KeyboardEvent;
}

/**
 * Check if value is a MouseEvent
 */
export function isMouseEvent(value: unknown): value is MouseEvent {
  return value instanceof MouseEvent;
}

// =============================================================================
// FILE/BLOB TYPE GUARDS
// =============================================================================

/**
 * Check if value is a File object
 */
export function isFile(value: unknown): value is File {
  return value instanceof File;
}

/**
 * Check if value is a Blob object
 */
export function isBlob(value: unknown): value is Blob {
  return value instanceof Blob;
}

// =============================================================================
// REACT TYPE GUARDS
// =============================================================================

/**
 * Check if value is a valid React element
 */
export function isReactElement(value: unknown): value is React.ReactElement {
  return (
    isObject(value) &&
    hasProperty(value, "$$typeof") &&
    (value as { $$typeof: unknown }).$$typeof === Symbol.for("react.element")
  );
}

// =============================================================================
// UNION TYPE GUARDS
// =============================================================================

/**
 * Create a type guard for string literal unions
 *
 * @example
 * const isStatus = isStringUnion(['pending', 'completed', 'failed']);
 * if (isStatus(value)) {
 *   // value is 'pending' | 'completed' | 'failed'
 * }
 */
export function isStringUnion<T extends string>(
  validValues: readonly T[]
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return isString(value) && (validValues as readonly string[]).includes(value);
  };
}

/**
 * Create a type guard for number literal unions
 */
export function isNumberUnion<T extends number>(
  validValues: readonly T[]
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return isNumber(value) && (validValues as readonly number[]).includes(value);
  };
}

// =============================================================================
// APPLICATION-SPECIFIC TYPE GUARDS
// =============================================================================

/**
 * Check if value is a BlackoutType
 */
export type BlackoutType = "maintenance" | "holiday" | "custom";
export const isBlackoutType = isStringUnion<BlackoutType>(["maintenance", "holiday", "custom"]);

/**
 * Check if value is a PaymentStatus
 */
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export const isPaymentStatus = isStringUnion<PaymentStatus>([
  "pending",
  "completed",
  "failed",
  "refunded",
]);

/**
 * Check if value is an ExpenseCategory
 */
export type ExpenseCategory =
  | "maintenance"
  | "utilities"
  | "supplies"
  | "marketing"
  | "insurance"
  | "taxes"
  | "salaries"
  | "other";
export const isExpenseCategory = isStringUnion<ExpenseCategory>([
  "maintenance",
  "utilities",
  "supplies",
  "marketing",
  "insurance",
  "taxes",
  "salaries",
  "other",
]);

// =============================================================================
// UTILITY TYPE GUARDS
// =============================================================================

/**
 * Safely parse JSON with type guard
 */
export function parseJSON<T>(json: string, guard: (value: unknown) => value is T): T | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Narrow unknown to non-nullable type
 */
export function isNonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if value is an array of specific type
 */
export function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return isArray(value) && value.every(guard);
}
