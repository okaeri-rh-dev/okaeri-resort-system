/**
 * Error Tracking with Sentry Integration
 * Phase 5.4: Monitoring Setup - Comprehensive error tracking for internal resort operations
 */

import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  projectId?: string;
  feature: string;
  action: string;
  additional?: Record<string, any>;
}

export interface ResortErrorConfig {
  dsn: string;
  environment?: string;
  sampleRate?: number;
  replaySampleRate?: number;
  enableConsoleIntegration?: boolean;
}

export class ResortErrorTracker {
  private static initialized = false;
  private static config: ResortErrorConfig;

  /**
   * Initialize Sentry error tracking for resort management system
   */
  public static init(config: ResortErrorConfig): void {
    if (this.initialized || typeof window === "undefined") return;

    this.config = config;

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment || process.env.NODE_ENV || "development",

      integrations: [
        new BrowserTracing({
          // Track user interactions and navigation
          tracingOrigins: ["localhost", /^\//],
        }),
        new Sentry.Replay({
          // Session replay for critical errors only
          maskAllText: true,
          blockAllMedia: true,
          maskAllInputs: true,
        }),
      ],

      // Performance monitoring sample rate
      tracesSampleRate: config.sampleRate || (process.env.NODE_ENV === "production" ? 0.1 : 1.0),

      // Session replay sample rates
      replaysSessionSampleRate: 0.0, // No regular session recording to save quota
      replaysOnErrorSampleRate: config.replaySampleRate || 1.0, // Record on errors only

      // Error filtering for internal operations
      beforeSend(event, hint) {
        // Don't send errors for demo/test accounts
        if (
          event.user?.email?.includes("demo@") ||
          event.user?.email?.includes("test@") ||
          event.user?.email?.includes("staging@")
        ) {
          return null;
        }

        // Filter out development noise
        if (config.environment === "development") {
          // Skip HMR and development-only errors
          if (hint.originalException?.message?.includes("[HMR]")) return null;
          if (hint.originalException?.message?.includes("ResizeObserver")) return null;
        }

        // Enrich with Philippine resort context
        if (event.contexts) {
          event.contexts.resort = {
            timezone: "Asia/Manila",
            currency: "PHP",
            locale: "en-PH",
            system: "internal-operations",
          };
        }

        // Add performance context
        if (typeof window !== "undefined") {
          const connection = (navigator as any).connection;
          if (connection) {
            event.contexts = {
              ...event.contexts,
              network: {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
              },
            };
          }
        }

        return event;
      },

      // Release tracking
      release: process.env.VITE_APP_VERSION || "1.0.0",

      // Initial scope tags
      initialScope: {
        tags: {
          component: "resort-management",
          region: "philippines",
          deployment: "internal-only",
        },
      },
    });

    this.initialized = true;
    console.log("🔍 Resort error tracking initialized");
  }

  /**
   * Capture an error with resort-specific context
   */
  public static captureError(
    error: Error,
    context: ErrorContext,
    level: "error" | "warning" | "info" = "error"
  ): void {
    if (!this.initialized) {
      console.warn("Error tracker not initialized, logging to console:", error);
      return;
    }

    Sentry.withScope((scope) => {
      // Set user context
      if (context.userId || context.userEmail) {
        scope.setUser({
          id: context.userId,
          email: context.userEmail,
        });
      }

      // Set feature and action tags
      scope.setTag("feature", context.feature);
      scope.setTag("action", context.action);
      scope.setTag("internal_operation", true);

      if (context.projectId) {
        scope.setTag("projectId", context.projectId);
      }

      // Set additional context
      if (context.additional) {
        scope.setContext("operation_details", context.additional);
      }

      // Set severity level
      scope.setLevel(level);

      // Capture the error
      Sentry.captureException(error);
    });
  }

  /**
   * Capture a message with context
   */
  public static captureMessage(
    message: string,
    context: ErrorContext,
    level: "error" | "warning" | "info" = "info"
  ): void {
    if (!this.initialized) {
      console.log(`[${level.toUpperCase()}]`, message, context);
      return;
    }

    Sentry.withScope((scope) => {
      scope.setUser({
        id: context.userId,
        email: context.userEmail,
      });

      scope.setTag("feature", context.feature);
      scope.setTag("action", context.action);
      scope.setTag("internal_operation", true);

      if (context.projectId) {
        scope.setTag("projectId", context.projectId);
      }

      if (context.additional) {
        scope.setContext("operation_details", context.additional);
      }

      scope.setLevel(level);

      Sentry.captureMessage(message);
    });
  }

  /**
   * Set user context for current session
   */
  public static setUserContext(userId: string, email: string, projectId?: string): void {
    if (!this.initialized) return;

    Sentry.setUser({
      id: userId,
      email: email,
      projectId: projectId,
    });

    // Add breadcrumb for login
    this.addBreadcrumb("User authenticated", "auth", {
      userId,
      email,
      projectId,
    });
  }

  /**
   * Clear user context (logout)
   */
  public static clearUserContext(): void {
    if (!this.initialized) return;

    Sentry.setUser(null);
    this.addBreadcrumb("User logged out", "auth");
  }

  /**
   * Add breadcrumb for tracking user journey
   */
  public static addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    if (!this.initialized) return;

    Sentry.addBreadcrumb({
      message,
      category,
      data,
      timestamp: Date.now() / 1000,
      level: "info",
    });
  }

  /**
   * Track business operation performance
   */
  public static trackOperation(
    operationName: string,
    duration: number,
    success: boolean,
    context?: Record<string, any>
  ): void {
    if (!this.initialized) return;

    this.addBreadcrumb(`Operation: ${operationName}`, "operation", {
      duration_ms: Math.round(duration),
      success,
      ...context,
    });

    // Log slow operations as warnings
    if (duration > 5000) {
      this.captureMessage(
        `Slow operation detected: ${operationName}`,
        {
          feature: "performance",
          action: "slow_operation",
          additional: {
            operation: operationName,
            duration_ms: Math.round(duration),
            ...context,
          },
        },
        "warning"
      );
    }
  }

  /**
   * Create error boundary component for React
   */
  public static createErrorBoundary() {
    return Sentry.withErrorBoundary;
  }

  /**
   * Get current configuration
   */
  public static getConfig(): ResortErrorConfig | null {
    return this.config || null;
  }

  /**
   * Check if error tracker is initialized
   */
  public static isInitialized(): boolean {
    return this.initialized;
  }
}

// Export pre-configured contexts for common resort operations
export const ResortErrorContexts = {
  BOOKING: {
    feature: "booking_management",
    action: "booking_operation",
  },
  EXPENSE: {
    feature: "expense_tracking",
    action: "expense_operation",
  },
  AUTH: {
    feature: "authentication",
    action: "auth_operation",
  },
  DASHBOARD: {
    feature: "dashboard",
    action: "dashboard_operation",
  },
  MONITORING: {
    feature: "monitoring",
    action: "monitoring_operation",
  },
} as const;
