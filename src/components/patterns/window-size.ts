import { createContext, useSyncExternalStore } from "react";

/** Below `medium` (600px): the M3 compact window size class. */
const COMPACT_QUERY = "(max-width: 599.98px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The shell's one window query. Private to the kit: `AppShell` provides it, and only overlays
 * whose form follows the window (the date picker's bottom sheet) read it.
 */
export function useCompactWindowQuery(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false
  );
}

/** True inside an `AppShell` on a compact window. False outside any shell. */
export const CompactWindowContext = createContext(false);
