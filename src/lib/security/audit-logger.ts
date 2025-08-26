/**
 * Audit logging for compliance with Philippine Data Privacy Act
 * Tracks all security-relevant events and user activities
 */

import { AUDIT_EVENTS, DPA_COMPLIANCE } from "./constants";
import type { User } from "@/types/common";

export interface AuditEntry {
  id: string;
  timestamp: string;
  event: string;
  userId?: string;
  userEmail?: string;
  projectId?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  result: "success" | "failure";
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  riskScore?: number;
}

export interface AuditConfig {
  enableLocalStorage?: boolean;
  enableRemoteLogging?: boolean;
  batchSize?: number;
  flushInterval?: number;
  encryptLogs?: boolean;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private queue: AuditEntry[] = [];
  private config: AuditConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string;

  private constructor() {
    this.config = {
      enableLocalStorage: true,
      enableRemoteLogging: true,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      encryptLogs: true,
    };

    // Generate session ID for this browser session
    this.sessionId = this.generateSessionId();

    // Start periodic flush
    this.startPeriodicFlush();
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Configure audit logger
   */
  configure(config: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart periodic flush with new interval
    if (config.flushInterval !== undefined) {
      this.stopPeriodicFlush();
      this.startPeriodicFlush();
    }
  }

  /**
   * Log an audit event
   */
  log(event: string, details: Partial<AuditEntry> = {}): void {
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      event,
      result: details.result || "success",
      sessionId: this.sessionId,
      ipAddress: this.getClientIp(),
      userAgent: navigator.userAgent,
      ...details,
    };

    // Calculate risk score if not provided
    if (entry.riskScore === undefined) {
      entry.riskScore = this.calculateRiskScore(entry);
    }

    // Add to queue
    this.queue.push(entry);

    // Store locally if enabled
    if (this.config.enableLocalStorage) {
      this.storeLocally(entry);
    }

    // Check if we should flush
    if (this.queue.length >= this.config.batchSize!) {
      this.flush();
    }
  }

  /**
   * Log authentication event
   */
  logAuth(
    action: "login" | "logout" | "refresh" | "password_reset",
    user?: User | null,
    success: boolean = true,
    details?: Record<string, any>
  ): void {
    const eventMap = {
      login: AUDIT_EVENTS.AUTH_LOGIN,
      logout: AUDIT_EVENTS.AUTH_LOGOUT,
      refresh: AUDIT_EVENTS.AUTH_TOKEN_REFRESH,
      password_reset: AUDIT_EVENTS.AUTH_PASSWORD_RESET,
    };

    this.log(eventMap[action], {
      userId: user?.id,
      userEmail: user?.email,
      result: success ? "success" : "failure",
      details,
    });
  }

  /**
   * Log access attempt
   */
  logAccess(
    resource: string,
    action: string,
    allowed: boolean,
    user?: User | null,
    details?: Record<string, any>
  ): void {
    this.log(allowed ? AUDIT_EVENTS.ACCESS_GRANTED : AUDIT_EVENTS.ACCESS_DENIED, {
      userId: user?.id,
      userEmail: user?.email,
      resource,
      action,
      result: allowed ? "success" : "failure",
      details,
    });
  }

  /**
   * Log data operation
   */
  logDataOperation(
    operation: "create" | "read" | "update" | "delete" | "export" | "import",
    resource: string,
    resourceId?: string,
    user?: User | null,
    details?: Record<string, any>
  ): void {
    const eventMap = {
      create: AUDIT_EVENTS.DATA_CREATE,
      read: AUDIT_EVENTS.DATA_READ,
      update: AUDIT_EVENTS.DATA_UPDATE,
      delete: AUDIT_EVENTS.DATA_DELETE,
      export: AUDIT_EVENTS.DATA_EXPORT,
      import: AUDIT_EVENTS.DATA_IMPORT,
    };

    this.log(eventMap[operation], {
      userId: user?.id,
      userEmail: user?.email,
      resource,
      resourceId,
      action: operation,
      result: "success",
      details,
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(
    type: "violation" | "suspicious" | "rate_limit" | "invalid_token",
    details?: Record<string, any>
  ): void {
    const eventMap = {
      violation: AUDIT_EVENTS.SECURITY_VIOLATION,
      suspicious: AUDIT_EVENTS.SUSPICIOUS_ACTIVITY,
      rate_limit: AUDIT_EVENTS.RATE_LIMIT_EXCEEDED,
      invalid_token: AUDIT_EVENTS.INVALID_TOKEN,
    };

    this.log(eventMap[type], {
      result: "failure",
      riskScore: 8, // High risk for security events
      details,
    });
  }

  /**
   * Log consent event for DPA compliance
   */
  logConsent(
    action: "given" | "withdrawn",
    consentType: string,
    user?: User | null,
    details?: Record<string, any>
  ): void {
    this.log(action === "given" ? AUDIT_EVENTS.CONSENT_GIVEN : AUDIT_EVENTS.CONSENT_WITHDRAWN, {
      userId: user?.id,
      userEmail: user?.email,
      result: "success",
      details: {
        consentType,
        ...details,
      },
    });
  }

  /**
   * Calculate risk score for an audit entry
   */
  private calculateRiskScore(entry: AuditEntry): number {
    let score = 0;

    // Failed events are higher risk
    if (entry.result === "failure") {
      score += 3;
    }

    // Security events are high risk
    if (entry.event.startsWith("security.")) {
      score += 5;
    }

    // Authentication events
    if (entry.event.startsWith("auth.")) {
      score += 2;
    }

    // Access denied events
    if (entry.event === AUDIT_EVENTS.ACCESS_DENIED) {
      score += 4;
    }

    // Data deletion events
    if (entry.event === AUDIT_EVENTS.DATA_DELETE) {
      score += 3;
    }

    // Cap at 10
    return Math.min(10, score);
  }

  /**
   * Store entry locally
   */
  private storeLocally(entry: AuditEntry): void {
    try {
      const stored = this.getStoredLogs();
      stored.push(entry);

      // Keep only recent logs (last 1000)
      if (stored.length > 1000) {
        stored.splice(0, stored.length - 1000);
      }

      // Encrypt if configured
      const data = this.config.encryptLogs
        ? this.encrypt(JSON.stringify(stored))
        : JSON.stringify(stored);

      sessionStorage.setItem("audit_logs", data);
    } catch (error) {
      console.error("Failed to store audit log locally:", error);
    }
  }

  /**
   * Get stored logs
   */
  private getStoredLogs(): AuditEntry[] {
    try {
      const data = sessionStorage.getItem("audit_logs");
      if (!data) return [];

      const decrypted = this.config.encryptLogs ? this.decrypt(data) : data;

      return JSON.parse(decrypted);
    } catch {
      return [];
    }
  }

  /**
   * Flush logs to server
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || !this.config.enableRemoteLogging) {
      return;
    }

    const batch = [...this.queue];
    this.queue = [];

    try {
      // Send to server
      await this.sendToServer(batch);
    } catch (error) {
      console.error("Failed to flush audit logs:", error);
      // Re-queue failed logs
      this.queue.unshift(...batch);
    }
  }

  /**
   * Send logs to server
   */
  private async sendToServer(logs: AuditEntry[]): Promise<void> {
    // This would be implemented to send logs to your API
    // For now, we'll just log to console in development
    if (import.meta.env.DEV) {
      console.log("Audit logs to send:", logs);
    }

    // In production:
    // await apiClient.post('/audit/logs', { logs });
  }

  /**
   * Start periodic flush
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval!);
  }

  /**
   * Stop periodic flush
   */
  private stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Simple encryption (should use proper encryption in production)
   */
  private encrypt(data: string): string {
    // In production, use proper encryption library
    return btoa(data);
  }

  /**
   * Simple decryption (should use proper decryption in production)
   */
  private decrypt(data: string): string {
    // In production, use proper decryption library
    return atob(data);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client IP (would need server support in production)
   */
  private getClientIp(): string {
    // In production, this would be obtained from server
    return "unknown";
  }

  /**
   * Export logs for compliance reporting
   */
  async exportLogs(
    startDate?: Date,
    endDate?: Date,
    filters?: Partial<AuditEntry>
  ): Promise<AuditEntry[]> {
    const logs = this.getStoredLogs();

    return logs.filter((log) => {
      // Date filter
      if (startDate && new Date(log.timestamp) < startDate) return false;
      if (endDate && new Date(log.timestamp) > endDate) return false;

      // Other filters
      for (const [key, value] of Object.entries(filters || {})) {
        if (log[key as keyof AuditEntry] !== value) return false;
      }

      return true;
    });
  }

  /**
   * Clear old logs based on retention policy
   */
  async applyRetentionPolicy(): Promise<void> {
    const logs = this.getStoredLogs();
    const now = Date.now();

    const filtered = logs.filter((log) => {
      const age = now - new Date(log.timestamp).getTime();
      return age < DPA_COMPLIANCE.RETENTION_PERIODS.AUDIT_LOGS;
    });

    if (filtered.length < logs.length) {
      sessionStorage.setItem("audit_logs", JSON.stringify(filtered));

      // Log the retention action
      this.log(AUDIT_EVENTS.DATA_RETENTION_DELETE, {
        details: {
          deletedCount: logs.length - filtered.length,
        },
      });
    }
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();
