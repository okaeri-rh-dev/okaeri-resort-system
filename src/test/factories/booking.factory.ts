/**
 * Booking Test Factory
 *
 * Factory functions for creating test booking objects with realistic data.
 * Used by availability service tests to mock database responses.
 */

import type { Booking } from "@/types/common";

let bookingIdCounter = 1;

/**
 * Reset the booking ID counter for test isolation
 */
export function resetBookingIdCounter(): void {
  bookingIdCounter = 1;
}

/**
 * Create a test booking object with sensible defaults
 */
export function createBooking(overrides: Partial<Booking> = {}): Booking {
  const id = overrides.id || `booking-${String(bookingIdCounter++).padStart(3, "0")}`;

  return {
    id,
    projectId: overrides.projectId || "test-project-001",
    propertyId: overrides.propertyId || "villa-001",
    guestName: overrides.guestName || "Test Guest",
    guestEmail: overrides.guestEmail || "guest@example.com",
    guestPhone: overrides.guestPhone || "+63 912 345 6789",
    checkIn: overrides.checkIn || "2024-06-01",
    checkOut: overrides.checkOut || "2024-06-03",
    nights: overrides.nights || 2,
    guests: overrides.guests || 2,
    status: overrides.status || "CONFIRMED",
    source: overrides.source || "DIRECT",
    totalAmount: overrides.totalAmount || 6000,
    paidAmount: overrides.paidAmount || 3000,
    paymentStatus: overrides.paymentStatus || "PARTIAL",
    paymentMethod: overrides.paymentMethod || "CASH",
    notes: overrides.notes || "",
    specialRequests: overrides.specialRequests || "",
    createdAt: overrides.createdAt || "2024-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt || "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Create multiple bookings with sequential IDs
 */
export function createBookings(count: number, overrides: Partial<Booking> = {}): Booking[] {
  return Array.from({ length: count }, (_, index) =>
    createBooking({
      ...overrides,
      id: overrides.id ? `${overrides.id}-${index + 1}` : undefined,
    })
  );
}

/**
 * Create a booking with specific date conflicts for testing
 */
export function createConflictingBooking(
  checkIn: string,
  checkOut: string,
  propertyId: string = "villa-001",
  overrides: Partial<Booking> = {}
): Booking {
  return createBooking({
    checkIn,
    checkOut,
    propertyId,
    status: "CONFIRMED",
    ...overrides,
  });
}

/**
 * Create a cancelled booking (should not conflict with availability)
 */
export function createCancelledBooking(overrides: Partial<Booking> = {}): Booking {
  return createBooking({
    status: "CANCELLED",
    ...overrides,
  });
}

/**
 * Create booking with Philippines-specific data
 */
export function createPhilippinesBooking(overrides: Partial<Booking> = {}): Booking {
  return createBooking({
    guestName: overrides.guestName || "Juan dela Cruz",
    guestPhone: overrides.guestPhone || "+63 917 123 4567",
    guestEmail: overrides.guestEmail || "juan@gmail.com",
    totalAmount: overrides.totalAmount || 4500, // PHP amount
    paymentMethod: overrides.paymentMethod || "CASH",
    ...overrides,
  });
}

/**
 * Create booking for different seasons/rates
 */
export function createSeasonalBooking(
  season: "peak" | "regular" | "off-peak",
  overrides: Partial<Booking> = {}
): Booking {
  const seasonalPricing = {
    peak: 8000, // Peak season (holidays)
    regular: 5000, // Regular season
    "off-peak": 3000, // Off-peak season
  };

  const seasonalDates = {
    peak: { checkIn: "2024-12-20", checkOut: "2024-12-25" }, // Christmas
    regular: { checkIn: "2024-06-01", checkOut: "2024-06-03" }, // Regular
    "off-peak": { checkIn: "2024-02-01", checkOut: "2024-02-03" }, // Off-peak
  };

  return createBooking({
    ...seasonalDates[season],
    totalAmount: seasonalPricing[season],
    ...overrides,
  });
}
