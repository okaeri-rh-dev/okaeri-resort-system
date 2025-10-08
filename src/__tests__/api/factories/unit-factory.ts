/**
 * Mock Factory for Unit Management Endpoints
 *
 * Creates Supabase client mocks for testing unit add/remove operations.
 * Supports booking lookups, availability checks, and unit modifications.
 */

import { createMockSupabaseClient } from "../helpers/mock-supabase";
import { testUnits, testBookingResponse, testBookingUnits, testPayment } from "../utils/fixtures";

export interface UnitManagementMockOptions {
  /** Booking data to return */
  booking?: {
    booking_id: string;
    booking_reference?: string;
    booking_status?: string;
    check_in?: string;
    check_out?: string;
    total_amount?: number;
    guest_name?: string;
    booking_units?: Array<{
      unit_id: string;
      booking_unit_id?: string;
    }>;
  };

  /** Unit availability results */
  availabilityResults?: Array<{
    unit_id: string;
    is_available: boolean;
  }>;

  /** Make units available (default: true) */
  allAvailable?: boolean;

  /** Booking unit ID created on insert */
  createdBookingUnitId?: string;

  /** Whether booking exists (default: true) */
  bookingExists?: boolean;

  /** Whether unit exists in booking (default: false for add, true for remove) */
  unitInBooking?: boolean;

  /** Simulate database error */
  hasError?: boolean;

  /** Error message to return */
  errorMessage?: string;

  /** Include payment data (default: false for add, true for remove) */
  includePayment?: boolean;
}

/**
 * Create mock Supabase client for unit management endpoint testing
 */
export function createUnitManagementMocks(options: UnitManagementMockOptions = {}) {
  const {
    booking = {
      ...testBookingResponse,
      booking_status: "Pending",
      check_in: "2025-12-20T06:00:00Z",
      check_out: "2025-12-22T04:00:00Z",
      booking_units: testBookingUnits.map((bu) => ({
        unit_id: bu.unit_id,
        booking_unit_id: bu.booking_unit_id,
      })),
    },
    availabilityResults,
    allAvailable = true,
    createdBookingUnitId = "new-unit-id",
    bookingExists = true,
    unitInBooking = false,
    includePayment = false,
    hasError = false,
    errorMessage = "Database connection failed",
  } = options;

  const error = hasError ? { message: errorMessage } : null;

  return createMockSupabaseClient({
    tables: {
      bookings: bookingExists ? [booking] : [],
      booking_units: booking.booking_units || [],
      units: testUnits,
      payments: includePayment ? [testPayment] : [],
      payment_adjustments: [],
    },
    rpcs: {
      /**
       * Check availability for units
       */
      check_multi_unit_availability: (params: any) => {
        // If custom results provided, use them
        if (availabilityResults) {
          return availabilityResults;
        }

        // Otherwise generate based on flags
        const unitIds = params.p_unit_ids || [];
        return unitIds.map((id: string) => ({
          unit_id: id,
          is_available: allAvailable,
          conflicting_bookings: allAvailable ? 0 : 1,
          next_available_date: allAvailable ? null : "2025-12-25T06:00:00Z",
        }));
      },
    },
    errors: {
      tables: hasError ? { bookings: error, booking_units: error, units: error } : undefined,
      rpcs: hasError ? { check_multi_unit_availability: error } : undefined,
    },
  });
}

/**
 * Helper to create mock with unit already in booking (for remove tests)
 */
export function createUnitRemoveMocks(options: Partial<UnitManagementMockOptions> = {}) {
  return createUnitManagementMocks({
    includePayment: true, // Default to including payment for remove tests (refund calculation)
    ...options,
    unitInBooking: true,
    booking: {
      ...testBookingResponse,
      booking_status: "Pending",
      booking_units: [
        {
          booking_unit_id: "unit-1-id",
          booking_id: testBookingResponse.booking_id,
          unit_id: testUnits[0].unit_id,
          subtotal: 5000,
          guest_count: 2,
          nightly_rate: 2500,
        },
        {
          booking_unit_id: "unit-2-id",
          booking_id: testBookingResponse.booking_id,
          unit_id: testUnits[1].unit_id,
          subtotal: 3600,
          guest_count: 3,
          nightly_rate: 1800,
        },
      ],
      ...options.booking,
    },
  });
}

/**
 * Helper to create mock for add unit tests (unit not in booking)
 */
export function createUnitAddMocks(options: Partial<UnitManagementMockOptions> = {}) {
  return createUnitManagementMocks({
    ...options,
    unitInBooking: false,
    booking: {
      ...testBookingResponse,
      booking_status: "Pending",
      check_in: "2025-12-20T06:00:00Z",
      check_out: "2025-12-22T04:00:00Z",
      booking_units: [
        {
          unit_id: testUnits[0].unit_id,
          booking_unit_id: "existing-unit-id",
        },
      ],
      ...options.booking,
    },
  });
}
