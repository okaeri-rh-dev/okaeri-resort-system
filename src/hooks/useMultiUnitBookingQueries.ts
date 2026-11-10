/**
 * TanStack Query Hooks for Multi-Unit Booking Operations (Phase 3)
 *
 * Provides React Query hooks for:
 * - Checking availability
 * - Creating bookings
 *
 * @module useMultiUnitBookingQueries
 */

import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import { afterWrite } from "@/lib/after-write";
import type { UnitAvailability } from "@/lib/bookings";
import { BOOKING_CREATE_WRITES, requestBooking } from "@/lib/bookings/request";
import { availabilityKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { AdminMultiUnitBookingCreate } from "@/types";

export class OfflineBookingError extends Error {
  constructor() {
    super("You're offline. The booking was not saved — reconnect and try again.");
    this.name = "OfflineBookingError";
  }
}

// ============================================
// QUERY HOOKS
// ============================================

const multiUnitAvailabilityQuery = (
  unitIds: string[],
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
) =>
  queryOptions({
    queryKey: availabilityKeys.multiUnit.units(unitIds, checkIn, checkOut, excludeBookingId),
    queryFn: async () => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Build params with units[] array format expected by the API
      const params = new URLSearchParams();
      unitIds.forEach((id) => params.append("units[]", id));
      params.append("check_in", checkIn);
      params.append("check_out", checkOut);
      if (excludeBookingId) params.append("exclude_booking_id", excludeBookingId);

      const response = await fetch(`/api/availability/multi-unit?${params}`, {
        headers: {
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
      });
      if (!response.ok) throw new Error("Availability check failed");

      const data = (await response.json()) as { data: { results: UnitAvailability[] } };
      return data.data.results;
    },
    staleTime: 300000, // 5 minutes
  });

/**
 * Check availability for multiple units; checkIn/checkOut are Manila days (YYYY-MM-DD).
 * excludeBookingId leaves that booking's own stay out, for editing it.
 */
export const useMultiUnitAvailability = (
  unitIds: string[],
  checkIn: string,
  checkOut: string,
  options: { enabled?: boolean; excludeBookingId?: string } = {}
) => {
  return useQuery({
    ...multiUnitAvailabilityQuery(unitIds, checkIn, checkOut, options.excludeBookingId),
    enabled: options.enabled !== false && unitIds.length > 0 && !!checkIn && !!checkOut,
  });
};

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Create a multi-unit booking. Fails at once when the browser is offline instead of pausing.
 */
export const useCreateMultiUnitBooking = () =>
  useMutation({
    networkMode: "always",
    mutationFn: async (bookingData: AdminMultiUnitBookingCreate) => {
      if (!navigator.onLine) throw new OfflineBookingError();
      return requestBooking(bookingData);
    },
    onSettled: () => afterWrite(...BOOKING_CREATE_WRITES),
  });
