/**
 * Cron Job Monitoring
 *
 * Tracks scheduled job executions, success rates, and performance
 * for Cloudflare scheduled triggers.
 */

import { AuditCategory, AuditSeverity } from "@/types/audit.types";

import { logAuditEvent } from "../audit-logger";
import { getAlertSystem } from "./alert-system";

interface CronJobExecution {
  id: string;
  jobName: string;
  trigger: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: "running" | "success" | "failed" | "timeout";
  error?: string;
  metadata?: Record<string, any>;
}

interface CronJobStats {
  name: string;
  schedule: string;
  lastRun?: Date;
  nextRun: Date;
  successRate: number;
  avgDuration: number;
  totalRuns: number;
  failureCount: number;
  isHealthy: boolean;
}

interface CronJobDefinition {
  name: string;
  schedule: string; // Cron expression
  timeout: number; // Max execution time in ms
  critical: boolean; // Whether failures should trigger critical alerts
  description?: string;
}

export class CronMonitor {
  private executions = new Map<string, CronJobExecution[]>();
  private definitions = new Map<string, CronJobDefinition>();
  private alertSystem = getAlertSystem();
  private kvNamespace: KVNamespace | null = null;
  private runningJobs = new Map<string, CronJobExecution>();

  constructor(kvNamespace?: KVNamespace) {
    this.kvNamespace = kvNamespace || null;
    this.initializeDefaultJobs();
  }

  /**
   * Initialize monitoring for default cron jobs
   */
  private initializeDefaultJobs(): void {
    this.registerJob({
      name: "cleanup-guest-bookings",
      schedule: "0 * * * *", // Every hour
      timeout: 60000, // 1 minute
      critical: false,
      description: "Cleanup orphaned guest booking files",
    });

    this.registerJob({
      name: "bandwidth-check",
      schedule: "0 */6 * * *", // Every 6 hours
      timeout: 30000,
      critical: true,
      description: "Check bandwidth usage and alert if needed",
    });

    this.registerJob({
      name: "quota-reset",
      schedule: "0 0 * * *", // Daily at midnight
      timeout: 30000,
      critical: true,
      description: "Reset daily quotas for KV and email",
    });

    this.registerJob({
      name: "security-audit",
      schedule: "0 2 * * *", // Daily at 2 AM
      timeout: 120000,
      critical: false,
      description: "Run security audit and anomaly detection",
    });
  }

  /**
   * Register a cron job for monitoring
   */
  registerJob(definition: CronJobDefinition): void {
    this.definitions.set(definition.name, definition);
    if (!this.executions.has(definition.name)) {
      this.executions.set(definition.name, []);
    }
  }

  /**
   * Record the start of a cron job execution
   */
  async recordStart(jobName: string, trigger: string = "scheduled"): Promise<string> {
    const executionId = `${jobName}-${Date.now()}`;

    const execution: CronJobExecution = {
      id: executionId,
      jobName,
      trigger,
      startTime: new Date(),
      status: "running",
    };

    this.runningJobs.set(executionId, execution);

    // Store in KV for persistence
    if (this.kvNamespace) {
      await this.kvNamespace.put(`cron_execution:${executionId}`, JSON.stringify(execution), {
        expirationTtl: 24 * 60 * 60, // 1 day
      });
    }

    // Check for stuck jobs
    await this.checkStuckJobs(jobName);

    return executionId;
  }

  /**
   * Record the completion of a cron job execution
   */
  async recordComplete(
    executionId: string,
    success: boolean,
    metadata?: Record<string, any>,
    error?: string
  ): Promise<void> {
    const execution = this.runningJobs.get(executionId);
    if (!execution) return;

    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
    execution.status = success ? "success" : "failed";
    execution.error = error;
    execution.metadata = metadata;

    // Remove from running jobs
    this.runningJobs.delete(executionId);

    // Add to history
    const history = this.executions.get(execution.jobName) || [];
    history.push(execution);

    // Keep only last 100 executions per job
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    this.executions.set(execution.jobName, history);

    // Store in KV
    if (this.kvNamespace) {
      await this.kvNamespace.put(`cron_execution:${executionId}`, JSON.stringify(execution), {
        expirationTtl: 7 * 24 * 60 * 60, // 7 days
      });
    }

    // Log to audit trail
    const definition = this.definitions.get(execution.jobName);
    await logAuditEvent({
      tableName: "system",
      category: AuditCategory.SYSTEM,
      severity: success
        ? AuditSeverity.INFO
        : definition?.critical
          ? AuditSeverity.CRITICAL
          : AuditSeverity.WARNING,
      description: `Cron job ${execution.jobName}: ${success ? "completed" : "failed"}`,
      metadata: {
        executionId,
        duration: execution.duration,
        error,
        ...metadata,
      },
    });

    // Alert on failures
    if (!success) {
      await this.handleFailure(execution, definition);
    }
  }

  /**
   * Get statistics for all cron jobs
   */
  getStatistics(): CronJobStats[] {
    const stats: CronJobStats[] = [];

    for (const [name, definition] of this.definitions) {
      const history = this.executions.get(name) || [];
      const successful = history.filter((e) => e.status === "success");
      const failed = history.filter((e) => e.status === "failed");

      const lastRun = history.length > 0 ? history[history.length - 1].startTime : undefined;

      const avgDuration =
        successful.length > 0
          ? successful.reduce((sum, e) => sum + (e.duration || 0), 0) / successful.length
          : 0;

      const successRate = history.length > 0 ? (successful.length / history.length) * 100 : 100;

      // Calculate next run time based on cron expression
      const nextRun = this.calculateNextRun(definition.schedule, lastRun);

      // Check if job is healthy
      const isHealthy = this.isJobHealthy(name, history);

      stats.push({
        name,
        schedule: definition.schedule,
        lastRun,
        nextRun,
        successRate,
        avgDuration,
        totalRuns: history.length,
        failureCount: failed.length,
        isHealthy,
      });
    }

    return stats;
  }

  /**
   * Get execution history for a specific job
   */
  getHistory(jobName: string, limit: number = 10): CronJobExecution[] {
    const history = this.executions.get(jobName) || [];
    return history.slice(-limit);
  }

  /**
   * Check if any jobs are overdue
   */
  async checkOverdueJobs(): Promise<void> {
    const now = new Date();

    for (const [name, definition] of this.definitions) {
      const history = this.executions.get(name) || [];
      const lastRun = history.length > 0 ? history[history.length - 1].startTime : undefined;

      const nextRun = this.calculateNextRun(definition.schedule, lastRun);

      // Check if job is overdue by more than 5 minutes
      if (nextRun < now && now.getTime() - nextRun.getTime() > 5 * 60 * 1000) {
        this.alertSystem.trigger({
          id: `cron-overdue-${name}-${Date.now()}`,
          source: "cron-monitor",
          level: definition.critical ? "critical" : "warning",
          title: `Cron job overdue: ${name}`,
          message: `Job ${name} is ${Math.floor((now.getTime() - nextRun.getTime()) / 60000)} minutes overdue`,
          metadata: {
            jobName: name,
            expectedTime: nextRun,
            lastRun,
          },
          timestamp: new Date(),
          acknowledged: false,
        });
      }
    }
  }

  /**
   * Get detailed analytics for dashboard
   */
  async getAnalytics(): Promise<{
    totalJobs: number;
    healthyJobs: number;
    runningJobs: number;
    failureRate24h: number;
    avgDuration24h: number;
    topFailures: { name: string; count: number }[];
    upcomingJobs: { name: string; time: Date }[];
  }> {
    const stats = this.getStatistics();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get 24h executions
    let total24h = 0;
    let failures24h = 0;
    let totalDuration24h = 0;
    const failureCount = new Map<string, number>();

    for (const [name, history] of this.executions) {
      const recent = history.filter((e) => e.startTime > dayAgo);
      total24h += recent.length;

      const recentFailures = recent.filter((e) => e.status === "failed");
      failures24h += recentFailures.length;

      if (recentFailures.length > 0) {
        failureCount.set(name, recentFailures.length);
      }

      const durations = recent.filter((e) => e.duration).map((e) => e.duration!);

      if (durations.length > 0) {
        totalDuration24h += durations.reduce((sum, d) => sum + d, 0);
      }
    }

    const failureRate24h = total24h > 0 ? (failures24h / total24h) * 100 : 0;
    const avgDuration24h = total24h > 0 ? totalDuration24h / total24h : 0;

    const topFailures = Array.from(failureCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const upcomingJobs = stats
      .map((s) => ({ name: s.name, time: s.nextRun }))
      .sort((a, b) => a.time.getTime() - b.time.getTime())
      .slice(0, 5);

    return {
      totalJobs: this.definitions.size,
      healthyJobs: stats.filter((s) => s.isHealthy).length,
      runningJobs: this.runningJobs.size,
      failureRate24h,
      avgDuration24h,
      topFailures,
      upcomingJobs,
    };
  }

  private async checkStuckJobs(jobName: string): Promise<void> {
    const definition = this.definitions.get(jobName);
    if (!definition) return;

    // Check for jobs running longer than timeout
    for (const [id, execution] of this.runningJobs) {
      if (execution.jobName !== jobName) continue;

      const runtime = Date.now() - execution.startTime.getTime();
      if (runtime > definition.timeout) {
        // Mark as timeout
        execution.status = "timeout";
        execution.endTime = new Date();
        execution.duration = runtime;

        // Alert
        this.alertSystem.trigger({
          id: `cron-timeout-${id}`,
          source: "cron-monitor",
          level: definition.critical ? "critical" : "warning",
          title: `Cron job timeout: ${jobName}`,
          message: `Job ${jobName} exceeded timeout of ${definition.timeout}ms`,
          metadata: {
            executionId: id,
            runtime,
            timeout: definition.timeout,
          },
          timestamp: new Date(),
          acknowledged: false,
        });

        // Remove from running
        this.runningJobs.delete(id);
      }
    }
  }

  private async handleFailure(
    execution: CronJobExecution,
    _definition?: CronJobDefinition
  ): Promise<void> {
    // Check for repeated failures
    const history = this.executions.get(execution.jobName) || [];
    const recentFailures = history.slice(-5).filter((e) => e.status === "failed");

    if (recentFailures.length >= 3) {
      this.alertSystem.trigger({
        id: `cron-repeated-failures-${execution.jobName}-${Date.now()}`,
        source: "cron-monitor",
        level: "critical",
        title: `Repeated cron failures: ${execution.jobName}`,
        message: `Job ${execution.jobName} has failed ${recentFailures.length} times in the last 5 runs`,
        metadata: {
          jobName: execution.jobName,
          failures: recentFailures.length,
          lastError: execution.error,
        },
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }

  private isJobHealthy(name: string, history: CronJobExecution[]): boolean {
    if (history.length === 0) return true;

    // Check recent executions
    const recent = history.slice(-10);
    const failures = recent.filter((e) => e.status === "failed" || e.status === "timeout");

    // Unhealthy if >30% failures
    if (failures.length / recent.length > 0.3) return false;

    // Check for current stuck jobs
    for (const running of this.runningJobs.values()) {
      if (running.jobName === name) {
        const definition = this.definitions.get(name);
        if (definition) {
          const runtime = Date.now() - running.startTime.getTime();
          if (runtime > definition.timeout * 1.5) return false;
        }
      }
    }

    return true;
  }

  private calculateNextRun(schedule: string, _lastRun?: Date): Date {
    // Simple cron parser for common patterns
    const now = new Date();
    const parts = schedule.split(" ");

    if (parts.length !== 5) {
      return new Date(now.getTime() + 60 * 60 * 1000); // Default to 1 hour
    }

    const [minute, hour, dayOfMonth, _month, _dayOfWeek] = parts;

    // Handle hourly (0 * * * *)
    if (hour === "*" && minute !== "*") {
      const next = new Date(now);
      next.setMinutes(parseInt(minute), 0, 0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
      return next;
    }

    // Handle daily (0 0 * * *)
    if (hour !== "*" && minute !== "*" && dayOfMonth === "*") {
      const next = new Date(now);
      next.setHours(parseInt(hour), parseInt(minute), 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }

    // Handle every N hours (0 */N * * *)
    if (hour.startsWith("*/")) {
      const interval = parseInt(hour.substring(2));
      const next = new Date(now);
      next.setMinutes(parseInt(minute), 0, 0);
      const currentHour = next.getHours();
      const nextHour = Math.ceil(currentHour / interval) * interval;
      next.setHours(nextHour);
      if (next <= now) {
        next.setHours(next.getHours() + interval);
      }
      return next;
    }

    // Default: next hour
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
}

// Export for use in Cloudflare Workers
export const cronMonitor = new CronMonitor();
