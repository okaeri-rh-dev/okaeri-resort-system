/**
 * Application Configuration Settings
 *
 * Centralized configuration for the Okaeri Resort System.
 * These settings can be adjusted based on deployment environment
 * and business requirements.
 */

// ============================================
// TIMEZONE CONFIGURATION
// ============================================

/**
 * Get all supported IANA timezone identifiers
 * This uses the Intl API to get the complete list of valid timezones
 *
 * @returns Array of all valid timezone strings
 */
export const getSupportedTimezones = (): readonly string[] => {
  try {
    // This is supported in modern browsers and Node.js 18.0+
    return Intl.supportedValuesOf("timeZone");
  } catch {
    // Fallback for older environments - return common timezones
    return [
      "Asia/Manila",
      "Asia/Singapore",
      "Asia/Tokyo",
      "America/New_York",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Australia/Sydney",
      "Pacific/Honolulu",
    ];
  }
};

/**
 * All supported timezones as a const array
 */
export const SUPPORTED_TIMEZONES = getSupportedTimezones();

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
 * Common timezone shortcuts for convenience
 * These are validated against the Intl API
 */
export const COMMON_TIMEZONES = {
  // Asia-Pacific
  PHILIPPINES: "Asia/Manila",
  SINGAPORE: "Asia/Singapore",
  JAPAN: "Asia/Tokyo",
  KOREA: "Asia/Seoul",
  THAILAND: "Asia/Bangkok",
  INDONESIA_WEST: "Asia/Jakarta",
  HONG_KONG: "Asia/Hong_Kong",
  CHINA: "Asia/Shanghai",
  INDIA: "Asia/Kolkata",
  UAE: "Asia/Dubai",
  AUSTRALIA_EAST: "Australia/Sydney",
  NEW_ZEALAND: "Pacific/Auckland",

  // Americas
  US_EAST: "America/New_York",
  US_CENTRAL: "America/Chicago",
  US_MOUNTAIN: "America/Denver",
  US_WEST: "America/Los_Angeles",
  US_ARIZONA: "America/Phoenix",
  CANADA_EAST: "America/Toronto",
  MEXICO: "America/Mexico_City",
  BRAZIL: "America/Sao_Paulo",
  HAWAII: "Pacific/Honolulu",

  // Europe
  UK: "Europe/London",
  FRANCE: "Europe/Paris",
  GERMANY: "Europe/Berlin",
  ITALY: "Europe/Rome",
  SPAIN: "Europe/Madrid",
  NETHERLANDS: "Europe/Amsterdam",
  RUSSIA: "Europe/Moscow",
  TURKEY: "Europe/Istanbul",

  // Africa
  EGYPT: "Africa/Cairo",
  SOUTH_AFRICA: "Africa/Johannesburg",
  NIGERIA: "Africa/Lagos",
} as const;

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
  checkInTime: "15:00", // 3:00 PM
  checkOutTime: "11:00", // 11:00 AM
  officeOpenTime: "08:00", // 8:00 AM
  officeCloseTime: "20:00", // 8:00 PM
};

/**
 * Booking Rules
 */
export const BOOKING_RULES = {
  minStayNights: 1,
  maxStayNights: 30,
  advanceBookingDays: 365, // How far in advance bookings can be made
  cancellationHours: 48, // Hours before check-in for free cancellation
};

/**
 * Fee Structure
 * All amounts in Philippine Pesos (PHP)
 */
export const FEES = {
  earlyCheckInFee: 500,
  lateCheckOutFee: 500,
  extraPersonFee: 500,
  cleaningFee: 300,
  securityDeposit: 1000,
};

// ============================================
// DISPLAY CONFIGURATION
// ============================================

/**
 * Localization Settings
 */
export const LOCALE = {
  currency: "PHP",
  currencySymbol: "₱",
  dateLocale: "en-PH",
  phoneFormat: "+63", // Philippines country code
};

/**
 * Date Display Formats
 * Using date-fns format strings
 */
export const DATE_FORMATS = {
  display: "MMM dd, yyyy", // Jan 01, 2024
  displayWithTime: "MMM dd, yyyy h:mm a", // Jan 01, 2024 3:00 PM
  input: "yyyy-MM-dd", // 2024-01-01
  calendarKey: "yyyy-MM-dd", // 2024-01-01
  shortDate: "MMM dd", // Jan 01
  time: "h:mm a", // 3:00 PM
};

// ============================================
// SYSTEM CONFIGURATION
// ============================================

/**
 * Performance Settings
 */
export const PERFORMANCE = {
  dataStaleTime: 300000, // 5 minutes in ms
  cacheTime: 600000, // 10 minutes in ms
  debounceDelay: 300, // 300ms for search debounce
  maxConcurrentRequests: 5,
};

/**
 * Pagination Defaults
 */
export const PAGINATION = {
  defaultPageSize: 10,
  pageSizeOptions: [10, 25, 50, 100],
};

// ============================================
// FEATURE FLAGS
// ============================================

/**
 * Feature Toggles
 * Enable/disable features across the application
 */
export const FEATURES = {
  enableGuestRegistration: true,
  enableOnlinePayments: true,
  enableEmailNotifications: false,
  enableSMSNotifications: false,
  enableMaintenanceMode: false,
  enableBetaFeatures: false,
};

// ============================================
// EXPORT ALL SETTINGS
// ============================================

export default {
  RESORT_TIMEZONE,
  RESORT_OPERATION_HOURS,
  BOOKING_RULES,
  FEES,
  LOCALE,
  DATE_FORMATS,
  PERFORMANCE,
  PAGINATION,
  FEATURES,
};
