import type { StatusTone } from "@/components/patterns";
import type { BookingSource } from "@/lib/bookings/source";
import type { BookingStatus, CabinState, PaymentStatus } from "@/types";

/** "Paid" is a legacy payment status some rows still carry. */
type ToneStatus = BookingStatus | PaymentStatus | CabinState | "Paid";

// Booking and payment statuses and cabin states share one pill vocabulary (DESIGN.md, Colour)
const tonesByStatus: Record<ToneStatus, StatusTone> = {
  Confirmed: "success",
  CheckedIn: "success",
  Paid: "success",
  Completed: "success",
  Free: "success",
  Pending: "warning",
  Partial: "warning",
  Cancelled: "danger",
  Refunded: "danger",
  Blocked: "danger",
  CheckedOut: "neutral",
  Booked: "neutral",
};

const tonesByLowercaseStatus = new Map(
  Object.entries(tonesByStatus).map(([status, tone]) => [status.toLowerCase(), tone])
);

/** The `StatusBadge` tone for a booking or payment status, or a cabin state. Unknown statuses are neutral. */
export function statusTone(status: string): StatusTone {
  return tonesByLowercaseStatus.get(status.toLowerCase()) ?? "neutral";
}

/** "CheckedOut" → "Checked Out": stored statuses are PascalCase. */
function statusLabel(status: string) {
  return status.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * `StatusBadge` props for a status that may be empty, labelled with `fallback` when it is.
 *
 * @example
 * ```tsx
 * <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
 * ```
 */
export function statusBadgeProps(status: string | null | undefined, fallback: ToneStatus) {
  const label = status || fallback;
  return { tone: statusTone(label), children: statusLabel(label) };
}

const tonesBySource: Record<BookingSource, StatusTone | null> = {
  "Walk-in": "warning",
  Airbnb: "info",
  Website: "neutral",
  Direct: null,
};

/** The source badge tone, or null for a Direct booking, which shows no badge. */
export function sourceTone(source: BookingSource): StatusTone | null {
  return tonesBySource[source];
}
