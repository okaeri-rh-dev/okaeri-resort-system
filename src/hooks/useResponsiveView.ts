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
export const useResponsiveView = (breakpoint: string = "1024px") => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBreakpointChange = debounce((e: any) => {
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
