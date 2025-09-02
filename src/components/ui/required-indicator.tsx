import * as React from "react";
import { cn } from "@/lib/utils";

export interface RequiredIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Accessible label for screen readers
   * @default "required"
   */
  ariaLabel?: string;
}

/**
 * RequiredIndicator - A simple component for displaying required field asterisks
 *
 * Designed for the Professional Enterprise Design System with consistent styling
 * and proper accessibility support.
 *
 * @example
 * ```tsx
 * <label>
 *   Email <RequiredIndicator />
 * </label>
 *
 * // With custom styling
 * <RequiredIndicator className="ml-2" />
 *
 * // With custom aria label
 * <RequiredIndicator ariaLabel="this field is required" />
 * ```
 */
export const RequiredIndicator = React.forwardRef<HTMLSpanElement, RequiredIndicatorProps>(
  ({ className, ariaLabel = "required", ...props }, ref) => {
    return (
      <span ref={ref} className={cn("text-error-600", className)} aria-label={ariaLabel} {...props}>
        *
      </span>
    );
  }
);

RequiredIndicator.displayName = "RequiredIndicator";
