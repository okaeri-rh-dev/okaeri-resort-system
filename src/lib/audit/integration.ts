/**
 * Audit Trail Integration with Existing Compliance Framework
 *
 * Seamlessly integrates the enhanced audit trail system with existing
 * BIR integration, compliance monitoring, and database optimization components.
 * Provides unified audit and compliance management for Philippine resort operations.
 */

import { auditTrailService } from "@/lib/services/audit-trail.service";
import { anomalyDetector } from "./anomaly-detection";
import { complianceAuditor } from "./compliance-audit";
import { riskAssessmentEngine } from "./risk-assessment";
import { auditReportGenerator } from "./audit-reporting";

// Existing compliance services
import { birIntegrationService } from "@/lib/services/bir-integration.service";
import { complianceMonitorService } from "@/lib/services/compliance-monitor.service";

// Existing audit logger
import { auditLog } from "@/lib/audit";

import { Money } from "@/lib/money";
import { db } from "@/lib/db";

// =============================================
// Integration Types and Interfaces
// =============================================

export interface IntegratedAuditEvent {
  // Core audit data
  transactionId: string;
  projectId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;

  // Financial data
  amount?: Money;
  previousAmount?: Money;

  // Enhanced audit data
  stateChanges: any[];
  anomalies: any[];
  riskScore: number;
  complianceFlags: string[];

  // Integration metadata
  birReportable: boolean;
  birFormTypes: string[];
  complianceDeadlines: Date[];

  // Processing status
  processed: boolean;
  processingErrors: string[];

  timestamp: Date;
}

export interface ComplianceIntegrationConfig {
  enableBIRIntegration: boolean;
  enableComplianceMonitoring: boolean;
  enableRealTimeProcessing: boolean;
  enableAnomalyAlerts: boolean;
  enableRiskScoring: boolean;

  thresholds: {
    riskScoreAlert: number;
    anomalyScoreAlert: number;
    highValueAmount: number;
    criticalComplianceScore: number;
  };

  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    dashboardAlerts: boolean;
    recipients: string[];
  };
}

export interface IntegrationStatus {
  isIntegrated: boolean;
  lastSync: Date;
  errors: string[];
  metrics: {
    eventsProcessed: number;
    anomaliesDetected: number;
    complianceIssues: number;
    riskAlertsGenerated: number;
  };
}

// =============================================
// Enhanced Audit Trail Integration Service
// =============================================

export class AuditTrailIntegrationService {
  private config: ComplianceIntegrationConfig;

  constructor(config?: Partial<ComplianceIntegrationConfig>) {
    this.config = {
      enableBIRIntegration: true,
      enableComplianceMonitoring: true,
      enableRealTimeProcessing: true,
      enableAnomalyAlerts: true,
      enableRiskScoring: true,
      thresholds: {
        riskScoreAlert: 70,
        anomalyScoreAlert: 75,
        highValueAmount: 100000,
        criticalComplianceScore: 60,
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        dashboardAlerts: true,
        recipients: [],
      },
      ...config,
    };
  }

  /**
   * Process a financial transaction through the integrated audit pipeline
   */
  async processIntegratedAuditEvent(
    transactionData: any,
    context: any
  ): Promise<IntegratedAuditEvent> {
    const startTime = Date.now();

    try {
      // 1. Create enhanced audit transaction
      const auditTransaction = await this.createAuditTransaction(transactionData, context);

      // 2. Log through enhanced audit trail
      const auditLog = await auditTrailService.logTransaction(auditTransaction);

      // 3. Perform risk assessment
      const riskScore = this.config.enableRiskScoring
        ? await riskAssessmentEngine.calculateRiskScore(
            auditTransaction.userId,
            "user",
            auditTransaction.projectId
          )
        : 0;

      // 4. Check compliance requirements
      const complianceFlags = await this.checkComplianceRequirements(auditTransaction, auditLog);

      // 5. Integrate with BIR system if applicable
      const birIntegration = await this.integrateWithBIR(auditTransaction, complianceFlags);

      // 6. Update compliance monitoring
      await this.updateComplianceMonitoring(auditTransaction, complianceFlags);

      // 7. Process alerts and notifications
      await this.processAlertsAndNotifications(auditLog, riskScore);

      // 8. Create integrated audit event
      const integratedEvent: IntegratedAuditEvent = {
        transactionId: auditTransaction.id,
        projectId: auditTransaction.projectId,
        userId: auditTransaction.userId,
        action: auditTransaction.action,
        entityType: auditTransaction.entity.type,
        entityId: auditTransaction.entity.id,
        amount: auditTransaction.monetaryAmount,
        previousAmount: auditTransaction.previousAmount,
        stateChanges: auditTransaction.changes,
        anomalies: auditLog.anomalies,
        riskScore,
        complianceFlags,
        birReportable: birIntegration.isReportable,
        birFormTypes: birIntegration.formTypes,
        complianceDeadlines: [], // Would be populated from compliance monitoring
        processed: true,
        processingErrors: [],
        timestamp: new Date(),
      };

      // 9. Log processing metrics
      await this.logProcessingMetrics(integratedEvent, Date.now() - startTime);

      return integratedEvent;
    } catch (error) {
      console.error("Failed to process integrated audit event:", error);

      return {
        transactionId: transactionData.id || "unknown",
        projectId: transactionData.projectId || "unknown",
        userId: transactionData.userId || "unknown",
        action: transactionData.action || "unknown",
        entityType: transactionData.entityType || "unknown",
        entityId: transactionData.entityId || "unknown",
        stateChanges: [],
        anomalies: [],
        riskScore: 0,
        complianceFlags: [],
        birReportable: false,
        birFormTypes: [],
        complianceDeadlines: [],
        processed: false,
        processingErrors: [error instanceof Error ? error.message : "Unknown error"],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Generate comprehensive compliance dashboard data
   */
  async generateComplianceDashboard(projectId: string, period?: { start: Date; end: Date }) {
    const defaultPeriod = period || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date(),
    };

    // Get audit trail data
    const auditReport = await auditTrailService.generateAuditReport(
      projectId,
      defaultPeriod.start,
      defaultPeriod.end
    );

    // Get BIR compliance status
    const birValidation = await complianceAuditor.validateBIRAuditTrail(
      projectId,
      defaultPeriod.start,
      defaultPeriod.end
    );

    // Get DPA compliance status
    const dpaReport = await complianceAuditor.auditPersonalDataProcessing(projectId);

    // Get risk assessment
    const riskAssessment = await riskAssessmentEngine.performComprehensiveAssessment(
      projectId,
      defaultPeriod
    );

    // Get internal controls assessment
    const controlsAssessment = await complianceAuditor.evaluateInternalControls(projectId);

    return {
      period: defaultPeriod,
      projectId,
      generatedAt: new Date(),

      // Overview metrics
      overview: {
        totalTransactions: auditReport.summary.totalEvents,
        totalAmount: auditReport.summary.financialImpact,
        criticalEvents: auditReport.summary.criticalEvents,
        complianceScore: this.calculateOverallComplianceScore({
          bir: birValidation.overallScore,
          dpa: dpaReport.overallScore,
          controls: controlsAssessment.overallEffectiveness,
        }),
        riskLevel: this.getRiskLevel(riskAssessment.overallRiskScore),
      },

      // BIR compliance section
      birCompliance: {
        score: birValidation.overallScore,
        status: birValidation.exportReadiness ? "compliant" : "needs_attention",
        criticalIssues: birValidation.criticalIssues.length,
        nextActions: birValidation.recommendations.slice(0, 3),
        auditReadiness: birValidation.exportReadiness,
      },

      // DPA compliance section
      dpaCompliance: {
        score: dpaReport.overallScore,
        status: this.getDPAStatus(dpaReport.overallScore),
        violations: dpaReport.violations.length,
        dataCategories: dpaReport.personalDataProcessing.dataCategories.length,
        nextActions: dpaReport.recommendations.slice(0, 3),
      },

      // Risk assessment section
      riskAssessment: {
        overallScore: riskAssessment.overallRiskScore,
        level: riskAssessment.riskLevel,
        topRisks: riskAssessment.topRisks.slice(0, 5),
        trends: riskAssessment.trends.slice(-7), // Last 7 days
        highRiskUsers: riskAssessment.userRiskProfiles
          .filter((profile) => profile.behaviorScore < 60)
          .slice(0, 5),
      },

      // Anomaly detection section
      anomalies: {
        total: auditReport.summary.anomalies,
        recent: [], // Would get from anomaly storage
        patterns: [], // Would analyze patterns
        falsePositiveRate: 0, // Would calculate from feedback
      },

      // Internal controls section
      internalControls: {
        effectiveness: controlsAssessment.overallEffectiveness,
        status: this.getControlsStatus(controlsAssessment.overallEffectiveness),
        deficiencies: controlsAssessment.deficiencies.length,
        categoryScores: Object.values(controlsAssessment.controlCategories).map((cat) => ({
          category: cat.controlName,
          score: cat.effectiveness,
        })),
      },

      // Alerts and notifications
      alerts: await this.generateCurrentAlerts(projectId, defaultPeriod),

      // Action items
      actionItems: await this.generateActionItems({
        birValidation,
        dpaReport,
        riskAssessment,
        controlsAssessment,
      }),
    };
  }

  /**
   * Perform real-time compliance monitoring
   */
  async performRealTimeMonitoring(projectId: string) {
    const monitoringResults = {
      timestamp: new Date(),
      projectId,
      status: "monitoring" as const,
      alerts: [] as any[],
      metrics: {
        transactionsProcessed: 0,
        anomaliesDetected: 0,
        riskAlertsGenerated: 0,
        complianceIssues: 0,
      },
    };

    try {
      // Get recent transactions (last hour)
      const recentPeriod = {
        start: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        end: new Date(),
      };

      // Check for new audit events
      const recentAuditReport = await auditTrailService.generateAuditReport(
        projectId,
        recentPeriod.start,
        recentPeriod.end
      );

      monitoringResults.metrics.transactionsProcessed = recentAuditReport.summary.totalEvents;

      // Check for critical events
      if (recentAuditReport.summary.criticalEvents > 0) {
        monitoringResults.alerts.push({
          type: "critical_events",
          severity: "high",
          message: `${recentAuditReport.summary.criticalEvents} critical events in the last hour`,
          action: "immediate_review_required",
        });
      }

      // Check compliance score
      if (
        recentAuditReport.complianceStatus.score < this.config.thresholds.criticalComplianceScore
      ) {
        monitoringResults.alerts.push({
          type: "compliance_degradation",
          severity: "medium",
          message: `Compliance score dropped to ${recentAuditReport.complianceStatus.score}%`,
          action: "review_compliance_issues",
        });
        monitoringResults.metrics.complianceIssues++;
      }

      // Check for anomalies
      monitoringResults.metrics.anomaliesDetected = recentAuditReport.summary.anomalies;

      if (recentAuditReport.summary.anomalies > 5) {
        monitoringResults.alerts.push({
          type: "anomaly_spike",
          severity: "medium",
          message: `${recentAuditReport.summary.anomalies} anomalies detected in the last hour`,
          action: "investigate_anomalies",
        });
      }

      monitoringResults.status = "completed";
    } catch (error) {
      console.error("Real-time monitoring failed:", error);
      monitoringResults.status = "failed";
      monitoringResults.alerts.push({
        type: "monitoring_failure",
        severity: "critical",
        message: `Real-time monitoring failed: ${error}`,
        action: "check_system_health",
      });
    }

    return monitoringResults;
  }

  /**
   * Export integrated compliance data for regulatory submission
   */
  async exportIntegratedComplianceData(
    projectId: string,
    exportType: "bir" | "dpa" | "sec" | "bsp",
    period: { start: Date; end: Date },
    format: "xml" | "csv" | "pdf" | "dat" = "xml"
  ) {
    try {
      switch (exportType) {
        case "bir":
          return await this.exportBIRData(projectId, period, format);
        case "dpa":
          return await this.exportDPAData(projectId, format);
        case "sec":
          return await this.exportSECData(projectId, period, format);
        case "bsp":
          return await this.exportBSPData(projectId, period, format);
        default:
          throw new Error(`Unsupported export type: ${exportType}`);
      }
    } catch (error) {
      console.error(`Failed to export ${exportType} data:`, error);
      throw error;
    }
  }

  // =============================================
  // Private Helper Methods
  // =============================================

  private async createAuditTransaction(transactionData: any, context: any) {
    // Convert transaction data to enhanced audit transaction format
    return {
      id: transactionData.id,
      userId: transactionData.userId,
      userName: transactionData.userName,
      userRole: transactionData.userRole,
      projectId: transactionData.projectId,
      entity: {
        id: transactionData.entityId,
        type: transactionData.entityType,
        code: transactionData.entityCode,
        projectId: transactionData.projectId,
        data: transactionData,
      },
      action: transactionData.action,
      previousState: transactionData.previousState || {},
      newState: transactionData.newState || transactionData,
      changes: await this.calculateChanges(
        transactionData.previousState,
        transactionData.newState || transactionData
      ),
      monetaryAmount: transactionData.amount ? new Money(transactionData.amount) : undefined,
      previousAmount: transactionData.previousAmount
        ? new Money(transactionData.previousAmount)
        : undefined,
      context: {
        timestamp: new Date(),
        source: context.source || "api",
        sessionId: context.sessionId,
        requestId: context.requestId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        apiEndpoint: context.apiEndpoint,
        httpMethod: context.httpMethod,
      },
      severity: this.calculateSeverity(transactionData),
    };
  }

  private async calculateChanges(previousState: any, newState: any) {
    if (!previousState || !newState) return [];

    return auditTrailService.captureStateChange(previousState, newState, {
      timestamp: new Date(),
      source: "api",
    });
  }

  private calculateSeverity(transactionData: any): "info" | "warning" | "error" | "critical" {
    if (transactionData.amount && transactionData.amount > 500000) return "critical";
    if (transactionData.action.includes("delete") || transactionData.action.includes("void"))
      return "warning";
    if (transactionData.action.includes("approve") && transactionData.amount > 100000)
      return "warning";
    return "info";
  }

  private async checkComplianceRequirements(auditTransaction: any, auditLog: any) {
    const flags: string[] = [];

    // BIR compliance flags
    if (this.isBIRReportable(auditTransaction)) {
      flags.push("bir_reportable");
    }

    // High value transaction
    if (auditTransaction.monetaryAmount?.greaterThan(this.config.thresholds.highValueAmount)) {
      flags.push("high_value");
    }

    // Tax-related flags
    if (this.isTaxRelated(auditTransaction)) {
      flags.push("tax_related");
    }

    // Personal data handling
    if (this.involvesPersonalData(auditTransaction)) {
      flags.push("personal_data");
    }

    // Risk-based flags
    if (auditLog.anomalies && auditLog.anomalies.length > 0) {
      flags.push("anomaly_detected");
    }

    return flags;
  }

  private async integrateWithBIR(auditTransaction: any, complianceFlags: string[]) {
    const result = {
      isReportable: false,
      formTypes: [] as string[],
      filingDeadlines: [] as Date[],
    };

    if (!this.config.enableBIRIntegration) return result;

    if (complianceFlags.includes("bir_reportable")) {
      result.isReportable = true;

      // Determine form types based on transaction
      if (auditTransaction.entity.type === "income") {
        result.formTypes.push("2550M");
      }

      if (complianceFlags.includes("withholding_tax")) {
        result.formTypes.push("2307");
      }

      // Would integrate with actual BIR service
      try {
        if (this.config.enableBIRIntegration) {
          await birIntegrationService.recordTransaction(auditTransaction);
        }
      } catch (error) {
        console.error("BIR integration failed:", error);
      }
    }

    return result;
  }

  private async updateComplianceMonitoring(auditTransaction: any, complianceFlags: string[]) {
    if (!this.config.enableComplianceMonitoring) return;

    try {
      // Update compliance monitoring with new transaction
      await complianceMonitorService.updateTransactionCompliance({
        projectId: auditTransaction.projectId,
        transactionId: auditTransaction.id,
        complianceFlags,
        amount: auditTransaction.monetaryAmount?.toNumber(),
        timestamp: auditTransaction.context.timestamp,
      });
    } catch (error) {
      console.error("Compliance monitoring update failed:", error);
    }
  }

  private async processAlertsAndNotifications(auditLog: any, riskScore: number) {
    const alerts: any[] = [];

    // Risk score alerts
    if (this.config.enableRiskScoring && riskScore > this.config.thresholds.riskScoreAlert) {
      alerts.push({
        type: "high_risk_transaction",
        severity: riskScore > 90 ? "critical" : "high",
        message: `High risk transaction detected (score: ${riskScore})`,
        transactionId: auditLog.id,
      });
    }

    // Anomaly alerts
    if (this.config.enableAnomalyAlerts && auditLog.anomalies) {
      const criticalAnomalies = auditLog.anomalies.filter((a: any) => a.severity === "critical");

      if (criticalAnomalies.length > 0) {
        alerts.push({
          type: "critical_anomaly",
          severity: "critical",
          message: `${criticalAnomalies.length} critical anomalies detected`,
          anomalies: criticalAnomalies,
        });
      }
    }

    // Process notifications if alerts exist
    if (alerts.length > 0 && this.config.notifications.dashboardAlerts) {
      await this.sendNotifications(alerts);
    }

    return alerts;
  }

  private async sendNotifications(alerts: any[]) {
    // Implementation would send actual notifications
    console.log("Sending notifications for alerts:", alerts);
  }

  private async logProcessingMetrics(event: IntegratedAuditEvent, processingTime: number) {
    // Log metrics for monitoring and optimization
    console.log(`Processed audit event ${event.transactionId} in ${processingTime}ms`);
  }

  private calculateOverallComplianceScore(scores: { bir: number; dpa: number; controls: number }) {
    const weights = { bir: 0.4, dpa: 0.3, controls: 0.3 };
    return Math.round(
      scores.bir * weights.bir + scores.dpa * weights.dpa + scores.controls * weights.controls
    );
  }

  private getRiskLevel(score: number): string {
    if (score < 20) return "very_low";
    if (score < 40) return "low";
    if (score < 60) return "medium";
    if (score < 80) return "high";
    return "critical";
  }

  private getDPAStatus(score: number): string {
    if (score >= 90) return "excellent";
    if (score >= 75) return "good";
    if (score >= 60) return "needs_improvement";
    return "non_compliant";
  }

  private getControlsStatus(effectiveness: number): string {
    if (effectiveness >= 90) return "strong";
    if (effectiveness >= 75) return "adequate";
    if (effectiveness >= 60) return "needs_strengthening";
    return "weak";
  }

  private async generateCurrentAlerts(projectId: string, period: { start: Date; end: Date }) {
    const alerts = [];

    // This would check various alert conditions
    // For now, return empty array

    return alerts;
  }

  private async generateActionItems(assessmentData: any) {
    const actionItems = [];

    // Generate action items based on assessment results
    if (assessmentData.birValidation.overallScore < 90) {
      actionItems.push({
        priority: "high",
        category: "bir_compliance",
        title: "Improve BIR Compliance",
        description: "Address BIR compliance issues to reach 90%+ score",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
    }

    if (assessmentData.riskAssessment.overallRiskScore > 70) {
      actionItems.push({
        priority: "high",
        category: "risk_management",
        title: "Reduce Risk Exposure",
        description: "Implement risk mitigation strategies",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      });
    }

    if (assessmentData.controlsAssessment.deficiencies.length > 0) {
      actionItems.push({
        priority: "medium",
        category: "internal_controls",
        title: "Address Control Deficiencies",
        description: `Fix ${assessmentData.controlsAssessment.deficiencies.length} control deficiencies`,
        dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
      });
    }

    return actionItems;
  }

  // Export helper methods
  private async exportBIRData(
    projectId: string,
    period: { start: Date; end: Date },
    format: string
  ) {
    return await auditReportGenerator.generateBIRExport(projectId, period, "2550M");
  }

  private async exportDPAData(projectId: string, format: string) {
    return await auditReportGenerator.generateDPAExport(projectId);
  }

  private async exportSECData(
    projectId: string,
    period: { start: Date; end: Date },
    format: string
  ) {
    // Implementation for SEC export
    return Buffer.from("SEC export data", "utf-8");
  }

  private async exportBSPData(
    projectId: string,
    period: { start: Date; end: Date },
    format: string
  ) {
    // Implementation for BSP export
    return Buffer.from("BSP export data", "utf-8");
  }

  // Utility methods for classification
  private isBIRReportable(transaction: any): boolean {
    const reportableTypes = ["income", "expense", "tax", "withholding"];
    return (
      reportableTypes.includes(transaction.entity.type) ||
      reportableTypes.some((type) => transaction.action.includes(type))
    );
  }

  private isTaxRelated(transaction: any): boolean {
    const taxKeywords = ["tax", "vat", "withholding", "bir"];
    return taxKeywords.some(
      (keyword) =>
        transaction.action.toLowerCase().includes(keyword) ||
        transaction.entity.type.toLowerCase().includes(keyword)
    );
  }

  private involvesPersonalData(transaction: any): boolean {
    const personalDataFields = ["name", "email", "phone", "address", "tin", "id"];
    const transactionString = JSON.stringify(transaction).toLowerCase();
    return personalDataFields.some((field) => transactionString.includes(field));
  }

  /**
   * Get integration status
   */
  async getIntegrationStatus(projectId: string): Promise<IntegrationStatus> {
    try {
      // Check if all systems are integrated and working
      const testResult = await this.performIntegrationHealthCheck(projectId);

      return {
        isIntegrated: testResult.success,
        lastSync: new Date(),
        errors: testResult.errors,
        metrics: testResult.metrics,
      };
    } catch (error) {
      return {
        isIntegrated: false,
        lastSync: new Date(),
        errors: [error instanceof Error ? error.message : "Unknown error"],
        metrics: {
          eventsProcessed: 0,
          anomaliesDetected: 0,
          complianceIssues: 0,
          riskAlertsGenerated: 0,
        },
      };
    }
  }

  private async performIntegrationHealthCheck(projectId: string) {
    const results = {
      success: true,
      errors: [] as string[],
      metrics: {
        eventsProcessed: 0,
        anomaliesDetected: 0,
        complianceIssues: 0,
        riskAlertsGenerated: 0,
      },
    };

    try {
      // Test audit trail service
      const testPeriod = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        end: new Date(),
      };

      const auditReport = await auditTrailService.generateAuditReport(
        projectId,
        testPeriod.start,
        testPeriod.end
      );

      results.metrics.eventsProcessed = auditReport.summary.totalEvents;
      results.metrics.anomaliesDetected = auditReport.summary.anomalies;
      results.metrics.complianceIssues = auditReport.summary.complianceIssues;
    } catch (error) {
      results.success = false;
      results.errors.push(`Audit trail service error: ${error}`);
    }

    // Test other components as needed
    // ...

    return results;
  }
}

// =============================================
// Export Service Instance
// =============================================

export const auditTrailIntegration = new AuditTrailIntegrationService();

// =============================================
// Export Convenience Functions
// =============================================

/**
 * Process a transaction through the integrated audit pipeline
 */
export async function processAuditEvent(transactionData: any, context: any) {
  return await auditTrailIntegration.processIntegratedAuditEvent(transactionData, context);
}

/**
 * Generate compliance dashboard for a project
 */
export async function getComplianceDashboard(
  projectId: string,
  period?: { start: Date; end: Date }
) {
  return await auditTrailIntegration.generateComplianceDashboard(projectId, period);
}

/**
 * Perform real-time compliance monitoring
 */
export async function monitorCompliance(projectId: string) {
  return await auditTrailIntegration.performRealTimeMonitoring(projectId);
}

/**
 * Export compliance data for regulatory submission
 */
export async function exportComplianceData(
  projectId: string,
  exportType: "bir" | "dpa" | "sec" | "bsp",
  period: { start: Date; end: Date },
  format?: "xml" | "csv" | "pdf" | "dat"
) {
  return await auditTrailIntegration.exportIntegratedComplianceData(
    projectId,
    exportType,
    period,
    format
  );
}

/**
 * Get integration status for a project
 */
export async function getIntegrationStatus(projectId: string) {
  return await auditTrailIntegration.getIntegrationStatus(projectId);
}

// =============================================
// Backward Compatibility
// =============================================

/**
 * Enhanced version of the original audit log function that integrates
 * with the new audit trail system while maintaining backward compatibility
 */
export async function enhancedAuditLog(params: any) {
  try {
    // First, log using the original audit system for backward compatibility
    await auditLog(params);

    // Then, if enabled, process through the enhanced system
    if (params.enhancedProcessing !== false) {
      const context = {
        source: "legacy_integration",
        sessionId: params.sessionId,
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      };

      await processAuditEvent(params, context);
    }
  } catch (error) {
    console.error("Enhanced audit logging failed:", error);
    // Ensure the original audit still works even if enhanced processing fails
    await auditLog(params);
  }
}
