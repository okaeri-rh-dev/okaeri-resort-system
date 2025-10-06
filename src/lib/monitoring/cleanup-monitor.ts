/**
 * Cleanup Operations Monitoring
 *
 * Tracks orphaned uploads, cleanup job executions, and
 * storage optimization operations.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getAlertSystem } from "./alert-system";
import { logAuditEvent } from "../audit-logger";
import { AuditCategory, AuditSeverity } from "@/types/database.types";

interface CleanupStats {
  orphanedFiles: number;
  expiredBookings: number;
  storageReclaimed: number;
  lastCleanup: Date | null;
  nextScheduled: Date;
  successRate: number;
}

interface CleanupRun {
  id: string;
  timestamp: Date;
  type: "scheduled" | "manual";
  filesDeleted: number;
  bookingsCleaned: number;
  bytesReclaimed: number;
  duration: number;
  success: boolean;
  errors?: string[];
}

interface OrphanedFile {
  path: string;
  size: number;
  uploadedAt: Date;
  bookingId?: string;
  reason: "no_booking" | "expired" | "failed_upload" | "abandoned";
}

export class CleanupMonitor {
  private supabase: SupabaseClient;
  private cleanupHistory: CleanupRun[] = [];
  private alertSystem = getAlertSystem();
  private kvNamespace: KVNamespace | null = null;

  constructor(supabaseUrl: string, supabaseKey: string, kvNamespace?: KVNamespace) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.kvNamespace = kvNamespace || null;
  }

  /**
   * Scan for orphaned files in storage
   */
  async scanOrphanedFiles(): Promise<OrphanedFile[]> {
    try {
      const orphaned: OrphanedFile[] = [];

      // Get all files from payment-proofs bucket
      const { data: files, error: filesError } = await this.supabase.storage
        .from("payment-proofs")
        .list();

      if (filesError) throw filesError;

      // Get all bookings with file references
      const { data: bookings, error: bookingsError } = await this.supabase
        .from("bookings")
        .select("id, payment_proof_url, upload_expires_at, upload_status")
        .eq("is_guest_booking", true);

      if (bookingsError) throw bookingsError;

      // Create a map of valid file paths
      const validPaths = new Set(
        bookings
          ?.filter((b) => b.payment_proof_url)
          .map((b) => {
            const url = new URL(b.payment_proof_url);
            return url.pathname.split("/").pop();
          }) || []
      );

      // Check each file
      for (const file of files || []) {
        const isValid = validPaths.has(file.name);

        if (!isValid) {
          // Check why it's orphaned
          let reason: OrphanedFile["reason"] = "no_booking";

          // Check if it's an expired upload
          const booking = bookings?.find((b) => b.payment_proof_url?.includes(file.name));

          if (booking) {
            if (booking.upload_expires_at && new Date(booking.upload_expires_at) < new Date()) {
              reason = "expired";
            } else if (booking.upload_status === "failed") {
              reason = "failed_upload";
            }
          } else {
            // Check if file is too old (>24 hours without booking)
            const fileAge = Date.now() - new Date(file.created_at).getTime();
            if (fileAge > 24 * 60 * 60 * 1000) {
              reason = "abandoned";
            }
          }

          orphaned.push({
            path: file.name,
            size: file.metadata?.size || 0,
            uploadedAt: new Date(file.created_at),
            bookingId: booking?.id,
            reason,
          });
        }
      }

      return orphaned;
    } catch (error) {
      console.error("Failed to scan orphaned files:", error);
      return [];
    }
  }

  /**
   * Execute cleanup operation
   */
  async executeCleanup(type: "scheduled" | "manual" = "scheduled"): Promise<CleanupRun> {
    const startTime = Date.now();
    const runId = `cleanup-${Date.now()}`;
    const errors: string[] = [];
    let filesDeleted = 0;
    let bookingsCleaned = 0;
    let bytesReclaimed = 0;

    try {
      // Scan for orphaned files
      const orphaned = await this.scanOrphanedFiles();

      // Delete orphaned files
      for (const file of orphaned) {
        try {
          const { error } = await this.supabase.storage.from("payment-proofs").remove([file.path]);

          if (error) {
            errors.push(`Failed to delete ${file.path}: ${error.message}`);
          } else {
            filesDeleted++;
            bytesReclaimed += file.size;
          }
        } catch (error) {
          errors.push(`Error deleting ${file.path}: ${String(error)}`);
        }
      }

      // Clean up expired guest bookings
      const { data: expiredBookings, error: expiredError } = await this.supabase
        .from("bookings")
        .select("id")
        .eq("is_guest_booking", true)
        .eq("booking_status", "pending")
        .lt("upload_expires_at", new Date().toISOString());

      if (!expiredError && expiredBookings) {
        const { error: updateError } = await this.supabase
          .from("bookings")
          .update({
            booking_status: "expired",
            upload_status: "expired",
          })
          .in(
            "id",
            expiredBookings.map((b) => b.id)
          );

        if (!updateError) {
          bookingsCleaned = expiredBookings.length;
        } else {
          errors.push(`Failed to update expired bookings: ${updateError.message}`);
        }
      }

      // Create cleanup run record
      const run: CleanupRun = {
        id: runId,
        timestamp: new Date(),
        type,
        filesDeleted,
        bookingsCleaned,
        bytesReclaimed,
        duration: Date.now() - startTime,
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };

      // Store run in history
      this.cleanupHistory.push(run);
      if (this.cleanupHistory.length > 100) {
        this.cleanupHistory = this.cleanupHistory.slice(-100);
      }

      // Store in KV for persistence
      if (this.kvNamespace) {
        await this.kvNamespace.put(`cleanup_run:${runId}`, JSON.stringify(run), {
          expirationTtl: 30 * 24 * 60 * 60, // 30 days
        });
      }

      // Log to audit trail
      await logAuditEvent({
        tableName: "system",
        category: AuditCategory.SYSTEM,
        severity: run.success ? AuditSeverity.INFO : AuditSeverity.WARNING,
        description: `Cleanup executed for ${type}: ${filesDeleted} files, ${bookingsCleaned} bookings`,
        metadata: {
          runId,
          filesDeleted,
          bookingsCleaned,
          bytesReclaimed,
          duration: run.duration,
          errors,
        },
      });

      // Alert if significant cleanup
      if (filesDeleted > 50 || bytesReclaimed > 100 * 1024 * 1024) {
        this.alertSystem.trigger({
          id: `cleanup-large-${runId}`,
          source: "cleanup-monitor",
          level: "info",
          title: "Large cleanup operation",
          message: `Cleaned ${filesDeleted} orphaned files (${this.formatBytes(bytesReclaimed)})`,
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      return run;
    } catch (error) {
      const run: CleanupRun = {
        id: runId,
        timestamp: new Date(),
        type,
        filesDeleted: 0,
        bookingsCleaned: 0,
        bytesReclaimed: 0,
        duration: Date.now() - startTime,
        success: false,
        errors: [`Cleanup failed: ${String(error)}`],
      };

      await logAuditEvent({
        tableName: "system",
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.CRITICAL,
        description: `Cleanup operation failed: ${String(error)}`,
        metadata: { runId, error: String(error) },
      });

      return run;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getStatistics(): Promise<CleanupStats> {
    const orphaned = await this.scanOrphanedFiles();
    const lastRun = this.cleanupHistory[this.cleanupHistory.length - 1];

    // Calculate next scheduled time (hourly)
    const nextScheduled = new Date();
    nextScheduled.setHours(nextScheduled.getHours() + 1, 0, 0, 0);

    // Calculate success rate
    const successfulRuns = this.cleanupHistory.filter((r) => r.success).length;
    const successRate =
      this.cleanupHistory.length > 0 ? (successfulRuns / this.cleanupHistory.length) * 100 : 100;

    // Get expired bookings count
    const { count: expiredCount } = await this.supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("is_guest_booking", true)
      .eq("booking_status", "pending")
      .lt("upload_expires_at", new Date().toISOString());

    return {
      orphanedFiles: orphaned.length,
      expiredBookings: expiredCount || 0,
      storageReclaimed: orphaned.reduce((sum, f) => sum + f.size, 0),
      lastCleanup: lastRun ? lastRun.timestamp : null,
      nextScheduled,
      successRate,
    };
  }

  /**
   * Get cleanup history
   */
  getHistory(limit: number = 10): CleanupRun[] {
    return this.cleanupHistory.slice(-limit);
  }

  /**
   * Get detailed orphaned file analysis
   */
  async analyzeOrphans(): Promise<{
    byReason: Record<string, number>;
    totalSize: number;
    oldestFile: Date | null;
    recommendations: string[];
  }> {
    const orphaned = await this.scanOrphanedFiles();

    const byReason: Record<string, number> = {
      no_booking: 0,
      expired: 0,
      failed_upload: 0,
      abandoned: 0,
    };

    let oldestFile: Date | null = null;

    orphaned.forEach((file) => {
      byReason[file.reason]++;
      if (oldestFile === null || file.uploadedAt.getTime() < oldestFile.getTime()) {
        oldestFile = file.uploadedAt;
      }
    });

    const totalSize = orphaned.reduce((sum, f) => sum + f.size, 0);

    const recommendations: string[] = [];

    if (byReason.abandoned > 10) {
      recommendations.push(
        "High number of abandoned uploads. Consider reducing upload expiration time."
      );
    }

    if (byReason.failed_upload > 5) {
      recommendations.push("Multiple failed uploads detected. Check upload confirmation process.");
    }

    if (totalSize > 50 * 1024 * 1024) {
      recommendations.push(
        `${this.formatBytes(totalSize)} of orphaned files. Run cleanup immediately.`
      );
    }

    if (oldestFile) {
      const oldestDate: Date = oldestFile; // Explicit type assertion
      const age = Date.now() - oldestDate.getTime();
      if (age > 7 * 24 * 60 * 60 * 1000) {
        recommendations.push("Orphaned files older than 7 days detected. Review cleanup schedule.");
      }
    }

    return {
      byReason,
      totalSize,
      oldestFile,
      recommendations,
    };
  }

  /**
   * Check cleanup health and alert if issues
   */
  async checkHealth(): Promise<void> {
    const stats = await this.getStatistics();

    // Alert if too many orphaned files
    if (stats.orphanedFiles > 100) {
      this.alertSystem.trigger({
        id: `cleanup-orphans-${Date.now()}`,
        source: "cleanup-monitor",
        level: "warning",
        title: "High orphaned file count",
        message: `${stats.orphanedFiles} orphaned files detected`,
        metadata: { count: stats.orphanedFiles },
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Alert if cleanup hasn't run recently
    if (stats.lastCleanup) {
      const hoursSinceLastCleanup = (Date.now() - stats.lastCleanup.getTime()) / (60 * 60 * 1000);

      if (hoursSinceLastCleanup > 2) {
        this.alertSystem.trigger({
          id: `cleanup-overdue-${Date.now()}`,
          source: "cleanup-monitor",
          level: "warning",
          title: "Cleanup overdue",
          message: `Cleanup hasn't run for ${hoursSinceLastCleanup.toFixed(1)} hours`,
          timestamp: new Date(),
          acknowledged: false,
        });
      }
    }

    // Alert if success rate is low
    if (stats.successRate < 80 && this.cleanupHistory.length >= 5) {
      this.alertSystem.trigger({
        id: `cleanup-failures-${Date.now()}`,
        source: "cleanup-monitor",
        level: "critical",
        title: "Cleanup failures",
        message: `Cleanup success rate is ${stats.successRate.toFixed(1)}%`,
        metadata: { successRate: stats.successRate },
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

// Export for use in Cloudflare Workers cron job
export async function runScheduledCleanup(env: {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CLEANUP_KV?: KVNamespace;
}): Promise<void> {
  const monitor = new CleanupMonitor(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.CLEANUP_KV
  );

  const result = await monitor.executeCleanup("scheduled");
  console.log(`Cleanup completed: ${result.filesDeleted} files, ${result.bytesReclaimed} bytes`);
}
