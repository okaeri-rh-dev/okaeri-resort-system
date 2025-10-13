/**
 * API Tests: Pricing Quote Endpoint
 *
 * POST /api/pricing/quote
 *
 * Tests cover:
 * - Happy paths (weekend surcharge, extra persons, single/multi unit)
 * - Validation errors (empty units, invalid dates, invalid inputs)
 * - Edge cases (max units, weekday-only, boundary conditions)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { onRequestPost } from "../../../functions/api/pricing/quote";
import { createMockRequest, createMockContext, mockEnv } from "./setup";
import { testUnits, testPricingRequest } from "./utils/fixtures";
import type { PricingQuoteResponse, ApiErrorResponse } from "./types/responses";

describe("POST /api/pricing/quote", () => {
  beforeEach(() => {
    // Mock Supabase to return test units
    vi.mock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        from: vi.fn((table: string) => {
          if (table === "units") {
            return {
              select: vi.fn(() => ({
                eq: vi.fn((_column: string, value: any) => ({
                  single: vi.fn(() => {
                    const unit = testUnits.find((u) => u.unit_id === value);
                    return {
                      data: unit || null,
                      error: unit ? null : { message: "Unit not found" },
                    };
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      })),
    }));
  });

  // ========== HAPPY PATH TESTS ==========

  it("should calculate pricing for 2 units with weekend surcharge", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [
          { unit_id: testUnits[0].unit_id, guests: 2 },
          { unit_id: testUnits[1].unit_id, guests: 2 },
        ],
        check_in: "2025-12-20T06:00:00Z", // Friday
        check_out: "2025-12-22T04:00:00Z", // Sunday (2 nights: Fri-Sat, Sat-Sun)
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
    const data = (await response.json()) as PricingQuoteResponse;

    expect(data.total_amount).toBeGreaterThan(0);
    expect(data.nights).toBe(2);
    expect(data.units).toHaveLength(2);

    // Friday and Saturday are weekends, should have surcharge
    expect(data.units[0].weekend_surcharge).toBeGreaterThan(0);
    expect(data.units[1].weekend_surcharge).toBeGreaterThan(0);
  });

  it("should calculate pricing for 1 unit (single-unit booking)", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }],
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
    const data = (await response.json()) as PricingQuoteResponse;

    expect(data.units).toHaveLength(1);
    expect(data.total_amount).toBe(data.units[0].subtotal);
  });

  it("should calculate extra person charges correctly", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 4 }], // 2 extra persons (base_occupancy = 2)
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z", // 2 nights
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    const data = (await response.json()) as PricingQuoteResponse;
    const unit = data.units[0];

    // 2 extra persons × ₱500 × 2 nights = ₱2,000
    expect(unit.extra_person_charge).toBe(2000);
    expect(unit.subtotal).toBe(unit.base_amount + unit.extra_person_charge);
  });

  it("should handle weekday-only stays (no weekend surcharge)", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }],
        check_in: "2025-12-15T06:00:00Z", // Monday
        check_out: "2025-12-17T04:00:00Z", // Wednesday (2 nights: Mon-Tue, Tue-Wed)
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    const data = (await response.json()) as PricingQuoteResponse;
    const unit = data.units[0];

    // No weekends, so surcharge should be 0
    expect(unit.weekend_surcharge).toBe(0);
    // Base amount should be base_rate * nights
    expect(unit.base_amount).toBe(testUnits[0].base_rate * 2);
  });

  it("should handle maximum units (10 units)", async () => {
    const units = Array(10)
      .fill(null)
      .map(() => ({ unit_id: testUnits[0].unit_id, guests: 2 }));

    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
    const data = (await response.json()) as PricingQuoteResponse;
    expect(data.units).toHaveLength(10);
    expect(data.total_amount).toBeGreaterThan(0);
  });

  it("should calculate pricing with mixed weekend and weekday nights", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }],
        check_in: "2025-12-19T06:00:00Z", // Thursday
        check_out: "2025-12-22T04:00:00Z", // Sunday (3 nights: Thu-Fri, Fri-Sat, Sat-Sun)
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    const data = (await response.json()) as PricingQuoteResponse;
    expect(data.nights).toBe(3);

    // Should have weekend surcharge for Friday and Saturday
    const unit = data.units[0];
    expect(unit.weekend_surcharge).toBeGreaterThan(0);
  });

  // ========== VALIDATION ERROR TESTS ==========

  it("should return 400 for empty units array", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [],
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.message).toContain("units");
  });

  it("should return 400 for check_out before check_in", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }],
        check_in: "2025-12-22T06:00:00Z",
        check_out: "2025-12-20T04:00:00Z", // Before check-in!
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("INVALID_DATES");
    expect(data.message).toContain("check_out");
  });

  it("should return 400 for invalid date format", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }],
        check_in: "not-a-date",
        check_out: "2025-12-22T04:00:00Z",
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("INVALID_DATES");
  });

  it("should return 400 for missing check_in", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }],
        check_out: "2025-12-22T04:00:00Z",
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.message).toContain("check_in");
  });

  it("should return 400 for missing check_out", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }],
        check_in: "2025-12-20T06:00:00Z",
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.message).toContain("check_out");
  });

  // ========== EDGE CASE TESTS ==========

  it("should handle 0 extra persons correctly", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }], // Exactly base_occupancy
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    const data = (await response.json()) as PricingQuoteResponse;
    expect(data.units[0].extra_person_charge).toBe(0);
  });

  it("should handle 1 night stay correctly", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify({
        units: [{ unit_id: testUnits[0].unit_id, guests: 2 }],
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-21T04:00:00Z", // 1 night
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    const data = (await response.json()) as PricingQuoteResponse;
    expect(data.nights).toBe(1);
    expect(data.units[0].base_amount).toBeGreaterThan(0);
  });

  it("should include processing time header", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify(testPricingRequest),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.headers.has("X-Processing-Time")).toBe(true);
    const processingTime = response.headers.get("X-Processing-Time");
    expect(processingTime).toMatch(/\d+ms/);
  });

  it("should include cache headers", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/quote", {
      method: "POST",
      body: JSON.stringify(testPricingRequest),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as any);

    expect(response.headers.has("Cache-Control")).toBe(true);
    expect(response.headers.get("Cache-Control")).toContain("max-age=300");
  });
});
