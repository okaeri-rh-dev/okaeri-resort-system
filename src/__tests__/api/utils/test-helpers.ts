/**
 * Test Helper Utilities for API Testing
 *
 * Provides utilities for creating mock requests, responses, and contexts
 */

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
  }) as unknown;

  // Add mock user context if Authorization header is present
  // This simulates what the middleware does after JWT verification
  const headersObj = options.headers as Record<string, string> | undefined;
  const authHeader = headersObj?.["Authorization"] || headersObj?.["authorization"];
  if (authHeader) {
    request.user = {
      id: "test-user-id",
      email: "test@example.com",
      role: "admin", // Default to admin for tests, can be overridden
    };
  }

  return request;
}

/**
 * Create a mock PagesFunction context for testing
 */
export function createMockContext(
  request: Request,
  env: TestEnv,
  params: Record<string, string> = {}
) {
  return {
    request,
    env,
    params,
    waitUntil: (promise: Promise<unknown>) => {
      // In tests, just let it resolve
      promise.catch((err) => console.error("waitUntil error:", err));
    },
    next: async () => new Response("OK"),
    data: {},
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

/**
 * Parse JSON response body
 */
export async function parseResponse<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Failed to parse response as JSON: ${text}`);
  }
}

/**
 * Assert response status and return parsed body
 */
export async function expectResponseStatus<T = unknown>(
  response: Response,
  expectedStatus: number
): Promise<T> {
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(`Expected status ${expectedStatus} but got ${response.status}. Body: ${body}`);
  }
  return parseResponse<T>(response);
}

/**
 * Create a mock file for upload testing
 */
export function createMockFile(name: string, type: string, size: number = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

/**
 * Wait for a promise with timeout
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Sleep utility for testing async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create mock Cloudflare request headers
 */
export function createCloudflareHeaders(overrides: Record<string, string> = {}): HeadersInit {
  return {
    "CF-Connecting-IP": "127.0.0.1",
    "CF-Ray": "test-ray-id",
    "User-Agent": "Mozilla/5.0 (Test Browser)",
    ...overrides,
  };
}

/**
 * Verify CORS headers are present
 */
export function verifyCorsHeaders(response: Response): void {
  const requiredHeaders = [
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Headers",
  ];

  for (const header of requiredHeaders) {
    if (!response.headers.has(header)) {
      throw new Error(`Missing required CORS header: ${header}`);
    }
  }
}

/**
 * Verify security headers are present
 */
export function verifySecurityHeaders(response: Response): void {
  const requiredHeaders = ["X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy"];

  for (const header of requiredHeaders) {
    if (!response.headers.has(header)) {
      throw new Error(`Missing required security header: ${header}`);
    }
  }
}

/**
 * Create a mock Response with complete headers
 * Includes CORS, security, and processing headers that the middleware adds
 */
export function createMockResponseWithHeaders(
  body: unknown,
  options: {
    status?: number;
    processingTime?: string;
    idempotencyReplay?: boolean;
    additionalHeaders?: Record<string, string>;
  } = {}
): Response {
  const {
    status = 200,
    processingTime = "50ms",
    idempotencyReplay = false,
    additionalHeaders = {},
  } = options;

  const headers: Record<string, string> = {
    // CORS headers (middleware adds these)
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key, X-Request-ID",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "false",
    Vary: "Origin",

    // Security headers (middleware adds these)
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'",
    "X-XSS-Protection": "1; mode=block",

    // Processing headers
    "X-Processing-Time": processingTime,
    "X-Request-ID": "test-request-id",

    // Content type
    "Content-Type": "application/json",

    ...additionalHeaders,
  };

  // Add idempotency replay header if applicable
  if (idempotencyReplay !== undefined) {
    headers["X-Idempotency-Replay"] = String(idempotencyReplay);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
