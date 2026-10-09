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
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
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
 * Check if object has a property with a specific type
 */
export function hasStringProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, string> {
  return hasProperty(value, key) && isString(value[key]);
}

export function hasBooleanProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, boolean> {
  return hasProperty(value, key) && isBoolean(value[key]);
}
