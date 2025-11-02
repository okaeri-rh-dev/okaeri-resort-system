/**
 * Database Constraint Tests
 *
 * Verifies that PostgreSQL constraints enforce business rules:
 * - payment_before_assignment: Cannot assign units without verified payment
 * - all_or_nothing_assignment: Must assign ALL units or NONE
 * - no_double_booking: PostgreSQL EXCLUDE constraint prevents overlaps
 * - guests_per_unit > 0: Basic validation
 *
 * Source: 07-testing-strategy.md lines 467-691
 *
 * Updated: Uses test helpers to create parent bookings before booking_units inserts.
 * This fixes foreign key constraint violations in the unified multi-unit architecture.
 *
 * @vitest-environment node
 */

import { randomUUID } from "crypto";

import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, test } from "vitest";

import {
  cleanupTestBookings,
  cleanupTestUnits,
  createTestBooking,
  createTestUnit,
} from "./helpers";

describe("Database Constraint Tests", () => {
  let supabase: ReturnType<typeof createClient>;
  const testBookingIds: string[] = [];
  const testUnitIds: string[] = [];

  beforeAll(() => {
    // Initialize Supabase client with service role key for testing
    // Use the same fallback pattern as global-setup.ts
    const TEST_SUPABASE_URL =
      process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
    const TEST_SERVICE_KEY =
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

    supabase = createClient(TEST_SUPABASE_URL, TEST_SERVICE_KEY);
  });

  afterEach(async () => {
    // Clean up test data (bookings first due to foreign keys, then units)
    if (testBookingIds.length > 0) {
      await cleanupTestBookings(supabase, testBookingIds);
      testBookingIds.length = 0;
    }
    if (testUnitIds.length > 0) {
      await cleanupTestUnits(supabase, testUnitIds);
      testUnitIds.length = 0;
    }
  });

  describe("payment_before_assignment constraint", () => {
    test.skip("prevents unit assignment without payment verification (CONSTRAINT REMOVED IN UNIFIED MIGRATION)", async () => {
      // TODO: This constraint was removed in the unified multi-unit migration (Oct 17)
      // Payment verification is now enforced at the application layer
      // Consider testing the application-level validation instead
      // Create booking with pending payment
      const { data: booking, error: insertError } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Constraint Test",
          email: "constraint@test.com",
          contact_number: "+639171234567",
          check_in: "2025-03-01",
          check_out: "2025-03-05",
          payment_status: "Pending", // Not verified
          unit_assignment_status: "pending",
          is_multi_unit: true,
          requested_unit_count: 2,
          booking_reference: `C${Date.now().toString().slice(-8)}`,
          num_guests: 4,
          total_amount: 5000.0,
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(booking).toBeDefined();
      testBookingIds.push(booking!.booking_id);

      // Attempt to assign units without verifying payment
      const { error } = await supabase
        .from("bookings")
        .update({ unit_assignment_status: "assigned" })
        .eq("booking_id", booking!.booking_id);

      // Should fail with constraint violation
      expect(error).toBeDefined();
      expect(error?.code).toBe("23514"); // PostgreSQL CHECK constraint violation
      expect(error?.message).toContain("payment_before_assignment");
    });

    test.skip("allows unit assignment after payment verification (CONSTRAINT REMOVED IN UNIFIED MIGRATION)", async () => {
      // TODO: See above - constraint no longer exists at database level
      // Create booking with verified payment
      const { data: booking, error: insertError } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Verified Payment Test",
          email: "verified@test.com",
          contact_number: "+639181234567",
          check_in: "2025-03-01",
          check_out: "2025-03-05",
          payment_status: "Completed", // Payment completed
          unit_assignment_status: "pending",
          is_multi_unit: true,
          requested_unit_count: 2,
          booking_reference: `V${Date.now().toString().slice(-8)}`,
          num_guests: 4,
          total_amount: 5000.0,
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      testBookingIds.push(booking!.booking_id);

      // Should succeed - payment is verified
      const { error } = await supabase
        .from("bookings")
        .update({ unit_assignment_status: "assigned" })
        .eq("booking_id", booking!.booking_id);

      expect(error).toBeNull();
    });
  });

  describe("all_or_nothing_assignment constraint", () => {
    test.skip("prevents partial unit assignment (CONSTRAINT REMOVED IN UNIFIED MIGRATION)", async () => {
      // TODO: This constraint was removed in the unified multi-unit migration (Oct 17)
      // All-or-nothing assignment is now enforced at the application layer via assign_units_to_booking function
      // Consider testing the function directly instead
      // Create units first (needed for foreign key constraint)
      const unit1_id = await createTestUnit(supabase);
      const unit2_id = await createTestUnit(supabase);
      testUnitIds.push(unit1_id, unit2_id);

      // Create booking requesting 3 units
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Partial Assignment Test",
          email: "partial@test.com",
          contact_number: "+639191234567",
          check_in: "2025-03-10",
          check_out: "2025-03-15",
          payment_status: "Completed",
          is_multi_unit: true,
          requested_unit_count: 3,
          unit_assignment_status: "pending",
          booking_reference: `P${Date.now().toString().slice(-8)}`,
          num_guests: 6,
          total_amount: 7500.0,
        })
        .select()
        .single();

      testBookingIds.push(booking!.booking_id);

      // Insert unit requests
      await supabase.from("guest_booking_unit_requests").insert([
        { booking_id: booking!.booking_id, guests_per_unit: 2 },
        { booking_id: booking!.booking_id, guests_per_unit: 2 },
        { booking_id: booking!.booking_id, guests_per_unit: 2 },
      ]);

      // Assign only 2 units (partial assignment)
      await supabase.from("booking_units").insert([
        {
          booking_id: booking!.booking_id,
          unit_id: unit1_id,
          unit_price: 2500.0,
          subtotal: 2500.0,
          weekend_surcharge: 0,
          extra_person_charge: 0,
        },
        {
          booking_id: booking!.booking_id,
          unit_id: unit2_id,
          unit_price: 2500.0,
          subtotal: 2500.0,
          weekend_surcharge: 0,
          extra_person_charge: 0,
        },
      ]);

      // Attempt to mark as assigned (should fail - only 2/3 units assigned)
      const { error } = await supabase
        .from("bookings")
        .update({ unit_assignment_status: "assigned" })
        .eq("booking_id", booking!.booking_id);

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514"); // CHECK constraint violation
      expect(error?.message).toContain("all_or_nothing_assignment");
    });

    test.skip("allows complete unit assignment (CONSTRAINT REMOVED IN UNIFIED MIGRATION)", async () => {
      // TODO: See above - constraint no longer exists at database level
      // Create units first (needed for foreign key constraint)
      const unit1_id = await createTestUnit(supabase);
      const unit2_id = await createTestUnit(supabase);
      const unit3_id = await createTestUnit(supabase);
      testUnitIds.push(unit1_id, unit2_id, unit3_id);

      // Create booking requesting 3 units
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Complete Assignment Test",
          email: "complete@test.com",
          contact_number: "+639201234567",
          check_in: "2025-03-20",
          check_out: "2025-03-25",
          payment_status: "Completed",
          is_multi_unit: true,
          requested_unit_count: 3,
          unit_assignment_status: "pending",
          booking_reference: `C${Date.now().toString().slice(-8)}`,
          num_guests: 6,
          total_amount: 7500.0,
        })
        .select()
        .single();

      testBookingIds.push(booking!.booking_id);

      // Insert unit requests
      await supabase.from("guest_booking_unit_requests").insert([
        { booking_id: booking!.booking_id, guests_per_unit: 2 },
        { booking_id: booking!.booking_id, guests_per_unit: 2 },
        { booking_id: booking!.booking_id, guests_per_unit: 2 },
      ]);

      // Assign ALL 3 units
      await supabase.from("booking_units").insert([
        {
          booking_id: booking!.booking_id,
          unit_id: unit1_id,
          unit_price: 2500.0,
          subtotal: 2500.0,
          weekend_surcharge: 0,
          extra_person_charge: 0,
        },
        {
          booking_id: booking!.booking_id,
          unit_id: unit2_id,
          unit_price: 2500.0,
          subtotal: 2500.0,
          weekend_surcharge: 0,
          extra_person_charge: 0,
        },
        {
          booking_id: booking!.booking_id,
          unit_id: unit3_id,
          unit_price: 2500.0,
          subtotal: 2500.0,
          weekend_surcharge: 0,
          extra_person_charge: 0,
        },
      ]);

      // Should succeed - all units assigned
      const { error } = await supabase
        .from("bookings")
        .update({ unit_assignment_status: "assigned" })
        .eq("booking_id", booking!.booking_id);

      expect(error).toBeNull();
    });
  });

  describe("no_double_booking EXCLUDE constraint", () => {
    test("prevents overlapping bookings for same unit (via booking_unit_availability)", async () => {
      // NOTE: The EXCLUDE constraint is on booking_unit_availability table, not booking_units
      // This test validates the constraint at the availability level

      // Create a real unit first (foreign key requirement)
      const unitId = await createTestUnit(supabase);
      testUnitIds.push(unitId);

      // First booking with availability record
      const booking1_id = await createTestBooking(supabase, {
        check_in: "2025-04-01",
        check_out: "2025-04-05",
        booking_status: "Confirmed",
      });
      testBookingIds.push(booking1_id);

      // Insert into booking_unit_availability (this is where EXCLUDE constraint lives)
      const { error: error1 } = await supabase.from("booking_unit_availability").insert({
        unit_id: unitId,
        booking_id: booking1_id,
        check_in: "2025-04-01T14:00:00Z",
        check_out: "2025-04-05T11:00:00Z",
        booking_status: "Confirmed",
      });

      expect(error1).toBeNull();

      // Second booking with OVERLAPPING dates
      const booking2_id = await createTestBooking(supabase, {
        check_in: "2025-04-03",
        check_out: "2025-04-07",
        booking_status: "Confirmed",
      });
      testBookingIds.push(booking2_id);

      // Try to insert overlapping availability - should fail with EXCLUDE constraint
      const { error: error2 } = await supabase.from("booking_unit_availability").insert({
        unit_id: unitId,
        booking_id: booking2_id,
        check_in: "2025-04-03T14:00:00Z", // Overlaps with first booking
        check_out: "2025-04-07T11:00:00Z",
        booking_status: "Confirmed",
      });

      expect(error2).toBeDefined();
      expect(error2?.code).toBe("23P01"); // PostgreSQL EXCLUDE constraint violation
    });

    test("allows consecutive bookings for same unit", async () => {
      // Create a real unit first (foreign key requirement)
      const unitId = await createTestUnit(supabase);
      testUnitIds.push(unitId);

      // First booking
      const booking1_id = await createTestBooking(supabase, {
        check_in: "2025-05-01",
        check_out: "2025-05-05",
        booking_status: "Confirmed",
      });
      testBookingIds.push(booking1_id);

      // First availability record
      const { error: error1 } = await supabase.from("booking_unit_availability").insert({
        unit_id: unitId,
        booking_id: booking1_id,
        check_in: "2025-05-01T14:00:00Z",
        check_out: "2025-05-05T11:00:00Z",
        booking_status: "Confirmed",
      });

      expect(error1).toBeNull();

      // Second booking (consecutive - starts when first ends)
      const booking2_id = await createTestBooking(supabase, {
        check_in: "2025-05-05",
        check_out: "2025-05-10",
        booking_status: "Confirmed",
      });
      testBookingIds.push(booking2_id);

      // Second availability record (consecutive, no overlap - should succeed)
      const { error: error2 } = await supabase.from("booking_unit_availability").insert({
        unit_id: unitId,
        booking_id: booking2_id,
        check_in: "2025-05-05T14:00:00Z", // Starts when first ends
        check_out: "2025-05-10T11:00:00Z",
        booking_status: "Confirmed",
      });

      expect(error2).toBeNull(); // Should succeed - consecutive bookings are allowed
    });
  });

  describe("guests_per_unit CHECK constraint", () => {
    test("prevents zero guests per unit", async () => {
      // Create a valid booking first
      const booking_id = await createTestBooking(supabase, {
        guest_name: "Zero Guests Test",
        email: "zero@test.com",
        check_in: "2025-06-01",
        check_out: "2025-06-05",
        is_multi_unit: true,
        num_guests: 2,
      });
      testBookingIds.push(booking_id);

      // Try to insert unit request with 0 guests (should fail CHECK constraint)
      const { error } = await supabase.from("guest_booking_unit_requests").insert({
        booking_id: booking_id,
        unit_type: "Standard",
        quantity: 1,
        guests_per_unit: 0, // Invalid - violates CHECK (guests_per_unit > 0)
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514"); // CHECK constraint violation
      expect(error?.message).toContain("guests_per_unit");
    });

    test("prevents negative guests per unit", async () => {
      // Create a valid booking first
      const booking_id = await createTestBooking(supabase, {
        guest_name: "Negative Guests Test",
        email: "negative@test.com",
        check_in: "2025-06-10",
        check_out: "2025-06-15",
        is_multi_unit: true,
        num_guests: 2,
      });
      testBookingIds.push(booking_id);

      // Try to insert unit request with negative guests (should fail CHECK constraint)
      const { error } = await supabase.from("guest_booking_unit_requests").insert({
        booking_id: booking_id,
        unit_type: "Standard",
        quantity: 1,
        guests_per_unit: -5, // Invalid - violates CHECK (guests_per_unit > 0)
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514"); // CHECK constraint violation
      expect(error?.message).toContain("guests_per_unit");
    });
  });
});
