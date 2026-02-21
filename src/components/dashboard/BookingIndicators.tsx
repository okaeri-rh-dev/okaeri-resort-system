import React, { useMemo } from "react";

import { getBookingStatusColor, getBookingStatusPriority } from "@/hooks/useCalendarBookings";
import { cn } from "@/lib/utils";
import type { Booking, BookingUnitRecord } from "@/types";

interface UnitEntry {
  booking: Booking;
  bookingUnit: BookingUnitRecord | null;
  key: string; // composite key: booking_id:unit_id
}

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
  // Flatten bookings into per-unit entries so each unit gets its own chip
  const unitEntries = useMemo(() => {
    if (!bookings || bookings.length === 0) return [];

    // Deduplicate bookings first (same booking appearing multiple times for multi-day stays)
    const uniqueBookings = Array.from(new Map(bookings.map((b) => [b.booking_id, b])).values());

    const entries: UnitEntry[] = [];
    const seen = new Set<string>();

    for (const booking of uniqueBookings) {
      const units = booking.booking_units;
      if (!units || units.length === 0) {
        // Fallback entry for bookings with no units
        const key = `${booking.booking_id}:no-unit`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({ booking, bookingUnit: null, key });
        }
      } else {
        for (const bu of units) {
          const key = `${booking.booking_id}:${bu.unit_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            entries.push({ booking, bookingUnit: bu, key });
          }
        }
      }
    }

    // Sort by status priority, then by unit code alphabetically
    entries.sort((a, b) => {
      const priorityDiff =
        getBookingStatusPriority(a.booking.booking_status ?? "Pending") -
        getBookingStatusPriority(b.booking.booking_status ?? "Pending");
      if (priorityDiff !== 0) return priorityDiff;

      const codeA = a.bookingUnit?.unit?.unit_code ?? "";
      const codeB = b.bookingUnit?.unit?.unit_code ?? "";
      return codeA.localeCompare(codeB);
    });

    return entries;
  }, [bookings]);

  if (unitEntries.length === 0) {
    return null;
  }

  const visibleEntries = unitEntries.slice(0, maxVisible);
  const remainingCount = unitEntries.length - maxVisible;

  return (
    <div className={cn("flex w-full flex-row gap-0.5", className)}>
      {visibleEntries.map((entry) => (
        <div
          key={entry.key}
          className={cn(
            "inline-flex items-center rounded-sm border px-1 py-0.5 text-[9px] font-semibold sm:text-[10px]",
            "max-w-full truncate font-mono tracking-tight",
            getBookingStatusColor(entry.booking.booking_status ?? "Pending")
          )}
        >
          {entry.bookingUnit?.unit?.unit_code ||
            entry.bookingUnit?.unit?.unit_name?.slice(0, 3) ||
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
