/**
 * Philippine Data Privacy Act (DPA) Compliant Audit Logger
 * Republic Act No. 10173 Compliance Implementation
 *
 * This enhanced audit logger implements comprehensive logging requirements
 * for Philippine Data Privacy Act compliance including:
 * - All personal information access tracking
 * - Data processing activity logs
 * - Consent management tracking
 * - Security incident logging
 * - Data retention compliance
 */

import { db } from "../db/connection";
import { securityAuditLogs, auditLogs } from "../db/schema/global";
import { eq, and, gte, lte } from "drizzle-orm";

// DPA Event Categories
export enum DPAEventCategory {
  // Personal Information Access
  PI_ACCESS = "pi_access",
  PI_CREATE = "pi_create",
  PI_UPDATE = "pi_update",
  PI_DELETE = "pi_delete",
  PI_EXPORT = "pi_export",

  // Consent Management
  CONSENT_GRANTED = "consent_granted",
  CONSENT_WITHDRAWN = "consent_withdrawn",
  CONSENT_UPDATED = "consent_updated",
  CONSENT_EXPIRED = "consent_expired",

  // Data Subject Rights
  DSR_ACCESS_REQUEST = "dsr_access_request",
  DSR_CORRECTION_REQUEST = "dsr_correction_request",
  DSR_DELETION_REQUEST = "dsr_deletion_request",
  DSR_PORTABILITY_REQUEST = "dsr_portability_request",
  DSR_OBJECTION = "dsr_objection",

  // Security Events
  BREACH_DETECTED = "breach_detected",
  BREACH_REPORTED = "breach_reported",
  UNAUTHORIZED_ACCESS = "unauthorized_access",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",

  // Compliance
  RETENTION_EXPIRED = "retention_expired",
  DATA_PURGED = "data_purged",
  AUDIT_PERFORMED = "audit_performed",
  COMPLIANCE_CHECK = "compliance_check",

  // Authentication
  AUTH_LOGIN = "auth_login",
  AUTH_LOGOUT = "auth_logout",
  AUTH_FAILED = "auth_failed",
  AUTH_MFA = "auth_mfa",
  PASSWORD_CHANGED = "password_changed",
}

// DPA Compliance Levels
export enum ComplianceLevel {
  CRITICAL = "critical", // Immediate action required
  HIGH = "high", // High priority compliance issue
  MEDIUM = "medium", // Standard compliance requirement
  LOW = "low", // Minor compliance consideration
  INFO = "info", // Informational only
}

// Personal Information Types (as per DPA)
export enum PIType {
  SENSITIVE = "sensitive", // Race, ethnic origin, marital status, age, color, religious/philosophical/political affiliations
  PRIVILEGED = "privileged", // Communications between parties with legal privilege
  GENERAL = "general", // Name, identity, address, contact details
  FINANCIAL = "financial", // Financial records, payment information
  HEALTH = "health", // Health records, medical history
  GOVERNMENT = "government", // Government-issued IDs
  BIOMETRIC = "biometric", // Fingerprints, facial recognition data
}

export interface DPAAuditEvent {
  // Event identification
  category: DPAEventCategory;
  action: string;
  description: string;

  // User context
  userId?: string;
  userEmail?: string;
  userRole?: string;
  projectId?: string;

  // Data subject information
  dataSubjectId?: string;
  dataSubjectType?: "guest" | "employee" | "vendor" | "user";

  // Personal information details
  piType?: PIType;
  piFields?: string[]; // Fields accessed/modified
  piPurpose?: string; // Purpose of processing
  piLegalBasis?:
    | "consent"
    | "contract"
    | "legal_obligation"
    | "vital_interests"
    | "public_task"
    | "legitimate_interests";

  // Request context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  httpMethod?: string;
  requestPath?: string;

  // Consent tracking
  consentId?: string;
  consentVersion?: string;
  consentScope?: string[];

  // Compliance metadata
  complianceLevel: ComplianceLevel;
  retentionPeriodDays?: number;

  // Result
  success: boolean;
  errorMessage?: string;
  riskScore?: number;

  // Additional context
  metadata?: Record<string, any>;

  // Data changes (for update operations)
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export class DPAAuditLogger {
  private static instance: DPAAuditLogger;
  private batchQueue: DPAAuditEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_INTERVAL_MS = 5000; // 5 seconds

  // Retention periods in days (Philippine legal requirements)
  private readonly RETENTION_PERIODS = {
    financial: 1825, // 5 years for financial records
    employment: 1095, // 3 years for employment records
    security: 730, // 2 years for security logs
    consent: 365, // 1 year for consent records
    general: 180, // 6 months for general logs
    breach: 1825, // 5 years for breach records
  };

  private constructor() {
    // Start batch processing
    this.startBatchProcessing();
  }

  static getInstance(): DPAAuditLogger {
    if (!DPAAuditLogger.instance) {
      DPAAuditLogger.instance = new DPAAuditLogger();
    }
    return DPAAuditLogger.instance;
  }

  /**
   * Log a DPA compliance event
   */
  async logDPAEvent(event: DPAAuditEvent): Promise<void> {
    try {
      // Sanitize sensitive data before logging
      const sanitizedEvent = this.sanitizeEvent(event);

      // Add timestamp and generate ID
      const auditEntry = {
        ...sanitizedEvent,
        timestamp: new Date(),
        eventId: this.generateEventId(),
      };

      // Add to batch queue
      this.batchQueue.push(auditEntry);

      // Process immediately if batch is full
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        await this.processBatch();
      }

      // Log critical events immediately
      if (event.complianceLevel === ComplianceLevel.CRITICAL) {
        await this.logCriticalEvent(auditEntry);
      }

      // Check for breach conditions
      if (this.isBreachEvent(event)) {
        await this.handleBreachEvent(event);
      }
    } catch (error) {
      console.error("[DPA Audit] Failed to log event:", error);
      // Log to fallback mechanism
      this.logToFallback(event, error);
    }
  }

  /**
   * Log personal information access
   */
  async logPIAccess(params: {
    userId: string;
    dataSubjectId: string;
    piType: PIType;
    fields: string[];
    purpose: string;
    legalBasis: string;
    projectId?: string;
    success: boolean;
  }): Promise<void> {
    await this.logDPAEvent({
      category: DPAEventCategory.PI_ACCESS,
      action: "access_personal_information",
      description: `Accessed ${params.piType} personal information`,
      userId: params.userId,
      dataSubjectId: params.dataSubjectId,
      piType: params.piType,
      piFields: params.fields,
      piPurpose: params.purpose,
      piLegalBasis: params.legalBasis as any,
      projectId: params.projectId,
      complianceLevel: this.getPIComplianceLevel(params.piType),
      success: params.success,
    });
  }

  /**
   * Log consent events
   */
  async logConsent(params: {
    userId: string;
    action: "grant" | "withdraw" | "update";
    consentId: string;
    consentVersion: string;
    scope: string[];
    metadata?: Record<string, any>;
  }): Promise<void> {
    const categoryMap = {
      grant: DPAEventCategory.CONSENT_GRANTED,
      withdraw: DPAEventCategory.CONSENT_WITHDRAWN,
      update: DPAEventCategory.CONSENT_UPDATED,
    };

    await this.logDPAEvent({
      category: categoryMap[params.action],
      action: `consent_${params.action}`,
      description: `User ${params.action}ed consent`,
      userId: params.userId,
      consentId: params.consentId,
      consentVersion: params.consentVersion,
      consentScope: params.scope,
      complianceLevel: ComplianceLevel.HIGH,
      retentionPeriodDays: this.RETENTION_PERIODS.consent,
      success: true,
      metadata: params.metadata,
    });
  }

  /**
   * Log data subject rights requests
   */
  async logDSRRequest(params: {
    requestType: "access" | "correction" | "deletion" | "portability" | "objection";
    dataSubjectId: string;
    requesterId: string;
    details: Record<string, any>;
    approved: boolean;
    reason?: string;
  }): Promise<void> {
    const categoryMap = {
      access: DPAEventCategory.DSR_ACCESS_REQUEST,
      correction: DPAEventCategory.DSR_CORRECTION_REQUEST,
      deletion: DPAEventCategory.DSR_DELETION_REQUEST,
      portability: DPAEventCategory.DSR_PORTABILITY_REQUEST,
      objection: DPAEventCategory.DSR_OBJECTION,
    };

    await this.logDPAEvent({
      category: categoryMap[params.requestType],
      action: `dsr_${params.requestType}_request`,
      description: `Data subject ${params.requestType} request ${params.approved ? "approved" : "denied"}`,
      userId: params.requesterId,
      dataSubjectId: params.dataSubjectId,
      complianceLevel: ComplianceLevel.HIGH,
      retentionPeriodDays: this.RETENTION_PERIODS.general,
      success: params.approved,
      errorMessage: params.approved ? undefined : params.reason,
      metadata: params.details,
    });
  }

  /**
   * Log security breach
   */
  async logSecurityBreach(params: {
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    affectedRecords: number;
    description: string;
    containmentActions?: string[];
    reportedToNPC?: boolean; // National Privacy Commission
  }): Promise<void> {
    await this.logDPAEvent({
      category: DPAEventCategory.BREACH_DETECTED,
      action: "security_breach",
      description: params.description,
      complianceLevel: ComplianceLevel.CRITICAL,
      retentionPeriodDays: this.RETENTION_PERIODS.breach,
      success: false,
      riskScore: this.calculateBreachRiskScore(params.severity, params.affectedRecords),
      metadata: {
        type: params.type,
        severity: params.severity,
        affectedRecords: params.affectedRecords,
        containmentActions: params.containmentActions,
        reportedToNPC: params.reportedToNPC,
        detectedAt: new Date().toISOString(),
      },
    });

    // Trigger breach notification if required
    if (params.severity === "high" || params.severity === "critical") {
      await this.triggerBreachNotification(params);
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    projectId?: string
  ): Promise<{
    summary: Record<string, number>;
    criticalEvents: any[];
    consentMetrics: Record<string, any>;
    dsrRequests: Record<string, any>;
    retentionCompliance: Record<string, any>;
    recommendations: string[];
  }> {
    try {
      // Fetch audit logs for the period
      const conditions = [
        gte(securityAuditLogs.createdAt, startDate),
        lte(securityAuditLogs.createdAt, endDate),
      ];

      if (projectId) {
        conditions.push(eq(securityAuditLogs.projectId, projectId));
      }

      const logs = await db
        .select()
        .from(securityAuditLogs)
        .where(and(...conditions))
        .limit(10000);

      // Analyze logs
      const summary = this.analyzeLogs(logs);
      const criticalEvents = logs.filter((log) => log.threatLevel === "critical");
      const consentMetrics = this.analyzeConsentMetrics(logs);
      const dsrRequests = this.analyzeDSRRequests(logs);
      const retentionCompliance = await this.checkRetentionCompliance();
      const recommendations = this.generateRecommendations(summary, logs);

      return {
        summary,
        criticalEvents,
        consentMetrics,
        dsrRequests,
        retentionCompliance,
        recommendations,
      };
    } catch (error) {
      console.error("[DPA Audit] Failed to generate compliance report:", error);
      throw error;
    }
  }

  /**
   * Check and purge expired data
   */
  async purgeExpiredData(): Promise<{
    purgedCount: number;
    categories: Record<string, number>;
  }> {
    const results = {
      purgedCount: 0,
      categories: {} as Record<string, number>,
    };

    try {
      // Check each retention category
      for (const [category, days] of Object.entries(this.RETENTION_PERIODS)) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Archive before deletion (for legal compliance)
        await this.archiveOldLogs(category, cutoffDate);

        // Delete expired logs
        const deleted = await db
          .delete(securityAuditLogs)
          .where(
            and(
              lte(securityAuditLogs.createdAt, cutoffDate),
              eq(securityAuditLogs.eventType, category)
            )
          );

        results.categories[category] = deleted.count || 0;
        results.purgedCount += deleted.count || 0;
      }

      // Log the purge event
      await this.logDPAEvent({
        category: DPAEventCategory.DATA_PURGED,
        action: "data_retention_purge",
        description: `Purged ${results.purgedCount} expired records`,
        complianceLevel: ComplianceLevel.INFO,
        success: true,
        metadata: results,
      });
    } catch (error) {
      console.error("[DPA Audit] Failed to purge expired data:", error);
      throw error;
    }

    return results;
  }

  /**
   * Private helper methods
   */

  private sanitizeEvent(event: DPAAuditEvent): DPAAuditEvent {
    const sanitized = { ...event };

    // Remove sensitive fields from metadata
    if (sanitized.metadata) {
      const sensitiveKeys = ["password", "token", "secret", "creditCard", "ssn", "tin"];

      for (const key of Object.keys(sanitized.metadata)) {
        if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
          sanitized.metadata[key] = "[REDACTED]";
        }
      }
    }

    // Sanitize old/new values
    if (sanitized.oldValues) {
      sanitized.oldValues = this.sanitizeObject(sanitized.oldValues);
    }
    if (sanitized.newValues) {
      sanitized.newValues = this.sanitizeObject(sanitized.newValues);
    }

    return sanitized;
  }

  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized = { ...obj };
    const sensitiveKeys = ["password", "token", "secret", "creditCard", "ssn", "tin"];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  private generateEventId(): string {
    return `dpa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getPIComplianceLevel(piType: PIType): ComplianceLevel {
    switch (piType) {
      case PIType.SENSITIVE:
      case PIType.PRIVILEGED:
        return ComplianceLevel.CRITICAL;
      case PIType.FINANCIAL:
      case PIType.HEALTH:
      case PIType.GOVERNMENT:
      case PIType.BIOMETRIC:
        return ComplianceLevel.HIGH;
      case PIType.GENERAL:
      default:
        return ComplianceLevel.MEDIUM;
    }
  }

  private isBreachEvent(event: DPAAuditEvent): boolean {
    return (
      event.category === DPAEventCategory.BREACH_DETECTED ||
      event.category === DPAEventCategory.UNAUTHORIZED_ACCESS ||
      (event.category === DPAEventCategory.SUSPICIOUS_ACTIVITY &&
        event.riskScore &&
        event.riskScore > 70)
    );
  }

  private async handleBreachEvent(event: DPAAuditEvent): Promise<void> {
    // Implement breach notification logic
    console.error("[DPA BREACH DETECTED]", event);

    // In production, this would:
    // 1. Send immediate notification to data protection officer
    // 2. Create incident ticket
    // 3. Trigger automated containment procedures
    // 4. Prepare NPC notification (within 72 hours as per DPA)
  }

  private calculateBreachRiskScore(severity: string, affectedRecords: number): number {
    let score = 0;

    // Severity score
    switch (severity) {
      case "critical":
        score += 40;
        break;
      case "high":
        score += 30;
        break;
      case "medium":
        score += 20;
        break;
      case "low":
        score += 10;
        break;
    }

    // Volume score
    if (affectedRecords > 10000) score += 40;
    else if (affectedRecords > 1000) score += 30;
    else if (affectedRecords > 100) score += 20;
    else if (affectedRecords > 10) score += 10;
    else score += 5;

    // Additional factors
    score += Math.min(20, Math.floor(affectedRecords / 500));

    return Math.min(100, score);
  }

  private async triggerBreachNotification(params: any): Promise<void> {
    // Implement automated breach notification
    // This would integrate with notification systems
    console.error("[DPA BREACH NOTIFICATION REQUIRED]", params);
  }

  private analyzeLogs(logs: any[]): Record<string, number> {
    const summary: Record<string, number> = {};

    for (const log of logs) {
      const key = log.eventType || "unknown";
      summary[key] = (summary[key] || 0) + 1;
    }

    return summary;
  }

  private analyzeConsentMetrics(logs: any[]): Record<string, any> {
    const consentLogs = logs.filter((log) => log.eventType?.includes("consent"));

    return {
      total: consentLogs.length,
      granted: consentLogs.filter((log) => log.eventType === "consent_granted").length,
      withdrawn: consentLogs.filter((log) => log.eventType === "consent_withdrawn").length,
      updated: consentLogs.filter((log) => log.eventType === "consent_updated").length,
    };
  }

  private analyzeDSRRequests(logs: any[]): Record<string, any> {
    const dsrLogs = logs.filter((log) => log.eventType?.startsWith("dsr_"));

    return {
      total: dsrLogs.length,
      access: dsrLogs.filter((log) => log.eventType === "dsr_access_request").length,
      correction: dsrLogs.filter((log) => log.eventType === "dsr_correction_request").length,
      deletion: dsrLogs.filter((log) => log.eventType === "dsr_deletion_request").length,
      portability: dsrLogs.filter((log) => log.eventType === "dsr_portability_request").length,
      objection: dsrLogs.filter((log) => log.eventType === "dsr_objection").length,
    };
  }

  private async checkRetentionCompliance(): Promise<Record<string, any>> {
    // Check if data is being retained according to policy
    const results: Record<string, any> = {};

    for (const [category, days] of Object.entries(this.RETENTION_PERIODS)) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Check for data that should have been purged
      const overdueCount = await db
        .select()
        .from(securityAuditLogs)
        .where(
          and(
            lte(securityAuditLogs.createdAt, cutoffDate),
            eq(securityAuditLogs.eventType, category)
          )
        )
        .limit(1);

      results[category] = {
        retentionDays: days,
        compliant: overdueCount.length === 0,
        overdueRecords: overdueCount.length,
      };
    }

    return results;
  }

  private generateRecommendations(summary: Record<string, number>, logs: any[]): string[] {
    const recommendations: string[] = [];

    // Check for high unauthorized access attempts
    if ((summary["unauthorized_access"] || 0) > 10) {
      recommendations.push(
        "High number of unauthorized access attempts detected. Review access controls and implement additional authentication measures."
      );
    }

    // Check for missing consent records
    if ((summary["pi_access"] || 0) > (summary["consent_granted"] || 0) * 2) {
      recommendations.push(
        "Personal information access exceeds consent records. Ensure all data processing has proper consent basis."
      );
    }

    // Check for unprocessed DSR requests
    const dsrRequests = logs.filter((log) => log.eventType?.startsWith("dsr_"));
    const unprocessedDSR = dsrRequests.filter((log) => !log.success);
    if (unprocessedDSR.length > 0) {
      recommendations.push(
        `${unprocessedDSR.length} unprocessed data subject requests found. Process within legal timeframes.`
      );
    }

    // Check for breach events
    if (summary["breach_detected"] || summary["breach_reported"]) {
      recommendations.push(
        "Security breaches detected. Ensure NPC notification within 72 hours and implement containment measures."
      );
    }

    // Check retention compliance
    if ((summary["retention_expired"] || 0) > 0) {
      recommendations.push(
        "Expired data retention detected. Run data purge process to maintain compliance."
      );
    }

    return recommendations;
  }

  private async archiveOldLogs(category: string, cutoffDate: Date): Promise<void> {
    // In production, this would archive logs to cold storage
    // For now, just log the action
    console.log(`[DPA Audit] Archiving ${category} logs older than ${cutoffDate.toISOString()}`);
  }

  private startBatchProcessing(): void {
    this.batchTimer = setInterval(async () => {
      if (this.batchQueue.length > 0) {
        await this.processBatch();
      }
    }, this.BATCH_INTERVAL_MS);
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      // Convert events to database format
      const dbEntries = batch.map((event) => ({
        userId: event.userId,
        projectId: event.projectId,
        eventType: event.category,
        resourceType: event.piType,
        resourceId: event.dataSubjectId,
        action: event.action,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        riskScore: event.riskScore || 0,
        threatLevel: this.mapComplianceLevelToThreatLevel(event.complianceLevel),
        success: event.success,
        errorMessage: event.errorMessage,
        metadata: {
          ...event.metadata,
          description: event.description,
          piFields: event.piFields,
          piPurpose: event.piPurpose,
          piLegalBasis: event.piLegalBasis,
          consentId: event.consentId,
          consentVersion: event.consentVersion,
          consentScope: event.consentScope,
        },
        retentionDate: event.retentionPeriodDays
          ? new Date(Date.now() + event.retentionPeriodDays * 24 * 60 * 60 * 1000)
          : undefined,
      }));

      // Batch insert
      await db.insert(securityAuditLogs).values(dbEntries);
    } catch (error) {
      console.error("[DPA Audit] Failed to process batch:", error);
      // Retry logic or fallback to file system
      this.logBatchToFallback(batch, error);
    }
  }

  private mapComplianceLevelToThreatLevel(level: ComplianceLevel): string {
    switch (level) {
      case ComplianceLevel.CRITICAL:
        return "critical";
      case ComplianceLevel.HIGH:
        return "high";
      case ComplianceLevel.MEDIUM:
        return "medium";
      case ComplianceLevel.LOW:
        return "low";
      default:
        return "low";
    }
  }

  private async logCriticalEvent(event: any): Promise<void> {
    // Immediate logging for critical events
    try {
      await db.insert(securityAuditLogs).values({
        userId: event.userId,
        projectId: event.projectId,
        eventType: event.category,
        resourceType: event.piType,
        resourceId: event.dataSubjectId,
        action: event.action,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        riskScore: event.riskScore || 100,
        threatLevel: "critical",
        success: event.success,
        errorMessage: event.errorMessage,
        metadata: event,
      });
    } catch (error) {
      console.error("[DPA Audit] Failed to log critical event:", error);
      this.logToFallback(event, error);
    }
  }

  private logToFallback(event: any, error: any): void {
    // Fallback logging mechanism (file system, external service, etc.)
    console.error("[DPA Audit Fallback]", { event, error });

    // In production, this would:
    // 1. Write to a local file
    // 2. Send to a backup logging service
    // 3. Queue for retry
  }

  private logBatchToFallback(batch: any[], error: any): void {
    console.error("[DPA Audit Batch Fallback]", {
      batchSize: batch.length,
      error,
      firstEvent: batch[0],
    });
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Process remaining batch
    if (this.batchQueue.length > 0) {
      await this.processBatch();
    }
  }
}

// Export singleton instance
export const dpaAuditLogger = DPAAuditLogger.getInstance();

// Export helper functions
export const logDPAEvent = (event: DPAAuditEvent) => dpaAuditLogger.logDPAEvent(event);
export const logPIAccess = (params: Parameters<typeof dpaAuditLogger.logPIAccess>[0]) =>
  dpaAuditLogger.logPIAccess(params);
export const logConsent = (params: Parameters<typeof dpaAuditLogger.logConsent>[0]) =>
  dpaAuditLogger.logConsent(params);
export const logDSRRequest = (params: Parameters<typeof dpaAuditLogger.logDSRRequest>[0]) =>
  dpaAuditLogger.logDSRRequest(params);
export const logSecurityBreach = (params: Parameters<typeof dpaAuditLogger.logSecurityBreach>[0]) =>
  dpaAuditLogger.logSecurityBreach(params);
