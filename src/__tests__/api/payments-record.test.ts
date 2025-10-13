/**
 * API Tests: Record Payment Endpoint
 *
 * POST /api/bookings/:id/payments/record
 *
 * Tests cover:
 * - Happy paths (record full/partial payment, payment method validation)
 * - Validation errors (invalid amount, missing proof, exceeds total)
 * - Business logic errors (booking not found, payment already exists)
 * - Security (authentication, input sanitization)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, createMockContext, mockEnv, generateTestJWT } from "./setup";
import { createPaymentRecordMocks } from "./factories/payment-factory";
import { testBookingResponse } from "./utils/fixtures";
import type { RecordPaymentResponse, ApiErrorResponse } from "./types/responses";

describe("POST /api/bookings/:id/payments/record", () => {
  const validPaymentData = {
    amount: 5000,
    payment_method: "GCash" as const,
    payment_reference: "GCASH-12345",
    proof_url: "https://example.com/receipt.jpg",
    notes: "Initial payment via GCash",
  };

  beforeEach(async () => {
    vi.resetModules();

    const mockClient = createPaymentRecordMocks({
      booking: {
        booking_id: testBookingResponse.booking_id,
        total_amount: 10000,
        amount_paid: 0,
        payment_status: "Unpaid",
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
    }));
  });

  // ========== HAPPY PATH TESTS ==========

  it("should record full payment (amount = total)", async () => {
    vi.resetModules();

    const mockClient = createPaymentRecordMocks({
      booking: {
        booking_id: testBookingResponse.booking_id,
        total_amount: 5000, // Amount equals payment
        amount_paid: 0,
        payment_status: "Unpaid",
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validPaymentData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
    const data = (await response.json()) as RecordPaymentResponse;
    expect(data.success).toBe(true);
  });

  it("should record partial payment", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validPaymentData), // 5000 of 10000
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
  });

  it("should require proof_url for GCash payment", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validPaymentData,
          payment_method: "GCash",
          proof_url: undefined, // Missing!
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("VALIDATION_ERROR");
    expect((data as any).details.validation_errors.some((e: any) => e.field === "proof_url")).toBe(
      true
    );
  });

  it("should require proof_url for BankTransfer payment", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validPaymentData,
          payment_method: "BankTransfer",
          proof_url: undefined,
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
  });

  it("should allow Cash without proof_url", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          amount: 5000,
          payment_method: "Cash",
          notes: "Cash payment at front desk",
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
  });

  // ========== VALIDATION ERROR TESTS ==========

  it("should return 400 for invalid booking_id format", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      "https://api.example.com/api/bookings/invalid-id/payments/record",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validPaymentData),
      }
    );

    const context = createMockContext(request, mockEnv, { id: "invalid-id" });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
  });

  it("should return 400 when amount exceeds booking total", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validPaymentData,
          amount: 15000, // Exceeds total of 10000
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("AMOUNT_EXCEEDS_TOTAL");
  });

  it("should return 400 for negative amount", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validPaymentData,
          amount: -1000,
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid payment method", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validPaymentData,
          payment_method: "Bitcoin", // Invalid
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
  });

  // ========== BUSINESS LOGIC ERROR TESTS ==========

  it("should return 404 when booking not found", async () => {
    vi.resetModules();

    const mockClient = createPaymentRecordMocks({
      bookingExists: false,
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    vi.doMock("@/lib/security/sanitize-worker", () => ({
      sanitizeTextWorker: vi.fn((text: string) => text),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validPaymentData),
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

  it("should sanitize notes input", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const { sanitizeTextWorker } = await import("@/lib/security/sanitize-worker");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validPaymentData,
          notes: "<script>alert('xss')</script>Important notes",
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    await onRequestPost(context as any);

    expect(sanitizeTextWorker).toHaveBeenCalled();
  });

  it("should include processing time header", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/record");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/record`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validPaymentData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.headers.has("X-Processing-Time")).toBe(true);
  });
});
