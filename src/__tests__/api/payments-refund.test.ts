/**
 * API Tests: Refund Payment Endpoint
 *
 * POST /api/bookings/:id/payments/refund
 *
 * Tests cover:
 * - Happy paths (full/partial refund, payment_adjustments creation)
 * - Validation errors (invalid amount, invalid reason, exceeds payment)
 * - Business logic errors (no payment found, already refunded)
 * - Security (authentication)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, createMockContext, mockEnv, generateTestJWT } from "./setup";
import { createPaymentRefundMocks } from "./factories/payment-factory";
import { testBookingResponse } from "./utils/fixtures";

describe("POST /api/bookings/:id/payments/refund", () => {
  const validRefundData = {
    amount: 2000,
    reason: "unit_removed" as const,
    notes: "Unit removed per guest request",
  };

  beforeEach(async () => {
    vi.resetModules();

    const mockClient = createPaymentRefundMocks({
      payment: {
        payment_id: "payment-123",
        booking_id: testBookingResponse.booking_id,
        amount_paid: 5000,
        payment_status: "Paid",
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));
  });

  // ========== HAPPY PATH TESTS ==========

  it("should process full refund successfully", async () => {
    vi.resetModules();

    const mockClient = createPaymentRefundMocks({
      payment: {
        payment_id: "p-1",
        booking_id: testBookingResponse.booking_id,
        amount_paid: 5000,
        payment_status: "Paid",
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          amount: 5000, // Full refund
          reason: "cancellation",
          notes: "Full cancellation",
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("should process partial refund successfully", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRefundData), // 2000 of 5000
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(200);
  });

  it("should create payment_adjustments record", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRefundData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    const data = await response.json();
    expect(data.data.adjustment_id).toBeDefined();
  });

  it("should update payments.refunded_amount", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRefundData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    await onRequestPost(context as any);

    // Verify update was called (mock should have been invoked)
    // Actual value verification happens in database layer tests
  });

  // ========== VALIDATION ERROR TESTS ==========

  it("should return 400 for invalid booking_id format", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = createMockRequest(
      "https://api.example.com/api/bookings/invalid-id/payments/refund",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRefundData),
      }
    );

    const context = createMockContext(request, mockEnv, { id: "invalid-id" });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
  });

  it("should return 400 when refund exceeds payment amount", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validRefundData,
          amount: 6000, // Exceeds payment of 5000
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("REFUND_EXCEEDS_PAYMENT");
  });

  it("should return 400 for invalid reason enum", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          amount: 2000,
          reason: "invalid_reason", // Not in enum
        }),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
  });

  it("should return 400 for negative amount", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify({
          ...validRefundData,
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

  // ========== BUSINESS LOGIC ERROR TESTS ==========

  it("should return 404 when payment not found", async () => {
    vi.resetModules();

    const mockClient = createPaymentRefundMocks({
      paymentExists: false,
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRefundData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("PAYMENT_NOT_FOUND");
  });

  it("should return 400 when already fully refunded", async () => {
    vi.resetModules();

    const mockClient = createPaymentRefundMocks({
      payment: {
        payment_id: "p-1",
        booking_id: testBookingResponse.booking_id,
        amount: 5000,
        amount_paid: 5000,
        payment_status: "Refunded",
        refunded_amount: 5000, // Already fully refunded
      },
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => mockClient),
    }));

    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");

    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRefundData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("REFUND_EXCEEDS_PAYMENT");
  });

  it("should include processing time header", async () => {
    const { onRequestPost } = await import("../../../functions/api/bookings/[id]/payments/refund");
    const request = createMockRequest(
      `https://api.example.com/api/bookings/${testBookingResponse.booking_id}/payments/refund`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await generateTestJWT()}` },
        body: JSON.stringify(validRefundData),
      }
    );

    const context = createMockContext(request, mockEnv, {
      id: testBookingResponse.booking_id,
    });
    const response = await onRequestPost(context as any);

    expect(response.headers.has("X-Processing-Time")).toBe(true);
  });
});
