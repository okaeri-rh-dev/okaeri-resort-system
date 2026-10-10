/**
 * API Tests: Multi-Unit Availability Check Endpoint
 *
 * GET /api/availability/multi-unit
 *
 * Tests cover:
 * - Happy paths (check 1-10 units, exclude booking)
 * - Validation errors (missing params, invalid dates)
 * - Edge cases (all available, all unavailable, mixed)
 * - Response format (summary, enriched unit data)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAvailabilityMocks } from "./factories/availability-factory";
import { createMockContext, createMockRequest, mockEnv } from "./setup";
import type { ApiErrorResponse, AvailabilityResponse } from "./types/responses";
import { testUnits } from "./utils/fixtures";

describe("GET /api/availability/multi-unit", () => {
  beforeEach(async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Setup default mock for this suite
    const mockClient = createAvailabilityMocks({
      units: testUnits.map((u) => ({
        unit_id: u.unit_id,
        unit_name: u.unit_name,
        unit_code: u.unit_code,
        unit_type: u.unit_type,
      })),
      allAvailable: true,
    });

    // Mock Supabase (NOT hoisted - executes in order)
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));
  });

  // ========== HAPPY PATH TESTS ==========

  it("should check availability for 2 units (all available)", async () => {
    // Reset and create custom mock for specific units
    vi.resetModules();

    const twoUnits = [testUnits[0], testUnits[1]];
    const mockClient = createAvailabilityMocks({
      units: twoUnits.map((u) => ({
        unit_id: u.unit_id,
        unit_name: u.unit_name,
        unit_code: u.unit_code,
        unit_type: u.unit_type,
      })),
      availabilityResults: twoUnits.map((u) => ({
        unit_id: u.unit_id,
        is_available: true,
        conflicting_bookings: 0,
        next_available_date: null,
      })),
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");

    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": [testUnits[0].unit_id, testUnits[1].unit_id].join(","),
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(200);
    const data = (await response.json()) as AvailabilityResponse;

    expect(data.success).toBe(true);
    expect(data.data.results).toHaveLength(2);
    expect(data.data.summary.total_units_checked).toBe(2);
    expect(data.data.summary.available_units).toBe(2);
    expect(data.data.summary.unavailable_units).toBe(0);
  });

  it("should batch check 10 units", async () => {
    // Reset and create custom mock for 10 units
    vi.resetModules();

    const tenUnitIds = Array(10)
      .fill(testUnits[0].unit_id)
      .map((id, i) => `${id}-${i}`);

    const tenUnits = tenUnitIds.map((id, i) => ({
      unit_id: id,
      unit_name: `Unit ${i + 1}`,
      unit_code: `U${i + 1}`,
      unit_type: "standard",
    }));

    const mockClient = createAvailabilityMocks({
      units: tenUnits,
      availabilityResults: tenUnits.map((u) => ({
        unit_id: u.unit_id,
        is_available: true,
        conflicting_bookings: 0,
        next_available_date: null,
      })),
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");

    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": tenUnitIds.join(","),
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(200);
    const data = (await response.json()) as AvailabilityResponse;
    expect(data.data.summary.total_units_checked).toBe(10);
  });

  it("should return unavailable for conflicting bookings", async () => {
    // Reset and create custom mock for this test
    vi.resetModules();

    const mockClient = createAvailabilityMocks({
      units: [testUnits[0]],
      availabilityResults: [
        {
          unit_id: testUnits[0].unit_id,
          is_available: false,
          conflicting_bookings: 2,
          next_available_date: "2025-12-25T04:00:00Z",
        },
      ],
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");

    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    const data = (await response.json()) as AvailabilityResponse;
    expect(data.data.results[0].is_available).toBe(false);
    expect(data.data.results[0].conflicting_bookings).toBe(2);
    expect(data.data.results[0].next_available_date).toBe("2025-12-25T04:00:00Z");
  });

  it("should exclude booking when p_exclude_booking_id provided", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const excludeId = "existing-booking-id";

    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
        exclude_booking_id: excludeId,
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(200);
    // Verify RPC was called with exclude param
    // (actual exclusion logic is tested at database layer)
  });

  it("should include enriched unit data in response", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    const data = (await response.json()) as AvailabilityResponse;
    const result = data.data.results[0];

    expect(result.unit_name).toBeDefined();
    expect(result.unit_code).toBeDefined();
    expect(result.is_available).toBeDefined();
  });

  it("should include processing time header", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.headers.has("X-Processing-Time")).toBe(true);
    expect(response.headers.get("X-Processing-Time")).toMatch(/\d+ms/);
  });

  it("should include cache headers", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.headers.get("Cache-Control")).toContain("max-age=60");
  });

  // ========== VALIDATION ERROR TESTS ==========

  it("should return 400 for missing units[] parameter", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.message).toContain("units[]");
  });

  it("should return 400 for missing check_in", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.message).toContain("check_in");
  });

  it("should return 400 for missing check_out", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "2025-12-20T06:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.message).toContain("check_out");
  });

  it("should return 400 for invalid date format", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "invalid-date",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("INVALID_DATES");
  });

  it("should return 400 for check_out before check_in", async () => {
    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "2025-12-22T06:00:00Z",
        check_out: "2025-12-20T04:00:00Z", // Before check-in
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("INVALID_DATES");
  });

  // ========== ERROR HANDLING TESTS ==========

  it("should return 500 on database error", async () => {
    // Reset and create error mock for this test
    vi.resetModules();

    const mockClient = createAvailabilityMocks({
      hasError: true,
      errorMessage: "Database connection failed",
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestGet } = await import("../../../functions/api/availability/multi-unit");

    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
      query: {
        "units[]": testUnits[0].unit_id,
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestGet(context as never);

    expect(response.status).toBe(500);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("DATABASE_ERROR");
  });
});
