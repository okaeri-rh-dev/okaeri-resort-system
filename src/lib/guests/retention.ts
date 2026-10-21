// Mirrors the anonymize_guest refusal and the weekly job's open-balance rule
// (supabase/migrations/20261021000000_guest_retention.sql) for the confirm dialog.

import type { Booking } from "@/types";
import type { PaymentStatus } from "@/types/booking-status";

export type RetentionBooking = Pick<Booking, "booking_status" | "payment_status" | "check_out">;

const OPEN_BALANCE: ReadonlySet<string> = new Set<PaymentStatus>(["Pending", "Partial"]);

export function anonymizeBlockers(bookings: RetentionBooking[], now: Date) {
  const notCancelled = bookings.filter((booking) => booking.booking_status !== "Cancelled");
  return {
    hasCurrentOrFutureBooking: notCancelled.some((booking) => new Date(booking.check_out) > now),
    openBalanceCount: notCancelled.filter(
      (booking) => booking.payment_status !== null && OPEN_BALANCE.has(booking.payment_status)
    ).length,
  };
}
