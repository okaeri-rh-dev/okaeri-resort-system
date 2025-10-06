// Database type adapters - Converting between Supabase types and application types
// Handles the mismatch between DB Json types and typed arrays, nullable enums, etc.

import type { Tables } from "../../database.types";
import type { Booking, Unit, Guest, Payment } from "@/types";

// ============================================
// DATABASE TYPE ALIASES
// ============================================

/**
 * Database row types from Supabase
 */
export type DbUnit = Tables<"units">;
export type DbGuest = Tables<"guests">;
export type DbBooking = Tables<"bookings"> & {
  unit?: DbUnit;
  guest?: DbGuest | null;
};
export type DbPayment = Tables<"payments"> & {
  booking?: DbBooking | null;
};

// ============================================
// UNIT ADAPTER
// ============================================

/**
 * Convert database Unit to application Unit
 * Handles Json → string[] conversion for amenities
 */
export function adaptUnitFromDB(dbUnit: DbUnit): Unit {
  // Safely convert Json amenities to string[]
  let amenities: string[] | null = null;
  if (dbUnit.amenities !== null) {
    if (Array.isArray(dbUnit.amenities)) {
      // Json is already an array, assert as string[]
      amenities = dbUnit.amenities as string[];
    } else if (typeof dbUnit.amenities === "object") {
      // Json is an object, try to extract array values
      amenities = Object.values(dbUnit.amenities).filter((v): v is string => typeof v === "string");
    }
  }

  return {
    unit_id: dbUnit.unit_id,
    unit_name: dbUnit.unit_name,
    unit_code: dbUnit.unit_code,
    unit_type: dbUnit.unit_type,
    base_occupancy: dbUnit.base_occupancy,
    max_occupancy: dbUnit.max_occupancy,
    base_rate: dbUnit.base_rate,
    weekend_rate: dbUnit.weekend_rate,
    extra_person_rate: dbUnit.extra_person_rate,
    unit_status: dbUnit.unit_status,
    amenities,
    created_at: dbUnit.created_at,
    updated_at: dbUnit.updated_at,
  };
}

// ============================================
// GUEST ADAPTER
// ============================================

/**
 * Convert database Guest to application Guest
 * Minimal conversion needed since types are mostly aligned
 */
export function adaptGuestFromDB(dbGuest: DbGuest): Guest {
  return {
    guest_id: dbGuest.guest_id,
    guest_name: dbGuest.guest_name,
    email: dbGuest.email,
    phone_number: dbGuest.phone_number,
    total_bookings: dbGuest.total_bookings,
    total_spent: dbGuest.total_spent,
    created_at: dbGuest.created_at,
    updated_at: dbGuest.updated_at,
  };
}

// ============================================
// BOOKING ADAPTER
// ============================================

/**
 * Convert database Booking to application Booking
 * Handles related unit and guest conversions
 */
export function adaptBookingFromDB(dbBooking: DbBooking): Booking {
  return {
    booking_id: dbBooking.booking_id,
    booking_reference: dbBooking.booking_reference,
    unit_id: dbBooking.unit_id,
    guest_id: dbBooking.guest_id,
    guest_name: dbBooking.guest_name,
    contact_number: dbBooking.contact_number,
    email: dbBooking.email,
    num_guests: dbBooking.num_guests,
    check_in: dbBooking.check_in,
    check_out: dbBooking.check_out,
    total_amount: dbBooking.total_amount,
    booking_status: dbBooking.booking_status,
    payment_status: dbBooking.payment_status,
    payment_method: dbBooking.payment_method,
    payment_proof_url: dbBooking.payment_proof_url,
    special_requests: dbBooking.special_requests,
    internal_notes: dbBooking.internal_notes,
    created_at: dbBooking.created_at,
    updated_at: dbBooking.updated_at,
    // Convert related entities
    unit: dbBooking.unit ? adaptUnitFromDB(dbBooking.unit) : undefined,
    guest: dbBooking.guest ? adaptGuestFromDB(dbBooking.guest) : null,
  };
}

/**
 * Convert array of database Bookings to application Bookings
 */
export function adaptBookingsFromDB(dbBookings: DbBooking[]): Booking[] {
  return dbBookings.map(adaptBookingFromDB);
}

// ============================================
// PAYMENT ADAPTER
// ============================================

/**
 * Convert database Payment to application Payment
 * Handles related booking conversion
 */
export function adaptPaymentFromDB(dbPayment: DbPayment): Payment {
  return {
    payment_id: dbPayment.payment_id,
    booking_id: dbPayment.booking_id,
    amount: dbPayment.amount,
    payment_method: dbPayment.payment_method,
    payment_date: dbPayment.payment_date,
    proof_url: dbPayment.proof_url,
    notes: dbPayment.notes,
    created_at: dbPayment.created_at,
    // Convert related booking if present
    booking: dbPayment.booking ? adaptBookingFromDB(dbPayment.booking) : undefined,
  };
}

/**
 * Convert array of database Payments to application Payments
 */
export function adaptPaymentsFromDB(dbPayments: DbPayment[]): Payment[] {
  return dbPayments.map(adaptPaymentFromDB);
}

// ============================================
// REVERSE ADAPTERS (App → DB)
// ============================================

/**
 * Convert application Unit amenities to database Json format
 * Used when inserting/updating units
 */
export function unitAmenitiesToJson(amenities: string[] | null): unknown {
  return amenities; // Json type accepts arrays directly
}

/**
 * Prepare booking data for database insert
 * Ensures all fields match database expectations
 */
export function prepareBookingForDB(booking: Partial<Booking>): Partial<Tables<"bookings">> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { unit, guest, ...dbBooking } = booking;

  return dbBooking;
}
