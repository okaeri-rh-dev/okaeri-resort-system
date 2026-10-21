/**
 * HTTP Endpoint for Payment Proof Cleanup
 *
 * Triggered by GitHub Actions scheduled workflow
 * Schedule: Weekly on Sunday at 3:00 AM UTC (11:00 AM PHT)
 *
 * Authentication: Bearer token (CRON_SECRET)
 * Rate Limiting: None (authenticated endpoint)
 */

import { verifyCronAuth } from "../../lib/cron-auth";
import { cleanupPaymentProofs } from "../../scheduled/cleanup-payment-proofs";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CRON_SECRET: string;
}

/**
 * Handle POST request to trigger payment proof cleanup
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
    console.warn("[CRON] Starting payment proof cleanup via HTTP trigger");

    // Call the existing cleanup function
    const { deletedCount } = await cleanupPaymentProofs(env);

    const duration = Date.now() - startTime;

    return Response.json({
      success: true,
      message: "Payment proof cleanup completed successfully",
      deleted_count: deletedCount,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[CRON] Payment proof cleanup failed:", error);

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
