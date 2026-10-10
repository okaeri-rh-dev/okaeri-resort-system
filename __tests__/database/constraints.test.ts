/**
 * Database Constraint Tests
 *
 * Verifies that PostgreSQL constraints enforce business rules:
 * - no_double_booking: PostgreSQL EXCLUDE constraint prevents overlaps
 * - guests_per_unit > 0: Basic validation
 *
 * Note: payment_before_assignment and all_or_nothing_assignment constraints were
 * removed in the unified multi-unit migration (Oct 17, 2024) and are now enforced
 * at the application layer.
 *
 * Source: 07-testing-strategy.md lines 467-691
 *
 * @vitest-environment node
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Database } from "@/types/database.types";

import {
  cleanupTestBookings,
  cleanupTestUnits,
  createTestBooking,
  createTestUnit,
} from "./helpers";

describe("Database Constraint Tests", () => {
  let supabase: SupabaseClient<Database>;
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

    supabase = createClient<Database>(TEST_SUPABASE_URL, TEST_SERVICE_KEY);
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

  // NOTE: payment_before_assignment and all_or_nothing_assignment constraints were removed
  // in the unified multi-unit migration (Oct 17, 2024). These constraints are now enforced
  // at the application layer. Consider adding application-level validation tests instead.

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
