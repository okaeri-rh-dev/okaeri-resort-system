import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MobileCardProps {
  children: ReactNode;
  /** Placement only. */
  className?: string;
}

/**
 * The card form of a table row on narrow panes. Fill it with `MobileCardRow`s.
 *
 * @example
 * ```tsx
 * <MobileCard>
 *   <MobileCardRow label="Booking" value={booking.booking_reference} />
 * </MobileCard>
 * ```
 */
export function MobileCard({ children, className }: MobileCardProps) {
  return (
    <Card padding="sm" className={cn("space-y-3", className)}>
      {children}
    </Card>
  );
}
