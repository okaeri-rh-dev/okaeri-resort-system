import { getBookingStatusColor, getBookingStatusPriority } from "@/hooks/useCalendarBookings";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";
import React from "react";

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
    <div className={cn("flex flex-row gap-0.5 w-full", className)}>
      {visibleBookings.map((booking) => (
        <div
          key={booking.booking_id}
          className={cn(
            "inline-flex items-center px-1 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-sm border",
            "font-mono tracking-tight truncate max-w-full",
            getBookingStatusColor(booking.booking_status ?? "Pending")
          )}
        >
          {booking.booking_units?.[0]?.unit?.unit_code ||
            booking.booking_units?.[0]?.unit?.unit_name?.slice(0, 3) ||
            "—"}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="inline-flex items-center px-1 py-0.5 text-[9px] sm:text-[10px] font-medium rounded-sm bg-neutral-100 text-neutral-600 border border-neutral-200">
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
        "absolute top-0.5 right-0.5 size-4 flex items-center justify-center",
        "bg-blue-600 text-white text-[9px] font-bold rounded-full",
        "shadow-sm",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </div>
  );
});
