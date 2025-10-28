/**
 * Cloudflare Pages Functions Worker
 *
 * Handles scheduled cron events for automated cleanup tasks
 * Required for Cloudflare Pages cron triggers to function
 *
 * Cron Schedule (Free Tier: 2/3 slots used):
 * - Daily 2:00 AM UTC: Cleanup expired idempotency keys
 * - Weekly Sunday 3:00 AM UTC: Cleanup expired payment proofs
 * - Reserved 1 slot for future expansion
 *
 * See: wrangler.toml [triggers] section for cron configuration
 */

import { cleanupIdempotency } from "./scheduled/cleanup-idempotency";
import { cleanupPaymentProofs } from "./scheduled/cleanup-payment-proofs";

/**
 * Cloudflare scheduled event interface
 */
interface ScheduledEvent {
  /**
   * Cron schedule that triggered this event (e.g., "0 2 * * *")
   */
  cron: string;

  /**
   * Unix timestamp (milliseconds) when this event was scheduled
   */
  scheduledTime: number;
}

/**
 * Environment variables available to the worker
 * Secrets managed via: wrangler secret put <KEY_NAME>
 */
interface Env {
  // Supabase credentials
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Cloudflare Turnstile
  TURNSTILE_SECRET_KEY: string;

  // Email (Resend)
  RESEND_API_KEY: string;

  // KV Namespaces
  RATE_LIMIT_KV: KVNamespace;
}

/**
 * Cloudflare Worker export
 * Handles both scheduled cron events and HTTP requests
 */
export default {
  /**
   * Scheduled event handler for cron triggers
   * Executes cleanup tasks at scheduled intervals
   *
   * @param event - Scheduled event with cron details
   * @param env - Environment variables (secrets)
   * @param ctx - Execution context (waitUntil, passThroughOnException)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const startTime = Date.now();

    console.log(
      `[CRON] Starting scheduled task: ${event.cron} ` +
        `(scheduled at: ${new Date(event.scheduledTime).toISOString()})`
    );

    try {
      // Route cron schedule to appropriate cleanup function
      switch (event.cron) {
        case "0 2 * * *":
          // Daily at 2:00 AM UTC: Cleanup idempotency keys
          console.log("[CRON] Executing: cleanup_expired_idempotency_keys");
          await cleanupIdempotency(env);
          break;

        case "0 3 * * 0":
          // Weekly Sunday at 3:00 AM UTC: Cleanup payment proofs
          console.log("[CRON] Executing: cleanup_expired_payment_proofs");
          await cleanupPaymentProofs(env);
          break;

        default:
          // Unknown cron schedule - log warning
          console.warn(
            `[WARN] Unknown cron schedule: ${event.cron}. ` +
              `Expected: "0 2 * * *" (daily idempotency) or "0 3 * * 0" (weekly proofs). ` +
              `Check wrangler.toml [triggers] configuration.`
          );
          return;
      }

      const duration = Date.now() - startTime;
      console.log(
        `[CRON] Completed: ${event.cron} ` +
          `(duration: ${duration}ms, ` +
          `finished at: ${new Date().toISOString()})`
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(
        `[CRON ERROR] Failed: ${event.cron} ` +
          `(duration: ${duration}ms, ` +
          `error: ${error instanceof Error ? error.message : String(error)})`
      );

      // TODO: Implement admin alerting
      // Options:
      // - Send email via Resend (env.RESEND_API_KEY)
      // - Post to Slack webhook
      // - Write to error tracking service (Sentry, etc.)
      // - Store in dedicated errors table for admin dashboard

      // Re-throw to mark cron execution as failed in Cloudflare dashboard
      // This allows monitoring cron health via dashboard metrics
      throw error;
    }
  },

  /**
   * HTTP request handler (optional for Pages Functions)
   * Cloudflare Pages automatically routes /api/* to /functions/api/*
   * This handler is only needed for root-level worker endpoints or debugging
   *
   * @param request - Incoming HTTP request
   * @param env - Environment variables
   * @param ctx - Execution context
   * @returns Response
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Health check endpoint for monitoring
    if (new URL(request.url).pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          timestamp: new Date().toISOString(),
          worker: "okaeri-resort-system",
          environment: env.SUPABASE_URL ? "configured" : "missing-config",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // Cron trigger test endpoint (development only)
    // Allows manual testing of cron functions without waiting for schedule
    if (new URL(request.url).pathname === "/test-cron" && request.method === "POST") {
      const { cron } = (await request.json()) as { cron: string };

      try {
        switch (cron) {
          case "0 2 * * *":
            await cleanupIdempotency(env);
            break;
          case "0 3 * * 0":
            await cleanupPaymentProofs(env);
            break;
          default:
            return new Response(JSON.stringify({ error: "Invalid cron schedule" }), {
              status: 400,
            });
        }

        return new Response(JSON.stringify({ success: true, message: "Cron executed" }), {
          status: 200,
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
          { status: 500 }
        );
      }
    }

    // Default response for non-API requests
    // Pages Functions handles /api/* routing automatically
    return new Response("OK", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  },
};
