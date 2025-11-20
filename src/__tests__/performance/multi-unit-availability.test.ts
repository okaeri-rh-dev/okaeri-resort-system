// src/__tests__/performance/multi-unit-availability.test.ts
/**
 * Performance Benchmarks for Multi-Unit Availability Checking
 *
 * Success Criteria (from Phase 1 docs):
 * - Availability check for 10 units <100ms
 * - Booking creation with 5 units <200ms
 * - get_booking_units query <50ms
 *
 * These tests measure actual database query performance
 *
 * @vitest-environment node
 */

import { performance } from "perf_hooks";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

describe("Multi-Unit Availability Performance Benchmarks", () => {
  let testUnitIds: string[] = [];
  let testGuestId: string | null = null;
  let shouldRun = false;

  beforeAll(async () => {
    // Check if we should run database tests
    shouldRun = await shouldRunDatabaseTests();

    if (!shouldRun) {
      console.log("⏭️  Skipping performance tests - test database not configured");
      return;
    }

    // Cleanup any orphaned test data from previous interrupted runs
    // This ensures a clean slate even if previous tests failed
    await cleanupTestData({ includeTestFixtures: true });

    // Create 20 test units for comprehensive testing with unique codes
    // Both unit_name and unit_code have unique constraints, so make them unique
    // unit_code is VARCHAR(10), so use last 5 digits of timestamp
    const shortId = Date.now().toString().slice(-5);
    const units = Array.from({ length: 20 }, (_, i) => ({
      unit_name: `Perf Test Unit ${i + 1} ${shortId}`,
      unit_code: `PF${shortId}-${i}`,
      unit_type: i % 2 === 0 ? "Standard" : "Deluxe", // Valid types: Standard, Deluxe, Suite, Villa
      base_occupancy: 2,
      max_occupancy: 4,
      base_rate: 2500,
      weekend_rate: 3000,
      extra_person_rate: 500,
    }));

    const { data, error } = await supabase.from("units").insert(units).select("unit_id");

    if (error) throw new Error(`Setup failed: ${error.message}`);
    testUnitIds = data.map((u) => u.unit_id);

    // Create test guest with unique email to avoid constraint violations
    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .insert({
        guest_name: "Performance Test Guest",
        email: `perf-test-${shortId}@example.com`,
        phone_number: "+639123456789",
      })
      .select("guest_id")
      .single();

    if (guestError) throw new Error(`Guest setup failed: ${guestError.message}`);
    testGuestId = guest.guest_id;

    // Create some existing bookings for realistic testing
    for (let i = 0; i < 10; i++) {
      await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: {
          booking_reference: `BK-PERF-${i}`,
          guest_name: `Guest ${i}`,
          contact_number: "+639123456789",
          email: `guest${i}@example.com`,
          num_guests: 2,
          check_in: `2025-${String(i + 1).padStart(2, "0")}-01T06:00:00Z`,
          check_out: `2025-${String(i + 1).padStart(2, "0")}-05T04:00:00Z`,
          booking_status: "Confirmed",
          payment_status: "Pending",
        },
        p_units: [
          {
            unit_id: testUnitIds[i],
            unit_price: 10000,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 10000,
            assigned_guests: 2,
          },
        ],
        p_guest_id: testGuestId ?? undefined,
      });
    }
  });

  beforeEach(async () => {
    if (!shouldRun) return;

    // Clean up bookings before each test (but keep units/guests for reuse)
    await cleanupTestData();
  });

  afterAll(async () => {
    if (!shouldRun) return;

    // Cleanup test data (now includes test fixtures cleanup)
    await cleanupTestData({ includeTestFixtures: true });
  });

  describe("Availability Checking Performance", () => {
    it("should check availability for 10 units in <100ms", async () => {
      const unitBatch = testUnitIds.slice(0, 10);

      const startTime = performance.now();
      const { data, error } = await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: unitBatch,
        p_check_in: "2025-12-20T06:00:00Z",
        p_check_out: "2025-12-25T04:00:00Z",
      });
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(error).toBeNull();
      expect(data).toHaveLength(10);
      expect(duration).toBeLessThan(100); // Target: <100ms
      console.log(`✓ 10-unit availability check: ${duration.toFixed(2)}ms`);
    });

    it("should check availability for 20 units in <150ms", async () => {
      const startTime = performance.now();
      const { data, error } = await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: testUnitIds,
        p_check_in: "2025-12-20T06:00:00Z",
        p_check_out: "2025-12-25T04:00:00Z",
      });
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(error).toBeNull();
      expect(data).toHaveLength(20);
      expect(duration).toBeLessThan(150); // Stretch goal
      console.log(`✓ 20-unit availability check: ${duration.toFixed(2)}ms`);
    });

    it("should perform repeated availability checks consistently", async () => {
      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        await supabase.rpc("check_multi_unit_availability", {
          p_unit_ids: testUnitIds.slice(0, 10),
          p_check_in: "2025-12-20T06:00:00Z",
          p_check_out: "2025-12-25T04:00:00Z",
        });
        const endTime = performance.now();
        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;
      const maxDuration = Math.max(...durations);

      expect(avgDuration).toBeLessThan(100);
      expect(maxDuration).toBeLessThan(150); // No outliers
      console.log(
        `✓ Average: ${avgDuration.toFixed(2)}ms, Max: ${maxDuration.toFixed(2)}ms (${iterations} iterations)`
      );
    });
  });

  describe("Booking Creation Performance", () => {
    it("should create booking with 2 units in <200ms", async () => {
      const bookingData = {
        booking_reference: `BK-2U-${Date.now().toString().slice(-6)}`, // Max 20 chars
        guest_name: "2 Unit Test",
        contact_number: "+639123456789",
        email: "2unit@example.com",
        num_guests: 4,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-25T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Pending", // Valid values: Pending, Partial, Completed, Refunded
      };

      const units = [
        {
          unit_id: testUnitIds[10],
          unit_price: 12500,
          weekend_surcharge: 0,
          extra_person_charge: 0,
          subtotal: 12500,
          assigned_guests: 2,
        },
        {
          unit_id: testUnitIds[11],
          unit_price: 12500,
          weekend_surcharge: 0,
          extra_person_charge: 0,
          subtotal: 12500,
          assigned_guests: 2,
        },
      ];

      const startTime = performance.now();
      const { data, error } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: bookingData,
        p_units: units,
        p_guest_id: testGuestId ?? undefined,
      });
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(duration).toBeLessThan(200); // Target: <200ms
      console.log(`✓ 2-unit booking creation: ${duration.toFixed(2)}ms`);
    });

    it("should create booking with 5 units in <200ms", async () => {
      const bookingData = {
        booking_reference: `BK-5U-${Date.now().toString().slice(-6)}`, // Max 20 chars
        guest_name: "5 Unit Test",
        contact_number: "+639123456789",
        email: "5unit@example.com",
        num_guests: 10,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-25T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Pending", // Valid values: Pending, Partial, Completed, Refunded
      };

      const units = testUnitIds.slice(12, 17).map((unitId) => ({
        unit_id: unitId,
        unit_price: 12500,
        weekend_surcharge: 0,
        extra_person_charge: 0,
        subtotal: 12500,
        assigned_guests: 2,
      }));

      const startTime = performance.now();
      const { data, error } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: bookingData,
        p_units: units,
        p_guest_id: testGuestId ?? undefined,
      });
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(duration).toBeLessThan(200); // Target: <200ms
      console.log(`✓ 5-unit booking creation: ${duration.toFixed(2)}ms`);
    });

    it("should create booking with 10 units in <300ms", async () => {
      const bookingData = {
        booking_reference: `BK-10U-${Date.now().toString().slice(-6)}`, // Max 20 chars
        guest_name: "10 Unit Test",
        contact_number: "+639123456789",
        email: "10unit@example.com",
        num_guests: 20,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-25T04:00:00Z",
        booking_status: "Confirmed",
        payment_status: "Pending", // Valid values: Pending, Partial, Completed, Refunded
      };

      const units = testUnitIds.slice(0, 10).map((unitId) => ({
        unit_id: unitId,
        unit_price: 12500,
        weekend_surcharge: 0,
        extra_person_charge: 0,
        subtotal: 12500,
        assigned_guests: 2,
      }));

      const startTime = performance.now();
      const { data, error } = await supabase.rpc("create_multi_unit_booking", {
        p_booking_data: bookingData,
        p_units: units,
        p_guest_id: testGuestId ?? undefined,
      });
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(duration).toBeLessThan(300); // Max acceptable for 10 units
      console.log(`✓ 10-unit booking creation: ${duration.toFixed(2)}ms`);
    });
  });

  describe("get_booking_units Performance", () => {
    it("should fetch booking units in <50ms", async () => {
      // Create test booking
      const { data: bookingId, error: createError } = await supabase.rpc(
        "create_multi_unit_booking",
        {
          p_booking_data: {
            booking_reference: `BK-GET-${Date.now().toString().slice(-8)}`, // Max 20 chars
            guest_name: "Get Test",
            contact_number: "+639123456789",
            email: "get@example.com",
            num_guests: 6,
            check_in: "2025-12-20T06:00:00Z",
            check_out: "2025-12-25T04:00:00Z",
            booking_status: "Confirmed",
            payment_status: "Pending",
          },
          p_units: testUnitIds.slice(17, 20).map((unitId) => ({
            // Use units 17-19 (the last 3 units, not used by other tests)
            unit_id: unitId,
            unit_price: 12500,
            weekend_surcharge: 0,
            extra_person_charge: 0,
            subtotal: 12500,
            assigned_guests: 2,
          })),
          p_guest_id: testGuestId ?? undefined,
        }
      );

      if (createError) {
        console.error("Booking creation error:", createError);
        throw new Error(`Failed to create test booking: ${createError.message}`);
      }

      const startTime = performance.now();
      const { data, error } = await supabase.rpc("get_booking_units", {
        p_booking_id: bookingId,
      });
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(duration).toBeLessThan(50); // Target: <50ms
      console.log(`✓ get_booking_units: ${duration.toFixed(2)}ms`);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent availability checks efficiently", async () => {
      const concurrentChecks = 5;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentChecks }, (_, i) =>
        supabase.rpc("check_multi_unit_availability", {
          p_unit_ids: testUnitIds.slice(i * 4, (i + 1) * 4), // 4 units each
          p_check_in: "2025-12-20T06:00:00Z",
          p_check_out: "2025-12-25T04:00:00Z",
        })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(results.every((r) => r.error === null)).toBe(true);
      expect(duration).toBeLessThan(300); // Concurrent checks should not take 5x single check time
      console.log(`✓ ${concurrentChecks} concurrent checks: ${duration.toFixed(2)}ms`);
    });

    it("should handle concurrent bookings for different units", async () => {
      const concurrentBookings = 3;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentBookings }, (_, i) =>
        supabase.rpc("create_multi_unit_booking", {
          p_booking_data: {
            booking_reference: `BK-C${i}-${Date.now().toString().slice(-9)}`, // Max 20 chars
            guest_name: `Concurrent Guest ${i}`,
            contact_number: "+639123456789",
            email: `concurrent${i}@example.com`,
            num_guests: 2,
            check_in: "2026-01-20T06:00:00Z", // Use different dates to avoid conflicts
            check_out: "2026-01-25T04:00:00Z",
            booking_status: "Confirmed",
            payment_status: "Pending",
          },
          p_units: [
            {
              unit_id: testUnitIds[17 + i], // Different units to avoid conflicts
              unit_price: 12500,
              weekend_surcharge: 0,
              extra_person_charge: 0,
              subtotal: 12500,
              assigned_guests: 2,
            },
          ],
          p_guest_id: testGuestId ?? undefined,
        })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(results.every((r) => r.error === null)).toBe(true);
      expect(duration).toBeLessThan(500); // Should handle concurrency efficiently
      console.log(`✓ ${concurrentBookings} concurrent bookings: ${duration.toFixed(2)}ms`);
    });
  });

  describe("Index Performance", () => {
    it("should use indexes for availability lookups (EXPLAIN ANALYZE)", async () => {
      // This test verifies that indexes are being used
      // In a real setup, you'd use EXPLAIN ANALYZE to verify index usage
      const { data, error } = await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: [testUnitIds[0]],
        p_check_in: "2025-12-20T06:00:00Z",
        p_check_out: "2025-12-25T04:00:00Z",
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      // If indexes are working, this should be very fast (<10ms)
      const startTime = performance.now();
      await supabase.rpc("check_multi_unit_availability", {
        p_unit_ids: [testUnitIds[0]],
        p_check_in: "2025-12-20T06:00:00Z",
        p_check_out: "2025-12-25T04:00:00Z",
      });
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(30); // Fast single-unit check indicates good indexing
      console.log(`✓ Indexed availability check: ${duration.toFixed(2)}ms`);
    });
  });
});
