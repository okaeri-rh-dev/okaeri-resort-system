/**
 * Real-time Subscription Hooks for Multi-Unit Bookings (Phase 3)
 *
 * Supabase real-time subscriptions for multi-unit booking changes.
 * Automatically updates the UI when bookings change in the database.
 *
 * @module useMultiUnitRealtime
 */

// Add useState import
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
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

export interface RealtimeSubscriptionStatus {
  isSubscribed: boolean;
  channelStatus: REALTIME_SUBSCRIBE_STATES;
  error: Error | null;
}

// ============================================
// MULTI-UNIT BOOKING SUBSCRIPTION
// ============================================

/**
 * Subscribe to multi-unit booking changes in real-time
 *
 * Automatically invalidates TanStack Query cache when changes occur
 */
export function useMultiUnitBookingSubscription(
  bookingId?: string,
  options: RealtimeSubscriptionOptions = {}
) {
  const { enabled = true, onInsert, onUpdate, onDelete, onError } = options;
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<RealtimeSubscriptionStatus>({
    isSubscribed: false,
    channelStatus: "CLOSED" as REALTIME_SUBSCRIBE_STATES,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    // Create unique channel name
    const channelName = bookingId ? `multi-unit-booking-${bookingId}` : "multi-unit-bookings-all";

    // Subscribe to changes
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "multi_unit_bookings",
          ...(bookingId && { filter: `booking_id=eq.${bookingId}` }),
        },
        (payload: RealtimePostgresChangesPayload<MultiUnitBooking>) => {
          try {
            // Handle different event types
            switch (payload.eventType) {
              case "INSERT":
                onInsert?.(payload);
                queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings"] });
                break;

              case "UPDATE":
                onUpdate?.(payload);
                queryClient.invalidateQueries({
                  queryKey: ["multi-unit-bookings", payload.new.booking_id],
                });
                queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings"] });
                break;

              case "DELETE":
                onDelete?.(payload);
                queryClient.invalidateQueries({ queryKey: ["multi-unit-bookings"] });
                break;
            }
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            statusRef.current.error = err;
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        statusRef.current.channelStatus = status as REALTIME_SUBSCRIBE_STATES;
        statusRef.current.isSubscribed = status === "SUBSCRIBED";

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const error = new Error(`Subscription error for channel: ${channelName}`);
          statusRef.current.error = error;
          onError?.(error);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        statusRef.current = {
          isSubscribed: false,
          channelStatus: "CLOSED" as REALTIME_SUBSCRIBE_STATES,
          error: null,
        };
      }
    };
  }, [enabled, bookingId, onInsert, onUpdate, onDelete, onError, queryClient]);

  return {
    isSubscribed: statusRef.current.isSubscribed,
    channelStatus: statusRef.current.channelStatus,
    error: statusRef.current.error,
    unsubscribe: useCallback(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }, []),
  };
}

// ============================================
// BOOKING UNITS SUBSCRIPTION
// ============================================

/**
 * Subscribe to booking units changes in real-time
 *
 * Monitors changes to individual units within a booking
 */
export function useBookingUnitsSubscription(
  bookingId?: string,
  options: RealtimeSubscriptionOptions = {}
) {
  const { enabled = true, onInsert, onUpdate, onDelete, onError } = options;
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<RealtimeSubscriptionStatus>({
    isSubscribed: false,
    channelStatus: "CLOSED" as REALTIME_SUBSCRIBE_STATES,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const channelName = bookingId ? `booking-units-${bookingId}` : "booking-units-all";

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_units",
          ...(bookingId && { filter: `booking_id=eq.${bookingId}` }),
        },
        (payload: RealtimePostgresChangesPayload<BookingUnit>) => {
          try {
            switch (payload.eventType) {
              case "INSERT":
                onInsert?.(payload);
                queryClient.invalidateQueries({
                  queryKey: ["multi-unit-bookings", bookingId],
                });
                queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
                break;

              case "UPDATE":
                onUpdate?.(payload);
                queryClient.invalidateQueries({
                  queryKey: ["multi-unit-bookings", bookingId],
                });
                break;

              case "DELETE":
                onDelete?.(payload);
                queryClient.invalidateQueries({
                  queryKey: ["multi-unit-bookings", bookingId],
                });
                queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
                break;
            }
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            statusRef.current.error = err;
            onError?.(err);
          }
        }
      )
      .subscribe((status) => {
        statusRef.current.channelStatus = status as REALTIME_SUBSCRIBE_STATES;
        statusRef.current.isSubscribed = status === "SUBSCRIBED";

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const error = new Error(`Subscription error for channel: ${channelName}`);
          statusRef.current.error = error;
          onError?.(error);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        statusRef.current = {
          isSubscribed: false,
          channelStatus: "CLOSED" as REALTIME_SUBSCRIBE_STATES,
          error: null,
        };
      }
    };
  }, [enabled, bookingId, onInsert, onUpdate, onDelete, onError, queryClient]);

  return {
    isSubscribed: statusRef.current.isSubscribed,
    channelStatus: statusRef.current.channelStatus,
    error: statusRef.current.error,
    unsubscribe: useCallback(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }, []),
  };
}

// ============================================
// COMBINED REALTIME SUBSCRIPTION
// ============================================

/**
 * Combined subscription for both bookings and units
 *
 * Provides a single hook to monitor all multi-unit booking changes
 */
export function useMultiUnitRealtimeSubscription(
  bookingId?: string,
  options: RealtimeSubscriptionOptions = {}
) {
  const bookingSubscription = useMultiUnitBookingSubscription(bookingId, options);
  const unitsSubscription = useBookingUnitsSubscription(bookingId, options);

  return {
    bookings: bookingSubscription,
    units: unitsSubscription,
    isSubscribed: bookingSubscription.isSubscribed && unitsSubscription.isSubscribed,
    hasError: !!bookingSubscription.error || !!unitsSubscription.error,
    errors: {
      bookings: bookingSubscription.error,
      units: unitsSubscription.error,
    },
    unsubscribeAll: useCallback(() => {
      bookingSubscription.unsubscribe();
      unitsSubscription.unsubscribe();
    }, [bookingSubscription, unitsSubscription]),
  };
}

// ============================================
// AVAILABILITY SUBSCRIPTION
// ============================================

/**
 * Subscribe to availability changes affecting multi-unit bookings
 *
 * Monitors both bookings and blackout periods
 */
export function useMultiUnitAvailabilitySubscription(options: RealtimeSubscriptionOptions = {}) {
  const { enabled = true, onError } = options;
  const queryClient = useQueryClient();
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
          table: "multi_unit_bookings",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
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
          queryClient.invalidateQueries({ queryKey: ["multi-unit-availability"] });
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
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, onError, queryClient]);

  return {
    unsubscribe: useCallback(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }, []),
  };
}

// ============================================
// STORE-INTEGRATED SUBSCRIPTION
// ============================================

/**
 * Real-time subscription integrated with Zustand store
 *
 * Automatically updates store state on real-time changes
 */
export function useMultiUnitStoreSync(bookingId?: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const { syncFromRealtime, clearOptimisticEntry } = useMultiUnitBookingStore();

  const subscription = useMultiUnitRealtimeSubscription(bookingId, {
    enabled,
    onInsert: (payload) => {
      if (payload.new && "booking_id" in payload.new) {
        syncFromRealtime(payload.new as MultiUnitBooking);
      }
    },
    onUpdate: (payload) => {
      if (payload.new && "booking_id" in payload.new) {
        syncFromRealtime(payload.new as MultiUnitBooking);
        // Clear optimistic entry if it exists
        clearOptimisticEntry((payload.new as MultiUnitBooking).booking_id);
      }
    },
    onDelete: (payload) => {
      if (payload.old && "booking_id" in payload.old) {
        clearOptimisticEntry((payload.old as Partial<MultiUnitBooking>).booking_id!);
      }
    },
    onError: (error) => {
      console.error("[Realtime] Subscription error:", error);
    },
  });

  return subscription;
}

// ============================================
// PRESENCE SUBSCRIPTION
// ============================================

/**
 * Track which users are currently viewing/editing a booking
 *
 * Uses Supabase presence to show collaborative editing status
 */
export function useMultiUnitPresence(bookingId: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presenceState, setPresenceState] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!enabled || !bookingId) return;

    const channel = supabase.channel(`presence:booking-${bookingId}`, {
      config: { presence: { key: bookingId } },
    });

    // Track presence
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPresenceState(state);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        logger.info("[Presence] User joined:", { presence: newPresences });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        logger.info("[Presence] User left:", { presence: leftPresences });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track current user's presence
          await channel.track({
            user: "current_user", // Replace with actual user from auth
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, bookingId]);

  return {
    presenceState,
    activeUsers: Object.keys(presenceState).length,
    untrack: useCallback(async () => {
      if (channelRef.current) {
        await channelRef.current.untrack();
      }
    }, []),
  };
}

// ============================================
// BROADCAST SUBSCRIPTION
// ============================================

/**
 * Broadcast booking changes to other connected clients
 *
 * Use for collaborative editing features
 */
export function useMultiUnitBroadcast(bookingId: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [broadcasts, setBroadcasts] = useState<unknown[]>([]);

  useEffect(() => {
    if (!enabled || !bookingId) return;

    const channel = supabase
      .channel(`broadcast:booking-${bookingId}`)
      .on("broadcast", { event: "unit-change" }, (payload) => {
        setBroadcasts((prev) => [...prev, payload]);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, bookingId]);

  const broadcast = useCallback(async (event: string, payload: unknown) => {
    if (channelRef.current) {
      await channelRef.current.send({
        type: "broadcast",
        event,
        payload,
      });
    }
  }, []);

  return {
    broadcasts,
    broadcast,
    clearBroadcasts: useCallback(() => setBroadcasts([]), []),
  };
}
