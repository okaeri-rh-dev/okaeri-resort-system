/**
 * Mock Factory for Booking Endpoints
 *
 * Creates Supabase client mocks for testing multi-unit booking operations.
 * Supports happy path, unavailable units, and error scenarios.
 */

import { createMockSupabaseClient } from "../helpers/mock-supabase";
import { testBookingResponse, testBookingUnits, testUnits } from "../utils/fixtures";

export interface BookingMockOptions {
  /** Unit data to return from units table */
  units?: Array<{
    unit_id: string;
    unit_name: string;
    unit_code: string;
    unit_type: string;
    base_occupancy?: number;
    max_occupancy?: number;
    base_rate?: number;
    weekend_rate?: number;
    extra_person_rate?: number;
  }>;

  /** Availability results - if not provided, defaults to all available */
  availabilityResults?: Array<{
    unit_id: string;
    is_available: boolean;
    conflicting_bookings?: number;
    next_available_date?: string | null;
  }>;

  /** Make all units available (default: true) */
  allAvailable?: boolean;

  /** Make all units unavailable */
  allUnavailable?: boolean;

  /** Booking response data */
  bookingResponse?: {
    booking_id: string;
    booking_reference: string;
    guest_id?: string;
    booking_status?: string;
    payment_status?: string;
    total_amount?: number;
    booking_units?: Array<{
      unit_id: string;
      unit: {
        unit_id: string;
        unit_name: string;
        unit_code: string;
        unit_type: string;
      };
    }>;
  };

  /** Generated booking reference (default: "BK-TEST-001") */
  bookingReference?: string;

  /** Booking ID returned by create_multi_unit_booking (default: "mock-booking-id") */
  createdBookingId?: string;

  /** Simulate database error */
  hasError?: boolean;

  /** Error message to return */
  errorMessage?: string;
}

/**
 * Create mock Supabase client for booking endpoint testing
 */
export function createBookingMocks(options: BookingMockOptions = {}) {
  const {
    units = testUnits,
    availabilityResults,
    allAvailable = true,
    allUnavailable = false,
    bookingReference = "BK-TEST-001",
    createdBookingId = "mock-booking-id",
    hasError = false,
    errorMessage = "Database connection failed",
  } = options;

  // Create booking response with the createdBookingId
  const bookingResponse = options.bookingResponse || {
    ...testBookingResponse,
    booking_id: createdBookingId, // Ensure booking_id matches what RPC returns
    booking_units: testBookingUnits.map((bu) => ({
      unit_id: bu.unit_id,
      unit: {
        unit_id: bu.unit_id,
        unit_name: bu.unit_name,
        unit_code: bu.unit_code,
        unit_type: testUnits.find((u) => u.unit_id === bu.unit_id)?.unit_type || "Standard",
      },
    })),
  };

  const error = hasError ? { message: errorMessage } : null;

  return createMockSupabaseClient({
    tables: {
      units,
      bookings: [bookingResponse],
    },
    rpcs: {
      /**
       * Check availability for multiple units
       */
      check_multi_unit_availability: (params: Record<string, unknown>) => {
        // If custom results provided, use them
        if (availabilityResults) {
          return availabilityResults;
        }

        // Otherwise generate based on flags
        const unitIds = params.p_unit_ids || [];
        return unitIds.map((id: string) => ({
          unit_id: id,
          is_available: allUnavailable ? false : allAvailable,
          conflicting_bookings: allUnavailable ? 1 : 0,
          next_available_date: allUnavailable ? "2025-12-25T06:00:00Z" : null,
        }));
      },

      /**
       * Generate booking reference
       */
      generate_booking_reference: () => {
        return bookingReference;
      },

      /**
       * Create multi-unit booking
       */
      create_multi_unit_booking: (_params: Record<string, unknown>) => {
        // Return the booking ID that was created
        return createdBookingId;
      },
    },
    errors: {
      tables: hasError ? { units: error, bookings: error } : undefined,
      rpcs: hasError
        ? {
            check_multi_unit_availability: error,
            generate_booking_reference: error,
            create_multi_unit_booking: error,
          }
        : undefined,
    },
  });
}
