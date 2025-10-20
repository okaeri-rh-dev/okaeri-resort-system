import { useEffect, useState } from "react";

import { debounce } from "@/utils";

/**
 * Ultra-performant responsive view detection without resize listeners
 *
 * This hook uses the MediaQueryList API which is specifically designed
 * for responsive detection and is much more efficient than resize listeners.
 *
 * Key optimizations:
 * - No continuous resize event listening
 * - Uses native matchMedia API (browser-optimized)
 * - Only triggers on actual breakpoint changes, not every pixel
 * - Debounced to prevent rapid toggling at breakpoint boundaries
 * - Single source of truth for responsive behavior
 */
export const useResponsiveView = (breakpoint: string = "768px") => {
  // Initialize with current state (no flash of wrong content)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // SSR safety
    if (typeof window === "undefined") return false;

    // Check initial state
    return !window.matchMedia(`(min-width: ${breakpoint})`).matches;
  });

  useEffect(() => {
    // Create media query list
    const mediaQuery = window.matchMedia(`(min-width: ${breakpoint})`);

    // Handler only fires when crossing the breakpoint
    const handleBreakpointChange = debounce((e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
    }, 300); // Debounce to prevent rapid toggling

    // Modern API - much more efficient than resize listeners
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleBreakpointChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleBreakpointChange);
    }

    // Set initial state in case it changed during SSR
    setIsMobile(!mediaQuery.matches);

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleBreakpointChange);
      } else {
        mediaQuery.removeListener(handleBreakpointChange);
      }
    };
  }, [breakpoint]);

  return {
    isMobile,
    isDesktop: !isMobile,
    // For components that need specific breakpoints
    isTablet:
      typeof window !== "undefined"
        ? window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches
        : false,
  };
};

/**
 * CSS-first alternative: Use data attributes for styling
 * This sets a data attribute that CSS can use for responsive styling
 * without any JavaScript-based conditional rendering
 */
export const useResponsiveDataAttribute = (ref: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!ref.current) return;

    const updateDataAttribute = () => {
      if (!ref.current) return;

      const width = window.innerWidth;

      if (width < 640) {
        ref.current.dataset.viewport = "mobile";
      } else if (width < 1024) {
        ref.current.dataset.viewport = "tablet";
      } else {
        ref.current.dataset.viewport = "desktop";
      }
    };

    // Set initial value
    updateDataAttribute();

    // Use matchMedia for breakpoint detection instead of resize
    const breakpoints = [
      window.matchMedia("(max-width: 639px)"),
      window.matchMedia("(min-width: 640px) and (max-width: 1023px)"),
      window.matchMedia("(min-width: 1024px)"),
    ];

    const handleChange = debounce(updateDataAttribute, 300);

    breakpoints.forEach((mq) => {
      if (mq.addEventListener) {
        mq.addEventListener("change", handleChange);
      } else {
        mq.addListener(handleChange);
      }
    });

    return () => {
      breakpoints.forEach((mq) => {
        if (mq.removeEventListener) {
          mq.removeEventListener("change", handleChange);
        } else {
          mq.removeListener(handleChange);
        }
      });
    };
  }, [ref]);
};

/**
 * Performance monitoring utility
 * Tracks how often responsive changes occur
 */
export const useResponsivePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    changes: 0,
    lastChange: null as Date | null,
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const handleChange = () => {
      setMetrics((prev) => ({
        changes: prev.changes + 1,
        lastChange: new Date(),
      }));

      // Log to console in development
      if (process.env.NODE_ENV === "development") {
        console.log("[ResponsiveView] Breakpoint crossed", {
          timestamp: new Date().toISOString(),
          isMobile: !mediaQuery.matches,
        });
      }
    };

    mediaQuery.addEventListener?.("change", handleChange);

    return () => {
      mediaQuery.removeEventListener?.("change", handleChange);
    };
  }, []);

  return metrics;
};
