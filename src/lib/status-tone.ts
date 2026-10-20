import type { StatusTone } from "@/components/patterns";
import type { BookingStatus, PaymentStatus, UnitStatus } from "@/types";

/** "Paid" is a legacy payment status some rows still carry. */
type ToneStatus = BookingStatus | PaymentStatus | UnitStatus | "Paid";

// Booking, payment and cabin statuses share one pill vocabulary (DESIGN.md, Colour)
const tonesByStatus: Record<ToneStatus, StatusTone> = {
  Confirmed: "success",
  CheckedIn: "success",
  Paid: "success",
  Completed: "success",
  Available: "success",
  Pending: "warning",
  Partial: "warning",
  Reserved: "warning",
  Cancelled: "danger",
  Refunded: "danger",
  Maintenance: "danger",
  CheckedOut: "neutral",
  Occupied: "neutral",
};

const tonesByLowercaseStatus = new Map(
  Object.entries(tonesByStatus).map(([status, tone]) => [status.toLowerCase(), tone])
);

/** The `StatusBadge` tone for a booking, payment or cabin status. Unknown statuses are neutral. */
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
