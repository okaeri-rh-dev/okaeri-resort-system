/**
 * useRAF (requestAnimationFrame) Hook
 *
 * Provides smooth 60fps animations and transitions by scheduling callbacks
 * using requestAnimationFrame. Ensures animations are synchronized with
 * the browser's refresh rate and automatically handles cleanup.
 *
 * Used for performance-critical animations in the calendar navigation
 * to provide buttery-smooth transitions without blocking the main thread.
 */

import { useEffect, useRef, useCallback } from "react";

interface UseRAFOptions {
  enabled?: boolean;
  immediate?: boolean;
}

export const useRAF = (
  callback: (timestamp: number) => void | boolean, // Return false to stop
  deps: React.DependencyList,
  options: UseRAFOptions = {}
) => {
  const { enabled = true, immediate = false } = options;
  const rafRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);
  const isRunningRef = useRef(false);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    if (!enabled || isRunningRef.current) return;

    isRunningRef.current = true;

    const animate = (timestamp: number) => {
      if (!isRunningRef.current) return;

      const shouldContinue = callbackRef.current(timestamp);

      if (shouldContinue !== false) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        isRunningRef.current = false;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [enabled]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Auto-start if immediate is true
  useEffect(() => {
    if (immediate) {
      start();
    }
    return stop;
  }, [...deps, immediate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return stop;
  }, [stop]);

  return { start, stop, isRunning: isRunningRef.current };
};

// Convenience hook for one-time animations
export const useRAFTimeout = (
  callback: () => void,
  delay: number,
  deps: React.DependencyList = []
) => {
  const startTime = useRef<number | null>(null);

  const rafCallback = useCallback(
    (timestamp: number) => {
      if (startTime.current === null) {
        startTime.current = timestamp;
      }

      const elapsed = timestamp - startTime.current;

      if (elapsed >= delay) {
        callback();
        startTime.current = null;
        return false; // Stop animation
      }

      return true; // Continue animation
    },
    [callback, delay]
  );

  return useRAF(rafCallback, deps, { immediate: false });
};

// Hook for smooth value interpolation
export const useRAFInterpolation = (
  from: number,
  to: number,
  duration: number,
  easing: (t: number) => number = (t) => t, // Linear by default
  deps: React.DependencyList = []
) => {
  const startTime = useRef<number | null>(null);
  const currentValue = useRef(from);
  const onUpdate = useRef<((value: number) => void) | null>(null);

  const rafCallback = useCallback(
    (timestamp: number) => {
      if (startTime.current === null) {
        startTime.current = timestamp;
      }

      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      currentValue.current = from + (to - from) * easedProgress;

      if (onUpdate.current) {
        onUpdate.current(currentValue.current);
      }

      if (progress >= 1) {
        startTime.current = null;
        return false; // Stop animation
      }

      return true; // Continue animation
    },
    [from, to, duration, easing]
  );

  const raf = useRAF(rafCallback, deps, { immediate: false });

  const animate = useCallback(
    (updateCallback: (value: number) => void) => {
      onUpdate.current = updateCallback;
      startTime.current = null;
      raf.start();
    },
    [raf]
  );

  return {
    animate,
    stop: raf.stop,
    currentValue: currentValue.current,
    isRunning: raf.isRunning,
  };
};

export default useRAF;
