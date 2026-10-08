/**
 * Idempotency and Concurrency Tests
 *
 * Validates:
 * - Duplicate request detection via idempotency keys
 * - Concurrent unit assignment conflicts
 * - PostgreSQL EXCLUDE constraint enforcement
 *
 * Source: 07-testing-strategy.md lines 1641-1762
 *
 * @vitest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";

const API_BASE = process.env.VITE_API_URL || "http://localhost:8788";

// Use test database URL with fallback to local Supabase
const TEST_SUPABASE_URL =
  process.env.TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const TEST_SERVICE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(TEST_SUPABASE_URL, TEST_SERVICE_KEY);

describe("Idempotency and Concurrency", () => {
  describe("Idempotency Key Detection", () => {
    test("prevents duplicate booking creation with same key", async () => {
      const idempotencyKey = crypto.randomUUID();
      const bookingData = {
        idempotency_key: idempotencyKey,
        guest_name: "Idempotency Test",
        email: "idem@test.example.com",
        phone_number: "+639171234567",
        check_in: "2025-03-01T14:00:00Z",
        check_out: "2025-03-03T11:00:00Z",
        unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }],
        turnstile_token: "1x00000000000000000000AA",
        terms_accepted: true,
      };

      // First request
      const response1 = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      const data1 = await response1.json();
      expect(response1.status).toBe(201);
      expect(data1.success).toBe(true);

      // Second request with SAME idempotency key
      const response2 = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bookingData,
          guest_name: "Different Name", // Different data
          email: "different@test.example.com",
        }),
      });

      const data2 = await response2.json();

      // Should return existing booking (not create new one)
      expect(response2.status).toBe(200);
      expect(data2.booking.booking_id).toBe(data1.booking.booking_id);
      expect(data2.is_duplicate).toBe(true);
    });

    test("allows new booking with different key", async () => {
      const bookingTemplate = {
        guest_name: "Unique Key Test",
        email: "unique@test.example.com",
        phone_number: "+639181234567",
        check_in: "2025-04-01T14:00:00Z",
        check_out: "2025-04-03T11:00:00Z",
        unit_requests: [{ guests_per_unit: 2 }],
        turnstile_token: "1x00000000000000000000AA",
        terms_accepted: true,
      };

      // First booking
      const response1 = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bookingTemplate,
          idempotency_key: crypto.randomUUID(),
        }),
      });

      const data1 = await response1.json();

      // Second booking with DIFFERENT key
      const response2 = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bookingTemplate,
          idempotency_key: crypto.randomUUID(), // Different key
        }),
      });

      const data2 = await response2.json();

      // Should create NEW booking
      expect(response2.status).toBe(201);
      expect(data2.booking.booking_id).not.toBe(data1.booking.booking_id);
    });
  });

  describe("Concurrent Unit Assignment", () => {
    test.skip("prevents double-booking when two admins assign same unit (TODO: Update to test booking_unit_availability EXCLUDE constraint)", async () => {
      const unitId = `test-unit-${crypto.randomUUID()}`;
      const booking1Id = crypto.randomUUID();
      const booking2Id = crypto.randomUUID();
      const dates = {
        check_in: "2025-05-01",
        check_out: "2025-05-05",
      };

      // Create two clients simulating two admins
      const admin1 = createClient(TEST_SUPABASE_URL, TEST_SERVICE_KEY);
      const admin2 = createClient(TEST_SUPABASE_URL, TEST_SERVICE_KEY);

      // Both admins try to assign same unit simultaneously
      const results = await Promise.allSettled([
        admin1.from("booking_units").insert({
          booking_id: booking1Id,
          unit_id: unitId,
          check_in_date: dates.check_in,
          check_out_date: dates.check_out,
          status: "confirmed",
        }),
        admin2.from("booking_units").insert({
          booking_id: booking2Id,
          unit_id: unitId,
          check_in_date: dates.check_in,
          check_out_date: dates.check_out,
          status: "confirmed",
        }),
      ]);

      // Exactly one should succeed, one should fail (EXCLUDE constraint)
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Verify failed one has constraint violation error
      const error = failed[0].reason;
      expect(error.code).toBe("23P01"); // PostgreSQL exclusion constraint
    });

    test("allows concurrent assignment of different units", async () => {
      const bookingId = crypto.randomUUID();
      const units = [
        `test-unit-${crypto.randomUUID()}`,
        `test-unit-${crypto.randomUUID()}`,
        `test-unit-${crypto.randomUUID()}`,
      ];
      const dates = {
        check_in: "2025-06-01",
        check_out: "2025-06-05",
      };

      // Assign all units concurrently
      const results = await Promise.allSettled(
        units.map((unitId) =>
          supabase.from("booking_units").insert({
            booking_id: bookingId,
            unit_id: unitId,
            check_in_date: dates.check_in,
            check_out_date: dates.check_out,
            status: "confirmed",
          })
        )
      );

      // All should succeed (different units)
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    });
  });
});
