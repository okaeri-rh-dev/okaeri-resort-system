// Database type adapters - Converting between Supabase types and application types
// Handles the mismatch between DB Json types and typed arrays, nullable enums, etc.

import type { Booking, BookingUnitRecord, Guest, Payment, Unit } from "@/types";
import type { Tables } from "@/types/database.types";

// ============================================
// DATABASE TYPE ALIASES
// ============================================

/**
 * Database row types from Supabase
 */
export type DbUnit = Tables<"units">;
export type DbGuest = Tables<"guests">;
export type DbBookingUnit = Tables<"booking_units"> & {
  unit?: DbUnit;
};
export type DbBooking = Tables<"bookings"> & {
  booking_units?: DbBookingUnit[];
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
// BOOKING UNIT ADAPTER
// ============================================

/**
 * Convert database BookingUnit to application BookingUnitRecord
 * Handles the junction table record with nested unit relation
 */
export function adaptBookingUnitFromDB(dbBookingUnit: DbBookingUnit): BookingUnitRecord {
  return {
    booking_unit_id: dbBookingUnit.booking_unit_id,
    booking_id: dbBookingUnit.booking_id,
    unit_id: dbBookingUnit.unit_id,
    unit_price: dbBookingUnit.unit_price,
    weekend_surcharge: dbBookingUnit.weekend_surcharge,
    extra_person_charge: dbBookingUnit.extra_person_charge,
    subtotal: dbBookingUnit.subtotal,
    assigned_guests: dbBookingUnit.assigned_guests,
    unit_notes: dbBookingUnit.unit_notes,
    created_at: dbBookingUnit.created_at,
    updated_at: dbBookingUnit.updated_at,
    // Convert related unit if present
    unit: dbBookingUnit.unit ? adaptUnitFromDB(dbBookingUnit.unit) : undefined,
  };
}

// ============================================
// BOOKING ADAPTER
// ============================================

/**
 * Convert database Booking to application Booking
 * Handles related booking_units (junction table) and guest conversions
 */
export function adaptBookingFromDB(dbBooking: DbBooking): Booking {
  return {
    booking_id: dbBooking.booking_id,
    booking_reference: dbBooking.booking_reference,
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
    is_multi_unit: dbBooking.is_multi_unit,
    unit_count: dbBooking.unit_count,
    created_at: dbBooking.created_at,
    updated_at: dbBooking.updated_at,
    // Convert related entities (NEW: junction table pattern)
    booking_units: dbBooking.booking_units?.map(adaptBookingUnitFromDB) || [],
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
  const { booking_units, guest, ...dbBooking } = booking;

  return dbBooking;
}
