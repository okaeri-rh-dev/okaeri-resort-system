/**
 * HTTP Endpoint for Idempotency Key Cleanup
 *
 * Triggered by GitHub Actions scheduled workflow
 * Schedule: Daily at 2:00 AM UTC (10:00 AM PHT)
 *
 * Authentication: Bearer token (CRON_SECRET)
 * Rate Limiting: None (authenticated endpoint)
 */

import { verifyCronAuth } from "../../lib/cron-auth";
import { cleanupIdempotency } from "../../scheduled/cleanup-idempotency";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CRON_SECRET: string;
}

/**
 * Handle POST request to trigger idempotency cleanup
 */
export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const startTime = Date.now();

  // Verify authentication
  const auth = verifyCronAuth(request, env.CRON_SECRET);
  if (!auth.valid) {
    console.warn("[CRON] Unauthorized cleanup attempt:", auth.error);
    return Response.json({ error: "Unauthorized", message: auth.error }, { status: 401 });
  }

  try {
    console.warn("[CRON] Starting idempotency cleanup via HTTP trigger");

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
