/**
 * Anomaly Detection Engine
 *
 * Advanced statistical analysis and machine learning-inspired techniques
 * for detecting suspicious activities and patterns in financial transactions.
 * Specialized for Philippine resort operations and compliance requirements.
 */

import { db } from "@/lib/db";
import { financialAuditTrail } from "@/lib/db/schema/financial-audit.schema";
import { Money } from "@/lib/money";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";

// =============================================
// Core Types and Interfaces
// =============================================

export interface AnomalyDetectionConfig {
  timeWindow: {
    rapidTransactionMinutes: number;
    businessHoursStart: number;
    businessHoursEnd: number;
    businessDays: number[]; // 0=Sunday, 1=Monday, etc.
  };
  thresholds: {
    highValueAmount: number;
    rapidTransactionCount: number;
    dailyTransactionLimit: number;
    standardDeviationMultiplier: number;
    behaviorScoreThreshold: number;
  };
  weights: {
    timeAnomaly: number;
    amountAnomaly: number;
    behaviorAnomaly: number;
    patternAnomaly: number;
  };
}

export interface TimeAnomaly {
  id: string;
  type: "after_hours" | "weekend" | "holiday" | "rapid_sequence";
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  description: string;
  timestamp: Date;
  details: {
    hour?: number;
    day?: number;
    sequenceCount?: number;
    businessReason?: string;
  };
  recommendations: string[];
}

export interface AmountAnomaly {
  id: string;
  type: "outlier" | "suspicious_rounding" | "duplicate_amount" | "pattern_deviation";
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  description: string;
  amount: Money;
  details: {
    expectedAmount?: Money;
    deviation?: Money;
    standardDeviations?: number;
    historicalAverage?: Money;
    frequency?: number;
  };
  recommendations: string[];
}

export interface BehaviorAnomaly {
  id: string;
  type: "unusual_volume" | "permission_escalation" | "location_change" | "access_pattern";
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  description: string;
  userId: string;
  details: {
    currentVolume?: number;
    normalVolume?: number;
    newPermissions?: string[];
    locationChange?: { from: string; to: string };
    accessTimes?: Date[];
  };
  recommendations: string[];
}

export interface PatternAnomaly {
  id: string;
  type: "timing_pattern" | "amount_pattern" | "user_pattern" | "category_pattern";
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  description: string;
  pattern: string;
  details: {
    frequency?: number;
    expectedFrequency?: number;
    patternDuration?: number;
    affectedEntities?: string[];
  };
  recommendations: string[];
}

export interface UserActivity {
  userId: string;
  userName?: string;
  action: string;
  entityType: string;
  amount?: Money;
  timestamp: Date;
  ipAddress?: string;
  location?: string;
}

export interface TransactionContext {
  projectId: string;
  entityType: string;
  amount: Money;
  userId: string;
  timestamp: Date;
  action: string;
  ipAddress?: string;
}

export interface PatternAnalysis {
  patterns: DetectedPattern[];
  riskScore: number;
  recommendations: string[];
  affectedPeriod: {
    start: Date;
    end: Date;
  };
}

export interface DetectedPattern {
  type: string;
  description: string;
  frequency: number;
  riskLevel: "low" | "medium" | "high";
  examples: string[];
}

export interface BehaviorAnalysis {
  userId: string;
  period: { start: Date; end: Date };
  baseline: BehaviorBaseline;
  currentBehavior: BehaviorMetrics;
  anomalies: BehaviorAnomaly[];
  overallRiskScore: number;
  recommendations: string[];
}

export interface BehaviorBaseline {
  averageTransactionsPerDay: number;
  commonTransactionHours: number[];
  typicalAmountRanges: { min: Money; max: Money; avg: Money };
  frequentEntityTypes: string[];
  preferredActions: string[];
}

export interface BehaviorMetrics {
  transactionsPerDay: number;
  activeHours: number[];
  amountDistribution: { min: Money; max: Money; avg: Money };
  entityTypes: string[];
  actions: string[];
  locationConsistency: boolean;
}

// =============================================
// Default Configuration
// =============================================

export const DEFAULT_ANOMALY_CONFIG: AnomalyDetectionConfig = {
  timeWindow: {
    rapidTransactionMinutes: 5,
    businessHoursStart: 8,
    businessHoursEnd: 18,
    businessDays: [1, 2, 3, 4, 5], // Monday to Friday
  },
  thresholds: {
    highValueAmount: 100000, // PHP 100,000
    rapidTransactionCount: 10,
    dailyTransactionLimit: 100,
    standardDeviationMultiplier: 2.5,
    behaviorScoreThreshold: 70,
  },
  weights: {
    timeAnomaly: 0.25,
    amountAnomaly: 0.35,
    behaviorAnomaly: 0.25,
    patternAnomaly: 0.15,
  },
};

// =============================================
// Anomaly Detection Engine
// =============================================

export class AnomalyDetector {
  constructor(private config: AnomalyDetectionConfig = DEFAULT_ANOMALY_CONFIG) {}

  /**
   * Analyze transaction patterns for anomalies
   */
  async analyzeTransactionPatterns(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PatternAnalysis> {
    const transactions = await this.getTransactionsInPeriod(projectId, startDate, endDate);

    // Detect various patterns
    const patterns: DetectedPattern[] = [];

    // Time-based patterns
    const timePatterns = await this.detectTimePatterns(transactions);
    patterns.push(...timePatterns);

    // Amount-based patterns
    const amountPatterns = await this.detectAmountPatterns(transactions);
    patterns.push(...amountPatterns);

    // User-based patterns
    const userPatterns = await this.detectUserPatterns(transactions);
    patterns.push(...userPatterns);

    // Entity-based patterns
    const entityPatterns = await this.detectEntityPatterns(transactions);
    patterns.push(...entityPatterns);

    // Calculate overall risk score
    const riskScore = this.calculatePatternRiskScore(patterns);

    // Generate recommendations
    const recommendations = this.generatePatternRecommendations(patterns);

    return {
      patterns,
      riskScore,
      recommendations,
      affectedPeriod: { start: startDate, end: endDate },
    };
  }

  /**
   * Detect unusual timing patterns
   */
  async detectUnusualTiming(activities: UserActivity[]): Promise<TimeAnomaly[]> {
    const anomalies: TimeAnomaly[] = [];

    // Group activities by time patterns
    const hourlyDistribution = this.analyzeHourlyDistribution(activities);
    const dailyDistribution = this.analyzeDailyDistribution(activities);

    // Detect after-hours activities
    const afterHoursAnomalies = this.detectAfterHoursActivities(activities);
    anomalies.push(...afterHoursAnomalies);

    // Detect weekend activities
    const weekendAnomalies = this.detectWeekendActivities(activities);
    anomalies.push(...weekendAnomalies);

    // Detect rapid sequences
    const rapidSequenceAnomalies = this.detectRapidSequences(activities);
    anomalies.push(...rapidSequenceAnomalies);

    return anomalies;
  }

  /**
   * Identify amount-based outliers and suspicious patterns
   */
  async identifyOutliers(amounts: Money[], context: TransactionContext): Promise<AmountAnomaly[]> {
    const anomalies: AmountAnomaly[] = [];

    if (amounts.length < 10) {
      // Not enough data for statistical analysis
      return anomalies;
    }

    // Statistical outlier detection
    const statisticalOutliers = this.detectStatisticalOutliers(amounts, context);
    anomalies.push(...statisticalOutliers);

    // Suspicious rounding patterns
    const roundingAnomalies = this.detectSuspiciousRounding(amounts, context);
    anomalies.push(...roundingAnomalies);

    // Duplicate amount patterns
    const duplicateAnomalies = this.detectDuplicateAmounts(amounts, context);
    anomalies.push(...duplicateAnomalies);

    // Pattern deviation analysis
    const patternDeviations = await this.detectAmountPatternDeviations(amounts, context);
    anomalies.push(...patternDeviations);

    return anomalies;
  }

  /**
   * Assess user behavior for anomalies
   */
  async assessUserBehavior(
    userId: string,
    projectId: string,
    period: { start: Date; end: Date }
  ): Promise<BehaviorAnalysis> {
    // Get user's activity for the period
    const currentActivity = await this.getUserActivity(userId, projectId, period);

    // Get baseline behavior (historical data)
    const baseline = await this.getUserBehaviorBaseline(userId, projectId);

    // Calculate current behavior metrics
    const currentBehavior = this.calculateCurrentBehaviorMetrics(currentActivity);

    // Detect behavioral anomalies
    const anomalies = await this.detectBehaviorAnomalies(
      baseline,
      currentBehavior,
      currentActivity
    );

    // Calculate overall risk score
    const overallRiskScore = this.calculateBehaviorRiskScore(baseline, currentBehavior, anomalies);

    // Generate recommendations
    const recommendations = this.generateBehaviorRecommendations(anomalies);

    return {
      userId,
      period,
      baseline,
      currentBehavior,
      anomalies,
      overallRiskScore,
      recommendations,
    };
  }

  // =============================================
  // Private Helper Methods - Time Analysis
  // =============================================

  private analyzeHourlyDistribution(activities: UserActivity[]): Record<number, number> {
    const distribution: Record<number, number> = {};

    for (let hour = 0; hour < 24; hour++) {
      distribution[hour] = 0;
    }

    activities.forEach((activity) => {
      const hour = activity.timestamp.getHours();
      distribution[hour] = (distribution[hour] || 0) + 1;
    });

    return distribution;
  }

  private analyzeDailyDistribution(activities: UserActivity[]): Record<number, number> {
    const distribution: Record<number, number> = {};

    for (let day = 0; day < 7; day++) {
      distribution[day] = 0;
    }

    activities.forEach((activity) => {
      const day = activity.timestamp.getDay();
      distribution[day] = (distribution[day] || 0) + 1;
    });

    return distribution;
  }

  private detectAfterHoursActivities(activities: UserActivity[]): TimeAnomaly[] {
    const anomalies: TimeAnomaly[] = [];

    activities.forEach((activity) => {
      const hour = activity.timestamp.getHours();

      if (
        hour < this.config.timeWindow.businessHoursStart ||
        hour > this.config.timeWindow.businessHoursEnd
      ) {
        const severity = this.calculateTimeAnomalySeverity(hour, activity);

        anomalies.push({
          id: `after_hours_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: "after_hours",
          severity,
          score: this.calculateTimeAnomalyScore(severity, hour),
          description: `Transaction outside business hours at ${hour}:${activity.timestamp.getMinutes().toString().padStart(2, "0")}`,
          timestamp: activity.timestamp,
          details: { hour },
          recommendations: [
            "Review transaction justification",
            "Verify user authorization for after-hours access",
            "Check for automated processes",
            "Confirm business necessity",
          ],
        });
      }
    });

    return anomalies;
  }

  private detectWeekendActivities(activities: UserActivity[]): TimeAnomaly[] {
    const anomalies: TimeAnomaly[] = [];

    activities.forEach((activity) => {
      const day = activity.timestamp.getDay();

      if (!this.config.timeWindow.businessDays.includes(day)) {
        const severity = this.isHighImpactAction(activity.action) ? "medium" : "low";

        anomalies.push({
          id: `weekend_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: "weekend",
          severity: severity as "low" | "medium" | "high" | "critical",
          score: severity === "medium" ? 60 : 35,
          description: `Business transaction on ${this.getDayName(day)}`,
          timestamp: activity.timestamp,
          details: { day },
          recommendations: [
            "Verify weekend work authorization",
            "Check business necessity",
            "Review approval process",
            "Confirm transaction legitimacy",
          ],
        });
      }
    });

    return anomalies;
  }

  private detectRapidSequences(activities: UserActivity[]): TimeAnomaly[] {
    const anomalies: TimeAnomaly[] = [];

    // Sort activities by timestamp
    const sortedActivities = [...activities].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Group by rapid sequences
    let sequenceStart = 0;
    for (let i = 1; i < sortedActivities.length; i++) {
      const timeDiff =
        sortedActivities[i].timestamp.getTime() -
        sortedActivities[sequenceStart].timestamp.getTime();

      if (timeDiff > this.config.timeWindow.rapidTransactionMinutes * 60 * 1000) {
        // Check if we had a rapid sequence
        const sequenceCount = i - sequenceStart;
        if (sequenceCount >= this.config.thresholds.rapidTransactionCount) {
          const severity = this.calculateRapidSequenceSeverity(sequenceCount);

          anomalies.push({
            id: `rapid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: "rapid_sequence",
            severity,
            score: Math.min(95, 50 + sequenceCount * 5),
            description: `Rapid sequence of ${sequenceCount} transactions in ${this.config.timeWindow.rapidTransactionMinutes} minutes`,
            timestamp: sortedActivities[sequenceStart].timestamp,
            details: { sequenceCount },
            recommendations: [
              "Investigate potential automation",
              "Verify user actions",
              "Check for system issues",
              "Review transaction legitimacy",
            ],
          });
        }
        sequenceStart = i;
      }
    }

    return anomalies;
  }

  // =============================================
  // Private Helper Methods - Amount Analysis
  // =============================================

  private detectStatisticalOutliers(
    amounts: Money[],
    context: TransactionContext
  ): AmountAnomaly[] {
    const anomalies: AmountAnomaly[] = [];

    if (amounts.length < 10) return anomalies;

    const mean = Money.average(amounts);
    const stdDev = this.calculateStandardDeviation(amounts);

    amounts.forEach((amount, index) => {
      const deviation = amount.subtract(mean).abs();
      const standardDeviations = deviation.toNumber() / stdDev.toNumber();

      if (standardDeviations > this.config.thresholds.standardDeviationMultiplier) {
        const severity = this.calculateOutlierSeverity(standardDeviations);

        anomalies.push({
          id: `outlier_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: "outlier",
          severity,
          score: Math.min(95, 40 + standardDeviations * 10),
          description: `Amount ${amount.format()} deviates ${standardDeviations.toFixed(1)} standard deviations from mean ${mean.format()}`,
          amount,
          details: {
            expectedAmount: mean,
            deviation,
            standardDeviations,
            historicalAverage: mean,
          },
          recommendations: [
            "Verify transaction accuracy",
            "Check for data entry errors",
            "Confirm business justification",
            "Review approval process",
          ],
        });
      }
    });

    return anomalies;
  }

  private detectSuspiciousRounding(amounts: Money[], context: TransactionContext): AmountAnomaly[] {
    const anomalies: AmountAnomaly[] = [];

    // Look for excessive rounding patterns (too many round numbers)
    const roundAmounts = amounts.filter((amount) => {
      const num = amount.toNumber();
      return num % 100 === 0 || num % 1000 === 0 || num % 10000 === 0;
    });

    const roundingPercentage = (roundAmounts.length / amounts.length) * 100;

    if (roundingPercentage > 70) {
      // More than 70% rounded amounts is suspicious
      anomalies.push({
        id: `rounding_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: "suspicious_rounding",
        severity: "medium",
        score: Math.min(80, 30 + roundingPercentage),
        description: `${roundingPercentage.toFixed(1)}% of transactions use round amounts`,
        amount: Money.average(roundAmounts),
        details: {
          frequency: roundAmounts.length,
          historicalAverage: Money.average(amounts),
        },
        recommendations: [
          "Review transaction legitimacy",
          "Check for manual adjustments",
          "Verify pricing accuracy",
          "Investigate potential fraud",
        ],
      });
    }

    return anomalies;
  }

  private detectDuplicateAmounts(amounts: Money[], context: TransactionContext): AmountAnomaly[] {
    const anomalies: AmountAnomaly[] = [];

    // Count frequency of each amount
    const amountFrequency = new Map<string, { amount: Money; count: number }>();

    amounts.forEach((amount) => {
      const key = amount.toString();
      const existing = amountFrequency.get(key);
      if (existing) {
        existing.count++;
      } else {
        amountFrequency.set(key, { amount, count: 1 });
      }
    });

    // Look for suspiciously frequent duplicate amounts
    amountFrequency.forEach(({ amount, count }) => {
      const frequency = (count / amounts.length) * 100;

      if (count > 5 && frequency > 20) {
        // Same amount appears > 5 times and > 20% frequency
        anomalies.push({
          id: `duplicate_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: "duplicate_amount",
          severity: count > 10 ? "high" : "medium",
          score: Math.min(85, 40 + count * 3),
          description: `Amount ${amount.format()} appears ${count} times (${frequency.toFixed(1)}% of transactions)`,
          amount,
          details: {
            frequency: count,
            historicalAverage: Money.average(amounts),
          },
          recommendations: [
            "Verify transaction uniqueness",
            "Check for copy-paste errors",
            "Review pricing consistency",
            "Investigate potential issues",
          ],
        });
      }
    });

    return anomalies;
  }

  private async detectAmountPatternDeviations(
    amounts: Money[],
    context: TransactionContext
  ): Promise<AmountAnomaly[]> {
    const anomalies: AmountAnomaly[] = [];

    // Get historical amounts for comparison
    const historicalAmounts = await this.getHistoricalAmounts(
      context.projectId,
      context.entityType,
      30 // days
    );

    if (historicalAmounts.length < 10) return anomalies;

    const currentAvg = Money.average(amounts);
    const historicalAvg = Money.average(historicalAmounts);
    const deviation = currentAvg.subtract(historicalAvg).abs();
    const deviationPercentage = (deviation.toNumber() / historicalAvg.toNumber()) * 100;

    if (deviationPercentage > 50) {
      // More than 50% deviation from historical average
      anomalies.push({
        id: `pattern_deviation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: "pattern_deviation",
        severity: deviationPercentage > 100 ? "high" : "medium",
        score: Math.min(90, 30 + deviationPercentage * 0.5),
        description: `Current average ${currentAvg.format()} deviates ${deviationPercentage.toFixed(1)}% from historical average ${historicalAvg.format()}`,
        amount: currentAvg,
        details: {
          expectedAmount: historicalAvg,
          deviation,
          historicalAverage: historicalAvg,
        },
        recommendations: [
          "Review recent pricing changes",
          "Check for market conditions",
          "Verify transaction categories",
          "Investigate business changes",
        ],
      });
    }

    return anomalies;
  }

  // =============================================
  // Private Helper Methods - Behavior Analysis
  // =============================================

  private async getUserActivity(
    userId: string,
    projectId: string,
    period: { start: Date; end: Date }
  ): Promise<UserActivity[]> {
    const results = await db
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

    return results.map((result) => ({
      userId: result.userId,
      userName: result.userName || undefined,
      action: result.action,
      entityType: result.entityType,
      amount: result.monetaryAmount ? new Money(result.monetaryAmount) : undefined,
      timestamp: result.eventTimestamp,
      ipAddress: result.ipAddress || undefined,
    }));
  }

  private async getUserBehaviorBaseline(
    userId: string,
    projectId: string
  ): Promise<BehaviorBaseline> {
    // Get 90 days of historical data for baseline
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const historicalActivity = await this.getUserActivity(userId, projectId, {
      start: startDate,
      end: endDate,
    });

    if (historicalActivity.length === 0) {
      // No historical data, create empty baseline
      return {
        averageTransactionsPerDay: 0,
        commonTransactionHours: [],
        typicalAmountRanges: { min: new Money(0), max: new Money(0), avg: new Money(0) },
        frequentEntityTypes: [],
        preferredActions: [],
      };
    }

    // Calculate baseline metrics
    const totalDays = 90;
    const averageTransactionsPerDay = historicalActivity.length / totalDays;

    // Analyze common hours
    const hourlyDistribution = this.analyzeHourlyDistribution(historicalActivity);
    const commonTransactionHours = Object.entries(hourlyDistribution)
      .filter(([hour, count]) => count > averageTransactionsPerDay * 0.1) // Hours with significant activity
      .map(([hour]) => parseInt(hour))
      .sort((a, b) => a - b);

    // Calculate amount ranges
    const amountsWithValues = historicalActivity.filter((a) => a.amount).map((a) => a.amount!);

    const typicalAmountRanges =
      amountsWithValues.length > 0
        ? {
            min: Money.min(...amountsWithValues),
            max: Money.max(...amountsWithValues),
            avg: Money.average(amountsWithValues),
          }
        : { min: new Money(0), max: new Money(0), avg: new Money(0) };

    // Most frequent entity types
    const entityTypeCount = historicalActivity.reduce(
      (acc, activity) => {
        acc[activity.entityType] = (acc[activity.entityType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const frequentEntityTypes = Object.entries(entityTypeCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);

    // Most preferred actions
    const actionCount = historicalActivity.reduce(
      (acc, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const preferredActions = Object.entries(actionCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action]) => action);

    return {
      averageTransactionsPerDay,
      commonTransactionHours,
      typicalAmountRanges,
      frequentEntityTypes,
      preferredActions,
    };
  }

  private calculateCurrentBehaviorMetrics(activities: UserActivity[]): BehaviorMetrics {
    if (activities.length === 0) {
      return {
        transactionsPerDay: 0,
        activeHours: [],
        amountDistribution: { min: new Money(0), max: new Money(0), avg: new Money(0) },
        entityTypes: [],
        actions: [],
        locationConsistency: true,
      };
    }

    // Calculate transactions per day (assuming activities span multiple days)
    const uniqueDays = new Set(activities.map((a) => a.timestamp.toDateString())).size;
    const transactionsPerDay = activities.length / Math.max(uniqueDays, 1);

    // Active hours
    const activeHours = [...new Set(activities.map((a) => a.timestamp.getHours()))].sort(
      (a, b) => a - b
    );

    // Amount distribution
    const amountsWithValues = activities.filter((a) => a.amount).map((a) => a.amount!);

    const amountDistribution =
      amountsWithValues.length > 0
        ? {
            min: Money.min(...amountsWithValues),
            max: Money.max(...amountsWithValues),
            avg: Money.average(amountsWithValues),
          }
        : { min: new Money(0), max: new Money(0), avg: new Money(0) };

    // Entity types and actions
    const entityTypes = [...new Set(activities.map((a) => a.entityType))];
    const actions = [...new Set(activities.map((a) => a.action))];

    // Location consistency (simplified - based on IP address consistency)
    const ipAddresses = new Set(activities.filter((a) => a.ipAddress).map((a) => a.ipAddress!));
    const locationConsistency = ipAddresses.size <= 2; // Allow up to 2 different IPs

    return {
      transactionsPerDay,
      activeHours,
      amountDistribution,
      entityTypes,
      actions,
      locationConsistency,
    };
  }

  private async detectBehaviorAnomalies(
    baseline: BehaviorBaseline,
    current: BehaviorMetrics,
    activities: UserActivity[]
  ): Promise<BehaviorAnomaly[]> {
    const anomalies: BehaviorAnomaly[] = [];

    // Volume anomaly
    if (baseline.averageTransactionsPerDay > 0) {
      const volumeIncrease = current.transactionsPerDay / baseline.averageTransactionsPerDay - 1;
      if (volumeIncrease > 2) {
        // More than 3x normal volume
        anomalies.push({
          id: `volume_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: "unusual_volume",
          severity: volumeIncrease > 5 ? "high" : "medium",
          score: Math.min(90, 40 + volumeIncrease * 10),
          description: `Transaction volume ${current.transactionsPerDay.toFixed(1)}/day is ${((volumeIncrease + 1) * 100).toFixed(0)}% of normal ${baseline.averageTransactionsPerDay.toFixed(1)}/day`,
          userId: activities[0]?.userId || "",
          details: {
            currentVolume: current.transactionsPerDay,
            normalVolume: baseline.averageTransactionsPerDay,
          },
          recommendations: [
            "Review transaction legitimacy",
            "Check for automated processes",
            "Verify user account security",
            "Investigate business changes",
          ],
        });
      }
    }

    // Location consistency anomaly
    if (!current.locationConsistency) {
      anomalies.push({
        id: `location_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: "location_change",
        severity: "medium",
        score: 55,
        description: "Multiple IP addresses detected for user sessions",
        userId: activities[0]?.userId || "",
        details: {
          locationChange: { from: "various", to: "various" },
        },
        recommendations: [
          "Verify user identity",
          "Check for account sharing",
          "Review login security",
          "Confirm authorized access",
        ],
      });
    }

    return anomalies;
  }

  // =============================================
  // Utility Methods
  // =============================================

  private calculateStandardDeviation(amounts: Money[]): Money {
    if (amounts.length < 2) return new Money(0);

    const mean = Money.average(amounts);
    const squaredDiffs = amounts.map((amount) => {
      const diff = amount.subtract(mean);
      return new Money(diff.toNumber() * diff.toNumber());
    });

    const variance = Money.average(squaredDiffs);
    return new Money(Math.sqrt(variance.toNumber()));
  }

  private calculateTimeAnomalySeverity(
    hour: number,
    activity: UserActivity
  ): "low" | "medium" | "high" | "critical" {
    // Late night (11 PM - 5 AM) is more severe
    if (hour >= 23 || hour <= 5) return "high";
    // Early morning (5 AM - 8 AM) or late evening (6 PM - 11 PM)
    if (hour <= 8 || hour >= 18) return "medium";
    return "low";
  }

  private calculateTimeAnomalyScore(severity: string, hour: number): number {
    const baseScore = { low: 30, medium: 50, high: 75, critical: 90 }[severity] || 30;

    // Adjust based on how far from business hours
    const businessCenter =
      (this.config.timeWindow.businessHoursStart + this.config.timeWindow.businessHoursEnd) / 2;
    const hourDistance = Math.abs(hour - businessCenter);

    return Math.min(95, baseScore + hourDistance * 2);
  }

  private isHighImpactAction(action: string): boolean {
    const highImpactActions = ["delete", "void", "cancel", "approve", "reject", "transfer"];
    return highImpactActions.some((a) => action.toLowerCase().includes(a));
  }

  private getDayName(day: number): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[day];
  }

  private calculateRapidSequenceSeverity(count: number): "low" | "medium" | "high" | "critical" {
    if (count > 50) return "critical";
    if (count > 25) return "high";
    if (count > 15) return "medium";
    return "low";
  }

  private calculateOutlierSeverity(
    standardDeviations: number
  ): "low" | "medium" | "high" | "critical" {
    if (standardDeviations > 5) return "critical";
    if (standardDeviations > 4) return "high";
    if (standardDeviations > 3) return "medium";
    return "low";
  }

  private calculatePatternRiskScore(patterns: DetectedPattern[]): number {
    const highRiskPatterns = patterns.filter((p) => p.riskLevel === "high").length;
    const mediumRiskPatterns = patterns.filter((p) => p.riskLevel === "medium").length;

    return Math.min(100, highRiskPatterns * 20 + mediumRiskPatterns * 10);
  }

  private calculateBehaviorRiskScore(
    baseline: BehaviorBaseline,
    current: BehaviorMetrics,
    anomalies: BehaviorAnomaly[]
  ): number {
    let score = 0;

    // Base score from anomalies
    score +=
      anomalies.reduce((sum, anomaly) => sum + anomaly.score, 0) / Math.max(anomalies.length, 1);

    // Adjust for deviation from baseline
    if (baseline.averageTransactionsPerDay > 0) {
      const volumeDeviation =
        Math.abs(current.transactionsPerDay - baseline.averageTransactionsPerDay) /
        baseline.averageTransactionsPerDay;
      score += Math.min(20, volumeDeviation * 30);
    }

    return Math.min(100, score);
  }

  private generatePatternRecommendations(patterns: DetectedPattern[]): string[] {
    const recommendations = new Set<string>();

    if (patterns.some((p) => p.riskLevel === "high")) {
      recommendations.add("Immediate investigation required for high-risk patterns");
      recommendations.add("Implement additional monitoring controls");
    }

    if (patterns.some((p) => p.type.includes("timing"))) {
      recommendations.add("Review transaction timing policies");
      recommendations.add("Consider implementing time-based controls");
    }

    if (patterns.some((p) => p.type.includes("amount"))) {
      recommendations.add("Validate transaction amounts and pricing");
      recommendations.add("Review approval thresholds");
    }

    recommendations.add("Regular pattern analysis and monitoring");
    recommendations.add("Staff training on suspicious activity detection");

    return Array.from(recommendations);
  }

  private generateBehaviorRecommendations(anomalies: BehaviorAnomaly[]): string[] {
    const recommendations = new Set<string>();

    anomalies.forEach((anomaly) => {
      recommendations.add(...anomaly.recommendations);
    });

    if (anomalies.length === 0) {
      recommendations.add("Continue monitoring user behavior patterns");
      recommendations.add("Maintain current security measures");
    }

    return Array.from(recommendations);
  }

  private async getTransactionsInPeriod(projectId: string, startDate: Date, endDate: Date) {
    return await db
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

  private async detectTimePatterns(transactions: any[]): Promise<DetectedPattern[]> {
    // Implement time pattern detection
    return [];
  }

  private async detectAmountPatterns(transactions: any[]): Promise<DetectedPattern[]> {
    // Implement amount pattern detection
    return [];
  }

  private async detectUserPatterns(transactions: any[]): Promise<DetectedPattern[]> {
    // Implement user pattern detection
    return [];
  }

  private async detectEntityPatterns(transactions: any[]): Promise<DetectedPattern[]> {
    // Implement entity pattern detection
    return [];
  }
}

// =============================================
// Export Service Instance
// =============================================

export const anomalyDetector = new AnomalyDetector();
