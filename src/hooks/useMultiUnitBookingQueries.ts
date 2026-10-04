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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { afterBookingCreate } from "@/lib/query-invalidation";
import { supabase } from "@/lib/supabase";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import type {
  AdminMultiUnitBookingCreate,
  MultiUnitBooking,
  MultiUnitBookingApiResponse,
  MultiUnitPricingApiResponse,
} from "@/types";

// ============================================
// QUERY HOOKS
// ============================================

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
    queryKey: ["multi-unit-availability", unitIds, checkIn, checkOut],
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
    enabled: options.enabled !== false && unitIds.length > 0 && !!checkIn && !!checkOut,
    staleTime: 300000, // 5 minutes
  });
};

/**
 * Get pricing quote for multiple units
 */
export const useMultiUnitPricingQuote = (
  units: Array<{ unit_id: string; guests: number }>,
  checkIn: string,
  checkOut: string,
  options: { enabled?: boolean } = {}
) => {
  return useQuery({
    queryKey: ["multi-unit-pricing", units, checkIn, checkOut],
    queryFn: async () => {
      const response = await fetch("/api/pricing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          units,
          check_in: checkIn,
          check_out: checkOut,
        }),
      });

      if (!response.ok) throw new Error("Failed to get pricing quote");

      const data = (await response.json()) as MultiUnitPricingApiResponse;
      return data.data;
    },
    enabled: options.enabled !== false && units.length > 0 && !!checkIn && !!checkOut,
    staleTime: 300000, // 5 minutes (matches server cache)
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
  const { addOptimisticBooking, removeOptimisticBooking, addToOfflineQueue, isOnline } =
    useMultiUnitBookingStore();

  return useMutation({
    mutationFn: async (bookingData: Partial<MultiUnitBooking> | AdminMultiUnitBookingCreate) => {
      if (!isOnline) {
        addToOfflineQueue({ operation: "create", data: bookingData, maxRetries: 3 });
        return bookingData;
      }

      const idempotencyKey = crypto.randomUUID();

      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/bookings/multi-unit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) throw new Error("Failed to create booking");

      const data = (await response.json()) as MultiUnitBookingApiResponse;
      return data.data;
    },
    onMutate: async (newBooking) => {
      await queryClient.cancelQueries({ queryKey: ["multi-unit-bookings"] });

      const optimisticBooking: MultiUnitBooking = {
        booking_id: `temp-${Date.now()}`,
        booking_reference: `BK-${Date.now()}`,
        ...newBooking,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as MultiUnitBooking;

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
