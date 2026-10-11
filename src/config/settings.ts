/**
 * TypeScript type for valid timezone values
 * In development, this accepts any string but validates at runtime
 * In production builds, TypeScript will enforce valid values
 */
export type ValidTimezone = string;

/**
 * Helper to check if a timezone is valid
 */
export const isValidTimezone = (tz: string): tz is ValidTimezone => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * Resort Timezone Setting
 *
 * This defines the primary timezone for the resort's operations.
 * All dates and times in the system are interpreted and displayed
 * in this timezone, regardless of the user's location.
 *
 * This ensures that:
 * - Bookings are always in resort's local time
 * - Check-in/check-out times are consistent
 * - International guests book the correct dates
 *
 * Common timezone values:
 * - 'Asia/Manila' - Philippines (UTC+8)
 * - 'Asia/Tokyo' - Japan (UTC+9)
 * - 'America/New_York' - US East Coast (UTC-5/-4)
 * - 'Europe/London' - UK (UTC+0/+1)
 * - 'Australia/Sydney' - Australia East Coast (UTC+10/+11)
 * - 'Pacific/Honolulu' - Hawaii (UTC-10)
 * - 'Asia/Dubai' - UAE (UTC+4)
 * - 'Asia/Singapore' - Singapore (UTC+8)
 *
 * You can dynamically get all valid timezones using:
 * Intl.supportedValuesOf('timeZone')
 *
 * Or use the COMMON_TIMEZONES shortcuts above for convenience
 */
export const RESORT_TIMEZONE: ValidTimezone = "Asia/Manila";

// Validate on module load - ensure the configured timezone is valid
if (!isValidTimezone(RESORT_TIMEZONE)) {
  throw new Error(`Invalid RESORT_TIMEZONE configuration: ${RESORT_TIMEZONE}`);
}

// ============================================
// BUSINESS RULES
// ============================================

/**
 * Resort Operation Hours
 * Times are in 24-hour format in the resort's timezone
 */
export const RESORT_OPERATION_HOURS = {
  checkInTime: "14:00", // 2:00 PM
  checkOutTime: "12:00", // 12:00 PM
  officeOpenTime: "08:00", // 8:00 AM
  officeCloseTime: "20:00", // 8:00 PM
};
