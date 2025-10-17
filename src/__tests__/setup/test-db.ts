/**
 * Test Database Configuration
 *
 * Provides test database client and utilities for:
 * - Isolated test environment
 * - Data cleanup between tests
 * - Test fixture creation
 * - Safe test execution
 *
 * Phase 4.5: Test Infrastructure Setup
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// ✅ Use dedicated test database or local Supabase instance
const TEST_SUPABASE_URL =
  process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://localhost:54321";
const TEST_SUPABASE_ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const TEST_SERVICE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Create test clients
export const testSupabase = createClient<Database>(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);

export const testSupabaseAdmin = createClient<Database>(TEST_SUPABASE_URL, TEST_SERVICE_KEY);

/**
 * Cleanup helper - call in beforeEach/afterAll
 * Deletes test data in reverse dependency order to avoid foreign key violations
 *
 * Options:
 * - includeTestFixtures: if true, also deletes test units/guests with recognizable test patterns
 *   Patterns: unit_name/code contain 'Test', 'test', 'Perf', or start with 'PF'
 *             guest email contains 'test' or 'perf-test'
 */
export async function cleanupTestData(options?: { includeTestFixtures?: boolean }) {
  if (!testSupabaseAdmin) {
    console.warn("Test Supabase admin client not available");
    return;
  }

  try {
    // Delete in reverse dependency order
    // Note: audit_logs table may not exist yet, so we ignore errors

    try {
      await testSupabaseAdmin
        .from("audit_logs")
        .delete()
        .neq("audit_id", "00000000-0000-0000-0000-000000000000");
    } catch (e) {
      // Table may not exist yet
    }

    await testSupabaseAdmin
      .from("payments")
      .delete()
      .neq("payment_id", "00000000-0000-0000-0000-000000000000");

    await testSupabaseAdmin
      .from("booking_unit_availability")
      .delete()
      .neq("booking_id", "00000000-0000-0000-0000-000000000000");

    await testSupabaseAdmin
      .from("booking_units")
      .delete()
      .neq("booking_unit_id", "00000000-0000-0000-0000-000000000000");

    await testSupabaseAdmin
      .from("bookings")
      .delete()
      .neq("booking_id", "00000000-0000-0000-0000-000000000000");

    // Cleanup test fixtures if requested (pattern-based, safe for real data)
    if (options?.includeTestFixtures) {
      // Delete test units by pattern (test names/codes)
      // Patterns: "Test Unit", "Perf Test", codes like "TEST-", "T1-", "T2-", "T3-", "PF"
      const { data: testUnits, error: unitsError } = await testSupabaseAdmin
        .from("units")
        .select("unit_id")
        .or(
          `unit_name.ilike.%Test Unit%,unit_name.ilike.%Perf Test%,unit_code.ilike.TEST-%,unit_code.ilike.T1-%,unit_code.ilike.T2-%,unit_code.ilike.T3-%,unit_code.ilike.PF%`
        );

      if (!unitsError && testUnits && testUnits.length > 0) {
        const unitIds = testUnits.map((u) => u.unit_id);
        await testSupabaseAdmin.from("units").delete().in("unit_id", unitIds);
        console.log(`Cleaned up ${unitIds.length} test units`);
      }

      // Delete test guests by pattern (test emails)
      const { data: testGuests, error: guestsError } = await testSupabaseAdmin
        .from("guests")
        .select("guest_id")
        .or(`email.ilike.%test%@example.com,email.ilike.%perf-test%@example.com`);

      if (!guestsError && testGuests && testGuests.length > 0) {
        const guestIds = testGuests.map((g) => g.guest_id);
        await testSupabaseAdmin.from("guests").delete().in("guest_id", guestIds);
        console.log(`Cleaned up ${guestIds.length} test guests`);
      }
    }

    console.log("Test data cleanup completed");
  } catch (error) {
    console.error("Test cleanup error:", error);
    // Don't throw - cleanup failures shouldn't break test setup
  }
}

/**
 * Create test unit fixture
 */
export async function createTestUnit(overrides: Partial<any> = {}) {
  const { data, error } = await testSupabaseAdmin
    .from("units")
    .insert({
      unit_name: overrides.unit_name || `Test Unit ${Date.now()}`,
      unit_code: overrides.unit_code || `TEST-${Date.now().toString().slice(-4)}`,
      unit_type: overrides.unit_type || "Standard",
      base_rate: overrides.base_rate || 2000,
      weekend_rate: overrides.weekend_rate || 2500,
      max_occupancy: overrides.max_occupancy || 4,
      base_occupancy: overrides.base_occupancy || 2,
      extra_person_rate: overrides.extra_person_rate || 500,
      unit_status: overrides.unit_status || "Available",
      // description field removed - not in database schema
      ...overrides,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create test unit:", error);
    throw error;
  }

  return data;
}

/**
 * Create test guest fixture
 */
export async function createTestGuest(overrides: Partial<any> = {}) {
  const timestamp = Date.now();
  const { data, error } = await testSupabaseAdmin
    .from("guests")
    .insert({
      guest_name: overrides.guest_name || `Test Guest ${timestamp}`,
      email: overrides.email || `test${timestamp}@example.com`,
      phone_number: overrides.phone_number || `+6391${timestamp.toString().slice(-8)}`,
      ...overrides,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create test guest:", error);
    throw error;
  }

  return data;
}

/**
 * Create test booking fixture
 * Uses the unified multi-unit pattern (via create_multi_unit_booking function)
 */
export async function createTestBooking(overrides: Partial<any> = {}) {
  // Ensure we have a test guest and unit
  const guest = overrides.guest || (await createTestGuest());
  const unit = overrides.unit || (await createTestUnit());

  const checkIn = overrides.check_in || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
  const checkOut = overrides.check_out || new Date(checkIn.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days later

  // Use the database function to create booking with multi-unit pattern
  const { data: bookingId, error } = await testSupabaseAdmin.rpc("create_multi_unit_booking", {
    p_booking_data: {
      booking_reference: overrides.booking_reference || `TEST-BK-${Date.now()}`,
      guest_name: guest.guest_name,
      email: guest.email,
      contact_number: guest.phone_number,
      check_in: checkIn.toISOString(),
      check_out: checkOut.toISOString(),
      num_guests: overrides.num_guests || 2,
      booking_status: overrides.booking_status || "Confirmed",
      payment_status: overrides.payment_status || "Paid",
      total_amount: overrides.total_amount || 5000,
      ...overrides,
    },
    p_units: [
      {
        unit_id: unit.unit_id,
        unit_price: overrides.unit_price || 4000,
        weekend_surcharge: overrides.weekend_surcharge || 0,
        extra_person_charge: overrides.extra_person_charge || 0,
        subtotal: overrides.subtotal || 5000,
        assigned_guests: overrides.num_guests || 2,
      },
    ],
    p_guest_id: guest.guest_id,
  });

  if (error) {
    console.error("Failed to create test booking:", error);
    throw error;
  }

  // Fetch the complete booking with junction table data
  const { data: booking } = await testSupabaseAdmin
    .from("bookings")
    .select(
      `
      *,
      booking_units (
        *,
        unit:units (*)
      )
    `
    )
    .eq("booking_id", bookingId)
    .single();

  return booking;
}

/**
 * Create multi-unit test booking
 */
export async function createTestMultiUnitBooking(unitCount: number = 2) {
  const guest = await createTestGuest();
  const units = await Promise.all(
    Array.from({ length: unitCount }, (_, i) => createTestUnit({ unit_name: `Test Unit ${i + 1}` }))
  );

  const checkIn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const checkOut = new Date(checkIn.getTime() + 2 * 24 * 60 * 60 * 1000);

  // Use the database function to create multi-unit booking
  const { data: bookingId, error } = await testSupabaseAdmin.rpc("create_multi_unit_booking", {
    p_booking_data: {
      booking_reference: `TEST-MU-${Date.now()}`,
      guest_name: guest.guest_name,
      email: guest.email,
      contact_number: guest.phone_number,
      check_in: checkIn.toISOString(),
      check_out: checkOut.toISOString(),
      num_guests: unitCount * 2,
      booking_status: "Confirmed",
      payment_status: "Paid",
    },
    p_units: units.map((unit) => ({
      unit_id: unit.unit_id,
      unit_price: 4000,
      weekend_surcharge: 0,
      extra_person_charge: 0,
      subtotal: 4000,
      assigned_guests: 2,
    })),
    p_guest_id: guest.guest_id,
  });

  if (error) {
    console.error("Failed to create multi-unit test booking:", error);
    throw error;
  }

  // Fetch the complete booking
  const { data: booking } = await testSupabaseAdmin
    .from("bookings")
    .select("*, booking_units(*), unit:units(*)")
    .eq("booking_id", bookingId)
    .single();

  return booking;
}

/**
 * Wait for database to be ready
 */
export async function waitForDatabase(maxAttempts: number = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { error } = await testSupabase.from("units").select("unit_id").limit(1);

      if (!error) {
        console.log("Test database is ready");
        return true;
      }
    } catch (e) {
      console.log(`Database not ready (attempt ${i + 1}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, 1000)); // Wait 1 second
    }
  }

  console.warn("Test database not available after", maxAttempts, "attempts");
  return false;
}

/**
 * Setup function to call at the start of test suites
 */
export async function setupTestDatabase() {
  const isReady = await waitForDatabase();

  if (!isReady) {
    console.warn("⚠️  Test database is not available. Tests requiring database will be skipped.");
    console.warn("   Set TEST_SUPABASE_URL and TEST_SUPABASE_ANON_KEY to run database tests.");
  }

  return isReady;
}

// Export a helper to check if tests should run
export async function shouldRunDatabaseTests(): Promise<boolean> {
  if (!TEST_SUPABASE_URL || TEST_SUPABASE_URL === "http://localhost:54321") {
    if (!TEST_SERVICE_KEY) {
      return false;
    }
  }

  // Use admin client for availability check (bypasses RLS)
  for (let i = 0; i < 2; i++) {
    try {
      const { error } = await testSupabaseAdmin.from("units").select("unit_id").limit(1);

      if (!error) {
        console.log("Test database is ready");
        return true;
      }
    } catch (e) {
      console.log(`Database not ready (attempt ${i + 1}/2)`);
      await new Promise((r) => setTimeout(r, 1000)); // Wait 1 second
    }
  }

  console.warn("Test database not available after 2 attempts");
  return false;
}
