/**
 * Centralized Alert System for Monitoring
 *
 * Manages alerts from various monitoring sources and provides
 * unified notification and escalation mechanisms.
 */

import { logger } from "@/lib/logger";
import { AuditCategory, AuditSeverity } from "@/types/audit.types";

import { logAuditEvent } from "../audit-logger";

export type AlertLevel = "info" | "warning" | "critical" | "resolved";

export interface Alert {
  id: string;
  source: string;
  level: AlertLevel;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface AlertThreshold {
  metric: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq";
  value: number;
  level: AlertLevel;
  message: string;
}

export interface AlertChannel {
  name: string;
  type: "console" | "audit" | "email" | "webhook";
  enabled: boolean;
  config?: Record<string, unknown>;
}

export class AlertSystem {
  private alerts: Map<string, Alert> = new Map();
  private channels: AlertChannel[] = [];
  private thresholds: Map<string, AlertThreshold[]> = new Map();
  private subscribers: ((alert: Alert) => void)[] = [];
  private alertHistory: Alert[] = [];
  private maxHistorySize = 1000;

  constructor(channels?: AlertChannel[]) {
    // Default channels
    this.channels = channels || [
      { name: "console", type: "console", enabled: true },
      { name: "audit", type: "audit", enabled: true },
    ];
  }

  /**
   * Register a new alert threshold
   */
  registerThreshold(threshold: AlertThreshold): void {
    const existing = this.thresholds.get(threshold.metric) || [];
    existing.push(threshold);
    this.thresholds.set(threshold.metric, existing);
  }

  /**
   * Check if a metric value triggers any thresholds
   */
  checkThresholds(metric: string, value: number): Alert | null {
    const thresholds = this.thresholds.get(metric) || [];

    for (const threshold of thresholds) {
      if (this.evaluateThreshold(value, threshold)) {
        const alert: Alert = {
          id: `${metric}-${Date.now()}`,
          source: "threshold",
          level: threshold.level,
          title: `${metric} threshold exceeded`,
          message: threshold.message.replace("{value}", value.toString()),
          metadata: {
            metric,
            value,
            threshold: threshold.value,
            operator: threshold.operator,
          },
          timestamp: new Date(),
          acknowledged: false,
        };

        return this.trigger(alert);
      }
    }

    return null;
  }

  /**
   * Trigger a new alert
   */
  trigger(alert: Alert): Alert {
    // Check if there's an existing unresolved alert for the same source
    const existingKey = `${alert.source}-${alert.title}`;
    const existing = this.alerts.get(existingKey);

    if (existing && !existing.resolvedAt) {
      // Update existing alert if severity increased
      if (this.getSeverityLevel(alert.level) > this.getSeverityLevel(existing.level)) {
        existing.level = alert.level;
        existing.message = alert.message;
        existing.timestamp = alert.timestamp;
        this.notifyChannels(existing);
        return existing;
      }
      return existing;
    }

    // Store new alert
    this.alerts.set(existingKey, alert);
    this.alertHistory.push(alert);

    // Trim history if needed
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
    }

    // Notify channels
    this.notifyChannels(alert);

    // Notify subscribers
    this.subscribers.forEach((callback) => {
      try {
        callback(alert);
      } catch (error) {
        console.error("Alert subscriber failed:", error);
      }
    });

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolve(alertId: string, reason?: string): void {
    const alert = Array.from(this.alerts.values()).find((a) => a.id === alertId);

    if (alert && !alert.resolvedAt) {
      alert.resolvedAt = new Date();
      alert.level = "resolved";

      const resolvedAlert: Alert = {
        ...alert,
        message: reason || `Alert resolved: ${alert.message}`,
        metadata: {
          ...alert.metadata,
          resolvedReason: reason,
        },
      };

      this.notifyChannels(resolvedAlert);
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledge(alertId: string): void {
    const alert = Array.from(this.alerts.values()).find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.resolvedAt);
  }

  /**
   * Get alert history
   */
  getHistory(limit?: number): Alert[] {
    if (limit) {
      return this.alertHistory.slice(-limit);
    }
    return [...this.alertHistory];
  }

  /**
   * Subscribe to alerts
   */
  subscribe(callback: (alert: Alert) => void): () => void {
    this.subscribers.push(callback);

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Add a notification channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * Get alert statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    byLevel: Record<AlertLevel, number>;
    bySource: Record<string, number>;
    averageResolutionTime: number;
  } {
    const active = this.getActiveAlerts();
    const byLevel: Record<AlertLevel, number> = {
      info: 0,
      warning: 0,
      critical: 0,
      resolved: 0,
    };
    const bySource: Record<string, number> = {};
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    this.alertHistory.forEach((alert) => {
      byLevel[alert.level]++;

      if (!bySource[alert.source]) {
        bySource[alert.source] = 0;
      }
      bySource[alert.source]++;

      if (alert.resolvedAt) {
        resolvedCount++;
        totalResolutionTime += alert.resolvedAt.getTime() - alert.timestamp.getTime();
      }
    });

    return {
      total: this.alertHistory.length,
      active: active.length,
      byLevel,
      bySource,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    };
  }

  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case "gt":
        return value > threshold.value;
      case "lt":
        return value < threshold.value;
      case "gte":
        return value >= threshold.value;
      case "lte":
        return value <= threshold.value;
      case "eq":
        return value === threshold.value;
      default:
        return false;
    }
  }

  private getSeverityLevel(level: AlertLevel): number {
    const levels = {
      resolved: 0,
      info: 1,
      warning: 2,
      critical: 3,
    };
    return levels[level] || 0;
  }

  private async notifyChannels(alert: Alert): Promise<void> {
    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case "console":
            this.logToConsole(alert);
            break;
          case "audit":
            await this.logToAudit(alert);
            break;
          case "email":
            await this.sendEmail(alert, channel.config);
            break;
          case "webhook":
            await this.sendWebhook(alert, channel.config);
            break;
        }
      } catch (error) {
        console.error(`Failed to notify channel ${channel.name}:`, error);
      }
    }
  }

  private logToConsole(alert: Alert): void {
    const method =
      alert.level === "critical"
        ? "error"
        : alert.level === "warning"
          ? "warn"
          : alert.level === "info"
            ? "info"
            : "log";

    // eslint-disable-next-line no-console
    console[method](
      `[${alert.level.toUpperCase()}] ${alert.source}: ${alert.message}`,
      alert.metadata
    );
  }

  private async logToAudit(alert: Alert): Promise<void> {
    const severity =
      alert.level === "critical"
        ? AuditSeverity.CRITICAL
        : alert.level === "warning"
          ? AuditSeverity.WARNING
          : alert.level === "info"
            ? AuditSeverity.INFO
            : AuditSeverity.INFO;

    await logAuditEvent({
      tableName: "system",
      category: AuditCategory.SYSTEM,
      severity,
      description: `Monitoring alert: ${alert.message}`,
      metadata: {
        alertId: alert.id,
        source: alert.source,
        level: alert.level,
        ...alert.metadata,
      },
    });
  }

  private async sendEmail(alert: Alert, _config?: Record<string, unknown>): Promise<void> {
    // Email implementation would go here
    // This would use Resend or another email service
    logger.info("Email alert not implemented:", { message: alert.message });
  }

  private async sendWebhook(alert: Alert, config?: Record<string, unknown>): Promise<void> {
    if (!config?.url) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await fetch(config.url as any, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Webhook failed:", error);
    }
  }
}

// Singleton instance for global use
let alertSystemInstance: AlertSystem | null = null;

export function getAlertSystem(): AlertSystem {
  if (!alertSystemInstance) {
    alertSystemInstance = new AlertSystem();

    // Register default thresholds
    alertSystemInstance.registerThreshold({
      metric: "bandwidth_percentage",
      operator: "gte",
      value: 80,
      level: "warning",
      message: "Bandwidth usage at {value}%",
    });

    alertSystemInstance.registerThreshold({
      metric: "bandwidth_percentage",
      operator: "gte",
      value: 95,
      level: "critical",
      message: "Critical: Bandwidth usage at {value}%",
    });

    alertSystemInstance.registerThreshold({
      metric: "kv_writes_percentage",
      operator: "gte",
      value: 80,
      level: "warning",
      message: "KV writes at {value}% of daily limit",
    });

    alertSystemInstance.registerThreshold({
      metric: "email_quota_percentage",
      operator: "gte",
      value: 90,
      level: "warning",
      message: "Email quota at {value}% of daily limit",
    });
  }

  return alertSystemInstance;
}
