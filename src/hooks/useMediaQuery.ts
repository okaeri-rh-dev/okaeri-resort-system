// src/hooks/useMediaQuery.ts

import { useEffect, useState } from "react";

/**
 * Hook for responsive design with media query matching
 *
 * Listens to window.matchMedia and updates on viewport changes.
 * Automatically cleans up event listeners on unmount.
 *
 * @param query - CSS media query string
 * @returns boolean indicating if the media query matches
 *
 * @example
 * ```typescript
 * // Check if mobile
 * const isMobile = useMediaQuery('(max-width: 768px)')
 *
 * // Check if desktop
 * const isDesktop = useMediaQuery('(min-width: 1024px)')
 *
 * // Conditional rendering
 * return isMobile ? <MobileLayout /> : <DesktopLayout />
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Create media query list
    const media = window.matchMedia(query);

    // Set initial state
    setMatches(media.matches);

    // Create listener for changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener (modern API)
    media.addEventListener("change", listener);

    // Cleanup on unmount
    return () => {
      media.removeEventListener("change", listener);
    };
  }, [query]);

  return matches;
}
