import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ListCardProps {
  children: ReactNode;
  /** Placement only. */
  className?: string;
}

/**
 * The card form of a table row on narrow panes. Fill it with `ListCardRow`s.
 *
 * @example
 * ```tsx
 * <ListCard>
 *   <ListCardRow label="Booking" value={booking.booking_reference} />
 * </ListCard>
 * ```
 */
export function ListCard({ children, className }: ListCardProps) {
  return (
    <Card padding="sm" className={cn("space-y-3", className)}>
      {children}
    </Card>
  );
}
