import React from "react";
import { format } from "date-fns";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { Booking } from "@/types";
import { formatCurrency, getBookingStatusPriority } from "@/hooks/useCalendarBookings";
import { cn } from "@/lib/utils";

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
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80 p-3 isolate z-50 bg-white shadow-lg" align="center">
        <div className="space-y-3">
          {/* Header */}
          <div className="border-b border-neutral-200 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-900">
                {format(date, "MMMM d, yyyy")}
              </span>
              <span className="text-xs font-medium text-neutral-600">
                {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
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
            <div className="pt-2 border-t border-neutral-200">
              <span className="text-xs text-neutral-600 font-medium">
                +{remainingCount} more booking{remainingCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

interface BookingTooltipItemProps {
  booking: Booking;
}

const BookingTooltipItem = React.memo(function BookingTooltipItem({
  booking,
}: BookingTooltipItemProps) {
  const statusColors = {
    Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    CheckedIn: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Pending: "bg-slate-50 text-slate-700 border-slate-200",
    CheckedOut: "bg-violet-50 text-violet-600 border-violet-200",
    Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <div className="space-y-1.5 p-2 rounded border border-neutral-200 bg-white">
      {/* Unit and Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-neutral-900">
            {booking.booking_units?.[0]?.unit?.unit_code ||
              booking.booking_units?.[0]?.unit?.unit_name ||
              "—"}
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium rounded border",
              statusColors[booking.booking_status as keyof typeof statusColors] ||
                statusColors.Pending
            )}
          >
            {booking.booking_status}
          </span>
        </div>
        <span className="font-mono text-xs font-semibold text-neutral-900 tabular-nums">
          {formatCurrency(booking.total_amount)}
        </span>
      </div>

      {/* Guest Details */}
      <div className="space-y-0.5">
        <div className="text-xs text-neutral-700 font-medium">{booking.guest_name}</div>
        <div className="flex items-center gap-3 text-[11px] text-neutral-600">
          <span>
            {booking.num_guests} guest{booking.num_guests !== 1 ? "s" : ""}
          </span>
          <span className="text-neutral-400">•</span>
          <span>
            {format(new Date(booking.check_in), "MMM d")} -{" "}
            {format(new Date(booking.check_out), "MMM d")}
          </span>
        </div>
      </div>
    </div>
  );
});
