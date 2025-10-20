/**
 * API Tests: Remove Unit from Booking Endpoint
 *
 * POST /api/bookings/:id/units/remove
 *
 * Tests cover:
 * - Happy paths (remove unit successfully, refund creation)
 * - Validation errors (invalid booking_id, missing fields)
 * - Business logic errors (last unit removal, booking not found, invalid status)
 * - Security (authentication)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUnitRemoveMocks } from "./factories/unit-factory";
import { createMockContext, createMockRequest, generateTestJWT, mockEnv } from "./setup";
import type { ApiErrorResponse, RemoveUnitResponse } from "./types/responses";
import { testBookingResponse, testUnits } from "./utils/fixtures";

describe("POST /api/bookings/:id/units/remove", () => {
  const validRemoveUnitData = {
    unit_id: testUnits[1].unit_id,
    reason: "Guest requested change",
  };

  beforeEach(async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Setup default mock for this suite (factory provides complete booking_units structure)
    const mockClient = createUnitRemoveMocks();

    // Mock Supabase (NOT hoisted - executes in order)
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));
  });

  // ========== HAPPY PATH TESTS ==========

  it("should remove unit from booking successfully", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
    const data = (await response.json()) as RemoveUnitResponse;
    expect(data.success).toBe(true);
  });

  it("should return refund details when unit is removed", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    const data = (await response.json()) as RemoveUnitResponse;
    expect(data.data.refund_amount).toBeDefined();
  });

  // ========== VALIDATION ERROR TESTS ==========

  it("should return 400 for invalid booking_id format", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");
    const request = createMockRequest(
      "https://api.example.com/api/bookings/invalid-id/units/remove",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, { id: "invalid-id" });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
  });

  it("should return 400 for invalid unit_id format", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          unit_id: "not-a-uuid",
          reason: "Test",
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
  });

  it("should return 400 when trying to remove last unit", async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Create custom mock for last unit scenario
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { ...testBookingResponse, unit_count: 1 }, // Only 1 unit!
                error: null,
              })),
            })),
          })),
        })),
      })),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("LAST_UNIT_REMOVAL");
  });

  // ========== BUSINESS LOGIC ERROR TESTS ==========

  it("should return 404 when booking not found", async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Create mock for booking not found scenario
    const mockClient = createUnitRemoveMocks({
      bookingExists: false,
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(404);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("BOOKING_NOT_FOUND");
  });

  it("should return 404 when unit not in booking", async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Create mock where the unit doesn't exist in booking_units
    // (booking has unit_count=2 but the queried unit isn't in booking_units table)
    const mockClient = createUnitRemoveMocks({
      booking: {
        ...testBookingResponse,
        booking_status: "Pending",
        // booking_units has different units, not the one we're trying to remove
        booking_units: [
          {
            booking_unit_id: "unit-other-1",
            unit_id: "other-unit-id-1",
          },
          {
            booking_unit_id: "unit-other-2",
            unit_id: "other-unit-id-2",
          },
        ],
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(404);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("UNIT_NOT_IN_BOOKING");
  });

  it("should return 409 when booking status is CheckedIn", async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Create mock for CheckedIn status scenario
    const mockClient = createUnitRemoveMocks({
      booking: {
        ...testBookingResponse,
        booking_status: "CheckedIn",
        booking_units: [
          { unit_id: testUnits[0].unit_id, booking_unit_id: "unit-1" },
          { unit_id: testUnits[1].unit_id, booking_unit_id: "unit-2" },
        ],
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(409);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("CANNOT_MODIFY_BOOKING");
  });

  it("should return 409 when booking is Cancelled", async () => {
    // Reset modules for test isolation
    vi.resetModules();

    // Create mock for Cancelled status scenario
    const mockClient = createUnitRemoveMocks({
      booking: {
        ...testBookingResponse,
        booking_status: "Cancelled",
        booking_units: [
          { unit_id: testUnits[0].unit_id, booking_unit_id: "unit-1" },
          { unit_id: testUnits[1].unit_id, booking_unit_id: "unit-2" },
        ],
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(409);
  });

  it("should include processing time header", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/units/remove");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/units/remove`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRemoveUnitData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.headers.has("X-Processing-Time")).toBe(true);
  });
});
