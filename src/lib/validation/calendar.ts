/**
 * Calendar Date Validation Utilities
 *
 * Frontend validation for public availability calendar to ensure
 * guests can only query valid date ranges (not past, max 1 year ahead).
 *
 * This provides immediate user feedback before hitting the API,
 * though the API also validates (defense in depth).
 *
 * @module lib/validation/calendar
 */

import { isBefore } from "date-fns";
import {
  getTodayPhilippineTime,
  isPastDate,
  isTooFarInFuture,
  toPhilippineTime,
} from "@/lib/timezone";

/**
 * Result of date validation with error message if invalid
 */
export interface DateValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a date for calendar queries
 *
 * Rules:
 * - Cannot be in the past (based on Philippine Time)
 * - Cannot be more than 1 year in the future
 *
 * @param date - Date to validate
 * @returns Validation result with error message if invalid
 *
 * @example
 * const result = validateCalendarDate(new Date(2024, 11, 31));
 * if (!result.valid) {
 *   console.error(result.error); // "Cannot query past dates..."
 * }
 */
export function validateCalendarDate(date: Date): DateValidationResult {
  if (isPastDate(date)) {
    return {
      valid: false,
      error: "Cannot query past dates. Please select a date from today onwards.",
    };
  }

  if (isTooFarInFuture(date)) {
    return {
      valid: false,
      error: "Cannot query more than 1 year in the future.",
    };
  }

  return { valid: true };
}

/**
 * Validate a month for calendar navigation
 *
 * Checks if the month is valid for querying.
 * Allows current month and future months, blocks past months and
 * months more than 1 year in the future.
 *
 * Important: This compares month boundaries (year + month number),
 * not individual days, so the current month is always valid even if
 * some days have passed.
 *
 * @param month - Date representing any day in the target month
 * @returns Validation result with error message if invalid
 *
 * @example
 * // Today is October 14, 2025
 * validateMonth(new Date(2025, 9, 1));  // October 2025 → valid (current month)
 * validateMonth(new Date(2025, 8, 1));  // September 2025 → invalid (past month)
 * validateMonth(new Date(2025, 10, 1)); // November 2025 → valid (future month)
 */
export function validateMonth(month: Date): DateValidationResult {
  const today = getTodayPhilippineTime();
  const targetMonth = toPhilippineTime(month);

  // Get year and month numbers for comparison
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth();
  const targetYear = targetMonth.getFullYear();
  const targetMonthNum = targetMonth.getMonth();

  // Block past months (compare year and month only, not day)
  // Create Date objects for the first day of each month for comparison
  const currentMonthStart = new Date(currentYear, currentMonthNum, 1);
  const targetMonthStart = new Date(targetYear, targetMonthNum, 1);

  if (isBefore(targetMonthStart, currentMonthStart)) {
    return {
      valid: false,
      error: "Cannot query past months. Please select the current month or a future month.",
    };
  }

  // Check if more than 1 year in the future
  // Use the first day of the target month for this check (more user-friendly)
  // This allows any month that STARTS within 1 year, even if it ends slightly after
  const firstDayOfMonth = new Date(targetYear, targetMonthNum, 1);
  if (isTooFarInFuture(firstDayOfMonth)) {
    return {
      valid: false,
      error: "Cannot query more than 1 year in the future.",
    };
  }

  return { valid: true };
}
