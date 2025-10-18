import type { Booking } from "@/types";
import { getCalendarDateKey, utcToResortTime } from "@/utils/date-helpers";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  isWithinInterval,
  max,
  min,
  startOfMonth,
  subDays,
} from "date-fns";
import { useMemo } from "react";

interface BookingsByDate {
  [date: string]: Booking[];
}

interface CalendarBookingData {
  bookingsByDate: BookingsByDate;
  monthlyBookingCount: number;
  dateRange: {
    start: Date;
    end: Date;
  };
}

export function useCalendarBookings(
  bookings: Booking[] | undefined,
  currentMonth: Date
): CalendarBookingData {
  return useMemo(() => {
    if (!bookings || bookings.length === 0) {
      return {
        bookingsByDate: {},
        monthlyBookingCount: 0,
        dateRange: {
          start: startOfMonth(currentMonth),
          end: endOfMonth(currentMonth),
        },
      };
    }

    // Calculate date range with buffer for previous/next month visibility
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const bufferStart = startOfMonth(addMonths(currentMonth, -1));
    const bufferEnd = endOfMonth(addMonths(currentMonth, 1));

    // Group bookings by date with optimized date iteration
    const bookingsByDate: BookingsByDate = {};
    let monthlyCount = 0;
    const countedBookings = new Set<string>();

    bookings.forEach((booking) => {
      // Convert UTC dates to resort timezone
      const checkInDate = utcToResortTime(booking.check_in);
      const checkOutDate = utcToResortTime(booking.check_out);

      // Early exit if booking is completely outside our buffer range
      if (checkOutDate < bufferStart || checkInDate > bufferEnd) {
        return;
      }

      // Constrain the date range to our buffer to avoid unnecessary iterations
      const effectiveStart = max([checkInDate, bufferStart]);
      const effectiveEnd = min([checkOutDate, bufferEnd]);

      // Use eachDayOfInterval for efficient date iteration
      const bookingDays = eachDayOfInterval({
        start: effectiveStart,
        end: subDays(effectiveEnd, 1),
      });

      // Process each day efficiently
      bookingDays.forEach((currentDate) => {
        const dateKey = getCalendarDateKey(currentDate);

        if (!bookingsByDate[dateKey]) {
          bookingsByDate[dateKey] = [];
        }

        // Add the booking to this date
        bookingsByDate[dateKey].push(booking);

        // Count unique bookings in the current month (only once per booking)
        if (
          !countedBookings.has(booking.booking_id) &&
          isWithinInterval(currentDate, { start: monthStart, end: monthEnd })
        ) {
          monthlyCount++;
          countedBookings.add(booking.booking_id);
        }
      });
    });

    return {
      bookingsByDate,
      monthlyBookingCount: monthlyCount,
      dateRange: {
        start: monthStart,
        end: monthEnd,
      },
    };
  }, [bookings, currentMonth]);
}

// Helper function to get booking status priority for sorting
export function getBookingStatusPriority(status: string): number {
  const priorities: { [key: string]: number } = {
    CheckedIn: 0,
    Confirmed: 1,
    Pending: 2,
    CheckedOut: 3,
    Cancelled: 4,
  };
  return priorities[status] ?? 5;
}

// Helper function to get status color class (professional palette)
export function getBookingStatusColor(status: string): string {
  switch (status) {
    case "Confirmed":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "CheckedIn":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "Pending":
      return "bg-slate-100 text-slate-700 border-slate-300";
    case "CheckedOut":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "Cancelled":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

// Helper to format currency for Philippine peso
export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}
