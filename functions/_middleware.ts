/**
 * Global middleware for Cloudflare Pages Functions
 * Applies comprehensive security headers, CORS, and rate limiting to all /api/* routes
 *
 * Security Features:
 * - Comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Environment-aware CORS configuration
 * - Request fingerprinting for rate limiting
 * - Progressive IP auto-blocking based on violations
 * - Anomaly detection for request spikes and path scanning
 * - A+ security rating on securityheaders.com
 */

import { isIPBlocked } from "@/lib/auto-blocking";
import { track404Error, trackRequest } from "@/lib/anomaly-detection";

import { lookupUserRole } from "./lib/role-lookup";

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  ENVIRONMENT: "production" | "development";
  TURNSTILE_SECRET_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ALERT_WEBHOOK_URL?: string;
}

/**
 * Get comprehensive security headers
 * Achieves A+ rating on securityheaders.com
 */
function getSecurityHeaders(env: Env): HeadersInit {
  const isProd = env.ENVIRONMENT === "production";

  // Content Security Policy directives
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' challenges.cloudflare.com", // Turnstile widget
    "style-src 'self' 'unsafe-inline'", // Allow inline styles for UI libraries
    "img-src 'self' data: https: blob:", // Allow images from any HTTPS source
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
    "font-src 'self' data:", // Allow fonts
    "object-src 'none'", // No plugins
    "base-uri 'self'", // Prevent base tag injection
    "form-action 'self'", // Forms can only submit to same origin
    "frame-ancestors 'none'", // Equivalent to X-Frame-Options: DENY
    "upgrade-insecure-requests", // Upgrade HTTP to HTTPS
    "block-all-mixed-content", // Block mixed content
  ];

  // Add CSP reporting in production
  if (isProd) {
    cspDirectives.push("report-uri /api/csp-report");
    cspDirectives.push("report-to csp-endpoint");
  }

  const headers: HeadersInit = {
    // XSS Protection (legacy but defense-in-depth)
    "X-XSS-Protection": "1; mode=block",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Clickjacking protection
    "X-Frame-Options": "DENY",

    // Content Security Policy
    "Content-Security-Policy": cspDirectives.join("; "),

    // Referrer Policy (privacy-friendly)
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions Policy (disable unnecessary browser features)
    "Permissions-Policy": [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "autoplay=()",
      "fullscreen=(self)",
      "picture-in-picture=()",
    ].join(", "),

    // Additional security headers
    "X-Permitted-Cross-Domain-Policies": "none",
    "X-Download-Options": "noopen",

    // Cache control for security
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };

  // HSTS (HTTPS enforcement) - only in production
  if (isProd) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  // Report-To header for CSP reporting
  if (isProd) {
    headers["Report-To"] = JSON.stringify({
      group: "csp-endpoint",
      max_age: 31536000,
      endpoints: [{ url: "/api/csp-report" }],
    });
  }

  return headers;
}

/**
 * Get CORS headers based on environment
 */
function getCorsHeaders(origin: string | null, env: Env): HeadersInit {
  const allowedOrigins =
    env.ENVIRONMENT === "production"
      ? ["https://okaeri-resort.pages.dev", "https://www.okaeri-resort.pages.dev"]
      : [
          "https://okaeri-resort.pages.dev",
          "https://*.okaeri-resort.pages.dev", // Preview deployments
          "http://localhost:8788",
          "http://localhost:5173",
          "http://127.0.0.1:5173",
        ];

  // Check if origin matches allowed patterns
  const isAllowedOrigin = allowedOrigins.some((allowed) => {
    if (allowed.includes("*")) {
      // Convert wildcard pattern to regex
      const pattern = new RegExp(allowed.replace(/\*/g, ".*").replace(/\./g, "\\."), "i");
      return origin && pattern.test(origin);
    }
    return allowed === origin;
  });

  const corsOrigin = isAllowedOrigin && origin ? origin : allowedOrigins[0]; // Default to first allowed origin

  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Idempotency-Key, X-Request-ID",
    "Access-Control-Max-Age": "86400", // 24 hours preflight cache
    "Access-Control-Allow-Credentials": "false", // No cookies for security
    Vary: "Origin", // Ensure proper caching by CDN
  };
}

/**
 * Extract request ID or generate one
 */
function getRequestId(request: Request): string {
  return (
    request.headers.get("X-Request-ID") ||
    request.headers.get("CF-Ray") || // Cloudflare Ray ID
    crypto.randomUUID()
  );
}

/**
 * JWT payload structure from Supabase
 */
interface JWTPayload {
  sub: string;
  email?: string;
  exp?: number;
  role?: string;
  aud?: string;
  iat?: number;
  user_metadata?: {
    role?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Verify Supabase JWT token
 * Free-tier compatible: <1ms CPU time, no external API calls
 */
async function verifySupabaseJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    // Use Web Crypto API (available in Cloudflare Workers)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    // Import the secret as a CryptoKey
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Split JWT into parts
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify("HMAC", key, signature, data);

    if (!isValid) {
      throw new Error("Invalid signature");
    }

    // Decode payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error("Token expired");
    }

    return payload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

/**
 * Check if path requires authentication
 */
function isPublicPath(pathname: string): boolean {
  const publicPaths = [
    "/api/public/",
    "/api/availability/check",
    "/api/availability/multi-unit",
    "/api/units",
    "/api/pricing/quote",
    "/api/pricing/calculate", // Guest booking pricing calculation
    "/api/health",
    "/api/guest-booking/multi-unit",
    "/api/guest-booking/rates",
    "/api/guest-booking/discount-rules",
    "/api/guest-booking/preview-pricing",
    "/api/guest-booking/upload-url", // Payment proof upload (Chunk 008)
    "/api/auth/login", // Admin login with Turnstile verification
    "/api/auth/forgot-password", // Password reset with Turnstile verification
  ];

  return publicPaths.some((path) => pathname.startsWith(path));
}

/**
 * Main middleware function
 */
export async function onRequest(
  context: EventContext<Env, string, Record<string, unknown>>
): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const requestId = getRequestId(request);

  // Skip middleware for non-API routes
  if (!url.pathname.startsWith("/api/")) {
    return next();
  }

  // Get headers
  const securityHeaders = getSecurityHeaders(env);
  const corsHeaders = getCorsHeaders(origin, env);

  // Handle preflight OPTIONS requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        ...securityHeaders,
        "X-Request-ID": requestId,
      },
    });
  }

  // Get client IP for security checks
  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0] ||
    "unknown";
  const userAgent = request.headers.get("User-Agent") || "unknown";

  // ============================================
  // SECURITY CHECK 1: IP Block Status
  // ============================================
  // Check if IP is blocked before processing request
  if (env.RATE_LIMIT_KV) {
    try {
      const blockStatus = await isIPBlocked(env.RATE_LIMIT_KV, clientIp);
      if (blockStatus.blocked) {
        return new Response(
          JSON.stringify({
            error: "ACCESS_DENIED",
            message: "Your IP has been temporarily blocked due to suspicious activity",
            reason: blockStatus.reason,
            expiresAt: blockStatus.expiresAt,
            code: 403,
          }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              ...securityHeaders,
              "Content-Type": "application/json",
              "X-Request-ID": requestId,
              "X-Blocked-IP": "true",
            },
          }
        );
      }
    } catch (error) {
      // Fail open - don't block on security check errors
      console.error("IP block check error:", error);
    }
  }

  // ============================================
  // SECURITY CHECK 2: Anomaly Detection
  // ============================================
  // Track request patterns and detect anomalies (non-blocking)
  if (env.RATE_LIMIT_KV) {
    // Fire and forget - don't block on anomaly tracking
    trackRequest(env.RATE_LIMIT_KV, clientIp, {
      path: url.pathname,
      userAgent,
      alertWebhookUrl: env.ALERT_WEBHOOK_URL,
    }).catch((error) => {
      console.error("Anomaly tracking error:", error);
    });
  }

  // Authentication check for protected endpoints (Gap Resolution #8)
  if (!isPublicPath(url.pathname)) {
    // Fail-closed: missing JWT secret is misconfiguration, not a silent bypass.
    // Previously, an unset SUPABASE_JWT_SECRET would skip this whole block,
    // leaving request.user undefined and causing 401s downstream silently.
    if (!env.SUPABASE_JWT_SECRET) {
      console.error("SUPABASE_JWT_SECRET is not configured; rejecting protected request");
      return new Response(
        JSON.stringify({
          error: "SERVER_MISCONFIGURED",
          message: "Authentication is unavailable",
          code: 500,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            ...securityHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }

    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
          code: 401,
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            ...securityHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifySupabaseJWT(token, env.SUPABASE_JWT_SECRET);

    if (!payload) {
      return new Response(
        JSON.stringify({
          error: "UNAUTHORIZED",
          message: "Invalid or expired token",
          code: 401,
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            ...securityHeaders,
            "Content-Type": "application/json",
            "X-Request-ID": requestId,
          },
        }
      );
    }

    // Look up role from public.app_roles (single source of truth).
    // The JWT's user_metadata.role is user-mutable via supabase.auth.updateUser
    // and MUST NOT be trusted for authorization decisions.
    const userRole = await lookupUserRole(payload.sub, env);

    // Attach user to request context for downstream use
    interface AuthenticatedRequest extends Request {
      user?: JWTPayload & { role: string };
    }
    (request as AuthenticatedRequest).user = {
      ...payload,
      role: userRole,
    };
  }

  try {
    // Process the actual request
    const response = await next();

    // Clone response to modify headers
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });

    // ============================================
    // SECURITY CHECK 3: Track 404 Errors for Path Scanning
    // ============================================
    // Track 404 errors to detect path scanning attacks (non-blocking)
    if (response.status === 404 && env.RATE_LIMIT_KV) {
      track404Error(env.RATE_LIMIT_KV, clientIp, url.pathname, {
        userAgent,
        alertWebhookUrl: env.ALERT_WEBHOOK_URL,
      }).catch((error) => {
        console.error("404 tracking error:", error);
      });
    }

    // Apply security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      modifiedResponse.headers.set(key, value);
    });

    // Apply CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      modifiedResponse.headers.set(key, value);
    });

    // Add request tracking headers
    modifiedResponse.headers.set("X-Request-ID", requestId);
    modifiedResponse.headers.set("X-Content-Type-Options", "nosniff");

    // Add timing header for performance monitoring
    if (env.ENVIRONMENT === "development") {
      const processingTime =
        Date.now() - new Date(request.headers.get("CF-Connecting-IP") || "").getTime();
      modifiedResponse.headers.set("X-Processing-Time", `${processingTime}ms`);
    }

    return modifiedResponse;
  } catch (error) {
    console.error(`[Middleware] Error processing request ${requestId}:`, error);

    // Return error response with security headers
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: "An unexpected error occurred",
        requestId,
      }),
      {
        status: 500,
        headers: {
          ...securityHeaders,
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-ID": requestId,
        },
      }
    );
  }
}

/**
 * Export individual HTTP method handlers for compatibility
 */
export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestPut = onRequest;
export const onRequestDelete = onRequest;
export const onRequestPatch = onRequest;
export const onRequestHead = onRequest;
export const onRequestOptions = onRequest;
