/**
 * API Tests: Multi-Unit Booking Endpoint
 *
 * POST /api/bookings/multi-unit
 *
 * Tests cover:
 * - Happy paths (create 1-10 unit bookings, idempotency)
 * - Validation errors (schema validation, missing fields)
 * - Business logic errors (unavailable units, invalid dates)
 * - Security (XSS prevention, input sanitization)
 * - Idempotency (replay detection, caching)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBookingMocks } from "./factories/booking-factory";
import { createMockContext, createMockRequest, generateIdempotencyKey, mockEnv } from "./setup";
import type {
  BusinessErrorResponse,
  MultiUnitBookingResponse,
  ValidationErrorResponse,
} from "./types/responses";
import { testUnits } from "./utils/fixtures";

// The root middleware rejects unauthenticated callers before this handler runs,
// and the handler itself requires staff or above.
function createStaffRequest(init: RequestInit) {
  const request = createMockRequest("https://api.example.com/api/bookings/multi-unit", {
    ...init,
    headers: { Authorization: "Bearer test-token", ...(init.headers as Record<string, string>) },
  }) as Request & { user: { role: string } };
  request.user.role = "staff";
  return request;
}

describe("POST /api/bookings/multi-unit", () => {
  const validBookingData = {
    primary_guest: {
      guest_name: "John Doe",
      email: "john.doe@example.com",
      contact_number: "+63 912 345 6789",
    },
    check_in: "2025-12-20T06:00:00Z",
    check_out: "2025-12-22T04:00:00Z",
    units: [
      { unit_id: testUnits[0].unit_id, num_guests: 2 },
      { unit_id: testUnits[1].unit_id, num_guests: 3 },
    ],
    payment: {
      method: "GCash" as const,
      amount: 5000,
      proof_url: "https://example.com/proof.jpg",
    },
    special_requests: "Early check-in if possible",
  };

  beforeEach(async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Setup default mock for this suite
    const mockClient = createBookingMocks({
      units: testUnits,
      allAvailable: true,
    });

    // Mock Supabase (NOT hoisted - executes in order)
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    // Mock sanitization functions
    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
      sanitizeNameWorker: vi.fn((name: string) => name),
      sanitizeEmailWorker: vi.fn((email: string) => email.toLowerCase()),
      sanitizePhoneWorker: vi.fn((phone: string) => phone),
    }));
  });

  // ========== HAPPY PATH TESTS ==========

  it("should create booking with 2 units successfully", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify(validBookingData),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(201);
    const data = (await response.json()) as MultiUnitBookingResponse;

    expect(data.success).toBe(true);
    expect(data.data.booking_id).toBeDefined();
    expect(data.metadata.units_booked).toBe(2);
  });

  it("should create booking with 10 units (maximum)", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");

    const tenUnits = Array(10)
      .fill(null)
      .map(() => ({ unit_id: testUnits[0].unit_id, num_guests: 2 }));

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        units: tenUnits,
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(201);
    const data = (await response.json()) as MultiUnitBookingResponse;
    expect(data.metadata.units_booked).toBe(10);
  });

  it("should prevent duplicate bookings with idempotency key", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const idempotencyKey = generateIdempotencyKey();

    // First request - should create booking
    const request1 = createStaffRequest({
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(validBookingData),
    });

    const context1 = createMockContext(request1, mockEnv);
    const response1 = await onRequestPost(context1 as unknown);

    expect(response1.status).toBe(201);
    const data1 = (await response1.json()) as MultiUnitBookingResponse;

    // Second request with same key - should return cached result
    const request2 = createStaffRequest({
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(validBookingData),
    });

    const context2 = createMockContext(request2, mockEnv);
    const response2 = await onRequestPost(context2 as unknown);

    expect(response2.status).toBe(200); // Not 201!
    expect(response2.headers.get("X-Idempotency-Replay")).toBe("true");

    const data2 = (await response2.json()) as MultiUnitBookingResponse;
    expect(data2.data.booking_id).toBe(data1.data.booking_id);
  });

  it("should include processing time header", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify(validBookingData),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.headers.has("X-Processing-Time")).toBe(true);
    expect(response.headers.get("X-Processing-Time")).toMatch(/\d+ms/);
  });

  it("should include CORS headers in response", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify(validBookingData),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeDefined();
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("should return booking with units array", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify(validBookingData),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    const data = (await response.json()) as MultiUnitBookingResponse;
    expect(data.data.booking_units).toBeDefined();
    expect(Array.isArray(data.data.booking_units)).toBe(true);
  });

  // ========== VALIDATION ERROR TESTS ==========

  it("should return 400 for empty units array", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        units: [],
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ValidationErrorResponse;
    expect(data.success).toBe(false);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for missing primary_guest", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const { primary_guest, ...restData } = validBookingData;

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify(restData),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ValidationErrorResponse;
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.details.validation_errors).toBeDefined();
  });

  it("should return 400 for invalid email format", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        primary_guest: {
          ...validBookingData.primary_guest,
          email: "invalid-email",
        },
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ValidationErrorResponse;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for check_out before check_in", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        check_in: "2025-12-22T06:00:00Z",
        check_out: "2025-12-20T04:00:00Z", // Before check-in
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ValidationErrorResponse;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for invalid unit_id format", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        units: [{ unit_id: "not-a-uuid", num_guests: 2 }],
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ValidationErrorResponse;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for exceeding max units (>10)", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const elevenUnits = Array(11)
      .fill(null)
      .map(() => ({ unit_id: testUnits[0].unit_id, num_guests: 2 }));

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        units: elevenUnits,
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ValidationErrorResponse;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for invalid payment method", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        payment: {
          method: "Bitcoin", // Invalid
          amount: 5000,
        },
      }),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ValidationErrorResponse;
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  // ========== BUSINESS LOGIC TESTS ==========

  it("should return 409 when unit is unavailable", async () => {
    // Reset and create custom mock for unavailable scenario
    vi.resetModules();

    const mockClient = createBookingMocks({
      units: testUnits,
      availabilityResults: [
        { unit_id: testUnits[0].unit_id, is_available: false }, // Unavailable!
        { unit_id: testUnits[1].unit_id, is_available: true },
      ],
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
      sanitizeNameWorker: vi.fn((name: string) => name),
      sanitizeEmailWorker: vi.fn((email: string) => email.toLowerCase()),
      sanitizePhoneWorker: vi.fn((phone: string) => phone),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify(validBookingData),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(409);
    const data = (await response.json()) as BusinessErrorResponse;
    expect(data.error.code).toBe("UNIT_UNAVAILABLE");
    expect(data.error.details?.unavailable_units).toContain(testUnits[0].unit_id);
  });

  // ========== SECURITY TESTS ==========

  it("should sanitize special_requests input", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const { sanitizeTextWorker } = await import("@/lib/security/sanitize-worker");

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        special_requests: "<script>alert('xss')</script>Early check-in",
      }),
    });

    const context = createMockContext(request, mockEnv);
    await onRequestPost(context as unknown);

    // Verify sanitization was called
    expect(sanitizeTextWorker).toHaveBeenCalled();
  });

  it("should sanitize guest name input", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const { sanitizeNameWorker } = await import("@/lib/security/sanitize-worker");

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify({
        ...validBookingData,
        primary_guest: {
          ...validBookingData.primary_guest,
          guest_name: "John<script>Doe</script>",
        },
      }),
    });

    const context = createMockContext(request, mockEnv);
    await onRequestPost(context as unknown);

    expect(sanitizeNameWorker).toHaveBeenCalled();
  });

  it("should sanitize email input", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
    const { sanitizeEmailWorker } = await import("@/lib/security/sanitize-worker");

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify(validBookingData),
    });

    const context = createMockContext(request, mockEnv);
    await onRequestPost(context as unknown);

    expect(sanitizeEmailWorker).toHaveBeenCalled();
  });

  // ========== ERROR HANDLING TESTS ==========

  it("should return 500 on internal error", async () => {
    // Reset and create error mock
    vi.resetModules();

    const mockClient = createBookingMocks({
      units: testUnits,
      hasError: true,
      errorMessage: "Database connection failed",
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
      sanitizeNameWorker: vi.fn((name: string) => name),
      sanitizeEmailWorker: vi.fn((email: string) => email.toLowerCase()),
      sanitizePhoneWorker: vi.fn((phone: string) => phone),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");

    const request = createStaffRequest({
      method: "POST",
      body: JSON.stringify(validBookingData),
    });

    const context = createMockContext(request, mockEnv);
    const response = await onRequestPost(context as unknown);

    expect(response.status).toBe(500);
    const data = (await response.json()) as BusinessErrorResponse;
    expect(data.error.code).toBe("INTERNAL_ERROR");
  });
});
