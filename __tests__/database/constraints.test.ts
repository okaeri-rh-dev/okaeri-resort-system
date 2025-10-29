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
 */

import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, test } from "vitest";

describe("Database Constraint Tests", () => {
  let supabase: ReturnType<typeof createClient>;
  const testBookingIds: string[] = [];

  beforeAll(() => {
    // Initialize Supabase client with service role key for testing
    supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  });

  afterEach(async () => {
    // Clean up test data
    if (testBookingIds.length > 0) {
      await supabase.from("bookings").delete().in("booking_id", testBookingIds);
      testBookingIds.length = 0;
    }
  });

  describe("payment_before_assignment constraint", () => {
    test("prevents unit assignment without payment verification", async () => {
      // Create booking with pending payment
      const { data: booking, error: insertError } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Constraint Test",
          email: "constraint@test.com",
          phone_number: "+639171234567",
          check_in_date: "2025-03-01",
          check_out_date: "2025-03-05",
          payment_status: "Pending", // Not verified
          unit_assignment_status: "pending",
          is_multi_unit: true,
          requested_unit_count: 2,
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

    test("allows unit assignment after payment verification", async () => {
      // Create booking with verified payment
      const { data: booking, error: insertError } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Verified Payment Test",
          email: "verified@test.com",
          phone_number: "+639181234567",
          check_in_date: "2025-03-01",
          check_out_date: "2025-03-05",
          payment_status: "Verified", // Payment verified
          unit_assignment_status: "pending",
          is_multi_unit: true,
          requested_unit_count: 2,
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
    test("prevents partial unit assignment", async () => {
      // Create booking requesting 3 units
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Partial Assignment Test",
          email: "partial@test.com",
          phone_number: "+639191234567",
          check_in_date: "2025-03-10",
          check_out_date: "2025-03-15",
          payment_status: "Verified",
          is_multi_unit: true,
          requested_unit_count: 3,
          unit_assignment_status: "pending",
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
          unit_id: "test-unit-1",
          check_in_date: "2025-03-10",
          check_out_date: "2025-03-15",
          status: "confirmed",
        },
        {
          booking_id: booking!.booking_id,
          unit_id: "test-unit-2",
          check_in_date: "2025-03-10",
          check_out_date: "2025-03-15",
          status: "confirmed",
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

    test("allows complete unit assignment", async () => {
      // Create booking requesting 3 units
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Complete Assignment Test",
          email: "complete@test.com",
          phone_number: "+639201234567",
          check_in_date: "2025-03-20",
          check_out_date: "2025-03-25",
          payment_status: "Verified",
          is_multi_unit: true,
          requested_unit_count: 3,
          unit_assignment_status: "pending",
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
          unit_id: "test-unit-10",
          check_in_date: "2025-03-20",
          check_out_date: "2025-03-25",
          status: "confirmed",
        },
        {
          booking_id: booking!.booking_id,
          unit_id: "test-unit-11",
          check_in_date: "2025-03-20",
          check_out_date: "2025-03-25",
          status: "confirmed",
        },
        {
          booking_id: booking!.booking_id,
          unit_id: "test-unit-12",
          check_in_date: "2025-03-20",
          check_out_date: "2025-03-25",
          status: "confirmed",
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
    test("prevents overlapping bookings for same unit", async () => {
      const unitId = "test-unit-overlap-1";
      const dates = {
        check_in: "2025-04-01",
        check_out: "2025-04-05",
      };

      // First booking
      const { error: error1 } = await supabase.from("booking_units").insert({
        booking_id: "booking-overlap-1",
        unit_id: unitId,
        check_in_date: dates.check_in,
        check_out_date: dates.check_out,
        status: "confirmed",
      });

      expect(error1).toBeNull();

      // Second booking (overlapping dates)
      const { error: error2 } = await supabase.from("booking_units").insert({
        booking_id: "booking-overlap-2",
        unit_id: unitId,
        check_in_date: "2025-04-03", // Overlaps with first booking
        check_out_date: "2025-04-07",
        status: "confirmed",
      });

      expect(error2).toBeDefined();
      expect(error2?.code).toBe("23P01"); // PostgreSQL EXCLUDE constraint violation
      expect(error2?.message).toContain("no_double_booking");
    });

    test("allows consecutive bookings for same unit", async () => {
      const unitId = "test-unit-consecutive-1";

      // First booking
      const { error: error1 } = await supabase.from("booking_units").insert({
        booking_id: "booking-consecutive-1",
        unit_id: unitId,
        check_in_date: "2025-05-01",
        check_out_date: "2025-05-05",
        status: "confirmed",
      });

      expect(error1).toBeNull();

      // Second booking (consecutive, no overlap)
      const { error: error2 } = await supabase.from("booking_units").insert({
        booking_id: "booking-consecutive-2",
        unit_id: unitId,
        check_in_date: "2025-05-05", // Starts when first ends
        check_out_date: "2025-05-10",
        status: "confirmed",
      });

      expect(error2).toBeNull(); // Should succeed
    });
  });

  describe("guests_per_unit CHECK constraint", () => {
    test("prevents zero guests per unit", async () => {
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Zero Guests Test",
          email: "zero@test.com",
          phone_number: "+639211234567",
          check_in_date: "2025-06-01",
          check_out_date: "2025-06-05",
          is_multi_unit: true,
        })
        .select()
        .single();

      testBookingIds.push(booking!.booking_id);

      const { error } = await supabase.from("guest_booking_unit_requests").insert({
        booking_id: booking!.booking_id,
        guests_per_unit: 0, // Invalid
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514"); // CHECK constraint violation
      expect(error?.message).toContain("guests_per_unit");
    });

    test("prevents negative guests per unit", async () => {
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Negative Guests Test",
          email: "negative@test.com",
          phone_number: "+639221234567",
          check_in_date: "2025-06-10",
          check_out_date: "2025-06-15",
          is_multi_unit: true,
        })
        .select()
        .single();

      testBookingIds.push(booking!.booking_id);

      const { error } = await supabase.from("guest_booking_unit_requests").insert({
        booking_id: booking!.booking_id,
        guests_per_unit: -5, // Invalid
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514"); // CHECK constraint violation
    });
  });
});
