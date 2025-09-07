/**
 * Compliance Monitor Service
 *
 * Main orchestration service for comprehensive Philippine business compliance monitoring.
 * Handles daily checks, deadline tracking, sequence integrity, and automated alert generation.
 *
 * Features:
 * - Scheduled daily compliance checks
 * - Real-time sequence integrity monitoring
 * - Philippine tax filing deadline tracking
 * - Business permit expiry monitoring
 * - Document compliance verification
 * - Automated multi-channel alerting
 */

import { Decimal } from "decimal.js";
import { logger } from "../logger";
import { auditLogger } from "../audit";
import type {
  ComplianceCheckResult,
  ComplianceDeadlineAlert,
  ComplianceAlertSeverity,
  ComplianceCategory,
  SequenceIntegrityResult,
  DocumentComplianceCheck,
  ComplianceMonitoringConfig,
  ComplianceMonitoringStats,
  AuditReadinessScore,
  ComplianceRecommendation,
  TaxFilingDeadline,
  PermitExpiryTracker,
  ComplianceHistoricalData,
} from "../compliance/types";

// Import checker services
import { DeadlineMonitor } from "../compliance/alerts/deadline-monitor";
import { SequenceMonitor } from "../compliance/alerts/sequence-monitor";
import { DocumentMonitor } from "../compliance/alerts/document-monitor";
import { NotificationService } from "../compliance/alerts/notification-service";

import { TaxComplianceChecker } from "../compliance/checkers/tax-compliance.checker";
import { PermitComplianceChecker } from "../compliance/checkers/permit-compliance.checker";
import { DocumentComplianceChecker } from "../compliance/checkers/document-compliance.checker";
import { AuditReadinessChecker } from "../compliance/checkers/audit-readiness.checker";

/**
 * Main compliance monitoring service
 */
export class ComplianceMonitorService {
  private deadlineMonitor: DeadlineMonitor;
  private sequenceMonitor: SequenceMonitor;
  private documentMonitor: DocumentMonitor;
  private notificationService: NotificationService;

  private taxChecker: TaxComplianceChecker;
  private permitChecker: PermitComplianceChecker;
  private documentChecker: DocumentComplianceChecker;
  private auditChecker: AuditReadinessChecker;

  private scheduledCheckTimer?: NodeJS.Timeout;
  private isRunning = false;
  private lastCheckResults = new Map<string, ComplianceCheckResult>();

  constructor() {
    this.deadlineMonitor = new DeadlineMonitor();
    this.sequenceMonitor = new SequenceMonitor();
    this.documentMonitor = new DocumentMonitor();
    this.notificationService = new NotificationService();

    this.taxChecker = new TaxComplianceChecker();
    this.permitChecker = new PermitComplianceChecker();
    this.documentChecker = new DocumentComplianceChecker();
    this.auditChecker = new AuditReadinessChecker();

    logger.info("ComplianceMonitorService initialized");
  }

  /**
   * Perform comprehensive daily compliance checks
   */
  async performDailyChecks(projectId: string): Promise<ComplianceIssue[]> {
    const startTime = Date.now();
    const checkId = `daily-${projectId}-${Date.now()}`;

    logger.info(`Starting daily compliance checks for project: ${projectId}`, {
      checkId,
      timestamp: new Date().toISOString(),
    });

    try {
      // Run parallel compliance checks
      const [deadlineAlerts, sequenceResults, documentChecks, auditReadiness] =
        await Promise.allSettled([
          this.checkDeadlines(projectId),
          this.verifyReceiptSequence(projectId),
          this.checkDocumentCompliance(projectId),
          this.assessAuditReadiness(projectId),
        ]);

      // Aggregate results and generate compliance report
      const checkResult = await this.aggregateCheckResults(
        checkId,
        projectId,
        deadlineAlerts,
        sequenceResults,
        documentChecks,
        auditReadiness
      );

      // Store results and send notifications
      this.lastCheckResults.set(projectId, checkResult);
      await this.processAlertsAndNotifications(checkResult);

      // Log audit trail
      await auditLogger.logEvent({
        eventType: "VIEW",
        entityType: "compliance_check",
        entityId: checkId,
        metadata: {
          projectId,
          overallScore: checkResult.overallScore,
          criticalIssueCount: checkResult.criticalIssues.length,
          duration: Date.now() - startTime,
        },
      });

      const executionTime = (Date.now() - startTime) / 1000;
      logger.info(`Daily compliance checks completed for project: ${projectId}`, {
        checkId,
        executionTime,
        overallScore: checkResult.overallScore,
        issuesFound: checkResult.criticalIssues.length,
      });

      // Return critical issues for immediate attention
      return checkResult.criticalIssues;
    } catch (error) {
      logger.error("Failed to perform daily compliance checks", {
        projectId,
        checkId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Check upcoming tax and permit deadlines
   */
  async checkDeadlines(projectId: string): Promise<ComplianceDeadlineAlert[]> {
    try {
      // Get project configuration
      const config = await this.getProjectConfig(projectId);

      // Check tax filing deadlines
      const taxDeadlines = await this.deadlineMonitor.checkTaxDeadlines(config);

      // Check permit expiry dates
      const permitDeadlines = await this.deadlineMonitor.checkPermitDeadlines(config);

      // Combine and prioritize alerts
      const allDeadlines = [...taxDeadlines, ...permitDeadlines];

      // Filter and sort by urgency
      return allDeadlines
        .filter((alert) => alert.daysUntilDeadline <= 30) // Only show next 30 days
        .sort((a, b) => {
          // Sort by severity first, then by days until deadline
          const severityOrder = {
            CRITICAL: 0,
            HIGH: 1,
            MEDIUM: 2,
            LOW: 3,
          };

          if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
          }

          return a.daysUntilDeadline - b.daysUntilDeadline;
        });
    } catch (error) {
      logger.error("Failed to check compliance deadlines", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Verify receipt sequence integrity for OR/SI gaps
   */
  async verifyReceiptSequence(projectId: string): Promise<SequenceIntegrityResult[]> {
    try {
      // Check Official Receipt sequences
      const orResults = await this.sequenceMonitor.checkSequenceIntegrity(projectId, "OR");

      // Check Sales Invoice sequences
      const siResults = await this.sequenceMonitor.checkSequenceIntegrity(projectId, "SI");

      const results = [orResults, siResults];

      // Log any critical sequence issues
      results.forEach((result) => {
        if (result.complianceScore < 95) {
          logger.warn(`Sequence integrity issues detected`, {
            projectId,
            documentType: result.documentType,
            score: result.complianceScore,
            gaps: result.gaps.length,
            duplicates: result.duplicates.length,
          });
        }
      });

      return results;
    } catch (error) {
      logger.error("Failed to verify receipt sequence", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Check document compliance and completeness
   */
  async checkDocumentCompliance(projectId: string): Promise<DocumentComplianceCheck[]> {
    try {
      return await this.documentMonitor.checkComplianceDocuments(projectId);
    } catch (error) {
      logger.error("Failed to check document compliance", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Assess audit readiness and generate compliance score
   */
  async assessAuditReadiness(projectId: string): Promise<AuditReadinessScore> {
    try {
      return await this.auditChecker.assessReadiness(projectId);
    } catch (error) {
      logger.error("Failed to assess audit readiness", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive compliance report
   */
  async generateComplianceReport(projectId: string): Promise<ComplianceCheckResult> {
    try {
      // Use cached results if recent (within last hour)
      const cachedResult = this.lastCheckResults.get(projectId);
      if (cachedResult && this.isResultRecent(cachedResult, 3600000)) {
        // 1 hour
        return cachedResult;
      }

      // Otherwise perform fresh check
      await this.performDailyChecks(projectId);
      return this.lastCheckResults.get(projectId)!;
    } catch (error) {
      logger.error("Failed to generate compliance report", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Schedule automated compliance checks
   */
  scheduleComplianceChecks(projectId: string, checkTime = "08:00"): void {
    try {
      // Clear existing timer
      if (this.scheduledCheckTimer) {
        clearTimeout(this.scheduledCheckTimer);
      }

      // Calculate next check time
      const nextCheckTime = this.calculateNextCheckTime(checkTime);
      const timeUntilNext = nextCheckTime.getTime() - Date.now();

      this.scheduledCheckTimer = setTimeout(async () => {
        try {
          await this.performDailyChecks(projectId);

          // Schedule next check (24 hours later)
          this.scheduleComplianceChecks(projectId, checkTime);
        } catch (error) {
          logger.error("Scheduled compliance check failed", {
            projectId,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          // Retry in 1 hour
          setTimeout(() => {
            this.scheduleComplianceChecks(projectId, checkTime);
          }, 3600000);
        }
      }, timeUntilNext);

      this.isRunning = true;

      logger.info(`Compliance checks scheduled for project: ${projectId}`, {
        checkTime,
        nextCheck: nextCheckTime.toISOString(),
      });
    } catch (error) {
      logger.error("Failed to schedule compliance checks", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Stop scheduled compliance checks
   */
  stopScheduledChecks(): void {
    if (this.scheduledCheckTimer) {
      clearTimeout(this.scheduledCheckTimer);
      this.scheduledCheckTimer = undefined;
    }
    this.isRunning = false;
    logger.info("Scheduled compliance checks stopped");
  }

  /**
   * Get compliance monitoring statistics
   */
  async getMonitoringStats(
    projectId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ComplianceMonitoringStats> {
    try {
      // Implementation would fetch from database
      // This is a placeholder for the structure
      return {
        periodStart,
        periodEnd,
        totalChecks: 0,
        alertsGenerated: 0,
        alertsByCategory: {} as any,
        alertsBySeverity: {} as any,
        averageResolutionTime: 0,
        complianceScoreTrend: [],
        deadlinesMissed: 0,
        deadlinesMet: 0,
        sequenceIssuesDetected: 0,
        sequenceIssuesResolved: 0,
        auditReadinessImprovement: 0,
        topIssueCategories: [],
      };
    } catch (error) {
      logger.error("Failed to get monitoring statistics", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update compliance monitoring configuration
   */
  async updateConfiguration(
    projectId: string,
    config: Partial<ComplianceMonitoringConfig>
  ): Promise<void> {
    try {
      // Update configuration in database
      // Implementation would update the stored configuration

      // Restart scheduled checks if timing changed
      if (config.monitoringSettings?.checkTime) {
        this.scheduleComplianceChecks(projectId, config.monitoringSettings.checkTime);
      }

      logger.info("Compliance monitoring configuration updated", {
        projectId,
        configKeys: Object.keys(config),
      });
    } catch (error) {
      logger.error("Failed to update compliance configuration", {
        projectId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Private helper methods

  private async aggregateCheckResults(
    checkId: string,
    projectId: string,
    deadlineAlerts: PromiseSettledResult<ComplianceDeadlineAlert[]>,
    sequenceResults: PromiseSettledResult<SequenceIntegrityResult[]>,
    documentChecks: PromiseSettledResult<DocumentComplianceCheck[]>,
    auditReadiness: PromiseSettledResult<AuditReadinessScore>
  ): Promise<ComplianceCheckResult> {
    const now = new Date();

    // Extract successful results
    const deadlines = deadlineAlerts.status === "fulfilled" ? deadlineAlerts.value : [];
    const sequences = sequenceResults.status === "fulfilled" ? sequenceResults.value : [];
    const documents = documentChecks.status === "fulfilled" ? documentChecks.value : [];
    const audit = auditReadiness.status === "fulfilled" ? auditReadiness.value : null;

    // Calculate overall compliance score
    const overallScore = this.calculateOverallScore(sequences, documents, audit);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      deadlines,
      sequences,
      documents,
      audit
    );

    return {
      checkId,
      projectId,
      checkDate: now,
      overallScore,
      categories: this.calculateCategoryScores(sequences, documents, audit),
      criticalIssues: deadlines.filter(
        (alert) => alert.severity === "CRITICAL" || alert.daysUntilDeadline <= 2
      ),
      upcomingDeadlines: deadlines.filter(
        (alert) => alert.daysUntilDeadline <= 30 && alert.severity !== "CRITICAL"
      ),
      sequenceIntegrity: sequences,
      documentCompliance: documents,
      auditReadiness: audit || {
        overallScore: 0,
        documentationScore: 0,
        recordKeepingScore: 0,
        taxComplianceScore: 0,
        internalControlsScore: 0,
        riskAssessment: "HIGH",
        readinessLevel: "NOT_READY",
        deficiencies: [],
        strengths: [],
      },
      recommendations,
      nextCheckDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      checkDuration: 0, // Will be updated after completion
    };
  }

  private async processAlertsAndNotifications(result: ComplianceCheckResult): Promise<void> {
    try {
      // Send critical alerts immediately
      for (const alert of result.criticalIssues) {
        await this.notificationService.sendAlert(alert, "IMMEDIATE");
      }

      // Send upcoming deadline notifications
      for (const alert of result.upcomingDeadlines) {
        await this.notificationService.sendAlert(alert, "SCHEDULED");
      }
    } catch (error) {
      logger.error("Failed to process alerts and notifications", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private calculateOverallScore(
    sequences: SequenceIntegrityResult[],
    documents: DocumentComplianceCheck[],
    audit: AuditReadinessScore | null
  ): number {
    let totalScore = 0;
    let weightSum = 0;

    // Sequence integrity weight: 30%
    if (sequences.length > 0) {
      const avgSequenceScore =
        sequences.reduce((sum, seq) => sum + seq.complianceScore, 0) / sequences.length;
      totalScore += avgSequenceScore * 0.3;
      weightSum += 0.3;
    }

    // Document compliance weight: 30%
    if (documents.length > 0) {
      const avgDocumentScore =
        documents.reduce((sum, doc) => sum + doc.complianceScore, 0) / documents.length;
      totalScore += avgDocumentScore * 0.3;
      weightSum += 0.3;
    }

    // Audit readiness weight: 40%
    if (audit) {
      totalScore += audit.overallScore * 0.4;
      weightSum += 0.4;
    }

    return weightSum > 0 ? Math.round(totalScore / weightSum) : 0;
  }

  private calculateCategoryScores(
    sequences: SequenceIntegrityResult[],
    documents: DocumentComplianceCheck[],
    audit: AuditReadinessScore | null
  ): any[] {
    // Implementation would calculate detailed category scores
    return [];
  }

  private async generateRecommendations(
    deadlines: ComplianceDeadlineAlert[],
    sequences: SequenceIntegrityResult[],
    documents: DocumentComplianceCheck[],
    audit: AuditReadinessScore | null
  ): Promise<ComplianceRecommendation[]> {
    const recommendations: ComplianceRecommendation[] = [];

    // Generate deadline-based recommendations
    deadlines
      .filter((alert) => alert.severity === "HIGH" || alert.severity === "CRITICAL")
      .forEach((alert) => {
        recommendations.push({
          category: alert.category,
          priority: alert.severity,
          title: `Address ${alert.title}`,
          description: alert.description,
          actionSteps: alert.actionRequired,
          estimatedEffort: alert.estimatedTimeToComplete / 60, // Convert to hours
          implementBy: alert.deadlineDate,
        });
      });

    // Add sequence integrity recommendations
    sequences
      .filter((seq) => seq.complianceScore < 95)
      .forEach((seq) => {
        recommendations.push({
          category: "SEQUENCE_COMPLIANCE" as ComplianceCategory,
          priority: seq.complianceScore < 80 ? "HIGH" : "MEDIUM",
          title: `Improve ${seq.documentType} Sequence Integrity`,
          description: `Address ${seq.gaps.length} gaps and ${seq.duplicates.length} duplicates`,
          actionSteps: [
            "Review sequence generation process",
            "Investigate missing numbers",
            "Implement stronger controls",
            "Train staff on proper procedures",
          ],
          estimatedEffort: seq.gaps.length * 0.5 + seq.duplicates.length * 1, // 30min per gap, 1hr per duplicate
        });
      });

    return recommendations;
  }

  private async getProjectConfig(projectId: string): Promise<ComplianceMonitoringConfig> {
    // Implementation would fetch from database
    // This is a placeholder
    return {
      projectId,
      businessType: "RESORT",
      location: {
        municipality: "San Juan",
        province: "La Union",
        region: "Region I",
      },
      taxSettings: {
        isVATRegistered: true,
        tin: "000-000-000-000",
        rdoCode: "RDO000",
        registrationType: "VAT",
      },
      monitoringSettings: {
        dailyChecksEnabled: true,
        checkTime: "08:00",
        alertChannels: ["EMAIL", "PUSH"],
        criticalAlertChannels: ["EMAIL", "SMS", "PUSH"],
        reminderDays: [30, 15, 7, 3, 1],
      },
      customDeadlines: [],
      exemptions: [],
      lastConfigUpdate: new Date(),
      configuredBy: "system",
    };
  }

  private calculateNextCheckTime(checkTime: string): Date {
    const [hours, minutes] = checkTime.split(":").map((num) => parseInt(num, 10));
    const nextCheck = new Date();
    nextCheck.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (nextCheck.getTime() <= Date.now()) {
      nextCheck.setDate(nextCheck.getDate() + 1);
    }

    return nextCheck;
  }

  private isResultRecent(result: ComplianceCheckResult, maxAgeMs: number): boolean {
    return Date.now() - result.checkDate.getTime() < maxAgeMs;
  }
}

// Export singleton instance
export const complianceMonitor = new ComplianceMonitorService();
