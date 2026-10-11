/**
 * TanStack Query Hooks for Multi-Unit Booking Operations (Phase 3)
 *
 * Provides React Query hooks for:
 * - Fetching multi-unit bookings
 * - Checking availability
 * - Creating/updating bookings with optimistic updates
 * - Adding/removing units from bookings
 *
 * @module useMultiUnitBookingQueries
 */

import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestBooking } from "@/lib/bookings/request";
import { afterBookingCreate } from "@/lib/query-invalidation";
import { availabilityKeys, multiUnitBookingKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import type { AdminMultiUnitBookingCreate, MultiUnitBooking } from "@/types";

export class OfflineBookingError extends Error {
  constructor() {
    super("You're offline. The booking was not saved — reconnect and try again.");
    this.name = "OfflineBookingError";
  }
}

// ============================================
// QUERY HOOKS
// ============================================

const multiUnitAvailabilityQuery = (unitIds: string[], checkIn: string, checkOut: string) =>
  queryOptions({
    queryKey: availabilityKeys.multiUnit.units(unitIds, checkIn, checkOut),
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

      const response = await fetch(`/api/availability/multi-unit?${params}`, {
        headers: {
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
      });
      if (!response.ok) throw new Error("Availability check failed");

      const data = (await response.json()) as { data: { results: unknown[] } };
      return data.data.results;
    },
    staleTime: 300000, // 5 minutes
  });

/**
 * Check availability for multiple units
 */
export const useMultiUnitAvailability = (
  unitIds: string[],
  checkIn: string,
  checkOut: string,
  options: { enabled?: boolean } = {}
) => {
  return useQuery({
    ...multiUnitAvailabilityQuery(unitIds, checkIn, checkOut),
    enabled: options.enabled !== false && unitIds.length > 0 && !!checkIn && !!checkOut,
  });
};

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Create multi-unit booking with optimistic updates
 */
export const useCreateMultiUnitBooking = () => {
  const queryClient = useQueryClient();
  const { addOptimisticBooking, removeOptimisticBooking, isOnline } = useMultiUnitBookingStore();

  return useMutation({
    mutationFn: async (bookingData: AdminMultiUnitBookingCreate) => {
      if (!isOnline) throw new OfflineBookingError();
      return requestBooking(bookingData);
    },
    onMutate: async (newBooking) => {
      await queryClient.cancelQueries({ queryKey: multiUnitBookingKeys.all });

      const optimisticBooking: MultiUnitBooking = {
        booking_id: `temp-${Date.now()}`,
        booking_reference: `BK-${Date.now()}`,
        ...newBooking,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown as MultiUnitBooking;

      addOptimisticBooking(optimisticBooking);

      return { optimisticBooking };
    },
    onError: (_err, _variables, context) => {
      if (context?.optimisticBooking) {
        removeOptimisticBooking(context.optimisticBooking.booking_id);
      }
    },
    onSuccess: (_data, _variables, context) => {
      if (context?.optimisticBooking) {
        removeOptimisticBooking(context.optimisticBooking.booking_id);
      }
    },
    onSettled: () => {
      afterBookingCreate();
    },
  });
};
