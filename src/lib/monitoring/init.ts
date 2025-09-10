/**
 * Monitoring System Initialization
 * Phase 5.4: Monitoring Setup - Initialize all monitoring services
 */

import { ResortErrorTracker } from "./error-tracker";
import { initPerformanceMonitoring } from "../performance/core-web-vitals";

export interface MonitoringConfig {
  sentry?: {
    dsn: string;
    environment?: string;
    sampleRate?: number;
    replaySampleRate?: number;
  };
  performance?: {
    enableConsoleLog?: boolean;
    enableAnalytics?: boolean;
    samplingRate?: number;
    endpoint?: string;
  };
}

class ResortMonitoringSystem {
  private static initialized = false;

  /**
   * Initialize all monitoring systems for the resort management application
   */
  public static init(config: MonitoringConfig): void {
    if (this.initialized || typeof window === "undefined") {
      console.warn("Monitoring system already initialized or running on server");
      return;
    }

    console.log("🚀 Initializing Resort Monitoring System...");

    try {
      // Initialize Sentry error tracking
      if (config.sentry?.dsn) {
        ResortErrorTracker.init({
          dsn: config.sentry.dsn,
          environment: config.sentry.environment || process.env.NODE_ENV,
          sampleRate: config.sentry.sampleRate || 0.1,
          replaySampleRate: config.sentry.replaySampleRate || 1.0,
        });
        console.log("✅ Error tracking initialized");
      } else {
        console.warn("⚠️ Sentry DSN not provided, error tracking disabled");
      }

      // Initialize performance monitoring (extends existing Core Web Vitals)
      initPerformanceMonitoring({
        enableConsoleLog:
          config.performance?.enableConsoleLog ?? process.env.NODE_ENV === "development",
        enableAnalytics:
          config.performance?.enableAnalytics ?? process.env.NODE_ENV === "production",
        samplingRate: config.performance?.samplingRate ?? 1.0,
        endpoint: config.performance?.endpoint ?? "/api/monitoring/performance",
      });
      console.log("✅ Performance monitoring initialized");

      // Set up global error handlers
      this.setupGlobalErrorHandlers();
      console.log("✅ Global error handlers configured");

      // Set up unload tracking
      this.setupUnloadTracking();
      console.log("✅ Session tracking configured");

      this.initialized = true;
      console.log("🎯 Resort Monitoring System fully initialized");

      // Track initialization success
      ResortErrorTracker.addBreadcrumb("Monitoring system initialized", "system", {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: process.env.VITE_APP_VERSION,
      });
    } catch (error) {
      console.error("❌ Failed to initialize monitoring system:", error);

      // Fallback: at least set up basic console error tracking
      this.setupBasicErrorTracking();
    }
  }

  /**
   * Set up global error handlers for uncaught errors and unhandled promises
   */
  private static setupGlobalErrorHandlers(): void {
    // Catch uncaught JavaScript errors
    window.addEventListener("error", (event) => {
      ResortErrorTracker.captureError(
        event.error || new Error(event.message),
        {
          feature: "global",
          action: "uncaught_error",
          additional: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            type: "javascript_error",
          },
        },
        "error"
      );
    });

    // Catch unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

      ResortErrorTracker.captureError(
        error,
        {
          feature: "global",
          action: "unhandled_promise_rejection",
          additional: {
            type: "promise_rejection",
            reason: event.reason,
          },
        },
        "error"
      );
    });

    // Catch resource loading errors
    window.addEventListener(
      "error",
      (event) => {
        if (event.target !== window) {
          const target = event.target as HTMLElement;
          ResortErrorTracker.captureMessage(
            `Resource loading failed: ${target.tagName}`,
            {
              feature: "global",
              action: "resource_error",
              additional: {
                tagName: target.tagName,
                src: (target as any).src || (target as any).href,
                type: "resource_error",
              },
            },
            "warning"
          );
        }
      },
      true
    );
  }

  /**
   * Set up session and page unload tracking
   */
  private static setupUnloadTracking(): void {
    let sessionStartTime = Date.now();

    // Track page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        const sessionDuration = Date.now() - sessionStartTime;

        ResortErrorTracker.addBreadcrumb("Page hidden", "navigation", {
          sessionDuration_ms: sessionDuration,
          url: window.location.href,
        });
      } else if (document.visibilityState === "visible") {
        sessionStartTime = Date.now();

        ResortErrorTracker.addBreadcrumb("Page visible", "navigation", {
          url: window.location.href,
        });
      }
    });

    // Track page unload
    window.addEventListener("beforeunload", () => {
      const sessionDuration = Date.now() - sessionStartTime;

      ResortErrorTracker.addBreadcrumb("Page unload", "navigation", {
        sessionDuration_ms: sessionDuration,
        url: window.location.href,
      });
    });
  }

  /**
   * Fallback error tracking for when Sentry fails to initialize
   */
  private static setupBasicErrorTracking(): void {
    window.addEventListener("error", (event) => {
      console.error("🚨 Uncaught Error:", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: new Date().toISOString(),
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("🚨 Unhandled Promise Rejection:", {
        reason: event.reason,
        promise: event.promise,
        timestamp: new Date().toISOString(),
      });
    });

    console.log("⚠️ Basic error tracking enabled (Sentry unavailable)");
  }

  /**
   * Get monitoring system status
   */
  public static getStatus() {
    return {
      initialized: this.initialized,
      errorTracker: ResortErrorTracker.isInitialized(),
      config: ResortErrorTracker.getConfig(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manually track a business operation
   */
  public static trackOperation(
    operationName: string,
    startTime: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    const duration = Date.now() - startTime;

    ResortErrorTracker.trackOperation(operationName, duration, success, metadata);
  }
}

export { ResortMonitoringSystem };

// Auto-initialize if environment variables are available
if (typeof window !== "undefined") {
  // Initialize after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
      if (sentryDsn) {
        ResortMonitoringSystem.init({
          sentry: {
            dsn: sentryDsn,
            environment: import.meta.env.MODE,
          },
        });
      } else {
        console.log("ℹ️ Sentry DSN not configured, monitoring disabled");
      }
    });
  } else {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
    if (sentryDsn) {
      ResortMonitoringSystem.init({
        sentry: {
          dsn: sentryDsn,
          environment: import.meta.env.MODE,
        },
      });
    }
  }
}
