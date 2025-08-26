/**
 * Advanced Route Optimization System
 * Implements intelligent lazy loading, prefetching, and performance monitoring
 * Optimized for mobile-first performance and PWA capabilities
 */

import { lazy, ComponentType, ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { RouteApi } from "@tanstack/react-router";

// Performance monitoring
interface PerformanceMetrics {
  routeLoadTime: number;
  bundleSize: number;
  renderTime: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  firstInputDelay?: number;
}

/**
 * Smart lazy loading with performance tracking
 */
export function createLazyRoute<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  routeName: string,
  preloadConditions?: {
    onHover?: boolean;
    onViewport?: boolean;
    delay?: number;
    priority?: "high" | "medium" | "low";
  }
): ComponentType<T> {
  const startTime = performance.now();

  const LazyComponent = lazy(async () => {
    const loadStart = performance.now();

    try {
      const module = await importFn();
      const loadEnd = performance.now();

      // Track route loading performance
      trackRoutePerformance(routeName, {
        routeLoadTime: loadEnd - loadStart,
        bundleSize: 0, // Will be populated by service worker
        renderTime: 0, // Will be updated on render
      });

      return module;
    } catch (error) {
      console.error(`Failed to load route ${routeName}:`, error);

      // Track loading errors
      trackRouteError(routeName, error as Error);

      // Return error fallback
      return {
        default: () =>
          (
            <div className="flex min-h-[400px] items-center justify-center p-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-red-600">Failed to load page</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Please check your connection and try again.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          ) as ComponentType<T>,
      };
    }
  });

  // Add preloading capabilities
  if (preloadConditions) {
    addPreloadBehavior(LazyComponent, importFn, preloadConditions);
  }

  return LazyComponent;
}

/**
 * Add intelligent preloading behavior
 */
function addPreloadBehavior<T>(
  component: ComponentType<T>,
  importFn: () => Promise<{ default: ComponentType<T> }>,
  conditions: {
    onHover?: boolean;
    onViewport?: boolean;
    delay?: number;
    priority?: "high" | "medium" | "low";
  }
) {
  // Preload on hover for interactive elements
  if (conditions.onHover) {
    const preloadOnHover = () => {
      if (conditions.delay) {
        setTimeout(() => importFn(), conditions.delay);
      } else {
        importFn();
      }
    };

    (component as any).preloadOnHover = preloadOnHover;
  }

  // Preload when element enters viewport
  if (conditions.onViewport) {
    const preloadOnViewport = (element: Element) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (conditions.delay) {
                setTimeout(() => importFn(), conditions.delay);
              } else {
                importFn();
              }
              observer.disconnect();
            }
          });
        },
        { rootMargin: "100px" } // Preload 100px before entering viewport
      );

      observer.observe(element);
    };

    (component as any).preloadOnViewport = preloadOnViewport;
  }
}

/**
 * Intelligent route transition management
 */
export class RouteTransitionManager {
  private transitionQueue: Array<{
    from: string;
    to: string;
    timestamp: number;
    priority: number;
  }> = [];

  private isTransitioning = false;
  private transitionTimeout?: NodeJS.Timeout;

  /**
   * Queue a route transition with priority
   */
  queueTransition(from: string, to: string, priority = 5) {
    // Cancel existing transition if lower priority
    const existingIndex = this.transitionQueue.findIndex((t) => t.to === to);
    if (existingIndex >= 0) {
      if (this.transitionQueue[existingIndex]!.priority < priority) {
        this.transitionQueue.splice(existingIndex, 1);
      } else {
        return; // Keep existing higher priority transition
      }
    }

    this.transitionQueue.push({
      from,
      to,
      timestamp: Date.now(),
      priority,
    });

    // Sort by priority (higher first)
    this.transitionQueue.sort((a, b) => b.priority - a.priority);

    this.processTransitionQueue();
  }

  /**
   * Process transition queue with throttling
   */
  private processTransitionQueue() {
    if (this.isTransitioning || this.transitionQueue.length === 0) return;

    this.isTransitioning = true;
    const transition = this.transitionQueue.shift()!;

    // Start transition animation
    this.startTransition(transition);

    // Reset transition state after animation completes
    this.transitionTimeout = setTimeout(() => {
      this.isTransitioning = false;
      this.processTransitionQueue();
    }, 300); // Match CSS transition duration
  }

  /**
   * Start route transition with animation
   */
  private startTransition(transition: { from: string; to: string }) {
    // Add transition classes for smooth animation
    const container = document.querySelector("[data-route-container]");
    if (container) {
      container.classList.add("route-transitioning");

      // Remove class after animation
      setTimeout(() => {
        container.classList.remove("route-transitioning");
      }, 300);
    }

    // Track transition performance
    trackRouteTransition(transition.from, transition.to);
  }

  /**
   * Cancel all pending transitions
   */
  cancelTransitions() {
    this.transitionQueue = [];
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
    }
    this.isTransitioning = false;
  }
}

/**
 * Performance budgets and monitoring
 */
export class PerformanceBudgetManager {
  private budgets = {
    initialBundleSize: 150 * 1024, // 150KB
    routeLoadTime: 3000, // 3 seconds
    renderTime: 100, // 100ms
    lcp: 2500, // 2.5 seconds
    fid: 100, // 100ms
    cls: 0.1, // 0.1 cumulative layout shift
  };

  private violations: Array<{
    metric: string;
    value: number;
    budget: number;
    route: string;
    timestamp: number;
  }> = [];

  /**
   * Check performance against budgets
   */
  checkBudget(metric: keyof typeof this.budgets, value: number, route: string) {
    const budget = this.budgets[metric];

    if (value > budget) {
      this.violations.push({
        metric,
        value,
        budget,
        route,
        timestamp: Date.now(),
      });

      // Log violation in development
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `Performance budget violation: ${metric} (${value}) exceeded budget (${budget}) for route ${route}`
        );
      }

      // Send to analytics in production
      if (process.env.NODE_ENV === "production") {
        this.reportViolation(metric, value, budget, route);
      }
    }
  }

  /**
   * Report performance violation to analytics
   */
  private reportViolation(metric: string, value: number, budget: number, route: string) {
    // Send to performance monitoring service
    if (typeof window !== "undefined" && "gtag" in window) {
      (window as any).gtag("event", "performance_budget_violation", {
        metric,
        value,
        budget,
        route,
        user_agent: navigator.userAgent,
        connection_type: (navigator as any).connection?.effectiveType || "unknown",
      });
    }
  }

  /**
   * Get performance violations summary
   */
  getViolationsSummary() {
    return {
      total: this.violations.length,
      byMetric: this.violations.reduce(
        (acc, violation) => {
          acc[violation.metric] = (acc[violation.metric] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      byRoute: this.violations.reduce(
        (acc, violation) => {
          acc[violation.route] = (acc[violation.route] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }
}

/**
 * Core Web Vitals monitoring
 */
export class CoreWebVitalsMonitor {
  private metrics: Record<string, number> = {};
  private observers: PerformanceObserver[] = [];

  /**
   * Initialize Core Web Vitals monitoring
   */
  initialize() {
    if (typeof window === "undefined") return;

    // Largest Contentful Paint (LCP)
    this.observeLCP();

    // First Input Delay (FID)
    this.observeFID();

    // Cumulative Layout Shift (CLS)
    this.observeCLS();

    // Custom metrics
    this.observeCustomMetrics();
  }

  /**
   * Observe Largest Contentful Paint
   */
  private observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
          renderTime: number;
          loadTime: number;
        };

        if (lastEntry) {
          const lcp = lastEntry.renderTime || lastEntry.loadTime;
          this.metrics.lcp = lcp;

          // Check against budget
          performanceBudgetManager.checkBudget("lcp", lcp, getCurrentRoute());

          // Report to analytics
          this.reportMetric("lcp", lcp);
        }
      });

      observer.observe({ entryTypes: ["largest-contentful-paint"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("LCP observation not supported:", error);
    }
  }

  /**
   * Observe First Input Delay
   */
  private observeFID() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          const fid = (entry as any).processingStart - entry.startTime;
          this.metrics.fid = fid;

          // Check against budget
          performanceBudgetManager.checkBudget("fid", fid, getCurrentRoute());

          // Report to analytics
          this.reportMetric("fid", fid);
        });
      });

      observer.observe({ entryTypes: ["first-input"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("FID observation not supported:", error);
    }
  }

  /**
   * Observe Cumulative Layout Shift
   */
  private observeCLS() {
    try {
      let clsValue = 0;

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        });

        this.metrics.cls = clsValue;

        // Check against budget
        performanceBudgetManager.checkBudget("cls", clsValue, getCurrentRoute());

        // Report to analytics
        this.reportMetric("cls", clsValue);
      });

      observer.observe({ entryTypes: ["layout-shift"] });
      this.observers.push(observer);
    } catch (error) {
      console.warn("CLS observation not supported:", error);
    }
  }

  /**
   * Observe custom performance metrics
   */
  private observeCustomMetrics() {
    // Time to Interactive (TTI) approximation
    let ttiTimeout: NodeJS.Timeout;

    const updateTTI = () => {
      clearTimeout(ttiTimeout);
      ttiTimeout = setTimeout(() => {
        const navigationEntry = performance.getEntriesByType(
          "navigation"
        )[0] as PerformanceNavigationTiming;
        if (navigationEntry) {
          const tti = navigationEntry.domInteractive;
          this.metrics.tti = tti;
          this.reportMetric("tti", tti);
        }
      }, 1000);
    };

    // Update TTI on various events
    document.addEventListener("DOMContentLoaded", updateTTI);
    window.addEventListener("load", updateTTI);
  }

  /**
   * Report metric to analytics
   */
  private reportMetric(name: string, value: number) {
    if (typeof window !== "undefined" && "gtag" in window) {
      (window as any).gtag("event", "web_vitals", {
        metric_name: name,
        metric_value: value,
        route: getCurrentRoute(),
        connection_type: (navigator as any).connection?.effectiveType || "unknown",
      });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Cleanup observers
   */
  cleanup() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
  }
}

/**
 * Route-specific performance tracking
 */
const routePerformanceMap = new Map<string, PerformanceMetrics[]>();

export function trackRoutePerformance(route: string, metrics: PerformanceMetrics) {
  if (!routePerformanceMap.has(route)) {
    routePerformanceMap.set(route, []);
  }

  const routeMetrics = routePerformanceMap.get(route)!;
  routeMetrics.push({
    ...metrics,
    // Add timestamp
    timestamp: Date.now(),
  } as PerformanceMetrics & { timestamp: number });

  // Keep only last 10 entries per route
  if (routeMetrics.length > 10) {
    routeMetrics.shift();
  }
}

export function trackRouteError(route: string, error: Error) {
  console.error(`Route error for ${route}:`, error);

  // Send to error tracking service
  if (typeof window !== "undefined" && "gtag" in window) {
    (window as any).gtag("event", "route_error", {
      route,
      error_message: error.message,
      error_stack: error.stack,
    });
  }
}

export function trackRouteTransition(from: string, to: string) {
  const transitionStart = performance.now();

  // Track transition completion
  requestAnimationFrame(() => {
    const transitionEnd = performance.now();
    const duration = transitionEnd - transitionStart;

    if (typeof window !== "undefined" && "gtag" in window) {
      (window as any).gtag("event", "route_transition", {
        from_route: from,
        to_route: to,
        transition_duration: duration,
      });
    }
  });
}

/**
 * Get current route from location
 */
function getCurrentRoute(): string {
  if (typeof window === "undefined") return "unknown";
  return window.location.pathname;
}

// Create singleton instances
export const routeTransitionManager = new RouteTransitionManager();
export const performanceBudgetManager = new PerformanceBudgetManager();
export const coreWebVitalsMonitor = new CoreWebVitalsMonitor();

// Initialize monitoring
if (typeof window !== "undefined") {
  coreWebVitalsMonitor.initialize();

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    coreWebVitalsMonitor.cleanup();
    routeTransitionManager.cancelTransitions();
  });
}
