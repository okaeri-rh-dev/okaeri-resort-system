/**
 * Cleanup Expired Idempotency Keys - Daily Cron Worker
 *
 * Schedule: Daily at 2:00 AM UTC ("0 2 * * *")
 * Purpose: Delete idempotency keys where expires_at < NOW()
 * Retention: 48 hours from creation
 * Free Tier Impact: Prevents table growth, maintains query performance
 *
 * Alerting Thresholds:
 * - >1000 keys deleted: Investigate for double-booking attempts or system issues
 * - >10,000 total keys: Cleanup not running or retention too long
 *
 * Retry Strategy: 3 attempts with exponential backoff (1min, 2min, 3min)
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createLogger } from "../lib/logger";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENVIRONMENT?: string;
}

/**
 * Execute idempotency key cleanup
 * Called by Cloudflare Pages cron trigger at 2:00 AM UTC daily
 *
 * @param env - Environment variables (Supabase credentials)
 * @returns Promise<void> - Throws on failure after retries
 */
export async function cleanupIdempotency(env: Env): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000; // 2 seconds base delay (fits within Cloudflare 30s Worker limit)
  const ALERT_THRESHOLD = 1000; // Alert if >1000 keys deleted
  const logger = createLogger(env);

  logger.info("[CRON] Starting idempotency key cleanup");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create Supabase admin client with service role key
      const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Call PostgreSQL cleanup function
      const { data, error } = await supabase.rpc("cleanup_expired_idempotency_keys");

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const deletedCount = data || 0;

      // Alert if unusual cleanup volume
      // >1000 keys suggests potential issues:
      // - High retry rate (network problems)
      // - Double-booking attempts (bot attacks)
      // - System bugs creating excessive keys
      if (deletedCount > ALERT_THRESHOLD) {
        logger.warn(
          `[ALERT] High idempotency key cleanup: ${deletedCount} keys deleted. ` +
            `Expected: <${ALERT_THRESHOLD}. ` +
            `Investigate for: ` +
            `1) Double-booking attempts, ` +
            `2) High network retry rates, ` +
            `3) System bugs creating duplicate keys. ` +
            `Check rate limiting effectiveness and Turnstile logs.`
        );
      }

      // Log successful cleanup
      logger.info(`[CRON] Idempotency cleanup completed: ${deletedCount} expired keys removed`);

      // Success - exit retry loop
      return;
    } catch (error) {
      logger.error(`[ERROR] Idempotency cleanup failed (attempt ${attempt}/${MAX_RETRIES})`, error);

      // If final retry failed, log critical error and throw
      if (attempt === MAX_RETRIES) {
        console.error(
          `[CRITICAL] Idempotency cleanup failed after ${MAX_RETRIES} retries. ` +
            `Possible causes: ` +
            `1) Database connectivity issues (check Supabase status), ` +
            `2) Invalid service role key (check environment variables), ` +
            `3) Function does not exist (verify migration 023 applied), ` +
            `4) Insufficient permissions (service role needs EXECUTE on function). ` +
            `Action required: Manual investigation and potential manual cleanup.`
        );

        // Re-throw to mark cron execution as failed in Cloudflare dashboard
        throw error;
      }

      // Wait before retry with exponential backoff
      // Attempt 1: 60s, Attempt 2: 120s, Attempt 3: 180s
      const delayMs = RETRY_DELAY_MS * attempt;
      logger.info(`[RETRY] Waiting ${delayMs / 1000}s before retry ${attempt + 1}...`);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Health check helper for monitoring
 * Call this from admin endpoint to verify cleanup is operational
 */
export async function checkIdempotencyCleanupHealth(env: Env): Promise<{
  healthy: boolean;
  message: string;
  stats?: {
    totalKeys: number;
    expiredKeys: number;
    activeKeys: number;
  };
}> {
  try {
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Query idempotency key statistics
    const { data, error } = await supabase.from("idempotency_keys").select("expires_at");

    if (error) {
      return {
        healthy: false,
        message: `Database query failed: ${error.message}`,
      };
    }

    const now = new Date();
    const totalKeys = data.length;
    const expiredKeys = data.filter(
      (row) => row.expires_at !== null && new Date(row.expires_at) < now
    ).length;
    const activeKeys = totalKeys - expiredKeys;

    // Health checks
    const issues: string[] = [];

    if (totalKeys > 10000) {
      issues.push("Total keys exceeds 10,000 (cleanup may not be running)");
    }

    if (expiredKeys > 1000) {
      issues.push("Expired keys exceeds 1,000 (cleanup overdue)");
    }

    return {
      healthy: issues.length === 0,
      message: issues.length > 0 ? issues.join("; ") : "Idempotency cleanup healthy",
      stats: {
        totalKeys,
        expiredKeys,
        activeKeys,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
