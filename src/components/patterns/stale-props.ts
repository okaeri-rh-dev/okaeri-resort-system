import type { ClassValue } from "clsx";

import { cn } from "@/lib/utils";

/**
 * Props for a list whose rows are a previous result while new ones load (TanStack Query's
 * `isPlaceholderData`): dims it and sets `aria-busy`. The rows stay readable; no skeleton.
 *
 * @example
 * ```tsx
 * <ul {...staleProps(isPlaceholderData, "divide-y rounded-lg border")}>…</ul>
 * ```
 */
export function staleProps(isStale: boolean, ...classNames: ClassValue[]) {
  return {
    "aria-busy": isStale || undefined,
    className: cn("transition-opacity duration-150", isStale && "opacity-60", ...classNames),
  };
}
