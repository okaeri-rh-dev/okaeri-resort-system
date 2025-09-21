/**
 * Basic reporting utilities for Phase 2
 * Provides occupancy and revenue reports with CSV export functionality
 */

import type { Booking, Unit } from "@/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from "date-fns";

// ============================================
// TYPES
// ============================================

export interface OccupancyReport {
  date: string;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  revenue: number;
}

export interface RevenueReport {
  period: string;
  bookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  occupancyRate: number;
}

// ============================================
// OCCUPANCY REPORTING
// ============================================

/**
 * Generate occupancy report for a date range
 * Calculates daily occupancy rates and revenue
 */
export function generateOccupancyReport(
  units: Unit[],
  bookings: Booking[],
  startDate: Date,
  endDate: Date
): OccupancyReport[] {
  const report: OccupancyReport[] = [];
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  days.forEach((day) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    // Count occupied units for this day
    const occupiedUnits = new Set<string>();
    let dayRevenue = 0;

    bookings.forEach((booking) => {
      if (booking.booking_status === "Cancelled") return;

      const checkIn = new Date(booking.check_in);
      const checkOut = new Date(booking.check_out);

      if (isWithinInterval(day, { start: checkIn, end: checkOut })) {
        occupiedUnits.add(booking.unit_id);
        // Calculate daily revenue (simplified)
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        dayRevenue += booking.total_amount / nights;
      }
    });

    report.push({
      date: format(day, "yyyy-MM-dd"),
      totalUnits: units.length,
      occupiedUnits: occupiedUnits.size,
      occupancyRate: units.length > 0 ? (occupiedUnits.size / units.length) * 100 : 0,
      revenue: dayRevenue,
    });
  });

  return report;
}

// ============================================
// REVENUE REPORTING
// ============================================

/**
 * Generate revenue report for a specific month
 * Includes booking counts, revenue totals, and average occupancy
 */
export function generateRevenueReport(
  bookings: Booking[],
  units: Unit[],
  year: number,
  month: number
): RevenueReport {
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(new Date(year, month - 1));

  const monthBookings = bookings.filter((booking) => {
    const checkIn = new Date(booking.check_in);
    return (
      isWithinInterval(checkIn, { start: startDate, end: endDate }) &&
      booking.booking_status !== "Cancelled"
    );
  });

  const totalRevenue = monthBookings.reduce((sum, b) => sum + b.total_amount, 0);

  const occupancyReport = generateOccupancyReport(units, bookings, startDate, endDate);

  const avgOccupancy =
    occupancyReport.length > 0
      ? occupancyReport.reduce((sum, r) => sum + r.occupancyRate, 0) / occupancyReport.length
      : 0;

  return {
    period: format(startDate, "MMMM yyyy"),
    bookings: monthBookings.length,
    totalRevenue,
    averageBookingValue: monthBookings.length > 0 ? totalRevenue / monthBookings.length : 0,
    occupancyRate: avgOccupancy,
  };
}

// ============================================
// CSV EXPORT
// ============================================

/**
 * Export data array to CSV file
 * Handles comma and quote escaping
 */
export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Security: Sanitize filename to prevent path traversal
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Get headers from first object
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Handle null/undefined
          if (value === null || value === undefined) {
            return "";
          }

          // Security: Prevent formula injection attacks
          // Check if string starts with =, +, -, @, tab, or carriage return
          if (typeof value === "string") {
            let sanitizedValue = value;

            // Remove potentially dangerous formula prefixes
            if (/^[=+\-@\t\r]/.test(sanitizedValue)) {
              sanitizedValue = "'" + sanitizedValue; // Prefix with single quote to escape formula
            }

            // Escape commas and quotes in strings
            if (sanitizedValue.includes(",") || sanitizedValue.includes('"')) {
              return `"${sanitizedValue.replace(/"/g, '""')}"`;
            }
            return sanitizedValue;
          }

          return value;
        })
        .join(",")
    ),
  ].join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", safeFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url); // Clean up
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format booking data for CSV export
 * Includes all relevant booking information
 */
export function formatBookingsForExport(bookings: Booking[], units: Unit[]): any[] {
  const unitMap = new Map(units.map((u) => [u.unit_id, u]));

  return bookings.map((booking) => ({
    "Booking Reference": booking.booking_reference,
    "Guest Name": booking.guest_name,
    Email: booking.email,
    "Contact Number": booking.contact_number,
    Unit: unitMap.get(booking.unit_id)?.unit_name || "Unknown",
    "Check In": format(new Date(booking.check_in), "yyyy-MM-dd"),
    "Check Out": format(new Date(booking.check_out), "yyyy-MM-dd"),
    "Number of Guests": booking.num_guests,
    "Total Amount": booking.total_amount,
    "Booking Status": booking.booking_status,
    "Payment Status": booking.payment_status,
    "Payment Method": booking.payment_method || "N/A",
    "Special Requests": booking.special_requests || "",
    "Created Date": format(new Date(booking.created_at), "yyyy-MM-dd HH:mm"),
  }));
}

/**
 * Format occupancy report for CSV export
 */
export function formatOccupancyForExport(report: OccupancyReport[]): any[] {
  return report.map((day) => ({
    Date: day.date,
    "Total Units": day.totalUnits,
    "Occupied Units": day.occupiedUnits,
    "Occupancy Rate (%)": day.occupancyRate.toFixed(1),
    "Daily Revenue": `₱${day.revenue.toFixed(2)}`,
  }));
}

/**
 * Export bookings to CSV with proper formatting
 */
export function exportBookingsToCSV(
  bookings: Booking[],
  units: Unit[],
  filename = `bookings_${format(new Date(), "yyyy-MM-dd")}.csv`
): void {
  const formattedData = formatBookingsForExport(bookings, units);
  exportToCSV(formattedData, filename);
}

/**
 * Export occupancy report to CSV
 */
export function exportOccupancyToCSV(
  report: OccupancyReport[],
  filename = `occupancy_${format(new Date(), "yyyy-MM-dd")}.csv`
): void {
  const formattedData = formatOccupancyForExport(report);
  exportToCSV(formattedData, filename);
}
