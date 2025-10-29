/**
 * Booking API Integration Tests
 *
 * Tests the complete guest booking API flow including:
 * - Multi-unit booking creation
 * - Validation and error handling
 * - Rate limiting
 * - Discount application
 *
 * NOTE: Uses native fetch() API (Node 18+) instead of Supertest for:
 * - Better cross-platform compatibility (works in browser and Node)
 * - Simpler syntax without Express dependency
 * - Modern JavaScript standard
 *
 * Source: 07-testing-strategy.md lines 696-864
 */

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import validMultiUnit from "../../tests/fixtures/bookings/valid-multi-unit.json";
import validSingleUnit from "../../tests/fixtures/bookings/valid-single-unit.json";

const API_BASE = process.env.VITE_API_URL || "http://localhost:8788";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe("Guest Booking API Integration", () => {
  let testBookingIds: string[] = [];

  afterAll(async () => {
    // Cleanup test data
    if (testBookingIds.length > 0) {
      await supabase.from("bookings").delete().in("booking_id", testBookingIds);
    }
  });

  describe("POST /api/guest-booking", () => {
    test("creates multi-unit booking successfully", async () => {
      const payload = {
        ...validMultiUnit,
        idempotency_key: crypto.randomUUID(), // Unique key for test
      };

      const response = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": payload.idempotency_key,
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.booking).toBeDefined();
      expect(data.booking.booking_reference).toMatch(/^BK-\d{10}$/);
      expect(data.booking.downpayment_required).toBeGreaterThan(0);

      testBookingIds.push(data.booking.booking_id);
    });

    test("creates single-unit booking successfully", async () => {
      const payload = {
        ...validSingleUnit,
        idempotency_key: crypto.randomUUID(),
      };

      const response = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": payload.idempotency_key,
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.booking.is_multi_unit).toBe(false);

      testBookingIds.push(data.booking.booking_id);
    });

    test("applies duration-based discount for week-long booking", async () => {
      const payload = {
        idempotency_key: crypto.randomUUID(),
        guest_name: "Discount Test",
        email: "discount@test.example.com",
        phone_number: "+639171234567",
        check_in: "2025-03-01T14:00:00Z",
        check_out: "2025-03-08T11:00:00Z", // 7 nights
        unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }],
        turnstile_token: "1x00000000000000000000AA",
        terms_accepted: true,
      };

      const response = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      expect(data.booking.discount_applied).toBeDefined();
      expect(data.booking.discount_applied.percent).toBe(5); // Week stay discount
      expect(data.booking.discount_applied.rule_name).toBe("Week Stay Discount");

      testBookingIds.push(data.booking.booking_id);
    });

    test("validates input correctly", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: "A", // Too short
          email: "invalid-email",
          unit_requests: [], // Empty array - invalid
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.details).toBeDefined();
    });

    test("rejects booking exceeding guest capacity", async () => {
      const payload = {
        idempotency_key: crypto.randomUUID(),
        guest_name: "Capacity Test",
        email: "capacity@test.example.com",
        phone_number: "+639181234567",
        check_in: "2025-05-01T14:00:00Z",
        check_out: "2025-05-08T11:00:00Z",
        unit_requests: [{ guests_per_unit: 25 }], // Exceeds max_capacity_per_unit (20)
        turnstile_token: "1x00000000000000000000AA",
        terms_accepted: true,
      };

      const response = await fetch(`${API_BASE}/api/guest-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Maximum");
      expect(data.error).toContain("guests per unit");
    });
  });

  describe("GET /api/guest-booking/rates", () => {
    test("retrieves static rates from pricing_config", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/rates`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.rates).toBeDefined();
      expect(data.rates.base_rate).toBeGreaterThan(0);
      expect(data.rates.weekend_rate).toBeGreaterThan(0);
      expect(data.rates.extra_person_rate).toBeGreaterThan(0);
      expect(data.rates.base_occupancy).toBeGreaterThan(0);
      expect(data.rates.max_capacity_per_unit).toBeGreaterThan(0);
    });
  });

  describe("GET /api/guest-booking/discount-rules", () => {
    test("retrieves active discount rules", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/discount-rules`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.discount_rules).toBeDefined();
      expect(Array.isArray(data.discount_rules)).toBe(true);
      expect(data.discount_rules.length).toBeGreaterThan(0);

      // Verify discount rule structure
      const firstRule = data.discount_rules[0];
      expect(firstRule.name).toBeDefined();
      expect(firstRule.conditions).toBeDefined();
      expect(firstRule.discount_value).toBeGreaterThan(0);
    });
  });
});
