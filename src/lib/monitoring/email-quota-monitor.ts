/**
 * Resend Email Quota Monitoring
 *
 * Tracks email sends against free tier limits (100 emails/day)
 * and provides usage analytics and alerts.
 */

import { getAlertSystem, Alert } from "./alert-system";
import { logAuditEvent } from "../audit-logger-workers";
import { AuditCategory, AuditSeverity, EventType } from "@/database.types";

interface EmailUsageStats {
  sentCount: number;
  sentLimit: number;
  percentage: number;
  period: string;
  failedCount: number;
  avgDeliveryTime: number;
  lastUpdated: Date;
}

interface EmailEvent {
  id: string;
  type: "sent" | "delivered" | "bounced" | "failed" | "complaint";
  recipient: string;
  subject?: string;
  timestamp: Date;
  deliveryTime?: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface EmailTemplate {
  name: string;
  sentCount: number;
  successRate: number;
  avgDeliveryTime: number;
}

// Free tier limits
const EMAIL_LIMITS = {
  DAILY_SENDS: 100,
  WARNING_THRESHOLD: 0.8, // Alert at 80%
  CRITICAL_THRESHOLD: 0.95, // Critical at 95%
  MAX_RECIPIENTS_PER_EMAIL: 50,
  RATE_LIMIT: 10, // emails per second
};

export class EmailQuotaMonitor {
  private events: EmailEvent[] = [];
  private alertSystem = getAlertSystem();
  private kvNamespace: KVNamespace | null = null;
  private lastSendTime = 0;
  private sendQueue: (() => Promise<void>)[] = [];

  constructor(kvNamespace?: KVNamespace) {
    this.kvNamespace = kvNamespace || null;
  }

  /**
   * Track an email event
   */
  async trackEmailEvent(event: EmailEvent): Promise<void> {
    this.events.push(event);

    // Clean up old events (keep only last 7 days)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.events = this.events.filter((e) => e.timestamp > cutoff);

    // Check quota if it's a send event
    if (event.type === "sent") {
      await this.checkEmailQuota();
    }

    // Track failed emails
    if (event.type === "failed" || event.type === "bounced") {
      await this.handleFailedEmail(event);
    }

    // Track complaints
    if (event.type === "complaint") {
      await this.handleComplaint(event);
    }
  }

  /**
   * Get current usage statistics
   */
  async getCurrentUsage(): Promise<EmailUsageStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count today's sends
    const todayEvents = this.events.filter((e) => e.timestamp >= todayStart);
    const sentCount = todayEvents.filter((e) => e.type === "sent").length;
    const failedCount = todayEvents.filter(
      (e) => e.type === "failed" || e.type === "bounced"
    ).length;

    // Calculate average delivery time
    const deliveredEvents = todayEvents.filter((e) => e.type === "delivered" && e.deliveryTime);
    const avgDeliveryTime =
      deliveredEvents.length > 0
        ? deliveredEvents.reduce((sum, e) => sum + (e.deliveryTime || 0), 0) /
          deliveredEvents.length
        : 0;

    const percentage = (sentCount / EMAIL_LIMITS.DAILY_SENDS) * 100;

    return {
      sentCount,
      sentLimit: EMAIL_LIMITS.DAILY_SENDS,
      percentage,
      period: this.getCurrentPeriod(),
      failedCount,
      avgDeliveryTime,
      lastUpdated: new Date(),
    };
  }

  /**
   * Check email quota and trigger alerts if needed
   */
  async checkEmailQuota(): Promise<Alert | null> {
    const usage = await this.getCurrentUsage();

    // Check thresholds
    const alert = this.alertSystem.checkThresholds("email_quota_percentage", usage.percentage);

    if (alert) {
      await logAuditEvent({
        action: "email_quota_alert" as EventType,
        category: AuditCategory.SYSTEM,
        severity: alert.level === "critical" ? AuditSeverity.CRITICAL : AuditSeverity.WARNING,
        description: `Email quota at ${usage.percentage.toFixed(1)}%`,
        metadata: {
          sentCount: usage.sentCount,
          sentLimit: usage.sentLimit,
          percentage: usage.percentage,
          failedCount: usage.failedCount,
        },
      });
    }

    // Enable quota protection if critical
    if (usage.percentage >= EMAIL_LIMITS.CRITICAL_THRESHOLD * 100) {
      await this.enableQuotaProtection();
    }

    return alert;
  }

  /**
   * Check if email can be sent (respects quota and rate limits)
   */
  async canSendEmail(): Promise<{ allowed: boolean; reason?: string }> {
    const usage = await this.getCurrentUsage();

    // Check daily quota
    if (usage.sentCount >= EMAIL_LIMITS.DAILY_SENDS) {
      return {
        allowed: false,
        reason: "Daily email quota exceeded",
      };
    }

    // Check if quota protection is enabled
    const protected = await this.isQuotaProtected();
    if (protected) {
      return {
        allowed: false,
        reason: "Email quota protection enabled",
      };
    }

    // Check rate limit
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSendTime;
    const minInterval = 1000 / EMAIL_LIMITS.RATE_LIMIT; // milliseconds

    if (timeSinceLastSend < minInterval) {
      return {
        allowed: false,
        reason: "Rate limit exceeded",
      };
    }

    return { allowed: true };
  }

  /**
   * Queue an email send with rate limiting
   */
  async queueEmail(sendFn: () => Promise<void>): Promise<void> {
    const canSend = await this.canSendEmail();

    if (!canSend.allowed) {
      throw new Error(canSend.reason);
    }

    // Add to queue
    this.sendQueue.push(sendFn);

    // Process queue
    await this.processQueue();
  }

  /**
   * Get detailed statistics for dashboard
   */
  async getDetailedStats(): Promise<{
    current: EmailUsageStats;
    hourlyBreakdown: { hour: number; sent: number; failed: number; delivered: number }[];
    templateStats: EmailTemplate[];
    recentFailures: EmailEvent[];
    deliveryRate: number;
    bounceRate: number;
  }> {
    const current = await this.getCurrentUsage();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Hourly breakdown
    const hourlyBreakdown = [];
    for (let hour = 0; hour <= now.getHours(); hour++) {
      const hourStart = new Date(todayStart.getTime() + hour * 60 * 60 * 1000);
      const hourEnd = new Date(todayStart.getTime() + (hour + 1) * 60 * 60 * 1000);

      const hourEvents = this.events.filter(
        (e) => e.timestamp >= hourStart && e.timestamp < hourEnd
      );

      hourlyBreakdown.push({
        hour,
        sent: hourEvents.filter((e) => e.type === "sent").length,
        failed: hourEvents.filter((e) => e.type === "failed").length,
        delivered: hourEvents.filter((e) => e.type === "delivered").length,
      });
    }

    // Template statistics
    const templateMap = new Map<string, EmailTemplate>();
    this.events
      .filter((e) => e.timestamp >= todayStart)
      .forEach((event) => {
        const template = event.metadata?.template || "default";
        if (!templateMap.has(template)) {
          templateMap.set(template, {
            name: template,
            sentCount: 0,
            successRate: 0,
            avgDeliveryTime: 0,
          });
        }

        const stats = templateMap.get(template)!;
        if (event.type === "sent") stats.sentCount++;
      });

    const templateStats = Array.from(templateMap.values());

    // Recent failures
    const recentFailures = this.events
      .filter((e) => e.type === "failed" || e.type === "bounced")
      .slice(-10);

    // Calculate rates
    const totalSent = this.events.filter((e) => e.type === "sent").length;
    const totalDelivered = this.events.filter((e) => e.type === "delivered").length;
    const totalBounced = this.events.filter((e) => e.type === "bounced").length;

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

    return {
      current,
      hourlyBreakdown,
      templateStats,
      recentFailures,
      deliveryRate,
      bounceRate,
    };
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const stats = this.events;

    // Check bounce rate
    const bounces = stats.filter((e) => e.type === "bounced");
    const sent = stats.filter((e) => e.type === "sent");
    if (sent.length > 0 && bounces.length / sent.length > 0.05) {
      suggestions.push("High bounce rate detected (>5%). Verify email addresses before sending.");
    }

    // Check delivery times
    const delivered = stats.filter((e) => e.type === "delivered" && e.deliveryTime);
    if (delivered.length > 0) {
      const avgTime =
        delivered.reduce((sum, e) => sum + (e.deliveryTime || 0), 0) / delivered.length;
      if (avgTime > 30000) {
        suggestions.push("Slow email delivery detected (>30s). Consider using priority sending.");
      }
    }

    // Check complaint rate
    const complaints = stats.filter((e) => e.type === "complaint");
    if (complaints.length > sent.length * 0.001) {
      suggestions.push("Complaint rate exceeds 0.1%. Review email content and frequency.");
    }

    // Check sending patterns
    const hourly = new Map<number, number>();
    stats
      .filter((e) => e.type === "sent")
      .forEach((e) => {
        const hour = e.timestamp.getHours();
        hourly.set(hour, (hourly.get(hour) || 0) + 1);
      });

    const peakHour = Array.from(hourly.entries()).sort((a, b) => b[1] - a[1])[0];
    if (peakHour && peakHour[1] > EMAIL_LIMITS.DAILY_SENDS * 0.3) {
      suggestions.push(
        `Consider spreading emails throughout the day. Peak hour: ${peakHour[0]}:00`
      );
    }

    return suggestions;
  }

  private async handleFailedEmail(event: EmailEvent): Promise<void> {
    await logAuditEvent({
      action: "email_failed" as EventType,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.WARNING,
      description: `Email failed: ${event.error || "Unknown error"}`,
      metadata: {
        recipient: event.recipient,
        subject: event.subject,
        error: event.error,
      },
    });

    // Check if we need to blacklist the recipient
    const recentFailures = this.events.filter(
      (e) =>
        e.recipient === event.recipient &&
        (e.type === "failed" || e.type === "bounced") &&
        e.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    if (recentFailures.length >= 3) {
      await this.blacklistEmail(event.recipient);
    }
  }

  private async handleComplaint(event: EmailEvent): Promise<void> {
    await logAuditEvent({
      action: "email_complaint" as EventType,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.CRITICAL,
      description: `Email complaint received from ${event.recipient}`,
      metadata: {
        recipient: event.recipient,
        subject: event.subject,
      },
    });

    // Automatically blacklist on complaint
    await this.blacklistEmail(event.recipient);
  }

  private async blacklistEmail(email: string): Promise<void> {
    if (!this.kvNamespace) return;

    await this.kvNamespace.put(`email_blacklist:${email}`, "true", {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days
    });

    await logAuditEvent({
      action: "email_blacklisted" as EventType,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.WARNING,
      description: `Email blacklisted: ${email}`,
      metadata: { email },
    });
  }

  private async enableQuotaProtection(): Promise<void> {
    if (!this.kvNamespace) return;

    await this.kvNamespace.put("email_quota_protected", "true", {
      expirationTtl: 3600, // 1 hour
    });

    this.alertSystem.trigger({
      id: `email-quota-${Date.now()}`,
      source: "email-monitor",
      level: "critical",
      title: "Email quota protection enabled",
      message: "Email sending temporarily disabled due to quota limits",
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  private async isQuotaProtected(): Promise<boolean> {
    if (!this.kvNamespace) return false;

    const value = await this.kvNamespace.get("email_quota_protected");
    return value === "true";
  }

  private async processQueue(): Promise<void> {
    if (this.sendQueue.length === 0) return;

    const minInterval = 1000 / EMAIL_LIMITS.RATE_LIMIT;
    const now = Date.now();

    if (now - this.lastSendTime < minInterval) {
      // Wait before processing
      setTimeout(() => this.processQueue(), minInterval);
      return;
    }

    const sendFn = this.sendQueue.shift();
    if (sendFn) {
      this.lastSendTime = now;
      try {
        await sendFn();
      } catch (error) {
        console.error("Email send failed:", error);
      }

      // Process next in queue
      if (this.sendQueue.length > 0) {
        setTimeout(() => this.processQueue(), minInterval);
      }
    }
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }
}

// Export for use in Cloudflare Workers
export { EMAIL_LIMITS };
