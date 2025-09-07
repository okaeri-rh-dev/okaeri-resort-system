/**
 * Materialized View Refresh Scheduler
 *
 * Automated refresh strategies for materialized views with intelligent scheduling
 * based on data freshness requirements and system load patterns.
 *
 * Features:
 * - Intelligent refresh scheduling based on data change patterns
 * - Peak hour avoidance for Philippine business operations
 * - Concurrent refresh management to prevent conflicts
 * - Error handling and retry mechanisms
 * - Performance monitoring and alerting
 */

import { queryOptimizationService } from "../lib/services/query-optimization.service";
import { databasePerformanceService } from "../lib/monitoring/database-performance.service";
import { db } from "../lib/db/connection";
import { sql } from "drizzle-orm";

// =============================================
// Types and Configuration
// =============================================

interface RefreshSchedule {
  viewName: string;
  priority: "high" | "medium" | "low";
  frequencyMinutes: number;
  maxStaleHours: number;
  dependencies: string[];
  businessHoursOnly: boolean;
  retryCount: number;
  lastRefreshed?: Date;
  lastError?: string;
}

interface RefreshResult {
  viewName: string;
  success: boolean;
  duration: number;
  error?: string;
  timestamp: Date;
  retryAttempt: number;
}

// Philippine business hours (8 AM to 6 PM PHT)
const BUSINESS_HOURS = {
  start: 8,
  end: 18,
  timezone: "Asia/Manila",
};

// Peak hours to avoid heavy operations (11 AM - 2 PM, 5 PM - 7 PM PHT)
const PEAK_HOURS = [
  { start: 11, end: 14 }, // Lunch peak
  { start: 17, end: 19 }, // Evening check-in peak
];

// Default refresh schedules for different materialized views
const DEFAULT_SCHEDULES: RefreshSchedule[] = [
  {
    viewName: "financial_summary_mv",
    priority: "high",
    frequencyMinutes: 30, // Every 30 minutes
    maxStaleHours: 2,
    dependencies: [],
    businessHoursOnly: false,
    retryCount: 3,
  },
  {
    viewName: "income_summary_mv",
    priority: "high",
    frequencyMinutes: 15, // Every 15 minutes (high frequency for revenue tracking)
    maxStaleHours: 1,
    dependencies: [],
    businessHoursOnly: false,
    retryCount: 3,
  },
  {
    viewName: "tax_summary_mv",
    priority: "medium",
    frequencyMinutes: 60, // Every hour
    maxStaleHours: 4,
    dependencies: ["financial_summary_mv", "income_summary_mv"],
    businessHoursOnly: true,
    retryCount: 2,
  },
  {
    viewName: "vendor_summary_mv",
    priority: "low",
    frequencyMinutes: 120, // Every 2 hours
    maxStaleHours: 8,
    dependencies: [],
    businessHoursOnly: true,
    retryCount: 2,
  },
];

// =============================================
// Materialized View Scheduler Implementation
// =============================================

export class MaterializedViewScheduler {
  private schedules: Map<string, RefreshSchedule> = new Map();
  private refreshHistory: RefreshResult[] = [];
  private activeRefreshes: Set<string> = new Set();
  private schedulerRunning = false;

  constructor() {
    // Initialize with default schedules
    DEFAULT_SCHEDULES.forEach((schedule) => {
      this.schedules.set(schedule.viewName, schedule);
    });
  }

  /**
   * Start the automated scheduler
   */
  async startScheduler(): Promise<void> {
    if (this.schedulerRunning) {
      console.log("Materialized view scheduler already running");
      return;
    }

    this.schedulerRunning = true;
    console.log("Starting materialized view refresh scheduler...");

    // Run initial assessment
    await this.assessMaterializedViewFreshness();

    // Schedule periodic checks (every 5 minutes)
    const intervalId = setInterval(
      async () => {
        if (!this.schedulerRunning) {
          clearInterval(intervalId);
          return;
        }

        try {
          await this.runScheduledRefreshes();
        } catch (error) {
          console.error("Error in scheduled refresh cycle:", error);
        }
      },
      5 * 60 * 1000
    ); // 5 minutes

    // Log scheduler start
    await this.logSchedulerEvent("scheduler_started", {
      scheduleCount: this.schedules.size,
      timestamp: new Date(),
    });
  }

  /**
   * Stop the scheduler
   */
  async stopScheduler(): Promise<void> {
    this.schedulerRunning = false;
    console.log("Materialized view refresh scheduler stopped");

    await this.logSchedulerEvent("scheduler_stopped", {
      refreshHistoryCount: this.refreshHistory.length,
      timestamp: new Date(),
    });
  }

  /**
   * Run scheduled refreshes based on current time and freshness requirements
   */
  private async runScheduledRefreshes(): Promise<void> {
    const currentTime = new Date();
    const currentHour = currentTime.getHours(); // Assumes server time is PHT

    // Check if we're in business hours
    const isBusinessHours =
      currentHour >= BUSINESS_HOURS.start && currentHour <= BUSINESS_HOURS.end;

    // Check if we're in peak hours
    const isPeakHours = PEAK_HOURS.some(
      (peak) => currentHour >= peak.start && currentHour < peak.end
    );

    for (const [viewName, schedule] of this.schedules.entries()) {
      // Skip if already refreshing
      if (this.activeRefreshes.has(viewName)) {
        continue;
      }

      // Check business hours constraint
      if (schedule.businessHoursOnly && !isBusinessHours) {
        continue;
      }

      // Check if refresh is needed
      const needsRefresh = await this.viewNeedsRefresh(
        viewName,
        schedule,
        currentTime,
        isPeakHours
      );

      if (needsRefresh) {
        // Check dependencies first
        const dependenciesMet = await this.checkDependencies(schedule.dependencies);

        if (dependenciesMet) {
          await this.scheduleViewRefresh(viewName, schedule);
        } else {
          console.log(`Delaying refresh of ${viewName} - dependencies not met`);
        }
      }
    }
  }

  /**
   * Check if a materialized view needs refresh
   */
  private async viewNeedsRefresh(
    viewName: string,
    schedule: RefreshSchedule,
    currentTime: Date,
    isPeakHours: boolean
  ): Promise<boolean> {
    try {
      // Get current view status
      const viewMetrics = await databasePerformanceService.getMaterializedViewMetrics();
      const viewMetric = viewMetrics.find((m) => m.viewName === viewName);

      if (!viewMetric) {
        console.warn(`View ${viewName} not found in metrics`);
        return false;
      }

      const hoursSinceRefresh =
        (currentTime.getTime() - viewMetric.lastRefreshed.getTime()) / (1000 * 60 * 60);
      const minutesSinceRefresh = hoursSinceRefresh * 60;

      // Critical refresh (exceeds max stale hours)
      if (hoursSinceRefresh > schedule.maxStaleHours) {
        return true;
      }

      // Regular refresh interval (but avoid peak hours for low priority)
      if (minutesSinceRefresh >= schedule.frequencyMinutes) {
        if (isPeakHours && schedule.priority === "low") {
          console.log(`Delaying low priority refresh of ${viewName} during peak hours`);
          return false;
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error checking refresh need for ${viewName}:`, error);
      return false;
    }
  }

  /**
   * Check if dependencies are satisfied (all dependency views are fresh)
   */
  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    if (dependencies.length === 0) return true;

    try {
      const viewMetrics = await databasePerformanceService.getMaterializedViewMetrics();

      for (const depViewName of dependencies) {
        const depMetric = viewMetrics.find((m) => m.viewName === depViewName);
        if (!depMetric) continue;

        const depSchedule = this.schedules.get(depViewName);
        if (!depSchedule) continue;

        const hoursSinceRefresh =
          (Date.now() - depMetric.lastRefreshed.getTime()) / (1000 * 60 * 60);

        // Dependency is stale if it exceeds its own max stale hours
        if (hoursSinceRefresh > depSchedule.maxStaleHours) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error checking dependencies:", error);
      return false;
    }
  }

  /**
   * Schedule a view refresh with error handling and retries
   */
  private async scheduleViewRefresh(viewName: string, schedule: RefreshSchedule): Promise<void> {
    if (this.activeRefreshes.has(viewName)) {
      return;
    }

    this.activeRefreshes.add(viewName);
    const startTime = Date.now();

    console.log(`Starting refresh of ${viewName} (priority: ${schedule.priority})`);

    try {
      await this.refreshViewWithRetry(viewName, schedule);

      const duration = Date.now() - startTime;
      const result: RefreshResult = {
        viewName,
        success: true,
        duration,
        timestamp: new Date(),
        retryAttempt: 0,
      };

      this.refreshHistory.push(result);
      schedule.lastRefreshed = new Date();

      console.log(`Successfully refreshed ${viewName} in ${duration}ms`);

      // Log successful refresh
      await this.logSchedulerEvent("view_refreshed", {
        viewName,
        duration,
        priority: schedule.priority,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: RefreshResult = {
        viewName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
        retryAttempt: schedule.retryCount,
      };

      this.refreshHistory.push(result);
      schedule.lastError = result.error;

      console.error(`Failed to refresh ${viewName}:`, error);

      // Log failed refresh
      await this.logSchedulerEvent("view_refresh_failed", {
        viewName,
        error: result.error,
        duration,
        retryCount: schedule.retryCount,
      });
    } finally {
      this.activeRefreshes.delete(viewName);
    }
  }

  /**
   * Refresh view with retry logic
   */
  private async refreshViewWithRetry(viewName: string, schedule: RefreshSchedule): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= schedule.retryCount; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 2^attempt * 1000ms
          const delay = Math.pow(2, attempt) * 1000;
          console.log(
            `Retrying ${viewName} refresh in ${delay}ms (attempt ${attempt + 1}/${schedule.retryCount + 1})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        await queryOptimizationService.refreshMaterializedView(viewName);
        return; // Success - exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        console.warn(`Refresh attempt ${attempt + 1} failed for ${viewName}:`, error);

        // If this was the last attempt, throw the error
        if (attempt === schedule.retryCount) {
          throw lastError;
        }
      }
    }
  }

  /**
   * Assess current materialized view freshness and update schedules
   */
  async assessMaterializedViewFreshness(): Promise<void> {
    try {
      const viewMetrics = await databasePerformanceService.getMaterializedViewMetrics();
      const recommendations: string[] = [];

      for (const metric of viewMetrics) {
        const schedule = this.schedules.get(metric.viewName);
        if (!schedule) continue;

        const hoursSinceRefresh = (Date.now() - metric.lastRefreshed.getTime()) / (1000 * 60 * 60);

        // Update last refreshed time
        schedule.lastRefreshed = metric.lastRefreshed;

        // Generate recommendations
        if (hoursSinceRefresh > schedule.maxStaleHours) {
          recommendations.push(
            `${metric.viewName} is stale (${hoursSinceRefresh.toFixed(1)}h old)`
          );
        }

        if (metric.refreshInProgress) {
          recommendations.push(`${metric.viewName} refresh is currently in progress`);
        }

        if (!metric.isPopulated) {
          recommendations.push(`${metric.viewName} is not populated - needs initial refresh`);
        }
      }

      if (recommendations.length > 0) {
        console.log("Materialized view freshness assessment:", recommendations);
      }

      // Log assessment
      await this.logSchedulerEvent("freshness_assessment", {
        viewCount: viewMetrics.length,
        recommendations,
      });
    } catch (error) {
      console.error("Error assessing materialized view freshness:", error);
    }
  }

  /**
   * Update refresh schedule for a specific view
   */
  updateSchedule(viewName: string, updates: Partial<RefreshSchedule>): void {
    const schedule = this.schedules.get(viewName);
    if (!schedule) {
      throw new Error(`Schedule not found for view: ${viewName}`);
    }

    Object.assign(schedule, updates);
    console.log(`Updated schedule for ${viewName}:`, updates);
  }

  /**
   * Get current refresh statistics
   */
  getRefreshStatistics(): {
    totalRefreshes: number;
    successfulRefreshes: number;
    failedRefreshes: number;
    averageRefreshTime: number;
    activeRefreshCount: number;
    lastRefreshes: RefreshResult[];
  } {
    const totalRefreshes = this.refreshHistory.length;
    const successfulRefreshes = this.refreshHistory.filter((r) => r.success).length;
    const failedRefreshes = totalRefreshes - successfulRefreshes;

    const durations = this.refreshHistory.map((r) => r.duration);
    const averageRefreshTime =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const lastRefreshes = this.refreshHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalRefreshes,
      successfulRefreshes,
      failedRefreshes,
      averageRefreshTime,
      activeRefreshCount: this.activeRefreshes.size,
      lastRefreshes,
    };
  }

  /**
   * Force refresh all views (for manual execution)
   */
  async forceRefreshAll(): Promise<RefreshResult[]> {
    const results: RefreshResult[] = [];

    for (const [viewName, schedule] of this.schedules.entries()) {
      if (this.activeRefreshes.has(viewName)) {
        console.log(`Skipping ${viewName} - already refreshing`);
        continue;
      }

      try {
        await this.scheduleViewRefresh(viewName, schedule);
        results.push({
          viewName,
          success: true,
          duration: 0,
          timestamp: new Date(),
          retryAttempt: 0,
        });
      } catch (error) {
        results.push({
          viewName,
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
          retryAttempt: 0,
        });
      }
    }

    return results;
  }

  /**
   * Log scheduler events for monitoring
   */
  private async logSchedulerEvent(event: string, details: any): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO audit_logs (
          entity_type, entity_id, action, details, created_at
        ) VALUES (
          'materialized_view_scheduler',
          ${event},
          'scheduler_event',
          ${JSON.stringify({ ...details, timestamp: new Date() })},
          NOW()
        )
      `);
    } catch (error) {
      console.error("Error logging scheduler event:", error);
    }
  }

  /**
   * Get current schedules
   */
  getCurrentSchedules(): RefreshSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Clean up old refresh history (keep last 1000 entries)
   */
  cleanupHistory(): void {
    if (this.refreshHistory.length > 1000) {
      this.refreshHistory = this.refreshHistory
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 1000);
    }
  }
}

// Export singleton instance
export const materializedViewScheduler = new MaterializedViewScheduler();

// CLI interface for manual operations
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case "start":
      materializedViewScheduler
        .startScheduler()
        .then(() => console.log("Scheduler started"))
        .catch(console.error);
      break;

    case "stop":
      materializedViewScheduler
        .stopScheduler()
        .then(() => console.log("Scheduler stopped"))
        .catch(console.error);
      break;

    case "refresh-all":
      materializedViewScheduler
        .forceRefreshAll()
        .then((results) => {
          console.log("Refresh results:", results);
          process.exit(0);
        })
        .catch(console.error);
      break;

    case "status":
      console.log("Current statistics:", materializedViewScheduler.getRefreshStatistics());
      console.log("Current schedules:", materializedViewScheduler.getCurrentSchedules());
      process.exit(0);
      break;

    default:
      console.log("Usage: ts-node materialized-view-scheduler.ts [start|stop|refresh-all|status]");
      process.exit(1);
  }
}
