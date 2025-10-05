/**
 * Simple KV-based Metrics Collection System
 *
 * Tracks various application metrics using Cloudflare KV storage
 * with minimal write operations to stay within free tier limits.
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
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
  private flushInterval: number = 60000; // Flush every minute
  private lastFlush: Date = new Date();

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Increment a metric (batched to reduce KV writes)
   */
  async increment(metric: string, value: number = 1): Promise<void> {
    const current = this.batchBuffer.get(metric) || 0;
    this.batchBuffer.set(metric, current + value);

    // Auto-flush if buffer is getting large or time has passed
    if (this.batchBuffer.size > 10 || Date.now() - this.lastFlush.getTime() > this.flushInterval) {
      await this.flush();
    }
  }

  /**
   * Flush batched metrics to KV
   */
  async flush(): Promise<void> {
    if (this.batchBuffer.size === 0) return;

    const today = new Date().toISOString().split("T")[0];
    const promises: Promise<void>[] = [];

    for (const [metric, value] of this.batchBuffer.entries()) {
      const key = `metric:${metric}:${today}`;
      promises.push(this.updateMetric(key, value));
    }

    await Promise.all(promises);
    this.batchBuffer.clear();
    this.lastFlush = new Date();
  }

  /**
   * Update a metric value in KV
   */
  private async updateMetric(key: string, increment: number): Promise<void> {
    try {
      const current = await this.kv.get(key);
      const newValue = (parseInt(current || "0") + increment).toString();

      await this.kv.put(key, newValue, {
        expirationTtl: 86400 * 30, // Keep for 30 days
      });
    } catch (error) {
      console.error(`Failed to update metric ${key}:`, error);
    }
  }

  /**
   * Get a specific metric value
   */
  async getMetric(metric: string, date?: string): Promise<number> {
    // Flush any pending updates first
    await this.flush();

    const dateStr = date || new Date().toISOString().split("T")[0];
    const key = `metric:${metric}:${dateStr}`;
    const value = await this.kv.get(key);
    return parseInt(value || "0");
  }

  /**
   * Get all daily metrics
   */
  async getDailyMetrics(date?: string): Promise<DailyMetrics> {
    await this.flush();

    const dateStr = date || new Date().toISOString().split("T")[0];

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

  /**
   * Get metrics for a date range
   */
  async getMetricsRange(
    metric: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; value: number }[]> {
    await this.flush();

    const results: { date: string; value: number }[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];
      const value = await this.getMetric(metric, dateStr);
      results.push({ date: dateStr, value });
      current.setDate(current.getDate() + 1);
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
  async trackEvent(eventName: string, metadata?: Record<string, any>): Promise<void> {
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
  async getRecentEvents(eventName?: string, limit: number = 100): Promise<any[]> {
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
   */
  async cleanup(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    let deleted = 0;
    const list = await this.kv.list({ prefix: "metric:", limit: 1000 });

    for (const key of list.keys) {
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
  metadata?: Record<string, any>
): Promise<void> {
  // Increment the main counter
  await collector.increment(type === "error" ? "failures" : `${type}s`);

  // Track bandwidth for uploads
  if (type === "upload" && metadata?.size) {
    const sizeMB = Math.ceil(metadata.size / (1024 * 1024));
    await collector.increment("bandwidth_mb", sizeMB);
  }

  // Track the event with metadata
  await collector.trackEvent(type, metadata);

  // Count as a KV write
  await collector.increment("kv_writes");
}
