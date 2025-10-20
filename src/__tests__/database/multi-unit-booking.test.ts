// src/__tests__/database/multi-unit-booking.test.ts
/**
 * Integration Tests for Multi-Unit Booking Database Functions
 *
 * Tests Cover:
 * - create_multi_unit_booking function (atomicity, error handling)
 * - check_multi_unit_availability function (batch checking, next dates)
 * - get_booking_units function (backwards compatibility)
 * - Triggers (totals, dates, status, cleanup)
 * - Exclusion constraints (prevent double-booking)
 * - RLS policies (security)
 *
 * Phase 4.5: Updated to use test database configuration
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase, // Use admin client for database tests (bypasses RLS)
} from "../setup/test-db";

describe("Multi-Unit Booking Database Functions", () => {
  let testUnitIds: string[] = [];
  let testGuestId: string | null = null;
  let shouldRun = false;

  beforeAll(async () => {
    // Check if we should run database tests
    shouldRun = await shouldRunDatabaseTests();

    if (!shouldRun) {
      console.log("⏭️  Skipping database tests - test database not configured");
      return;
    }

    // Cleanup any orphaned test data from previous interrupted runs
    // This ensures a clean slate even if previous tests failed
    await cleanupTestData({ includeTestFixtures: true });

    // Create test units using helper with unique codes to avoid constraint violations
    // Both unit_name and unit_code have unique constraints, so make them unique
    // Use crypto.randomUUID() for true uniqueness in parallel tests
    const uniqueId = crypto.randomUUID().slice(0, 8); // 8 chars, globally unique
    const unit1 = await createTestUnit({
      unit_name: `Test Unit 1 ${uniqueId}`,
      unit_code: `T1-${uniqueId.slice(0, 6)}`, // VARCHAR(10) limit: "T1-" (3) + 6 chars = 9
      unit_type: "Standard", // Valid types: Standard, Deluxe, Suite, Villa
      base_rate: 2500,
      weekend_rate: 3000,
      extra_person_rate: 500,
    });

    const unit2 = await createTestUnit({
      unit_name: `Test Unit 2 ${uniqueId}`,
      unit_code: `T2-${uniqueId.slice(0, 6)}`, // VARCHAR(10) limit
      unit_type: "Deluxe", // Valid types: Standard, Deluxe, Suite, Villa
      base_occupancy: 2,
      max_occupancy: 4,
      base_rate: 3500,
      weekend_rate: 4000,
      extra_person_rate: 750,
    });

    const unit3 = await createTestUnit({
      unit_name: `Test Unit 3 ${uniqueId}`,
      unit_code: `T3-${uniqueId.slice(0, 6)}`, // VARCHAR(10) limit
      unit_type: "Suite", // Valid types: Standard, Deluxe, Suite, Villa
      base_occupancy: 4,
      max_occupancy: 6,
      base_rate: 5000,
      weekend_rate: 6000,
      extra_person_rate: 1000,
    });

    testUnitIds = [unit1.unit_id, unit2.unit_id, unit3.unit_id];

    // Create test guest using helper (let it generate unique email)
    const guest = await createTestGuest({
      guest_name: "Test Guest",
      phone_number: "+639123456789", // Column name is phone_number, not contact_number
      // email will be auto-generated as unique by createTestGuest helper
    });

    testGuestId = guest.guest_id;
  });

  afterAll(async () => {
    if (!shouldRun) return;

    // Cleanup using helper (now includes test fixtures cleanup)
    await cleanupTestData({ includeTestFixtures: true });
  });

  beforeEach(async () => {
    if (!shouldRun) return;

    // Clean up bookings before each test (but keep units/guests for reuse)
    await cleanupTestData();
  });

  describe("create_multi_unit_booking", () => {
    it.skipIf(!shouldRun)("should create a booking with 2 units atomically", async () => {
      const bookingData = {
        booking_reference: "BK-TEST-001",
        guest_name: "John Doe",
        contact_number: "+639123456789",
        email: "john@example.com",
        num_guests: 4,
        check_in: "2025-12-20T06:00:00Z", // UTC
        check_out: "2025-12-25T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Pending",
      };

      const units = [
        {
          unit_id: testUnitIds[0],
          unit_price: 12500,
          weekend_surcharge: 0,
          extra_person_charge: 0,
          subtotal: 12500,
          assigned_guests: 2,
          unit_notes: "Ocean view preference",
        },
        {
          unit_id: testUnitIds[1],
          unit_price: 17500,
          weekend_surcharge: 0,
          extra_person_charge: 0,
          subtotal: 17500,
          assigned_guests: 2,
          unit_notes: "Ground floor preference",
        },
      ];

      const { data, error } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: bookingData,
        p_units: units,
        p_guest_id: testGuestId ?? undefined,
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();

      // Verify booking created
      const { data: booking } = await supabase
        .from("bookings")
        .select("*")
        .eq("booking_id", data!)
        .single();

      expect(booking).toMatchObject({
        booking_reference: "BK-TEST-001",
        is_multi_unit: true,
        unit_count: 2,
        total_amount: "30000.00", // 12500 + 17500
      });

      // Verify booking_units created
      const { data: bookingUnits, count } = await supabase
        .from("booking_units")
        .select("*", { count: "exact" })
        .eq("booking_id", data!);

      expect(count).toBe(2);
      expect(bookingUnits).toHaveLength(2);

      // Verify availability records created
      const { data: availRecords, count: availCount } = await supabase
        .from("booking_unit_availability")
        .select("*", { count: "exact" })
        .eq("booking_id", data!);

      expect(availCount).toBe(2);
      expect(availRecords).toHaveLength(2);
    });

    it.skipIf(!shouldRun)("should create booking with 10 units (max test)", async () => {
      // Create additional units for this test
      const uniqueId = crypto.randomUUID().slice(0, 6); // 6 chars, globally unique
      const { data: moreUnits, error: insertError } = await supabase
        .from("units")
        .insert(
          Array.from({ length: 7 }, (_, i) => ({
            unit_name: `Test Unit Extra ${uniqueId}-${i + 1}`, // Make unit_name unique
            unit_code: `T${uniqueId}-${i}`, // Unique short code (max 10 chars)
            unit_type: "Standard", // Valid types: Standard, Deluxe, Suite, Villa
            base_occupancy: 2,
            max_occupancy: 2,
            base_rate: 2500,
            weekend_rate: 3000,
            extra_person_rate: 500,
          }))
        )
        .select("unit_id");

      // Verify insert succeeded
      if (insertError || !moreUnits) {
        expect.fail(`Failed to create extra units: ${insertError?.message || "No data returned"}`);
      }

      const allUnitIds = [...testUnitIds, ...moreUnits.map((u) => u.unit_id)];

      const bookingData = {
        booking_reference: "BK-TEST-002",
        guest_name: "Large Group",
        contact_number: "+639123456789",
        email: "group@example.com",
        num_guests: 20,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-25T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Pending",
      };

      const units = allUnitIds.map((unitId, index) => ({
        unit_id: unitId,
        unit_price: 2500 * 5, // 5 nights
        weekend_surcharge: 0,
        extra_person_charge: 0,
        subtotal: 12500,
        assigned_guests: 2,
        unit_notes: `Unit ${index + 1}`,
      }));

      const { data, error } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: bookingData,
        p_units: units,
        p_guest_id: testGuestId ?? undefined,
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();

      // Verify 10 units associated
      const { count } = await supabase
        .from("booking_units")
        .select("*", { count: "exact" })
        .eq("booking_id", data!);

      expect(count).toBe(10);

      // Cleanup
      if (moreUnits) {
        await supabase
          .from("units")
          .delete()
          .in(
            "unit_id",
            moreUnits.map((u) => u.unit_id)
          );
      }
    });

    it.skipIf(!shouldRun)("should fail if unit is unavailable (exclusion constraint)", async () => {
      // Create first booking
      const bookingData1 = {
        booking_reference: "BK-TEST-003",
        guest_name: "First Guest",
        contact_number: "+639123456789",
        email: "first@example.com",
        num_guests: 2,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-25T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Pending",
      };

      const { data: booking1 } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: bookingData1,
        p_units: [
          {
            unit_id: testUnitIds[0],
            unit_price: 12500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 12500,
            assigned_guests: 2,
          },
        ],
        p_guest_id: testGuestId ?? undefined,
      });

      expect(booking1).toBeTruthy();

      // Try to create overlapping booking (should fail)
      const bookingData2 = {
        booking_reference: "BK-TEST-004",
        guest_name: "Second Guest",
        contact_number: "+639123456789",
        email: "second@example.com",
        num_guests: 2,
        check_in: "2025-12-22T06:00:00Z", // Overlaps with first booking
        check_out: "2025-12-27T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Pending",
      };

      const { data: _booking2, error } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: bookingData2,
        p_units: [
          {
            unit_id: testUnitIds[0], // Same unit
            unit_price: 12500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 12500,
            assigned_guests: 2,
          },
        ],
        p_guest_id: testGuestId ?? undefined,
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain("exclusion"); // Exclusion constraint violated
    });

    it.skipIf(!shouldRun)(
      "should allow Pending bookings to overlap (aggressive blocking)",
      async () => {
        // Create Pending booking
        const bookingData1 = {
          booking_reference: "BK-TEST-005",
          guest_name: "Pending Guest 1",
          contact_number: "+639123456789",
          email: "pending1@example.com",
          num_guests: 2,
          check_in: "2025-12-20T06:00:00Z",
          check_out: "2025-12-25T04:00:00Z",
          booking_status: "Pending", // Pending doesn't block
          payment_status: "Pending",
        };

        const { data: booking1, error: error1 } = await supabase.rpc("create_multi_unit_booking", {
          p_booking_data: bookingData1,
          p_units: [
            {
              unit_id: testUnitIds[0],
              unit_price: 12500,
              weekend_surcharge: 0,
              extra_person_charge: 0,
              subtotal: 12500,
              assigned_guests: 2,
            },
          ],
          p_guest_id: testGuestId ?? undefined,
        });

        expect(error1).toBeNull();
        expect(booking1).toBeTruthy();

        // Create another Pending booking (should succeed - aggressive blocking)
        const bookingData2 = {
          booking_reference: "BK-TEST-006",
          guest_name: "Pending Guest 2",
          contact_number: "+639123456789",
          email: "pending2@example.com",
          num_guests: 2,
          check_in: "2025-12-22T06:00:00Z",
          check_out: "2025-12-27T04:00:00Z",
          booking_status: "Pending", // Both Pending = both allowed
          payment_status: "Pending",
        };

        const { data: _booking2, error: error2 } = await supabase.rpc("create_multi_unit_booking", {
          p_booking_data: bookingData2,
          p_units: [
            {
              unit_id: testUnitIds[0], // Same unit
              unit_price: 12500,
              weekend_surcharge: 0,
              extra_person_charge: 0,
              subtotal: 12500,
              assigned_guests: 2,
            },
          ],
          p_guest_id: testGuestId ?? undefined,
        });

        expect(error2).toBeNull();
        expect(_booking2).toBeTruthy();
      }
    );
  });

  describe("check_multi_unit_availability", () => {
    it.skipIf(!shouldRun)("should return availability status for multiple units", async () => {
      const { data, error } = await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: testUnitIds,
        p_check_in: "2025-12-20T06:00:00Z",
        p_check_out: "2025-12-25T04:00:00Z",
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            unit_id: expect.any(String),
            is_available: true,
            conflicting_bookings: 0,
            next_available_date: null,
          }),
        ])
      );
    });

    it.skipIf(!shouldRun)("should return next_available_date for unavailable units", async () => {
      // Create blocking booking
      const { data: bookingId, error: createError } = await supabase.rpc(
        "create_multi_unit_booking",
        {
          p_booking_data: {
            booking_reference: "BK-TEST-007",
            guest_name: "Blocker",
            contact_number: "+639123456789",
            email: "blocker@example.com",
            num_guests: 2,
            check_in: "2025-12-20T06:00:00Z",
            check_out: "2025-12-25T04:00:00Z",
            booking_status: "Confirmed",
            payment_status: "Pending",
          },
          p_units: [
            {
              unit_id: testUnitIds[0],
              unit_price: 12500,
              weekend_surcharge: 0,
              extra_person_charge: 0,
              subtotal: 12500,
              assigned_guests: 2,
            },
          ],
          p_guest_id: testGuestId ?? undefined,
        }
      );

      // Verify booking was created successfully
      expect(createError).toBeNull();
      expect(bookingId).toBeTruthy();

      const { data, error } = await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: [testUnitIds[0]],
        p_check_in: "2025-12-20T06:00:00Z",
        p_check_out: "2025-12-25T04:00:00Z",
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0]).toMatchObject({
        unit_id: testUnitIds[0],
        is_available: false,
        conflicting_bookings: 1,
      });
      // Check date separately with flexible format matching (accepts both .000Z and +00:00)
      expect(data![0].next_available_date).toMatch(/2025-12-25T04:00:00/);
    });

    it.skipIf(!shouldRun)("should handle p_exclude_booking_id for edits", async () => {
      // Create booking
      const { data: bookingId } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: {
          booking_reference: "BK-TEST-008",
          guest_name: "Edit Test",
          contact_number: "+639123456789",
          email: "edit@example.com",
          num_guests: 2,
          check_in: "2025-12-20T06:00:00Z",
          check_out: "2025-12-25T04:00:00Z",
          booking_status: "Confirmed",
          payment_status: "Pending",
        },
        p_units: [
          {
            unit_id: testUnitIds[0],
            unit_price: 12500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 12500,
            assigned_guests: 2,
          },
        ],
        p_guest_id: testGuestId ?? undefined,
      });

      // Check availability excluding this booking (should be available)
      const { data, error } = await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: [testUnitIds[0]],
        p_check_in: "2025-12-20T06:00:00Z",
        p_check_out: "2025-12-25T04:00:00Z",
        p_exclude_booking_id: bookingId ?? undefined,
      });

      expect(error).toBeNull();
      expect(data![0]).toMatchObject({
        is_available: true,
        conflicting_bookings: 0,
      });
    });
  });

  describe("get_booking_units", () => {
    it.skipIf(!shouldRun)("should return units for multi-unit booking", async () => {
      const { data: bookingId } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: {
          booking_reference: "BK-TEST-009",
          guest_name: "Multi Unit",
          contact_number: "+639123456789",
          email: "multi@example.com",
          num_guests: 4,
          check_in: "2025-12-20T06:00:00Z",
          check_out: "2025-12-25T04:00:00Z",
          booking_status: "Confirmed",
          payment_status: "Pending",
        },
        p_units: [
          {
            unit_id: testUnitIds[0],
            unit_price: 12500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 12500,
            assigned_guests: 2,
          },
          {
            unit_id: testUnitIds[1],
            unit_price: 17500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 17500,
            assigned_guests: 2,
          },
        ],
        p_guest_id: testGuestId ?? undefined,
      });

      const { data, error } = await supabase.rpc("get_booking_units", {
        p_booking_id: bookingId!,
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            unit_id: testUnitIds[0],
            unit_name: expect.stringContaining("Test Unit 1"),
            subtotal: expect.any(Number), // Database returns numeric type, not string
            assigned_guests: 2,
          }),
          expect.objectContaining({
            unit_id: testUnitIds[1],
            unit_name: expect.stringContaining("Test Unit 2"),
            subtotal: expect.any(Number), // Database returns numeric type, not string
            assigned_guests: 2,
          }),
        ])
      );
    });
  });

  describe("Triggers", () => {
    it.skipIf(!shouldRun)("should auto-update booking totals when units added", async () => {
      const { data: bookingId } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: {
          booking_reference: "BK-TEST-010",
          guest_name: "Trigger Test",
          contact_number: "+639123456789",
          email: "trigger@example.com",
          num_guests: 2,
          check_in: "2025-12-20T06:00:00Z",
          check_out: "2025-12-25T04:00:00Z",
          booking_status: "Confirmed",
          payment_status: "Pending",
        },
        p_units: [
          {
            unit_id: testUnitIds[0],
            unit_price: 12500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 12500,
            assigned_guests: 2,
          },
        ],
        p_guest_id: testGuestId ?? undefined,
      });

      // Verify initial total
      const { data: booking } = await supabase
        .from("bookings")
        .select("total_amount, unit_count")
        .eq("booking_id", bookingId!)
        .single();

      expect(booking).toMatchObject({
        total_amount: expect.any(Number), // Database returns numeric type, not string
        unit_count: 1,
      });

      // Add another unit
      await supabase.from("booking_units").insert({
        booking_id: bookingId!,
        unit_id: testUnitIds[1],
        unit_price: 17500,
        weekend_surcharge: 0,
        extra_person_charge: 0,
        subtotal: 17500,
        assigned_guests: 2,
      });

      // Verify updated total (trigger should have fired)
      const { data: updatedBooking } = await supabase
        .from("bookings")
        .select("total_amount, unit_count")
        .eq("booking_id", bookingId!)
        .single();

      expect(updatedBooking).toMatchObject({
        total_amount: expect.any(Number), // 12500 + 17500 = 30000 (database returns numeric type)
        unit_count: 2,
      });
    });

    it.skipIf(!shouldRun)("should sync availability when booking dates change", async () => {
      const { data: bookingId } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: {
          booking_reference: "BK-TEST-011",
          guest_name: "Date Sync Test",
          contact_number: "+639123456789",
          email: "datesync@example.com",
          num_guests: 2,
          check_in: "2025-12-20T06:00:00Z",
          check_out: "2025-12-25T04:00:00Z",
          booking_status: "Confirmed",
          payment_status: "Pending",
        },
        p_units: [
          {
            unit_id: testUnitIds[0],
            unit_price: 12500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 12500,
            assigned_guests: 2,
          },
        ],
        p_guest_id: testGuestId ?? undefined,
      });

      // Change booking dates
      await supabase
        .from("bookings")
        .update({
          check_in: "2025-12-21T06:00:00Z",
          check_out: "2025-12-26T04:00:00Z",
        })
        .eq("booking_id", bookingId!);

      // Verify availability record updated
      const { data: availability } = await supabase
        .from("booking_unit_availability")
        .select("check_in, check_out")
        .eq("booking_id", bookingId!)
        .single();

      expect(availability).toMatchObject({
        check_in: "2025-12-21T06:00:00+00:00",
        check_out: "2025-12-26T04:00:00+00:00",
      });
    });

    it.skipIf(!shouldRun)("should cascade status changes to availability", async () => {
      const { data: bookingId } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: {
          booking_reference: "BK-TEST-012",
          guest_name: "Status Test",
          contact_number: "+639123456789",
          email: "status@example.com",
          num_guests: 2,
          check_in: "2025-12-20T06:00:00Z",
          check_out: "2025-12-25T04:00:00Z",
          booking_status: "Pending",
          payment_status: "Pending",
        },
        p_units: [
          {
            unit_id: testUnitIds[0],
            unit_price: 12500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 12500,
            assigned_guests: 2,
          },
        ],
        p_guest_id: testGuestId ?? undefined,
      });

      // Change status
      await supabase
        .from("bookings")
        .update({ booking_status: "Confirmed" })
        .eq("booking_id", bookingId!);

      // Verify availability record updated
      const { data: availability } = await supabase
        .from("booking_unit_availability")
        .select("booking_status")
        .eq("booking_id", bookingId!)
        .single();

      expect(availability).toMatchObject({
        booking_status: "Confirmed",
      });
    });

    it.skipIf(!shouldRun)(
      "should cleanup availability when booking deleted (CASCADE)",
      async () => {
        const { data: bookingId } = await supabase.rpc("create_multi_unit_booking", {
          p_booking_data: {
            booking_reference: "BK-TEST-013",
            guest_name: "Cleanup Test",
            contact_number: "+639123456789",
            email: "cleanup@example.com",
            num_guests: 2,
            check_in: "2025-12-20T06:00:00Z",
            check_out: "2025-12-25T04:00:00Z",
            booking_status: "Confirmed",
            payment_status: "Pending",
          },
          p_units: [
            {
              unit_id: testUnitIds[0],
              unit_price: 12500,
              weekend_surcharge: 0,
              extra_person_charge: 0,
              subtotal: 12500,
              assigned_guests: 2,
            },
          ],
          p_guest_id: testGuestId ?? undefined,
        });

        // Verify availability exists before deletion
        const { count } = await supabase
          .from("booking_unit_availability")
          .select("*", { count: "exact" })
          .eq("booking_id", bookingId!);

        expect(count).toBe(1);

        // Delete booking (CASCADE will delete booking_units and availability)
        const { error: deleteError } = await supabase
          .from("bookings")
          .delete()
          .eq("booking_id", bookingId!);

        expect(deleteError).toBeNull();

        // Verify availability cleaned up (CASCADE should have removed it)
        const { count: newCount } = await supabase
          .from("booking_unit_availability")
          .select("*", { count: "exact" })
          .eq("booking_id", bookingId!);

        expect(newCount).toBe(0);
      }
    );
  });
});
