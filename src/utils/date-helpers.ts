/**
 * Comprehensive Date Utilities for Okaeri Resort System
 *
 * Handles resort timezone operations, business day calculations,
 * date range validations, booking period utilities, and calendar
 * integration helpers with sub-second performance.
 *
 * @module DateHelpers
 */

import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { RESORT_TIMEZONE, RESORT_OPERATION_HOURS } from "@/config/settings";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface DateRange {
  start: Date;
  end: Date;
  duration: number; // in days
  isValid: boolean;
  errors?: string[];
}

export interface BusinessDayConfig {
  excludeWeekends: boolean;
  excludeHolidays: boolean;
  customHolidays: Date[];
  businessHours: {
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
}

export interface BookingPeriod {
  checkIn: Date;
  checkOut: Date;
  totalNights: number;
  totalDays: number;
  weekendNights: number;
  weekdayNights: number;
  isValidPeriod: boolean;
  conflicts: string[];
}

export interface PhilippineHoliday {
  name: string;
  date: Date;
  type: "regular" | "special_non_working" | "special_working";
  isNationwide: boolean;
  region?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  duration: number; // in minutes
  label: string;
  isAvailable: boolean;
}

export interface CalendarDay {
  date: Date;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  isToday: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  isBusinessDay: boolean;
  bookingStatus?: "available" | "occupied" | "maintenance" | "blackout";
  holidayName?: string;
}

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

/**
 * Standard business hours in resort timezone
 */
export const DEFAULT_BUSINESS_HOURS = {
  start: "08:00",
  end: "17:00",
};

/**
 * Check-in and check-out times for resort operations
 * @deprecated Use RESORT_OPERATION_HOURS from config/settings instead
 */
export const RESORT_SCHEDULE = {
  checkInTime: RESORT_OPERATION_HOURS.checkInTime,
  checkOutTime: RESORT_OPERATION_HOURS.checkOutTime,
  gracePeriodMinutes: 60,
  earlyCheckInFee: 500, // PHP
  lateCheckOutFee: 500, // PHP
};

/**
 * Philippine holidays for 2024-2025 (regular holidays)
 * Note: Some holidays are moveable and need annual updates
 */
export const PHILIPPINE_HOLIDAYS_2024: PhilippineHoliday[] = [
  { name: "New Year's Day", date: new Date("2024-01-01"), type: "regular", isNationwide: true },
  { name: "Maundy Thursday", date: new Date("2024-03-28"), type: "regular", isNationwide: true },
  { name: "Good Friday", date: new Date("2024-03-29"), type: "regular", isNationwide: true },
  { name: "Araw ng Kagitingan", date: new Date("2024-04-09"), type: "regular", isNationwide: true },
  { name: "Labor Day", date: new Date("2024-05-01"), type: "regular", isNationwide: true },
  { name: "Independence Day", date: new Date("2024-06-12"), type: "regular", isNationwide: true },
  {
    name: "National Heroes Day",
    date: new Date("2024-08-26"),
    type: "regular",
    isNationwide: true,
  }, // Last Monday of August
  { name: "Bonifacio Day", date: new Date("2024-11-30"), type: "regular", isNationwide: true },
  { name: "Christmas Day", date: new Date("2024-12-25"), type: "regular", isNationwide: true },
  { name: "Rizal Day", date: new Date("2024-12-30"), type: "regular", isNationwide: true },
];

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
 * Converts any date to Philippine timezone
 *
 * @param date - Date to convert (defaults to current time)
 * @returns Date in Philippine timezone
 */
export const toPhilippineTime = (date: Date = new Date()): Date => {
  return new Date(date.toLocaleString("en-US", { timeZone: PHILIPPINE_TIMEZONE }));
};

/**
 * Gets start of day in Philippine timezone
 *
 * @param date - Date to process (defaults to current Philippine time)
 * @returns Start of day (00:00:00) in Philippine timezone
 */
export const getPhilippineStartOfDay = (date?: Date): Date => {
  const philDate = date ? toPhilippineTime(date) : getPhilippineTime();
  return new Date(philDate.getFullYear(), philDate.getMonth(), philDate.getDate());
};

/**
 * Gets end of day in Philippine timezone
 *
 * @param date - Date to process (defaults to current Philippine time)
 * @returns End of day (23:59:59.999) in Philippine timezone
 */
export const getPhilippineEndOfDay = (date?: Date): Date => {
  const philDate = date ? toPhilippineTime(date) : getPhilippineTime();
  return new Date(philDate.getFullYear(), philDate.getMonth(), philDate.getDate(), 23, 59, 59, 999);
};

/**
 * Adds days to a date in Philippine timezone
 *
 * @param date - Base date
 * @param days - Number of days to add (can be negative)
 * @returns New date with days added
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Adds business days to a date (excluding weekends and holidays)
 *
 * @param date - Base date
 * @param businessDays - Number of business days to add
 * @param config - Business day configuration
 * @returns New date with business days added
 */
export const addBusinessDays = (
  date: Date,
  businessDays: number,
  config: Partial<BusinessDayConfig> = {}
): Date => {
  const fullConfig: BusinessDayConfig = {
    excludeWeekends: true,
    excludeHolidays: true,
    customHolidays: [],
    businessHours: DEFAULT_BUSINESS_HOURS,
    ...config,
  };

  let result = new Date(date);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    result = addDays(result, 1);

    if (isBusinessDay(result, fullConfig)) {
      daysAdded++;
    }
  }

  return result;
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
// BUSINESS DAY CALCULATIONS
// ============================================

/**
 * Checks if a date is a business day
 *
 * @param date - Date to check
 * @param config - Business day configuration
 * @returns True if the date is a business day
 */
export const isBusinessDay = (date: Date, config: Partial<BusinessDayConfig> = {}): boolean => {
  const fullConfig: BusinessDayConfig = {
    excludeWeekends: true,
    excludeHolidays: true,
    customHolidays: [],
    businessHours: DEFAULT_BUSINESS_HOURS,
    ...config,
  };

  // Check if it's a weekend
  if (fullConfig.excludeWeekends && isWeekend(date)) {
    return false;
  }

  // Check if it's a holiday
  if (fullConfig.excludeHolidays && isHoliday(date, fullConfig.customHolidays)) {
    return false;
  }

  return true;
};

/**
 * Checks if a date is a weekend (Saturday or Sunday)
 *
 * @param date - Date to check
 * @returns True if weekend
 */
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
};

/**
 * Checks if a date is a Philippine holiday
 *
 * @param date - Date to check
 * @param customHolidays - Additional custom holidays
 * @returns True if holiday
 */
export const isHoliday = (date: Date, customHolidays: Date[] = []): boolean => {
  const dateString = date.toISOString().split("T")[0];

  // Check Philippine holidays
  const isPhilippineHoliday = PHILIPPINE_HOLIDAYS_2024.some(
    (holiday) => holiday.date.toISOString().split("T")[0] === dateString
  );

  // Check custom holidays
  const isCustomHoliday = customHolidays.some(
    (holiday) => holiday.toISOString().split("T")[0] === dateString
  );

  return isPhilippineHoliday || isCustomHoliday;
};

/**
 * Gets the holiday information for a date
 *
 * @param date - Date to check
 * @returns Holiday information or null if not a holiday
 */
export const getHolidayInfo = (date: Date): PhilippineHoliday | null => {
  const dateString = date.toISOString().split("T")[0];
  return (
    PHILIPPINE_HOLIDAYS_2024.find(
      (holiday) => holiday.date.toISOString().split("T")[0] === dateString
    ) || null
  );
};

/**
 * Counts business days between two dates
 *
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (exclusive)
 * @param config - Business day configuration
 * @returns Number of business days
 */
export const countBusinessDays = (
  startDate: Date,
  endDate: Date,
  config: Partial<BusinessDayConfig> = {}
): number => {
  let count = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    if (isBusinessDay(current, config)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

// ============================================
// BOOKING PERIOD UTILITIES
// ============================================

/**
 * Validates and analyzes a booking period
 *
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Booking period analysis
 */
export const analyzeBookingPeriod = (checkIn: Date, checkOut: Date): BookingPeriod => {
  const conflicts: string[] = [];
  let isValidPeriod = true;

  // Basic validation
  if (checkOut <= checkIn) {
    conflicts.push("Check-out date must be after check-in date");
    isValidPeriod = false;
  }

  const totalDays = dateDifference(checkIn, checkOut, "days");
  const totalNights = totalDays; // Nights = days for booking calculations

  // Count weekend and weekday nights
  let weekendNights = 0;
  let weekdayNights = 0;

  const current = new Date(checkIn);
  while (current < checkOut) {
    if (isWeekend(current)) {
      weekendNights++;
    } else {
      weekdayNights++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Additional validations
  if (totalNights < 1) {
    conflicts.push("Minimum stay is 1 night");
    isValidPeriod = false;
  }

  if (totalNights > 30) {
    conflicts.push("Maximum stay is 30 nights");
    isValidPeriod = false;
  }

  const now = getPhilippineTime();
  if (checkIn < getPhilippineStartOfDay(now)) {
    conflicts.push("Check-in date cannot be in the past");
    isValidPeriod = false;
  }

  return {
    checkIn,
    checkOut,
    totalNights,
    totalDays,
    weekendNights,
    weekdayNights,
    isValidPeriod,
    conflicts,
  };
};

/**
 * Gets check-in and check-out times with resort schedule
 *
 * @param checkInDate - Check-in date
 * @param checkOutDate - Check-out date
 * @returns Dates with proper check-in/check-out times
 */
export const getResortScheduleTimes = (
  checkInDate: Date,
  checkOutDate: Date
): { checkInTime: Date; checkOutTime: Date } => {
  const checkInTime = new Date(checkInDate);
  const [checkInHour, checkInMinute] = RESORT_SCHEDULE.checkInTime.split(":").map(Number);
  checkInTime.setHours(checkInHour, checkInMinute, 0, 0);

  const checkOutTime = new Date(checkOutDate);
  const [checkOutHour, checkOutMinute] = RESORT_SCHEDULE.checkOutTime.split(":").map(Number);
  checkOutTime.setHours(checkOutHour, checkOutMinute, 0, 0);

  return { checkInTime, checkOutTime };
};

/**
 * Checks if early check-in or late check-out applies
 *
 * @param requestedTime - Requested check-in or check-out time
 * @param standardTime - Standard check-in or check-out time
 * @param type - Type of time check
 * @returns Information about early/late fees
 */
export const checkEarlyLateSchedule = (
  requestedTime: Date,
  standardTime: Date,
  type: "checkin" | "checkout"
): {
  isEarly: boolean;
  isLate: boolean;
  feesApply: boolean;
  additionalFee: number;
  gracePeriodExpired: boolean;
} => {
  const timeDiffMinutes = dateDifference(standardTime, requestedTime, "minutes");
  const gracePeriod = RESORT_SCHEDULE.gracePeriodMinutes;

  if (type === "checkin") {
    const isEarly = requestedTime < standardTime;
    const gracePeriodExpired = Math.abs(timeDiffMinutes) > gracePeriod;
    const feesApply = isEarly && gracePeriodExpired;

    return {
      isEarly,
      isLate: false,
      feesApply,
      additionalFee: feesApply ? RESORT_SCHEDULE.earlyCheckInFee : 0,
      gracePeriodExpired,
    };
  } else {
    const isLate = requestedTime > standardTime;
    const gracePeriodExpired = Math.abs(timeDiffMinutes) > gracePeriod;
    const feesApply = isLate && gracePeriodExpired;

    return {
      isEarly: false,
      isLate,
      feesApply,
      additionalFee: feesApply ? RESORT_SCHEDULE.lateCheckOutFee : 0,
      gracePeriodExpired,
    };
  }
};

// ============================================
// DATE RANGE UTILITIES
// ============================================

/**
 * Creates a validated date range
 *
 * @param start - Start date
 * @param end - End date
 * @returns Validated date range
 */
export const createDateRange = (start: Date, end: Date): DateRange => {
  const errors: string[] = [];
  let isValid = true;

  if (end <= start) {
    errors.push("End date must be after start date");
    isValid = false;
  }

  const duration = dateDifference(start, end, "days");

  return {
    start,
    end,
    duration,
    isValid,
    errors: errors.length > 0 ? errors : undefined,
  };
};

/**
 * Checks if two date ranges overlap
 *
 * @param range1 - First date range
 * @param range2 - Second date range
 * @returns True if ranges overlap
 */
export const dateRangesOverlap = (range1: DateRange, range2: DateRange): boolean => {
  return range1.start < range2.end && range1.end > range2.start;
};

/**
 * Gets the intersection of two date ranges
 *
 * @param range1 - First date range
 * @param range2 - Second date range
 * @returns Intersection range or null if no overlap
 */
export const getDateRangeIntersection = (
  range1: DateRange,
  range2: DateRange
): DateRange | null => {
  if (!dateRangesOverlap(range1, range2)) {
    return null;
  }

  const start = new Date(Math.max(range1.start.getTime(), range2.start.getTime()));
  const end = new Date(Math.min(range1.end.getTime(), range2.end.getTime()));

  return createDateRange(start, end);
};

/**
 * Generates an array of dates within a range
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @param includeEnd - Whether to include end date
 * @returns Array of dates
 */
export const generateDateArray = (
  startDate: Date,
  endDate: Date,
  includeEnd: boolean = false
): Date[] => {
  const dates: Date[] = [];
  const current = new Date(startDate);
  const end = includeEnd ? addDays(endDate, 1) : endDate;

  while (current < end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

// ============================================
// CALENDAR INTEGRATION
// ============================================

/**
 * Generates calendar data for a month
 *
 * @param year - Year
 * @param month - Month (0-11)
 * @param config - Business day configuration
 * @returns Array of calendar days
 */
export const generateMonthCalendar = (
  year: number,
  month: number,
  config: Partial<BusinessDayConfig> = {}
): CalendarDay[] => {
  const lastDay = new Date(year, month + 1, 0);
  const today = getPhilippineStartOfDay();

  const days: CalendarDay[] = [];

  for (let date = 1; date <= lastDay.getDate(); date++) {
    const currentDate = new Date(year, month, date);
    const holidayInfo = getHolidayInfo(currentDate);

    days.push({
      date: currentDate,
      dayOfWeek: currentDate.getDay(),
      dayName: currentDate.toLocaleDateString("en-US", { weekday: "long" }),
      isToday: currentDate.toDateString() === today.toDateString(),
      isWeekend: isWeekend(currentDate),
      isHoliday: holidayInfo !== null,
      isBusinessDay: isBusinessDay(currentDate, config),
      holidayName: holidayInfo?.name,
    });
  }

  return days;
};

/**
 * Generates time slots for a day
 *
 * @param date - Date to generate slots for
 * @param intervalMinutes - Interval between slots in minutes
 * @param businessHours - Business hours configuration
 * @returns Array of time slots
 */
export const generateTimeSlots = (
  date: Date,
  intervalMinutes: number = 30,
  businessHours: { start: string; end: string } = DEFAULT_BUSINESS_HOURS
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const [startHour, startMinute] = businessHours.start.split(":").map(Number);
  const [endHour, endMinute] = businessHours.end.split(":").map(Number);

  const startTime = new Date(date);
  startTime.setHours(startHour, startMinute, 0, 0);

  const endTime = new Date(date);
  endTime.setHours(endHour, endMinute, 0, 0);

  let current = new Date(startTime);

  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + intervalMinutes * 60 * 1000);

    slots.push({
      start: new Date(current),
      end: slotEnd,
      duration: intervalMinutes,
      label: `${current.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })} - ${slotEnd.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`,
      isAvailable: true, // Would be determined by actual availability check
    });

    current = slotEnd;
  }

  return slots;
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

/**
 * Parses various date string formats into Date object
 *
 * @param dateString - Date string to parse
 * @param timezone - Target timezone
 * @returns Parsed date or null if invalid
 */
export const parseDate = (
  dateString: string,
  _timezone: string = PHILIPPINE_TIMEZONE
): Date | null => {
  try {
    // Try standard Date parsing first
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return toPhilippineTime(parsed);
    }

    // Try additional formats
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    ];

    for (const format of formats) {
      if (format.test(dateString)) {
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
          return toPhilippineTime(parsed);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
};

/**
 * Gets timezone offset for Philippine time
 *
 * @returns Timezone offset in minutes
 */
export const getPhilippineTimezoneOffset = (): number => {
  const now = new Date();
  const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const philippineTime = new Date(utc.toLocaleString("en-US", { timeZone: PHILIPPINE_TIMEZONE }));

  return Math.round((philippineTime.getTime() - utc.getTime()) / 60000);
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
 * Formats a UTC date string for display in resort timezone
 *
 * @param utcString - UTC ISO string from database
 * @param formatStr - date-fns format string
 * @returns Formatted date string in resort timezone
 */
export const formatInResortTimezone = (utcString: string, formatStr: string): string => {
  return formatInTimeZone(new Date(utcString), RESORT_TIMEZONE, formatStr);
};

/**
 * Gets calendar date key from UTC string in resort timezone
 *
 * @param utcString - UTC ISO string from database
 * @returns Date key (YYYY-MM-DD) in resort timezone
 */
export const getResortCalendarKey = (utcString: string): string => {
  return formatInResortTimezone(utcString, "yyyy-MM-dd");
};

/**
 * Formats booking date for display (backward compatibility)
 *
 * @param dateString - Date string from database
 * @param includeTime - Whether to include time
 * @returns Formatted date string
 */
export const formatBookingDate = (dateString: string, includeTime: boolean = false): string => {
  const formatStr = includeTime ? "MMM d, yyyy h:mm a" : "MMM d, yyyy";
  return formatInResortTimezone(dateString, formatStr);
};

/**
 * Parse booking date (backward compatibility)
 * Converts UTC to resort timezone
 *
 * @param dateString - UTC date string
 * @returns Date in resort timezone
 */
export const parseBookingDate = (dateString: string): Date => {
  return utcToResortTime(dateString);
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
