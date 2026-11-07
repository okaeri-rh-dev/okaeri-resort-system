/**
 * Real-time subscription to availability blocks: refreshes availability reads when a block changes.
 *
 * @module useMultiUnitRealtime
 */

import { useCallback, useEffect, useEffectEvent, useRef } from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { afterWrite } from "@/lib/after-write";
import { supabase } from "@/lib/supabase";

// ============================================
// TYPES
// ============================================

export interface RealtimeSubscriptionOptions {
  enabled?: boolean;
  onChange?: () => void;
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
  const { enabled = true, onChange, onError } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);

  const handleChange = useEffectEvent(() => {
    afterWrite("availability_blackouts");
    onChange?.();
  });
  const handleError = useEffectEvent((error: Error) => onError?.(error));

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
        () => handleChange()
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          handleError(new Error("Availability subscription error"));
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);

  return {
    unsubscribe: useCallback(() => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }, []),
  };
}
