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

// =============================================================================
// PROPERTY CHECKING TYPE GUARDS
// =============================================================================

/**
 * Check if object has a specific property
 */
export function hasProperty<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return isObject(value) && key in value;
}
