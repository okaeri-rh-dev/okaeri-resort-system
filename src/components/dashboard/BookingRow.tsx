import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/patterns";
import { manilaDayOf } from "@/lib/bookings/stay";
import { isPending, outstandingBalance } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

import { UNIT_SLOT_MAP } from "./unit-calendar-config";

/** Each cabin of a booking in its calendar lane colour. */
export function CabinChips({ booking }: { booking: Booking }) {
  if (!booking.booking_units?.length) {
    return <span className="text-xs font-semibold">—</span>;
  }
  return (
    <span className="flex shrink-0 flex-wrap gap-1">
      {booking.booking_units.map((bookingUnit) => {
        const unitCode = bookingUnit.unit?.unit_code;
        const slot = unitCode ? UNIT_SLOT_MAP.get(unitCode) : undefined;
        return (
          <span
            key={bookingUnit.booking_unit_id ?? bookingUnit.unit_id}
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-semibold",
              slot && cn(slot.bg, slot.text, slot.border, "border")
            )}
          >
            {unitCode || bookingUnit.unit?.unit_name || "—"}
          </span>
        );
      })}
    </span>
  );
}

const shortDay = (instant: string) => format(parseISO(manilaDayOf(instant)), "MMM d");

export function BookingRow({ booking }: { booking: Booking }) {
  const balance = outstandingBalance(booking);
  return (
    <li>
      <Link
        to="/admin/bookings/$bookingId"
        params={{ bookingId: booking.booking_id }}
        className="hover:bg-accent focus-visible:ring-ring coarse:min-h-11 -mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
      >
        <CabinChips booking={booking} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{booking.guest_name}</span>
          <span className="text-muted-foreground block text-xs tabular-nums">
            {booking.num_guests} guest{booking.num_guests !== 1 ? "s" : ""} ·{" "}
            {shortDay(booking.check_in)}–{shortDay(booking.check_out)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {balance > 0 && (
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(balance)}</span>
          )}
          <span className="flex flex-col items-end gap-1">
            {isPending(booking) && (
              <StatusBadge tone="warning">Waiting for verification</StatusBadge>
            )}
            <StatusBadge {...statusBadgeProps(booking.payment_status, "Pending")} />
          </span>
        </span>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}
