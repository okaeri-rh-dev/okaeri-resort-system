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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

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

    const response = await onRequest(context as never);

    expect(context.next).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    const data = (await response.json()) as ApiErrorResponse;
    expect(data.error).toBe("SERVER_MISCONFIGURED");
  });
});

// Supabase CLI 2.11x signs user tokens with ES256 (asymmetric signing keys); the hosted
// project still uses the legacy HS256 secret. Both must verify.
describe("Middleware asymmetric (ES256) JWT verification", () => {
  const jwksUrl = "https://test.supabase.co/auth/v1/.well-known/jwks.json";
  const toB64Url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  const encodeJson = (value: unknown) => toB64Url(new TextEncoder().encode(JSON.stringify(value)));

  let originalFetch: typeof fetch;
  let jwksRequests: number;
  let publishedKeys: JsonWebKey[];

  const generateSigningKey = async (kid: string) => {
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    return {
      privateKey: pair.privateKey,
      publicJwk: { ...publicJwk, kid, alg: "ES256", use: "sig" },
    };
  };

  const signES256 = async (
    privateKey: CryptoKey,
    kid: string,
    payload: Record<string, unknown> = {},
    alg = "ES256"
  ) => {
    const now = Math.floor(Date.now() / 1000);
    const headerB64 = encodeJson({ alg, kid, typ: "JWT" });
    const payloadB64 = encodeJson({
      sub: "test-user-id",
      role: "authenticated",
      exp: now + 3600,
      ...payload,
    });
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    );
    return `${headerB64}.${payloadB64}.${toB64Url(new Uint8Array(signature))}`;
  };

  const callProtected = async (token: string) => {
    const request = createMockRequest("https://api.example.com/api/bookings/123/units/add", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const context = {
      ...createMockContext(request, mockEnv),
      next: vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    };
    const response = await onRequest(context as never);
    return { response, next: context.next };
  };

  beforeEach(() => {
    originalFetch = global.fetch;
    jwksRequests = 0;
    publishedKeys = [];
    global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (url.toString() === jwksUrl) {
        jwksRequests += 1;
        return new Response(JSON.stringify({ keys: publishedKeys }), { status: 200 });
      }
      return originalFetch(url, init);
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("accepts an ES256 token signed by a key in the project's JWKS", async () => {
    const { privateKey, publicJwk } = await generateSigningKey("kid-valid");
    publishedKeys = [publicJwk];

    const { next } = await callProtected(await signES256(privateKey, "kid-valid"));

    expect(next).toHaveBeenCalled();
  });

  it("rejects an ES256 token signed by a key that is not published under its kid", async () => {
    const published = await generateSigningKey("kid-forged");
    const attacker = await generateSigningKey("kid-forged");
    publishedKeys = [published.publicJwk];

    const { response, next } = await callProtected(
      await signES256(attacker.privateKey, "kid-forged")
    );

    expect(response.status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects unknown kids and refetches the JWKS at most once a minute for them", async () => {
    const { privateKey } = await generateSigningKey("kid-unknown");
    const token = await signES256(privateKey, "kid-unknown");
    // Past the refetch interval of whatever an earlier test cached, still before the token expires
    const realNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(realNow + 5 * 60_000);

    const first = await callProtected(token);
    const second = await callProtected(token);

    expect(first.response.status).toBe(401);
    expect(second.response.status).toBe(401);
    expect(jwksRequests).toBe(1);
  });

  it("rejects an expired ES256 token", async () => {
    const { privateKey, publicJwk } = await generateSigningKey("kid-expired");
    publishedKeys = [publicJwk];

    const { response } = await callProtected(
      await signES256(privateKey, "kid-expired", { exp: Math.floor(Date.now() / 1000) - 60 })
    );

    expect(response.status).toBe(401);
  });

  it("rejects a token that claims an algorithm the middleware does not support", async () => {
    const { privateKey, publicJwk } = await generateSigningKey("kid-alg");
    publishedKeys = [publicJwk];

    const { response } = await callProtected(await signES256(privateKey, "kid-alg", {}, "none"));

    expect(response.status).toBe(401);
  });

  it("still verifies legacy HS256 tokens without fetching the JWKS", async () => {
    const { next } = await callProtected(await generateTestJWT());

    expect(next).toHaveBeenCalled();
    expect(jwksRequests).toBe(0);
  });
});
