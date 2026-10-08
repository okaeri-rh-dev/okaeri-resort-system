/**
 * Timezone Utilities for Public Availability Calendar
 *
 * All dates are normalized to Philippine Time (Asia/Manila, UTC+8).
 * This ensures consistent date handling regardless of user's browser timezone.
 *
 * Key Functions:
 * - toPhilippineTime: Convert any Date to Philippine timezone
 * - formatPhilippineDate: Format date in Philippine timezone
 * - toISODateString: Convert to YYYY-MM-DD format for API calls
 * - toManilaDateString / toUTCDateString: YYYY-MM-DD of an instant in Manila / UTC
 * - getTodayPhilippineTime: Get today's date in Philippine timezone
 * - isPastDate: Check if a date is in the past (Philippine time)
 * - isTooFarInFuture: Check if a date exceeds 1 year limit
 * - getMonthStart/getMonthEnd: Get month boundaries in Philippine time
 *
 * @module lib/timezone
 */

import { addYears, endOfMonth, format, isBefore, startOfDay, startOfMonth } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

/**
 * Philippine timezone constant
 * Asia/Manila is UTC+8 (no DST)
 */
export const TIMEZONE = "Asia/Manila";

/**
 * Convert user's local Date to Philippine Time
 * Used for displaying dates in the calendar
 *
 * @param date - Date object in any timezone
 * @returns Date object normalized to Philippine Time
 *
 * @example
 * const userDate = new Date(); // User's local time
 * const phDate = toPhilippineTime(userDate); // Converted to PH time
 */
export function toPhilippineTime(date: Date): Date {
  return toZonedTime(date, TIMEZONE);
}

/**
 * Format date for display in Philippine Time
 *
 * @param date - Date object to format
 * @param formatStr - date-fns format string (default: 'PPP' = 'January 1, 2025')
 * @returns Formatted date string in Philippine Time
 *
 * @example
 * formatPhilippineDate(new Date(), 'PPP') // 'January 1, 2025'
 * formatPhilippineDate(new Date(), 'yyyy-MM-dd') // '2025-01-01'
 */
export function formatPhilippineDate(date: Date, formatStr: string = "PPP"): string {
  const zonedDate = toPhilippineTime(date);
  return format(zonedDate, formatStr);
}

/**
 * Convert Philippine Time to ISO date string for API calls
 * Normalizes to YYYY-MM-DD format (timezone-neutral)
 *
 * This is used for API query parameters where we want
 * a simple date string without timezone information.
 *
 * @param date - Date object to convert
 * @returns ISO date string in YYYY-MM-DD format
 *
 * @example
 * toISODateString(new Date(2025, 0, 1)) // '2025-01-01'
 */
export function toISODateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Calendar day of an instant in Manila, regardless of the runtime's timezone
 * (Workers run in UTC). Use for "today" and for timestamps.
 */
export function toManilaDateString(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
}

/**
 * Calendar day of an instant in UTC. Only for keys that must follow a UTC
 * day, such as Cloudflare free-tier quotas, which reset at 00:00 UTC.
 */
export function toUTCDateString(date: Date): string {
  return formatInTimeZone(date, "UTC", "yyyy-MM-dd");
}

/**
 * Get today's date in Philippine Time (normalized to midnight)
 * Used as reference point for date validation
 *
 * @returns Date object for today at 00:00:00 Philippine Time
 *
 * @example
 * const today = getTodayPhilippineTime();
 * // Returns Date normalized to start of day in Philippine Time
 */
export function getTodayPhilippineTime(): Date {
  const now = new Date();
  const zonedNow = toPhilippineTime(now);
  return startOfDay(zonedNow);
}

/**
 * Check if a date is in the past (Philippine Time)
 * Used to prevent querying/booking past dates
 *
 * @param date - Date to check
 * @returns true if date is before today (Philippine Time)
 *
 * @example
 * isPastDate(new Date(2024, 11, 31)) // true if today is 2025-01-01
 * isPastDate(new Date(2025, 0, 1)) // false if today is 2025-01-01
 */
export function isPastDate(date: Date): boolean {
  const today = getTodayPhilippineTime();
  const zonedDate = toPhilippineTime(date);
  return isBefore(startOfDay(zonedDate), today);
}

/**
 * Check if a date exceeds 1 year from today (Philippine Time)
 * Used to limit calendar queries to reasonable timeframe
 *
 * @param date - Date to check
 * @returns true if date is more than 1 year in the future
 *
 * @example
 * isTooFarInFuture(new Date(2026, 0, 2)) // true if today is 2025-01-01
 * isTooFarInFuture(new Date(2025, 11, 31)) // false if today is 2025-01-01
 */
export function isTooFarInFuture(date: Date): boolean {
  const today = getTodayPhilippineTime();
  const oneYearFromNow = addYears(today, 1);

  const zonedDate = toPhilippineTime(date);
  return startOfDay(zonedDate) > oneYearFromNow;
}

/**
 * Get first day of month in Philippine Time
 * Used for month navigation and API query boundaries
 *
 * @param date - Date within the target month
 * @returns Date object for first day of month at 00:00:00
 *
 * @example
 * getMonthStart(new Date(2025, 0, 15)) // 2025-01-01 00:00:00
 */
export function getMonthStart(date: Date): Date {
  const zonedDate = toPhilippineTime(date);
  return startOfMonth(zonedDate);
}

/**
 * Get last day of month in Philippine Time
 * Used for month navigation and API query boundaries
 *
 * @param date - Date within the target month
 * @returns Date object for last day of month at 00:00:00
 *
 * @example
 * getMonthEnd(new Date(2025, 0, 15)) // 2025-01-31 00:00:00
 */
export function getMonthEnd(date: Date): Date {
  const zonedDate = toPhilippineTime(date);
  return endOfMonth(zonedDate);
}
