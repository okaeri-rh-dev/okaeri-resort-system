/**
 * Basic Audit Logger for Security Events
 * Phase 1.4 implementation - simple security event logging
 * Logs basic authentication and security events for audit purposes
 */

export interface SecurityEvent {
  timestamp: number;
  event: string;
  level: "info" | "warn" | "error" | "critical";
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  details?: Record<string, any>;
  success?: boolean;
}

export interface AuditLogEntry extends SecurityEvent {
  id: string;
  source: "client" | "server" | "middleware";
}

/**
 * Basic audit logger for Phase 1.4
 * Simple console and in-memory logging
 * Production would use structured logging service
 */
export class BasicAuditLogger {
  private static instance: BasicAuditLogger;

  // In-memory storage for recent events (last 1000)
  private events: AuditLogEntry[] = [];
  private readonly MAX_EVENTS = 1000;

  // Event counters for statistics
  private eventCounts: Map<string, number> = new Map();

  private constructor() {
    // Initialize audit logger
    this.logSecurityEvent("audit_logger_initialized", {
      timestamp: Date.now(),
      source: "client",
    });
  }

  static getInstance(): BasicAuditLogger {
    if (!BasicAuditLogger.instance) {
      BasicAuditLogger.instance = new BasicAuditLogger();
    }
    return BasicAuditLogger.instance;
  }

  /**
   * Log a security event
   */
  logSecurityEvent(event: string, details: Partial<SecurityEvent> = {}): void {
    const entry: AuditLogEntry = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      event,
      level: details.level || "info",
      source: typeof window !== "undefined" ? "client" : "server",
      ...details,
    };

    // Add to in-memory storage
    this.addEventToMemory(entry);

    // Increment counter
    this.eventCounts.set(event, (this.eventCounts.get(event) || 0) + 1);

    // Console logging with appropriate level
    this.logToConsole(entry);

    // In production, this would also send to external logging service
    if (this.shouldLogExternally(entry)) {
      this.logExternally(entry);
    }
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    event:
      | "login_attempt"
      | "login_success"
      | "login_failure"
      | "logout"
      | "register_attempt"
      | "register_success"
      | "password_reset",
    details: {
      email?: string;
      userId?: string;
      ip?: string;
      userAgent?: string;
      success?: boolean;
      reason?: string;
      [key: string]: any;
    }
  ): void {
    const level = this.getAuthEventLevel(event, details.success);

    this.logSecurityEvent(event, {
      level,
      email: details.email,
      userId: details.userId,
      ip: details.ip,
      userAgent: details.userAgent,
      success: details.success,
      details: {
        reason: details.reason,
        ...details,
      },
    });
  }

  /**
   * Log rate limiting events
   */
  logRateLimitEvent(
    action: "blocked" | "warning" | "reset",
    identifier: string,
    details: Record<string, any> = {}
  ): void {
    this.logSecurityEvent(`rate_limit_${action}`, {
      level: action === "blocked" ? "warn" : "info",
      details: {
        identifier,
        ...details,
      },
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(type: string, details: Record<string, any> = {}): void {
    this.logSecurityEvent("suspicious_activity", {
      level: "warn",
      details: {
        type,
        ...details,
      },
    });
  }

  /**
   * Log security violations
   */
  logSecurityViolation(violation: string, details: Record<string, any> = {}): void {
    this.logSecurityEvent("security_violation", {
      level: "error",
      details: {
        violation,
        ...details,
      },
    });
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50, level?: SecurityEvent["level"]): AuditLogEntry[] {
    let events = [...this.events];

    if (level) {
      events = events.filter((event) => event.level === level);
    }

    return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(event: string, limit: number = 100): AuditLogEntry[] {
    return this.events
      .filter((e) => e.event === event)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get event statistics
   */
  getEventStatistics(): {
    totalEvents: number;
    eventCounts: Record<string, number>;
    recentActivity: number;
    errorRate: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const recentEvents = this.events.filter((e) => e.timestamp >= oneHourAgo);
    const errorEvents = this.events.filter((e) => e.level === "error" || e.level === "critical");

    return {
      totalEvents: this.events.length,
      eventCounts: Object.fromEntries(this.eventCounts),
      recentActivity: recentEvents.length,
      errorRate: this.events.length > 0 ? (errorEvents.length / this.events.length) * 100 : 0,
    };
  }

  /**
   * Generate security report
   */
  generateSecurityReport(): string {
    const stats = this.getEventStatistics();
    const recentEvents = this.getRecentEvents(10);
    const errors = this.getRecentEvents(5, "error");

    let report = `# Basic Security Audit Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `## Summary\n\n`;
    report += `- Total Events: ${stats.totalEvents}\n`;
    report += `- Recent Activity (1h): ${stats.recentActivity}\n`;
    report += `- Error Rate: ${stats.errorRate.toFixed(2)}%\n\n`;

    report += `## Event Counts\n\n`;
    Object.entries(stats.eventCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([event, count]) => {
        report += `- ${event}: ${count}\n`;
      });

    if (errors.length > 0) {
      report += `\n## Recent Errors\n\n`;
      errors.forEach((event, index) => {
        report += `${index + 1}. **${event.event}** - ${new Date(event.timestamp).toISOString()}\n`;
        if (event.details) {
          report += `   Details: ${JSON.stringify(event.details)}\n`;
        }
      });
    }

    if (recentEvents.length > 0) {
      report += `\n## Recent Activity\n\n`;
      recentEvents.forEach((event, index) => {
        const time = new Date(event.timestamp).toISOString();
        report += `${index + 1}. [${event.level.toUpperCase()}] ${event.event} - ${time}\n`;
      });
    }

    return report;
  }

  /**
   * Clear old events (for cleanup)
   */
  clearOldEvents(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - olderThanMs;
    const initialCount = this.events.length;

    this.events = this.events.filter((event) => event.timestamp >= cutoff);

    const cleared = initialCount - this.events.length;

    if (cleared > 0) {
      this.logSecurityEvent("audit_cleanup", {
        level: "info",
        details: { clearedEvents: cleared },
      });
    }

    return cleared;
  }

  /**
   * Clear all events (for testing)
   */
  clearAllEvents(): void {
    this.events = [];
    this.eventCounts.clear();

    this.logSecurityEvent("audit_cleared", {
      level: "info",
      details: { reason: "manual_clear" },
    });
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add event to in-memory storage
   */
  private addEventToMemory(entry: AuditLogEntry): void {
    this.events.push(entry);

    // Keep only the most recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: AuditLogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[AUDIT] [${entry.level.toUpperCase()}] ${timestamp}`;

    const message = `${prefix} ${entry.event}`;
    const details = entry.details || {};

    switch (entry.level) {
      case "critical":
      case "error":
        console.error(message, details);
        break;
      case "warn":
        console.warn(message, details);
        break;
      case "info":
        console.info(message, details);
        break;
      default:
        console.log(message, details);
    }
  }

  /**
   * Determine auth event logging level
   */
  private getAuthEventLevel(event: string, success?: boolean): SecurityEvent["level"] {
    if (event.includes("failure") || success === false) {
      return "warn";
    }

    if (event.includes("success") || success === true) {
      return "info";
    }

    return "info";
  }

  /**
   * Check if event should be logged externally
   */
  private shouldLogExternally(entry: AuditLogEntry): boolean {
    // In Phase 1.4, only log critical events externally
    return (
      entry.level === "critical" || entry.level === "error" || entry.event === "security_violation"
    );
  }

  /**
   * Log to external service (placeholder for Phase 1.4)
   */
  private logExternally(entry: AuditLogEntry): void {
    // In Phase 1.4, this is just a placeholder
    // Production would send to external logging service

    if (import.meta.env.DEV) {
      console.log("[EXTERNAL LOG]", entry);
    }

    // Future implementation would use services like:
    // - Vercel Analytics
    // - Sentry
    // - LogRocket
    // - Custom webhook
  }
}

/**
 * Utility functions for common audit scenarios
 */
export const auditUtils = {
  /**
   * Get client IP from request headers
   */
  getClientIP(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const cfIp = request.headers.get("cf-connecting-ip");

    return cfIp || realIp || forwarded?.split(",")[0] || "unknown";
  },

  /**
   * Get user agent from request
   */
  getUserAgent(request: Request): string {
    return request.headers.get("user-agent") || "unknown";
  },

  /**
   * Create audit context from request
   */
  createAuditContext(
    request: Request,
    additionalData: Record<string, any> = {}
  ): Record<string, any> {
    return {
      ip: auditUtils.getClientIP(request),
      userAgent: auditUtils.getUserAgent(request),
      timestamp: Date.now(),
      ...additionalData,
    };
  },

  /**
   * Sanitize sensitive data for logging
   */
  sanitizeForLogging(data: Record<string, any>): Record<string, any> {
    const sanitized = { ...data };

    // Remove or mask sensitive fields
    const sensitiveFields = ["password", "token", "secret", "key", "authorization"];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    // Truncate long values
    Object.keys(sanitized).forEach((key) => {
      if (typeof sanitized[key] === "string" && sanitized[key].length > 200) {
        sanitized[key] = `${sanitized[key].substring(0, 200)}...`;
      }
    });

    return sanitized;
  },
};

// Export singleton instance
export const basicAuditLogger = BasicAuditLogger.getInstance();
