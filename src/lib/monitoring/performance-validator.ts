/**
 * Phase 4.4 Performance Validator
 * Real-time performance validation and monitoring system
 *
 * This module provides comprehensive performance monitoring to validate
 * that all Phase 4.4 optimizations are maintained in production.
 *
 * Features:
 * - Real-time performance metric collection
 * - Automated regression detection
 * - Performance threshold validation
 * - Alert system for performance degradation
 * - Comprehensive reporting dashboard
 */

import { Money } from "@/lib/money";

// Performance thresholds based on Phase 4.4 targets
export const PERFORMANCE_THRESHOLDS = {
  // Report Engine Thresholds (Week 1.1)
  reports: {
    monthlyPLGeneration: {
      target: 2000, // 2s target
      warning: 2200, // 10% degradation warning
      critical: 2500, // 25% degradation critical
      baseline: 4200, // Original baseline for improvement calculation
    },
    taxSummaryReport: {
      target: 1500,
      warning: 1650,
      critical: 1875,
      baseline: 2800,
    },
    cashFlowReport: {
      target: 1800,
      warning: 1980,
      critical: 2250,
      baseline: 3500,
    },
    excelExport: {
      target: 3000,
      warning: 3300,
      critical: 3750,
      baseline: 6000,
    },
  },

  // Dashboard Thresholds (Week 1.2)
  dashboard: {
    initialLoad: {
      target: 350,
      warning: 385,
      critical: 438,
      baseline: 800,
    },
    metricRefresh: {
      target: 200,
      warning: 220,
      critical: 250,
      baseline: 400,
    },
    chartRendering: {
      target: 150,
      warning: 165,
      critical: 188,
      baseline: 300,
    },
    realtimeUpdates: {
      target: 100,
      warning: 110,
      critical: 125,
      baseline: 250,
    },
  },

  // Database Thresholds (Week 3.1)
  database: {
    financialSummary: {
      target: 85,
      warning: 94,
      critical: 106,
      baseline: 200,
    },
    taxCalculation: {
      target: 150,
      warning: 165,
      critical: 188,
      baseline: 300,
    },
    auditTrailQuery: {
      target: 120,
      warning: 132,
      critical: 150,
      baseline: 250,
    },
    bulkInsert: {
      target: 500,
      warning: 550,
      critical: 625,
      baseline: 1200,
    },
  },

  // System-wide Thresholds
  system: {
    concurrentUsers: { min: 1000, warning: 800, critical: 500 },
    responseTimeP95: { max: 500, warning: 550, critical: 750 },
    errorRate: { max: 0.01, warning: 0.015, critical: 0.02 },
    cacheHitRate: { min: 0.9, warning: 0.85, critical: 0.8 },
    lighthouseScore: { min: 95, warning: 90, critical: 85 },
  },
} as const;

// Performance status levels
export type PerformanceStatus = "optimal" | "good" | "warning" | "critical" | "failed";

// Performance metric interface
export interface PerformanceMetric {
  name: string;
  category: keyof typeof PERFORMANCE_THRESHOLDS;
  value: number;
  timestamp: Date;
  status: PerformanceStatus;
  threshold: {
    target: number;
    warning: number;
    critical: number;
    baseline?: number;
  };
  improvement?: number; // Percentage improvement from baseline
  tags?: Record<string, string>;
}

// Performance validation result
export interface ValidationResult {
  metric: PerformanceMetric;
  passed: boolean;
  message: string;
  recommendations?: string[];
}

// Performance trend data
export interface PerformanceTrend {
  metric: string;
  timeRange: string;
  values: { timestamp: Date; value: number }[];
  trend: "improving" | "stable" | "degrading";
  slope: number;
  r2: number; // Coefficient of determination
}

/**
 * Performance Validator Class
 * Handles real-time performance validation and monitoring
 */
export class PerformanceValidator {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alertCallbacks: Array<(metric: PerformanceMetric) => void> = [];
  private validationHistory: ValidationResult[] = [];

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    category: keyof typeof PERFORMANCE_THRESHOLDS,
    value: number,
    tags?: Record<string, string>
  ): PerformanceMetric {
    const timestamp = new Date();
    const threshold = this.getThreshold(category, name);
    const status = this.calculateStatus(value, threshold);

    const metric: PerformanceMetric = {
      name,
      category,
      value,
      timestamp,
      status,
      threshold,
      improvement: threshold.baseline
        ? this.calculateImprovement(value, threshold.baseline)
        : undefined,
      tags,
    };

    // Store metric
    const key = `${category}.${name}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metricHistory = this.metrics.get(key)!;
    metricHistory.push(metric);

    // Keep only last 100 measurements
    if (metricHistory.length > 100) {
      metricHistory.shift();
    }

    // Trigger alerts for degraded performance
    if (status === "warning" || status === "critical") {
      this.alertCallbacks.forEach((callback) => callback(metric));
    }

    return metric;
  }

  /**
   * Validate a metric against thresholds
   */
  validateMetric(metric: PerformanceMetric): ValidationResult {
    const result: ValidationResult = {
      metric,
      passed: metric.status === "optimal" || metric.status === "good",
      message: this.generateStatusMessage(metric),
      recommendations: this.generateRecommendations(metric),
    };

    this.validationHistory.push(result);

    // Keep only last 1000 validation results
    if (this.validationHistory.length > 1000) {
      this.validationHistory.shift();
    }

    return result;
  }

  /**
   * Get performance trends for a metric
   */
  getTrend(
    category: string,
    metricName: string,
    timeRange: string = "24h"
  ): PerformanceTrend | null {
    const key = `${category}.${metricName}`;
    const metricHistory = this.metrics.get(key);

    if (!metricHistory || metricHistory.length < 5) {
      return null;
    }

    const cutoffTime = this.getCutoffTime(timeRange);
    const relevantMetrics = metricHistory.filter((m) => m.timestamp >= cutoffTime);

    if (relevantMetrics.length < 3) {
      return null;
    }

    const values = relevantMetrics.map((m) => ({
      timestamp: m.timestamp,
      value: m.value,
    }));

    const { slope, r2, trend } = this.calculateTrendAnalysis(values);

    return {
      metric: `${category}.${metricName}`,
      timeRange,
      values,
      trend,
      slope,
      r2,
    };
  }

  /**
   * Get overall system health summary
   */
  getSystemHealthSummary(): {
    overallStatus: PerformanceStatus;
    categoryStatuses: Record<string, PerformanceStatus>;
    criticalIssues: PerformanceMetric[];
    warnings: PerformanceMetric[];
    improvements: Array<{ metric: string; improvement: number }>;
  } {
    const recentMetrics = this.getRecentMetrics(5 * 60 * 1000); // Last 5 minutes

    const criticalIssues = recentMetrics.filter((m) => m.status === "critical");
    const warnings = recentMetrics.filter((m) => m.status === "warning");

    const improvements = recentMetrics
      .filter((m) => m.improvement !== undefined && m.improvement > 0)
      .map((m) => ({ metric: m.name, improvement: m.improvement! }))
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 10); // Top 10 improvements

    const categoryStatuses = this.calculateCategoryStatuses(recentMetrics);
    const overallStatus = this.calculateOverallStatus(categoryStatuses);

    return {
      overallStatus,
      categoryStatuses,
      criticalIssues,
      warnings,
      improvements,
    };
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (metric: PerformanceMetric) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Generate performance report
   */
  generateReport(timeRange: string = "24h"): {
    summary: ReturnType<PerformanceValidator["getSystemHealthSummary"]>;
    trends: PerformanceTrend[];
    regressions: Array<{ metric: string; degradation: number }>;
    achievements: Array<{ metric: string; improvement: number }>;
    recommendations: string[];
  } {
    const summary = this.getSystemHealthSummary();
    const trends = this.getAllTrends(timeRange);
    const regressions = this.detectRegressions();
    const achievements = this.identifyAchievements();
    const recommendations = this.generateSystemRecommendations(summary, trends);

    return {
      summary,
      trends,
      regressions,
      achievements,
      recommendations,
    };
  }

  // Private helper methods

  private getThreshold(category: keyof typeof PERFORMANCE_THRESHOLDS, name: string) {
    const categoryThresholds = PERFORMANCE_THRESHOLDS[category] as any;
    return (
      categoryThresholds[name] || {
        target: 1000,
        warning: 1100,
        critical: 1250,
      }
    );
  }

  private calculateStatus(value: number, threshold: any): PerformanceStatus {
    if (value <= threshold.target) return "optimal";
    if (value <= threshold.warning) return "good";
    if (value <= threshold.critical) return "warning";
    return "critical";
  }

  private calculateImprovement(current: number, baseline: number): number {
    if (baseline <= current) return 0;
    return ((baseline - current) / baseline) * 100;
  }

  private generateStatusMessage(metric: PerformanceMetric): string {
    const improvement = metric.improvement
      ? ` (${metric.improvement.toFixed(1)}% improvement)`
      : "";

    switch (metric.status) {
      case "optimal":
        return `${metric.name} performing optimally at ${metric.value}ms${improvement}`;
      case "good":
        return `${metric.name} performing well at ${metric.value}ms${improvement}`;
      case "warning":
        return `${metric.name} showing degraded performance at ${metric.value}ms (threshold: ${metric.threshold.warning}ms)`;
      case "critical":
        return `${metric.name} performance critical at ${metric.value}ms (threshold: ${metric.threshold.critical}ms)`;
      default:
        return `${metric.name} status unknown at ${metric.value}ms`;
    }
  }

  private generateRecommendations(metric: PerformanceMetric): string[] {
    const recommendations: string[] = [];

    if (metric.status === "warning" || metric.status === "critical") {
      switch (metric.category) {
        case "reports":
          recommendations.push("Consider optimizing database queries");
          recommendations.push("Check if report caching is functioning correctly");
          recommendations.push("Review data processing algorithms for efficiency");
          break;
        case "dashboard":
          recommendations.push("Verify frontend bundle size hasn't increased");
          recommendations.push("Check if memoization is working correctly");
          recommendations.push("Review network requests for unnecessary data fetching");
          break;
        case "database":
          recommendations.push("Analyze query execution plans");
          recommendations.push("Check database connection pool health");
          recommendations.push("Consider adding or updating indexes");
          break;
      }
    }

    return recommendations;
  }

  private getRecentMetrics(timeWindowMs: number): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    const recent: PerformanceMetric[] = [];

    for (const metricHistory of this.metrics.values()) {
      const recentForMetric = metricHistory.filter((m) => m.timestamp >= cutoff);
      if (recentForMetric.length > 0) {
        recent.push(recentForMetric[recentForMetric.length - 1]); // Most recent
      }
    }

    return recent;
  }

  private calculateCategoryStatuses(
    metrics: PerformanceMetric[]
  ): Record<string, PerformanceStatus> {
    const statuses: Record<string, PerformanceStatus> = {};

    // Group by category
    const byCategory = new Map<string, PerformanceMetric[]>();
    for (const metric of metrics) {
      if (!byCategory.has(metric.category)) {
        byCategory.set(metric.category, []);
      }
      byCategory.get(metric.category)!.push(metric);
    }

    // Calculate status for each category
    for (const [category, categoryMetrics] of byCategory.entries()) {
      const statusPriority = { failed: 5, critical: 4, warning: 3, good: 2, optimal: 1 };
      const worstStatus = categoryMetrics.reduce((worst, metric) => {
        return statusPriority[metric.status] > statusPriority[worst] ? metric.status : worst;
      }, "optimal" as PerformanceStatus);

      statuses[category] = worstStatus;
    }

    return statuses;
  }

  private calculateOverallStatus(
    categoryStatuses: Record<string, PerformanceStatus>
  ): PerformanceStatus {
    const statuses = Object.values(categoryStatuses);
    const statusPriority = { failed: 5, critical: 4, warning: 3, good: 2, optimal: 1 };

    return statuses.reduce((worst, status) => {
      return statusPriority[status] > statusPriority[worst] ? status : worst;
    }, "optimal" as PerformanceStatus);
  }

  private getCutoffTime(timeRange: string): Date {
    const now = new Date();
    const value = parseInt(timeRange);
    const unit = timeRange.replace(value.toString(), "");

    let milliseconds = 0;
    switch (unit) {
      case "h":
        milliseconds = value * 60 * 60 * 1000;
        break;
      case "d":
        milliseconds = value * 24 * 60 * 60 * 1000;
        break;
      case "m":
        milliseconds = value * 60 * 1000;
        break;
      default:
        milliseconds = 24 * 60 * 60 * 1000; // Default 24h
    }

    return new Date(now.getTime() - milliseconds);
  }

  private calculateTrendAnalysis(values: { timestamp: Date; value: number }[]): {
    slope: number;
    r2: number;
    trend: "improving" | "stable" | "degrading";
  } {
    if (values.length < 2) {
      return { slope: 0, r2: 0, trend: "stable" };
    }

    // Simple linear regression
    const n = values.length;
    const x = values.map((_, i) => i); // Time index
    const y = values.map((v) => v.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const r2 = 1 - ssRes / ssTot;

    // Determine trend
    let trend: "improving" | "stable" | "degrading" = "stable";
    if (Math.abs(slope) > 0.1 && r2 > 0.3) {
      // Significant trend
      trend = slope < 0 ? "improving" : "degrading"; // Lower values are better for performance
    }

    return { slope, r2, trend };
  }

  private getAllTrends(timeRange: string): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    for (const key of this.metrics.keys()) {
      const [category, metricName] = key.split(".");
      const trend = this.getTrend(category, metricName, timeRange);
      if (trend) {
        trends.push(trend);
      }
    }

    return trends;
  }

  private detectRegressions(): Array<{ metric: string; degradation: number }> {
    const regressions: Array<{ metric: string; degradation: number }> = [];
    const recentMetrics = this.getRecentMetrics(60 * 60 * 1000); // Last hour

    for (const metric of recentMetrics) {
      if (metric.status === "warning" || metric.status === "critical") {
        const degradation =
          ((metric.value - metric.threshold.target) / metric.threshold.target) * 100;
        regressions.push({
          metric: `${metric.category}.${metric.name}`,
          degradation,
        });
      }
    }

    return regressions.sort((a, b) => b.degradation - a.degradation);
  }

  private identifyAchievements(): Array<{ metric: string; improvement: number }> {
    const achievements: Array<{ metric: string; improvement: number }> = [];
    const recentMetrics = this.getRecentMetrics(60 * 60 * 1000); // Last hour

    for (const metric of recentMetrics) {
      if (metric.improvement !== undefined && metric.improvement >= 50) {
        // 50%+ improvement
        achievements.push({
          metric: `${metric.category}.${metric.name}`,
          improvement: metric.improvement,
        });
      }
    }

    return achievements.sort((a, b) => b.improvement - a.improvement);
  }

  private generateSystemRecommendations(
    summary: ReturnType<PerformanceValidator["getSystemHealthSummary"]>,
    trends: PerformanceTrend[]
  ): string[] {
    const recommendations: string[] = [];

    // Critical issues
    if (summary.criticalIssues.length > 0) {
      recommendations.push(
        `URGENT: Address ${summary.criticalIssues.length} critical performance issues`
      );
    }

    // Degrading trends
    const degradingTrends = trends.filter((t) => t.trend === "degrading" && t.r2 > 0.5);
    if (degradingTrends.length > 0) {
      recommendations.push(`Monitor ${degradingTrends.length} metrics showing degrading trends`);
    }

    // Category-specific recommendations
    if (
      summary.categoryStatuses.database === "warning" ||
      summary.categoryStatuses.database === "critical"
    ) {
      recommendations.push("Review database optimization strategies");
    }

    if (
      summary.categoryStatuses.reports === "warning" ||
      summary.categoryStatuses.reports === "critical"
    ) {
      recommendations.push("Investigate report generation performance");
    }

    // Positive feedback
    if (summary.improvements.length > 5) {
      recommendations.push(
        `Excellent: ${summary.improvements.length} metrics showing significant improvements`
      );
    }

    return recommendations;
  }
}

// Global performance validator instance
export const performanceValidator = new PerformanceValidator();

// Convenience functions for common measurements
export const measureReportGeneration = (reportType: string, duration: number) => {
  return performanceValidator.recordMetric(reportType, "reports", duration, { type: "report" });
};

export const measureDashboardMetric = (metricName: string, duration: number) => {
  return performanceValidator.recordMetric(metricName, "dashboard", duration, {
    type: "dashboard",
  });
};

export const measureDatabaseQuery = (queryType: string, duration: number) => {
  return performanceValidator.recordMetric(queryType, "database", duration, { type: "query" });
};

console.log("📊 Performance Validator loaded - Real-time monitoring active");
console.log("🎯 Monitoring Phase 4.4 performance thresholds and improvements");
console.log("⚡ Alert system ready for performance regression detection");
