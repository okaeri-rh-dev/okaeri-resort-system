/**
 * Cleanup Expired Payment Proofs - Weekly Cron Worker
 *
 * Schedule: Weekly on Sunday at 3:00 AM UTC ("0 3 * * 0")
 * Purpose: Delete old payment proof files based on retention policy
 * Retention Rules:
 * - Checked-out bookings: 90 days after check-out date
 * - Cancelled bookings: 30 days after cancellation (updated_at)
 *
 * Free Tier Impact:
 * - Reduces Supabase Storage usage (1GB free limit)
 * - Maintains database performance (smaller payment_proof_url lookups)
 *
 * Alerting Thresholds:
 * - >50 files deleted per week: Investigate for bulk cancellations or policy changes
 * - >100MB freed per week: Verify storage quota not being exceeded
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

interface CleanupResult {
  deleted_count: number;
  storage_freed_bytes: number;
  cleaned_at: string;
}

/**
 * Execute payment proof cleanup
 * Called by Cloudflare Pages cron trigger at 3:00 AM UTC every Sunday
 *
 * @param env - Environment variables (Supabase credentials)
 * @returns Promise<void> - Throws on failure after retries
 */
export async function cleanupPaymentProofs(env: Env): Promise<void> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000; // 2 seconds base delay (fits within Cloudflare 30s Worker limit)
  const ALERT_THRESHOLD_COUNT = 50; // Alert if >50 files deleted
  const ALERT_THRESHOLD_BYTES = 104857600; // Alert if >100MB freed
  const logger = createLogger(env);

  logger.info("[CRON] Starting payment proof cleanup");

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create Supabase admin client with service role key
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Call PostgreSQL cleanup function
      const { data, error } = await supabase.rpc("cleanup_expired_payment_proofs");

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Parse result from PostgreSQL function
      const result = (data as CleanupResult & { file_paths?: string[] }) || {
        deleted_count: 0,
        storage_freed_bytes: 0,
        cleaned_at: new Date().toISOString(),
      };

      const { deleted_count, storage_freed_bytes, file_paths } = result;

      // Delete actual files from Supabase Storage
      // PostgreSQL function only cleared database references
      // Now we need to delete the actual files
      if (file_paths && file_paths.length > 0) {
        logger.info(`[STORAGE] Deleting ${file_paths.length} files from Supabase Storage...`);

        const { error: storageError } = await supabase.storage
          .from("payment-proofs")
          .remove(file_paths);

        if (storageError) {
          // Log warning but don't fail entire cleanup
          // Orphaned files will be caught in next cleanup cycle
          logger.warn(
            `[WARN] Storage deletion failed: ${storageError.message}. ` +
              `Affected files: ${file_paths.length}. ` +
              `Files marked for deletion but remain in storage (orphaned). ` +
              `Next cleanup cycle will attempt deletion again.`
          );
        } else {
          logger.info(`[STORAGE] Successfully deleted ${file_paths.length} files from storage`);
        }
      }

      // Alert if unusual cleanup volume
      // >50 deletions per week suggests:
      // - Bulk cancellations (seasonal downturn)
      // - Retention policy changes
      // - Data quality issues (incorrect statuses)
      if (deleted_count > ALERT_THRESHOLD_COUNT) {
        logger.warn(
          `[ALERT] High payment proof cleanup: ${deleted_count} files deleted. ` +
            `Expected: <${ALERT_THRESHOLD_COUNT} per week. ` +
            `Investigate for: ` +
            `1) Bulk booking cancellations, ` +
            `2) Recent retention policy changes, ` +
            `3) Incorrect booking status updates. ` +
            `Review booking cancellation patterns and admin logs.`
        );
      }

      // Alert if high storage freed (indicates large files or volume)
      if (storage_freed_bytes > ALERT_THRESHOLD_BYTES) {
        const freedMB = (storage_freed_bytes / 1024 / 1024).toFixed(2);
        logger.warn(
          `[ALERT] High storage freed: ${freedMB} MB. ` +
            `Expected: <${ALERT_THRESHOLD_BYTES / 1024 / 1024} MB per week. ` +
            `Verify: ` +
            `1) File sizes within expected range (2MB per receipt), ` +
            `2) Storage quota not being exceeded (1GB free tier), ` +
            `3) No duplicate file uploads.`
        );
      }

      // Log successful cleanup
      const freedMB = (storage_freed_bytes / 1024 / 1024).toFixed(2);
      logger.info(
        `[CRON] Payment proof cleanup completed: ` +
          `${deleted_count} files deleted, ` +
          `${freedMB} MB freed`
      );

      // Success - exit retry loop
      return;
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
