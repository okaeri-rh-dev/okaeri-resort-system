/**
 * Booking Real-Time Hook (Phase 4.5)
 *
 * Simple wrapper around useMultiUnitBookingSubscription for booking detail pages.
 * Automatically invalidates TanStack Query cache when booking changes.
 *
 * @module useBookingRealtime
 */

import {
  useMultiUnitBookingSubscription,
  type RealtimeSubscriptionOptions,
} from "./useMultiUnitRealtime";

/**
 * Subscribe to real-time updates for a specific booking
 *
 * Automatically invalidates TanStack Query cache when the booking is updated.
 * Use this in booking detail pages to show live updates.
 *
 * @param bookingId - Booking ID to monitor (optional)
 * @param options - Subscription options
 * @returns Subscription status and controls
 *
 * @example
 * // In booking detail page
 * function BookingDetailPage() {
 *   const { bookingId } = useParams();
 *   const { data: booking } = useBooking(bookingId);
 *
 *   // ✅ Enable real-time updates
 *   useBookingRealtime(bookingId);
 *
 *   return <div>{booking.booking_reference}</div>;
 * }
 *
 * @example
 * // With custom callbacks
 * useBookingRealtime(bookingId, {
 *   onUpdate: (payload) => {
 *     toast.info('Booking updated');
 *   },
 *   onError: (error) => {
 *     console.error('Realtime error:', error);
 *   },
 * });
 */
export function useBookingRealtime(
  bookingId?: string,
  options?: Omit<RealtimeSubscriptionOptions, "enabled">
) {
  return useMultiUnitBookingSubscription(bookingId, {
    ...options,
    enabled: !!bookingId, // Only enable if bookingId exists
  });
}
