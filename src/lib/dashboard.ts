import { format, getDaysInMonth } from "date-fns";

import { dayAfter, manilaDayOf, type ManilaDay } from "@/lib/bookings/stay";
import type { Booking } from "@/types";

export interface DayMovements {
  day: ManilaDay;
  checkIns: Booking[];
  checkOuts: Booking[];
  /** Check-in day < day < check-out day */
  staying: Booking[];
}

const checkInDay = (booking: Booking) => manilaDayOf(booking.check_in);
const checkOutDay = (booking: Booking) => manilaDayOf(booking.check_out);

export function movementsOn(bookings: Booking[], day: ManilaDay): DayMovements {
  const visible = bookings.filter((b) => b.booking_status !== "Cancelled");
  return {
    day,
    checkIns: visible.filter((b) => checkInDay(b) === day),
    checkOuts: visible.filter((b) => checkOutDay(b) === day),
    staying: visible.filter((b) => checkInDay(b) < day && checkOutDay(b) > day),
  };
}

// Same rule as the pending-bookings queue (functions/api/admin/pending-bookings.ts)
export const isPending = (booking: Booking) =>
  booking.is_guest_booking === true && booking.unit_assignment_status === "pending";

export const pendingCount = (bookings: Booking[]) => bookings.filter(isPending).length;

/** Total price minus counted payments (GLOSSARY), never below 0. */
export function outstandingBalance(booking: Booking): number {
  const paid = (booking.payments ?? [])
    .filter((payment) => payment.status === "Active")
    .reduce((sum, payment) => sum + payment.amount, 0);
  return Math.max(booking.total_amount - paid, 0);
}

const isConfirmed = (booking: Booking) =>
  booking.booking_status !== "Pending" && booking.booking_status !== "Cancelled";

/** Occupancy (GLOSSARY) of the calendar month that holds `month`. */
export function monthNumbers(bookings: Booking[], month: Date, unitCount: number) {
  const monthKey = format(month, "yyyy-MM");
  const confirmed = bookings.filter(isConfirmed);

  let bookedCabinNights = 0;
  for (const booking of confirmed) {
    for (let night = checkInDay(booking); night < checkOutDay(booking); night = dayAfter(night)) {
      if (night.startsWith(monthKey)) bookedCabinNights += booking.booking_units?.length ?? 0;
    }
  }

  const cabinNights = unitCount * getDaysInMonth(month);
  return {
    occupancy: cabinNights > 0 ? bookedCabinNights / cabinNights : 0,
    bookedCabinNights,
    confirmedCount: confirmed.filter((b) => checkInDay(b).startsWith(monthKey)).length,
  };
}
