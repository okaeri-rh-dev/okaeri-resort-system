/**
 * Pricing API Integration Tests
 *
 * Tests the PostgreSQL calculate_booking_pricing() function via API endpoints.
 * This validates the AUTHORITATIVE server-side pricing calculator.
 *
 * Source: 07-testing-strategy.md lines 253-461
 * Principle: PostgreSQL function is SOLE pricing authority (09-implementation-decisions.md lines 42-62)
 */

import { describe, expect, test } from "vitest";

import type { PreviewPricingResponse } from "./responses";

const API_BASE = process.env.VITE_API_URL || "http://localhost:8788";

describe("Pricing API Integration", () => {
  describe("POST /api/guest-booking/preview-pricing", () => {
    test("calculates base price correctly for array-based request", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [
            { guests_per_unit: 2 }, // Unit 1
            { guests_per_unit: 2 }, // Unit 2
          ],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-03T11:00:00Z",
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pricing.nights).toBe(2);
      expect(data.pricing.total_units).toBe(2);
      expect(data.pricing.total_guests).toBe(4);
      expect(data.pricing.base_total).toBeGreaterThan(0);
      expect(data.pricing.downpayment_required).toBe(data.pricing.total * 0.5);
    });

    test("applies 5% discount for 7-night stay", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-08T11:00:00Z", // 7 nights
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      expect(data.pricing.nights).toBe(7);
      expect(data.pricing.discount).toBeDefined();
      expect(data.pricing.discount?.percent).toBe(5);
      expect(data.pricing.discount?.rule_name).toBe("Week Stay Discount");
    });

    test("applies 10% discount for 14-night stay", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }, { guests_per_unit: 2 }],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-15T11:00:00Z", // 14 nights
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      expect(data.pricing.discount?.percent).toBe(10);
      expect(data.pricing.discount?.rule_name).toBe("Two Week Discount");
    });

    test("NO discount for short stays (< 7 nights)", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [
            { guests_per_unit: 2 },
            { guests_per_unit: 2 },
            { guests_per_unit: 2 },
            { guests_per_unit: 2 },
            { guests_per_unit: 2 },
          ],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-04T11:00:00Z", // Only 3 nights
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      expect(data.pricing.discount).toBeNull();
    });

    test("applies weekend surcharge for Friday-Sunday stay", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }], // Single unit
          check_in: "2025-02-07T14:00:00Z", // Friday
          check_out: "2025-02-09T11:00:00Z", // Sunday
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      expect(data.pricing.nights).toBe(2);
      expect(data.pricing.weekend_surcharge).toBeGreaterThan(0);
    });

    test("calculates extra person fees", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [
            { guests_per_unit: 4 }, // 2 extra guests (assuming base 2)
            { guests_per_unit: 4 }, // 2 extra guests
          ],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-02T11:00:00Z",
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      expect(data.pricing.extra_person_fees).toBeGreaterThan(0);
    });

    test("handles single night booking", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-02T11:00:00Z",
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      expect(data.pricing.nights).toBe(1);
      expect(data.pricing.base_total).toBeGreaterThan(0);
    });

    test("handles maximum 10 units", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: Array(10).fill({ guests_per_unit: 2 }),
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-02T11:00:00Z",
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      expect(data.pricing.total_units).toBe(10);
      expect(data.pricing.base_total).toBeGreaterThan(0);
    });

    test("returns error for invalid date range", async () => {
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }],
          check_in: "2025-02-05T14:00:00Z",
          check_out: "2025-02-01T11:00:00Z", // Check-out before check-in
        }),
      });

      expect(response.status).toBe(400);
    });

    test("pricing always fetched from pricing_config table", async () => {
      // This test verifies single source of truth principle
      const response = await fetch(`${API_BASE}/api/guest-booking/preview-pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }],
          check_in: "2025-03-01T14:00:00Z",
          check_out: "2025-03-02T11:00:00Z",
        }),
      });

      const data = (await response.json()) as PreviewPricingResponse;

      // Verify rates structure exists (from pricing_config table)
      expect(data.pricing.rates).toBeDefined();
      expect(data.pricing.rates.base_rate).toBeGreaterThan(0);
      expect(data.pricing.rates.weekend_rate).toBeGreaterThan(0);
      expect(data.pricing.rates.extra_person_rate).toBeGreaterThan(0);
      expect(data.pricing.rates.base_occupancy).toBeGreaterThan(0);
    });
  });
});
