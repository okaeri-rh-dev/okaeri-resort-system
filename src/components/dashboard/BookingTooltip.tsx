import React, { useMemo } from "react";

import { format } from "date-fns";

import {
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
  StatusBadge,
} from "@/components/patterns";
import { getBookingStatusPriority } from "@/hooks/useCalendarBookings";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import type { Booking } from "@/types";

import { CabinChips } from "./BookingRow";

interface BookingTooltipProps {
  bookings: Booking[];
  date: Date;
  children: React.ReactNode;
  maxVisible?: number;
}

export const BookingTooltip = React.memo(function BookingTooltip({
  bookings,
  date,
  children,
  maxVisible = 3,
}: BookingTooltipProps) {
  const totalUnits = useMemo(
    () => bookings?.reduce((sum, b) => sum + (b.booking_units?.length ?? 0), 0) ?? 0,
    [bookings]
  );

  if (!bookings || bookings.length === 0) {
    return <>{children}</>;
  }

  // Sort bookings by status priority
  const sortedBookings = [...bookings].sort(
    (a, b) =>
      getBookingStatusPriority(a.booking_status ?? "Pending") -
      getBookingStatusPriority(b.booking_status ?? "Pending")
  );

  const visibleBookings = sortedBookings.slice(0, maxVisible);
  const remainingCount = bookings.length - maxVisible;

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      {/* A mouse preview only: a tap focuses the day, and focus must not open the card */}
      <HoverCardTrigger asChild onFocus={(event) => event.preventDefault()}>
        {children}
      </HoverCardTrigger>
      {/* Portal so the popover escapes the calendar table's containing block.
          The table has `container-type: inline-size` (for BookingIndicators' cqi
          font-size) which implicitly applies `contain: layout`, making the table
          a containing block for position:fixed descendants. Without the portal,
          the popover's coordinates are table-relative and move with page scroll. */}
      <HoverCardPortal>
        <HoverCardContent className="isolate z-50 w-80 p-3" align="center" collisionPadding={12}>
          <div className="space-y-3">
            {/* Header */}
            <div className="border-b pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{format(date, "MMMM d, yyyy")}</span>
                <span className="text-muted-foreground text-xs font-medium">
                  {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
                  {totalUnits > bookings.length ? ` (${totalUnits} units)` : ""}
                </span>
              </div>
            </div>

            {/* Bookings list */}
            <div className="space-y-2">
              {visibleBookings.map((booking) => (
                <BookingTooltipItem key={booking.booking_id} booking={booking} />
              ))}
            </div>

            {/* More indicator */}
            {remainingCount > 0 && (
              <div className="border-t pt-2">
                <span className="text-muted-foreground text-xs font-medium">
                  +{remainingCount} more booking{remainingCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
});

interface BookingTooltipItemProps {
  booking: Booking;
}

const BookingTooltipItem = React.memo(function BookingTooltipItem({
  booking,
}: BookingTooltipItemProps) {
  return (
    <div className="space-y-1.5 rounded border p-2">
      {/* Unit(s) and Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <CabinChips booking={booking} />
          <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
        </div>
        <span className="text-xs font-semibold tabular-nums">
          {formatCurrency(booking.total_amount)}
        </span>
      </div>

      {/* Guest Details */}
      <div className="space-y-0.5">
        <div className="text-xs font-medium">{booking.guest_name}</div>
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span>
            {booking.num_guests} guest{booking.num_guests !== 1 ? "s" : ""}
          </span>
          <span aria-hidden="true">•</span>
          <span>
            {format(new Date(booking.check_in), "MMM d")} -{" "}
            {format(new Date(booking.check_out), "MMM d")}
          </span>
        </div>
      </div>
    </div>
  );
});
