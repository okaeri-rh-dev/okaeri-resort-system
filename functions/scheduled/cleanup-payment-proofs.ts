/**
 * Cleanup Expired Payment Proofs - Weekly Cron Worker
 *
 * Schedule: Weekly on Sunday at 3:00 AM UTC ("0 3 * * 0")
 * Purpose: Delete old payment proof files based on retention policy
 * Retention Rules:
 * - Checked-out bookings: 90 days after check-out date
 * - Cancelled bookings: 30 days after cancellation (updated_at)
 * Both live in the cleanup_expired_payment_proofs SQL function.
 * - Guest uploads (TEMP-) that nothing references: 30 days after upload (sweepOrphanedPaymentProofs)
 *
 * Free Tier Impact:
 * - Reduces Supabase Storage usage (1GB free limit)
 * - Maintains database performance (smaller payment_proof_url lookups)
 *
 * Alerting Thresholds:
 * - >50 files deleted per week: Investigate for bulk cancellations or policy changes
 *
 * Retry Strategy: 3 attempts with exponential backoff (1min, 2min, 3min)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createLogger, type Logger } from "../lib/logger";
import { sweepOrphanedPaymentProofs } from "../lib/orphaned-payment-proofs";
import { deletePaymentProofFiles } from "../lib/payment-proof-storage";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENVIRONMENT?: string;
}

/**
 * Execute payment proof cleanup
 * Called by Cloudflare Pages cron trigger at 3:00 AM UTC every Sunday
 *
 * @param env - Environment variables (Supabase credentials)
 * @returns The number of expired and orphaned files deleted from storage. Throws when the
 * expired cleanup fails; a failed orphan sweep is returned as orphanSweepError so the expired
 * count is still reported.
 */
export async function cleanupPaymentProofs(env: Env): Promise<{
  deletedCount: number;
  orphanDeletedCount: number;
  orphanSweepError: string | null;
}> {
  const logger = createLogger(env);

  logger.info("[CRON] Starting payment proof cleanup");

  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const deletedCount = await cleanupExpiredPaymentProofs(supabase, logger);

  try {
    const orphanSweep = await sweepOrphanedPaymentProofs(supabase, logger, new Date());
    logger.info(
      `[CRON] Orphaned payment proof sweep completed: ${orphanSweep.deleted.length} files deleted, ` +
        `${orphanSweep.failed.length} failed`
    );
    return { deletedCount, orphanDeletedCount: orphanSweep.deleted.length, orphanSweepError: null };
  } catch (error) {
    logger.error("[ERROR] Orphaned payment proof sweep failed", error);
    const orphanSweepError = error instanceof Error ? error.message : String(error);
    return { deletedCount, orphanDeletedCount: 0, orphanSweepError };
  }
}

async function cleanupExpiredPaymentProofs(
  supabase: SupabaseClient<Database>,
  logger: Logger
): Promise<number> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000; // 2 seconds base delay (fits within Cloudflare 30s Worker limit)
  const ALERT_THRESHOLD_COUNT = 50; // Alert if >50 files deleted

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Clears the expired references and returns each file's path in the bucket
      const { data, error } = await supabase.rpc("cleanup_expired_payment_proofs");

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const filePaths = (data ?? []).map((row) => row.file_path);

      const { deleted } = await deletePaymentProofFiles(supabase, filePaths, logger);

      // Alert if unusual cleanup volume
      // >50 deletions per week suggests:
      // - Bulk cancellations (seasonal downturn)
      // - Retention policy changes
      // - Data quality issues (incorrect statuses)
      if (filePaths.length > ALERT_THRESHOLD_COUNT) {
        logger.warn(
          `[ALERT] High payment proof cleanup: ${filePaths.length} files deleted. ` +
            `Expected: <${ALERT_THRESHOLD_COUNT} per week. ` +
            `Investigate for: ` +
            `1) Bulk booking cancellations, ` +
            `2) Recent retention policy changes, ` +
            `3) Incorrect booking status updates. ` +
            `Review booking cancellation patterns and admin logs.`
        );
      }

      logger.info(`[CRON] Payment proof cleanup completed: ${deleted.length} files deleted`);

      return deleted.length;
    } catch (error) {
      logger.error(
        `[ERROR] Payment proof cleanup failed (attempt ${attempt}/${MAX_RETRIES})`,
        error
      );

      // If final retry failed, log critical error and throw
      if (attempt === MAX_RETRIES) {
        console.error(
          `[CRITICAL] Payment proof cleanup failed after ${MAX_RETRIES} retries. ` +
            `Possible causes: ` +
            `1) Database connectivity issues (check Supabase status), ` +
            `2) Invalid service role key (check environment variables), ` +
            `3) Function does not exist (verify migration 023 applied), ` +
            `4) Storage API permissions (service role needs storage.objects.delete), ` +
            `5) Booking table schema mismatch (verify payment_proof_url column exists). ` +
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

  throw new Error("unreachable");
}

/**
 * Health check helper for monitoring
 * Call this from admin endpoint to verify cleanup is operational
 */
export async function checkPaymentProofCleanupHealth(env: Env): Promise<{
  healthy: boolean;
  message: string;
  stats?: {
    totalProofs: number;
    expiredProofs: number;
    activeProofs: number;
    estimatedStorageUsage: string;
  };
}> {
  try {
    const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Query bookings with payment proofs
    const { data, error } = await supabase
      .from("bookings")
      .select("payment_proof_url, booking_status, check_out, updated_at")
      .not("payment_proof_url", "is", null);

    if (error) {
      return {
        healthy: false,
        message: `Database query failed: ${error.message}`,
      };
    }

    const now = new Date();
    const totalProofs = data.length;

    // Count expired proofs based on retention rules
    const expiredProofs = data.filter((booking) => {
      if (booking.booking_status === "CheckedOut") {
        const checkOutDate = new Date(booking.check_out);
        const expiryDate = new Date(checkOutDate);
        expiryDate.setDate(expiryDate.getDate() + 90);
        return now > expiryDate;
      }

      if (booking.booking_status === "Cancelled" && booking.updated_at) {
        const updatedAt = new Date(booking.updated_at);
        const expiryDate = new Date(updatedAt);
        expiryDate.setDate(expiryDate.getDate() + 30);
        return now > expiryDate;
      }

      return false;
    }).length;

    const activeProofs = totalProofs - expiredProofs;

    // Estimate storage usage (assume 2MB per file)
    const estimatedBytes = totalProofs * 2097152;
    const estimatedStorageUsage = `${(estimatedBytes / 1024 / 1024).toFixed(2)} MB`;

    // Health checks
    const issues: string[] = [];

    if (expiredProofs > 100) {
      issues.push("Expired proofs exceeds 100 (cleanup may be overdue)");
    }

    if (estimatedBytes > 1073741824) {
      // > 1GB
      issues.push("Estimated storage exceeds 1GB (approaching free tier limit)");
    }

    return {
      healthy: issues.length === 0,
      message: issues.length > 0 ? issues.join("; ") : "Payment proof cleanup healthy",
      stats: {
        totalProofs,
        expiredProofs,
        activeProofs,
        estimatedStorageUsage,
      },
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
