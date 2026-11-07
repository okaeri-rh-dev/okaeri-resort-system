/**
 * Real-time subscription to availability blocks: refreshes availability reads when a block changes.
 *
 * @module useMultiUnitRealtime
 */

import { useCallback, useEffect, useRef } from "react";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

import { afterWrite } from "@/lib/after-write";
import { supabase } from "@/lib/supabase";
import type { BookingUnit, MultiUnitBooking } from "@/types";

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
 * Subscribe to blackout changes affecting multi-unit bookings, so a block made
 * elsewhere shows up in an open form.
 */
export function useMultiUnitAvailabilitySubscription(options: RealtimeSubscriptionOptions = {}) {
  const { enabled = true, onError } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("multi-unit-availability")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "availability_blackouts",
        },
        () => afterWrite("availability_blackouts")
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
  }, [enabled, onError]);

  return {
    unsubscribe: useCallback(() => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }, []),
  };
}
