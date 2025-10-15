/**
 * Swipe Gesture Hook for Mobile Navigation
 *
 * Detects horizontal swipe gestures on touch devices to enable
 * intuitive month navigation in the availability calendar.
 *
 * Features:
 * - Swipe left: Go to next month
 * - Swipe right: Go to previous month
 * - Configurable minimum swipe distance threshold
 * - Automatic cleanup on unmount
 *
 * Usage:
 * ```typescript
 * useSwipeGesture({
 *   onSwipeLeft: goToNextMonth,
 *   onSwipeRight: goToPreviousMonth,
 *   minSwipeDistance: 50, // pixels
 * });
 * ```
 *
 * @module components/calendar/useSwipeGesture
 */

import { useEffect, useRef } from "react";

interface SwipeGestureOptions {
  /** Callback when user swipes left (next month) */
  onSwipeLeft?: () => void;
  /** Callback when user swipes right (previous month) */
  onSwipeRight?: () => void;
  /** Minimum horizontal distance (pixels) to trigger swipe */
  minSwipeDistance?: number;
}

/**
 * Hook to detect horizontal swipe gestures on touch devices
 *
 * @param options - Swipe gesture configuration
 *
 * @example
 * ```typescript
 * function Calendar() {
 *   useSwipeGesture({
 *     onSwipeLeft: () => setMonth(nextMonth),
 *     onSwipeRight: () => setMonth(previousMonth),
 *   });
 *
 *   return <div>Calendar content</div>;
 * }
 * ```
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 50,
}: SwipeGestureOptions) {
  // Store touch start and end positions
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    /**
     * Handle touch start event
     * Records initial touch X position
     */
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };

    /**
     * Handle touch move event
     * Updates current touch X position
     */
    const handleTouchMove = (e: TouchEvent) => {
      touchEndX.current = e.touches[0].clientX;
    };

    /**
     * Handle touch end event
     * Calculates swipe direction and triggers callbacks
     */
    const handleTouchEnd = () => {
      if (touchStartX.current === null || touchEndX.current === null) return;

      // Calculate horizontal distance traveled
      const distance = touchStartX.current - touchEndX.current;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      // Trigger appropriate callback
      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      }

      if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }

      // Reset touch positions
      touchStartX.current = null;
      touchEndX.current = null;
    };

    // Attach event listeners
    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, minSwipeDistance]);
}
