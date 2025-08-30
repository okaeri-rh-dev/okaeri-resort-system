# Sub-Phase 5.4: Monitoring Setup

## Overview

This sub-phase focuses on implementing comprehensive observability, error
tracking, real-time analytics, and alerting systems for the production
deployment. The goal is to achieve 99.9% uptime with proactive monitoring and
rapid incident response for the resort management system.

## Objectives

- **Real-time Monitoring**: Implement comprehensive uptime and performance
  monitoring
- **Error Tracking**: Deploy advanced error detection and debugging capabilities
- **Business Analytics**: Set up hospitality-specific metrics and KPI tracking
- **Alerting System**: Configure intelligent alerting with escalation procedures
- **SLA Monitoring**: Track and report on service level agreements

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Monitoring & Observability                  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Application   │   Infrastructure│   Business Intelligence     │
│   Monitoring    │   Monitoring    │   & Analytics               │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • Error Tracking│ • Uptime Checks │ • Booking Metrics           │
│ • Performance   │ • Edge Functions│ • Revenue Tracking          │
│ • User Sessions │ • Database      │ • Guest Satisfaction       │
│ • API Metrics   │ • Third-party   │ • Operational Insights     │
└─────────────────┴─────────────────┴─────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Alerting & Response                       │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Detection     │   Notification  │   Response                  │
│ • Anomalies     │ • Email Alerts  │ • Auto-scaling              │
│ • Thresholds    │ • SMS Alerts    │ • Circuit Breakers         │
│ • Patterns      │ • Slack Alerts  │ • Incident Management       │
│ • Predictions   │ • PagerDuty     │ • Root Cause Analysis      │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## 1. Application Performance Monitoring

### Enhanced Error Tracking with Sentry

```typescript
// src/lib/error-tracking.ts
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import { HttpContext } from "@sentry/types";

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  projectId?: string;
  feature: string;
  action: string;
  additional?: Record<string, any>;
}

export class ErrorTracker {
  private static initialized = false;

  public static init(): void {
    if (this.initialized) return;

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      integrations: [
        new BrowserTracing({
          // Trace user interactions and navigation
          routingInstrumentation: Sentry
            .reactRouterV6Instrumentation
            // Would need to import React Router history
            (),
        }),
        new Sentry.Replay({
          // Capture replays for critical errors
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],

      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      // Error filtering for Philippine context
      beforeSend(event) {
        // Don't send errors for demo/test accounts
        if (
          event.user?.email?.includes("demo@") ||
          event.user?.email?.includes("test@")
        ) {
          return null;
        }

        // Enrich with Philippine-specific context
        if (event.contexts) {
          event.contexts.locale = {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            currency: "PHP",
          };
        }

        return event;
      },

      // Session replay for critical issues
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,

      // Release tracking
      release: import.meta.env.VITE_APP_VERSION,

      // Custom tags for hospitality context
      initialScope: {
        tags: {
          component: "resort-management",
          region: "philippines",
        },
      },
    });

    this.initialized = true;
  }

  public static captureError(
    error: Error,
    context: ErrorContext,
    level: "error" | "warning" | "info" = "error"
  ): void {
    Sentry.withScope((scope) => {
      // Set user context
      if (context.userId || context.userEmail) {
        scope.setUser({
          id: context.userId,
          email: context.userEmail,
        });
      }

      // Set feature context
      scope.setTag("feature", context.feature);
      scope.setTag("action", context.action);

      if (context.projectId) {
        scope.setTag("projectId", context.projectId);
      }

      // Set additional context
      if (context.additional) {
        scope.setContext("additional", context.additional);
      }

      // Set level
      scope.setLevel(level);

      // Capture error
      Sentry.captureException(error);
    });
  }

  public static captureMessage(
    message: string,
    context: ErrorContext,
    level: "error" | "warning" | "info" = "info"
  ): void {
    Sentry.withScope((scope) => {
      scope.setUser({
        id: context.userId,
        email: context.userEmail,
      });

      scope.setTag("feature", context.feature);
      scope.setTag("action", context.action);

      if (context.additional) {
        scope.setContext("additional", context.additional);
      }

      scope.setLevel(level);

      Sentry.captureMessage(message);
    });
  }

  public static setUserContext(
    userId: string,
    email: string,
    projectId?: string
  ): void {
    Sentry.setUser({
      id: userId,
      email: email,
      projectId: projectId,
    });
  }

  public static addBreadcrumb(
    message: string,
    category: string,
    data?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      timestamp: Date.now() / 1000,
    });
  }
}
```

### Performance Monitoring Integration

```typescript
// src/lib/performance-analytics.ts
import { PerformanceMonitor } from "./performance-monitor";
import { ErrorTracker } from "./error-tracking";

interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  userId?: string;
  timestamp?: number;
}

export class PerformanceAnalytics {
  private static events: AnalyticsEvent[] = [];
  private static readonly MAX_EVENTS = 100;
  private static initialized = false;

  public static init(): void {
    if (this.initialized || typeof window === "undefined") return;

    // Initialize performance monitoring
    const perfMonitor = PerformanceMonitor.getInstance();

    // Track route changes
    this.trackRoutePerformance();

    // Track user interactions
    this.trackUserInteractions();

    // Track business-critical actions
    this.trackBusinessActions();

    // Send analytics periodically
    setInterval(() => this.flushEvents(), 30000); // Every 30 seconds

    // Send on page unload
    window.addEventListener("beforeunload", () => this.flushEvents());

    this.initialized = true;
  }

  private static trackRoutePerformance(): void {
    // Track route navigation performance
    let currentRoute = window.location.pathname;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "navigation") {
          const nav = entry as PerformanceNavigationTiming;

          this.track("route_performance", {
            route: currentRoute,
            loadTime: nav.loadEventEnd - nav.fetchStart,
            domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
            timeToInteractive: nav.domInteractive - nav.fetchStart,
            transferSize: nav.transferSize,
            connectionType:
              (navigator as any).connection?.effectiveType || "unknown",
          });
        }
      }
    });

    observer.observe({ type: "navigation", buffered: true });
  }

  private static trackUserInteractions(): void {
    // Track clicks on critical elements
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;

      // Track booking-related clicks
      if (target.closest('[data-testid*="booking"]')) {
        this.track("booking_interaction", {
          element: target.tagName.toLowerCase(),
          action: "click",
          feature: "booking_management",
        });
      }

      // Track navigation clicks
      if (target.closest("nav") || target.closest('[role="navigation"]')) {
        this.track("navigation_click", {
          element: target.textContent?.trim() || "unknown",
          href: target.closest("a")?.getAttribute("href"),
        });
      }
    });

    // Track form interactions
    document.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement;
      const formType = form.dataset.formType || "unknown";

      this.track("form_submission", {
        formType,
        fieldCount: form.querySelectorAll("input, select, textarea").length,
      });
    });
  }

  private static trackBusinessActions(): void {
    // Track booking creation
    window.addEventListener("booking-created", (event: any) => {
      this.track("booking_created", {
        bookingId: event.detail.id,
        checkInDate: event.detail.checkIn,
        checkOutDate: event.detail.checkOut,
        guestCount: event.detail.guestCount,
        totalAmount: event.detail.totalAmount,
        paymentMethod: event.detail.paymentMethod,
      });
    });

    // Track payment processing
    window.addEventListener("payment-processed", (event: any) => {
      this.track("payment_processed", {
        bookingId: event.detail.bookingId,
        amount: event.detail.amount,
        method: event.detail.method,
        success: event.detail.success,
        processingTime: event.detail.duration,
      });
    });

    // Track errors in business flows
    window.addEventListener("business-error", (event: any) => {
      ErrorTracker.captureError(
        new Error(event.detail.message),
        {
          feature: event.detail.feature,
          action: event.detail.action,
          additional: event.detail.context,
        },
        "error"
      );
    });
  }

  public static track(
    event: string,
    properties: Record<string, any>,
    userId?: string
  ): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        url: window.location.href,
        referrer: document.referrer,
        timestamp: Date.now(),
      },
      userId,
      timestamp: Date.now(),
    };

    this.events.push(analyticsEvent);

    // Prevent memory issues
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Log critical events immediately
    if (this.isCriticalEvent(event)) {
      this.sendEvent(analyticsEvent);
    }
  }

  private static isCriticalEvent(event: string): boolean {
    return [
      "booking_created",
      "payment_processed",
      "system_error",
      "security_incident",
    ].includes(event);
  }

  private static async flushEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      await fetch("/api/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: eventsToSend }),
      });
    } catch (error) {
      console.warn("Failed to send analytics events:", error);
      // Re-add events for retry
      this.events.unshift(...eventsToSend);
    }
  }

  private static async sendEvent(event: AnalyticsEvent): Promise<void> {
    try {
      await fetch("/api/analytics/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: [event] }),
      });
    } catch (error) {
      console.warn("Failed to send critical event:", error);
    }
  }
}
```

## 2. Infrastructure Monitoring

### Comprehensive Uptime Monitoring

```typescript
// api/monitoring/health.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { secureDb } from "../../src/lib/db/secure-connection";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

interface HealthCheck {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  details?: any;
  timestamp: number;
}

interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  uptime: number;
  version: string;
  region: string;
  timestamp: string;
}

export class HealthChecker {
  private static startTime = Date.now();

  public static async performHealthChecks(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];

    // Database health check
    checks.push(await this.checkDatabase());

    // Redis health check
    checks.push(await this.checkRedis());

    // External services health check
    checks.push(await this.checkExternalServices());

    // Memory and resource check
    checks.push(await this.checkSystemResources());

    // Determine overall health
    const overall = this.determineOverallHealth(checks);

    return {
      overall,
      checks,
      uptime: Date.now() - this.startTime,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "unknown",
      region: process.env.VERCEL_REGION || "unknown",
      timestamp: new Date().toISOString(),
    };
  }

  private static async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Simple query to check database connectivity
      await secureDb.execute("SELECT 1 as health_check");

      const responseTime = Date.now() - start;

      return {
        service: "database",
        status: responseTime < 1000 ? "healthy" : "degraded",
        responseTime,
        details: { query: "SELECT 1", latency: `${responseTime}ms` },
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        service: "database",
        status: "unhealthy",
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: Date.now(),
      };
    }
  }

  private static async checkRedis(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Test Redis connectivity
      const testKey = `health:${Date.now()}`;
      await redis.set(testKey, "ok", { ex: 10 });
      const result = await redis.get(testKey);
      await redis.del(testKey);

      const responseTime = Date.now() - start;

      return {
        service: "redis",
        status: result === "ok" ? "healthy" : "degraded",
        responseTime,
        details: { test: "set/get/del", result },
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        service: "redis",
        status: "unhealthy",
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: Date.now(),
      };
    }
  }

  private static async checkExternalServices(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      // Check Vercel Analytics endpoint
      const response = await fetch("https://api.vercel.com/health", {
        method: "GET",
        timeout: 5000,
      });

      const responseTime = Date.now() - start;

      return {
        service: "external_services",
        status: response.ok ? "healthy" : "degraded",
        responseTime,
        details: {
          vercel_status: response.status,
          latency: `${responseTime}ms`,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        service: "external_services",
        status: "unhealthy",
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: Date.now(),
      };
    }
  }

  private static async checkSystemResources(): Promise<HealthCheck> {
    const start = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Convert to MB
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

      // Determine health based on memory usage
      const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;
      let status: "healthy" | "degraded" | "unhealthy" = "healthy";

      if (memoryUsagePercent > 85) {
        status = "unhealthy";
      } else if (memoryUsagePercent > 70) {
        status = "degraded";
      }

      return {
        service: "system_resources",
        status,
        responseTime: Date.now() - start,
        details: {
          memory: {
            heapUsed: `${heapUsedMB}MB`,
            heapTotal: `${heapTotalMB}MB`,
            usagePercent: `${memoryUsagePercent.toFixed(1)}%`,
          },
          uptime: process.uptime(),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        service: "system_resources",
        status: "unhealthy",
        responseTime: Date.now() - start,
        details: { error: error.message },
        timestamp: Date.now(),
      };
    }
  }

  private static determineOverallHealth(
    checks: HealthCheck[]
  ): "healthy" | "degraded" | "unhealthy" {
    const unhealthyCount = checks.filter(
      (check) => check.status === "unhealthy"
    ).length;
    const degradedCount = checks.filter(
      (check) => check.status === "degraded"
    ).length;

    if (unhealthyCount > 0) {
      return "unhealthy";
    } else if (degradedCount > 0) {
      return "degraded";
    } else {
      return "healthy";
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const health = await HealthChecker.performHealthChecks();

    // Set appropriate HTTP status
    const status =
      health.overall === "healthy"
        ? 200
        : health.overall === "degraded"
          ? 200
          : 503;

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("X-Health-Check", "true");
    return res.status(status).json(health);
  } catch (error) {
    return res.status(503).json({
      overall: "unhealthy",
      error: "Health check failed",
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Advanced Monitoring Dashboard

```typescript
// api/monitoring/dashboard.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";
import { HealthChecker } from "./health";

const redis = Redis.fromEnv();

interface MonitoringMetrics {
  health: any;
  performance: {
    averageResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
    uptime: number;
  };
  business: {
    activeBookings: number;
    revenueToday: number;
    newRegistrations: number;
    systemUtilization: number;
  };
  infrastructure: {
    databaseConnections: number;
    cacheHitRate: number;
    memoryUsage: number;
    functionExecutions: number;
  };
  alerts: Array<{
    id: string;
    type: "error" | "warning" | "info";
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get("range") || "1h";

    // Get current health status
    const health = await HealthChecker.performHealthChecks();

    // Get performance metrics
    const performance = await getPerformanceMetrics(timeRange);

    // Get business metrics
    const business = await getBusinessMetrics(timeRange);

    // Get infrastructure metrics
    const infrastructure = await getInfrastructureMetrics(timeRange);

    // Get recent alerts
    const alerts = await getRecentAlerts();

    const metrics: MonitoringMetrics = {
      health,
      performance,
      business,
      infrastructure,
      alerts,
    };

    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Dashboard-Generated", new Date().toISOString());
    return res.status(200).json(metrics);
  } catch (error) {
    console.error("Dashboard metrics error:", error);
    return res.status(500).json({ error: "Failed to load dashboard metrics" });
  }
}

async function getPerformanceMetrics(timeRange: string) {
  const key = `metrics:performance:${timeRange}`;

  try {
    // Try to get cached metrics first
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached as string);
    }

    // Calculate metrics from stored data
    const now = Date.now();
    const timeWindow = getTimeWindowMs(timeRange);
    const startTime = now - timeWindow;

    // Get API response times
    const responseTimes = await redis.zrangebyscore(
      "metrics:response_times",
      startTime,
      now,
      { withScores: true }
    );

    // Calculate average response time
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, _, index) => {
            if (index % 2 === 1) {
              // Scores are at odd indices
              return sum + parseFloat(responseTimes[index] as string);
            }
            return sum;
          }, 0) /
          (responseTimes.length / 2)
        : 0;

    // Get request count
    const requestCount =
      (await redis.get(`metrics:requests:${Math.floor(now / 60000)}`)) || "0";

    // Get error count
    const errorCount =
      (await redis.get(`metrics:errors:${Math.floor(now / 60000)}`)) || "0";

    const errorRate =
      parseInt(requestCount as string) > 0
        ? (parseInt(errorCount as string) / parseInt(requestCount as string)) *
          100
        : 0;

    const metrics = {
      averageResponseTime: Math.round(avgResponseTime),
      requestsPerMinute: parseInt(requestCount as string),
      errorRate: Math.round(errorRate * 100) / 100,
      uptime: 99.9, // Would calculate from actual uptime data
    };

    // Cache for 1 minute
    await redis.setex(key, 60, JSON.stringify(metrics));

    return metrics;
  } catch (error) {
    console.error("Performance metrics error:", error);
    return {
      averageResponseTime: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      uptime: 0,
    };
  }
}

async function getBusinessMetrics(timeRange: string) {
  // These would integrate with your actual business data
  return {
    activeBookings: 42,
    revenueToday: 15750.0,
    newRegistrations: 8,
    systemUtilization: 73.5,
  };
}

async function getInfrastructureMetrics(timeRange: string) {
  try {
    const cacheStats = await redis.info("stats");
    const hitRate = cacheStats
      ? parseFloat(
          cacheStats.split("keyspace_hits:")[1]?.split("\r\n")[0] || "0"
        )
      : 0;

    return {
      databaseConnections: 3, // Would get from database pool
      cacheHitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      functionExecutions: 1250, // Would get from Vercel analytics
    };
  } catch (error) {
    return {
      databaseConnections: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      functionExecutions: 0,
    };
  }
}

async function getRecentAlerts() {
  try {
    const alertKeys = await redis.keys("alert:*");
    const alerts = await Promise.all(
      alertKeys.slice(0, 10).map(async (key) => {
        const alert = await redis.get(key);
        return alert ? JSON.parse(alert as string) : null;
      })
    );

    return alerts
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  } catch (error) {
    return [];
  }
}

function getTimeWindowMs(timeRange: string): number {
  switch (timeRange) {
    case "5m":
      return 5 * 60 * 1000;
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}
```

## 3. Intelligent Alerting System

### Multi-Channel Alert Manager

```typescript
// src/lib/alert-manager.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export interface Alert {
  id: string;
  type: "error" | "warning" | "info" | "critical";
  title: string;
  message: string;
  source: string;
  severity: 1 | 2 | 3 | 4 | 5; // 1 = info, 5 = critical
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  timeWindow: number; // in seconds
  severity: Alert["severity"];
  enabled: boolean;
  channels: ("email" | "sms" | "slack" | "webhook")[];
  recipients: string[];
  cooldownPeriod: number; // seconds between alerts
}

export class AlertManager {
  private static instance: AlertManager;
  private rules: Map<string, AlertRule> = new Map();

  private constructor() {
    this.loadAlertRules();
  }

  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  private loadAlertRules(): void {
    // Load alert rules configuration
    const defaultRules: AlertRule[] = [
      {
        id: "high_error_rate",
        name: "High Error Rate",
        condition: "error_rate > threshold",
        threshold: 5.0, // 5% error rate
        timeWindow: 300, // 5 minutes
        severity: 4,
        enabled: true,
        channels: ["email", "slack"],
        recipients: ["admin@okaeri-resort.com"],
        cooldownPeriod: 600, // 10 minutes
      },
      {
        id: "response_time_degradation",
        name: "Response Time Degradation",
        condition: "avg_response_time > threshold",
        threshold: 2000, // 2 seconds
        timeWindow: 600, // 10 minutes
        severity: 3,
        enabled: true,
        channels: ["slack"],
        recipients: ["dev-team"],
        cooldownPeriod: 300, // 5 minutes
      },
      {
        id: "database_connection_failure",
        name: "Database Connection Failure",
        condition: "database_health == unhealthy",
        threshold: 1,
        timeWindow: 60, // 1 minute
        severity: 5,
        enabled: true,
        channels: ["email", "sms", "slack"],
        recipients: ["admin@okaeri-resort.com", "+639123456789"],
        cooldownPeriod: 120, // 2 minutes
      },
      {
        id: "booking_system_failure",
        name: "Booking System Failure",
        condition: "booking_errors > threshold",
        threshold: 3,
        timeWindow: 300, // 5 minutes
        severity: 5,
        enabled: true,
        channels: ["email", "sms"],
        recipients: ["operations@okaeri-resort.com"],
        cooldownPeriod: 180, // 3 minutes
      },
      {
        id: "memory_usage_high",
        name: "High Memory Usage",
        condition: "memory_usage_percent > threshold",
        threshold: 85,
        timeWindow: 300, // 5 minutes
        severity: 3,
        enabled: true,
        channels: ["slack"],
        recipients: ["dev-team"],
        cooldownPeriod: 600, // 10 minutes
      },
      {
        id: "payment_processing_errors",
        name: "Payment Processing Errors",
        condition: "payment_errors > threshold",
        threshold: 1,
        timeWindow: 60, // 1 minute
        severity: 5,
        enabled: true,
        channels: ["email", "sms"],
        recipients: ["finance@okaeri-resort.com"],
        cooldownPeriod: 60, // 1 minute
      },
    ];

    defaultRules.forEach((rule) => {
      this.rules.set(rule.id, rule);
    });
  }

  public async checkAlertConditions(metrics: any): Promise<void> {
    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      const shouldAlert = await this.evaluateRule(rule, metrics);

      if (shouldAlert) {
        const alert = await this.createAlert(rule, metrics);
        await this.sendAlert(alert, rule);
      }
    }
  }

  private async evaluateRule(rule: AlertRule, metrics: any): Promise<boolean> {
    // Check if we're in cooldown period
    const cooldownKey = `alert_cooldown:${rule.id}`;
    const lastAlert = await redis.get(cooldownKey);
    if (lastAlert) {
      return false; // Still in cooldown
    }

    // Evaluate condition based on rule type
    switch (rule.id) {
      case "high_error_rate":
        return metrics.performance?.errorRate > rule.threshold;

      case "response_time_degradation":
        return metrics.performance?.averageResponseTime > rule.threshold;

      case "database_connection_failure":
        return (
          metrics.health?.checks?.find((c) => c.service === "database")
            ?.status === "unhealthy"
        );

      case "booking_system_failure":
        // Would check booking-specific error metrics
        return false; // Placeholder

      case "memory_usage_high":
        return metrics.infrastructure?.memoryUsage > rule.threshold;

      case "payment_processing_errors":
        // Would check payment-specific error metrics
        return false; // Placeholder

      default:
        return false;
    }
  }

  private async createAlert(rule: AlertRule, metrics: any): Promise<Alert> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type:
        rule.severity >= 4
          ? "critical"
          : rule.severity >= 3
            ? "error"
            : "warning",
      title: rule.name,
      message: this.generateAlertMessage(rule, metrics),
      source: "monitoring_system",
      severity: rule.severity,
      timestamp: Date.now(),
      resolved: false,
      tags: ["automated", "monitoring"],
      metadata: {
        ruleId: rule.id,
        metrics: metrics,
        threshold: rule.threshold,
      },
    };

    // Store alert in Redis
    await redis.setex(`alert:${alert.id}`, 86400, JSON.stringify(alert)); // Keep for 24 hours

    return alert;
  }

  private generateAlertMessage(rule: AlertRule, metrics: any): string {
    switch (rule.id) {
      case "high_error_rate":
        return `Error rate has exceeded ${rule.threshold}%. Current rate: ${metrics.performance?.errorRate}%`;

      case "response_time_degradation":
        return `Average response time has increased to ${metrics.performance?.averageResponseTime}ms (threshold: ${rule.threshold}ms)`;

      case "database_connection_failure":
        return "Database connection health check failed. Immediate attention required.";

      case "memory_usage_high":
        return `Memory usage is at ${metrics.infrastructure?.memoryUsage}MB (${rule.threshold}% threshold exceeded)`;

      default:
        return `Alert condition met for rule: ${rule.name}`;
    }
  }

  private async sendAlert(alert: Alert, rule: AlertRule): Promise<void> {
    // Set cooldown period
    await redis.setex(`alert_cooldown:${rule.id}`, rule.cooldownPeriod, "1");

    for (const channel of rule.channels) {
      try {
        switch (channel) {
          case "email":
            await this.sendEmailAlert(alert, rule.recipients);
            break;

          case "sms":
            await this.sendSMSAlert(alert, rule.recipients);
            break;

          case "slack":
            await this.sendSlackAlert(alert, rule.recipients);
            break;

          case "webhook":
            await this.sendWebhookAlert(alert, rule.recipients);
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${channel} alert:`, error);
      }
    }

    // Log alert sending
    console.error("🚨 Alert sent:", {
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      channels: rule.channels,
    });
  }

  private async sendEmailAlert(
    alert: Alert,
    recipients: string[]
  ): Promise<void> {
    // Implement email sending logic
    // This would integrate with your email service (SendGrid, SES, etc.)
    console.log("📧 Email alert sent to:", recipients);
  }

  private async sendSMSAlert(
    alert: Alert,
    recipients: string[]
  ): Promise<void> {
    // Implement SMS sending logic
    // This would integrate with SMS service (Twilio, etc.)
    console.log("📱 SMS alert sent to:", recipients);
  }

  private async sendSlackAlert(
    alert: Alert,
    recipients: string[]
  ): Promise<void> {
    // Implement Slack webhook logic
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) return;

    const payload = {
      text: `🚨 ${alert.title}`,
      attachments: [
        {
          color: this.getSlackColor(alert.severity),
          fields: [
            {
              title: "Message",
              value: alert.message,
              short: false,
            },
            {
              title: "Severity",
              value: this.getSeverityText(alert.severity),
              short: true,
            },
            {
              title: "Time",
              value: new Date(alert.timestamp).toISOString(),
              short: true,
            },
          ],
        },
      ],
    };

    await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("💬 Slack alert sent");
  }

  private async sendWebhookAlert(
    alert: Alert,
    webhookUrls: string[]
  ): Promise<void> {
    // Implement generic webhook logic
    for (const url of webhookUrls) {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert),
      });
    }

    console.log("🔗 Webhook alerts sent");
  }

  private getSlackColor(severity: number): string {
    switch (severity) {
      case 5:
        return "danger"; // Critical
      case 4:
        return "warning"; // Error
      case 3:
        return "warning"; // Warning
      default:
        return "good"; // Info
    }
  }

  private getSeverityText(severity: number): string {
    switch (severity) {
      case 5:
        return "🔴 Critical";
      case 4:
        return "🟠 Error";
      case 3:
        return "🟡 Warning";
      case 2:
        return "🔵 Info";
      default:
        return "⚪ Low";
    }
  }

  public async resolveAlert(alertId: string): Promise<void> {
    const alertKey = `alert:${alertId}`;
    const alertData = await redis.get(alertKey);

    if (alertData) {
      const alert: Alert = JSON.parse(alertData as string);
      alert.resolved = true;
      alert.resolvedAt = Date.now();

      await redis.setex(alertKey, 86400, JSON.stringify(alert));
    }
  }
}
```

## 4. Business Intelligence and KPI Tracking

### Hospitality-Specific Analytics

```typescript
// api/analytics/hospitality-metrics.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { secureDb } from "../../src/lib/db/secure-connection";
import { bookings, guests, expenses } from "../../src/lib/db/schema";
import { sql } from "drizzle-orm";

interface HospitalityMetrics {
  occupancy: {
    current: number;
    forecast: number[];
    seasonal: Array<{ month: string; rate: number }>;
  };
  revenue: {
    today: number;
    thisMonth: number;
    growth: number;
    avgDailyRate: number;
    revPAR: number; // Revenue Per Available Room
  };
  guest: {
    satisfaction: number;
    repeatGuests: number;
    avgLengthOfStay: number;
    nationality: Array<{ country: string; percentage: number }>;
  };
  operations: {
    checkInEfficiency: number;
    housekeepingTurnaround: number;
    maintenanceRequests: number;
    staffUtilization: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "30d";
    const projectId = url.searchParams.get("projectId") || "default";

    // Calculate metrics
    const occupancyMetrics = await calculateOccupancyMetrics(projectId, period);
    const revenueMetrics = await calculateRevenueMetrics(projectId, period);
    const guestMetrics = await calculateGuestMetrics(projectId, period);
    const operationsMetrics = await calculateOperationsMetrics(
      projectId,
      period
    );

    const metrics: HospitalityMetrics = {
      occupancy: occupancyMetrics,
      revenue: revenueMetrics,
      guest: guestMetrics,
      operations: operationsMetrics,
    };

    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
        "X-Analytics-Generated": new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Hospitality metrics error:", error);
    return NextResponse.json(
      { error: "Failed to load hospitality metrics" },
      { status: 500 }
    );
  }
}

async function calculateOccupancyMetrics(projectId: string, period: string) {
  // Get total available rooms (would come from property configuration)
  const totalRooms = 24; // Example: 24 rooms

  // Current occupancy
  const currentOccupied = await secureDb
    .select({ count: sql<number>`count(*)` })
    .from(bookings)
    .where(
      sql`status = 'confirmed' AND check_in_date <= NOW() AND check_out_date > NOW()`
    );

  const currentOccupancy =
    ((currentOccupied[0]?.count || 0) / totalRooms) * 100;

  // 7-day forecast (simplified)
  const forecast = [78, 82, 65, 70, 85, 90, 75]; // Would calculate from actual data

  // Seasonal patterns (monthly averages)
  const seasonal = [
    { month: "Jan", rate: 85 },
    { month: "Feb", rate: 88 },
    { month: "Mar", rate: 75 },
    { month: "Apr", rate: 70 },
    { month: "May", rate: 65 },
    { month: "Jun", rate: 60 },
    { month: "Jul", rate: 68 },
    { month: "Aug", rate: 72 },
    { month: "Sep", rate: 70 },
    { month: "Oct", rate: 75 },
    { month: "Nov", rate: 82 },
    { month: "Dec", rate: 90 },
  ];

  return {
    current: Math.round(currentOccupancy * 10) / 10,
    forecast,
    seasonal,
  };
}

async function calculateRevenueMetrics(projectId: string, period: string) {
  // Today's revenue
  const todayRevenue = await secureDb
    .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
    .from(bookings)
    .where(sql`DATE(created_at) = CURRENT_DATE AND status != 'cancelled'`);

  // This month's revenue
  const monthRevenue = await secureDb
    .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
    .from(bookings)
    .where(
      sql`EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND status != 'cancelled'`
    );

  // Previous month for growth calculation
  const prevMonthRevenue = await secureDb
    .select({ total: sql<number>`COALESCE(SUM(total_amount), 0)` })
    .from(bookings)
    .where(
      sql`EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND status != 'cancelled'`
    );

  const growth =
    prevMonthRevenue[0]?.total > 0
      ? ((monthRevenue[0]?.total - prevMonthRevenue[0]?.total) /
          prevMonthRevenue[0]?.total) *
        100
      : 0;

  // Average Daily Rate
  const avgBookingValue = await secureDb
    .select({ avg: sql<number>`COALESCE(AVG(total_amount), 0)` })
    .from(bookings)
    .where(
      sql`status != 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '30 days'`
    );

  return {
    today: todayRevenue[0]?.total || 0,
    thisMonth: monthRevenue[0]?.total || 0,
    growth: Math.round(growth * 10) / 10,
    avgDailyRate: Math.round((avgBookingValue[0]?.avg || 0) * 10) / 10,
    revPAR: Math.round(((monthRevenue[0]?.total || 0) / 30 / 24) * 10) / 10, // Simplified RevPAR
  };
}

async function calculateGuestMetrics(projectId: string, period: string) {
  // Guest satisfaction (would come from survey data)
  const satisfaction = 4.2; // Example rating out of 5

  // Repeat guests
  const repeatGuests = await secureDb
    .select({
      total: sql<number>`count(*)`,
      repeat: sql<number>`count(*) FILTER (WHERE guest_previous_stays > 0)`,
    })
    .from(bookings)
    .where(
      sql`created_at >= CURRENT_DATE - INTERVAL '30 days' AND status != 'cancelled'`
    );

  const repeatPercentage =
    repeatGuests[0]?.total > 0
      ? ((repeatGuests[0]?.repeat || 0) / repeatGuests[0]?.total) * 100
      : 0;

  // Average length of stay
  const avgStay = await secureDb
    .select({
      avg: sql<number>`COALESCE(AVG(check_out_date - check_in_date), 0)`,
    })
    .from(bookings)
    .where(
      sql`status != 'cancelled' AND created_at >= CURRENT_DATE - INTERVAL '30 days'`
    );

  // Guest nationality distribution (example data)
  const nationality = [
    { country: "Philippines", percentage: 65 },
    { country: "United States", percentage: 15 },
    { country: "Australia", percentage: 8 },
    { country: "Japan", percentage: 5 },
    { country: "Others", percentage: 7 },
  ];

  return {
    satisfaction: Math.round(satisfaction * 10) / 10,
    repeatGuests: Math.round(repeatPercentage * 10) / 10,
    avgLengthOfStay: Math.round((avgStay[0]?.avg || 0) * 10) / 10,
    nationality,
  };
}

async function calculateOperationsMetrics(projectId: string, period: string) {
  // These would come from operational tracking systems
  return {
    checkInEfficiency: 3.2, // minutes average check-in time
    housekeepingTurnaround: 28, // minutes average room cleaning
    maintenanceRequests: 5, // open requests
    staffUtilization: 78.5, // percentage
  };
}
```

## 5. Monitoring Implementation

### Monitoring Initialization

```typescript
// src/main.tsx - Add monitoring initialization
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorTracker } from './lib/error-tracking'
import { PerformanceAnalytics } from './lib/performance-analytics'

// Initialize monitoring
ErrorTracker.init()
PerformanceAnalytics.init()

// Set up global error handler
window.addEventListener('error', (event) => {
  ErrorTracker.captureError(event.error, {
    feature: 'global',
    action: 'unhandled_error',
    additional: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    }
  })
})

// Set up unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  ErrorTracker.captureError(new Error(event.reason), {
    feature: 'global',
    action: 'unhandled_promise_rejection'
  })
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### Monitoring Middleware for API Routes

```typescript
// api/_lib/middleware/monitoring.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AlertManager } from "../../../src/lib/alert-manager";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const alertManager = AlertManager.getInstance();

export function withMonitoring(handler: Function) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const startTime = Date.now();
    const path = req.url || "/";

    try {
      // Track request
      const minuteKey = `metrics:requests:${Math.floor(Date.now() / 60000)}`;
      await redis.incr(minuteKey);
      await redis.expire(minuteKey, 3600); // Keep for 1 hour

      // Execute handler
      const response = await handler(req, res);

      // Track response time
      const duration = Date.now() - startTime;
      await redis.zadd("metrics:response_times", Date.now(), duration);

      // Clean old response times (keep last 1 hour)
      const oneHourAgo = Date.now() - 3600000;
      await redis.zremrangebyscore("metrics:response_times", 0, oneHourAgo);

      // Log slow requests
      if (duration > 2000) {
        console.warn(`🐌 Slow request: ${path} took ${duration}ms`);
      }

      return response;
    } catch (error) {
      // Track error
      const errorKey = `metrics:errors:${Math.floor(Date.now() / 60000)}`;
      await redis.incr(errorKey);
      await redis.expire(errorKey, 3600);

      // Log error with context
      console.error("API Error:", {
        path,
        duration: Date.now() - startTime,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  };
}
```

## Implementation Timeline

### Day 1: Error Tracking and Performance Monitoring

- [ ] Set up Sentry integration for error tracking
- [ ] Implement performance analytics collection
- [ ] Deploy monitoring middleware to API routes
- [ ] Test error reporting and performance metrics

### Day 2: Infrastructure and Health Monitoring

- [ ] Deploy comprehensive health check endpoints
- [ ] Set up uptime monitoring dashboard
- [ ] Configure infrastructure metrics collection
- [ ] Test health check reliability

### Day 3: Alerting System

- [ ] Implement intelligent alerting with multiple channels
- [ ] Configure alert rules and thresholds
- [ ] Set up notification integrations (Slack, email, SMS)
- [ ] Test alert escalation procedures

### Day 4: Business Intelligence

- [ ] Deploy hospitality-specific analytics
- [ ] Create KPI tracking dashboard
- [ ] Set up revenue and occupancy monitoring
- [ ] Validate business metrics accuracy

## Success Metrics

### Monitoring Coverage

- ✅ 100% API endpoint monitoring
- ✅ Real-time error tracking and alerting
- ✅ Core Web Vitals monitoring
- ✅ Business KPI tracking

### Response Times

- ✅ Alert detection: < 30 seconds
- ✅ Notification delivery: < 60 seconds
- ✅ Incident acknowledgment: < 5 minutes
- ✅ Issue resolution: < 30 minutes

### Reliability Targets

- ✅ 99.9% uptime monitoring accuracy
- ✅ < 0.1% false positive alert rate
- ✅ 100% critical alert delivery
- ✅ Mean Time To Detection (MTTD): < 2 minutes

This comprehensive monitoring setup ensures the Okaeri Resort Management System
operates with maximum reliability and provides actionable insights for both
technical operations and business performance in the Philippine hospitality
market.
