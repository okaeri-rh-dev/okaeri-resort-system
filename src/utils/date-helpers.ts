/**
 * Comprehensive Date Utilities for Okaeri Resort System
 *
 * Handles resort timezone operations, business day calculations,
 * date range validations, booking period utilities, and calendar
 * integration helpers with sub-second performance.
 *
 * @module DateHelpers
 */

import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { RESORT_TIMEZONE } from "@/config/settings";

export interface DateFormatOptions {
  locale?: string;
  timezone?: string;
  format?: "short" | "medium" | "long" | "full" | "custom";
  customFormat?: string;
  includeTime?: boolean;
  relativeTime?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Philippine timezone identifier (kept for backward compatibility)
 * @deprecated Use RESORT_TIMEZONE from config/settings instead
 */
export const PHILIPPINE_TIMEZONE = RESORT_TIMEZONE;

// ============================================
// CORE DATE FUNCTIONS
// ============================================

/**
 * Gets current Philippine time
 *
 * @returns Current date and time in Philippine timezone
 */
export const getPhilippineTime = (): Date => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: PHILIPPINE_TIMEZONE }));
};

/**
 * Calculates the difference between two dates in various units
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @param unit - Unit of measurement
 * @returns Difference in specified unit
 */
export const dateDifference = (
  startDate: Date,
  endDate: Date,
  unit: "milliseconds" | "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years"
): number => {
  const diffMs = endDate.getTime() - startDate.getTime();

  switch (unit) {
    case "milliseconds":
      return diffMs;
    case "seconds":
      return Math.floor(diffMs / 1000);
    case "minutes":
      return Math.floor(diffMs / (1000 * 60));
    case "hours":
      return Math.floor(diffMs / (1000 * 60 * 60));
    case "days":
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    case "weeks":
      return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
    case "months": {
      const yearDiff = endDate.getFullYear() - startDate.getFullYear();
      const monthDiff = endDate.getMonth() - startDate.getMonth();
      return yearDiff * 12 + monthDiff;
    }
    case "years":
      return endDate.getFullYear() - startDate.getFullYear();
    default:
      return 0;
  }
};

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Formats a date according to specified options
 *
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Formatted date string
 */
export const formatDate = (date: Date, options: DateFormatOptions = {}): string => {
  const {
    locale = "en-PH",
    timezone = PHILIPPINE_TIMEZONE,
    format = "medium",
    customFormat,
    includeTime = false,
    relativeTime = false,
  } = options;

  if (relativeTime) {
    return formatRelativeTime(date);
  }

  if (customFormat) {
    return formatCustomDate(date, customFormat, timezone);
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
  };

  switch (format) {
    case "short":
      formatOptions.dateStyle = "short";
      break;
    case "medium":
      formatOptions.dateStyle = "medium";
      break;
    case "long":
      formatOptions.dateStyle = "long";
      break;
    case "full":
      formatOptions.dateStyle = "full";
      break;
  }

  if (includeTime) {
    formatOptions.timeStyle = "short";
  }

  return date.toLocaleDateString(locale, formatOptions);
};

/**
 * Formats relative time (e.g., "2 days ago", "in 3 hours")
 *
 * @param date - Date to format
 * @returns Relative time string
 */
export const formatRelativeTime = (date: Date): string => {
  const now = getPhilippineTime();
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);

  const units = [
    { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
    { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
    { unit: "week", ms: 1000 * 60 * 60 * 24 * 7 },
    { unit: "day", ms: 1000 * 60 * 60 * 24 },
    { unit: "hour", ms: 1000 * 60 * 60 },
    { unit: "minute", ms: 1000 * 60 },
  ];

  for (const { unit, ms } of units) {
    if (absDiffMs >= ms) {
      const value = Math.floor(absDiffMs / ms);
      const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
      return rtf.format(diffMs < 0 ? -value : value, unit as Intl.RelativeTimeFormatUnit);
    }
  }

  return "just now";
};

/**
 * Formats date with custom format string
 *
 * @param date - Date to format
 * @param format - Custom format string
 * @param timezone - Timezone
 * @returns Formatted date string
 */
const formatCustomDate = (
  date: Date,
  format: string,
  _timezone: string = PHILIPPINE_TIMEZONE
): string => {
  const philDate = new Date(date.toLocaleString("en-US", { timeZone: _timezone }));

  const tokens: Record<string, string> = {
    YYYY: philDate.getFullYear().toString(),
    MM: (philDate.getMonth() + 1).toString().padStart(2, "0"),
    DD: philDate.getDate().toString().padStart(2, "0"),
    HH: philDate.getHours().toString().padStart(2, "0"),
    mm: philDate.getMinutes().toString().padStart(2, "0"),
    ss: philDate.getSeconds().toString().padStart(2, "0"),
  };

  let formatted = format;
  Object.entries(tokens).forEach(([token, value]) => {
    formatted = formatted.replace(new RegExp(token, "g"), value);
  });

  return formatted;
};

// ============================================
// TIMEZONE-AWARE BOOKING DATE HANDLING
// ============================================

/**
 * Converts a form date input to UTC for storage
 * Interprets the selected date as being in the resort's timezone
 *
 * Example: User selects Oct 1 -> Treated as Oct 1 in resort timezone -> Stored as UTC
 *
 * @param date - Date selected by user (in their browser's timezone)
 * @param timeString - Time in HH:mm format (default: "00:00")
 * @returns UTC ISO string for database storage
 */
export const formDateToUTC = (date: Date, timeString: string = "00:00"): string => {
  const [hours, minutes] = timeString.split(":").map(Number);

  // Create date using the selected day/month/year but interpret as resort timezone
  const resortDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  );

  // Convert from resort timezone to UTC
  return fromZonedTime(resortDate, RESORT_TIMEZONE).toISOString();
};

/**
 * Converts UTC string from database to resort timezone Date
 *
 * @param utcString - UTC ISO string from database
 * @returns Date object in resort timezone
 */
export const utcToResortTime = (utcString: string): Date => {
  return toZonedTime(new Date(utcString), RESORT_TIMEZONE);
};

/**
 * Gets calendar date key from a Date object
 *
 * @param date - Date object
 * @returns Date key (YYYY-MM-DD)
 */
export const getCalendarDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
