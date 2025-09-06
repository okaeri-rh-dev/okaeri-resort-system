/**
 * Booking System Types Index
 *
 * Central export location for all booking-related types and interfaces.
 */

// Export all availability-related types
export type {
  DateRange,
  DayAvailability,
  CalendarAvailability,
  AvailabilityService,
  BookingService,
  CreateBookingDto,
  UpdateBookingDto,
  BookingFilters,
  // Re-exported from common types
  Booking,
  Property,
  BookingStatus,
  PaymentStatus,
} from "./availability";
