// Mirrors the anonymize_guest refusal and the weekly job's open-balance rule
// (supabase/migrations/20261021000000_guest_retention.sql) for the confirm dialog.

export interface RetentionBooking {
  booking_status: string | null;
  payment_status: string | null;
  check_out: string;
}

const OPEN_BALANCE = ["Pending", "Partial"];

export function anonymizeBlockers(bookings: RetentionBooking[], now: Date) {
  const live = bookings.filter((booking) => booking.booking_status !== "Cancelled");
  return {
    hasCurrentOrFutureBooking: live.some((booking) => new Date(booking.check_out) > now),
    openBalanceCount: live.filter((booking) => OPEN_BALANCE.includes(booking.payment_status ?? ""))
      .length,
  };
}
