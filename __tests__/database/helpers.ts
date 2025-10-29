/**
 * Database Constraint Test Helpers
 *
 * Provides helper functions for testing database constraints with proper parent record setup.
 * Solves the issue where booking_units inserts require parent bookings records due to foreign keys.
 *
 * Architecture:
 * - Unified multi-unit architecture requires ALL bookings to use booking_units junction table
 * - Foreign key: booking_units.booking_id → bookings.booking_id (ON DELETE CASCADE)
 * - Tests must create parent bookings before inserting booking_units
 *
 * Usage:
 * ```typescript
 * import { createTestBooking, cleanupTestBookings } from './helpers';
 *
 * const booking_id = await createTestBooking(supabase, {
 *   payment_status: 'Verified',
 * });
 *
 * // Test constraint with booking_units insert
 * await supabase.from('booking_units').insert({ booking_id, ... });
 *
 * // Cleanup (cascades to booking_units)
 * await cleanupTestBookings(supabase, [booking_id]);
 * ```
 */

import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

// Type aliases for convenience
type BookingInsert = Database["public"]["Tables"]["bookings"]["Insert"];
type BookingUnitInsert = Database["public"]["Tables"]["booking_units"]["Insert"];

/**
 * Default booking data for tests
 * Based on typical resort booking structure
 */
const DEFAULT_BOOKING: Partial<BookingInsert> = {
  guest_name: "Test Guest",
  email: "test@example.com",
  phone_number: "+639171234567",
  check_in_date: "2025-03-01",
  check_out_date: "2025-03-05",
  payment_status: "Pending",
  unit_assignment_status: "pending",
  is_multi_unit: true,
  requested_unit_count: 1,
  booking_status: "Confirmed",
  total_amount: 5000.0,
  notes: "Test booking for constraint tests",
};

/**
 * Create a test booking record
 *
 * Creates a valid parent booking record that can be used for booking_units inserts.
 * Automatically generates a unique booking_id.
 *
 * @param supabase - Supabase client with admin privileges
 * @param overrides - Partial booking data to override defaults
 * @returns booking_id of the created booking
 * @throws Error if booking creation fails
 *
 * @example
 * ```typescript
 * const booking_id = await createTestBooking(supabase, {
 *   payment_status: 'Verified',
 *   requested_unit_count: 3,
 * });
 * ```
 */
export async function createTestBooking(
  supabase: SupabaseClient<Database>,
  overrides?: Partial<BookingInsert>
): Promise<string> {
  const bookingData: BookingInsert = {
    ...DEFAULT_BOOKING,
    ...overrides,
    // Ensure required fields are present
    guest_name: overrides?.guest_name || DEFAULT_BOOKING.guest_name!,
    email: overrides?.email || DEFAULT_BOOKING.email!,
    phone_number: overrides?.phone_number || DEFAULT_BOOKING.phone_number!,
    check_in_date: overrides?.check_in_date || DEFAULT_BOOKING.check_in_date!,
    check_out_date: overrides?.check_out_date || DEFAULT_BOOKING.check_out_date!,
  };

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert(bookingData)
    .select("booking_id")
    .single();

  if (error) {
    console.error("Failed to create test booking:", error);
    throw new Error(`Failed to create test booking: ${error.message}`);
  }

  if (!booking) {
    throw new Error("Booking created but no data returned");
  }

  return booking.booking_id;
}

/**
 * Create a booking with associated booking_units
 *
 * Creates both a parent booking and its child booking_units records in one call.
 * Useful for testing multi-unit booking scenarios.
 *
 * @param supabase - Supabase client with admin privileges
 * @param bookingOverrides - Partial booking data to override defaults
 * @param units - Array of booking_unit data (unit_id, guests_per_unit, etc.)
 * @returns Object with booking_id and array of unit_ids
 * @throws Error if creation fails
 *
 * @example
 * ```typescript
 * const { booking_id, unit_ids } = await createBookingWithUnits(
 *   supabase,
 *   { payment_status: 'Verified', requested_unit_count: 2 },
 *   [
 *     { unit_id: 'unit-1', guests_per_unit: 2 },
 *     { unit_id: 'unit-2', guests_per_unit: 3 },
 *   ]
 * );
 * ```
 */
export async function createBookingWithUnits(
  supabase: SupabaseClient<Database>,
  bookingOverrides?: Partial<BookingInsert>,
  units?: Array<Partial<BookingUnitInsert>>
): Promise<{ booking_id: string; unit_ids: string[] }> {
  // Create parent booking
  const booking_id = await createTestBooking(supabase, bookingOverrides);

  const unit_ids: string[] = [];

  // Create booking_units if provided
  if (units && units.length > 0) {
    const bookingUnitsData = units.map((unit) => {
      const unit_id = unit.unit_id || randomUUID();
      unit_ids.push(unit_id);

      return {
        booking_id,
        unit_id,
        check_in_date: unit.check_in_date || bookingOverrides?.check_in_date || "2025-03-01",
        check_out_date: unit.check_out_date || bookingOverrides?.check_out_date || "2025-03-05",
        status: unit.status || "confirmed",
        guests_per_unit: unit.guests_per_unit || 2,
        ...unit,
      } as BookingUnitInsert;
    });

    const { error } = await supabase.from("booking_units").insert(bookingUnitsData);

    if (error) {
      // Cleanup the booking if units creation fails
      await supabase.from("bookings").delete().eq("booking_id", booking_id);
      console.error("Failed to create booking units:", error);
      throw new Error(`Failed to create booking units: ${error.message}`);
    }
  }

  return {
    booking_id,
    unit_ids,
  };
}

/**
 * Create multiple test bookings
 *
 * Convenience function to create multiple bookings at once.
 * Useful for tests that need multiple bookings (e.g., overlap detection).
 *
 * @param supabase - Supabase client with admin privileges
 * @param count - Number of bookings to create
 * @param overrides - Partial booking data applied to all bookings
 * @returns Array of booking_ids
 * @throws Error if any booking creation fails
 *
 * @example
 * ```typescript
 * const booking_ids = await createMultipleBookings(supabase, 3, {
 *   payment_status: 'Verified',
 * });
 * ```
 */
export async function createMultipleBookings(
  supabase: SupabaseClient<Database>,
  count: number,
  overrides?: Partial<BookingInsert>
): Promise<string[]> {
  const booking_ids: string[] = [];

  for (let i = 0; i < count; i++) {
    const booking_id = await createTestBooking(supabase, {
      ...overrides,
      // Vary the guest name to avoid potential unique constraints
      guest_name: `${overrides?.guest_name || "Test Guest"} ${i + 1}`,
      email: `test${i + 1}@example.com`,
    });
    booking_ids.push(booking_id);
  }

  return booking_ids;
}

/**
 * Clean up test bookings and related data
 *
 * Deletes bookings by ID. Due to ON DELETE CASCADE on foreign keys,
 * this automatically deletes related booking_units records.
 *
 * @param supabase - Supabase client with admin privileges
 * @param booking_ids - Array of booking_ids to delete
 * @returns void
 *
 * @example
 * ```typescript
 * await cleanupTestBookings(supabase, [booking_id_1, booking_id_2]);
 * ```
 */
export async function cleanupTestBookings(
  supabase: SupabaseClient<Database>,
  booking_ids: string[]
): Promise<void> {
  if (booking_ids.length === 0) return;

  const { error } = await supabase.from("bookings").delete().in("booking_id", booking_ids);

  if (error) {
    console.warn(`Failed to cleanup test bookings: ${error.message}`);
    console.warn(`Booking IDs: ${booking_ids.join(", ")}`);
  }
}

/**
 * Create a unit for testing
 *
 * Creates a physical unit record for testing unit-based constraints.
 * Units are required by some booking_units constraints.
 *
 * @param supabase - Supabase client with admin privileges
 * @param overrides - Partial unit data to override defaults
 * @returns unit_id of the created unit
 * @throws Error if unit creation fails
 *
 * @example
 * ```typescript
 * const unit_id = await createTestUnit(supabase, {
 *   unit_name: 'Test Unit A',
 *   max_occupancy: 4,
 * });
 * ```
 */
export async function createTestUnit(
  supabase: SupabaseClient<Database>,
  overrides?: Partial<Database["public"]["Tables"]["units"]["Insert"]>
): Promise<string> {
  const unitData = {
    unit_name: overrides?.unit_name || `Test Unit ${randomUUID().slice(0, 8)}`,
    unit_type: overrides?.unit_type || "Standard",
    max_occupancy: overrides?.max_occupancy || 4,
    base_rate: overrides?.base_rate || 1250.0,
    status: overrides?.status || "Available",
    ...overrides,
  };

  const { data: unit, error } = await supabase
    .from("units")
    .insert(unitData)
    .select("unit_id")
    .single();

  if (error) {
    console.error("Failed to create test unit:", error);
    throw new Error(`Failed to create test unit: ${error.message}`);
  }

  if (!unit) {
    throw new Error("Unit created but no data returned");
  }

  return unit.unit_id;
}

/**
 * Clean up test units
 *
 * Deletes units by ID. Note: If units have bookings, this may fail due to
 * foreign key constraints. Clean up bookings first.
 *
 * @param supabase - Supabase client with admin privileges
 * @param unit_ids - Array of unit_ids to delete
 * @returns void
 *
 * @example
 * ```typescript
 * await cleanupTestUnits(supabase, [unit_id_1, unit_id_2]);
 * ```
 */
export async function cleanupTestUnits(
  supabase: SupabaseClient<Database>,
  unit_ids: string[]
): Promise<void> {
  if (unit_ids.length === 0) return;

  const { error } = await supabase.from("units").delete().in("unit_id", unit_ids);

  if (error) {
    console.warn(`Failed to cleanup test units: ${error.message}`);
    console.warn(`Unit IDs: ${unit_ids.join(", ")}`);
  }
}

/**
 * Verify booking exists
 *
 * Utility to check if a booking was successfully created.
 * Useful for debugging test failures.
 *
 * @param supabase - Supabase client
 * @param booking_id - Booking ID to verify
 * @returns true if booking exists, false otherwise
 */
export async function verifyBookingExists(
  supabase: SupabaseClient<Database>,
  booking_id: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("bookings")
    .select("booking_id")
    .eq("booking_id", booking_id)
    .single();

  return !error && data !== null;
}

/**
 * Get booking_units count for a booking
 *
 * Utility to check how many units are assigned to a booking.
 * Useful for testing assignment constraints.
 *
 * @param supabase - Supabase client
 * @param booking_id - Booking ID to check
 * @returns Number of booking_units records
 */
export async function getBookingUnitsCount(
  supabase: SupabaseClient<Database>,
  booking_id: string
): Promise<number> {
  const { data, error } = await supabase
    .from("booking_units")
    .select("id", { count: "exact" })
    .eq("booking_id", booking_id);

  if (error) {
    console.error("Failed to count booking units:", error);
    return 0;
  }

  return data?.length || 0;
}
