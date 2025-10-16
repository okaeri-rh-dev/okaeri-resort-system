import type { Booking } from "@/types";

export const exportBookings = async (bookings: Booking[]) => {
  try {
    // Import the enhanced export function for Philippine compliance
    const { exportToCSV: exportEnhanced } = await import("@/utils/reports");

    const exportData = bookings.map((booking) => ({
      booking_reference: booking.booking_reference,
      guest_name: booking.guest_name,
      unit_name: booking.booking_units?.[0]?.unit?.unit_name || "N/A",
      check_in: booking.check_in,
      check_out: booking.check_out,
      number_of_guests: booking.num_guests,
      total_amount: booking.total_amount,
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      payment_method: booking.payment_method || "N/A",
      contact_number: booking.contact_number,
      email: booking.email,
      special_requests: booking.special_requests || "",
      created_date: booking.created_at,
    }));

    await exportEnhanced(
      exportData,
      "bookings",
      [
        "Booking Ref",
        "Guest Name",
        "Unit",
        "Check In",
        "Check Out",
        "Guests",
        "Total Amount",
        "Booking Status",
        "Payment Status",
        "Payment Method",
        "Contact",
        "Email",
        "Special Requests",
        "Created Date",
      ],
      {
        businessName: "Okaeri Resort",
        includeMetadata: true,
        philippineFormat: true,
      }
    );
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
};
