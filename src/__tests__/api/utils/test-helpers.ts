/**
 * Test Helper Utilities for API Testing
 *
 * Provides utilities for creating mock requests, responses, and contexts
 */

import type { AuthenticatedData, AuthenticatedUser } from "../../../../functions/lib/rbac";
import type { TestEnv } from "../mocks/env";

/**
 * Create a mock Request object for testing with optional user context
 */
export function createMockRequest(
  url: string,
  options: RequestInit & { query?: Record<string, string | string[]> } = {}
): Request {
  let finalUrl = url;

  // Add query parameters if provided
  if (options.query) {
    const searchParams = new URLSearchParams();

    // Handle both single values and arrays
    for (const [key, value] of Object.entries(options.query)) {
      if (Array.isArray(value)) {
        // For arrays, append each value with the same key
        value.forEach((v) => searchParams.append(key, v));
      } else if (typeof value === "string" && value.includes(",") && key.endsWith("[]")) {
        // Special handling for comma-separated values that should be arrays
        // This maintains backward compatibility with existing tests
        value.split(",").forEach((v) => searchParams.append(key, v.trim()));
      } else {
        searchParams.append(key, value);
      }
    }

    finalUrl = `${url}?${searchParams.toString()}`;
  }

  const request = new Request(finalUrl, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body,
  });

  return request;
}

/**
 * Create a mock PagesFunction context for testing
 */
export function createMockContext(
  request: Request,
  env: TestEnv,
  params: Record<string, string> = {},
  user?: AuthenticatedUser
) {
  // Mirrors what the middleware does after JWT verification: an Authorization
  // header yields an admin user unless the caller passes one explicitly
  const hasAuthorization = request.headers.has("Authorization");
  const defaultUser: AuthenticatedUser | undefined = hasAuthorization
    ? { id: "test-user-id", email: "test@example.com", role: "admin" }
    : undefined;

  return {
    request,
    env,
    params,
    waitUntil: (promise: Promise<unknown>) => {
      // In tests, just let it resolve
      promise.catch((err) => console.error("waitUntil error:", err));
    },
    next: async () => new Response("OK"),
    data: { user: user ?? defaultUser } as AuthenticatedData,
  };
}

/**
 * Base64URL encode (URL-safe base64 without padding)
 */
function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate a properly signed JWT token using Web Crypto API
 * Matches the signing/verification logic in functions/_middleware.ts
 */
export async function generateTestJWT(
  payload: Record<string, unknown> = {},
  secret: string = "test-jwt-secret-key-for-hmac-256-signing"
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);

  const defaultPayload = {
    sub: "test-user-id",
    email: "test@example.com",
    role: "authenticated",
    iat: now,
    exp: now + 3600, // 1 hour
    aud: "authenticated",
    ...payload,
  };

  // Base64URL encode header and payload
  const b64Header = base64UrlEncode(JSON.stringify(header));
  const b64Payload = base64UrlEncode(JSON.stringify(defaultPayload));

  // Create signature using Web Crypto API (same as middleware)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = encoder.encode(`${b64Header}.${b64Payload}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);

  // Convert signature to base64url
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureString = String.fromCharCode(...signatureArray);
  const b64Signature = base64UrlEncode(signatureString);

  return `${b64Header}.${b64Payload}.${b64Signature}`;
}

/**
 * Generate expired JWT for testing auth failures
 */
export async function generateExpiredJWT(
  secret: string = "test-jwt-secret-key-for-hmac-256-signing"
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return generateTestJWT(
    {
      exp: now - 3600, // Expired 1 hour ago
    },
    secret
  );
}

/**
 * Generate idempotency key for testing
 */
export function generateIdempotencyKey(prefix = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
