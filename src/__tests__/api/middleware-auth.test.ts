/**
 * API Tests: Middleware JWT Authentication
 *
 * Tests the global middleware authentication for all API routes
 *
 * Tests cover:
 * - Public paths (no auth required)
 * - Protected paths (auth required)
 * - JWT validation (signature, expiration)
 * - CORS preflight (OPTIONS requests)
 * - Security headers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequest } from "../../../functions/_middleware";
import {
  createMockContext,
  createMockRequest,
  generateExpiredJWT,
  generateTestJWT,
  mockEnv,
} from "./setup";
import type { ApiErrorResponse } from "./types/responses";

describe("Middleware JWT Authentication", () => {
  beforeEach(() => {
    // Mock next() to return a simple success response
    mockEnv.SUPABASE_JWT_SECRET = "test-jwt-secret-key-for-hmac-256-signing";
  });

  // ========== PUBLIC PATH TESTS ==========

  it("should allow public path /api/pricing/calculate without JWT", async () => {
    const request = createMockRequest("https://api.example.com/api/pricing/calculate", {
      method: "POST",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(200);
  });

  it("should allow public path /api/availability/multi-unit without JWT", async () => {
    const request = createMockRequest("https://api.example.com/api/availability/multi-unit", {
      method: "GET",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(200);
  });

  it("should allow the guest booking status lookup without JWT", async () => {
    // The public /booking/check-status page posts here; guests are not logged in.
    const request = createMockRequest("https://api.example.com/api/guest-booking/status", {
      method: "POST",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(200);
  });

  it("should allow public path /api/health without JWT", async () => {
    const request = createMockRequest("https://api.example.com/api/health", {
      method: "GET",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(200);
  });

  // ========== PROTECTED PATH TESTS ==========

  it("should block protected path /api/bookings/:id/units/add without JWT", async () => {
    const request = createMockRequest("https://api.example.com/api/bookings/123/units/add", {
      method: "POST",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(401);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("UNAUTHORIZED");
  });

  it("should allow protected path with valid JWT", async () => {
    const request = createMockRequest("https://api.example.com/api/bookings/123/units/add", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await generateTestJWT()}`,
      },
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    };

    await onRequest(context as unknown);

    // With valid JWT, middleware should call next()
    expect(context.next).toHaveBeenCalled();
  });

  it("should return 401 for invalid JWT signature", async () => {
    const request = createMockRequest("https://api.example.com/api/bookings/123/units/add", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid.jwt.token",
      },
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(401);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("UNAUTHORIZED");
  });

  it("should return 401 for expired JWT", async () => {
    const request = createMockRequest("https://api.example.com/api/bookings/123/units/add", {
      method: "POST",
      headers: {
        Authorization: await generateExpiredJWT(),
      },
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(401);
  });

  it("should return 401 for missing Bearer prefix", async () => {
    const request = createMockRequest("https://api.example.com/api/bookings/123/units/add", {
      method: "POST",
      headers: {
        Authorization: "InvalidPrefix token",
      },
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(401);
  });

  // ========== CORS PREFLIGHT TESTS ==========

  it("should pass OPTIONS requests (CORS preflight)", async () => {
    const request = createMockRequest("https://api.example.com/api/bookings/multi-unit", {
      method: "OPTIONS",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBeDefined();
  });

  // ========== SECURITY HEADERS TESTS ==========

  it("should include security headers in response", async () => {
    const request = createMockRequest("https://api.example.com/api/health", {
      method: "GET",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
    };

    const response = await onRequest(context as unknown);

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBeDefined();
    expect(response.headers.get("Content-Security-Policy")).toBeDefined();
  });

  it("should include request ID header", async () => {
    const request = createMockRequest("https://api.example.com/api/health", {
      method: "GET",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })),
    };

    const response = await onRequest(context as unknown);

    expect(response.headers.has("X-Request-ID")).toBe(true);
  });

  it("should skip middleware for non-API routes", async () => {
    const request = createMockRequest("https://api.example.com/some-other-path", {
      method: "GET",
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response("OK", { status: 200 })),
    };

    await onRequest(context as unknown);

    // Should call next() without processing
    expect(context.next).toHaveBeenCalled();
  });
});

describe("Middleware Cron Authentication", () => {
  const CRON_PATH = "https://api.example.com/api/cron/cleanup-idempotency";

  beforeEach(() => {
    mockEnv.CRON_SECRET = "test-cron-secret";
    mockEnv.SUPABASE_JWT_SECRET = "test-jwt-secret-key-for-hmac-256-signing";
  });

  it("should allow /api/cron/* with the correct CRON_SECRET (bug repro)", async () => {
    const request = createMockRequest(CRON_PATH, {
      method: "POST",
      headers: { Authorization: "Bearer test-cron-secret" },
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    };

    const response = await onRequest(context as unknown);

    // Before the fix, the JWT gate rejected the CRON_SECRET as an invalid token
    // (401 "Invalid or expired token") and next() was never reached.
    expect(context.next).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("should reject /api/cron/* with a wrong CRON_SECRET", async () => {
    const request = createMockRequest(CRON_PATH, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(context.next).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("UNAUTHORIZED");
  });

  it("should reject /api/cron/* with no Authorization header", async () => {
    const request = createMockRequest(CRON_PATH, { method: "POST" });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(response.status).toBe(401);
  });

  it("should reject /api/cron/* authenticated with a valid Supabase JWT", async () => {
    // A user JWT must NOT grant access to machine-to-machine cron endpoints,
    // even though it would pass the JWT gate on other protected routes.
    const request = createMockRequest(CRON_PATH, {
      method: "POST",
      headers: { Authorization: `Bearer ${await generateTestJWT()}` },
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(context.next).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it("should fail closed with 500 when CRON_SECRET is not configured", async () => {
    mockEnv.CRON_SECRET = "";

    const request = createMockRequest(CRON_PATH, {
      method: "POST",
      headers: { Authorization: "Bearer anything" },
    });

    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(),
    };

    const response = await onRequest(context as unknown);

    expect(context.next).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("SERVER_MISCONFIGURED");
  });
});
