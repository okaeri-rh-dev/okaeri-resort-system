/**
 * Real-time Subscription Hooks for Multi-Unit Bookings (Phase 3)
 *
 * Supabase real-time subscriptions for multi-unit booking changes.
 * Automatically updates the UI when bookings change in the database.
 *
 * @module useMultiUnitRealtime
 */

// Add useState import
import { useCallback, useEffect, useMemo, useRef } from "react";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";

import { availabilityKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { BookingUnit, MultiUnitBooking } from "@/types";

// ============================================
// DEBOUNCED INVALIDATION HELPER
// ============================================

/**
 * Creates a debounced query invalidator to prevent cache thrashing.
 *
 * Problem: At 50+ concurrent users, duplicate invalidations cause the cache
 * to become useless as queries are constantly refetched.
 *
 * Solution: Debounce invalidations with a configurable delay (default 300ms).
 * Multiple invalidations for the same query key within the debounce window
 * are coalesced into a single invalidation.
 *
 * @param queryClient - TanStack Query client
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 */
function createDebouncedInvalidator(
  queryClient: QueryClient,
  debounceMs: number = 300
): (queryKey: QueryKey) => void {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  return (queryKey: QueryKey) => {
    const key = JSON.stringify(queryKey);

    // Clear any existing pending invalidation for this key
    const existingTimeout = pending.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new debounced invalidation
    pending.set(
      key,
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
        pending.delete(key);
      }, debounceMs)
    );
  };
}

// ============================================
// TYPES
// ============================================

export interface RealtimeSubscriptionOptions {
  enabled?: boolean;
  onInsert?: (payload: RealtimePostgresChangesPayload<MultiUnitBooking | BookingUnit>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<MultiUnitBooking | BookingUnit>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<MultiUnitBooking | BookingUnit>) => void;
  onError?: (error: Error) => void;
}

// ============================================
// AVAILABILITY SUBSCRIPTION
// ============================================

/**
 * Subscribe to availability changes affecting multi-unit bookings
 *
 * Monitors both bookings and blackout periods.
 * Uses debounced invalidation to prevent cache thrashing at high concurrency.
 */
export function useMultiUnitAvailabilitySubscription(options: RealtimeSubscriptionOptions = {}) {
  const { enabled = true, onError } = options;
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Create debounced invalidator to prevent cache thrashing
  const invalidateDebounced = useMemo(
    () => createDebouncedInvalidator(queryClient, 300),
    [queryClient]
  );

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("multi-unit-availability")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "multi_unit_bookings",
        },
        () => {
          // OPTIMIZED: Use debounced invalidation
          invalidateDebounced(availabilityKeys.multiUnit.all);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availability_blackouts",
        },
        () => {
          // OPTIMIZED: Use debounced invalidation
          invalidateDebounced(availabilityKeys.multiUnit.all);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const error = new Error("Availability subscription error");
          onError?.(error);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, onError, queryClient, invalidateDebounced]);

  return {
    unsubscribe: useCallback(() => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }, []),
  };
}
