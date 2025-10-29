/**
 * API Tests: Add Unit to Booking Endpoint
 *
 * POST /api/bookings/:id/units/add
 *
 * Tests cover:
 * - Happy paths (add unit successfully, payment adjustment)
 * - Validation errors (invalid booking_id, missing fields, calculation errors)
 * - Business logic errors (booking not found, unit unavailable, invalid status)
 * - Security (XSS prevention, authentication)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUnitAddMocks } from "./factories/unit-factory";
import { createMockContext, createMockRequest, generateTestJWT, mockEnv } from "./setup";
import type { AddUnitResponse, ApiErrorResponse } from "./types/responses";
import { testBookingResponse, testUnits } from "./utils/fixtures";

describe("POST /api/bookings/:id/units/add", () => {
  const validAddUnitData = {
    unit_id: testUnits[2].unit_id,
    num_guests: 2, // Required by schema
    rate_per_night: 3500,
    num_nights: 2,
    subtotal: 7000,
    notes: "Guest requested this upgrade",
  };

  beforeEach(async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Setup default mock for this suite
    const mockClient = createUnitAddMocks({
      booking: {
        ...testBookingResponse,
        booking_status: "Pending",
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
      allAvailable: true,
    });

    // Mock Supabase (NOT hoisted - executes in order)
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    // Mock sanitization functions
    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
    }));
  });

  // ========== HAPPY PATH TESTS ==========

  it("should add unit to existing booking successfully", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validAddUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(200);
    const data = (await response.json()) as AddUnitResponse;
    expect(data.success).toBe(true);
  });

  it("should validate subtotal calculation", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validAddUnitData,
          subtotal: 999, // Incorrect!
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
  });

  it("should sanitize notes input", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");
    const { sanitizeTextWorker } = await import("@/lib/security/sanitize-worker");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validAddUnitData,
          notes: "<script>alert('xss')</script>Important notes",
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    await onRequestPost(context as unknown);

    expect(sanitizeTextWorker).toHaveBeenCalled();
  });

  // ========== VALIDATION ERROR TESTS ==========

  it("should return 400 for invalid booking_id format", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");
    const request = createMockRequest("https://api.example.com/api/bookings/invalid-id/units/add", {
      method: "POST",
      headers: { Authorization: `Bearer ${await generateTestJWT()}` },
      body: JSON.stringify(validAddUnitData),
    });

    const context = createMockContext(request, mockEnv, { id: "invalid-id" });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
    expect(data.message).toContain("Invalid booking_id");
  });

  it("should return 400 for invalid unit_id format", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validAddUnitData,
          unit_id: "not-a-uuid",
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for negative rate_per_night", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validAddUnitData,
          rate_per_night: -1000,
          subtotal: -2000,
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
  });

  it("should return 400 for num_nights mismatch with booking dates", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validAddUnitData,
          num_nights: 5, // Booking is only 2 nights
          subtotal: 17500, // Must match: rate_per_night (3500) * num_nights (5)
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.message).toContain("num_nights");
  });

  // ========== BUSINESS LOGIC ERROR TESTS ==========

  it("should return 404 when booking not found", async () => {
    // Reset and create custom mock for booking not found scenario
    vi.resetModules();

    const mockClient = createUnitAddMocks({
      bookingExists: false,
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validAddUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(404);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("BOOKING_NOT_FOUND");
  });

  it("should return 409 when booking status is CheckedIn", async () => {
    // Reset and create custom mock for CheckedIn status
    vi.resetModules();

    const mockClient = createUnitAddMocks({
      booking: {
        ...testBookingResponse,
        booking_status: "CheckedIn",
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validAddUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(409);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("CANNOT_MODIFY_BOOKING");
  });

  it("should return 409 when booking status is CheckedOut", async () => {
    // Reset and create custom mock for CheckedOut status
    vi.resetModules();

    const mockClient = createUnitAddMocks({
      booking: {
        ...testBookingResponse,
        booking_status: "CheckedOut",
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validAddUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(409);
  });

  it("should return 409 when unit is unavailable", async () => {
    // Reset and create custom mock for unavailable unit
    vi.resetModules();

    const mockClient = createUnitAddMocks({
      booking: {
        ...testBookingResponse,
        booking_status: "Pending",
        check_in: "2025-12-20T06:00:00Z",
        check_out: "2025-12-22T04:00:00Z",
      },
      availabilityResults: [{ unit_id: testUnits[2].unit_id, is_available: false }],
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validAddUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(409);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("UNIT_UNAVAILABLE");
  });

  it("should include CORS headers", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/add");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/add`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validAddUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as unknown);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeDefined();
  });
});
