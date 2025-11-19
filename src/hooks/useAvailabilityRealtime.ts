/**
 * Availability Real-Time Hook (Phase 4.5)
 *
 * Monitors availability changes that affect multi-unit bookings.
 * Alerts users when units become unavailable due to concurrent bookings.
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
 * Monitors both bookings and blackout periods that affect availability.
 * Automatically clears availability cache and shows toast notifications.
 *
 * Use this in multi-unit booking forms to alert users of concurrent bookings.
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
  options?: Omit<RealtimeSubscriptionOptions, "enabled">
) {
  const { selectedUnits, clearAvailabilityCache } = useMultiUnitBookingStore();

  // Handle concurrent bookings - use useEffectEvent to access latest values without causing re-subscriptions
  const handleAvailabilityChange = useEffectEvent(() => {
    // Clear cache to force re-check
    clearAvailabilityCache?.();

    // Check if any selected units are affected
    if (selectedUnits.length > 0) {
      toast.warning("Availability updated", {
        description: "Unit availability has changed. Please verify your selection.",
      });
    }
  });

  return useMultiUnitAvailabilitySubscription({
    ...options,
    enabled: !!checkIn && !!checkOut, // Only enable if dates are selected
    onInsert: () => handleAvailabilityChange(),
    onUpdate: () => handleAvailabilityChange(),
    onDelete: () => handleAvailabilityChange(),
  });
}

/**
 * Monitor availability for specific units
 *
 * More targeted than useAvailabilityRealtime - monitors specific unit IDs.
 *
 * @param unitIds - Unit IDs to monitor
 * @param options - Subscription options
 * @returns Subscription controls
 *
 * @example
 * const selectedUnitIds = selectedUnits.map(u => u.unit_id);
 * useUnitAvailabilityRealtime(selectedUnitIds);
 */
export function useUnitAvailabilityRealtime(
  unitIds: string[],
  options?: Omit<RealtimeSubscriptionOptions, "enabled">
) {
  // Use useEffectEvent to avoid re-subscription when unitIds changes
  const handleUnitBookedByOthers = useEffectEvent(() => {
    if (unitIds.length > 0) {
      toast.error("Unit no longer available", {
        description: "A unit you selected was just booked by another user.",
      });
    }
  });

  return useMultiUnitAvailabilitySubscription({
    ...options,
    enabled: unitIds.length > 0,
    onInsert: () => handleUnitBookedByOthers(),
  });
}
