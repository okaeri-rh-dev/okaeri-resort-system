import { NeedsActionLabel } from "@/components/bookings/BookingsTable/components/NeedsActionLabel";
import { SourceBadge } from "@/components/bookings/BookingsTable/components/SourceBadge";
import { StatusBadge } from "@/components/patterns";
import { outstandingBalance } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import type { Booking } from "@/types";

/** Reference, status, source, needs-action, anonymized and the amount due, on one wrapping line. */
export function BookingHeaderLine({ booking }: { booking: Booking }) {
  const outstanding = outstandingBalance(booking);
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums">
      <span>{booking.booking_reference}</span>
      <StatusBadge size="compact" {...statusBadgeProps(booking.booking_status, "Pending")} />
      <SourceBadge source={booking.booking_source} />
      <NeedsActionLabel booking={booking} />
      {booking.anonymized_at && (
        <StatusBadge size="compact" tone="neutral">
          Anonymized
        </StatusBadge>
      )}
      {outstanding > 0 && (
        <span className="text-foreground font-medium">{formatCurrency(outstanding)} due</span>
      )}
    </div>
  );
}
