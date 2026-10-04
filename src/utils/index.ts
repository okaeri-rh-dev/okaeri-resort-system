/**
 * Okaeri Resort System - Business Logic Utilities
 *
 * Centralized exports for all business logic utilities providing
 * comprehensive functionality for Phase 2 core features.
 *
 * @module UtilsIndex
 * @version 2.0.0
 */

import { logger } from "@/lib/logger";

// ============================================
// AVAILABILITY UTILITIES
// ============================================
export {
  calculateAvailabilityScore,
  // Core availability functions
  checkDateOverlap,
  filterAvailableUnits,
  findBlackoutConflicts,
  findBookingConflicts,
  findNextAvailableDate,
  optimizeMultiUnitSearch,
  validateBookingModification,
  validateDateRange,
  // Types
  type AvailabilityResult,
  type AvailableUnit,
  type BlackoutPeriod,
  type ConflictingBooking,
  type DateOverlap,
  type MultiUnitSearchOptions,
} from "./availability";

// ============================================
// BOOKING WORKFLOW
// ============================================
export {
  BOOKING_BUSINESS_RULES,
  // Constants
  BOOKING_STATUS_TRANSITIONS,
  createWorkflowEvent,
  executeStatusTransition,
  generateAutomatedTriggers,
  generateNextActions,
  // State machine functions
  getBookingWorkflowState,
  getWorkflowSummary,
  processAutomatedTriggers,
  validateBusinessRules,
  validateStatusTransition,
  type ActionRequirement,
  type AutomatedTrigger,
  // Types
  type BookingWorkflowState,
  type BusinessRule,
  type WorkflowAction,
  type WorkflowEvent,
  type WorkflowTransition,
} from "./booking-workflow";

// ============================================
// PRICING CALCULATIONS
// ============================================
export {
  calculateApplicableDiscounts,
  calculateNightlyRates,
  calculateOccupancyMultiplier,
  calculatePriceComparison,
  // Core pricing functions
  calculatePricing,
  calculateTaxes,
  // Configuration
  DEFAULT_PRICING_CONFIG,
  formatPricingBreakdown,
  getSeasonalMultiplier,
  type AppliedDiscount,
  type DiscountCondition,
  type DiscountRule,
  type NightlyRate,
  type OccupancyRate,
  type PricingBreakdown,
  // Types
  type PricingConfig,
  type PricingOptions,
  type Promotion,
  type SeasonalRate,
  type TaxBreakdown,
  type TaxConfiguration,
} from "./pricing";

// ============================================
// DATE UTILITIES
// ============================================
export {
  addBusinessDays,
  // Date manipulation
  addDays,
  // Booking period utilities
  analyzeBookingPeriod,
  checkEarlyLateSchedule,
  countBusinessDays,
  // Date range utilities
  createDateRange,
  dateDifference,
  dateRangesOverlap,
  DEFAULT_BUSINESS_HOURS,
  // Date formatting
  formatDate,
  formatRelativeTime,
  generateDateArray,

  // Calendar integration
  generateMonthCalendar,
  generateTimeSlots,
  getDateRangeIntersection,
  getHolidayInfo,
  getPhilippineEndOfDay,
  getPhilippineStartOfDay,
  // Philippine timezone functions
  getPhilippineTime,
  getPhilippineTimezoneOffset,
  getResortScheduleTimes,
  // Business day calculations
  isBusinessDay,
  isHoliday,
  isWeekend,
  parseDate,
  PHILIPPINE_HOLIDAYS_2024,
  // Constants
  PHILIPPINE_TIMEZONE,
  RESORT_SCHEDULE,
  toPhilippineTime,
  type BookingPeriod,
  type BusinessDayConfig,
  type CalendarDay,
  type DateFormatOptions,
  // Types
  type DateRange,
  type PhilippineHoliday,
  type TimeSlot,
} from "./date-helpers";

// ============================================
// VALIDATION UTILITIES
// ============================================
export {
  // Configuration
  DEFAULT_BOOKING_CONSTRAINTS,
  DEFAULT_PAYMENT_OPTIONS,
  isCommonEmailDomain,
  isValidEmail,
  isValidName,
  isValidPhilippinePhoneNumber,
  normalizePhilippinePhoneNumber,
  sanitizeGuestData,
  // Booking validation
  validateBookingConstraints,
  validateBusinessRegistrationCompliance,
  validateCompleteBooking,
  // Compliance validation
  validateDataPrivacyCompliance,
  // Guest validation
  validateGuestInformation,
  // Payment validation
  validatePayment,
  type BookingConstraints,
  type ComplianceAction,
  type ComplianceViolation,
  type PaymentValidationOptions,
  type PhilippineComplianceResult,
  type ValidationContext,
  type ValidationError,
  // Types
  type ValidationResult,
  type ValidationRule,
  type ValidationWarning,
} from "./validation";

// ============================================
// REPORTING UTILITIES (Phase 2)
// ============================================
export {
  exportBookingsToCSV,
  exportOccupancyToCSV,
  exportToCSV,
  formatBookingsForExport,
  formatOccupancyForExport,
  // Report generation
  generateOccupancyReport,
  generateRevenueReport,
  // Types
  type OccupancyReport,
  type RevenueReport,
} from "./reports";

// ============================================
// PERFORMANCE UTILITIES
// ============================================
export {
  performanceUtils,
  // Re-export performance utilities from existing file
  validatePerformance,
} from "./performance-validator";

// ============================================
// UTILITY HELPERS
// ============================================

/**
 * Creates a comprehensive validation context for business operations
 *
 * @param options - Context configuration options
 * @returns Complete validation context
 */
export const createValidationContext = (options: {
  existingBookings?: unknown[];
  existingGuests?: unknown[];
  units?: unknown[];
  userRole?: string;
  operatingMode?: "strict" | "lenient";
}) => {
  return {
    existingBookings: options.existingBookings || [],
    existingGuests: options.existingGuests || [],
    units: options.units || [],
    userRole: options.userRole || "staff",
    operatingMode: options.operatingMode || "strict",
    skipBusinessRules: false,
    skipComplianceChecks: false,
  };
};

/**
 * Formats currency for Philippine peso display
 *
 * @param amount - Amount to format
 * @param includeSymbol - Whether to include peso symbol
 * @returns Formatted currency string
 */
export const formatPhilippineCurrency = (amount: number, includeSymbol: boolean = true): string => {
  const formatted = amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return includeSymbol ? `₱${formatted}` : formatted;
};

/**
 * Generates a unique booking reference number
 *
 * @param prefix - Optional prefix (defaults to 'BK')
 * @returns Unique booking reference
 */
export const generateBookingReference = (prefix: string = "BK"): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp.substring(-6)}${random}`;
};

/**
 * Calculates the distance between two dates in a human-readable format
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Human-readable distance string
 */
export const getHumanReadableDateDistance = (startDate: Date, endDate: Date): string => {
  const totalDays = Math.abs(
    Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (totalDays === 0) {
    return "Same day";
  } else if (totalDays === 1) {
    return "1 day";
  } else if (totalDays < 7) {
    return `${totalDays} days`;
  } else if (totalDays < 30) {
    const weeks = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;
    if (remainingDays === 0) {
      return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
    } else {
      return `${weeks} ${weeks === 1 ? "week" : "weeks"} and ${remainingDays} ${remainingDays === 1 ? "day" : "days"}`;
    }
  } else {
    const months = Math.floor(totalDays / 30);
    const remainingDays = totalDays % 30;
    if (remainingDays === 0) {
      return `${months} ${months === 1 ? "month" : "months"}`;
    } else {
      return `${months} ${months === 1 ? "month" : "months"} and ${remainingDays} ${remainingDays === 1 ? "day" : "days"}`;
    }
  }
};

/**
 * Safely parses a JSON string with error handling
 *
 * @param jsonString - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export const safeJsonParse = <T>(jsonString: string, fallback: T): T => {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
};

/**
 * Debounce function for performance optimization
 *
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for performance optimization
 *
 * @param func - Function to throttle
 * @param limit - Limit in milliseconds
 * @returns Throttled function
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Deep clone an object safely
 *
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
};

// ============================================
// VERSION AND METADATA
// ============================================

/**
 * Utility library version and metadata
 */
export const UTILS_METADATA = {
  version: "2.0.0",
  buildDate: new Date().toISOString(),
  modules: [
    "availability",
    "booking-workflow",
    "pricing",
    "date-helpers",
    "validation",
    "performance-validator",
  ],
  features: [
    "availability-checking",
    "workflow-state-machine",
    "dynamic-pricing",
    "philippine-timezone",
    "business-validation",
    "compliance-checking",
    "performance-optimization",
  ],
  compatibility: {
    react: ">=18.0.0",
    typescript: ">=5.0.0",
    zustand: ">=4.0.0",
    tanstackQuery: ">=5.0.0",
  },
} as const;

/**
 * Logs utility library initialization
 */
export const initializeUtils = (): void => {
  logger.info(`📊 Okaeri Resort System Utils v${UTILS_METADATA.version} initialized`);
  logger.info(`📅 Build Date: ${UTILS_METADATA.buildDate}`);
  logger.info(`🏨 Modules: ${UTILS_METADATA.modules.join(", ")}`);
};
