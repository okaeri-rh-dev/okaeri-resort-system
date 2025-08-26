/**
 * Comprehensive Performance Monitoring System
 * Integrates with Core Web Vitals, custom metrics, and analytics
 * Optimized for resort management operations
 */

import { coreWebVitalsMonitor, performanceBudgetManager } from "./route-optimization";

interface PerformanceConfig {
  enableTracking: boolean;
  sampleRate: number;
  reportInterval: number;
  budgets: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
    bundleSize: number;
  };
}

const defaultConfig: PerformanceConfig = {
  enableTracking: true,
  sampleRate: 0.1, // Track 10% of users in production
  reportInterval: 60000, // Report every minute
  budgets: {
    lcp: 2500, // 2.5s
    fid: 100, // 100ms
    cls: 0.1, // 0.1
    fcp: 1500, // 1.5s
    ttfb: 800, // 800ms
    bundleSize: 150 * 1024, // 150KB
  },
};

/**
 * Main Performance Monitor Class
 */
export class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: Map<string, number[]> = new Map();
  private reportTimer?: NodeJS.Timeout;
  private sessionId: string;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.sessionId = this.generateSessionId();

    this.initialize();
  }

  /**
   * Initialize performance monitoring
   */
  private initialize() {
    if (typeof window === "undefined" || !this.shouldTrack()) return;

    // Initialize Core Web Vitals monitoring
    coreWebVitalsMonitor.initialize();

    // Set up custom metrics collection
    this.setupCustomMetrics();

    // Start periodic reporting
    this.startReporting();

    // Monitor network conditions
    this.monitorNetworkConditions();

    // Track user interactions
    this.trackUserInteractions();

    console.log("Performance monitoring initialized");
  }

  /**
   * Check if we should track this user (sampling)
   */
  private shouldTrack(): boolean {
    if (process.env.NODE_ENV === "development") return true;
    return Math.random() < this.config.sampleRate;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up custom metrics collection
   */
  private setupCustomMetrics() {
    // Track route change performance
    this.trackRouteChanges();

    // Track form submission performance
    this.trackFormSubmissions();

    // Track API response times
    this.trackAPIPerformance();

    // Track image loading performance
    this.trackImageLoading();

    // Track bundle loading performance
    this.trackBundleLoading();
  }

  /**
   * Track route change performance
   */
  private trackRouteChanges() {
    let routeChangeStart = 0;
    let currentRoute = window.location.pathname;

    // Override history methods to track route changes
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const trackRouteChange = (newRoute: string) => {
      if (newRoute !== currentRoute) {
        const changeTime = performance.now() - routeChangeStart;
        this.recordMetric("route-change-time", changeTime);

        // Check against budget
        if (changeTime > 3000) {
          // 3 second budget for route changes
          performanceBudgetManager.checkBudget("routeLoadTime", changeTime, newRoute);
        }

        currentRoute = newRoute;
        routeChangeStart = 0;
      }
    };

    history.pushState = function (state, title, url) {
      routeChangeStart = performance.now();
      const result = originalPushState.call(this, state, title, url);
      setTimeout(() => trackRouteChange(window.location.pathname), 0);
      return result;
    };

    history.replaceState = function (state, title, url) {
      routeChangeStart = performance.now();
      const result = originalReplaceState.call(this, state, title, url);
      setTimeout(() => trackRouteChange(window.location.pathname), 0);
      return result;
    };

    window.addEventListener("popstate", () => {
      routeChangeStart = performance.now();
      setTimeout(() => trackRouteChange(window.location.pathname), 0);
    });
  }

  /**
   * Track form submission performance
   */
  private trackFormSubmissions() {
    document.addEventListener("submit", (event) => {
      const form = event.target as HTMLFormElement;
      const formType = form.dataset.trackingType || "unknown";
      const startTime = performance.now();

      // Track form submission timing
      const trackSubmission = () => {
        const submitTime = performance.now() - startTime;
        this.recordMetric(`form-submit-${formType}`, submitTime);
      };

      // Use setTimeout to capture async form handling
      setTimeout(trackSubmission, 100);
    });
  }

  /**
   * Track API response times
   */
  private trackAPIPerformance() {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const [url] = args;
      const startTime = performance.now();

      try {
        const response = await originalFetch.apply(window, args);
        const duration = performance.now() - startTime;

        // Extract API endpoint for tracking
        let endpoint = "unknown";
        if (typeof url === "string") {
          const urlObj = new URL(url, window.location.origin);
          endpoint = urlObj.pathname.split("/").slice(0, 3).join("/"); // First 2 path segments
        }

        this.recordMetric(`api-${endpoint}`, duration);
        this.recordMetric("api-response-time", duration);

        // Track response size if available
        const contentLength = response.headers.get("content-length");
        if (contentLength) {
          this.recordMetric("api-response-size", parseInt(contentLength));
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.recordMetric("api-error-time", duration);
        throw error;
      }
    };
  }

  /**
   * Track image loading performance
   */
  private trackImageLoading() {
    const imageObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.initiatorType === "img") {
          this.recordMetric("image-load-time", entry.duration);

          // Track image size vs load time
          const resource = entry as PerformanceResourceTiming;
          if (resource.transferSize) {
            const efficiency = resource.transferSize / entry.duration;
            this.recordMetric("image-load-efficiency", efficiency);
          }
        }
      }
    });

    try {
      imageObserver.observe({ entryTypes: ["resource"] });
    } catch (error) {
      console.warn("Image performance tracking not supported:", error);
    }
  }

  /**
   * Track bundle loading performance
   */
  private trackBundleLoading() {
    const bundleObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.initiatorType === "script" && entry.name.includes("assets")) {
          this.recordMetric("bundle-load-time", entry.duration);

          const resource = entry as PerformanceResourceTiming;
          if (resource.transferSize) {
            this.recordMetric("bundle-size", resource.transferSize);

            // Check against bundle size budget
            performanceBudgetManager.checkBudget(
              "initialBundleSize",
              resource.transferSize,
              "bundle"
            );
          }
        }
      }
    });

    try {
      bundleObserver.observe({ entryTypes: ["resource"] });
    } catch (error) {
      console.warn("Bundle performance tracking not supported:", error);
    }
  }

  /**
   * Monitor network conditions
   */
  private monitorNetworkConditions() {
    const connection = (navigator as any).connection;
    if (!connection) return;

    const trackConnection = () => {
      this.recordMetric("connection-downlink", connection.downlink);
      this.recordMetric("connection-rtt", connection.rtt);

      // Track effective connection type
      const effectiveTypes = { "4g": 4, "3g": 3, "2g": 2, "slow-2g": 1 };
      const effectiveTypeValue =
        effectiveTypes[connection.effectiveType as keyof typeof effectiveTypes] || 0;
      this.recordMetric("connection-effective-type", effectiveTypeValue);
    };

    trackConnection(); // Initial measurement
    connection.addEventListener("change", trackConnection);
  }

  /**
   * Track user interactions
   */
  private trackUserInteractions() {
    // Track click responsiveness
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const startTime = performance.now();

      // Use requestAnimationFrame to measure response time
      requestAnimationFrame(() => {
        const responseTime = performance.now() - startTime;
        this.recordMetric("click-response-time", responseTime);

        // Check FID budget
        if (responseTime > this.config.budgets.fid) {
          performanceBudgetManager.checkBudget("fid", responseTime, window.location.pathname);
        }
      });
    });

    // Track scroll performance
    let scrollStartTime = 0;
    let isScrolling = false;

    window.addEventListener("scroll", () => {
      if (!isScrolling) {
        scrollStartTime = performance.now();
        isScrolling = true;
      }

      // Debounce scroll end detection
      clearTimeout(window.scrollTimeout);
      window.scrollTimeout = setTimeout(() => {
        const scrollTime = performance.now() - scrollStartTime;
        this.recordMetric("scroll-duration", scrollTime);
        isScrolling = false;
      }, 150);
    });
  }

  /**
   * Record a performance metric
   */
  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 100 values per metric
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Start periodic reporting
   */
  private startReporting() {
    this.reportTimer = setInterval(() => {
      this.reportMetrics();
    }, this.config.reportInterval);
  }

  /**
   * Report metrics to analytics/monitoring service
   */
  private reportMetrics() {
    const report = this.generateReport();

    if (Object.keys(report.metrics).length === 0) return;

    // Send to analytics service
    this.sendToAnalytics(report);

    // Log in development
    if (process.env.NODE_ENV === "development") {
      console.group("Performance Report");
      console.table(report.metrics);
      console.log("Session:", report.sessionId);
      console.log("Timestamp:", new Date(report.timestamp));
      console.groupEnd();
    }
  }

  /**
   * Generate performance report
   */
  private generateReport() {
    const metrics: Record<string, any> = {};

    // Calculate statistics for each metric
    for (const [name, values] of this.metrics.entries()) {
      if (values.length > 0) {
        metrics[name] = {
          count: values.length,
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          p95: this.calculatePercentile(values, 95),
        };
      }
    }

    return {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      connection: this.getConnectionInfo(),
      metrics,
    };
  }

  /**
   * Calculate percentile value
   */
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Get connection information
   */
  private getConnectionInfo() {
    const connection = (navigator as any).connection;
    return connection
      ? {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
        }
      : null;
  }

  /**
   * Send metrics to analytics service
   */
  private sendToAnalytics(report: any) {
    // Send to Google Analytics 4
    if (typeof window !== "undefined" && "gtag" in window) {
      (window as any).gtag("event", "performance_metrics", {
        custom_parameter_session_id: report.sessionId,
        custom_parameter_metrics: JSON.stringify(report.metrics),
        custom_parameter_connection: JSON.stringify(report.connection),
      });
    }

    // Send to custom analytics endpoint (if available)
    if (process.env.NODE_ENV === "production") {
      fetch("/api/analytics/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      }).catch(() => {
        // Silently fail analytics requests
      });
    }
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary() {
    return this.generateReport();
  }

  /**
   * Stop monitoring and cleanup
   */
  destroy() {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }

    coreWebVitalsMonitor.cleanup();
    this.metrics.clear();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Initialize on window load
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    console.log("Performance monitoring active");
  });

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    performanceMonitor.destroy();
  });
}

// Extend window interface for scroll timeout
declare global {
  interface Window {
    scrollTimeout: NodeJS.Timeout;
  }
}
