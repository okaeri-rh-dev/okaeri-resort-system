/**
 * Cloudflare KV Quota Monitoring
 *
 * Tracks KV namespace write operations against free tier limits
 * (1,000 writes/day) and provides usage analytics.
 */

import { getAlertSystem, Alert } from "./alert-system";
import { logAuditEvent } from "../audit-logger";
import { AuditCategory, AuditSeverity } from "@/types/database.types";

interface KVUsageStats {
  writesCount: number;
  writesLimit: number;
  percentage: number;
  period: string;
  estimatedCost: number;
  lastUpdated: Date;
}

interface KVOperation {
  type: "write" | "read" | "delete" | "list";
  key: string;
  timestamp: Date;
  size?: number;
  ttl?: number;
}

// Free tier limits
const KV_LIMITS = {
  DAILY_WRITES: 1000,
  DAILY_READS: 100000,
  WARNING_THRESHOLD: 0.8, // Alert at 80%
  CRITICAL_THRESHOLD: 0.95, // Critical at 95%
};

export class KVQuotaMonitor {
  private operations: KVOperation[] = [];
  private alertSystem = getAlertSystem();
  private kvNamespace: KVNamespace | null = null;

  constructor(kvNamespace?: KVNamespace) {
    this.kvNamespace = kvNamespace || null;
  }

  /**
   * Track a KV operation
   */
  async trackOperation(operation: KVOperation): Promise<void> {
    this.operations.push(operation);

    // Clean up old operations (keep only last 24 hours)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.operations = this.operations.filter((op) => op.timestamp > cutoff);

    // Check if we need to alert
    if (operation.type === "write") {
      await this.checkWriteQuota();
    }
  }

  /**
   * Get current usage statistics
   */
  async getCurrentUsage(): Promise<KVUsageStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count today's writes
    const todayWrites = this.operations.filter(
      (op) => op.type === "write" && op.timestamp >= todayStart
    ).length;

    const percentage = (todayWrites / KV_LIMITS.DAILY_WRITES) * 100;

    // Estimate cost if exceeding free tier
    const excessWrites = Math.max(0, todayWrites - KV_LIMITS.DAILY_WRITES);
    const estimatedCost = excessWrites * 0.00001; // $0.01 per 1000 writes

    return {
      writesCount: todayWrites,
      writesLimit: KV_LIMITS.DAILY_WRITES,
      percentage,
      period: this.getCurrentPeriod(),
      estimatedCost,
      lastUpdated: new Date(),
    };
  }

  /**
   * Check write quota and trigger alerts if needed
   */
  async checkWriteQuota(): Promise<Alert | null> {
    const usage = await this.getCurrentUsage();
    const percentageUsed = usage.percentage / 100;

    // Check thresholds
    const alert = this.alertSystem.checkThresholds("kv_writes_percentage", usage.percentage);

    if (alert) {
      // Log to audit trail
      await logAuditEvent({
        tableName: "system",
        category: AuditCategory.SYSTEM,
        severity: alert.level === "critical" ? AuditSeverity.CRITICAL : AuditSeverity.WARNING,
        description: `KV write quota at ${usage.percentage.toFixed(1)}%`,
        metadata: {
          writesCount: usage.writesCount,
          writesLimit: usage.writesLimit,
          percentage: usage.percentage,
          estimatedCost: usage.estimatedCost,
        },
      });
    }

    // Auto-throttle if critical
    if (percentageUsed >= KV_LIMITS.CRITICAL_THRESHOLD) {
      await this.enableThrottling();
    }

    return alert;
  }

  /**
   * Get detailed statistics for dashboard
   */
  async getDetailedStats(): Promise<{
    current: KVUsageStats;
    hourlyBreakdown: { hour: number; writes: number; reads: number }[];
    topKeys: { key: string; operations: number }[];
    projectedDailyWrites: number;
    throttled: boolean;
  }> {
    const current = await this.getCurrentUsage();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Hourly breakdown
    const hourlyBreakdown = [];
    for (let hour = 0; hour <= now.getHours(); hour++) {
      const hourStart = new Date(todayStart.getTime() + hour * 60 * 60 * 1000);
      const hourEnd = new Date(todayStart.getTime() + (hour + 1) * 60 * 60 * 1000);

      const hourOps = this.operations.filter(
        (op) => op.timestamp >= hourStart && op.timestamp < hourEnd
      );

      hourlyBreakdown.push({
        hour,
        writes: hourOps.filter((op) => op.type === "write").length,
        reads: hourOps.filter((op) => op.type === "read").length,
      });
    }

    // Top keys by operation count
    const keyCount = new Map<string, number>();
    this.operations
      .filter((op) => op.timestamp >= todayStart)
      .forEach((op) => {
        const count = keyCount.get(op.key) || 0;
        keyCount.set(op.key, count + 1);
      });

    const topKeys = Array.from(keyCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, operations]) => ({ key, operations }));

    // Project daily writes based on current rate
    const hoursPassed = (now.getTime() - todayStart.getTime()) / (60 * 60 * 1000);
    const writesPerHour = current.writesCount / Math.max(hoursPassed, 1);
    const projectedDailyWrites = Math.round(writesPerHour * 24);

    // Check if throttling is enabled
    const throttled = await this.isThrottled();

    return {
      current,
      hourlyBreakdown,
      topKeys,
      projectedDailyWrites,
      throttled,
    };
  }

  /**
   * Enable write throttling when approaching limit
   */
  private async enableThrottling(): Promise<void> {
    if (!this.kvNamespace) return;

    try {
      await this.kvNamespace.put("throttle_enabled", "true", {
        expirationTtl: 3600, // Throttle for 1 hour
      });

      await logAuditEvent({
        tableName: "system",
        category: AuditCategory.SYSTEM,
        severity: AuditSeverity.WARNING,
        description: "KV write throttling enabled due to quota limits",
        metadata: {
          duration: "1 hour",
        },
      });
    } catch (error) {
      console.error("Failed to enable throttling:", error);
    }
  }

  /**
   * Check if throttling is currently enabled
   */
  async isThrottled(): Promise<boolean> {
    if (!this.kvNamespace) return false;

    try {
      const value = await this.kvNamespace.get("throttle_enabled");
      return value === "true";
    } catch {
      return false;
    }
  }

  /**
   * Reset daily tracking (called by cron job at midnight)
   */
  async resetDailyTracking(): Promise<void> {
    // Keep only operations from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    this.operations = this.operations.filter((op) => op.timestamp >= todayStart);

    // Log reset
    await logAuditEvent({
      tableName: "system",
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.INFO,
      description: "Daily KV quota tracking reset",
      metadata: {
        period: this.getCurrentPeriod(),
      },
    });
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const usage = this.operations;

    // Check for duplicate writes
    const recentWrites = new Map<string, number>();
    usage
      .filter((op) => op.type === "write")
      .forEach((op) => {
        const count = recentWrites.get(op.key) || 0;
        recentWrites.set(op.key, count + 1);
      });

    const duplicates = Array.from(recentWrites.entries()).filter(([_, count]) => count > 3);

    if (duplicates.length > 0) {
      suggestions.push(
        `Consider caching or batching writes for keys: ${duplicates
          .slice(0, 3)
          .map(([key]) => key)
          .join(", ")}`
      );
    }

    // Check for short TTLs
    const shortTTLs = usage.filter((op) => op.type === "write" && op.ttl && op.ttl < 300);

    if (shortTTLs.length > 10) {
      suggestions.push(
        "Many writes have short TTLs (<5 minutes). Consider using in-memory caching instead."
      );
    }

    // Check write patterns
    const writes = usage.filter((op) => op.type === "write");
    if (writes.length > 0) {
      const avgSize = writes.reduce((sum, op) => sum + (op.size || 0), 0) / writes.length;
      if (avgSize < 100) {
        suggestions.push(
          "Average write size is small. Consider batching multiple values into single keys."
        );
      }
    }

    return suggestions;
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }
}

// Cloudflare Workers middleware to track KV operations
export function createKVTracker(monitor: KVQuotaMonitor) {
  return {
    async get(key: string, namespace: KVNamespace): Promise<string | null> {
      await monitor.trackOperation({
        type: "read",
        key,
        timestamp: new Date(),
      });
      return namespace.get(key);
    },

    async put(
      key: string,
      value: string,
      namespace: KVNamespace,
      options?: KVNamespacePutOptions
    ): Promise<void> {
      await monitor.trackOperation({
        type: "write",
        key,
        timestamp: new Date(),
        size: new Blob([value]).size,
        ttl: options?.expirationTtl,
      });

      // Check if throttled
      const throttled = await monitor.isThrottled();
      if (throttled) {
        // Implement exponential backoff or skip non-critical writes
        const isCritical = key.startsWith("critical:") || key.startsWith("security:");
        if (!isCritical) {
          console.warn(`KV write throttled for key: ${key}`);
          return;
        }
      }

      return namespace.put(key, value, options);
    },

    async delete(key: string, namespace: KVNamespace): Promise<void> {
      await monitor.trackOperation({
        type: "delete",
        key,
        timestamp: new Date(),
      });
      return namespace.delete(key);
    },
  };
}

// Export for use in Cloudflare Workers
export { KV_LIMITS };
