/**
 * Search and filter utilities for Phase 2
 * Provides booking search, filtering, and sorting functionality
 */

import type { Booking, Unit, Guest } from "@/types";
import { isWithinInterval, parseISO } from "date-fns";

// ============================================
// TYPES
// ============================================

export interface BookingFilters {
  status?: string;
  dateRange?: { start: Date; end: Date };
  searchTerm?: string;
  unitId?: string;
  paymentStatus?: string;
}

// ============================================
// BOOKING FILTERS
// ============================================

/**
 * Filter bookings based on multiple criteria
 */
export function filterBookings(bookings: Booking[], filters: BookingFilters): Booking[] {
  let filtered = [...bookings];

  // Status filter
  if (filters.status && filters.status !== "all") {
    filtered = filtered.filter((b) => b.booking_status === filters.status);
  }

  // Date range filter
  if (filters.dateRange) {
    filtered = filtered.filter((b) => {
      const checkIn = parseISO(b.check_in);
      return isWithinInterval(checkIn, {
        start: filters.dateRange!.start,
        end: filters.dateRange!.end,
      });
    });
  }

  // Search term (guest name, email, phone, reference)
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.guest_name.toLowerCase().includes(term) ||
        b.email.toLowerCase().includes(term) ||
        b.contact_number.includes(term) ||
        b.booking_reference.toLowerCase().includes(term)
    );
  }

  // Unit filter
  if (filters.unitId) {
    filtered = filtered.filter((b) => b.unit_id === filters.unitId);
  }

  // Payment status filter
  if (filters.paymentStatus && filters.paymentStatus !== "all") {
    filtered = filtered.filter((b) => b.payment_status === filters.paymentStatus);
  }

  return filtered;
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

/**
 * Search units by name, code, or type
 */
export function searchUnits(units: Unit[], searchTerm: string): Unit[] {
  if (!searchTerm) return units;

  const term = searchTerm.toLowerCase();
  return units.filter(
    (u) =>
      u.unit_name.toLowerCase().includes(term) ||
      u.unit_code.toLowerCase().includes(term) ||
      u.unit_type.toLowerCase().includes(term)
  );
}

/**
 * Search guests by name, email, or phone
 */
export function searchGuests(guests: Guest[], searchTerm: string): Guest[] {
  if (!searchTerm) return guests;

  const term = searchTerm.toLowerCase();
  return guests.filter(
    (g) =>
      g.guest_name.toLowerCase().includes(term) ||
      g.email.toLowerCase().includes(term) ||
      g.phone_number.includes(term)
  );
}

// ============================================
// SORTING FUNCTIONS
// ============================================

/**
 * Sort bookings by various criteria
 */
export function sortBookings(
  bookings: Booking[],
  sortBy: "date" | "amount" | "status" | "guest" = "date",
  order: "asc" | "desc" = "desc"
): Booking[] {
  const sorted = [...bookings];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "date":
        comparison = new Date(a.check_in).getTime() - new Date(b.check_in).getTime();
        break;
      case "amount":
        comparison = a.total_amount - b.total_amount;
        break;
      case "status":
        comparison = (a.booking_status || "").localeCompare(b.booking_status || "");
        break;
      case "guest":
        comparison = a.guest_name.localeCompare(b.guest_name);
        break;
    }

    return order === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Sort units by name, code, or base rate
 */
export function sortUnits(
  units: Unit[],
  sortBy: "name" | "code" | "rate" = "code",
  order: "asc" | "desc" = "asc"
): Unit[] {
  const sorted = [...units];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "name":
        comparison = a.unit_name.localeCompare(b.unit_name);
        break;
      case "code":
        comparison = a.unit_code.localeCompare(b.unit_code);
        break;
      case "rate":
        comparison = a.base_rate - b.base_rate;
        break;
    }

    return order === "asc" ? comparison : -comparison;
  });

  return sorted;
}

// ============================================
// DATE RANGE HELPERS
// ============================================

/**
 * Get bookings within a specific date range
 */
export function getBookingsInDateRange(
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): Booking[] {
  return bookings.filter((booking) => {
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);

    // Check if booking overlaps with the date range
    return (
      (checkIn >= startDate && checkIn <= endDate) ||
      (checkOut >= startDate && checkOut <= endDate) ||
      (checkIn <= startDate && checkOut >= endDate)
    );
  });
}

/**
 * Get upcoming check-ins within specified days
 */
export function getUpcomingCheckIns(bookings: Booking[], days: number = 7): Booking[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);

  return bookings
    .filter((booking) => {
      const checkIn = new Date(booking.check_in);
      return booking.booking_status === "Confirmed" && checkIn >= today && checkIn <= futureDate;
    })
    .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
}

/**
 * Get upcoming check-outs within specified days
 */
export function getUpcomingCheckOuts(bookings: Booking[], days: number = 7): Booking[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);

  return bookings
    .filter((booking) => {
      const checkOut = new Date(booking.check_out);
      return booking.booking_status === "CheckedIn" && checkOut >= today && checkOut <= futureDate;
    })
    .sort((a, b) => new Date(a.check_out).getTime() - new Date(b.check_out).getTime());
}

// ============================================
// ADVANCED FILTERS
// ============================================

/**
 * Get bookings that need attention (overdue, pending confirmation, etc.)
 */
export function getBookingsNeedingAttention(bookings: Booking[]): Booking[] {
  const now = new Date();

  return bookings.filter((booking) => {
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);

    // Pending bookings close to check-in (within 24 hours)
    if (
      booking.booking_status === "Pending" &&
      checkIn <= new Date(Date.now() + 24 * 60 * 60 * 1000)
    ) {
      return true;
    }

    // Confirmed bookings with unpaid status on check-in date
    if (
      booking.booking_status === "Confirmed" &&
      booking.payment_status === "Pending" &&
      checkIn <= now
    ) {
      return true;
    }

    // Overdue check-ins
    if (booking.booking_status === "Confirmed" && checkIn < now) {
      return true;
    }

    // Overdue check-outs
    if (booking.booking_status === "CheckedIn" && checkOut < now) {
      return true;
    }

    return false;
  });
}

/**
 * Get bookings by payment status
 */
export function filterByPaymentStatus(
  bookings: Booking[],
  status: "Pending" | "Partial" | "Completed" | "Refunded"
): Booking[] {
  return bookings.filter((b) => b.payment_status === status);
}

/**
 * Get active bookings (not cancelled or checked out)
 */
export function getActiveBookings(bookings: Booking[]): Booking[] {
  return bookings.filter(
    (b) => b.booking_status !== "Cancelled" && b.booking_status !== "CheckedOut"
  );
}
