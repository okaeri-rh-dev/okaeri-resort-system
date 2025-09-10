/**
 * Performance Analytics Collection API
 * Phase 5.4: Monitoring Setup - Collect performance metrics and business analytics
 *
 * POST /api/monitoring/performance
 */

import type { VercelRequest as _VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandler, withMethod, compose, type ExtendedRequest } from "../_lib/middleware";
import { successResponse, errorResponse } from "../_lib/types";
import { env } from "../../src/lib/env";
import { ErrorHandler } from "../../src/lib/error-handler";
import { z } from "zod";

// Performance metric schema validation
const PerformanceMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  timestamp: z.number(),
  url: z.string(),
  userAgent: z.string().optional(),
  connection: z.string().optional(),
});

const AnalyticsEventSchema = z.object({
  event: z.string(),
  properties: z.record(z.any()),
  userId: z.string().optional(),
  timestamp: z.number().optional(),
});

const PerformancePayloadSchema = z.object({
  metrics: z.array(PerformanceMetricSchema).optional(),
  events: z.array(AnalyticsEventSchema).optional(),
});

interface ProcessedMetric {
  name: string;
  value: number;
  rating: string;
  timestamp: number;
  url: string;
  metadata?: Record<string, any>;
}

async function handler(req: ExtendedRequest, res: VercelResponse) {
  const requestLogger = req.requestLogger!;

  requestLogger.debug("Processing performance analytics data");

  try {
    // Validate request payload
    const validationResult = PerformancePayloadSchema.safeParse(req.body);
    if (!validationResult.success) {
      requestLogger.warn("Invalid performance data payload", {
        errors: validationResult.error.errors,
      });
      return res.status(400).json(errorResponse("Invalid performance data format"));
    }

    const { metrics = [], events = [] } = validationResult.data;

    // Process performance metrics
    const processedMetrics: ProcessedMetric[] = [];

    for (const metric of metrics) {
      try {
        // Enrich metric with additional context
        const processedMetric: ProcessedMetric = {
          name: metric.name,
          value: Math.round(metric.value * 100) / 100, // Round to 2 decimal places
          rating: metric.rating,
          timestamp: metric.timestamp,
          url: metric.url,
          metadata: {
            userAgent: metric.userAgent,
            connection: metric.connection,
            region: process.env.VERCEL_REGION || "unknown",
          },
        };

        processedMetrics.push(processedMetric);

        // Log performance issues
        if (metric.rating === "poor") {
          requestLogger.warn("Poor performance metric detected", {
            metric: metric.name,
            value: metric.value,
            url: metric.url,
            connection: metric.connection,
          });
        }

        // Special handling for specific metrics
        switch (metric.name) {
          case "LCP":
            if (metric.value > 4000) {
              requestLogger.error("Critical LCP performance issue", {
                value: metric.value,
                url: metric.url,
                threshold: 4000,
              });
            }
            break;

          case "INP":
            if (metric.value > 500) {
              requestLogger.error("Critical INP performance issue", {
                value: metric.value,
                url: metric.url,
                threshold: 500,
              });
            }
            break;

          case "CLS":
            if (metric.value > 0.25) {
              requestLogger.error("Critical CLS performance issue", {
                value: metric.value,
                url: metric.url,
                threshold: 0.25,
              });
            }
            break;
        }
      } catch (error) {
        const appError = ErrorHandler.handle(error, { metric: metric.name });
        requestLogger.error("Failed to process performance metric", appError);
      }
    }

    // Process analytics events (internal operations only)
    const processedEvents: any[] = [];

    for (const event of events) {
      try {
        // Filter and validate internal events only
        if (isInternalOperation(event.event)) {
          const processedEvent = {
            event: event.event,
            properties: {
              ...event.properties,
              timestamp: event.timestamp || Date.now(),
              region: process.env.VERCEL_REGION || "unknown",
              environment: env.NODE_ENV,
            },
            userId: event.userId,
            processedAt: Date.now(),
          };

          processedEvents.push(processedEvent);

          // Track critical business operations
          if (isCriticalOperation(event.event)) {
            requestLogger.info("Critical business operation tracked", {
              event: event.event,
              userId: event.userId,
              properties: event.properties,
            });
          }

          // Monitor for performance issues in business operations
          if (event.properties.duration_ms && event.properties.duration_ms > 5000) {
            requestLogger.warn("Slow business operation detected", {
              event: event.event,
              duration: event.properties.duration_ms,
              userId: event.userId,
            });
          }
        } else {
          requestLogger.debug("Skipped non-internal event", { event: event.event });
        }
      } catch (error) {
        const appError = ErrorHandler.handle(error, { event: event.event });
        requestLogger.error("Failed to process analytics event", appError);
      }
    }

    // Store metrics in Redis for dashboard (if available)
    if (env.UPSTASH_REDIS_REST_URL && (processedMetrics.length > 0 || processedEvents.length > 0)) {
      try {
        await storeMetricsInRedis(processedMetrics, processedEvents);
        requestLogger.debug("Metrics stored in Redis cache");
      } catch (error) {
        const appError = ErrorHandler.handle(error, { context: "redis_storage" });
        requestLogger.warn("Failed to store metrics in Redis", appError);
      }
    }

    // Generate performance insights
    const insights = generatePerformanceInsights(processedMetrics);

    const response = {
      received: {
        metrics: metrics.length,
        events: events.length,
      },
      processed: {
        metrics: processedMetrics.length,
        events: processedEvents.length,
      },
      insights,
      timestamp: new Date().toISOString(),
    };

    requestLogger.info("Performance analytics processed", response);

    return res.status(200).json(successResponse(response));
  } catch (error) {
    const appError = ErrorHandler.handle(error, { context: "performance_analytics" });
    requestLogger.error("Performance analytics processing failed", appError);

    return res.status(500).json(errorResponse("Failed to process performance analytics"));
  }
}

/**
 * Check if event represents internal resort operations
 */
function isInternalOperation(eventName: string): boolean {
  const internalEvents = [
    "booking_operation",
    "expense_operation",
    "dashboard_operation",
    "auth_operation",
    "monitoring_operation",
    "form_submission",
    "navigation_click",
    "route_performance",
    "operation_performance",
    "business_operation",
  ];

  return internalEvents.some((pattern) => eventName.includes(pattern));
}

/**
 * Check if operation is critical for business continuity
 */
function isCriticalOperation(eventName: string): boolean {
  const criticalOperations = [
    "booking_created",
    "expense_logged",
    "auth_failure",
    "system_error",
    "database_error",
  ];

  return criticalOperations.includes(eventName);
}

/**
 * Store metrics in Redis for dashboard consumption
 */
async function storeMetricsInRedis(metrics: ProcessedMetric[], events: any[]): Promise<void> {
  if (!env.UPSTASH_REDIS_REST_URL) return;

  const currentMinute = Math.floor(Date.now() / 60000);
  const currentHour = Math.floor(Date.now() / 3600000);

  // Store recent metrics for dashboard
  for (const metric of metrics) {
    const metricKey = `metric:${metric.name}:${currentMinute}`;
    await fetch(`${env.UPSTASH_REDIS_REST_URL}/lpush/${metricKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([JSON.stringify(metric)]),
    });

    // Set expiry for 1 hour
    await fetch(`${env.UPSTASH_REDIS_REST_URL}/expire/${metricKey}/3600`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    });
  }

  // Store aggregated data for longer term
  if (metrics.length > 0) {
    const hourlyKey = `metrics:hourly:${currentHour}`;
    const hourlyData = {
      timestamp: currentHour * 3600000,
      metrics: metrics.length,
      events: events.length,
      performance: calculateAveragePerformance(metrics),
    };

    await fetch(`${env.UPSTASH_REDIS_REST_URL}/set/${hourlyKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([JSON.stringify(hourlyData)]),
    });

    // Keep hourly data for 24 hours
    await fetch(`${env.UPSTASH_REDIS_REST_URL}/expire/${hourlyKey}/86400`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    });
  }
}

/**
 * Calculate average performance from metrics
 */
function calculateAveragePerformance(metrics: ProcessedMetric[]) {
  const performanceMetrics = metrics.filter((m) =>
    ["LCP", "INP", "CLS", "FCP", "TTFB"].includes(m.name)
  );

  if (performanceMetrics.length === 0) {
    return null;
  }

  const averages: Record<string, number> = {};
  const counts: Record<string, number> = {};

  performanceMetrics.forEach((metric) => {
    if (!averages[metric.name]) {
      averages[metric.name] = 0;
      counts[metric.name] = 0;
    }
    averages[metric.name] += metric.value;
    counts[metric.name]++;
  });

  Object.keys(averages).forEach((name) => {
    averages[name] = Math.round((averages[name] / counts[name]) * 100) / 100;
  });

  return averages;
}

/**
 * Generate performance insights from collected metrics
 */
function generatePerformanceInsights(metrics: ProcessedMetric[]) {
  const insights: string[] = [];
  const poorMetrics = metrics.filter((m) => m.rating === "poor");

  if (poorMetrics.length > 0) {
    insights.push(`${poorMetrics.length} metrics showing poor performance`);

    const slowestMetric = poorMetrics.reduce((prev, current) =>
      current.value > prev.value ? current : prev
    );

    insights.push(`Slowest metric: ${slowestMetric.name} (${slowestMetric.value}ms)`);
  }

  const lcpMetrics = metrics.filter((m) => m.name === "LCP");
  if (lcpMetrics.length > 0) {
    const avgLCP = lcpMetrics.reduce((sum, m) => sum + m.value, 0) / lcpMetrics.length;
    if (avgLCP > 2500) {
      insights.push("LCP performance needs improvement - consider optimizing largest content");
    }
  }

  const clsMetrics = metrics.filter((m) => m.name === "CLS");
  if (clsMetrics.some((m) => m.value > 0.1)) {
    insights.push("Layout shifts detected - ensure images have dimensions");
  }

  if (insights.length === 0) {
    insights.push("All performance metrics within acceptable ranges");
  }

  return insights;
}

// Export handler with middleware
export default compose(withErrorHandler, withMethod(["POST"]))(handler);
