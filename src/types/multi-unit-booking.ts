/**
 * Type definitions for Multi-Unit Booking System (Phase 3)
 *
 * Supports booking multiple units in a single transaction with unified payment.
 *
 * @module MultiUnitBookingTypes
 */

import type { StaffBookingSource } from "@/lib/bookings/source";

// ============================================
// BOOKING UNIT TYPES
// ============================================

export interface BookingUnit {
  // Unit identification
  unit_id: string;
  unit_name: string;
  unit_code: string;
  unit_type: string;

  // Unit capacity
  max_occupancy: number;
  base_occupancy: number;

  // Pricing
  base_rate: number;
  weekend_rate: number;
  extra_person_rate: number;

  // Per-unit booking details
  guest_assignment?: {
    guest_ids: string[];
    num_guests: number;
    special_requests?: string;
  };

  // Per-unit pricing breakdown
  pricing: {
    nights: number;
    base_total: number;
    weekend_surcharge: number;
    extra_person_fee: number;
    unit_total: number;
  };

  // Availability tracking
  availability: {
    is_available: boolean;
    checking: boolean;
    last_checked?: string;
    conflicts?: number;
  };
}

// ============================================
// MULTI-UNIT BOOKING TYPES
// ============================================

export interface MultiUnitBooking {
  booking_id: string;
  booking_reference: string;

  // Units
  booking_units: BookingUnit[];
  unit_count: number;
  is_multi_unit: boolean;

  // Primary guest
  primary_guest: {
    guest_id?: string | null;
    guest_name: string;
    contact_number: string;
    email: string;
  };

  // Booking dates
  check_in: string;
  check_out: string;

  // Totals
  total_guests: number;
  base_amount: number;
  total_surcharges: number;
  discount_amount: number;
  total_amount: number;

  // Status
  booking_status: string | null;
  payment_status: string | null;
  payment_method?: string | null;
  payment_proof_url?: string | null;

  // Notes
  special_requests?: string | null;
  internal_notes?: string | null;

  // Metadata
  created_at: string | null;
  updated_at: string | null;
}

// ============================================
// ADMIN BOOKING CREATION TYPES
// ============================================

/**
 * Unit assignment for admin booking creation
 * Simplified structure for the admin multi-unit booking form
 */
export interface AdminBookingUnitCreate {
  unit_id: string;
  num_guests: number;
  guest_assignment?: {
    guest_ids?: string[];
    num_guests: number;
    special_requests?: string;
  };
  unit_notes?: string;
}

/**
 * Admin multi-unit booking creation request
 * Used by the admin panel to create bookings with multiple units
 */
export interface AdminMultiUnitBookingCreate {
  primary_guest: {
    guest_name: string;
    email: string;
    contact_number: string;
  };
  /** Manila check-in day, YYYY-MM-DD */
  check_in: string;
  /** Manila check-out day, YYYY-MM-DD */
  check_out: string;
  units: AdminBookingUnitCreate[];
  payment?: {
    method: string;
    amount?: number;
    proof_url?: string;
  };
  special_requests?: string;
  internal_notes?: string;
  booking_source?: StaffBookingSource;
  /** Required for an Airbnb booking: its total (ADR 0006). */
  payout?: number;
  airbnb_confirmation_code?: string;
  source?: string;
  idempotency_key?: string;
}

// ============================================
// STORE STATE TYPES
// ============================================

export interface MultiUnitBookingState {
  // Draft booking state (during creation)
  draftBooking: Partial<MultiUnitBooking> | null;
  selectedUnits: BookingUnit[];
  error: Error | null;
}

// ============================================
// STORE ACTION TYPES
// ============================================

export interface MultiUnitBookingActions {
  addUnit: (unit: BookingUnit, checkIn?: string | Date, checkOut?: string | Date) => void;
  removeUnit: (unitId: string) => void;
  assignGuestsToUnit: (unitId: string, guestIds: string[], numGuests: number) => void;
  calculateUnitPricing: (
    unit: BookingUnit,
    checkIn: string,
    checkOut: string,
    numGuests: number
  ) => BookingUnit["pricing"];
  setDraftBooking: (booking: Partial<MultiUnitBooking> | null) => void;
  clearDraftBooking: () => void;
}

// ============================================
// COMBINED STORE TYPE
// ============================================

export type MultiUnitBookingStore = MultiUnitBookingState & MultiUnitBookingActions;
