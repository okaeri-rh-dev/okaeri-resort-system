/**
 * Supabase Bandwidth Monitoring Utility
 *
 * Tracks bandwidth usage against free tier limits (2GB/month)
 * and triggers alerts when approaching thresholds.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logAuditEvent } from "../audit-logger";
import { AuditCategory, AuditSeverity } from "../../../database.types";

interface BandwidthUsage {
  bytesUsed: number;
  bytesLimit: number;
  percentage: number;
  period: string;
  lastUpdated: Date;
}

interface BandwidthAlert {
  level: "info" | "warning" | "critical";
  threshold: number;
  message: string;
  currentUsage: number;
}

// Free tier limits
const BANDWIDTH_LIMITS = {
  MONTHLY_BYTES: 2 * 1024 * 1024 * 1024, // 2GB in bytes
  WARNING_THRESHOLD: 0.8, // Alert at 80%
  CRITICAL_THRESHOLD: 0.95, // Critical at 95%
};

export class BandwidthMonitor {
  private supabase: SupabaseClient;
  private alertCallbacks: ((alert: BandwidthAlert) => void)[] = [];
  private lastAlertLevel: string | null = null;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get current bandwidth usage from Supabase
   * Note: In production, this would integrate with Supabase's billing API
   */
  async getCurrentUsage(): Promise<BandwidthUsage> {
    try {
      // In a real implementation, this would call Supabase's usage API
      // For now, we'll track uploads and estimate bandwidth
      const { data: uploads, error } = await this.supabase
        .from("bookings")
        .select("metadata")
        .eq("is_guest_booking", true)
        .gte("created_at", this.getMonthStart())
        .lte("created_at", new Date().toISOString());

      if (error) throw error;

      // Calculate estimated bandwidth from uploads
      let bytesUsed = 0;
      uploads?.forEach((booking) => {
        const fileSize = booking.metadata?.file_size || 0;
        // Account for both upload and download bandwidth
        bytesUsed += fileSize * 2;
      });

      const percentage = (bytesUsed / BANDWIDTH_LIMITS.MONTHLY_BYTES) * 100;

      return {
        bytesUsed,
        bytesLimit: BANDWIDTH_LIMITS.MONTHLY_BYTES,
        percentage,
        period: this.getCurrentPeriod(),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("Failed to get bandwidth usage:", error);
      throw error;
    }
  }

  /**
   * Check usage and trigger alerts if thresholds are exceeded
   */
  async checkAndAlert(): Promise<BandwidthAlert | null> {
    try {
      const usage = await this.getCurrentUsage();
      const percentageUsed = usage.percentage / 100;

      let alert: BandwidthAlert | null = null;

      if (percentageUsed >= BANDWIDTH_LIMITS.CRITICAL_THRESHOLD) {
        alert = {
          level: "critical",
          threshold: BANDWIDTH_LIMITS.CRITICAL_THRESHOLD * 100,
          message: `Critical: Bandwidth usage at ${usage.percentage.toFixed(1)}% (${this.formatBytes(usage.bytesUsed)} of ${this.formatBytes(usage.bytesLimit)})`,
          currentUsage: usage.percentage,
        };
      } else if (percentageUsed >= BANDWIDTH_LIMITS.WARNING_THRESHOLD) {
        alert = {
          level: "warning",
          threshold: BANDWIDTH_LIMITS.WARNING_THRESHOLD * 100,
          message: `Warning: Bandwidth usage at ${usage.percentage.toFixed(1)}% (${this.formatBytes(usage.bytesUsed)} of ${this.formatBytes(usage.bytesLimit)})`,
          currentUsage: usage.percentage,
        };
      } else if (
        this.lastAlertLevel !== null &&
        percentageUsed < BANDWIDTH_LIMITS.WARNING_THRESHOLD
      ) {
        // Usage back to normal
        alert = {
          level: "info",
          threshold: BANDWIDTH_LIMITS.WARNING_THRESHOLD * 100,
          message: `Bandwidth usage back to normal: ${usage.percentage.toFixed(1)}%`,
          currentUsage: usage.percentage,
        };
      }

      if (alert && alert.level !== this.lastAlertLevel) {
        this.lastAlertLevel = alert.level;
        await this.logAlert(alert);
        this.notifySubscribers(alert);
        return alert;
      }

      return null;
    } catch (error) {
      console.error("Bandwidth check failed:", error);
      return null;
    }
  }

  /**
   * Subscribe to bandwidth alerts
   */
  onAlert(callback: (alert: BandwidthAlert) => void): () => void {
    this.alertCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get bandwidth statistics for dashboard
   */
  async getStatistics(): Promise<{
    current: BandwidthUsage;
    dailyAverage: number;
    projectedMonthly: number;
    daysRemaining: number;
  }> {
    const usage = await this.getCurrentUsage();
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

    const dailyAverage = usage.bytesUsed / dayOfMonth;
    const projectedMonthly = dailyAverage * daysInMonth;
    const daysRemaining = daysInMonth - dayOfMonth;

    return {
      current: usage,
      dailyAverage,
      projectedMonthly,
      daysRemaining,
    };
  }

  /**
   * Track a new file upload
   */
  async trackUpload(fileSize: number, bookingId: string): Promise<void> {
    try {
      // Store upload metadata for tracking
      const { error } = await this.supabase
        .from("bookings")
        .update({
          metadata: {
            file_size: fileSize,
            upload_timestamp: new Date().toISOString(),
          },
        })
        .eq("id", bookingId);

      if (error) throw error;

      // Check if this upload triggers any alerts
      await this.checkAndAlert();
    } catch (error) {
      console.error("Failed to track upload:", error);
    }
  }

  /**
   * Reset monthly tracking (called by cron job)
   */
  async resetMonthlyTracking(): Promise<void> {
    try {
      this.lastAlertLevel = null;

      // Log monthly reset
      await logAuditEvent({
        tableName: "system",
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.INFO,
        description: "Monthly bandwidth tracking reset",
        metadata: {
          period: this.getCurrentPeriod(),
        },
      });
    } catch (error) {
      console.error("Failed to reset monthly tracking:", error);
    }
  }

  private notifySubscribers(alert: BandwidthAlert): void {
    this.alertCallbacks.forEach((callback) => {
      try {
        callback(alert);
      } catch (error) {
        console.error("Alert callback failed:", error);
      }
    });
  }

  private async logAlert(alert: BandwidthAlert): Promise<void> {
    const severity =
      alert.level === "critical"
        ? AuditSeverity.CRITICAL
        : alert.level === "warning"
          ? AuditSeverity.WARNING
          : AuditSeverity.INFO;

    await logAuditEvent({
      tableName: "system",
      category: AuditCategory.SYSTEM,
      severity,
      description: `Bandwidth alert: ${alert.message}`,
      metadata: {
        threshold: alert.threshold,
        currentUsage: alert.currentUsage,
        level: alert.level,
      },
    });
  }

  private getMonthStart(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

// Cloudflare Workers-compatible bandwidth tracker
export async function trackBandwidthInKV(kv: KVNamespace, bytes: number): Promise<void> {
  const key = `bandwidth:${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const current = await kv.get(key);
  const currentBytes = current ? parseInt(current) : 0;
  const newTotal = currentBytes + bytes;

  await kv.put(key, String(newTotal), {
    expirationTtl: 60 * 60 * 24 * 32, // Expire after 32 days
  });

  // Check if we need to alert
  const percentage = (newTotal / BANDWIDTH_LIMITS.MONTHLY_BYTES) * 100;

  if (percentage >= BANDWIDTH_LIMITS.CRITICAL_THRESHOLD * 100) {
    console.error(`CRITICAL: Bandwidth usage at ${percentage.toFixed(1)}%`);
  } else if (percentage >= BANDWIDTH_LIMITS.WARNING_THRESHOLD * 100) {
    console.warn(`WARNING: Bandwidth usage at ${percentage.toFixed(1)}%`);
  }
}

// Export for use in Cloudflare Workers
export { BANDWIDTH_LIMITS };
