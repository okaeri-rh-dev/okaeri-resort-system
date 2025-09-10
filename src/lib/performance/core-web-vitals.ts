/**
 * Core Web Vitals Performance Monitoring
 * Phase 2.4: Performance Optimization - Resort PWA monitoring
 *
 * @description Monitors Core Web Vitals metrics for resort management system
 * with special considerations for mobile devices and intermittent connectivity
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

interface PerformanceMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  timestamp: number;
  url: string;
  userAgent: string;
  connection?: string;
}

interface ResortPerformanceConfig {
  enableConsoleLog?: boolean;
  enableAnalytics?: boolean;
  samplingRate?: number;
  endpoint?: string;
}

class ResortPerformanceMonitor {
  private config: ResortPerformanceConfig;
  private metrics: PerformanceMetric[] = [];

  constructor(config: ResortPerformanceConfig = {}) {
    this.config = {
      enableConsoleLog: process.env.NODE_ENV === "development",
      enableAnalytics: process.env.NODE_ENV === "production",
      samplingRate: 1.0,
      ...config,
    };
  }

  /**
   * Initialize Core Web Vitals monitoring
   * Optimized for resort management system usage patterns
   */
  public init(): void {
    if (typeof window === "undefined") return;

    // Sample rate check for production
    if (Math.random() > this.config.samplingRate) return;

    // Largest Contentful Paint - Critical for dashboard load
    onLCP(this.handleMetric.bind(this));

    // Interaction to Next Paint (INP) - Replaced FID in v5, measures responsiveness
    onINP(this.handleMetric.bind(this));

    // Cumulative Layout Shift - Critical for form interactions
    onCLS(this.handleMetric.bind(this));

    // First Contentful Paint - Important for perceived performance
    onFCP(this.handleMetric.bind(this));

    // Time to First Byte - Network performance indicator
    onTTFB(this.handleMetric.bind(this));

    // Custom metrics for resort system
    this.initCustomMetrics();
  }

  private handleMetric(metric: any): void {
    const performanceMetric: PerformanceMetric = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: this.getConnectionInfo(),
    };

    this.metrics.push(performanceMetric);

    if (this.config.enableConsoleLog) {
      this.logMetric(performanceMetric);
    }

    if (this.config.enableAnalytics) {
      this.sendAnalytics(performanceMetric);
    }
  }

  private initCustomMetrics(): void {
    // Dashboard Load Time
    if (window.location.pathname.includes("/dashboard")) {
      this.measureDashboardLoad();
    }

    // Form Interaction Time
    this.measureFormInteractions();

    // WebSocket Connection Time
    this.measureWebSocketConnection();
  }

  private measureDashboardLoad(): void {
    const dashboardStartTime = performance.now();

    // Wait for dashboard components to load
    const observer = new MutationObserver(() => {
      const dashboardCards = document.querySelectorAll('[data-testid*="metrics-card"]');
      if (dashboardCards.length >= 2) {
        // BookingMetrics + FinancialMetrics
        const loadTime = performance.now() - dashboardStartTime;

        this.handleCustomMetric({
          name: "dashboard-load",
          value: loadTime,
          rating: loadTime < 2000 ? "good" : loadTime < 4000 ? "needs-improvement" : "poor",
        });

        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout after 10 seconds
    setTimeout(() => observer.disconnect(), 10000);
  }

  private measureFormInteractions(): void {
    let interactionStartTime: number;

    document.addEventListener("focusin", (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        interactionStartTime = performance.now();
      }
    });

    document.addEventListener("input", (e) => {
      if (
        interactionStartTime &&
        (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        const responseTime = performance.now() - interactionStartTime;

        if (responseTime > 100) {
          // Only log if > 100ms
          this.handleCustomMetric({
            name: "form-response",
            value: responseTime,
            rating: responseTime < 100 ? "good" : responseTime < 300 ? "needs-improvement" : "poor",
          });
        }

        interactionStartTime = 0;
      }
    });
  }

  private measureWebSocketConnection(): void {
    const originalWebSocket = window.WebSocket;
    const monitor = this;

    window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
      const ws = new originalWebSocket(url, protocols);
      const connectionStart = performance.now();

      ws.addEventListener("open", () => {
        const connectionTime = performance.now() - connectionStart;
        monitor.handleCustomMetric({
          name: "websocket-connection",
          value: connectionTime,
          rating:
            connectionTime < 1000 ? "good" : connectionTime < 3000 ? "needs-improvement" : "poor",
        });
      });

      return ws;
    };
  }

  private handleCustomMetric(metric: { name: string; value: number; rating: string }): void {
    const performanceMetric: PerformanceMetric = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating as "good" | "needs-improvement" | "poor",
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: this.getConnectionInfo(),
    };

    this.metrics.push(performanceMetric);

    if (this.config.enableConsoleLog) {
      this.logMetric(performanceMetric);
    }
  }

  private getConnectionInfo(): string {
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;
      return `${connection.effectiveType || "unknown"} (${connection.downlink || 0}Mbps)`;
    }
    return "unknown";
  }

  private logMetric(metric: PerformanceMetric): void {
    const emoji =
      metric.rating === "good" ? "✅" : metric.rating === "needs-improvement" ? "⚠️" : "❌";
    const color =
      metric.rating === "good"
        ? "color: green"
        : metric.rating === "needs-improvement"
          ? "color: orange"
          : "color: red";

    console.log(
      `%c${emoji} ${metric.name.toUpperCase()}: ${metric.value.toFixed(2)}ms (${metric.rating})`,
      color,
      {
        connection: metric.connection,
        url: metric.url,
        timestamp: new Date(metric.timestamp).toISOString(),
      }
    );
  }

  private sendAnalytics(metric: PerformanceMetric): void {
    if (!this.config.endpoint) return;

    // Use navigator.sendBeacon for reliable analytics
    if ("sendBeacon" in navigator) {
      navigator.sendBeacon(this.config.endpoint, JSON.stringify(metric));
    } else {
      // Fallback for older browsers
      fetch(this.config.endpoint, {
        method: "POST",
        body: JSON.stringify(metric),
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {
        // Store in localStorage for retry
        this.storeForRetry(metric);
      });
    }
  }

  private storeForRetry(metric: PerformanceMetric): void {
    try {
      const stored = localStorage.getItem("perf-metrics-retry") || "[]";
      const metrics = JSON.parse(stored);
      metrics.push(metric);

      // Keep only last 50 metrics to prevent storage bloat
      if (metrics.length > 50) {
        metrics.splice(0, metrics.length - 50);
      }

      localStorage.setItem("perf-metrics-retry", JSON.stringify(metrics));
    } catch (error) {
      // Silent fail for localStorage issues
    }
  }

  /**
   * Get current performance summary
   */
  public getMetricsSummary(): Record<string, PerformanceMetric[]> {
    return this.metrics.reduce(
      (acc, metric) => {
        if (!acc[metric.name]) acc[metric.name] = [];
        acc[metric.name].push(metric);
        return acc;
      },
      {} as Record<string, PerformanceMetric[]>
    );
  }

  /**
   * Check if performance is degraded for Philippine network conditions
   */
  public isPerformanceDegraded(): boolean {
    const recentMetrics = this.metrics.filter((m) => Date.now() - m.timestamp < 60000); // Last minute
    const poorMetrics = recentMetrics.filter((m) => m.rating === "poor");

    // Consider degraded if > 30% of metrics are poor
    return poorMetrics.length / Math.max(recentMetrics.length, 1) > 0.3;
  }

  /**
   * Get recommendations for performance improvement
   */
  public getRecommendations(): string[] {
    const summary = this.getMetricsSummary();
    const recommendations: string[] = [];

    if (summary.LCP?.some((m) => m.rating === "poor")) {
      recommendations.push(
        "Consider optimizing largest contentful paint - check for large images or blocking resources"
      );
    }

    if (summary.CLS?.some((m) => m.rating === "poor")) {
      recommendations.push(
        "Layout shifts detected - ensure images have dimensions and avoid dynamic content"
      );
    }

    if (summary.INP?.some((m) => m.rating === "poor")) {
      recommendations.push(
        "Interaction responsiveness is poor - consider code splitting and reducing main thread work"
      );
    }

    if (summary["dashboard-load"]?.some((m) => m.rating === "poor")) {
      recommendations.push(
        "Dashboard loading slowly - consider lazy loading non-critical components"
      );
    }

    return recommendations;
  }
}

// Global instance
let performanceMonitor: ResortPerformanceMonitor;

/**
 * Initialize performance monitoring for the resort system
 */
export function initPerformanceMonitoring(config?: ResortPerformanceConfig): void {
  if (!performanceMonitor) {
    performanceMonitor = new ResortPerformanceMonitor(config);
    performanceMonitor.init();
  }
}

/**
 * Get the performance monitor instance
 */
export function getPerformanceMonitor(): ResortPerformanceMonitor | undefined {
  return performanceMonitor;
}
