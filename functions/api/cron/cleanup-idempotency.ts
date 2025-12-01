/**
 * HTTP Endpoint for Idempotency Key Cleanup
 *
 * Triggered by GitHub Actions scheduled workflow
 * Schedule: Daily at 2:00 AM UTC (10:00 AM PHT)
 *
 * Authentication: Bearer token (CRON_SECRET)
 * Rate Limiting: None (authenticated endpoint)
 */

import { cleanupIdempotency } from "../../scheduled/cleanup-idempotency";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CRON_SECRET: string;
}

/**
 * Verify the request has a valid CRON_SECRET Bearer token
 */
function verifyAuth(request: Request, env: Env): { valid: boolean; error?: string } {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization format. Expected: Bearer <token>" };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!env.CRON_SECRET) {
    console.error("[CRON] CRON_SECRET environment variable not configured");
    return { valid: false, error: "Server configuration error" };
  }

  if (token !== env.CRON_SECRET) {
    return { valid: false, error: "Invalid token" };
  }

  return { valid: true };
}

/**
 * Handle POST request to trigger idempotency cleanup
 */
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const startTime = Date.now();

  // Verify authentication
  const auth = verifyAuth(request, env);
  if (!auth.valid) {
    console.warn("[CRON] Unauthorized cleanup attempt:", auth.error);
    return Response.json({ error: "Unauthorized", message: auth.error }, { status: 401 });
  }

  try {
    console.info("[CRON] Starting idempotency cleanup via HTTP trigger");

    // Call the existing cleanup function
    await cleanupIdempotency(env);

    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      message: "Idempotency cleanup completed successfully",
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[CRON] Idempotency cleanup failed:", error);

    return Response.json(
      {
        success: false,
        error: "Cleanup failed",
        message: error instanceof Error ? error.message : "Unknown error",
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
