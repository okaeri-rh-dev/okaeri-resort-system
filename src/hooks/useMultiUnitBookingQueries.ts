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

import { supabase } from "@/lib/supabase";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import type {
  BookingUnit,
  MultiUnitBooking,
  MultiUnitBookingApiResponse,
  MultiUnitBookingsApiResponse,
  MultiUnitPricingApiResponse,
} from "@/types";

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Fetch multi-unit bookings with optimistic updates merged
 */
export const useMultiUnitBookings = (filters?: Record<string, unknown>) => {
  const optimisticQueue = useMultiUnitBookingStore((state) => state.optimisticQueue);

  return useQuery({
    queryKey: ["multi-unit-bookings", filters],
    queryFn: async () => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/bookings/multi-unit", {
        headers: {
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
      });
      if (!response.ok) throw new Error("Failed to fetch bookings");

      const data = (await response.json()) as MultiUnitBookingsApiResponse;

      // Merge optimistic updates
      const mergedBookings = data.data.map((booking) => {
        const optimistic = optimisticQueue.get(booking.booking_id);
        return optimistic ? { ...booking, ...optimistic.booking } : booking;
      });

      return mergedBookings;
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
};

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
    mutationFn: async (bookingData: Partial<MultiUnitBooking>) => {
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
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
    },
  });
};

/**
 * Add unit to existing booking
 */
export const useAddUnitToBooking = (bookingId: string) => {
  const queryClient = useQueryClient();
  const { updateOptimisticBooking } = useMultiUnitBookingStore();

  return useMutation({
    mutationFn: async (unitData: Partial<BookingUnit>) => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/bookings/${bookingId}/units/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify(unitData),
      });

      if (!response.ok) throw new Error("Failed to add unit");

      const data = (await response.json()) as MultiUnitBookingApiResponse;
      return data.data;
    },
    onMutate: async (newUnit) => {
      await queryClient.cancelQueries({ queryKey: ["multi-unit-bookings", bookingId] });

      const previousBooking = queryClient.getQueryData<MultiUnitBooking>([
        "multi-unit-bookings",
        bookingId,
      ]);

      if (previousBooking) {
        const updatedBooking: MultiUnitBooking = {
          ...previousBooking,
          booking_units: [...previousBooking.booking_units, newUnit as BookingUnit],
          unit_count: previousBooking.unit_count + 1,
        };

        updateOptimisticBooking(bookingId, updatedBooking);
      }

      return { previousBooking };
    },
    onError: (_err, _newUnit, context) => {
      if (context?.previousBooking) {
        updateOptimisticBooking(bookingId, context.previousBooking);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
    },
  });
};

/**
 * Remove unit from booking
 */
export const useRemoveUnitFromBooking = (bookingId: string) => {
  const queryClient = useQueryClient();
  const { updateOptimisticBooking } = useMultiUnitBookingStore();

  return useMutation({
    mutationFn: async (unitId: string) => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/bookings/${bookingId}/units/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify({ unit_id: unitId }),
      });

      if (!response.ok) throw new Error("Failed to remove unit");

      const data = (await response.json()) as MultiUnitBookingApiResponse;
      return data.data;
    },
    onMutate: async (unitId) => {
      await queryClient.cancelQueries({ queryKey: ["multi-unit-bookings", bookingId] });

      const previousBooking = queryClient.getQueryData<MultiUnitBooking>([
        "multi-unit-bookings",
        bookingId,
      ]);

      if (previousBooking) {
        const updatedBooking: MultiUnitBooking = {
          ...previousBooking,
          booking_units: previousBooking.booking_units.filter((u) => u.unit_id !== unitId),
          unit_count: previousBooking.unit_count - 1,
        };

        updateOptimisticBooking(bookingId, updatedBooking);
      }

      return { previousBooking };
    },
    onError: (_err, _unitId, context) => {
      if (context?.previousBooking) {
        updateOptimisticBooking(bookingId, context.previousBooking);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
    },
  });
};

/**
 * Update multi-unit booking
 */
export const useUpdateMultiUnitBooking = (bookingId: string) => {
  const queryClient = useQueryClient();
  const { updateOptimisticBooking } = useMultiUnitBookingStore();

  return useMutation({
    mutationFn: async (updates: Partial<MultiUnitBooking>) => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/bookings/multi-unit/${bookingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error("Failed to update booking");

      const data = (await response.json()) as MultiUnitBookingApiResponse;
      return data.data;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["multi-unit-bookings", bookingId] });

      const previousBooking = queryClient.getQueryData<MultiUnitBooking>([
        "multi-unit-bookings",
        bookingId,
      ]);

      updateOptimisticBooking(bookingId, updates);

      return { previousBooking };
    },
    onError: (_err, _updates, context) => {
      if (context?.previousBooking) {
        updateOptimisticBooking(bookingId, context.previousBooking);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings", bookingId] });
    },
  });
};

/**
 * Delete multi-unit booking
 */
export const useDeleteMultiUnitBooking = () => {
  const queryClient = useQueryClient();
  const { removeOptimisticBooking } = useMultiUnitBookingStore();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/bookings/multi-unit/${bookingId}`, {
        method: "DELETE",
        headers: {
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
      });

      if (!response.ok) throw new Error("Failed to delete booking");

      return { bookingId };
    },
    onMutate: async (bookingId) => {
      await queryClient.cancelQueries({ queryKey: ["multi-unit-bookings"] });
      removeOptimisticBooking(bookingId);

      return { bookingId };
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings"] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
    },
  });
};

/**
 * Record payment for multi-unit booking
 */
export const useRecordMultiUnitPayment = (bookingId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentData: {
      amount: number;
      payment_method: string;
      proof_url?: string;
      notes?: string;
    }) => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/bookings/${bookingId}/payments/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) throw new Error("Failed to record payment");

      const data = (await response.json()) as { data: unknown };
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
};

/**
 * Process refund for multi-unit booking
 */
export const useRefundMultiUnitPayment = (bookingId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (refundData: { amount: number; reason: string; notes?: string }) => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/bookings/${bookingId}/payments/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify(refundData),
      });

      if (!response.ok) throw new Error("Failed to process refund");

      const data = (await response.json()) as { data: unknown };
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
};
