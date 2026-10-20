import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { toneClasses, type StatusTone } from "./status-tone-classes";

export interface StatusBadgeProps {
  tone: StatusTone;
  /** The status label. Required: status never relies on colour alone. */
  children: React.ReactNode;
  /** Placement only (margin, flex position). */
  className?: string;
}

/**
 * A tinted status pill. It takes a tone, not a domain status: map statuses to tones in the
 * product layer.
 *
 * `danger` is the tinted pill for a state such as Cancelled. It is not the solid `destructive`
 * fill that irreversible action buttons use.
 *
 * @example
 * ```tsx
 * <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
 * ```
 */
export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      data-tone={tone}
      className={cn(
        "border-transparent font-medium whitespace-nowrap",
        toneClasses[tone].fill,
        className
      )}
    >
      {children}
    </Badge>
  );
}
