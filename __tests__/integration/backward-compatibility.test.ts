/**
 * Backward Compatibility Tests
 *
 * Ensures API accepts both legacy (single-unit) and new (multi-unit) formats.
 *
 * Source: 07-testing-strategy.md lines 1769-1860
 */

import { describe, expect, test } from "vitest";

import type { GuestBookingResponse } from "./responses";

const API_BASE = process.env.VITE_API_URL || "http://localhost:8788";

describe("API Backward Compatibility", () => {
  test("accepts legacy single-unit payload", async () => {
    const legacyPayload = {
      idempotency_key: crypto.randomUUID(),
      unit_id: "unit-legacy-test", // Old field
      num_guests: 4, // Old field
      guest_name: "Legacy Test Guest",
      email: "legacy@test.example.com",
      phone_number: "+639171234567",
      check_in: "2025-03-01T14:00:00Z",
      check_out: "2025-03-05T11:00:00Z",
      special_requests: "Late check-in",
      turnstile_token: "1x00000000000000000000AA",
      terms_accepted: true,
    };

    const response = await fetch(`${API_BASE}/api/guest-booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(legacyPayload),
    });

    const data = (await response.json()) as GuestBookingResponse;

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.booking).toBeDefined();
  });

  test("accepts new multi-unit payload", async () => {
    const multiUnitPayload = {
      idempotency_key: crypto.randomUUID(),
      unit_requests: [
        { guests_per_unit: 3 }, // Array-based: Unit 1
        { guests_per_unit: 3 }, // Unit 2
        { guests_per_unit: 4 }, // Unit 3
      ],
      guest_name: "Multi-Unit Test",
      email: "multi@test.example.com",
      phone_number: "+639181234567",
      check_in: "2025-03-01T14:00:00Z",
      check_out: "2025-03-05T11:00:00Z",
      special_requests: "Adjacent units preferred",
      turnstile_token: "1x00000000000000000000AA",
      terms_accepted: true,
    };

    const response = await fetch(`${API_BASE}/api/guest-booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(multiUnitPayload),
    });

    const data = (await response.json()) as GuestBookingResponse;

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.booking).toBeDefined();
    expect(data.booking.requested_unit_count).toBe(3);
  });

  test("rejects invalid mixed payload", async () => {
    const invalidPayload = {
      idempotency_key: crypto.randomUUID(),
      unit_id: "unit-mixed-test", // Legacy field
      unit_requests: [
        { guests_per_unit: 2 }, // New field (array-based)
      ],
      guest_name: "Invalid Mix",
      email: "invalid@test.example.com",
      phone_number: "+639191234567",
      check_in: "2025-03-01T14:00:00Z",
      check_out: "2025-03-05T11:00:00Z",
      turnstile_token: "1x00000000000000000000AA",
      terms_accepted: true,
      // Both present - should fail validation
    };

    const response = await fetch(`${API_BASE}/api/guest-booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(400); // Bad Request
  });
});
