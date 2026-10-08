/**
 * Simple KV-based Metrics Collection System
 *
 * Tracks various application metrics using Cloudflare KV storage
 * with minimal write operations to stay within free tier limits.
 */

import { toUTCDateString } from "@/lib/timezone";

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface DailyMetrics {
  bookings: number;
  uploads: number;
  failures: number;
  statusChecks: number;
  emails: number;
  kvWrites: number;
  bandwidthMB: number;
}

export interface MetricSummary {
  total: number;
  average: number;
  min: number;
  max: number;
  trend: "increasing" | "decreasing" | "stable";
}

export class MetricsCollector {
  private kv: KVNamespace;
  private batchBuffer: Map<string, number> = new Map();
  private flushInterval: number = 300000; // Flush every 5 minutes (was 60s - reduced for quota)
  private lastFlush: Date = new Date();
  private flushThreshold: number = 100; // Batch up to 100 metrics before flush (was 10)

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Increment a metric (batched to reduce KV writes)
   *
   * Uses aggressive batching to minimize KV writes within free tier limits.
   * Metrics are aggregated into a single daily JSON object per flush.
   */
  async increment(metric: string, value: number = 1): Promise<void> {
    const current = this.batchBuffer.get(metric) || 0;
    this.batchBuffer.set(metric, current + value);

    // Auto-flush if buffer is getting large or time has passed
    // Increased thresholds to reduce KV writes (1000/day limit)
    if (
      this.batchBuffer.size > this.flushThreshold ||
      Date.now() - this.lastFlush.getTime() > this.flushInterval
    ) {
      await this.flush();
    }
  }

  /**
   * Flush batched metrics to KV
   *
   * OPTIMIZED: Aggregates ALL metrics into a single JSON object per day.
   * This reduces KV writes from N (one per metric) to 1 per flush.
   *
   * Before: Each flush = N KV writes (e.g., 10 metrics = 10 writes)
   * After: Each flush = 1 KV write (all metrics in single JSON object)
   *
   * This is critical for staying within the 1000 writes/day free tier limit.
   */
  async flush(): Promise<void> {
    if (this.batchBuffer.size === 0) return;

    const today = toUTCDateString(new Date());
    const aggregateKey = `metrics:daily:${today}`;

    try {
      // Read current aggregate (1 read)
      const currentData = await this.kv.get(aggregateKey);
      const aggregate: Record<string, number> = currentData ? JSON.parse(currentData) : {};

      // Merge batched metrics into aggregate
      for (const [metric, value] of this.batchBuffer.entries()) {
        aggregate[metric] = (aggregate[metric] || 0) + value;
      }

      // Write single aggregated object (1 write instead of N)
      await this.kv.put(aggregateKey, JSON.stringify(aggregate), {
        expirationTtl: 86400 * 30, // Keep for 30 days
      });

      this.batchBuffer.clear();
      this.lastFlush = new Date();
    } catch (error) {
      console.error("Failed to flush metrics:", error);
      // Don't clear buffer on error - retry on next flush
    }
  }

  /**
   * Get a specific metric value
   *
   * Reads from the aggregated daily metrics object.
   */
  async getMetric(metric: string, date?: string): Promise<number> {
    // Flush any pending updates first
    await this.flush();

    const dateStr = date || toUTCDateString(new Date());
    const aggregateKey = `metrics:daily:${dateStr}`;

    try {
      const data = await this.kv.get(aggregateKey);
      if (!data) return 0;

      const aggregate: Record<string, number> = JSON.parse(data);
      return aggregate[metric] || 0;
    } catch {
      // Fallback to legacy key format for backwards compatibility
      const legacyKey = `metric:${metric}:${dateStr}`;
      const value = await this.kv.get(legacyKey);
      return parseInt(value || "0");
    }
  }

  /**
   * Get all daily metrics
   *
   * OPTIMIZED: Reads all metrics from a single KV read instead of 7 reads.
   * Before: 7 KV reads (one per metric type)
   * After: 1 KV read (all metrics in single JSON object)
   */
  async getDailyMetrics(date?: string): Promise<DailyMetrics> {
    await this.flush();

    const dateStr = date || toUTCDateString(new Date());
    const aggregateKey = `metrics:daily:${dateStr}`;

    try {
      const data = await this.kv.get(aggregateKey);
      const aggregate: Record<string, number> = data ? JSON.parse(data) : {};

      return {
        bookings: aggregate.bookings || 0,
        uploads: aggregate.uploads || 0,
        failures: aggregate.failures || 0,
        statusChecks: aggregate.status_checks || 0,
        emails: aggregate.emails || 0,
        kvWrites: aggregate.kv_writes || 0,
        bandwidthMB: aggregate.bandwidth_mb || 0,
      };
    } catch {
      // Fallback to individual reads for backwards compatibility
      return {
        bookings: await this.getMetric("bookings", dateStr),
        uploads: await this.getMetric("uploads", dateStr),
        failures: await this.getMetric("failures", dateStr),
        statusChecks: await this.getMetric("status_checks", dateStr),
        emails: await this.getMetric("emails", dateStr),
        kvWrites: await this.getMetric("kv_writes", dateStr),
        bandwidthMB: await this.getMetric("bandwidth_mb", dateStr),
      };
    }
  }

  /**
   * Get metrics for a date range
   *
   * OPTIMIZED: Reads each day's aggregate in a single KV read.
   */
  async getMetricsRange(
    metric: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; value: number }[]> {
    await this.flush();

    const results: { date: string; value: number }[] = [];
    const current = new Date(startDate);

    // Batch read all dates' aggregates
    const datePromises: Promise<{ date: string; data: Record<string, number> | null }>[] = [];

    while (current <= endDate) {
      const dateStr = toUTCDateString(current);
      const aggregateKey = `metrics:daily:${dateStr}`;

      datePromises.push(
        this.kv.get(aggregateKey).then((data) => ({
          date: dateStr,
          data: data ? JSON.parse(data) : null,
        }))
      );

      current.setDate(current.getDate() + 1);
    }

    const dateResults = await Promise.all(datePromises);

    for (const { date, data } of dateResults) {
      results.push({
        date,
        value: data?.[metric] || 0,
      });
    }

    return results;
  }

  /**
   * Get metric summary with trends
   */
  async getMetricSummary(metric: string, days: number = 7): Promise<MetricSummary> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1);

    const data = await this.getMetricsRange(metric, startDate, endDate);
    const values = data.map((d) => d.value);

    if (values.length === 0) {
      return {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        trend: "stable",
      };
    }

    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate trend
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    let trend: "increasing" | "decreasing" | "stable";
    if (secondAvg > firstAvg * 1.1) {
      trend = "increasing";
    } else if (secondAvg < firstAvg * 0.9) {
      trend = "decreasing";
    } else {
      trend = "stable";
    }

    return { total, average, min, max, trend };
  }

  /**
   * Track a custom event
   */
  async trackEvent(eventName: string, metadata?: Record<string, unknown>): Promise<void> {
    const event = {
      name: eventName,
      timestamp: new Date().toISOString(),
      metadata,
    };

    const key = `event:${eventName}:${Date.now()}`;
    await this.kv.put(key, JSON.stringify(event), {
      expirationTtl: 86400 * 7, // Keep events for 7 days
    });

    // Also increment counter
    await this.increment(`event_${eventName}`);
  }

  /**
   * Get recent events
   */
  async getRecentEvents(eventName?: string, limit: number = 100): Promise<unknown[]> {
    const prefix = eventName ? `event:${eventName}:` : "event:";
    const list = await this.kv.list({ prefix, limit });

    const events = await Promise.all(
      list.keys.map(async (key) => {
        const data = await this.kv.get(key.name);
        return data ? JSON.parse(data) : null;
      })
    );

    return events
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Clean up old metrics (to save KV space)
   *
   * Cleans up both legacy format (metric:*) and new aggregated format (metrics:daily:*)
   */
  async cleanup(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = toUTCDateString(cutoffDate);

    let deleted = 0;

    // Clean up new aggregated format
    const aggregateList = await this.kv.list({ prefix: "metrics:daily:", limit: 1000 });
    for (const key of aggregateList.keys) {
      const dateStr = key.name.replace("metrics:daily:", "");
      if (dateStr < cutoffStr) {
        await this.kv.delete(key.name);
        deleted++;
      }
    }

    // Clean up legacy format (for backwards compatibility)
    const legacyList = await this.kv.list({ prefix: "metric:", limit: 1000 });
    for (const key of legacyList.keys) {
      const parts = key.name.split(":");
      const dateStr = parts[parts.length - 1];

      if (dateStr < cutoffStr) {
        await this.kv.delete(key.name);
        deleted++;
      }
    }

    return deleted;
  }
}

/**
 * Helper function to use in Cloudflare Workers
 */
export function createMetricsCollector(env: { RATE_LIMIT_KV: KVNamespace }): MetricsCollector {
  return new MetricsCollector(env.RATE_LIMIT_KV);
}

/**
 * Track common application metrics
 */
export async function trackApplicationMetric(
  collector: MetricsCollector,
  type: "booking" | "upload" | "email" | "error" | "status_check",
  metadata?: Record<string, unknown>
): Promise<void> {
  // Increment the main counter
  await collector.increment(type === "error" ? "failures" : `${type}s`);

  // Track bandwidth for uploads
  if (type === "upload" && metadata?.size) {
    const sizeMB = Math.ceil(Number(metadata.size) / (1024 * 1024));
    await collector.increment("bandwidth_mb", sizeMB);
  }

  // Track the event with metadata
  await collector.trackEvent(type, metadata);

  // Count as a KV write
  await collector.increment("kv_writes");
}
