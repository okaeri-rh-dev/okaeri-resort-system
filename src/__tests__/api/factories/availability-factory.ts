/**
 * Mock Factory for Availability Endpoint
 *
 * Creates Supabase client mocks for testing multi-unit availability checks
 */

import { createMockSupabaseClient } from "../helpers/mock-supabase";
import { testUnits } from "../utils/fixtures";

export interface AvailabilityMockOptions {
  /** Unit data to return */
  units?: Array<{
    unit_id: string;
    unit_name: string;
    unit_code: string;
    unit_type: string;
  }>;

  /** Availability results - if not provided, defaults to all available */
  availabilityResults?: Array<{
    unit_id: string;
    is_available: boolean;
    conflicting_bookings: number;
    next_available_date: string | null;
  }>;

  /** Make all units available (default: true) */
  allAvailable?: boolean;

  /** Make all units unavailable */
  allUnavailable?: boolean;

  /** Simulate database error */
  hasError?: boolean;

  /** Error message to return */
  errorMessage?: string;
}

/**
 * Create mock Supabase client for availability endpoint testing
 */
export function createAvailabilityMocks(options: AvailabilityMockOptions = {}) {
  const {
    units = testUnits.map((u) => ({
      unit_id: u.unit_id,
      unit_name: u.unit_name,
      unit_code: u.unit_code,
      unit_type: u.unit_type,
    })),
    availabilityResults,
    allAvailable = true,
    allUnavailable = false,
    hasError = false,
    errorMessage = "Database connection failed",
  } = options;

  const error = hasError ? { message: errorMessage } : null;

  return createMockSupabaseClient({
    tables: {
      units,
    },
    rpcs: {
      check_multi_unit_availability: (params: Record<string, unknown>) => {
        // If custom results provided, use them
        if (availabilityResults) {
          return availabilityResults;
        }

        // Otherwise generate based on flags
        return params.p_unit_ids.map((id: string) => ({
          unit_id: id,
          is_available: allUnavailable ? false : allAvailable,
          conflicting_bookings: allUnavailable ? 1 : 0,
          next_available_date: allUnavailable ? "2025-12-25T06:00:00Z" : null,
        }));
      },
    },
    errors: {
      tables: hasError ? { units: error } : undefined,
      rpcs: hasError ? { check_multi_unit_availability: error } : undefined,
    },
  });
}
