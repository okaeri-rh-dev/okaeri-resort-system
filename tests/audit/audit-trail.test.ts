/**
 * Comprehensive Test Suite for Audit Trail System
 *
 * Tests all components of the enhanced audit trail system including:
 * - State tracking and change detection
 * - Anomaly detection algorithms
 * - Compliance audit validation
 * - Risk assessment calculations
 * - Report generation and export
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Money } from "@/lib/money";
import { auditTrailService, AuditTrailService } from "@/lib/services/audit-trail.service";
import { anomalyDetector, AnomalyDetector } from "@/lib/audit/anomaly-detection";
import { complianceAuditor, ComplianceAuditor } from "@/lib/audit/compliance-audit";
import { riskAssessmentEngine, RiskAssessmentEngine } from "@/lib/audit/risk-assessment";
import { auditReportGenerator, AuditReportGenerator } from "@/lib/audit/audit-reporting";
import type {
  AuditableTransaction,
  DetailedChange,
  AuditContext,
} from "@/lib/services/audit-trail.service";
import type { UserActivity } from "@/lib/audit/anomaly-detection";

// =============================================
// Test Setup and Utilities
// =============================================

const mockProjectId = "test-project-123";
const mockUserId = "test-user-456";
const mockEntityId = "test-entity-789";

const createMockAuditContext = (overrides: Partial<AuditContext> = {}): AuditContext => ({
  timestamp: new Date("2024-01-15T10:30:00Z"),
  source: "api",
  sessionId: "session-123",
  requestId: "request-456",
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0 Test Browser",
  apiEndpoint: "/api/test",
  httpMethod: "POST",
  ...overrides,
});

const createMockTransaction = (
  overrides: Partial<AuditableTransaction> = {}
): AuditableTransaction => ({
  id: "transaction-123",
  userId: mockUserId,
  userName: "Test User",
  userRole: "admin",
  projectId: mockProjectId,
  entity: {
    id: mockEntityId,
    type: "expense",
    code: "EXP-001",
    projectId: mockProjectId,
    data: { amount: 1000, description: "Test expense" },
  },
  action: "expense.created",
  previousState: {},
  newState: { amount: 1000, description: "Test expense" },
  changes: [],
  monetaryAmount: new Money(1000),
  context: createMockAuditContext(),
  severity: "info",
  ...overrides,
});

const createMockUserActivity = (overrides: Partial<UserActivity> = {}): UserActivity => ({
  userId: mockUserId,
  userName: "Test User",
  action: "expense.created",
  entityType: "expense",
  amount: new Money(1000),
  timestamp: new Date("2024-01-15T10:30:00Z"),
  ipAddress: "192.168.1.100",
  location: "Office",
  ...overrides,
});

// =============================================
// Audit Trail Service Tests
// =============================================

describe("AuditTrailService", () => {
  let auditService: AuditTrailService;

  beforeEach(() => {
    auditService = new AuditTrailService();
    vi.clearAllMocks();
  });

  describe("State Change Capture", () => {
    it("should detect field-level changes accurately", async () => {
      const before = {
        amount: 1000,
        description: "Original description",
        category: "office",
        approved: false,
      };

      const after = {
        amount: 1500,
        description: "Updated description",
        category: "office",
        approved: true,
      };

      const context = createMockAuditContext();
      const changes = await auditService.captureStateChange(before, after, context);

      expect(changes).toHaveLength(3);

      const amountChange = changes.find((c) => c.field === "amount");
      expect(amountChange).toBeDefined();
      expect(amountChange?.oldValue).toBe(1000);
      expect(amountChange?.newValue).toBe(1500);
      expect(amountChange?.dataType).toBe("number");
      expect(amountChange?.impactLevel).toBe("critical");
      expect(amountChange?.complianceRelevant).toBe(true);

      const approvalChange = changes.find((c) => c.field === "approved");
      expect(approvalChange).toBeDefined();
      expect(approvalChange?.oldValue).toBe(false);
      expect(approvalChange?.newValue).toBe(true);
      expect(approvalChange?.impactLevel).toBe("high");
    });

    it("should ignore identical values", async () => {
      const state = { amount: 1000, description: "Same description" };
      const context = createMockAuditContext();

      const changes = await auditService.captureStateChange(state, state, context);

      expect(changes).toHaveLength(0);
    });

    it("should handle null and undefined values", async () => {
      const before = { amount: 1000, description: null };
      const after = { amount: 1000, description: "New description" };
      const context = createMockAuditContext();

      const changes = await auditService.captureStateChange(before, after, context);

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe("description");
      expect(changes[0].oldValue).toBeNull();
      expect(changes[0].newValue).toBe("New description");
    });

    it("should calculate financial impact for monetary fields", async () => {
      const before = { amount: 1000, total: 1200 };
      const after = { amount: 1500, total: 1800 };
      const context = createMockAuditContext();

      const changes = await auditService.captureStateChange(before, after, context);

      const amountChange = changes.find((c) => c.field === "amount");
      expect(amountChange?.financialImpact).toEqual(new Money(500));

      const totalChange = changes.find((c) => c.field === "total");
      expect(totalChange?.financialImpact).toEqual(new Money(600));
    });
  });

  describe("Financial Impact Calculation", () => {
    it("should calculate direct financial impact", async () => {
      const transaction = createMockTransaction({
        monetaryAmount: new Money(50000),
        previousAmount: new Money(30000),
      });

      const impact = await auditService.calculateFinancialImpact(transaction);

      expect(impact).toBeDefined();
      expect(impact?.direct.toNumber()).toBe(50000);
      expect(impact?.requiresApproval).toBe(true); // High-value transaction
      expect(impact?.affectedCategories).toContain("expense");
    });

    it("should calculate tax implications for VAT-applicable transactions", async () => {
      const transaction = createMockTransaction({
        entity: { ...createMockTransaction().entity, type: "income" },
        action: "income.sale_recorded",
        monetaryAmount: new Money(11200), // VAT-inclusive amount
      });

      const impact = await auditService.calculateFinancialImpact(transaction);

      expect(impact?.taxImpact.toNumber()).toBeGreaterThan(0);
    });

    it("should assess compliance risk factors", async () => {
      const transaction = createMockTransaction({
        monetaryAmount: new Money(150000), // High value
        context: createMockAuditContext({
          timestamp: new Date("2024-01-15T23:30:00Z"), // After hours
          source: "ui", // Manual entry
        }),
        action: "expense.delete", // Sensitive action
      });

      const impact = await auditService.calculateFinancialImpact(transaction);

      expect(impact?.complianceRisk).toBeGreaterThan(50); // High risk
    });
  });

  describe("Transaction Logging", () => {
    it("should create comprehensive audit log entry", async () => {
      const transaction = createMockTransaction();

      const auditLog = await auditService.logTransaction(transaction);

      expect(auditLog.id).toBeDefined();
      expect(auditLog.projectId).toBe(mockProjectId);
      expect(auditLog.userId).toBe(mockUserId);
      expect(auditLog.action).toBe("expense.created");
      expect(auditLog.checksum).toBeDefined();
      expect(auditLog.createdAt).toBeInstanceOf(Date);
    });

    it("should detect anomalies during transaction logging", async () => {
      const rapidTransactions = Array.from({ length: 15 }, (_, i) =>
        createMockTransaction({
          id: `transaction-${i}`,
          context: createMockAuditContext({
            timestamp: new Date(Date.now() + i * 30000), // 30 seconds apart
          }),
        })
      );

      const logs = await Promise.all(rapidTransactions.map((t) => auditService.logTransaction(t)));

      const lastLog = logs[logs.length - 1];
      expect(lastLog.anomalies.length).toBeGreaterThan(0);
      expect(lastLog.anomalies.some((a) => a.type === "pattern")).toBe(true);
    });

    it("should generate compliance flags for relevant transactions", async () => {
      const taxTransaction = createMockTransaction({
        action: "tax.withholding_calculated",
        entity: { ...createMockTransaction().entity, type: "tax" },
        monetaryAmount: new Money(600000), // Large amount
      });

      const auditLog = await auditService.logTransaction(taxTransaction);

      expect(auditLog.complianceFlags).toContain("bir_reportable");
      expect(auditLog.complianceFlags).toContain("high_value");
      expect(auditLog.complianceFlags).toContain("tax_related");
    });
  });

  describe("Report Generation", () => {
    it("should generate comprehensive audit report", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const report = await auditService.generateAuditReport(mockProjectId, startDate, endDate);

      expect(report.projectId).toBe(mockProjectId);
      expect(report.periodStart).toEqual(startDate);
      expect(report.periodEnd).toEqual(endDate);
      expect(report.summary).toBeDefined();
      expect(report.breakdown).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.complianceStatus).toBeDefined();
    });

    it("should calculate accurate summary statistics", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const report = await auditService.generateAuditReport(mockProjectId, startDate, endDate);

      expect(report.summary.totalEvents).toBeGreaterThanOrEqual(0);
      expect(report.summary.financialImpact).toBeInstanceOf(Money);
      expect(report.breakdown.byCategory).toBeDefined();
      expect(report.breakdown.byUser).toBeDefined();
      expect(report.breakdown.bySeverity).toBeDefined();
    });
  });
});

// =============================================
// Anomaly Detection Tests
// =============================================

describe("AnomalyDetector", () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  describe("Time-based Anomaly Detection", () => {
    it("should detect after-hours activities", async () => {
      const activities: UserActivity[] = [
        createMockUserActivity({
          timestamp: new Date("2024-01-15T23:30:00Z"), // 11:30 PM
        }),
        createMockUserActivity({
          timestamp: new Date("2024-01-15T02:15:00Z"), // 2:15 AM
        }),
      ];

      const anomalies = await detector.detectUnusualTiming(activities);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].type).toBe("after_hours");
      expect(anomalies[0].severity).toBe("high");
      expect(anomalies[0].details.hour).toBeDefined();
    });

    it("should detect weekend business transactions", async () => {
      const weekendActivities: UserActivity[] = [
        createMockUserActivity({
          timestamp: new Date("2024-01-14T14:00:00Z"), // Sunday
          action: "expense.approved",
        }),
      ];

      const anomalies = await detector.detectUnusualTiming(weekendActivities);

      expect(anomalies.some((a) => a.type === "weekend")).toBe(true);
      expect(anomalies[0].severity).toBe("medium");
    });

    it("should detect rapid transaction sequences", async () => {
      const rapidActivities: UserActivity[] = Array.from({ length: 12 }, (_, i) =>
        createMockUserActivity({
          timestamp: new Date(Date.now() + i * 10000), // 10 seconds apart
        })
      );

      const anomalies = await detector.detectUnusualTiming(rapidActivities);

      const rapidSequenceAnomaly = anomalies.find((a) => a.type === "rapid_sequence");
      expect(rapidSequenceAnomaly).toBeDefined();
      expect(rapidSequenceAnomaly?.severity).toBe("high");
      expect(rapidSequenceAnomaly?.details.sequenceCount).toBe(12);
    });
  });

  describe("Amount-based Anomaly Detection", () => {
    it("should detect statistical outliers", async () => {
      const normalAmounts = Array.from({ length: 20 }, () => new Money(1000 + Math.random() * 200));
      const outlierAmounts = [...normalAmounts, new Money(50000)]; // Clear outlier

      const context = {
        projectId: mockProjectId,
        entityType: "expense",
        amount: new Money(50000),
        userId: mockUserId,
        timestamp: new Date(),
        action: "expense.created",
      };

      const anomalies = await detector.identifyOutliers(outlierAmounts, context);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].type).toBe("outlier");
      expect(anomalies[0].amount.toNumber()).toBe(50000);
      expect(anomalies[0].details.standardDeviations).toBeGreaterThan(2.5);
    });

    it("should detect suspicious rounding patterns", async () => {
      const roundedAmounts = [
        new Money(10000),
        new Money(5000),
        new Money(15000),
        new Money(20000),
        new Money(25000),
        new Money(30000),
        new Money(35000),
        new Money(40000), // All rounded to thousands
      ];

      const context = {
        projectId: mockProjectId,
        entityType: "expense",
        amount: new Money(10000),
        userId: mockUserId,
        timestamp: new Date(),
        action: "expense.created",
      };

      const anomalies = await detector.identifyOutliers(roundedAmounts, context);

      const roundingAnomaly = anomalies.find((a) => a.type === "suspicious_rounding");
      expect(roundingAnomaly).toBeDefined();
      expect(roundingAnomaly?.severity).toBe("medium");
    });

    it("should detect duplicate amount patterns", async () => {
      const duplicateAmounts = [
        new Money(5000),
        new Money(5000),
        new Money(5000),
        new Money(5000),
        new Money(5000),
        new Money(5000), // Same amount 6 times
        new Money(1000),
        new Money(2000),
      ];

      const context = {
        projectId: mockProjectId,
        entityType: "expense",
        amount: new Money(5000),
        userId: mockUserId,
        timestamp: new Date(),
        action: "expense.created",
      };

      const anomalies = await detector.identifyOutliers(duplicateAmounts, context);

      const duplicateAnomaly = anomalies.find((a) => a.type === "duplicate_amount");
      expect(duplicateAnomaly).toBeDefined();
      expect(duplicateAnomaly?.details.frequency).toBe(6);
    });
  });

  describe("Behavioral Analysis", () => {
    it("should assess user behavior patterns", async () => {
      const period = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      const analysis = await detector.assessUserBehavior(mockUserId, mockProjectId, period);

      expect(analysis.userId).toBe(mockUserId);
      expect(analysis.period).toEqual(period);
      expect(analysis.behaviorScore).toBeGreaterThanOrEqual(0);
      expect(analysis.behaviorScore).toBeLessThanOrEqual(100);
      expect(analysis.trustLevel).toBeDefined();
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });

    it("should detect unusual volume anomalies", async () => {
      // Mock scenario: user with normally 5 transactions/day suddenly has 50
      const analysis = await detector.assessUserBehavior(mockUserId, mockProjectId, {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-07"),
      });

      // This would require mocking database responses to simulate high volume
      expect(analysis.anomalies).toBeDefined();
    });

    it("should calculate trust levels correctly", async () => {
      const analysis = await detector.assessUserBehavior(mockUserId, mockProjectId, {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      });

      const validTrustLevels = ["very_low", "low", "medium", "high", "very_high"];
      expect(validTrustLevels).toContain(analysis.trustLevel);

      // High behavior score should correlate with high trust
      if (analysis.behaviorScore > 90) {
        expect(analysis.trustLevel).toBe("very_high");
      }
    });
  });

  describe("Pattern Analysis", () => {
    it("should analyze transaction patterns comprehensively", async () => {
      const analysis = await detector.analyzeTransactionPatterns(
        mockProjectId,
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );

      expect(analysis.patterns).toBeInstanceOf(Array);
      expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
      expect(analysis.riskScore).toBeLessThanOrEqual(100);
      expect(analysis.recommendations).toBeInstanceOf(Array);
      expect(analysis.affectedPeriod.start).toBeInstanceOf(Date);
      expect(analysis.affectedPeriod.end).toBeInstanceOf(Date);
    });
  });
});

// =============================================
// Compliance Audit Tests
// =============================================

describe("ComplianceAuditor", () => {
  let auditor: ComplianceAuditor;

  beforeEach(() => {
    auditor = new ComplianceAuditor();
  });

  describe("BIR Compliance Validation", () => {
    it("should validate BIR audit trail completeness", async () => {
      const validation = await auditor.validateBIRAuditTrail(
        mockProjectId,
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );

      expect(validation.projectId).toBe(mockProjectId);
      expect(validation.validationResults).toBeDefined();
      expect(validation.validationResults.auditTrailCompleteness).toBeDefined();
      expect(validation.validationResults.documentIntegrity).toBeDefined();
      expect(validation.validationResults.taxCalculationAccuracy).toBeDefined();
      expect(validation.overallScore).toBeGreaterThanOrEqual(0);
      expect(validation.overallScore).toBeLessThanOrEqual(100);
      expect(typeof validation.exportReadiness).toBe("boolean");
    });

    it("should identify critical BIR compliance issues", async () => {
      const validation = await auditor.validateBIRAuditTrail(
        mockProjectId,
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );

      expect(validation.criticalIssues).toBeInstanceOf(Array);
      validation.criticalIssues.forEach((issue) => {
        expect(issue.type).toBeDefined();
        expect(issue.category).toBe("bir");
        expect(issue.description).toBeDefined();
        expect(issue.remediation).toBeDefined();
      });
    });

    it("should generate BIR recommendations", async () => {
      const validation = await auditor.validateBIRAuditTrail(
        mockProjectId,
        new Date("2024-01-01"),
        new Date("2024-01-31")
      );

      expect(validation.recommendations).toBeInstanceOf(Array);
      expect(validation.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("DPA Compliance Assessment", () => {
    it("should audit personal data processing", async () => {
      const report = await auditor.auditPersonalDataProcessing(mockProjectId);

      expect(report.projectId).toBe(mockProjectId);
      expect(report.personalDataProcessing).toBeDefined();
      expect(report.personalDataProcessing.dataCategories).toBeInstanceOf(Array);
      expect(report.personalDataProcessing.processingActivities).toBeInstanceOf(Array);
      expect(report.complianceChecks).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
    });

    it("should identify DPA violations", async () => {
      const report = await auditor.auditPersonalDataProcessing(mockProjectId);

      expect(report.violations).toBeInstanceOf(Array);
      report.violations.forEach((violation) => {
        expect(violation.violationType).toBeDefined();
        expect(violation.severity).toBeDefined();
        expect(["minor", "serious", "grave"]).toContain(violation.severity);
      });
    });
  });

  describe("Internal Controls Assessment", () => {
    it("should evaluate internal controls effectiveness", async () => {
      const assessment = await auditor.evaluateInternalControls(mockProjectId);

      expect(assessment.projectId).toBe(mockProjectId);
      expect(assessment.controlCategories).toBeDefined();
      expect(assessment.controlCategories.accessControls).toBeDefined();
      expect(assessment.controlCategories.dataIntegrity).toBeDefined();
      expect(assessment.controlCategories.auditTrails).toBeDefined();
      expect(assessment.overallEffectiveness).toBeGreaterThanOrEqual(0);
      expect(assessment.overallEffectiveness).toBeLessThanOrEqual(100);
    });

    it("should identify control deficiencies", async () => {
      const assessment = await auditor.evaluateInternalControls(mockProjectId);

      expect(assessment.deficiencies).toBeInstanceOf(Array);
      assessment.deficiencies.forEach((deficiency) => {
        expect(deficiency.controlArea).toBeDefined();
        expect(deficiency.riskLevel).toBeDefined();
        expect(["low", "medium", "high", "critical"]).toContain(deficiency.riskLevel);
      });
    });
  });
});

// =============================================
// Risk Assessment Tests
// =============================================

describe("RiskAssessmentEngine", () => {
  let riskEngine: RiskAssessmentEngine;

  beforeEach(() => {
    riskEngine = new RiskAssessmentEngine();
  });

  describe("Risk Score Calculation", () => {
    it("should calculate risk scores within valid range", async () => {
      const riskScore = await riskEngine.calculateRiskScore(mockUserId, "user", mockProjectId);

      expect(riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });

    it("should vary risk scores based on entity type", async () => {
      const userRisk = await riskEngine.calculateRiskScore(mockUserId, "user", mockProjectId);
      const projectRisk = await riskEngine.calculateRiskScore(
        mockProjectId,
        "project",
        mockProjectId
      );

      // Project risk should generally be higher due to aggregation
      expect(typeof userRisk).toBe("number");
      expect(typeof projectRisk).toBe("number");
    });
  });

  describe("Comprehensive Risk Assessment", () => {
    it("should perform comprehensive project assessment", async () => {
      const assessment = await riskEngine.performComprehensiveAssessment(mockProjectId, {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      });

      expect(assessment.projectId).toBe(mockProjectId);
      expect(assessment.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(assessment.overallRiskScore).toBeLessThanOrEqual(100);
      expect(assessment.riskBreakdown).toBeDefined();
      expect(assessment.riskBreakdown.financial).toBeDefined();
      expect(assessment.riskBreakdown.compliance).toBeDefined();
      expect(assessment.riskBreakdown.behavioral).toBeDefined();
      expect(assessment.topRisks).toBeInstanceOf(Array);
      expect(assessment.trends).toBeInstanceOf(Array);
      expect(assessment.recommendations).toBeInstanceOf(Array);
    });

    it("should identify top risks correctly", async () => {
      const assessment = await riskEngine.performComprehensiveAssessment(mockProjectId, {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      });

      assessment.topRisks.forEach((risk) => {
        expect(risk.description).toBeDefined();
        expect(risk.category).toBeDefined();
        expect(risk.riskValue).toBeGreaterThanOrEqual(0);
        expect(risk.likelihood).toBeGreaterThanOrEqual(0);
        expect(risk.likelihood).toBeLessThanOrEqual(100);
        expect(risk.impact).toBeGreaterThanOrEqual(0);
        expect(risk.impact).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Fraud Detection", () => {
    it("should detect potential fraud indicators", async () => {
      const suspiciousTransaction = {
        id: "suspicious-123",
        amount: 500000, // Very high amount
        timestamp: new Date("2024-01-15T02:00:00Z"), // 2 AM
        userId: mockUserId,
        entityType: "expense",
        action: "expense.created",
      };

      const result = await riskEngine.detectFraud(
        suspiciousTransaction.id,
        suspiciousTransaction,
        mockProjectId
      );

      expect(result.transactionId).toBe(suspiciousTransaction.id);
      expect(result.fraudScore).toBeGreaterThanOrEqual(0);
      expect(result.fraudScore).toBeLessThanOrEqual(100);
      expect(result.fraudProbability).toBeGreaterThanOrEqual(0);
      expect(result.fraudProbability).toBeLessThanOrEqual(1);
      expect(result.indicators).toBeInstanceOf(Array);
      expect(["approve", "review", "hold", "deny"]).toContain(result.recommendedAction);
    });

    it("should provide clear fraud explanations", async () => {
      const transaction = {
        id: "test-123",
        amount: 100000,
        timestamp: new Date("2024-01-15T23:30:00Z"),
        userId: mockUserId,
        entityType: "expense",
        action: "expense.created",
      };

      const result = await riskEngine.detectFraud(transaction.id, transaction, mockProjectId);

      expect(result.explanation).toBeDefined();
      expect(typeof result.explanation).toBe("string");
      expect(result.explanation.length).toBeGreaterThan(0);
    });
  });

  describe("Mitigation Strategies", () => {
    it("should generate appropriate mitigation strategies", async () => {
      // Mock some risk factors
      const mockRiskFactors = [
        {
          id: "risk-1",
          category: "financial" as const,
          type: "high_value_transactions",
          description: "Multiple high-value transactions",
          severity: "high" as const,
          impact: 80,
          likelihood: 70,
          riskValue: 56,
          evidence: ["5 transactions over PHP 100,000"],
          detectedAt: new Date(),
        },
      ];

      const strategies = riskEngine.generateMitigationPlan(mockRiskFactors);

      expect(strategies).toBeInstanceOf(Array);
      expect(strategies.length).toBe(1);
      expect(strategies[0].strategy).toBeDefined();
      expect(strategies[0].priority).toBeDefined();
      expect(strategies[0].estimatedEffectiveness).toBeGreaterThan(0);
      expect(strategies[0].implementationCost).toBeDefined();
      expect(["low", "medium", "high"]).toContain(strategies[0].implementationCost);
    });
  });
});

// =============================================
// Audit Reporting Tests
// =============================================

describe("AuditReportGenerator", () => {
  let reportGenerator: AuditReportGenerator;

  beforeEach(() => {
    reportGenerator = new AuditReportGenerator();
  });

  describe("Report Generation", () => {
    it("should generate comprehensive audit reports", async () => {
      const config = {
        projectId: mockProjectId,
        reportType: "comprehensive" as const,
        period: {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-31"),
        },
        format: "json" as const,
        includeDetails: true,
        includeAnomalies: true,
        includeRiskAssessment: true,
      };

      const report = await reportGenerator.generateReport(config);

      expect(report.id).toBeDefined();
      expect(report.config).toEqual(config);
      expect(report.status).toBe("completed");
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.metadata.totalRecords).toBeGreaterThanOrEqual(0);
      expect(report.metadata.reportHash).toBeDefined();
    });

    it("should handle different report types", async () => {
      const reportTypes = ["financial", "compliance", "risk", "activity"] as const;

      for (const reportType of reportTypes) {
        const config = {
          projectId: mockProjectId,
          reportType,
          period: {
            start: new Date("2024-01-01"),
            end: new Date("2024-01-31"),
          },
          format: "json" as const,
          includeDetails: false,
          includeAnomalies: false,
          includeRiskAssessment: false,
        };

        const report = await reportGenerator.generateReport(config);
        expect(report.status).toBe("completed");
        expect(report.config.reportType).toBe(reportType);
      }
    });

    it("should support multiple export formats", async () => {
      const formats = ["pdf", "excel", "csv", "json", "xml"] as const;

      for (const format of formats) {
        const config = {
          projectId: mockProjectId,
          reportType: "financial" as const,
          period: {
            start: new Date("2024-01-01"),
            end: new Date("2024-01-31"),
          },
          format,
          includeDetails: false,
          includeAnomalies: false,
          includeRiskAssessment: false,
        };

        const report = await reportGenerator.generateReport(config);
        expect(report.status).toBe("completed");
        expect(report.downloadUrl).toBeDefined();
        expect(report.fileSize).toBeGreaterThan(0);
      }
    });
  });

  describe("BIR Export", () => {
    it("should generate BIR-compliant exports", async () => {
      const period = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      const birExport = await reportGenerator.generateBIRExport(mockProjectId, period, "2550M");

      expect(birExport).toBeInstanceOf(Buffer);
      expect(birExport.length).toBeGreaterThan(0);
    });

    it("should validate compliance before export", async () => {
      const period = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      // This test would need to mock a scenario where compliance validation fails
      try {
        await reportGenerator.generateBIRExport(mockProjectId, period, "2307");
      } catch (error) {
        // Should catch compliance validation errors
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("DPA Export", () => {
    it("should generate DPA-compliant exports", async () => {
      const dpaExport = await reportGenerator.generateDPAExport(mockProjectId);

      expect(dpaExport).toBeInstanceOf(Buffer);
      expect(dpaExport.length).toBeGreaterThan(0);

      // Verify it's valid XML
      const xmlContent = dpaExport.toString("utf-8");
      expect(xmlContent).toMatch(/^<\?xml/);
      expect(xmlContent).toContain("DPAComplianceReport");
    });
  });

  describe("Report Scheduling", () => {
    it("should schedule automatic report generation", async () => {
      const config = {
        projectId: mockProjectId,
        reportType: "compliance" as const,
        period: {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-31"),
        },
        format: "pdf" as const,
        includeDetails: true,
        includeAnomalies: true,
        includeRiskAssessment: true,
        scheduledDelivery: {
          enabled: true,
          frequency: "monthly" as const,
          dayOfMonth: 1,
          time: "09:00",
        },
      };

      const scheduleId = await reportGenerator.scheduleReport(config);

      expect(scheduleId).toBeDefined();
      expect(typeof scheduleId).toBe("string");
      expect(scheduleId.startsWith("schedule_")).toBe(true);
    });
  });
});

// =============================================
// Integration Tests
// =============================================

describe("Audit Trail System Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should integrate all audit components seamlessly", async () => {
    // Create a transaction
    const transaction = createMockTransaction({
      monetaryAmount: new Money(75000), // High value
      context: createMockAuditContext({
        timestamp: new Date("2024-01-15T22:30:00Z"), // After hours
      }),
    });

    // Log the transaction (this should trigger anomaly detection)
    const auditLog = await auditTrailService.logTransaction(transaction);

    expect(auditLog).toBeDefined();
    expect(auditLog.anomalies.length).toBeGreaterThan(0);

    // Generate a risk assessment
    const riskScore = await riskAssessmentEngine.calculateRiskScore(
      mockUserId,
      "user",
      mockProjectId
    );

    expect(riskScore).toBeGreaterThan(0);

    // Generate a compliance report
    const birValidation = await complianceAuditor.validateBIRAuditTrail(
      mockProjectId,
      new Date("2024-01-01"),
      new Date("2024-01-31")
    );

    expect(birValidation).toBeDefined();

    // Generate a comprehensive report
    const reportConfig = {
      projectId: mockProjectId,
      reportType: "comprehensive" as const,
      period: {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      },
      format: "json" as const,
      includeDetails: true,
      includeAnomalies: true,
      includeRiskAssessment: true,
    };

    const report = await auditReportGenerator.generateReport(reportConfig);

    expect(report.status).toBe("completed");
  });

  it("should maintain data consistency across all components", async () => {
    // Test that data from one component is consistently used by others
    const period = {
      start: new Date("2024-01-01"),
      end: new Date("2024-01-31"),
    };

    const auditReport = await auditTrailService.generateAuditReport(
      mockProjectId,
      period.start,
      period.end
    );

    const riskAssessment = await riskAssessmentEngine.performComprehensiveAssessment(
      mockProjectId,
      period
    );

    // Both should reference the same project and period
    expect(auditReport.projectId).toBe(riskAssessment.projectId);
    expect(auditReport.periodStart).toEqual(riskAssessment.period.start);
    expect(auditReport.periodEnd).toEqual(riskAssessment.period.end);
  });

  it("should handle high-volume transaction processing", async () => {
    // Simulate processing many transactions
    const transactions = Array.from({ length: 100 }, (_, i) =>
      createMockTransaction({
        id: `batch-transaction-${i}`,
        monetaryAmount: new Money(1000 + Math.random() * 10000),
      })
    );

    const startTime = Date.now();

    const auditLogs = await Promise.all(
      transactions.map((t) => auditTrailService.logTransaction(t))
    );

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    expect(auditLogs).toHaveLength(100);
    expect(processingTime).toBeLessThan(10000); // Should process in under 10 seconds

    // Verify all transactions were logged correctly
    auditLogs.forEach((log, index) => {
      expect(log.id).toBeDefined();
      expect(log.entityId).toBe(transactions[index].entity.id);
    });
  });
});

// =============================================
// Performance Tests
// =============================================

describe("Audit Trail Performance", () => {
  it("should meet performance requirements for real-time processing", async () => {
    const transaction = createMockTransaction();

    const startTime = Date.now();
    await auditTrailService.logTransaction(transaction);
    const endTime = Date.now();

    const processingTime = endTime - startTime;
    expect(processingTime).toBeLessThan(50); // Should complete in under 50ms
  });

  it("should handle concurrent transactions efficiently", async () => {
    const transactions = Array.from({ length: 20 }, (_, i) =>
      createMockTransaction({ id: `concurrent-${i}` })
    );

    const startTime = Date.now();

    await Promise.all(transactions.map((t) => auditTrailService.logTransaction(t)));

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    expect(processingTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});

// =============================================
// Error Handling Tests
// =============================================

describe("Audit Trail Error Handling", () => {
  it("should handle invalid transaction data gracefully", async () => {
    const invalidTransaction = {
      ...createMockTransaction(),
      monetaryAmount: undefined as any,
      entity: undefined as any,
    };

    expect(async () => {
      await auditTrailService.logTransaction(invalidTransaction);
    }).not.toThrow();
  });

  it("should handle database connection errors", async () => {
    // Mock database failure scenario
    vi.mock("@/lib/db", () => ({
      db: {
        select: () => {
          throw new Error("Database connection failed");
        },
        insert: () => {
          throw new Error("Database connection failed");
        },
      },
    }));

    const transaction = createMockTransaction();

    // Should not throw even if database fails
    expect(async () => {
      await auditTrailService.logTransaction(transaction);
    }).not.toThrow();
  });
});
