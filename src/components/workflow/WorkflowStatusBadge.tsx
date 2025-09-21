/**
 * SIMPLIFIED FOR PHASE 2: Basic Status Badge Component
 *
 * Phase 3-4 will re-enable:
 * - Interactive workflow controls
 * - Transition animations
 * - Workflow predictions
 * - Requirements validation
 *
 * For now, this provides a simple status display badge.
 */

import { Badge } from "@/components/ui/badge";
import type { Booking, BookingStatus } from "@/types";

interface WorkflowStatusBadgeProps {
  booking: Booking;
  variant?: "default" | "compact";
  className?: string;
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  CheckedIn: "bg-green-100 text-green-800 border-green-200",
  CheckedOut: "bg-gray-100 text-gray-800 border-gray-200",
  Cancelled: "bg-red-100 text-red-800 border-red-200",
};

export function WorkflowStatusBadge({
  booking,
  variant = "default",
  className = "",
}: WorkflowStatusBadgeProps) {
  const status = booking.booking_status as BookingStatus;
  const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-800";

  if (variant === "compact") {
    return <Badge className={`${style} ${className}`}>{status}</Badge>;
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Badge className={style}>{status}</Badge>
      {booking.payment_status && (
        <Badge variant="outline" className="text-xs">
          {booking.payment_status}
        </Badge>
      )}
    </div>
  );
}
