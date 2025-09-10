/**
 * Real User Monitoring (RUM) System
 * Phase 4.4 Week 3.3 - Enhanced Performance Monitoring
 *
 * Comprehensive real user monitoring system optimized for Philippine resort operations.
 * Tracks actual user performance metrics, business-critical user journeys, and provides
 * actionable insights for continuous performance optimization.
 *
 * Key Features:
 * - Core Web Vitals monitoring with 95+ Lighthouse score target
 * - Business journey performance tracking (booking, internal reporting)
 * - Mobile-first metrics for resort staff operations
 * - Network condition adaptation for Philippine connectivity
 * - Cost-aware monitoring (serverless budget optimization)
 * - Real-time alerting for performance regressions
 */

import { performanceMonitor } from "@/lib/performance-monitor";
import { logger } from "@/lib/logger";

// Core Web Vitals and Performance Metrics
export interface CoreWebVitals {
  // Core Web Vitals
  lcp: number | null; // Largest Contentful Paint
  inp: number | null; // Interaction to Next Paint
  cls: number | null; // Cumulative Layout Shift

  // Additional Performance Metrics
  fcp: number | null; // First Contentful Paint
  ttfb: number | null; // Time to First Byte
  fid: number | null; // First Input Delay (legacy)

  // Custom metrics
  timeToInteractive: number | null;
  totalBlockingTime: number | null;
  speedIndex: number | null;
}

export interface BusinessJourneyMetrics {
  // Authentication journey
  loginTime: number | null;
  authenticationSteps: number;
  loginErrors: number;

  // Dashboard loading
  dashboardLoadTime: number | null;
  dashboardDataFetches: number;
  cacheHitRate: number;

  // Booking process
  bookingSearchTime: number | null;
  bookingFormTime: number | null;
  bookingSubmissionTime: number | null;
  bookingCompletionRate: number;

  // Financial operations
  expenseEntryTime: number | null;
  reportGenerationTime: number | null;
  internalBalanceCalculationTime: number | null;

  // Internal tracking only
  expenseCalculationTime: number | null;
  internalReportTime: number | null;
  auditLogGenerationTime: number | null;
}

export interface UserContext {
  // User information
  userId?: string;
  projectId?: string;
  userRole: "admin" | "staff" | "owner" | "guest";

  // Device and network
  deviceType: "mobile" | "tablet" | "desktop";
  connectionType: "2g" | "3g" | "4g" | "5g" | "wifi" | "unknown";
  effectiveConnectionType: "slow-2g" | "2g" | "3g" | "4g";

  // Location and context
  country: string;
  timezone: string;
  isHighCostNetwork: boolean;

  // Session information
  sessionId: string;
  sessionStart: Date;
  pageLoadCount: number;
  errors: number;
}

export interface PerformanceEvent {
  // Event identification
  eventId: string;
  eventType: "navigation" | "interaction" | "resource" | "error" | "business_journey";
  timestamp: Date;

  // Performance data
  duration?: number;
  startTime?: number;
  endTime?: number;

  // Context
  url: string;
  userAgent: string;
  viewport: { width: number; height: number };

  // Custom attributes
  attributes: Record<string, any>;

  // Core Web Vitals (if applicable)
  webVitals?: Partial<CoreWebVitals>;

  // Business context
  businessContext?: {
    journey: string;
    step: string;
    outcome: "success" | "error" | "abandoned";
    value?: number; // Business value in PHP
  };
}

export interface PerformanceBudget {
  // Core Web Vitals budgets
  lcp: { target: number; threshold: number };
  inp: { target: number; threshold: number };
  cls: { target: number; threshold: number };

  // Custom budgets
  dashboardLoad: { target: number; threshold: number };
  reportGeneration: { target: number; threshold: number };
  internalBalanceList: { target: number; threshold: number };

  // Bundle size budgets
  initialBundleSize: { target: number; threshold: number };
  routeBundleSize: { target: number; threshold: number };

  // Business journey budgets
  bookingFlow: { target: number; threshold: number };
  internalBalanceFlow: { target: number; threshold: number };
  loginFlow: { target: number; threshold: number };
}

// Default performance budgets optimized for Philippine resort operations
export const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  // Core Web Vitals - 95+ Lighthouse score targets
  lcp: { target: 2500, threshold: 4000 }, // 2.5s target, 4s threshold
  inp: { target: 200, threshold: 500 }, // 200ms target, 500ms threshold
  cls: { target: 0.1, threshold: 0.25 }, // 0.1 target, 0.25 threshold

  // Application-specific budgets
  dashboardLoad: { target: 1500, threshold: 3000 }, // 1.5s target for dashboard
  reportGeneration: { target: 2000, threshold: 5000 }, // 2s target for reports
  internalBalanceList: { target: 1000, threshold: 2000 }, // 1s for internal balance list

  // Bundle size budgets (mobile-first)
  initialBundleSize: { target: 150 * 1024, threshold: 250 * 1024 }, // 150KB target, 250KB threshold
  routeBundleSize: { target: 50 * 1024, threshold: 100 * 1024 }, // 50KB per route

  // Business journey budgets (end-to-end)
  bookingFlow: { target: 5000, threshold: 10000 }, // 5s for complete booking
  internalBalanceFlow: { target: 3000, threshold: 6000 }, // 3s for internal balance calculation
  loginFlow: { target: 2000, threshold: 4000 }, // 2s for login process
};

export class RealUserMonitoring {
  private userContext: UserContext;
  private performanceBudget: PerformanceBudget;
  private eventBuffer: PerformanceEvent[] = [];
  private businessJourneys: Map<string, { startTime: number; steps: string[] }> = new Map();
  private webVitalsCollected: Partial<CoreWebVitals> = {};
  private isEnabled: boolean;
  private sendInterval: NodeJS.Timeout | null = null;
  private readonly maxBufferSize = 50;
  private readonly sendIntervalMs = 30000; // 30 seconds

  constructor(
    userContext: Partial<UserContext> = {},
    performanceBudget: PerformanceBudget = DEFAULT_PERFORMANCE_BUDGET
  ) {
    this.isEnabled = this.shouldEnableRUM();
    this.performanceBudget = performanceBudget;

    // Initialize user context
    this.userContext = {
      userRole: "guest",
      deviceType: this.detectDeviceType(),
      connectionType: this.detectConnectionType(),
      effectiveConnectionType: this.detectEffectiveConnectionType(),
      country: "PH", // Default to Philippines
      timezone: "Asia/Manila",
      isHighCostNetwork: this.detectHighCostNetwork(),
      sessionId: this.generateSessionId(),
      sessionStart: new Date(),
      pageLoadCount: 0,
      errors: 0,
      ...userContext,
    };

    if (this.isEnabled) {
      this.initialize();
    }
  }

  /**
   * Initialize RUM system
   */
  private initialize(): void {
    if (typeof window === "undefined") return;

    // Initialize Core Web Vitals monitoring
    this.initializeCoreWebVitals();

    // Initialize business journey tracking
    this.initializeBusinessJourneys();

    // Initialize performance observers
    this.initializePerformanceObservers();

    // Initialize error tracking
    this.initializeErrorTracking();

    // Start periodic data sending
    this.startPeriodicSend();

    // Track page load
    this.trackPageLoad();

    logger.info("Real User Monitoring initialized", {
      sessionId: this.userContext.sessionId,
      deviceType: this.userContext.deviceType,
      connectionType: this.userContext.connectionType,
    });
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  private initializeCoreWebVitals(): void {
    // LCP (Largest Contentful Paint)
    this.observePerformanceEntry("largest-contentful-paint", (entries) => {
      const lastEntry = entries[entries.length - 1] as any;
      this.webVitalsCollected.lcp = lastEntry.startTime;
      this.checkBudget("lcp", lastEntry.startTime);
    });

    // INP (Interaction to Next Paint) - Use click events as proxy
    let interactionStart = 0;
    document.addEventListener("pointerdown", () => {
      interactionStart = performance.now();
    });

    document.addEventListener("click", () => {
      if (interactionStart) {
        const inp = performance.now() - interactionStart;
        this.webVitalsCollected.inp = inp;
        this.checkBudget("inp", inp);
        interactionStart = 0;
      }
    });

    // CLS (Cumulative Layout Shift)
    this.observePerformanceEntry("layout-shift", (entries) => {
      let clsValue = 0;
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });

      if (clsValue > 0) {
        this.webVitalsCollected.cls = clsValue;
        this.checkBudget("cls", clsValue);
      }
    });

    // FCP (First Contentful Paint)
    this.observePerformanceEntry("paint", (entries) => {
      const fcpEntry = entries.find((entry: any) => entry.name === "first-contentful-paint");
      if (fcpEntry) {
        this.webVitalsCollected.fcp = fcpEntry.startTime;
      }
    });

    // TTFB (Time to First Byte)
    if ("navigation" in performance) {
      const navigationTiming = performance.getEntriesByType("navigation")[0] as any;
      this.webVitalsCollected.ttfb = navigationTiming.responseStart - navigationTiming.fetchStart;
    }
  }

  /**
   * Initialize business journey tracking
   */
  private initializeBusinessJourneys(): void {
    // Login journey
    this.trackBusinessJourney("login", [
      "login-form-displayed",
      "credentials-entered",
      "login-submitted",
      "authentication-completed",
      "dashboard-loaded",
    ]);

    // Booking journey
    this.trackBusinessJourney("booking", [
      "search-initiated",
      "availability-loaded",
      "room-selected",
      "guest-details-entered",
      "booking-confirmed",
      "internal-balance-updated",
    ]);

    // Report generation journey
    this.trackBusinessJourney("report-generation", [
      "report-requested",
      "data-fetched",
      "calculations-completed",
      "report-rendered",
      "export-completed",
    ]);

    // Internal balance tracking journey
    this.trackBusinessJourney("internal-balance", [
      "balance-calculation-started",
      "expenses-loaded",
      "income-calculated",
      "balance-computed",
      "balance-display-updated",
    ]);
  }

  /**
   * Initialize performance observers
   */
  private initializePerformanceObservers(): void {
    // Resource loading performance
    this.observePerformanceEntry("resource", (entries) => {
      entries.forEach((entry: any) => {
        if (entry.transferSize > this.performanceBudget.initialBundleSize.threshold) {
          this.recordEvent({
            eventId: this.generateEventId(),
            eventType: "resource",
            timestamp: new Date(),
            duration: entry.duration,
            url: entry.name,
            userAgent: navigator.userAgent,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            attributes: {
              resourceType: entry.initiatorType,
              transferSize: entry.transferSize,
              encodedBodySize: entry.encodedBodySize,
              decodedBodySize: entry.decodedBodySize,
            },
          });
        }
      });
    });

    // Long tasks that may affect INP
    this.observePerformanceEntry("longtask", (entries) => {
      entries.forEach((entry: any) => {
        this.recordEvent({
          eventId: this.generateEventId(),
          eventType: "interaction",
          timestamp: new Date(),
          duration: entry.duration,
          url: window.location.href,
          userAgent: navigator.userAgent,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          attributes: {
            taskType: "long-task",
            blockingTime: Math.max(0, entry.duration - 50), // Tasks >50ms are blocking
          },
        });
      });
    });
  }

  /**
   * Initialize error tracking
   */
  private initializeErrorTracking(): void {
    // JavaScript errors
    window.addEventListener("error", (event) => {
      this.recordEvent({
        eventId: this.generateEventId(),
        eventType: "error",
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        attributes: {
          errorMessage: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        },
      });

      this.userContext.errors++;
    });

    // Promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.recordEvent({
        eventId: this.generateEventId(),
        eventType: "error",
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        attributes: {
          errorType: "unhandled-promise-rejection",
          reason: event.reason?.toString(),
        },
      });

      this.userContext.errors++;
    });
  }

  /**
   * Track a business journey
   */
  trackBusinessJourney(journeyName: string, steps: string[]): void {
    this.businessJourneys.set(journeyName, {
      startTime: performance.now(),
      steps: [],
    });
  }

  /**
   * Record business journey step
   */
  recordBusinessStep(
    journeyName: string,
    stepName: string,
    outcome: "success" | "error" | "abandoned" = "success"
  ): void {
    const journey = this.businessJourneys.get(journeyName);
    if (!journey) return;

    journey.steps.push(stepName);

    const stepDuration = performance.now() - journey.startTime;

    this.recordEvent({
      eventId: this.generateEventId(),
      eventType: "business_journey",
      timestamp: new Date(),
      duration: stepDuration,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      attributes: {
        journey: journeyName,
        step: stepName,
        stepNumber: journey.steps.length,
        totalSteps: journey.steps.length,
      },
      businessContext: {
        journey: journeyName,
        step: stepName,
        outcome,
      },
    });

    // Check journey completion
    if (outcome === "success" && this.isJourneyComplete(journeyName, journey.steps)) {
      this.completeBusinessJourney(journeyName);
    } else if (outcome === "error" || outcome === "abandoned") {
      this.abandonBusinessJourney(journeyName, stepName);
    }
  }

  /**
   * Complete a business journey
   */
  private completeBusinessJourney(journeyName: string): void {
    const journey = this.businessJourneys.get(journeyName);
    if (!journey) return;

    const totalDuration = performance.now() - journey.startTime;

    this.recordEvent({
      eventId: this.generateEventId(),
      eventType: "business_journey",
      timestamp: new Date(),
      duration: totalDuration,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      attributes: {
        journey: journeyName,
        step: "journey-completed",
        totalSteps: journey.steps.length,
        completedSteps: journey.steps.length,
      },
      businessContext: {
        journey: journeyName,
        step: "completed",
        outcome: "success",
      },
    });

    // Check against budget
    this.checkJourneyBudget(journeyName, totalDuration);

    this.businessJourneys.delete(journeyName);
  }

  /**
   * Abandon a business journey
   */
  private abandonBusinessJourney(journeyName: string, failedStep: string): void {
    const journey = this.businessJourneys.get(journeyName);
    if (!journey) return;

    const abandonTime = performance.now() - journey.startTime;

    this.recordEvent({
      eventId: this.generateEventId(),
      eventType: "business_journey",
      timestamp: new Date(),
      duration: abandonTime,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      attributes: {
        journey: journeyName,
        step: "journey-abandoned",
        failedStep: failedStep,
        totalSteps: journey.steps.length,
        completedSteps: journey.steps.length,
      },
      businessContext: {
        journey: journeyName,
        step: failedStep,
        outcome: "abandoned",
      },
    });

    this.businessJourneys.delete(journeyName);
  }

  /**
   * Record a performance event
   */
  recordEvent(event: PerformanceEvent): void {
    if (!this.isEnabled) return;

    // Add current web vitals to the event
    event.webVitals = { ...this.webVitalsCollected };

    this.eventBuffer.push(event);

    // Send buffer if it's getting full
    if (this.eventBuffer.length >= this.maxBufferSize) {
      this.sendEvents();
    }
  }

  /**
   * Check performance budget violations
   */
  private checkBudget(metric: keyof PerformanceBudget, value: number): void {
    const budget = this.performanceBudget[metric];
    if (!budget) return;

    if (value > budget.threshold) {
      logger.warn(`Performance budget exceeded: ${metric}`, {
        metric,
        value,
        target: budget.target,
        threshold: budget.threshold,
        exceedance: value - budget.threshold,
      });

      // Record budget violation event
      this.recordEvent({
        eventId: this.generateEventId(),
        eventType: "error",
        timestamp: new Date(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        attributes: {
          budgetViolation: true,
          metric,
          value,
          target: budget.target,
          threshold: budget.threshold,
        },
      });
    }
  }

  /**
   * Check business journey budget
   */
  private checkJourneyBudget(journeyName: string, duration: number): void {
    const budgetKey = `${journeyName}Flow` as keyof PerformanceBudget;
    const budget = this.performanceBudget[budgetKey];

    if (budget && duration > budget.threshold) {
      logger.warn(`Business journey budget exceeded: ${journeyName}`, {
        journey: journeyName,
        duration,
        target: budget.target,
        threshold: budget.threshold,
      });
    }
  }

  /**
   * Send events to analytics endpoint
   */
  private async sendEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      // Add user context to all events
      const payload = {
        userContext: this.userContext,
        events: events,
        webVitals: this.webVitalsCollected,
        timestamp: new Date().toISOString(),
      };

      // Send to custom analytics endpoint
      await fetch("/api/analytics/rum", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      logger.debug("RUM events sent", { count: events.length });
    } catch (error) {
      logger.warn("Failed to send RUM events", error);
      // Put events back in buffer for retry
      this.eventBuffer.unshift(...events);
    }
  }

  /**
   * Track page load performance
   */
  private trackPageLoad(): void {
    this.userContext.pageLoadCount++;

    window.addEventListener("load", () => {
      const navigationTiming = performance.getEntriesByType("navigation")[0] as any;

      this.recordEvent({
        eventId: this.generateEventId(),
        eventType: "navigation",
        timestamp: new Date(),
        duration: navigationTiming.loadEventEnd - navigationTiming.navigationStart,
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        attributes: {
          navigationTiming: {
            domContentLoaded:
              navigationTiming.domContentLoadedEventEnd - navigationTiming.navigationStart,
            loadComplete: navigationTiming.loadEventEnd - navigationTiming.navigationStart,
            firstByte: navigationTiming.responseStart - navigationTiming.fetchStart,
            domInteractive: navigationTiming.domInteractive - navigationTiming.navigationStart,
          },
        },
      });
    });
  }

  /**
   * Utility methods
   */
  private observePerformanceEntry(entryType: string, callback: (entries: any[]) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ entryTypes: [entryType] });
    } catch (error) {
      logger.warn(`Failed to observe ${entryType}:`, error);
    }
  }

  private shouldEnableRUM(): boolean {
    // Enable for all users in development
    if (process.env.NODE_ENV === "development") return true;

    // Sample users in production (10% sampling rate)
    return Math.random() < 0.1;
  }

  private detectDeviceType(): "mobile" | "tablet" | "desktop" {
    if (typeof window === "undefined") return "desktop";

    const width = window.screen.width;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  }

  private detectConnectionType(): string {
    const connection = (navigator as any).connection;
    return connection?.type || "unknown";
  }

  private detectEffectiveConnectionType(): "slow-2g" | "2g" | "3g" | "4g" {
    const connection = (navigator as any).connection;
    return connection?.effectiveType || "4g";
  }

  private detectHighCostNetwork(): boolean {
    const connection = (navigator as any).connection;
    return connection?.saveData === true || this.detectEffectiveConnectionType() === "slow-2g";
  }

  private generateSessionId(): string {
    return `rum_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isJourneyComplete(journeyName: string, completedSteps: string[]): boolean {
    // Define completion criteria for each journey
    const completionCriteria: Record<string, string[]> = {
      login: ["login-submitted", "authentication-completed"],
      booking: ["booking-confirmed", "internal-balance-updated"],
      "report-generation": ["report-rendered"],
      "internal-balance": ["balance-display-updated"],
    };

    const requiredSteps = completionCriteria[journeyName];
    return requiredSteps ? requiredSteps.every((step) => completedSteps.includes(step)) : false;
  }

  private startPeriodicSend(): void {
    this.sendInterval = setInterval(() => {
      this.sendEvents();
    }, this.sendIntervalMs);
  }

  /**
   * Public API methods
   */
  updateUserContext(updates: Partial<UserContext>): void {
    this.userContext = { ...this.userContext, ...updates };
  }

  getCurrentMetrics(): {
    webVitals: Partial<CoreWebVitals>;
    userContext: UserContext;
    activeJourneys: string[];
    eventBufferSize: number;
  } {
    return {
      webVitals: { ...this.webVitalsCollected },
      userContext: { ...this.userContext },
      activeJourneys: Array.from(this.businessJourneys.keys()),
      eventBufferSize: this.eventBuffer.length,
    };
  }

  destroy(): void {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
    }

    // Send remaining events
    this.sendEvents();

    this.businessJourneys.clear();
    this.eventBuffer = [];
  }
}

// Export singleton instance
export const realUserMonitoring = new RealUserMonitoring();

// Initialize on window load
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    logger.info("RUM system ready for tracking");
  });

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    realUserMonitoring.destroy();
  });
}

export default RealUserMonitoring;
