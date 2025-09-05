/**
 * Performance Monitoring React Hook
 * Phase 2.4: Performance Optimization - Resort system performance monitoring
 *
 * @description React hook for integrating Core Web Vitals monitoring
 * with resort management system components
 */

import { useEffect, useRef, useState } from "react";
import {
  initPerformanceMonitoring,
  getPerformanceMonitor,
} from "@/lib/performance/core-web-vitals";

interface PerformanceState {
  isMonitoring: boolean;
  isDegraded: boolean;
  recommendations: string[];
  metrics: Record<string, any[]>;
}

interface UsePerformanceMonitoringOptions {
  enableInDevelopment?: boolean;
  samplingRate?: number;
  endpoint?: string;
  enableRecommendations?: boolean;
}

/**
 * Hook for monitoring performance in resort management components
 */
export function usePerformanceMonitoring(options: UsePerformanceMonitoringOptions = {}) {
  const [state, setState] = useState<PerformanceState>({
    isMonitoring: false,
    isDegraded: false,
    recommendations: [],
    metrics: {},
  });

  const intervalRef = useRef<NodeJS.Timeout>();
  const initRef = useRef(false);

  useEffect(() => {
    // Initialize monitoring once
    if (!initRef.current) {
      initRef.current = true;

      initPerformanceMonitoring({
        enableConsoleLog: options.enableInDevelopment ?? process.env.NODE_ENV === "development",
        enableAnalytics: process.env.NODE_ENV === "production",
        samplingRate: options.samplingRate ?? 1.0,
        endpoint: options.endpoint,
      });

      setState((prev) => ({ ...prev, isMonitoring: true }));
    }

    // Check performance status every 30 seconds
    if (options.enableRecommendations) {
      intervalRef.current = setInterval(() => {
        const monitor = getPerformanceMonitor();
        if (monitor) {
          setState((prev) => ({
            ...prev,
            isDegraded: monitor.isPerformanceDegraded(),
            recommendations: monitor.getRecommendations(),
            metrics: monitor.getMetricsSummary(),
          }));
        }
      }, 30000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    options.enableInDevelopment,
    options.samplingRate,
    options.endpoint,
    options.enableRecommendations,
  ]);

  /**
   * Mark a custom performance measurement
   */
  const markMeasurement = (name: string, startTime?: number) => {
    const endTime = performance.now();
    const duration = startTime ? endTime - startTime : endTime;

    // Dispatch custom event for monitoring
    window.dispatchEvent(
      new CustomEvent("custom-performance-metric", {
        detail: {
          name,
          value: duration,
          timestamp: Date.now(),
        },
      })
    );

    return duration;
  };

  /**
   * Start a performance timer
   */
  const startTimer = () => {
    return performance.now();
  };

  /**
   * Get current performance status
   */
  const getStatus = () => {
    const monitor = getPerformanceMonitor();
    if (!monitor) return null;

    return {
      isDegraded: monitor.isPerformanceDegraded(),
      recommendations: monitor.getRecommendations(),
      summary: monitor.getMetricsSummary(),
    };
  };

  return {
    ...state,
    markMeasurement,
    startTimer,
    getStatus,
  };
}

/**
 * Hook for measuring component render performance
 */
export function useComponentPerformance(componentName: string) {
  const renderStart = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStart.current = performance.now();
  });

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = performance.now() - renderStart.current;

    // Log slow renders (> 16ms for 60fps)
    if (renderTime > 16) {
      console.warn(
        `🐌 Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms (render #${renderCount.current})`
      );
    }

    // Dispatch event for monitoring
    window.dispatchEvent(
      new CustomEvent("component-render-metric", {
        detail: {
          name: `${componentName}-render`,
          value: renderTime,
          renderCount: renderCount.current,
          timestamp: Date.now(),
        },
      })
    );
  });

  return renderCount.current;
}

/**
 * Hook for measuring async operation performance
 */
export function useAsyncPerformance() {
  const measureAsync = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      // Dispatch event for monitoring
      window.dispatchEvent(
        new CustomEvent("async-operation-metric", {
          detail: {
            name: `${operationName}-async`,
            value: duration,
            success: true,
            timestamp: Date.now(),
          },
        })
      );

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Log failed operations
      window.dispatchEvent(
        new CustomEvent("async-operation-metric", {
          detail: {
            name: `${operationName}-async`,
            value: duration,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: Date.now(),
          },
        })
      );

      throw error;
    }
  };

  return { measureAsync };
}

/**
 * Hook for measuring form interaction performance
 */
export function useFormPerformance(formName: string) {
  const [interactionMetrics, setInteractionMetrics] = useState({
    totalInteractions: 0,
    averageResponseTime: 0,
    slowInteractions: 0,
  });

  const measureFormInteraction = (inputName: string, startTime: number) => {
    const responseTime = performance.now() - startTime;

    setInteractionMetrics((prev) => {
      const newTotal = prev.totalInteractions + 1;
      const newAverage =
        (prev.averageResponseTime * prev.totalInteractions + responseTime) / newTotal;
      const newSlowCount = responseTime > 100 ? prev.slowInteractions + 1 : prev.slowInteractions;

      return {
        totalInteractions: newTotal,
        averageResponseTime: newAverage,
        slowInteractions: newSlowCount,
      };
    });

    // Dispatch event for monitoring
    window.dispatchEvent(
      new CustomEvent("form-interaction-metric", {
        detail: {
          name: `${formName}-${inputName}-interaction`,
          value: responseTime,
          formName,
          inputName,
          timestamp: Date.now(),
        },
      })
    );

    return responseTime;
  };

  return {
    interactionMetrics,
    measureFormInteraction,
  };
}
