// ============================================
// LOADING PERFORMANCE MONITORING UTILITIES
// ============================================

interface PerformanceMetrics {
  loadingStartTime: number;
  skeletonRenderTime: number;
  dataLoadTime: number;
  totalLoadTime: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  interactionToNextPaint?: number;
}

interface LoadingBenchmark {
  component: string;
  metrics: PerformanceMetrics;
  deviceInfo: {
    userAgent: string;
    memory?: number;
    connection?: string;
    viewport: { width: number; height: number };
  };
  timestamp: number;
}

// ============================================
// PERFORMANCE MEASUREMENT CLASS
// ============================================

export class LoadingPerformanceMonitor {
  private benchmarks: LoadingBenchmark[] = [];
  private currentMeasurement: Partial<PerformanceMetrics> = {};
  private measurementId?: string;

  constructor(private maxBenchmarks: number = 100) {
    this.setupVitalMetrics();
  }

  /**
   * Start measuring loading performance for a component
   */
  startMeasurement(componentName: string): string {
    const measurementId = `loading-${componentName}-${Date.now()}`;
    this.measurementId = measurementId;

    this.currentMeasurement = {
      loadingStartTime: performance.now(),
    };

    // Mark the start for Performance Timeline
    performance.mark(`${measurementId}-start`);

    return measurementId;
  }

  /**
   * Mark when skeleton rendering is complete
   */
  markSkeletonRendered(): void {
    if (!this.measurementId) return;

    const now = performance.now();
    this.currentMeasurement.skeletonRenderTime = now;

    performance.mark(`${this.measurementId}-skeleton`);
  }

  /**
   * Mark when data loading is complete
   */
  markDataLoaded(): void {
    if (!this.measurementId) return;

    const now = performance.now();
    this.currentMeasurement.dataLoadTime = now;

    performance.mark(`${this.measurementId}-data`);
  }

  /**
   * Complete the measurement and store the benchmark
   */
  endMeasurement(componentName: string): PerformanceMetrics | null {
    if (!this.measurementId || !this.currentMeasurement.loadingStartTime) {
      return null;
    }

    const endTime = performance.now();
    const startTime = this.currentMeasurement.loadingStartTime;

    const metrics: PerformanceMetrics = {
      loadingStartTime: startTime,
      skeletonRenderTime: this.currentMeasurement.skeletonRenderTime
        ? this.currentMeasurement.skeletonRenderTime - startTime
        : 0,
      dataLoadTime: this.currentMeasurement.dataLoadTime
        ? this.currentMeasurement.dataLoadTime - startTime
        : 0,
      totalLoadTime: endTime - startTime,
      ...this.getVitalMetrics(),
    };

    // Create benchmark entry
    const benchmark: LoadingBenchmark = {
      component: componentName,
      metrics,
      deviceInfo: this.getDeviceInfo(),
      timestamp: Date.now(),
    };

    this.addBenchmark(benchmark);

    // Create performance measures
    performance.mark(`${this.measurementId}-end`);
    performance.measure(
      `${this.measurementId}-total`,
      `${this.measurementId}-start`,
      `${this.measurementId}-end`
    );

    // Reset for next measurement
    this.currentMeasurement = {};
    this.measurementId = undefined;

    return metrics;
  }

  /**
   * Get performance statistics for a component
   */
  getComponentStats(componentName: string): {
    count: number;
    averageLoadTime: number;
    medianLoadTime: number;
    p95LoadTime: number;
    averageSkeletonTime: number;
  } {
    const componentBenchmarks = this.benchmarks.filter((b) => b.component === componentName);

    if (componentBenchmarks.length === 0) {
      return {
        count: 0,
        averageLoadTime: 0,
        medianLoadTime: 0,
        p95LoadTime: 0,
        averageSkeletonTime: 0,
      };
    }

    const loadTimes = componentBenchmarks.map((b) => b.metrics.totalLoadTime);
    const skeletonTimes = componentBenchmarks.map((b) => b.metrics.skeletonRenderTime);

    loadTimes.sort((a, b) => a - b);

    return {
      count: componentBenchmarks.length,
      averageLoadTime: loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length,
      medianLoadTime: loadTimes[Math.floor(loadTimes.length / 2)],
      p95LoadTime: loadTimes[Math.floor(loadTimes.length * 0.95)],
      averageSkeletonTime:
        skeletonTimes.reduce((sum, time) => sum + time, 0) / skeletonTimes.length,
    };
  }

  /**
   * Get all benchmarks for analysis
   */
  getAllBenchmarks(): LoadingBenchmark[] {
    return [...this.benchmarks];
  }

  /**
   * Export benchmarks as JSON for analysis
   */
  exportBenchmarks(): string {
    return JSON.stringify(
      {
        benchmarks: this.benchmarks,
        exportTime: new Date().toISOString(),
        summary: this.getSummaryStats(),
      },
      null,
      2
    );
  }

  /**
   * Clear all stored benchmarks
   */
  clearBenchmarks(): void {
    this.benchmarks = [];
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const summary = this.getSummaryStats();
    const components = [...new Set(this.benchmarks.map((b) => b.component))];

    let report = `Loading Performance Report
Generated: ${new Date().toLocaleString()}
Total Measurements: ${this.benchmarks.length}

SUMMARY STATISTICS:
- Average Load Time: ${summary.averageLoadTime.toFixed(2)}ms
- Median Load Time: ${summary.medianLoadTime.toFixed(2)}ms
- 95th Percentile: ${summary.p95LoadTime.toFixed(2)}ms
- Best Load Time: ${summary.bestLoadTime.toFixed(2)}ms
- Worst Load Time: ${summary.worstLoadTime.toFixed(2)}ms

COMPONENT BREAKDOWN:
`;

    components.forEach((component) => {
      const stats = this.getComponentStats(component);
      report += `
${component}:
  Measurements: ${stats.count}
  Average Load: ${stats.averageLoadTime.toFixed(2)}ms
  Median Load: ${stats.medianLoadTime.toFixed(2)}ms
  95th Percentile: ${stats.p95LoadTime.toFixed(2)}ms
  Average Skeleton: ${stats.averageSkeletonTime.toFixed(2)}ms
`;
    });

    report += `
PERFORMANCE RECOMMENDATIONS:
`;

    // Add recommendations based on metrics
    if (summary.averageLoadTime > 2000) {
      report += `- Average load time is over 2 seconds. Consider implementing progressive loading.\n`;
    }

    if (summary.p95LoadTime > 5000) {
      report += `- 95th percentile load time is over 5 seconds. Optimize for slow networks.\n`;
    }

    components.forEach((component) => {
      const stats = this.getComponentStats(component);
      if (stats.averageSkeletonTime > 500) {
        report += `- ${component} skeleton rendering is slow (${stats.averageSkeletonTime.toFixed(2)}ms). Consider simplifying.\n`;
      }
    });

    return report;
  }

  private setupVitalMetrics(): void {
    // Setup Core Web Vitals measurement
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === "largest-contentful-paint") {
              this.currentMeasurement.largestContentfulPaint = entry.startTime;
            } else if (entry.entryType === "first-contentful-paint") {
              this.currentMeasurement.firstContentfulPaint = entry.startTime;
            } else if (entry.entryType === "layout-shift") {
              const layoutShift = entry as any;
              if (!layoutShift.hadRecentInput) {
                this.currentMeasurement.cumulativeLayoutShift =
                  (this.currentMeasurement.cumulativeLayoutShift || 0) + layoutShift.value;
              }
            }
          });
        });

        observer.observe({
          entryTypes: ["largest-contentful-paint", "first-contentful-paint", "layout-shift"],
        });
      } catch (error) {
        console.warn("Performance Observer not supported:", error);
      }
    }
  }

  private getVitalMetrics(): Partial<PerformanceMetrics> {
    return {
      firstContentfulPaint: this.currentMeasurement.firstContentfulPaint,
      largestContentfulPaint: this.currentMeasurement.largestContentfulPaint,
      cumulativeLayoutShift: this.currentMeasurement.cumulativeLayoutShift,
    };
  }

  private getDeviceInfo() {
    const nav = navigator as any;
    return {
      userAgent: navigator.userAgent,
      memory: nav.deviceMemory,
      connection: nav.connection?.effectiveType,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  }

  private addBenchmark(benchmark: LoadingBenchmark): void {
    this.benchmarks.push(benchmark);

    // Keep only the most recent benchmarks
    if (this.benchmarks.length > this.maxBenchmarks) {
      this.benchmarks = this.benchmarks.slice(-this.maxBenchmarks);
    }
  }

  private getSummaryStats() {
    if (this.benchmarks.length === 0) {
      return {
        averageLoadTime: 0,
        medianLoadTime: 0,
        p95LoadTime: 0,
        bestLoadTime: 0,
        worstLoadTime: 0,
      };
    }

    const loadTimes = this.benchmarks.map((b) => b.metrics.totalLoadTime);
    loadTimes.sort((a, b) => a - b);

    return {
      averageLoadTime: loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length,
      medianLoadTime: loadTimes[Math.floor(loadTimes.length / 2)],
      p95LoadTime: loadTimes[Math.floor(loadTimes.length * 0.95)],
      bestLoadTime: Math.min(...loadTimes),
      worstLoadTime: Math.max(...loadTimes),
    };
  }
}

// ============================================
// GLOBAL PERFORMANCE MONITOR
// ============================================

export const globalPerformanceMonitor = new LoadingPerformanceMonitor();

// ============================================
// REACT HOOKS FOR PERFORMANCE MONITORING
// ============================================

export const useLoadingPerformance = (componentName: string) => {
  const [measurementId, setMeasurementId] = React.useState<string>();

  const startMeasurement = React.useCallback(() => {
    const id = globalPerformanceMonitor.startMeasurement(componentName);
    setMeasurementId(id);
    return id;
  }, [componentName]);

  const markSkeletonRendered = React.useCallback(() => {
    globalPerformanceMonitor.markSkeletonRendered();
  }, []);

  const markDataLoaded = React.useCallback(() => {
    globalPerformanceMonitor.markDataLoaded();
  }, []);

  const endMeasurement = React.useCallback(() => {
    const metrics = globalPerformanceMonitor.endMeasurement(componentName);
    setMeasurementId(undefined);
    return metrics;
  }, [componentName]);

  return {
    measurementId,
    startMeasurement,
    markSkeletonRendered,
    markDataLoaded,
    endMeasurement,
  };
};

// ============================================
// PERFORMANCE TESTING UTILITIES
// ============================================

export const runLoadingPerformanceTests = async () => {
  const results = {
    skeletonRenderTests: [] as any[],
    dataLoadingTests: [] as any[],
    memoryUsageTests: [] as any[],
  };

  console.log("Running loading performance tests...");

  // Test 1: Skeleton rendering performance
  console.log("Testing skeleton rendering performance...");
  const skeletonTests = [
    { component: "BookingsTableSkeleton", rows: 10 },
    { component: "UnitsTableSkeleton", rows: 10 },
    { component: "GuestsTableSkeleton", rows: 10 },
    { component: "DashboardStatsSkeleton", cards: 8 },
  ];

  for (const test of skeletonTests) {
    const startTime = performance.now();

    // Simulate skeleton rendering
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        const endTime = performance.now();
        results.skeletonRenderTests.push({
          component: test.component,
          renderTime: endTime - startTime,
          timestamp: Date.now(),
        });
        resolve(undefined);
      });
    });
  }

  // Test 2: Memory usage during loading
  console.log("Testing memory usage...");
  if ("memory" in performance) {
    const memoryBefore = (performance as any).memory.usedJSHeapSize;

    // Simulate creating many skeleton components
    const elements = [];
    for (let i = 0; i < 100; i++) {
      elements.push({ id: i, skeleton: "simulated" });
    }

    const memoryAfter = (performance as any).memory.usedJSHeapSize;
    results.memoryUsageTests.push({
      memoryIncrease: memoryAfter - memoryBefore,
      elementsCreated: elements.length,
      timestamp: Date.now(),
    });
  }

  // Test 3: Network simulation tests
  console.log("Testing network condition adaptations...");
  const networkConditions = ["slow-2g", "2g", "3g", "4g"];

  for (const condition of networkConditions) {
    const startTime = performance.now();

    // Simulate network-aware loading strategy
    const strategy = getLoadingStrategyForNetwork(condition);
    const simulatedLoadTime = await simulateNetworkLoad(condition);

    results.dataLoadingTests.push({
      networkCondition: condition,
      strategy,
      loadTime: simulatedLoadTime,
      adaptationTime: performance.now() - startTime,
      timestamp: Date.now(),
    });
  }

  console.log("Performance tests completed:", results);
  return results;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getLoadingStrategyForNetwork(condition: string) {
  switch (condition) {
    case "slow-2g":
    case "2g":
      return {
        skeletonComplexity: "minimal",
        animationIntensity: "none",
        staggerDelay: 0,
        preloadImages: false,
      };
    case "3g":
      return {
        skeletonComplexity: "basic",
        animationIntensity: "reduced",
        staggerDelay: 50,
        preloadImages: true,
      };
    case "4g":
    default:
      return {
        skeletonComplexity: "detailed",
        animationIntensity: "full",
        staggerDelay: 100,
        preloadImages: true,
      };
  }
}

async function simulateNetworkLoad(condition: string): Promise<number> {
  const delays = {
    "slow-2g": 3000,
    "2g": 1500,
    "3g": 800,
    "4g": 200,
  };

  const delay = delays[condition as keyof typeof delays] || 200;
  const startTime = performance.now();

  await new Promise((resolve) => setTimeout(resolve, delay));

  return performance.now() - startTime;
}

// ============================================
// DEVELOPER UTILITIES
// ============================================

export const setupDevelopmentMonitoring = () => {
  if (process.env.NODE_ENV !== "development") return;

  // Add global performance monitoring
  (window as any).__loadingPerformanceMonitor = globalPerformanceMonitor;

  // Add console commands for developers
  (window as any).__getLoadingStats = () => {
    console.table(
      ["BookingsTable", "UnitsTable", "GuestsTable", "DashboardStats"].map((component) => ({
        Component: component,
        ...globalPerformanceMonitor.getComponentStats(component),
      }))
    );
  };

  (window as any).__generateLoadingReport = () => {
    console.log(globalPerformanceMonitor.generateReport());
  };

  (window as any).__runLoadingTests = runLoadingPerformanceTests;

  console.log("Loading performance monitoring enabled. Available commands:");
  console.log("- __getLoadingStats(): View component loading statistics");
  console.log("- __generateLoadingReport(): Generate detailed performance report");
  console.log("- __runLoadingTests(): Run performance test suite");
};

// Import React for hooks
import React from "react";
