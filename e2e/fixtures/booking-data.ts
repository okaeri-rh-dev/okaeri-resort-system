/**
 * Booking Test Data Fixtures
 *
 * Dynamic date generators and test data factories for booking-related E2E tests.
 * Provides consistent test data while ensuring date-based tests don't become stale.
 */

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format date as YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Get the next occurrence of a specific day of week (0 = Sunday, 5 = Friday, 6 = Saturday)
 */
export function getNextDayOfWeek(dayOfWeek: number, fromDate: Date = new Date()): Date {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntilTarget);
  return result;
}

/**
 * Get next Friday
 */
export function nextFriday(fromDate: Date = new Date()): Date {
  return getNextDayOfWeek(5, fromDate);
}

/**
 * Get next Sunday
 */
export function nextSunday(fromDate: Date = new Date()): Date {
  return getNextDayOfWeek(0, fromDate);
}

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is a weekend (Friday or Saturday night)
 */
export function isWeekendNight(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6; // Friday or Saturday
}

/**
 * Count weekend nights in a date range
 */
export function countWeekendNights(checkIn: Date, checkOut: Date): number {
  let count = 0;
  const current = new Date(checkIn);
  while (current < checkOut) {
    if (isWeekendNight(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Dynamic date generators for various booking scenarios
 */
export const BOOKING_DATES = {
  /**
   * Urgent stay - checking in tomorrow (high urgency)
   */
  getUrgentStay: () => {
    const checkIn = addDays(new Date(), 1);
    const checkOut = addDays(checkIn, 2);
    return {
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      nights: 2,
    };
  },

  /**
   * Weekend stay - Friday to Sunday
   */
  getWeekendStay: () => {
    const friday = nextFriday();
    const sunday = addDays(friday, 2);
    return {
      checkIn: formatDate(friday),
      checkOut: formatDate(sunday),
      nights: 2,
    };
  },

  /**
   * Extended stay - 1 week from now, 7 nights
   */
  getExtendedStay: () => {
    const checkIn = addDays(new Date(), 7);
    const checkOut = addDays(checkIn, 7);
    return {
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      nights: 7,
    };
  },

  /**
   * Standard stay - 1 week from now, 3 nights
   */
  getStandardStay: () => {
    const checkIn = addDays(new Date(), 7);
    const checkOut = addDays(checkIn, 3);
    return {
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      nights: 3,
    };
  },

  /**
   * Same-day booking (check-in today) - for edge case testing
   */
  getSameDayStay: () => {
    const checkIn = new Date();
    const checkOut = addDays(checkIn, 1);
    return {
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      nights: 1,
    };
  },

  /**
   * Far future stay - 2 months from now
   */
  getFarFutureStay: () => {
    const checkIn = addDays(new Date(), 60);
    const checkOut = addDays(checkIn, 3);
    return {
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      nights: 3,
    };
  },

  /**
   * Custom date range generator
   */
  getCustomStay: (daysFromNow: number, nights: number) => {
    const checkIn = addDays(new Date(), daysFromNow);
    const checkOut = addDays(checkIn, nights);
    return {
      checkIn: formatDate(checkIn),
      checkOut: formatDate(checkOut),
      nights,
    };
  },
};

/**
 * Guest profile types for different test scenarios
 */
export interface GuestProfile {
  name: string;
  email: string;
  phone: string;
  guestCount?: number;
}

/**
 * Guest profile templates for various test scenarios
 */
export const GUEST_PROFILES: Record<string, GuestProfile> = {
  individual: {
    name: "Test Guest Individual",
    email: "testguest@example.com",
    phone: "+639171234567",
    guestCount: 2,
  },
  couple: {
    name: "Test Guest Couple",
    email: "couple@example.com",
    phone: "+639181234567",
    guestCount: 2,
  },
  smallGroup: {
    name: "Small Group Leader",
    email: "smallgroup@example.com",
    phone: "+639191234567",
    guestCount: 4,
  },
  largeGroup: {
    name: "Large Group Leader",
    email: "largegroup@example.com",
    phone: "+639201234567",
    guestCount: 8,
  },
  maxCapacity: {
    name: "Max Capacity Guest",
    email: "maxcapacity@example.com",
    phone: "+639211234567",
    guestCount: 10,
  },
  singleGuest: {
    name: "Solo Traveler",
    email: "solo@example.com",
    phone: "+639221234567",
    guestCount: 1,
  },
};

/**
 * Generate a unique booking reference for test isolation
 * Format: OKR-TEST-{timestamp}-{random}
 */
export function generateTestReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OKR-TEST-${timestamp}-${random}`;
}

/**
 * Generate a unique email for test isolation
 */
export function generateTestEmail(prefix: string = "test"): string {
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}@e2e-test.example.com`;
}

/**
 * Complete booking test data factory
 */
export interface BookingTestData {
  dates: {
    checkIn: string;
    checkOut: string;
    nights: number;
  };
  guest: GuestProfile;
  paymentMethod: string;
  unitCount?: number;
  specialRequests?: string;
}

/**
 * Create complete booking test data with defaults
 */
export function createBookingTestData(overrides: Partial<BookingTestData> = {}): BookingTestData {
  const defaults: BookingTestData = {
    dates: BOOKING_DATES.getStandardStay(),
    guest: {
      ...GUEST_PROFILES.individual,
      email: generateTestEmail(), // Unique email per test
    },
    paymentMethod: "GCash",
    unitCount: 1,
    specialRequests: "E2E Test Booking - Please ignore",
  };

  return {
    ...defaults,
    ...overrides,
    dates: overrides.dates || defaults.dates,
    guest: {
      ...defaults.guest,
      ...overrides.guest,
    },
  };
}

/**
 * Payment method options available in the system
 */
export const PAYMENT_METHODS = {
  gcash: "GCash",
  bankTransfer: "Bank Transfer",
  cash: "Cash",
  maya: "Maya",
} as const;

/**
 * Urgency levels for admin queue testing
 */
export const URGENCY_LEVELS = {
  critical: { min: 75, label: "Critical" },
  high: { min: 50, max: 74, label: "High" },
  medium: { min: 25, max: 49, label: "Medium" },
  low: { min: 0, max: 24, label: "Low" },
} as const;

/**
 * Calculate expected urgency score based on check-in date
 * Score is higher for bookings with check-in dates closer to today
 */
export function calculateUrgencyScore(checkInDate: string): number {
  const checkIn = new Date(checkInDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  checkIn.setHours(0, 0, 0, 0);

  const daysUntilCheckIn = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Urgency scoring based on days until check-in
  if (daysUntilCheckIn <= 1) return 100; // Today or tomorrow
  if (daysUntilCheckIn <= 3) return 85;
  if (daysUntilCheckIn <= 7) return 65;
  if (daysUntilCheckIn <= 14) return 40;
  if (daysUntilCheckIn <= 30) return 20;
  return 10;
}

/**
 * Get urgency level label from score
 */
export function getUrgencyLevel(score: number): keyof typeof URGENCY_LEVELS {
  if (score >= URGENCY_LEVELS.critical.min) return "critical";
  if (score >= URGENCY_LEVELS.high.min) return "high";
  if (score >= URGENCY_LEVELS.medium.min) return "medium";
  return "low";
}
