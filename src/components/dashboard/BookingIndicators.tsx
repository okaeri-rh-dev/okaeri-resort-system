import React from "react";

import { getBookingStatusColor, getBookingStatusPriority } from "@/hooks/useCalendarBookings";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

interface BookingIndicatorsProps {
  bookings: Booking[];
  maxVisible?: number;
  className?: string;
}

export const BookingIndicators = React.memo(function BookingIndicators({
  bookings,
  maxVisible = 2,
  className,
}: BookingIndicatorsProps) {
  if (!bookings || bookings.length === 0) {
    return null;
  }

  // Remove duplicates (same booking appearing multiple times for multi-day stays)
  const uniqueBookings = Array.from(new Map(bookings.map((b) => [b.booking_id, b])).values());

  // Sort bookings by priority
  const sortedBookings = uniqueBookings.sort(
    (a, b) =>
      getBookingStatusPriority(a.booking_status ?? "Pending") -
      getBookingStatusPriority(b.booking_status ?? "Pending")
  );

  const visibleBookings = sortedBookings.slice(0, maxVisible);
  const remainingCount = uniqueBookings.length - maxVisible;

  return (
    <div className={cn("flex w-full flex-row gap-0.5", className)}>
      {visibleBookings.map((booking) => (
        <div
          key={booking.booking_id}
          className={cn(
            "inline-flex items-center rounded-sm border px-1 py-0.5 text-[9px] font-semibold sm:text-[10px]",
            "max-w-full truncate font-mono tracking-tight",
            getBookingStatusColor(booking.booking_status ?? "Pending")
          )}
        >
          {booking.booking_units?.[0]?.unit?.unit_code ||
            booking.booking_units?.[0]?.unit?.unit_name?.slice(0, 3) ||
            "—"}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="inline-flex items-center rounded-sm border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[9px] font-medium text-neutral-600 sm:text-[10px]">
          +{remainingCount}
        </div>
      )}
    </div>
  );
});

// Compact indicator for calendar cell corner
export const BookingCountBadge = React.memo(function BookingCountBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        "absolute top-0.5 right-0.5 flex size-4 items-center justify-center",
        "rounded-full bg-blue-600 text-[9px] font-bold text-white",
        "shadow-sm",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </div>
  );
});
