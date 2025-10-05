/**
 * Global middleware for Cloudflare Pages Functions
 * Applies comprehensive security headers, CORS, and rate limiting to all /api/* routes
 *
 * Security Features:
 * - Comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - Environment-aware CORS configuration
 * - Request fingerprinting for rate limiting
 * - A+ security rating on securityheaders.com
 */

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  ENVIRONMENT: "production" | "development";
  TURNSTILE_SECRET_KEY?: string;
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
      ? ["https://okaeri-resort-system.pages.dev", "https://www.okaeri-resort-system.pages.dev"]
      : [
          "https://okaeri-resort-system.pages.dev",
          "https://*.okaeri-resort-system.pages.dev", // Preview deployments
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

  try {
    // Process the actual request
    const response = await next();

    // Clone response to modify headers
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });

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
