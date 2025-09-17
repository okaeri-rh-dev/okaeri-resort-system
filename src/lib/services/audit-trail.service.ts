/**
 * Enhanced Audit Trail Service
 *
 * Provides comprehensive audit tracking with state change detection,
 * anomaly analysis, and compliance monitoring for Philippine business requirements.
 * Builds upon the existing audit infrastructure with enterprise-grade capabilities.
 */

import { db } from "@/lib/db";
import { financialAuditTrail } from "@/lib/db/schema/financial-audit.schema";
import { Money } from "@/lib/money";
import { auditLog } from "@/lib/audit";
import { createHash } from "uncrypto";
import { eq, and, gte, lte, desc, asc, count, sql } from "drizzle-orm";

// =============================================
// Core Types and Interfaces
// =============================================

export interface AuditableEntity {
  id: string;
  type: string;
  code?: string;
  projectId: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditableTransaction {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  projectId: string;
  entity: AuditableEntity;
  action: string;
  previousState?: Record<string, any>;
  newState: Record<string, any>;
  changes: DetailedChange[];
  monetaryAmount?: Money;
  previousAmount?: Money;
  context: AuditContext;
  severity?: "info" | "warning" | "error" | "critical";
}

export interface DetailedChange {
  field: string;
  oldValue: any;
  newValue: any;
  dataType: string;
  impactLevel: "low" | "medium" | "high" | "critical";
  complianceRelevant: boolean;
  financialImpact?: Money;
}

export interface AuditContext {
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  timestamp: Date;
  source: "api" | "ui" | "batch" | "system";
}

export interface FinancialImpact {
  direct: Money;
  indirect: Money;
  taxImpact: Money;
  complianceRisk: number; // 0-100 score
  affectedCategories: string[];
  requiresApproval: boolean;
}

export interface Anomaly {
  id: string;
  type: "time" | "amount" | "behavior" | "pattern";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  score: number; // 0-100 anomaly score
  details: Record<string, any>;
  recommendations: string[];
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  eventId: string;
  projectId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: DetailedChange[];
  financialImpact?: FinancialImpact;
  anomalies: Anomaly[];
  complianceFlags: string[];
  checksum: string;
  createdAt: Date;
}

export interface AnomalyFilters {
  projectId?: string;
  userId?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: string[];
  type?: string[];
  minScore?: number;
}

export interface AuditReport {
  periodStart: Date;
  periodEnd: Date;
  projectId: string;
  summary: {
    totalEvents: number;
    criticalEvents: number;
    anomalies: number;
    complianceIssues: number;
    financialImpact: Money;
  };
  breakdown: {
    byCategory: Record<string, number>;
    byUser: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  topAnomalies: Anomaly[];
  complianceStatus: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  trends: {
    dailyActivity: { date: string; count: number }[];
    riskScore: { date: string; score: number }[];
  };
}

// =============================================
// Enhanced Audit Trail Service
// =============================================

export class AuditTrailService {
  /**
   * Log a comprehensive audit trail entry with state tracking
   */
  async logTransaction(transaction: AuditableTransaction): Promise<AuditLog> {
    try {
      // Calculate financial impact
      const financialImpact = await this.calculateFinancialImpact(transaction);

      // Detect anomalies in real-time
      const anomalies = await this.detectTransactionAnomalies(transaction);

      // Generate compliance flags
      const complianceFlags = this.generateComplianceFlags(transaction, financialImpact);

      // Create audit log entry
      const auditLogEntry: AuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        projectId: transaction.projectId,
        userId: transaction.userId,
        action: transaction.action,
        entityType: transaction.entity.type,
        entityId: transaction.entity.id,
        changes: transaction.changes,
        financialImpact,
        anomalies,
        complianceFlags,
        checksum: this.generateChecksum(transaction),
        createdAt: new Date(),
      };

      // Persist to database using existing audit infrastructure
      await this.persistAuditLog(auditLogEntry, transaction);

      // Handle critical events
      if (transaction.severity === "critical" || anomalies.some((a) => a.severity === "critical")) {
        await this.handleCriticalEvent(auditLogEntry);
      }

      return auditLogEntry;
    } catch (error) {
      console.error("Failed to log audit transaction:", error);
      throw error;
    }
  }

  /**
   * Capture and analyze state changes between two entity states
   */
  async captureStateChange<T extends Record<string, any>>(
    before: T,
    after: T,
    context: AuditContext
  ): Promise<DetailedChange[]> {
    const changes: DetailedChange[] = [];

    // Get all unique keys from both states
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      const oldValue = before?.[key];
      const newValue = after?.[key];

      // Skip if values are identical
      if (this.deepEqual(oldValue, newValue)) continue;

      // Analyze the change
      const change: DetailedChange = {
        field: key,
        oldValue,
        newValue,
        dataType: this.getDataType(newValue ?? oldValue),
        impactLevel: this.assessImpactLevel(key, oldValue, newValue),
        complianceRelevant: this.isComplianceRelevant(key),
        financialImpact: await this.calculateFieldFinancialImpact(key, oldValue, newValue),
      };

      changes.push(change);
    }

    return changes;
  }

  /**
   * Calculate comprehensive financial impact of changes
   */
  async calculateFinancialImpact(
    transaction: AuditableTransaction
  ): Promise<FinancialImpact | undefined> {
    if (!transaction.monetaryAmount && !this.hasFinancialFields(transaction.changes)) {
      return undefined;
    }

    const directImpact = transaction.monetaryAmount || new Money(0);

    // Calculate indirect impacts (tax implications, compliance costs, etc.)
    const indirectImpact = await this.calculateIndirectImpact(transaction);

    // Calculate tax implications
    const taxImpact = await this.calculateTaxImpact(transaction);

    // Assess compliance risk
    const complianceRisk = await this.assessComplianceRisk(transaction);

    // Identify affected financial categories
    const affectedCategories = this.identifyAffectedCategories(transaction);

    // Determine if approval is required
    const requiresApproval = this.requiresApproval(directImpact, transaction.action);

    return {
      direct: directImpact,
      indirect: indirectImpact,
      taxImpact,
      complianceRisk,
      affectedCategories,
      requiresApproval,
    };
  }

  /**
   * Detect anomalies in transaction patterns
   */
  async detectTransactionAnomalies(transaction: AuditableTransaction): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Time-based anomalies
    const timeAnomalies = await this.detectTimeAnomalies(transaction);
    anomalies.push(...timeAnomalies);

    // Amount-based anomalies
    if (transaction.monetaryAmount) {
      const amountAnomalies = await this.detectAmountAnomalies(transaction);
      anomalies.push(...amountAnomalies);
    }

    // Behavioral anomalies
    const behaviorAnomalies = await this.detectBehaviorAnomalies(transaction);
    anomalies.push(...behaviorAnomalies);

    // Pattern anomalies
    const patternAnomalies = await this.detectPatternAnomalies(transaction);
    anomalies.push(...patternAnomalies);

    return anomalies;
  }

  /**
   * Generate audit report for a specific time period
   */
  async generateAuditReport(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditReport> {
    // Get audit trail entries for the period
    const auditEntries = await db
      .select()
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, startDate),
          lte(financialAuditTrail.eventTimestamp, endDate)
        )
      )
      .orderBy(desc(financialAuditTrail.eventTimestamp));

    // Calculate summary statistics
    const summary = this.calculateSummaryStats(auditEntries);

    // Generate breakdowns
    const breakdown = this.generateBreakdowns(auditEntries);

    // Get top anomalies
    const topAnomalies = await this.getTopAnomalies(projectId, startDate, endDate, 10);

    // Assess compliance status
    const complianceStatus = await this.assessComplianceStatus(projectId, startDate, endDate);

    // Generate trends
    const trends = await this.generateTrends(projectId, startDate, endDate);

    return {
      periodStart: startDate,
      periodEnd: endDate,
      projectId,
      summary,
      breakdown,
      topAnomalies,
      complianceStatus,
      trends,
    };
  }

  // =============================================
  // Private Helper Methods
  // =============================================

  private async persistAuditLog(
    auditLogEntry: AuditLog,
    transaction: AuditableTransaction
  ): Promise<void> {
    // Use existing audit infrastructure
    await auditLog({
      userId: transaction.userId,
      userName: transaction.userName,
      userRole: transaction.userRole,
      action: transaction.action,
      entityType: transaction.entity.type,
      entityId: transaction.entity.id,
      entityCode: transaction.entity.code,
      amount: transaction.monetaryAmount?.toNumber(),
      previousAmount: transaction.previousAmount?.toNumber(),
      metadata: {
        projectId: transaction.projectId,
        changes: transaction.changes,
        previousState: transaction.previousState,
        newState: transaction.newState,
        financialImpact: auditLogEntry.financialImpact,
        anomalies: auditLogEntry.anomalies,
        checksum: auditLogEntry.checksum,
        ...transaction.entity.metadata,
      },
      ipAddress: transaction.context.ipAddress,
      userAgent: transaction.context.userAgent,
      sessionId: transaction.context.sessionId,
      requestId: transaction.context.requestId,
      severity: transaction.severity,
    });
  }

  private generateChecksum(transaction: AuditableTransaction): string {
    const checksumData = {
      userId: transaction.userId,
      projectId: transaction.projectId,
      entityId: transaction.entity.id,
      entityType: transaction.entity.type,
      action: transaction.action,
      timestamp: transaction.context.timestamp.toISOString(),
      changes: transaction.changes.map((c) => ({
        field: c.field,
        old: c.oldValue,
        new: c.newValue,
      })),
      amount: transaction.monetaryAmount?.toNumber(),
    };

    const jsonString = JSON.stringify(checksumData, Object.keys(checksumData).sort());
    return createHash("sha512").update(jsonString).digest("hex");
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === "object") {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every((key) => this.deepEqual(a[key], b[key]));
    }

    return false;
  }

  private getDataType(value: any): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (value instanceof Date) return "date";
    if (value instanceof Money) return "money";
    return typeof value;
  }

  private assessImpactLevel(
    field: string,
    oldValue: any,
    newValue: any
  ): "low" | "medium" | "high" | "critical" {
    // Critical financial fields
    const criticalFields = ["amount", "total", "tax", "balance", "payment"];
    if (criticalFields.some((f) => field.toLowerCase().includes(f))) {
      return "critical";
    }

    // High impact fields
    const highImpactFields = ["status", "approved", "cancelled", "void"];
    if (highImpactFields.some((f) => field.toLowerCase().includes(f))) {
      return "high";
    }

    // Medium impact fields
    const mediumImpactFields = ["description", "category", "vendor", "project"];
    if (mediumImpactFields.some((f) => field.toLowerCase().includes(f))) {
      return "medium";
    }

    return "low";
  }

  private isComplianceRelevant(field: string): boolean {
    const complianceFields = [
      "tax",
      "vat",
      "withholding",
      "bir",
      "tin",
      "receipt",
      "invoice",
      "amount",
      "payment",
      "discount",
      "senior",
      "pwd",
      "status",
    ];

    return complianceFields.some((f) => field.toLowerCase().includes(f));
  }

  private async calculateFieldFinancialImpact(
    field: string,
    oldValue: any,
    newValue: any
  ): Promise<Money | undefined> {
    // Only calculate for monetary fields
    if (!this.isMonetaryField(field)) return undefined;

    try {
      const oldMoney = typeof oldValue === "number" ? new Money(oldValue) : new Money(0);
      const newMoney = typeof newValue === "number" ? new Money(newValue) : new Money(0);

      return newMoney.subtract(oldMoney);
    } catch {
      return undefined;
    }
  }

  private isMonetaryField(field: string): boolean {
    const monetaryFields = [
      "amount",
      "total",
      "subtotal",
      "tax",
      "discount",
      "payment",
      "balance",
      "due",
      "paid",
      "refund",
      "charge",
      "fee",
      "cost",
      "price",
    ];

    return monetaryFields.some((f) => field.toLowerCase().includes(f));
  }

  private hasFinancialFields(changes: DetailedChange[]): boolean {
    return changes.some((change) => this.isMonetaryField(change.field));
  }

  private async calculateIndirectImpact(transaction: AuditableTransaction): Promise<Money> {
    // Calculate indirect financial impacts like processing fees, compliance costs, etc.
    let indirectImpact = new Money(0);

    // Processing fees for payment transactions
    if (transaction.action.includes("payment") && transaction.monetaryAmount) {
      const processingFee = transaction.monetaryAmount.multiply(0.025); // 2.5% typical processing fee
      indirectImpact = indirectImpact.add(processingFee);
    }

    // Compliance processing costs
    if (this.isComplianceTransaction(transaction)) {
      indirectImpact = indirectImpact.add(new Money(100)); // Fixed compliance processing cost
    }

    return indirectImpact;
  }

  private async calculateTaxImpact(transaction: AuditableTransaction): Promise<Money> {
    if (!transaction.monetaryAmount) return new Money(0);

    let taxImpact = new Money(0);

    // VAT impact
    if (this.isVATApplicable(transaction)) {
      taxImpact = taxImpact.add(transaction.monetaryAmount.getVATAmount());
    }

    // Withholding tax impact
    if (this.isWithholdingApplicable(transaction)) {
      taxImpact = taxImpact.add(transaction.monetaryAmount.calculateWithholdingTax());
    }

    return taxImpact;
  }

  private async assessComplianceRisk(transaction: AuditableTransaction): Promise<number> {
    let riskScore = 0;

    // High-value transaction risk
    if (transaction.monetaryAmount && transaction.monetaryAmount.greaterThan(100000)) {
      riskScore += 30;
    }

    // Manual transaction risk
    if (transaction.context.source === "ui" && transaction.action.includes("delete")) {
      riskScore += 25;
    }

    // After-hours transaction risk
    const hour = transaction.context.timestamp.getHours();
    if (hour < 8 || hour > 18) {
      riskScore += 15;
    }

    // Multiple rapid transactions risk
    const recentTransactions = await this.getRecentTransactions(
      transaction.userId,
      transaction.projectId,
      5 // minutes
    );
    if (recentTransactions.length > 10) {
      riskScore += 20;
    }

    return Math.min(riskScore, 100);
  }

  private identifyAffectedCategories(transaction: AuditableTransaction): string[] {
    const categories: string[] = [];

    // Add entity type
    categories.push(transaction.entity.type);

    // Add based on action
    if (transaction.action.includes("tax")) categories.push("taxation");
    if (transaction.action.includes("payment")) categories.push("payments");
    if (transaction.action.includes("expense")) categories.push("expenses");
    if (transaction.action.includes("income")) categories.push("revenue");

    // Add based on compliance relevance
    if (transaction.changes.some((c) => c.complianceRelevant)) {
      categories.push("compliance");
    }

    return [...new Set(categories)]; // Remove duplicates
  }

  private requiresApproval(amount: Money, action: string): boolean {
    // High-value transactions require approval
    if (amount.greaterThan(50000)) return true;

    // Sensitive actions require approval
    const sensitiveActions = ["delete", "void", "cancel", "refund"];
    if (sensitiveActions.some((a) => action.toLowerCase().includes(a))) return true;

    return false;
  }

  private async detectTimeAnomalies(transaction: AuditableTransaction): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const hour = transaction.context.timestamp.getHours();

    // After-hours activity (outside 6 AM - 10 PM)
    if (hour < 6 || hour > 22) {
      anomalies.push({
        id: `time_anomaly_${Date.now()}`,
        type: "time",
        severity: "medium",
        description: `Transaction outside business hours at ${hour}:${transaction.context.timestamp.getMinutes()}`,
        score: 65,
        details: { hour, timestamp: transaction.context.timestamp },
        recommendations: ["Review transaction justification", "Verify user authorization"],
        createdAt: new Date(),
      });
    }

    // Weekend activity for business transactions
    const day = transaction.context.timestamp.getDay();
    if ((day === 0 || day === 6) && this.isBusinessTransaction(transaction)) {
      anomalies.push({
        id: `weekend_anomaly_${Date.now()}`,
        type: "time",
        severity: "low",
        description: "Business transaction performed on weekend",
        score: 35,
        details: { day, isWeekend: true },
        recommendations: ["Verify business necessity", "Review approval workflow"],
        createdAt: new Date(),
      });
    }

    return anomalies;
  }

  private async detectAmountAnomalies(transaction: AuditableTransaction): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const amount = transaction.monetaryAmount!;

    // Get historical amounts for this entity type
    const historicalAmounts = await this.getHistoricalAmounts(
      transaction.projectId,
      transaction.entity.type,
      30 // days
    );

    if (historicalAmounts.length > 10) {
      const avgAmount = Money.average(historicalAmounts);
      const stdDev = this.calculateStandardDeviation(historicalAmounts);

      // Outlier detection (more than 2 standard deviations from mean)
      const deviation = amount.subtract(avgAmount).abs();
      if (deviation.greaterThan(stdDev.multiply(2))) {
        anomalies.push({
          id: `amount_anomaly_${Date.now()}`,
          type: "amount",
          severity: deviation.greaterThan(stdDev.multiply(3)) ? "high" : "medium",
          description: `Transaction amount ${amount.format()} significantly deviates from average ${avgAmount.format()}`,
          score: Math.min(90, 50 + (deviation.toNumber() / stdDev.toNumber()) * 10),
          details: {
            amount: amount.toNumber(),
            average: avgAmount.toNumber(),
            deviation: deviation.toNumber(),
          },
          recommendations: [
            "Verify transaction accuracy",
            "Check for data entry errors",
            "Confirm business justification",
          ],
          createdAt: new Date(),
        });
      }
    }

    return anomalies;
  }

  private async detectBehaviorAnomalies(transaction: AuditableTransaction): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Get user's recent activity pattern
    const userActivity = await this.getUserRecentActivity(
      transaction.userId,
      transaction.projectId,
      7 // days
    );

    // Unusual volume of transactions
    const todayTransactions = userActivity.filter(
      (a) => a.createdAt.toDateString() === transaction.context.timestamp.toDateString()
    );

    if (todayTransactions.length > 50) {
      anomalies.push({
        id: `behavior_volume_${Date.now()}`,
        type: "behavior",
        severity: "medium",
        description: `Unusually high transaction volume: ${todayTransactions.length} transactions today`,
        score: Math.min(80, 30 + todayTransactions.length),
        details: { dailyCount: todayTransactions.length, weeklyAverage: userActivity.length / 7 },
        recommendations: [
          "Review transaction legitimacy",
          "Check for automated processes",
          "Verify user account security",
        ],
        createdAt: new Date(),
      });
    }

    return anomalies;
  }

  private async detectPatternAnomalies(transaction: AuditableTransaction): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Detect rapid-fire transactions (same user, multiple transactions within minutes)
    const recentTransactions = await this.getRecentTransactions(
      transaction.userId,
      transaction.projectId,
      2 // minutes
    );

    if (recentTransactions.length > 5) {
      anomalies.push({
        id: `pattern_rapid_${Date.now()}`,
        type: "pattern",
        severity: "high",
        description: `Rapid sequence of ${recentTransactions.length} transactions within 2 minutes`,
        score: Math.min(95, 60 + recentTransactions.length * 5),
        details: { count: recentTransactions.length, timeWindow: "2 minutes" },
        recommendations: [
          "Investigate potential automation",
          "Verify user actions",
          "Check for system issues",
        ],
        createdAt: new Date(),
      });
    }

    return anomalies;
  }

  private generateComplianceFlags(
    transaction: AuditableTransaction,
    financialImpact?: FinancialImpact
  ): string[] {
    const flags: string[] = [];

    // BIR-related flags
    if (this.isBIRReportable(transaction)) {
      flags.push("bir_reportable");
    }

    // High-value transaction flag
    if (transaction.monetaryAmount && transaction.monetaryAmount.greaterThan(500000)) {
      flags.push("high_value");
    }

    // Tax-related flags
    if (this.isTaxTransaction(transaction)) {
      flags.push("tax_related");
    }

    // Approval required flag
    if (financialImpact?.requiresApproval) {
      flags.push("requires_approval");
    }

    // Data privacy flag
    if (this.involvesPersonalData(transaction)) {
      flags.push("personal_data");
    }

    return flags;
  }

  // Additional helper methods for anomaly detection and compliance
  private isComplianceTransaction(transaction: AuditableTransaction): boolean {
    const complianceActions = ["tax", "filing", "bir", "compliance"];
    return complianceActions.some((a) => transaction.action.toLowerCase().includes(a));
  }

  private isVATApplicable(transaction: AuditableTransaction): boolean {
    return transaction.entity.type === "income" || transaction.action.includes("sale");
  }

  private isWithholdingApplicable(transaction: AuditableTransaction): boolean {
    return transaction.entity.type === "expense" && transaction.action.includes("payment");
  }

  private isBusinessTransaction(transaction: AuditableTransaction): boolean {
    const businessTypes = ["expense", "income", "payment", "tax"];
    return businessTypes.includes(transaction.entity.type);
  }

  private isBIRReportable(transaction: AuditableTransaction): boolean {
    const reportableActions = ["income", "expense", "tax", "withholding"];
    return reportableActions.some(
      (a) => transaction.action.includes(a) || transaction.entity.type === a
    );
  }

  private isTaxTransaction(transaction: AuditableTransaction): boolean {
    const taxKeywords = ["tax", "vat", "withholding", "bir"];
    return taxKeywords.some(
      (k) =>
        transaction.action.toLowerCase().includes(k) ||
        transaction.entity.type.toLowerCase().includes(k)
    );
  }

  private involvesPersonalData(transaction: AuditableTransaction): boolean {
    const personalDataFields = ["name", "email", "phone", "address", "tin", "id"];
    return transaction.changes.some((c) =>
      personalDataFields.some((f) => c.field.toLowerCase().includes(f))
    );
  }

  private async getRecentTransactions(userId: string, projectId: string, minutes: number) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return await db
      .select()
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.userId, userId),
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, cutoff)
        )
      );
  }

  private async getHistoricalAmounts(
    projectId: string,
    entityType: string,
    days: number
  ): Promise<Money[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const results = await db
      .select({ amount: financialAuditTrail.monetaryAmount })
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.projectId, projectId),
          eq(financialAuditTrail.entityType, entityType),
          gte(financialAuditTrail.eventTimestamp, cutoff)
        )
      );

    return results.filter((r) => r.amount).map((r) => new Money(r.amount!));
  }

  private calculateStandardDeviation(amounts: Money[]): Money {
    if (amounts.length < 2) return new Money(0);

    const mean = Money.average(amounts);
    const squaredDiffs = amounts.map((amount) => {
      const diff = amount.subtract(mean);
      return diff.multiply(diff.toNumber());
    });

    const variance = Money.average(squaredDiffs);
    return new Money(Math.sqrt(variance.toNumber()));
  }

  private async getUserRecentActivity(userId: string, projectId: string, days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return await db
      .select()
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.userId, userId),
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, cutoff)
        )
      );
  }

  private async handleCriticalEvent(auditLogEntry: AuditLog): Promise<void> {
    // Log critical event for immediate attention
    console.error("CRITICAL AUDIT EVENT:", {
      id: auditLogEntry.id,
      action: auditLogEntry.action,
      userId: auditLogEntry.userId,
      entityId: auditLogEntry.entityId,
      anomalies: auditLogEntry.anomalies.filter((a) => a.severity === "critical"),
    });

    // Here you would typically:
    // - Send notifications to administrators
    // - Create alerts in monitoring system
    // - Trigger security procedures if needed
    // - Log to external security system
  }

  private calculateSummaryStats(auditEntries: any[]) {
    const totalEvents = auditEntries.length;
    const criticalEvents = auditEntries.filter((e) => e.eventSeverity === "critical").length;

    // This would need more sophisticated anomaly counting from stored data
    const anomalies = auditEntries.filter(
      (e) => e.metadata?.anomalies && e.metadata.anomalies.length > 0
    ).length;

    const complianceIssues = auditEntries.filter(
      (e) => e.complianceFlags && e.complianceFlags.length > 0
    ).length;

    const financialImpact = Money.sum(
      auditEntries.filter((e) => e.monetaryAmount).map((e) => new Money(e.monetaryAmount))
    );

    return {
      totalEvents,
      criticalEvents,
      anomalies,
      complianceIssues,
      financialImpact,
    };
  }

  private generateBreakdowns(auditEntries: any[]) {
    const byCategory = auditEntries.reduce(
      (acc, entry) => {
        acc[entry.eventCategory] = (acc[entry.eventCategory] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byUser = auditEntries.reduce(
      (acc, entry) => {
        const user = entry.userName || entry.userId;
        acc[user] = (acc[user] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const bySeverity = auditEntries.reduce(
      (acc, entry) => {
        acc[entry.eventSeverity] = (acc[entry.eventSeverity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return { byCategory, byUser, bySeverity };
  }

  private async getTopAnomalies(
    projectId: string,
    startDate: Date,
    endDate: Date,
    limit: number
  ): Promise<Anomaly[]> {
    // This would need to be implemented with proper anomaly storage
    // For now, return empty array as placeholder
    return [];
  }

  private async assessComplianceStatus(projectId: string, startDate: Date, endDate: Date) {
    // Simplified compliance assessment
    const auditEntries = await db
      .select()
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, startDate),
          lte(financialAuditTrail.eventTimestamp, endDate)
        )
      );

    const totalEvents = auditEntries.length;
    const compliantEvents = auditEntries.filter(
      (e) => !e.complianceFlags || e.complianceFlags.length === 0
    ).length;
    const score = totalEvents > 0 ? Math.round((compliantEvents / totalEvents) * 100) : 100;

    const issues = auditEntries
      .filter((e) => e.complianceFlags && e.complianceFlags.length > 0)
      .map((e) => `${e.eventType}: ${e.complianceFlags.join(", ")}`)
      .slice(0, 10); // Top 10 issues

    const recommendations = [
      "Review high-risk transactions",
      "Implement automated compliance checks",
      "Train staff on compliance procedures",
      "Regular audit schedule implementation",
    ];

    return { score, issues, recommendations };
  }

  private async generateTrends(projectId: string, startDate: Date, endDate: Date) {
    // Simplified trends - would need more sophisticated time-series analysis
    const dailyActivity: { date: string; count: number }[] = [];
    const riskScore: { date: string; score: number }[] = [];

    // Generate daily activity for the period
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayEntries = await db
        .select({ count: count() })
        .from(financialAuditTrail)
        .where(
          and(
            eq(financialAuditTrail.projectId, projectId),
            gte(financialAuditTrail.eventTimestamp, dayStart),
            lte(financialAuditTrail.eventTimestamp, dayEnd)
          )
        );

      dailyActivity.push({
        date: currentDate.toISOString().split("T")[0],
        count: dayEntries[0]?.count || 0,
      });

      // Mock risk score calculation
      riskScore.push({
        date: currentDate.toISOString().split("T")[0],
        score: Math.random() * 30 + 10, // Random score between 10-40
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { dailyActivity, riskScore };
  }
}

// =============================================
// Export Service Instance
// =============================================

export const auditTrailService = new AuditTrailService();
