import { useMemo } from "react";

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

import type { Booking } from "@/types";
import { getCalendarDateKey, utcToResortTime } from "@/utils/date-helpers";

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

// Helper to format currency for Philippine peso
export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}
