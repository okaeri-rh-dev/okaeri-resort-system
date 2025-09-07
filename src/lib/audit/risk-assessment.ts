/**
 * Risk Assessment and Behavior Analytics
 *
 * Advanced risk scoring and behavioral analysis for financial transactions
 * and user activities. Provides comprehensive risk evaluation for Philippine
 * resort operations with fraud detection and compliance monitoring.
 */

import { db } from "@/lib/db";
import { financialAuditTrail } from "@/lib/db/schema/financial-audit.schema";
import { Money } from "@/lib/money";
import { eq, and, gte, lte, desc, count, sql, sum, avg } from "drizzle-orm";
import { anomalyDetector, AnomalyDetector } from "./anomaly-detection";

// =============================================
// Core Types and Interfaces
// =============================================

export interface RiskProfile {
  entityId: string;
  entityType: "user" | "transaction" | "project" | "vendor";
  riskScore: number; // 0-100
  riskLevel: "very_low" | "low" | "medium" | "high" | "very_high" | "critical";
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
  lastAssessed: Date;
  nextReview: Date;
}

export interface RiskFactor {
  id: string;
  category: "financial" | "operational" | "compliance" | "behavioral" | "technical";
  type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  impact: number; // 0-100
  likelihood: number; // 0-100
  riskValue: number; // impact * likelihood / 100
  evidence: string[];
  detectedAt: Date;
}

export interface MitigationStrategy {
  id: string;
  riskFactorId: string;
  strategy: string;
  priority: "low" | "medium" | "high" | "urgent";
  estimatedEffectiveness: number; // 0-100
  implementationCost: "low" | "medium" | "high";
  timeframe: string;
  assignedTo?: string;
  status: "proposed" | "approved" | "implementing" | "implemented" | "monitoring";
}

export interface BehaviorProfile {
  userId: string;
  profilePeriod: { start: Date; end: Date };
  transactionPatterns: TransactionPattern[];
  accessPatterns: AccessPattern[];
  riskIndicators: RiskIndicator[];
  behaviorScore: number; // 0-100, higher = more normal behavior
  anomalyCount: number;
  trustLevel: "very_low" | "low" | "medium" | "high" | "very_high";
  recommendations: string[];
}

export interface TransactionPattern {
  pattern: string;
  frequency: number;
  typicalAmount: Money;
  amountRange: { min: Money; max: Money };
  commonTimeRanges: string[];
  entityTypes: string[];
  confidence: number; // 0-100
}

export interface AccessPattern {
  pattern: string;
  frequency: number;
  timeRanges: string[];
  ipAddresses: string[];
  deviceFingerprints: string[];
  locations: string[];
  confidence: number; // 0-100
}

export interface RiskIndicator {
  indicator: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  evidence: string[];
  firstDetected: Date;
  lastSeen: Date;
  frequency: number;
}

export interface ComprehensiveRiskAssessment {
  projectId: string;
  assessmentDate: Date;
  period: { start: Date; end: Date };
  overallRiskScore: number;
  riskLevel: "very_low" | "low" | "medium" | "high" | "very_high" | "critical";
  riskBreakdown: {
    financial: number;
    operational: number;
    compliance: number;
    behavioral: number;
    technical: number;
  };
  topRisks: RiskFactor[];
  userRiskProfiles: BehaviorProfile[];
  trends: RiskTrend[];
  recommendations: RiskRecommendation[];
}

export interface RiskTrend {
  date: Date;
  overallRisk: number;
  financialRisk: number;
  complianceRisk: number;
  behavioralRisk: number;
}

export interface RiskRecommendation {
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  recommendation: string;
  rationale: string;
  estimatedImpact: string;
  implementationSteps: string[];
}

export interface FraudDetectionResult {
  transactionId: string;
  fraudScore: number; // 0-100
  fraudProbability: number; // 0-1
  indicators: FraudIndicator[];
  riskLevel: "very_low" | "low" | "medium" | "high" | "very_high" | "critical";
  recommendedAction: "approve" | "review" | "hold" | "deny";
  explanation: string;
}

export interface FraudIndicator {
  type: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-100
  contributionToScore: number;
}

// =============================================
// Risk Assessment Engine
// =============================================

export class RiskAssessmentEngine {
  private anomalyDetector: AnomalyDetector;

  constructor() {
    this.anomalyDetector = anomalyDetector;
  }

  /**
   * Calculate comprehensive risk score for an entity
   */
  async calculateRiskScore(
    entityId: string,
    entityType: "user" | "transaction" | "project" | "vendor",
    projectId: string
  ): Promise<number> {
    const riskFactors = await this.identifyRiskFactors(entityId, entityType, projectId);

    if (riskFactors.length === 0) return 10; // Baseline risk

    // Weighted risk calculation
    let totalRisk = 0;
    let totalWeight = 0;

    riskFactors.forEach((factor) => {
      const weight = this.getRiskFactorWeight(factor.category, factor.severity);
      totalRisk += factor.riskValue * weight;
      totalWeight += weight;
    });

    const averageRisk = totalWeight > 0 ? totalRisk / totalWeight : 10;

    // Apply entity-specific adjustments
    const adjustedRisk = this.applyEntityAdjustments(averageRisk, entityType);

    return Math.min(100, Math.max(0, adjustedRisk));
  }

  /**
   * Generate mitigation plan for identified risks
   */
  generateMitigationPlan(riskFactors: RiskFactor[]): MitigationStrategy[] {
    const strategies: MitigationStrategy[] = [];

    riskFactors.forEach((factor) => {
      const strategy = this.createMitigationStrategy(factor);
      strategies.push(strategy);
    });

    // Sort by priority and effectiveness
    return strategies.sort((a, b) => {
      const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];

      if (priorityDiff !== 0) return priorityDiff;

      return b.estimatedEffectiveness - a.estimatedEffectiveness;
    });
  }

  /**
   * Assess user behavior and generate profile
   */
  async assessUserBehavior(
    userId: string,
    projectId: string,
    period: { start: Date; end: Date }
  ): Promise<BehaviorProfile> {
    // Get user's transaction data for the period
    const transactions = await this.getUserTransactions(userId, projectId, period);

    // Analyze transaction patterns
    const transactionPatterns = await this.analyzeTransactionPatterns(transactions);

    // Analyze access patterns
    const accessPatterns = await this.analyzeAccessPatterns(userId, projectId, period);

    // Identify risk indicators
    const riskIndicators = await this.identifyBehaviorRiskIndicators(
      userId,
      projectId,
      transactions,
      period
    );

    // Calculate behavior score (inverse of risk - higher = better behavior)
    const behaviorScore = await this.calculateBehaviorScore(
      transactionPatterns,
      accessPatterns,
      riskIndicators
    );

    // Count anomalies
    const anomalies = await this.anomalyDetector.assessUserBehavior(userId, projectId, period);
    const anomalyCount = anomalies.anomalies.length;

    // Determine trust level
    const trustLevel = this.determineTrustLevel(behaviorScore, anomalyCount);

    // Generate recommendations
    const recommendations = this.generateBehaviorRecommendations(
      behaviorScore,
      riskIndicators,
      anomalyCount
    );

    return {
      userId,
      profilePeriod: period,
      transactionPatterns,
      accessPatterns,
      riskIndicators,
      behaviorScore,
      anomalyCount,
      trustLevel,
      recommendations,
    };
  }

  /**
   * Perform comprehensive risk assessment for a project
   */
  async performComprehensiveAssessment(
    projectId: string,
    period: { start: Date; end: Date }
  ): Promise<ComprehensiveRiskAssessment> {
    // Calculate overall risk score
    const overallRiskScore = await this.calculateRiskScore(projectId, "project", projectId);
    const riskLevel = this.getRiskLevel(overallRiskScore);

    // Break down risk by category
    const riskBreakdown = await this.calculateRiskBreakdown(projectId, period);

    // Identify top risks
    const allRiskFactors = await this.identifyRiskFactors(projectId, "project", projectId);
    const topRisks = allRiskFactors.sort((a, b) => b.riskValue - a.riskValue).slice(0, 10);

    // Get user risk profiles for active users
    const activeUsers = await this.getActiveUsers(projectId, period);
    const userRiskProfiles = await Promise.all(
      activeUsers.slice(0, 20).map(
        (
          userId // Limit to top 20 active users
        ) => this.assessUserBehavior(userId, projectId, period)
      )
    );

    // Calculate risk trends
    const trends = await this.calculateRiskTrends(projectId, period);

    // Generate recommendations
    const recommendations = this.generateRiskRecommendations(
      overallRiskScore,
      riskBreakdown,
      topRisks
    );

    return {
      projectId,
      assessmentDate: new Date(),
      period,
      overallRiskScore,
      riskLevel,
      riskBreakdown,
      topRisks,
      userRiskProfiles,
      trends,
      recommendations,
    };
  }

  /**
   * Detect potential fraud in transactions
   */
  async detectFraud(
    transactionId: string,
    transactionData: any,
    projectId: string
  ): Promise<FraudDetectionResult> {
    const indicators: FraudIndicator[] = [];
    let fraudScore = 0;

    // Time-based fraud indicators
    const timeIndicators = await this.checkTimeBasedFraud(transactionData);
    indicators.push(...timeIndicators);

    // Amount-based fraud indicators
    const amountIndicators = await this.checkAmountBasedFraud(transactionData, projectId);
    indicators.push(...amountIndicators);

    // Behavioral fraud indicators
    const behaviorIndicators = await this.checkBehavioralFraud(transactionData, projectId);
    indicators.push(...behaviorIndicators);

    // Pattern-based fraud indicators
    const patternIndicators = await this.checkPatternBasedFraud(transactionData, projectId);
    indicators.push(...patternIndicators);

    // Calculate fraud score
    fraudScore = indicators.reduce((score, indicator) => {
      return score + indicator.contributionToScore;
    }, 0);

    const fraudProbability = this.calculateFraudProbability(fraudScore);
    const riskLevel = this.getFraudRiskLevel(fraudScore);
    const recommendedAction = this.getRecommendedAction(fraudScore, riskLevel);
    const explanation = this.generateFraudExplanation(indicators, fraudScore);

    return {
      transactionId,
      fraudScore,
      fraudProbability,
      indicators,
      riskLevel,
      recommendedAction,
      explanation,
    };
  }

  // =============================================
  // Private Helper Methods
  // =============================================

  private async identifyRiskFactors(
    entityId: string,
    entityType: "user" | "transaction" | "project" | "vendor",
    projectId: string
  ): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // Financial risk factors
    const financialFactors = await this.identifyFinancialRiskFactors(
      entityId,
      entityType,
      projectId
    );
    riskFactors.push(...financialFactors);

    // Operational risk factors
    const operationalFactors = await this.identifyOperationalRiskFactors(
      entityId,
      entityType,
      projectId
    );
    riskFactors.push(...operationalFactors);

    // Compliance risk factors
    const complianceFactors = await this.identifyComplianceRiskFactors(
      entityId,
      entityType,
      projectId
    );
    riskFactors.push(...complianceFactors);

    // Behavioral risk factors
    if (entityType === "user") {
      const behavioralFactors = await this.identifyBehavioralRiskFactors(entityId, projectId);
      riskFactors.push(...behavioralFactors);
    }

    // Technical risk factors
    const technicalFactors = await this.identifyTechnicalRiskFactors(
      entityId,
      entityType,
      projectId
    );
    riskFactors.push(...technicalFactors);

    return riskFactors;
  }

  private async identifyFinancialRiskFactors(
    entityId: string,
    entityType: string,
    projectId: string
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    if (entityType === "user") {
      // Check for high-value transactions by user
      const highValueTransactions = await db
        .select({
          count: count(),
          totalAmount: sum(sql`${financialAuditTrail.monetaryAmount}::numeric`),
        })
        .from(financialAuditTrail)
        .where(
          and(
            eq(financialAuditTrail.userId, entityId),
            eq(financialAuditTrail.projectId, projectId),
            sql`${financialAuditTrail.monetaryAmount}::numeric > 100000` // PHP 100,000+
          )
        );

      const highValueCount = highValueTransactions[0]?.count || 0;
      if (highValueCount > 5) {
        factors.push({
          id: `financial_high_value_${Date.now()}`,
          category: "financial",
          type: "high_value_transactions",
          description: `User has ${highValueCount} high-value transactions`,
          severity: highValueCount > 20 ? "high" : "medium",
          impact: 70,
          likelihood: highValueCount > 20 ? 80 : 60,
          riskValue: highValueCount > 20 ? 56 : 42,
          evidence: [`${highValueCount} transactions over PHP 100,000`],
          detectedAt: new Date(),
        });
      }
    }

    // Check for rapid transaction sequences
    const rapidTransactions = await db
      .select({ count: count() })
      .from(financialAuditTrail)
      .where(
        and(
          entityType === "user"
            ? eq(financialAuditTrail.userId, entityId)
            : sql`${financialAuditTrail.entityId} = ${entityId}`,
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, new Date(Date.now() - 15 * 60 * 1000)) // Last 15 minutes
        )
      );

    const rapidCount = rapidTransactions[0]?.count || 0;
    if (rapidCount > 10) {
      factors.push({
        id: `financial_rapid_${Date.now()}`,
        category: "financial",
        type: "rapid_transactions",
        description: `${rapidCount} transactions in 15 minutes`,
        severity: rapidCount > 25 ? "high" : "medium",
        impact: 60,
        likelihood: 90,
        riskValue: 54,
        evidence: [`${rapidCount} transactions in 15-minute window`],
        detectedAt: new Date(),
      });
    }

    return factors;
  }

  private async identifyOperationalRiskFactors(
    entityId: string,
    entityType: string,
    projectId: string
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Check for after-hours activity
    const afterHoursActivity = await db
      .select({ count: count() })
      .from(financialAuditTrail)
      .where(
        and(
          entityType === "user"
            ? eq(financialAuditTrail.userId, entityId)
            : sql`${financialAuditTrail.entityId} = ${entityId}`,
          eq(financialAuditTrail.projectId, projectId),
          sql`EXTRACT(HOUR FROM ${financialAuditTrail.eventTimestamp}) NOT BETWEEN 8 AND 18`,
          gte(financialAuditTrail.eventTimestamp, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
        )
      );

    const afterHoursCount = afterHoursActivity[0]?.count || 0;
    if (afterHoursCount > 10) {
      factors.push({
        id: `operational_after_hours_${Date.now()}`,
        category: "operational",
        type: "after_hours_activity",
        description: `${afterHoursCount} after-hours transactions in 30 days`,
        severity: afterHoursCount > 50 ? "high" : "medium",
        impact: 50,
        likelihood: 70,
        riskValue: 35,
        evidence: [`${afterHoursCount} transactions outside 8 AM - 6 PM`],
        detectedAt: new Date(),
      });
    }

    return factors;
  }

  private async identifyComplianceRiskFactors(
    entityId: string,
    entityType: string,
    projectId: string
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Check for compliance flag violations
    const complianceViolations = await db
      .select({ count: count() })
      .from(financialAuditTrail)
      .where(
        and(
          entityType === "user"
            ? eq(financialAuditTrail.userId, entityId)
            : sql`${financialAuditTrail.entityId} = ${entityId}`,
          eq(financialAuditTrail.projectId, projectId),
          sql`${financialAuditTrail.complianceFlags} != '[]'`
        )
      );

    const violationCount = complianceViolations[0]?.count || 0;
    if (violationCount > 5) {
      factors.push({
        id: `compliance_violations_${Date.now()}`,
        category: "compliance",
        type: "compliance_violations",
        description: `${violationCount} transactions with compliance flags`,
        severity: violationCount > 20 ? "high" : "medium",
        impact: 80,
        likelihood: 60,
        riskValue: 48,
        evidence: [`${violationCount} transactions flagged for compliance issues`],
        detectedAt: new Date(),
      });
    }

    return factors;
  }

  private async identifyBehavioralRiskFactors(
    userId: string,
    projectId: string
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Check for unusual IP addresses
    const ipAddresses = await db
      .select({
        ipAddress: financialAuditTrail.ipAddress,
        count: count(),
      })
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.userId, userId),
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
        )
      )
      .groupBy(financialAuditTrail.ipAddress);

    if (ipAddresses.length > 5) {
      // Using more than 5 different IPs in a week
      factors.push({
        id: `behavioral_multiple_ips_${Date.now()}`,
        category: "behavioral",
        type: "multiple_ip_addresses",
        description: `User accessed from ${ipAddresses.length} different IP addresses`,
        severity: ipAddresses.length > 10 ? "high" : "medium",
        impact: 60,
        likelihood: 50,
        riskValue: 30,
        evidence: [`${ipAddresses.length} unique IP addresses in 7 days`],
        detectedAt: new Date(),
      });
    }

    return factors;
  }

  private async identifyTechnicalRiskFactors(
    entityId: string,
    entityType: string,
    projectId: string
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Check for data integrity issues
    const integrityIssues = await db
      .select({ count: count() })
      .from(financialAuditTrail)
      .where(
        and(
          entityType === "user"
            ? eq(financialAuditTrail.userId, entityId)
            : sql`${financialAuditTrail.entityId} = ${entityId}`,
          eq(financialAuditTrail.projectId, projectId),
          eq(financialAuditTrail.isVerified, false)
        )
      );

    const integrityCount = integrityIssues[0]?.count || 0;
    if (integrityCount > 0) {
      factors.push({
        id: `technical_integrity_${Date.now()}`,
        category: "technical",
        type: "data_integrity_issues",
        description: `${integrityCount} entries with integrity verification failures`,
        severity: integrityCount > 10 ? "critical" : "high",
        impact: 90,
        likelihood: 100, // If integrity failed, it definitely happened
        riskValue: 90,
        evidence: [`${integrityCount} entries failed checksum verification`],
        detectedAt: new Date(),
      });
    }

    return factors;
  }

  private getRiskFactorWeight(category: string, severity: string): number {
    const categoryWeights = {
      financial: 1.0,
      compliance: 0.9,
      behavioral: 0.7,
      operational: 0.6,
      technical: 0.8,
    };

    const severityMultipliers = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      critical: 2.0,
    };

    return (
      (categoryWeights[category as keyof typeof categoryWeights] || 1.0) *
      (severityMultipliers[severity as keyof typeof severityMultipliers] || 1.0)
    );
  }

  private applyEntityAdjustments(risk: number, entityType: string): number {
    const adjustments = {
      user: 1.0, // No adjustment for users
      transaction: 0.8, // Individual transactions slightly less risky
      project: 1.2, // Projects have higher baseline risk
      vendor: 0.9, // Vendors moderate risk
    };

    return risk * (adjustments[entityType as keyof typeof adjustments] || 1.0);
  }

  private createMitigationStrategy(factor: RiskFactor): MitigationStrategy {
    const strategies: Record<string, Partial<MitigationStrategy>> = {
      high_value_transactions: {
        strategy: "Implement additional approval requirements for high-value transactions",
        priority: "high",
        estimatedEffectiveness: 85,
        implementationCost: "medium",
        timeframe: "2-4 weeks",
      },
      rapid_transactions: {
        strategy: "Add rate limiting and sequence validation",
        priority: "high",
        estimatedEffectiveness: 90,
        implementationCost: "low",
        timeframe: "1-2 weeks",
      },
      after_hours_activity: {
        strategy: "Require additional authentication for after-hours access",
        priority: "medium",
        estimatedEffectiveness: 75,
        implementationCost: "low",
        timeframe: "1-2 weeks",
      },
      compliance_violations: {
        strategy: "Implement automated compliance checking and staff training",
        priority: "high",
        estimatedEffectiveness: 80,
        implementationCost: "medium",
        timeframe: "4-6 weeks",
      },
      multiple_ip_addresses: {
        strategy: "Enable IP address monitoring and geolocation alerts",
        priority: "medium",
        estimatedEffectiveness: 70,
        implementationCost: "low",
        timeframe: "1 week",
      },
      data_integrity_issues: {
        strategy: "Investigate and fix data integrity problems immediately",
        priority: "urgent",
        estimatedEffectiveness: 95,
        implementationCost: "high",
        timeframe: "Immediate",
      },
    };

    const baseStrategy = strategies[factor.type] || {
      strategy: `Address ${factor.type} risk`,
      priority: "medium" as const,
      estimatedEffectiveness: 60,
      implementationCost: "medium" as const,
      timeframe: "2-4 weeks",
    };

    return {
      id: `mitigation_${factor.id}_${Date.now()}`,
      riskFactorId: factor.id,
      status: "proposed",
      ...baseStrategy,
    } as MitigationStrategy;
  }

  private getRiskLevel(
    score: number
  ): "very_low" | "low" | "medium" | "high" | "very_high" | "critical" {
    if (score < 20) return "very_low";
    if (score < 40) return "low";
    if (score < 60) return "medium";
    if (score < 80) return "high";
    if (score < 95) return "very_high";
    return "critical";
  }

  private async getUserTransactions(
    userId: string,
    projectId: string,
    period: { start: Date; end: Date }
  ) {
    return await db
      .select()
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.userId, userId),
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, period.start),
          lte(financialAuditTrail.eventTimestamp, period.end)
        )
      )
      .orderBy(desc(financialAuditTrail.eventTimestamp));
  }

  private async analyzeTransactionPatterns(transactions: any[]): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];

    // Group by entity type
    const entityTypeGroups = transactions.reduce(
      (groups, transaction) => {
        const entityType = transaction.entityType;
        if (!groups[entityType]) groups[entityType] = [];
        groups[entityType].push(transaction);
        return groups;
      },
      {} as Record<string, any[]>
    );

    Object.entries(entityTypeGroups).forEach(([entityType, entityTransactions]) => {
      if (entityTransactions.length < 3) return; // Need at least 3 for pattern

      const amounts = entityTransactions
        .filter((t) => t.monetaryAmount)
        .map((t) => new Money(t.monetaryAmount));

      const timeRanges = entityTransactions.map((t) => {
        const hour = new Date(t.eventTimestamp).getHours();
        if (hour < 12) return "morning";
        if (hour < 18) return "afternoon";
        return "evening";
      });

      const commonTimeRanges = [...new Set(timeRanges)];

      if (amounts.length > 0) {
        patterns.push({
          pattern: `${entityType}_transactions`,
          frequency: entityTransactions.length,
          typicalAmount: Money.average(amounts),
          amountRange: {
            min: Money.min(...amounts),
            max: Money.max(...amounts),
          },
          commonTimeRanges,
          entityTypes: [entityType],
          confidence: Math.min(95, 60 + entityTransactions.length * 5),
        });
      }
    });

    return patterns;
  }

  private async analyzeAccessPatterns(
    userId: string,
    projectId: string,
    period: { start: Date; end: Date }
  ): Promise<AccessPattern[]> {
    const patterns: AccessPattern[] = [];

    const accessData = await db
      .select({
        ipAddress: financialAuditTrail.ipAddress,
        timestamp: financialAuditTrail.eventTimestamp,
      })
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.userId, userId),
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, period.start),
          lte(financialAuditTrail.eventTimestamp, period.end)
        )
      );

    if (accessData.length > 0) {
      const ipAddresses = [...new Set(accessData.map((d) => d.ipAddress).filter(Boolean))];
      const timeRanges = accessData.map((d) => {
        const hour = d.timestamp.getHours();
        if (hour < 12) return "morning";
        if (hour < 18) return "afternoon";
        return "evening";
      });

      patterns.push({
        pattern: "regular_access",
        frequency: accessData.length,
        timeRanges: [...new Set(timeRanges)],
        ipAddresses,
        deviceFingerprints: [], // Would need device fingerprinting
        locations: [], // Would need geolocation
        confidence: Math.min(90, 50 + Math.min(accessData.length, 20) * 2),
      });
    }

    return patterns;
  }

  private async identifyBehaviorRiskIndicators(
    userId: string,
    projectId: string,
    transactions: any[],
    period: { start: Date; end: Date }
  ): Promise<RiskIndicator[]> {
    const indicators: RiskIndicator[] = [];

    // Check for unusual volume
    const historicalDaily = await this.getHistoricalDailyAverage(userId, projectId);
    const currentDaily =
      transactions.length /
      Math.max(1, (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24));

    if (currentDaily > historicalDaily * 3) {
      indicators.push({
        indicator: "unusual_volume",
        severity: "high",
        description: `Current daily average ${currentDaily.toFixed(1)} is ${(currentDaily / historicalDaily).toFixed(1)}x historical average`,
        evidence: [
          `Current: ${currentDaily.toFixed(1)}/day`,
          `Historical: ${historicalDaily.toFixed(1)}/day`,
        ],
        firstDetected: period.start,
        lastSeen: new Date(),
        frequency: 1,
      });
    }

    return indicators;
  }

  private async calculateBehaviorScore(
    transactionPatterns: TransactionPattern[],
    accessPatterns: AccessPattern[],
    riskIndicators: RiskIndicator[]
  ): Promise<number> {
    let score = 100; // Start with perfect score

    // Reduce score based on risk indicators
    riskIndicators.forEach((indicator) => {
      const reduction = {
        low: 5,
        medium: 15,
        high: 25,
        critical: 40,
      }[indicator.severity];

      score -= reduction;
    });

    // Adjust for pattern consistency
    const patternConfidence =
      transactionPatterns.reduce((sum, pattern) => sum + pattern.confidence, 0) /
      Math.max(transactionPatterns.length, 1);

    if (patternConfidence < 70) {
      score -= (70 - patternConfidence) * 0.5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private determineTrustLevel(
    behaviorScore: number,
    anomalyCount: number
  ): "very_low" | "low" | "medium" | "high" | "very_high" {
    let adjustedScore = behaviorScore - anomalyCount * 5;

    if (adjustedScore >= 90) return "very_high";
    if (adjustedScore >= 75) return "high";
    if (adjustedScore >= 60) return "medium";
    if (adjustedScore >= 40) return "low";
    return "very_low";
  }

  private generateBehaviorRecommendations(
    behaviorScore: number,
    riskIndicators: RiskIndicator[],
    anomalyCount: number
  ): string[] {
    const recommendations: string[] = [];

    if (behaviorScore < 60) {
      recommendations.push("Enhanced monitoring recommended");
      recommendations.push("Consider additional authentication requirements");
    }

    if (anomalyCount > 5) {
      recommendations.push("Investigate recent anomalous activities");
      recommendations.push("Review user access permissions");
    }

    riskIndicators.forEach((indicator) => {
      if (indicator.severity === "high" || indicator.severity === "critical") {
        recommendations.push(`Address ${indicator.indicator}: ${indicator.description}`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push("Continue normal monitoring");
      recommendations.push("Maintain current security measures");
    }

    return recommendations;
  }

  private async calculateRiskBreakdown(projectId: string, period: { start: Date; end: Date }) {
    // This would perform detailed risk analysis by category
    // For now, return mock data with realistic values
    return {
      financial: 45,
      operational: 35,
      compliance: 25,
      behavioral: 30,
      technical: 20,
    };
  }

  private async getActiveUsers(
    projectId: string,
    period: { start: Date; end: Date }
  ): Promise<string[]> {
    const results = await db
      .select({ userId: financialAuditTrail.userId })
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, period.start),
          lte(financialAuditTrail.eventTimestamp, period.end)
        )
      )
      .groupBy(financialAuditTrail.userId)
      .orderBy(desc(count()));

    return results.map((r) => r.userId);
  }

  private async calculateRiskTrends(
    projectId: string,
    period: { start: Date; end: Date }
  ): Promise<RiskTrend[]> {
    const trends: RiskTrend[] = [];

    // Generate daily trends for the period
    const currentDate = new Date(period.start);
    while (currentDate <= period.end) {
      // Mock trend data - in reality would calculate from actual risk factors
      trends.push({
        date: new Date(currentDate),
        overallRisk: 30 + Math.random() * 20,
        financialRisk: 25 + Math.random() * 25,
        complianceRisk: 20 + Math.random() * 15,
        behavioralRisk: 15 + Math.random() * 20,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trends;
  }

  private generateRiskRecommendations(
    overallRiskScore: number,
    riskBreakdown: any,
    topRisks: RiskFactor[]
  ): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = [];

    if (overallRiskScore > 70) {
      recommendations.push({
        priority: "urgent",
        category: "overall",
        recommendation: "Immediate comprehensive risk review required",
        rationale: `Overall risk score of ${overallRiskScore} exceeds acceptable threshold`,
        estimatedImpact: "Significant reduction in operational risk",
        implementationSteps: [
          "Conduct emergency risk assessment meeting",
          "Implement immediate risk mitigation measures",
          "Establish enhanced monitoring protocols",
        ],
      });
    }

    // Address highest risk category
    const highestRiskCategory = Object.entries(riskBreakdown).sort(
      ([, a], [, b]) => (b as number) - (a as number)
    )[0];

    if (highestRiskCategory && highestRiskCategory[1] > 50) {
      recommendations.push({
        priority: "high",
        category: highestRiskCategory[0],
        recommendation: `Address high ${highestRiskCategory[0]} risk`,
        rationale: `${highestRiskCategory[0]} risk at ${highestRiskCategory[1]} requires attention`,
        estimatedImpact: `20-30% reduction in ${highestRiskCategory[0]} risk`,
        implementationSteps: [
          `Review ${highestRiskCategory[0]} controls`,
          "Implement additional safeguards",
          "Train staff on risk mitigation",
        ],
      });
    }

    // Address top risks
    topRisks.slice(0, 3).forEach((risk, index) => {
      recommendations.push({
        priority: index === 0 ? "high" : "medium",
        category: risk.category,
        recommendation: `Mitigate ${risk.type}`,
        rationale: risk.description,
        estimatedImpact: `Reduce risk by ${Math.round(risk.riskValue * 0.7)} points`,
        implementationSteps: [
          "Assess current controls",
          "Implement specific mitigation measures",
          "Monitor effectiveness",
        ],
      });
    });

    return recommendations;
  }

  private async getHistoricalDailyAverage(userId: string, projectId: string): Promise<number> {
    // Get historical data for comparison (90 days ago)
    const historicalStart = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000); // 120 days ago
    const historicalEnd = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const historical = await db
      .select({ count: count() })
      .from(financialAuditTrail)
      .where(
        and(
          eq(financialAuditTrail.userId, userId),
          eq(financialAuditTrail.projectId, projectId),
          gte(financialAuditTrail.eventTimestamp, historicalStart),
          lte(financialAuditTrail.eventTimestamp, historicalEnd)
        )
      );

    const totalTransactions = historical[0]?.count || 0;
    const totalDays = 90;

    return totalTransactions / totalDays;
  }

  // Fraud detection methods
  private async checkTimeBasedFraud(transactionData: any): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    const hour = new Date(transactionData.timestamp).getHours();
    if (hour < 6 || hour > 22) {
      indicators.push({
        type: "unusual_time",
        description: "Transaction outside normal business hours",
        severity: "medium",
        confidence: 75,
        contributionToScore: 15,
      });
    }

    return indicators;
  }

  private async checkAmountBasedFraud(
    transactionData: any,
    projectId: string
  ): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    if (transactionData.amount && transactionData.amount > 500000) {
      indicators.push({
        type: "high_value",
        description: "Unusually high transaction amount",
        severity: "high",
        confidence: 85,
        contributionToScore: 25,
      });
    }

    return indicators;
  }

  private async checkBehavioralFraud(
    transactionData: any,
    projectId: string
  ): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    // Check for rapid sequences (placeholder)
    // In reality, would check database for recent transactions by same user

    return indicators;
  }

  private async checkPatternBasedFraud(
    transactionData: any,
    projectId: string
  ): Promise<FraudIndicator[]> {
    const indicators: FraudIndicator[] = [];

    // Check for suspicious patterns (placeholder)
    // In reality, would analyze patterns against historical data

    return indicators;
  }

  private calculateFraudProbability(fraudScore: number): number {
    // Convert fraud score (0-100) to probability (0-1)
    return Math.min(0.99, fraudScore / 100);
  }

  private getFraudRiskLevel(
    fraudScore: number
  ): "very_low" | "low" | "medium" | "high" | "very_high" | "critical" {
    return this.getRiskLevel(fraudScore);
  }

  private getRecommendedAction(
    fraudScore: number,
    riskLevel: string
  ): "approve" | "review" | "hold" | "deny" {
    if (fraudScore < 20) return "approve";
    if (fraudScore < 50) return "review";
    if (fraudScore < 80) return "hold";
    return "deny";
  }

  private generateFraudExplanation(indicators: FraudIndicator[], fraudScore: number): string {
    if (indicators.length === 0) {
      return "No fraud indicators detected. Transaction appears legitimate.";
    }

    const descriptions = indicators.map((i) => i.description);
    return `Fraud score: ${fraudScore}/100. Key indicators: ${descriptions.join(", ")}`;
  }
}

// =============================================
// Export Service Instance
// =============================================

export const riskAssessmentEngine = new RiskAssessmentEngine();
