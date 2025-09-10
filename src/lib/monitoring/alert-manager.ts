/**
 * Multi-Channel Alert Manager
 * Phase 5.4: Monitoring Setup - Intelligent alerting system for resort operations
 */

export interface Alert {
  id: string;
  type: "error" | "warning" | "info" | "critical";
  title: string;
  message: string;
  source: string;
  severity: 1 | 2 | 3 | 4 | 5; // 1 = info, 5 = critical
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  timeWindow: number; // in seconds
  severity: Alert["severity"];
  enabled: boolean;
  channels: ("email" | "slack" | "webhook" | "push")[];
  recipients: string[];
  cooldownPeriod: number; // seconds between alerts
  description?: string;
}

export interface NotificationChannel {
  type: "email" | "slack" | "webhook" | "push";
  config: Record<string, any>;
  enabled: boolean;
}

interface MetricSnapshot {
  performance?: {
    errorRate: number;
    averageResponseTime: number;
    requestsPerMinute: number;
  };
  health?: {
    overall: string;
    checks: Array<{
      service: string;
      status: string;
      responseTime: number;
    }>;
  };
  infrastructure?: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage?: number;
  };
  business?: {
    failedOperations: number;
    activeUsers: number;
  };
}

export class ResortAlertManager {
  private static instance: ResortAlertManager;
  private rules: Map<string, AlertRule> = new Map();
  private channels: Map<string, NotificationChannel> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private alertHistory: Alert[] = [];

  private constructor() {
    this.initializeDefaultRules();
    this.initializeNotificationChannels();
  }

  public static getInstance(): ResortAlertManager {
    if (!ResortAlertManager.instance) {
      ResortAlertManager.instance = new ResortAlertManager();
    }
    return ResortAlertManager.instance;
  }

  /**
   * Initialize default alert rules for resort operations
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: "critical_error_rate",
        name: "Critical Error Rate",
        condition: "error_rate > threshold",
        threshold: 5.0, // 5% error rate
        timeWindow: 300, // 5 minutes
        severity: 5,
        enabled: true,
        channels: ["email", "slack"],
        recipients: ["admin@okaeri-resort.local"],
        cooldownPeriod: 600, // 10 minutes
        description: "Triggers when error rate exceeds 5% over 5 minutes",
      },
      {
        id: "response_time_degradation",
        name: "Response Time Degradation",
        condition: "avg_response_time > threshold",
        threshold: 3000, // 3 seconds
        timeWindow: 600, // 10 minutes
        severity: 3,
        enabled: true,
        channels: ["slack"],
        recipients: ["#dev-alerts"],
        cooldownPeriod: 300, // 5 minutes
        description: "Alerts when average response time exceeds 3 seconds",
      },
      {
        id: "database_connection_failure",
        name: "Database Connection Failure",
        condition: "database_health == unhealthy",
        threshold: 1,
        timeWindow: 60, // 1 minute
        severity: 5,
        enabled: true,
        channels: ["email", "slack"],
        recipients: ["admin@okaeri-resort.local", "#critical-alerts"],
        cooldownPeriod: 120, // 2 minutes
        description: "Critical alert for database connectivity issues",
      },
      {
        id: "memory_usage_high",
        name: "High Memory Usage",
        condition: "memory_usage_percent > threshold",
        threshold: 85,
        timeWindow: 300, // 5 minutes
        severity: 3,
        enabled: true,
        channels: ["slack"],
        recipients: ["#system-alerts"],
        cooldownPeriod: 600, // 10 minutes
        description: "Warns when memory usage exceeds 85%",
      },
      {
        id: "booking_system_errors",
        name: "Booking System Errors",
        condition: "booking_errors > threshold",
        threshold: 3,
        timeWindow: 300, // 5 minutes
        severity: 4,
        enabled: true,
        channels: ["email", "slack"],
        recipients: ["operations@okaeri-resort.local"],
        cooldownPeriod: 180, // 3 minutes
        description: "Critical booking system functionality alert",
      },
      {
        id: "expense_logging_failures",
        name: "Expense Logging Failures",
        condition: "expense_errors > threshold",
        threshold: 2,
        timeWindow: 600, // 10 minutes
        severity: 3,
        enabled: true,
        channels: ["slack"],
        recipients: ["#operations"],
        cooldownPeriod: 300, // 5 minutes
        description: "Alerts for expense logging system issues",
      },
      {
        id: "authentication_failures",
        name: "Authentication Failures",
        condition: "auth_failures > threshold",
        threshold: 10,
        timeWindow: 300, // 5 minutes
        severity: 4,
        enabled: true,
        channels: ["email", "slack"],
        recipients: ["security@okaeri-resort.local"],
        cooldownPeriod: 300, // 5 minutes
        description: "Security alert for authentication failures",
      },
    ];

    defaultRules.forEach((rule) => {
      this.rules.set(rule.id, rule);
    });

    console.log("✅ Alert rules initialized:", this.rules.size, "rules");
  }

  /**
   * Initialize notification channels
   */
  private initializeNotificationChannels(): void {
    // Email channel (using Vercel's built-in email or configured SMTP)
    this.channels.set("email", {
      type: "email",
      config: {
        from: "alerts@okaeri-resort.local",
        smtp: process.env.SMTP_HOST
          ? {
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT || "587"),
              secure: false,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            }
          : null,
      },
      enabled: true,
    });

    // Slack channel (using webhooks)
    this.channels.set("slack", {
      type: "slack",
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        defaultChannel: "#alerts",
        username: "Okaeri Alert Bot",
        iconEmoji: ":warning:",
      },
      enabled: !!process.env.SLACK_WEBHOOK_URL,
    });

    // Webhook channel for custom integrations
    this.channels.set("webhook", {
      type: "webhook",
      config: {
        url: process.env.ALERT_WEBHOOK_URL,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.WEBHOOK_AUTH_TOKEN
            ? `Bearer ${process.env.WEBHOOK_AUTH_TOKEN}`
            : undefined,
        },
      },
      enabled: !!process.env.ALERT_WEBHOOK_URL,
    });

    // Browser push notifications (for logged-in users)
    this.channels.set("push", {
      type: "push",
      config: {
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
      },
      enabled: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    });

    console.log("✅ Notification channels initialized:", Array.from(this.channels.keys()));
  }

  /**
   * Evaluate alert conditions against current metrics
   */
  public async evaluateAlerts(metrics: MetricSnapshot): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      const cooldownKey = `alert_cooldown:${rule.id}`;
      const lastAlertTime = this.cooldowns.get(cooldownKey) || 0;
      if (Date.now() - lastAlertTime < rule.cooldownPeriod * 1000) {
        continue; // Still in cooldown
      }

      const shouldAlert = this.evaluateRule(rule, metrics);

      if (shouldAlert) {
        const alert = await this.createAlert(rule, metrics);
        triggeredAlerts.push(alert);

        // Set cooldown
        this.cooldowns.set(cooldownKey, Date.now());

        // Send notifications
        await this.sendAlert(alert, rule);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Evaluate a specific rule against metrics
   */
  private evaluateRule(rule: AlertRule, metrics: MetricSnapshot): boolean {
    switch (rule.id) {
      case "critical_error_rate":
        return (metrics.performance?.errorRate || 0) > rule.threshold;

      case "response_time_degradation":
        return (metrics.performance?.averageResponseTime || 0) > rule.threshold;

      case "database_connection_failure":
        return (
          metrics.health?.checks?.some(
            (check) => check.service === "database" && check.status === "unhealthy"
          ) || false
        );

      case "memory_usage_high":
        return (metrics.infrastructure?.memoryUsage || 0) > rule.threshold;

      case "booking_system_errors":
        // Would check specific booking error metrics
        return false; // Placeholder - implement based on actual metrics

      case "expense_logging_failures":
        // Would check specific expense logging error metrics
        return false; // Placeholder - implement based on actual metrics

      case "authentication_failures":
        // Would check authentication failure metrics
        return false; // Placeholder - implement based on actual metrics

      default:
        return false;
    }
  }

  /**
   * Create an alert from a triggered rule
   */
  private async createAlert(rule: AlertRule, metrics: MetricSnapshot): Promise<Alert> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.mapSeverityToType(rule.severity),
      title: rule.name,
      message: this.generateAlertMessage(rule, metrics),
      source: "resort_monitoring_system",
      severity: rule.severity,
      timestamp: Date.now(),
      resolved: false,
      tags: ["automated", "monitoring", "resort_operations"],
      metadata: {
        ruleId: rule.id,
        metrics: metrics,
        threshold: rule.threshold,
        timeWindow: rule.timeWindow,
      },
    };

    // Store in history
    this.alertHistory.unshift(alert);

    // Keep only last 100 alerts in memory
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(0, 100);
    }

    // Store in Redis if available
    if (typeof window === "undefined" && process.env.UPSTASH_REDIS_REST_URL) {
      try {
        await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/setex/alert:${alert.id}/86400`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([JSON.stringify(alert)]),
        });
      } catch (error) {
        console.warn("Failed to store alert in Redis:", error);
      }
    }

    return alert;
  }

  /**
   * Map severity level to alert type
   */
  private mapSeverityToType(severity: number): Alert["type"] {
    if (severity >= 5) return "critical";
    if (severity >= 4) return "error";
    if (severity >= 3) return "warning";
    return "info";
  }

  /**
   * Generate alert message based on rule and metrics
   */
  private generateAlertMessage(rule: AlertRule, metrics: MetricSnapshot): string {
    switch (rule.id) {
      case "critical_error_rate":
        return `Error rate has exceeded ${rule.threshold}%. Current rate: ${metrics.performance?.errorRate || 0}%`;

      case "response_time_degradation":
        return `Average response time has increased to ${metrics.performance?.averageResponseTime || 0}ms (threshold: ${rule.threshold}ms)`;

      case "database_connection_failure":
        return "Database connection health check failed. Resort operations may be affected. Immediate attention required.";

      case "memory_usage_high":
        return `Memory usage is at ${metrics.infrastructure?.memoryUsage || 0}% (threshold: ${rule.threshold}%)`;

      case "booking_system_errors":
        return `Multiple booking system errors detected in the last ${rule.timeWindow / 60} minutes. Guest services may be impacted.`;

      case "expense_logging_failures":
        return `Expense logging system experiencing issues. Financial tracking may be affected.`;

      case "authentication_failures":
        return `High number of authentication failures detected. Possible security concern.`;

      default:
        return `Alert condition met for rule: ${rule.name}`;
    }
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: Alert, rule: AlertRule): Promise<void> {
    const sendPromises = rule.channels.map(async (channelType) => {
      const channel = this.channels.get(channelType);
      if (!channel || !channel.enabled) {
        console.warn(`Channel ${channelType} not available or disabled`);
        return;
      }

      try {
        switch (channelType) {
          case "email":
            await this.sendEmailAlert(alert, rule.recipients, channel);
            break;

          case "slack":
            await this.sendSlackAlert(alert, rule.recipients, channel);
            break;

          case "webhook":
            await this.sendWebhookAlert(alert, rule.recipients, channel);
            break;

          case "push":
            await this.sendPushAlert(alert, rule.recipients, channel);
            break;

          default:
            console.warn(`Unknown channel type: ${channelType}`);
        }
      } catch (error) {
        console.error(`Failed to send ${channelType} alert:`, error);
      }
    });

    await Promise.allSettled(sendPromises);

    console.log("🚨 Alert sent:", {
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      channels: rule.channels,
    });
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(
    alert: Alert,
    recipients: string[],
    channel: NotificationChannel
  ): Promise<void> {
    // This would integrate with your email service
    // For now, log the email content
    const emailContent = this.generateEmailContent(alert);

    console.log("📧 Email alert would be sent to:", recipients, {
      subject: `[${alert.type.toUpperCase()}] ${alert.title}`,
      content: emailContent,
    });

    // TODO: Implement actual email sending
    // This could use Vercel's email service, SendGrid, or SMTP
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(
    alert: Alert,
    recipients: string[],
    channel: NotificationChannel
  ): Promise<void> {
    const webhookUrl = channel.config.webhookUrl;
    if (!webhookUrl) {
      throw new Error("Slack webhook URL not configured");
    }

    const payload = {
      username: channel.config.username || "Okaeri Alert Bot",
      icon_emoji: channel.config.iconEmoji || ":warning:",
      text: `🚨 *${alert.title}*`,
      attachments: [
        {
          color: this.getSlackColor(alert.severity),
          fields: [
            {
              title: "Message",
              value: alert.message,
              short: false,
            },
            {
              title: "Severity",
              value: this.getSeverityText(alert.severity),
              short: true,
            },
            {
              title: "Time",
              value: new Date(alert.timestamp).toLocaleString("en-PH"),
              short: true,
            },
            {
              title: "Alert ID",
              value: alert.id,
              short: true,
            },
          ],
          footer: "Okaeri Resort Monitoring",
          ts: Math.floor(alert.timestamp / 1000),
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("💬 Slack alert sent to webhook");
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(
    alert: Alert,
    recipients: string[],
    channel: NotificationChannel
  ): Promise<void> {
    const webhookUrl = channel.config.url;
    if (!webhookUrl) {
      throw new Error("Webhook URL not configured");
    }

    const payload = {
      alert,
      recipients,
      timestamp: Date.now(),
      source: "okaeri_resort_monitoring",
    };

    await fetch(webhookUrl, {
      method: channel.config.method || "POST",
      headers: channel.config.headers || { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("🔗 Webhook alert sent");
  }

  /**
   * Send browser push notification
   */
  private async sendPushAlert(
    alert: Alert,
    recipients: string[],
    channel: NotificationChannel
  ): Promise<void> {
    // Browser push notifications would be implemented here
    // This requires service worker integration and user subscription management
    console.log("📱 Push notification would be sent for alert:", alert.id);
  }

  /**
   * Generate email content
   */
  private generateEmailContent(alert: Alert): string {
    return `
Dear Resort Operations Team,

An alert has been triggered in the Okaeri Resort Management System:

Alert: ${alert.title}
Severity: ${this.getSeverityText(alert.severity)}
Time: ${new Date(alert.timestamp).toLocaleString("en-PH")}

Message:
${alert.message}

Alert ID: ${alert.id}

Please investigate this issue promptly to ensure smooth resort operations.

---
Okaeri Resort Monitoring System
This is an automated alert. Do not reply to this email.
    `.trim();
  }

  /**
   * Get Slack color based on severity
   */
  private getSlackColor(severity: number): string {
    switch (severity) {
      case 5:
        return "danger"; // Critical
      case 4:
        return "warning"; // Error
      case 3:
        return "warning"; // Warning
      default:
        return "good"; // Info
    }
  }

  /**
   * Get human-readable severity text
   */
  private getSeverityText(severity: number): string {
    switch (severity) {
      case 5:
        return "🔴 Critical";
      case 4:
        return "🟠 Error";
      case 3:
        return "🟡 Warning";
      case 2:
        return "🔵 Info";
      default:
        return "⚪ Low";
    }
  }

  /**
   * Get alert history
   */
  public getAlertHistory(): Alert[] {
    return [...this.alertHistory];
  }

  /**
   * Resolve an alert
   */
  public async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alertHistory.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
    }

    // Update in Redis if available
    if (typeof window === "undefined" && process.env.UPSTASH_REDIS_REST_URL) {
      try {
        const updatedAlert = { ...alert, resolved: true, resolvedAt: Date.now() };
        await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/setex/alert:${alertId}/86400`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([JSON.stringify(updatedAlert)]),
        });
      } catch (error) {
        console.warn("Failed to update alert in Redis:", error);
      }
    }
  }

  /**
   * Get alert rules configuration
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Update alert rule
   */
  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      const updatedRule = { ...rule, ...updates };
      this.rules.set(ruleId, updatedRule);
    }
  }
}
