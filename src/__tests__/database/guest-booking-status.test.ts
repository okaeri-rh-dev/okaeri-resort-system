/**
 * Regression: POST /api/guest-booking/status embedded `unit:units(...)`, but
 * bookings.unit_id was dropped by 20251017000000_unified_multi_unit. PostgREST
 * answered PGRST200 ("no relationship between bookings and units"), so every
 * real guest got BOOKING_NOT_FOUND. Runs the real handler against local Supabase.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { onRequestPost } from "../../../functions/api/guest-booking/status";
import {
  cleanupTestData,
  createTestBooking,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
  testSupabaseAdmin,
} from "../setup/test-db";

const memoryKv = new Map<string, string>();
const fakeKv = {
  get: async (key: string) => memoryKv.get(key) ?? null,
  put: async (key: string, value: string) => void memoryKv.set(key, value),
  delete: async (key: string) => void memoryKv.delete(key),
};

describe("POST /api/guest-booking/status against the real schema", () => {
  let shouldRun = false;
  const bookingReference = `BK-2026-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const guestEmail = `status-${crypto.randomUUID().slice(0, 8)}@test.example.com`;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;

    const unitSuffix = crypto.randomUUID().slice(0, 6);
    const unit = await createTestUnit({
      unit_name: `Status Cabin ${unitSuffix}`,
      unit_code: `ST-${unitSuffix}`,
      unit_type: "Standard",
    });
    const guest = await createTestGuest({ email: guestEmail });
    const booking = await createTestBooking({
      guest,
      unit,
      booking_reference: bookingReference,
      email: guestEmail,
    });
    await testSupabaseAdmin
      .from("bookings")
      .update({ is_guest_booking: true })
      .eq("booking_id", booking.booking_id);
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("finds a guest booking by reference and email and names its unit", async () => {
    if (!shouldRun) return;

    const request = new Request("http://localhost/api/guest-booking/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
      body: JSON.stringify({ booking_reference: bookingReference, email: guestEmail }),
    });

    const response = await onRequestPost({
      request,
      env: {
        SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? "http://localhost:54321",
        SUPABASE_SERVICE_ROLE_KEY: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
        RATE_LIMIT_KV: fakeKv,
        ENVIRONMENT: "development",
      },
    } as never);

    const body = (await response.json()) as { booking_reference?: string; unit_name?: string };
    expect(response.status).toBe(200);
    expect(body.booking_reference).toBe(bookingReference);
    expect(body.unit_name).toMatch(/^Status Cabin /);
  });
});
