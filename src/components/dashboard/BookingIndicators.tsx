import React, { useMemo } from "react";

import { getBookingStatusPriority } from "@/hooks/useCalendarBookings";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

import {
  getStatusHintClasses,
  getStatusMobileBarClasses,
  PENDING_CHIP_COLORS,
  UNIT_SLOT_MAP,
  UNIT_SLOTS,
} from "./unit-calendar-config";

interface BookingIndicatorsProps {
  bookings: Booking[];
  className?: string;
}

export const BookingIndicators = React.memo(function BookingIndicators({
  bookings,
  className,
}: BookingIndicatorsProps) {
  // Build a map: unitCode -> best booking (highest-priority status wins)
  const slotBookings = useMemo(() => {
    if (!bookings || bookings.length === 0) return null;

    const map = new Map<string, Booking>();

    for (const booking of bookings) {
      const units = booking.booking_units;
      if (!units || units.length === 0) continue;

      for (const bu of units) {
        const code = bu.unit?.unit_code;
        if (!code || !UNIT_SLOT_MAP.has(code)) continue;

        const existing = map.get(code);
        if (
          !existing ||
          getBookingStatusPriority(booking.booking_status ?? "Pending") <
            getBookingStatusPriority(existing.booking_status ?? "Pending")
        ) {
          map.set(code, booking);
        }
      }
    }

    return map.size > 0 ? map : null;
  }, [bookings]);

  if (!slotBookings) return null;

  return (
    <div className={cn("flex w-full flex-col gap-0.5", className)}>
      {UNIT_SLOTS.map((slot) => {
        const booking = slotBookings.get(slot.unitCode);

        if (!booking) {
          // Invisible placeholder to maintain fixed positioning
          return <div key={slot.unitCode} className="h-3 w-full sm:h-4" aria-hidden="true" />;
        }

        const status = booking.booking_status ?? "Pending";
        const isPending = status === "Pending";
        const chipHint = getStatusHintClasses(status);
        const barHint = getStatusMobileBarClasses(status);
        const chipBorder = isPending ? PENDING_CHIP_COLORS.border : slot.border;
        const chipText = isPending ? PENDING_CHIP_COLORS.text : slot.text;
        const barBg = isPending ? PENDING_CHIP_COLORS.mobileBar : slot.mobileBar;

        return (
          <div key={slot.unitCode} className="h-3 w-full sm:h-4">
            {/* Mobile: thin color bar only */}
            <div
              className={cn("h-3 w-full rounded-sm sm:hidden", barBg, barHint)}
              aria-label={`${slot.unitCode}: ${booking.guest_name}`}
            />
            {/* Desktop: chip with unit code + guest name */}
            <div
              className={cn(
                "hidden w-full items-center rounded-sm border px-1 py-0.5 sm:flex",
                "truncate text-[10px] leading-tight font-semibold",
                slot.bg,
                chipText,
                chipBorder,
                chipHint
              )}
            >
              <span className="mr-1 font-mono">{slot.unitCode}</span>
              <span className="truncate font-sans font-medium">{booking.guest_name}</span>
            </div>
          </div>
        );
      })}
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
