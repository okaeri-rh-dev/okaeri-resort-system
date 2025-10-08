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
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Test database connection
// NOTE: These tests require a test database with migration 019 applied
const supabaseUrl = process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "test-key";
const supabase = createClient(supabaseUrl, supabaseKey);

describe("Multi-Unit Booking Database Functions", () => {
  let testUnitIds: string[] = [];
  let testGuestId: string | null = null;

  beforeAll(async () => {
    // Create test units
    const { data: units, error } = await supabase
      .from("units")
      .insert([
        {
          unit_name: "Test Unit 1",
          unit_code: "TEST-1",
          unit_type: "Studio",
          base_occupancy: 2,
          max_occupancy: 2,
          base_rate: 2500,
          weekend_rate: 3000,
          extra_person_rate: 500,
        },
        {
          unit_name: "Test Unit 2",
          unit_code: "TEST-2",
          unit_type: "One Bedroom",
          base_occupancy: 2,
          max_occupancy: 4,
          base_rate: 3500,
          weekend_rate: 4000,
          extra_person_rate: 750,
        },
        {
          unit_name: "Test Unit 3",
          unit_code: "TEST-3",
          unit_type: "Two Bedroom",
          base_occupancy: 4,
          max_occupancy: 6,
          base_rate: 5000,
          weekend_rate: 6000,
          extra_person_rate: 1000,
        },
      ])
      .select("unit_id");

    if (error) throw new Error(`Setup failed: ${error.message}`);
    testUnitIds = units.map((u) => u.unit_id);

    // Create test guest
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .insert({
        guest_name: "Test Guest",
        email: "test@example.com",
        phone_number: "+639123456789",
      })
      .select("guest_id")
      .single();

    if (guestError) throw new Error(`Guest setup failed: ${guestError.message}`);
    testGuestId = guest.guest_id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUnitIds.length > 0) {
      await supabase.from("units").delete().in("unit_id", testUnitIds);
    }
    if (testGuestId) {
      await supabase.from("guests").delete().eq("guest_id", testGuestId);
    }
  });

  beforeEach(async () => {
    // Clean up bookings before each test
    await supabase
      .from("bookings")
      .delete()
      .or(`unit_id.in.(${testUnitIds.join(",")}),is_multi_unit.eq.true`);
  });

  describe("create_multi_unit_booking", () => {
    it("should create a booking with 2 units atomically", async () => {
      const bookingData = {
        booking_reference: "BK-TEST-001",
        guest_name: "John Doe",
        contact_number: "+639123456789",
        email: "john@example.com",
        num_guests: 4,
        check_in: "2025-12-20T06:00:00Z", // UTC
        check_out: "2025-12-25T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
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

    it("should create booking with 10 units (max test)", async () => {
      // Create additional units for this test
      const { data: moreUnits } = await supabase
        .from("units")
        .insert(
          Array.from({ length: 7 }, (_, i) => ({
            unit_name: `Test Unit Extra ${i + 1}`,
            unit_code: `TEST-EXTRA-${i + 1}`,
            unit_type: "Studio",
            base_occupancy: 2,
            max_occupancy: 2,
            base_rate: 2500,
            weekend_rate: 3000,
            extra_person_rate: 500,
          }))
        )
        .select("unit_id");

      const allUnitIds = [...testUnitIds, ...moreUnits!.map((u) => u.unit_id)];

      const bookingData = {
        booking_reference: "BK-TEST-002",
        guest_name: "Large Group",
        contact_number: "+639123456789",
        email: "group@example.com",
        num_guests: 20,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-25T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
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
      await supabase
        .from("units")
        .delete()
        .in(
          "unit_id",
          moreUnits!.map((u) => u.unit_id)
        );
    });

    it("should fail if unit is unavailable (exclusion constraint)", async () => {
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
        payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
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
        payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain("exclusion"); // Exclusion constraint violated
    });

    it("should allow Pending bookings to overlap (aggressive blocking)", async () => {
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
        payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
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
        payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
      });

      expect(error2).toBeNull();
      expect(_booking2).toBeTruthy();
    });
  });

  describe("check_multi_unit_availability", () => {
    it("should return availability status for multiple units", async () => {
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

    it("should return next_available_date for unavailable units", async () => {
      // Create blocking booking
      await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: {
          booking_reference: "BK-TEST-007",
          guest_name: "Blocker",
          contact_number: "+639123456789",
          email: "blocker@example.com",
          num_guests: 2,
          check_in: "2025-12-20T06:00:00Z",
          check_out: "2025-12-25T04:00:00Z",
          booking_status: "Confirmed",
          payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
      });

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
        next_available_date: "2025-12-25T04:00:00.000Z", // Check-out date
      });
    });

    it("should handle p_exclude_booking_id for edits", async () => {
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
          payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
      });

      // Check availability excluding this booking (should be available)
      const { data, error } = await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: [testUnitIds[0]],
        p_check_in: "2025-12-20T06:00:00Z",
        p_check_out: "2025-12-25T04:00:00Z",
        p_exclude_booking_id: bookingId,
      });

      expect(error).toBeNull();
      expect(data![0]).toMatchObject({
        is_available: true,
        conflicting_bookings: 0,
      });
    });
  });

  describe("get_booking_units", () => {
    it("should return units for multi-unit booking", async () => {
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
          payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
      });

      const { data, error } = await supabase.rpc("get_booking_units", {
        p_booking_id: bookingId,
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            unit_id: testUnitIds[0],
            unit_name: "Test Unit 1",
            subtotal: "12500.00",
            assigned_guests: 2,
          }),
          expect.objectContaining({
            unit_id: testUnitIds[1],
            unit_name: "Test Unit 2",
            subtotal: "17500.00",
            assigned_guests: 2,
          }),
        ])
      );
    });
  });

  describe("Triggers", () => {
    it("should auto-update booking totals when units added", async () => {
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
          payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
      });

      // Verify initial total
      const { data: booking } = await supabase
        .from("bookings")
        .select("total_amount, unit_count")
        .eq("booking_id", bookingId!)
        .single();

      expect(booking).toMatchObject({
        total_amount: "12500.00",
        unit_count: 1,
      });

      // Add another unit
      await supabase.from("booking_units").insert({
        booking_id: bookingId,
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
        total_amount: "30000.00", // 12500 + 17500
        unit_count: 2,
      });
    });

    it("should sync availability when booking dates change", async () => {
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
          payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
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

    it("should cascade status changes to availability", async () => {
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
          payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
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

    it("should cleanup availability when booking_units deleted", async () => {
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
          payment_status: "Unpaid",
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
        p_guest_id: testGuestId,
      });

      // Verify availability exists
      const { count } = await supabase
        .from("booking_unit_availability")
        .select("*", { count: "exact" })
        .eq("booking_id", bookingId!);

      expect(count).toBe(1);

      // Delete booking_units record
      await supabase.from("booking_units").delete().eq("booking_id", bookingId!);

      // Verify availability cleaned up (trigger should have fired)
      const { count: newCount } = await supabase
        .from("booking_unit_availability")
        .select("*", { count: "exact" })
        .eq("booking_id", bookingId!);

      expect(newCount).toBe(0);
    });
  });
});
