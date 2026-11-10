/**
 * Availability Real-Time Hook (Phase 4.5)
 *
 * Monitors availability changes that affect multi-unit bookings.
 * Alerts users when a block changes the availability of their selected units.
 *
 * @module useAvailabilityRealtime
 */

import { useEffectEvent } from "react";

import { toast } from "sonner";

import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";

import {
  useMultiUnitAvailabilitySubscription,
  type RealtimeSubscriptionOptions,
} from "./useMultiUnitRealtime";

/**
 * Subscribe to real-time availability changes
 *
 * Monitors availability blocks (blackout periods).
 * Shows a toast when units are selected; afterWrite refreshes the availability queries.
 *
 * Use this in multi-unit booking forms to alert users of availability changes.
 *
 * @param checkIn - Check-in date for filtering (optional)
 * @param checkOut - Check-out date for filtering (optional)
 * @param options - Subscription options
 * @returns Subscription controls
 *
 * @example
 * // In multi-unit booking form
 * function MultiUnitBookingForm() {
 *   const form = useForm();
 *
 *   // ✅ Monitor availability changes
 *   useAvailabilityRealtime(
 *     form.watch('check_in'),
 *     form.watch('check_out')
 *   );
 *
 *   return <form>...</form>;
 * }
 *
 * @example
 * // With custom alert
 * useAvailabilityRealtime(checkIn, checkOut, {
 *   onError: (error) => {
 *     console.error('Availability monitoring failed:', error);
 *   },
 * });
 */
export function useAvailabilityRealtime(
  checkIn?: string,
  checkOut?: string,
  options?: Omit<RealtimeSubscriptionOptions, "enabled" | "onChange">
) {
  const { selectedUnits } = useMultiUnitBookingStore();

  // useEffectEvent to access latest values without causing re-subscriptions
  const handleAvailabilityChange = useEffectEvent(() => {
    if (selectedUnits.length > 0) {
      toast.warning("Availability updated", {
        description: "Unit availability has changed. Please verify your selection.",
      });
    }
  });

  return useMultiUnitAvailabilitySubscription({
    ...options,
    enabled: !!checkIn && !!checkOut, // Only enable if dates are selected
    onChange: () => handleAvailabilityChange(),
  });
}
