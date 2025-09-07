/**
 * Report Engine Service
 *
 * Core service for generating financial reports with caching, queuing, and strategy pattern.
 * Optimized for Philippine resort operations with proper Money class integration.
 */

import { Money } from "@/lib/money";
import { getRedisClient, type RedisClient } from "@/lib/cache/redis";
import { createFinancialServices } from "@/features/financial/services";
import type { FinancialServices } from "@/features/financial/services";
import { ProfitLossStrategy } from "@/lib/strategies/profit-loss.strategy";
import { CashFlowStrategy } from "@/lib/strategies/cash-flow.strategy";

// Report Types
export type ReportType = "profit-loss" | "cash-flow" | "occupancy" | "tax-summary";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export type ReportFormat = "json" | "excel" | "pdf" | "quickbooks";

// Report Configuration
export interface ReportConfig {
  projectId: string;
  reportType: ReportType;
  period: ReportPeriod;
  startDate: Date;
  endDate: Date;
  currency?: string;
  includeComparisons?: boolean;
  includeCharts?: boolean;
  format?: ReportFormat;
  cacheKey?: string;
  cacheTTL?: number; // seconds
}

// Report Metrics for Philippine Resorts
export interface ReportMetrics {
  totalRevenue: Money;
  totalExpenses: Money;
  netIncome: Money;
  grossMargin: number; // percentage
  occupancyRate?: number; // percentage
  averageDailyRate?: Money; // ADR
  revenuePerAvailableRoom?: Money; // RevPAR
  taxLiability: Money;
  vatCollected: Money;
  withholdingTaxPaid: Money;
}

// Report Data Structure
export interface ReportData {
  config: ReportConfig;
  metrics: ReportMetrics;
  details: Record<string, any>;
  generatedAt: Date;
  generatedBy: string;
  performance: {
    generationTime: number; // milliseconds
    cacheHit: boolean;
    dataPoints: number;
  };
}

// Report Generation Strategy Interface
export interface ReportStrategy {
  generateReport(config: ReportConfig, services: FinancialServices): Promise<ReportData>;
  validateConfig(config: ReportConfig): void;
  getCacheKey(config: ReportConfig): string;
  getCacheTTL(config: ReportConfig): number; // seconds
}

// Report Queue Job
export interface ReportJob {
  id: string;
  config: ReportConfig;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: ReportData;
  progress?: number; // 0-100
}

export class ReportEngineService {
  private redis: RedisClient;
  private financialServices: FinancialServices;
  private strategies: Map<ReportType, ReportStrategy> = new Map();
  private jobQueue: Map<string, ReportJob> = new Map();

  constructor() {
    this.redis = getRedisClient();
    this.financialServices = createFinancialServices();
    this.initializeStrategies();
  }

  /**
   * Initialize report generation strategies
   */
  private initializeStrategies(): void {
    this.strategies.set("profit-loss", new ProfitLossStrategy());
    this.strategies.set("cash-flow", new CashFlowStrategy());
    this.strategies.set("occupancy", new OccupancyStrategy());
    this.strategies.set("tax-summary", new TaxSummaryStrategy());
  }

  /**
   * Generate report with caching and performance tracking
   */
  async generateReport(config: ReportConfig, userId?: string): Promise<ReportData> {
    const startTime = Date.now();

    try {
      // Validate configuration
      this.validateReportConfig(config);

      // Get strategy for report type
      const strategy = this.strategies.get(config.reportType);
      if (!strategy) {
        throw new Error(`Report strategy not found for type: ${config.reportType}`);
      }

      // Validate strategy-specific configuration
      strategy.validateConfig(config);

      // Check cache first
      const cacheKey = config.cacheKey || strategy.getCacheKey(config);
      const cachedData = await this.getCachedReport(cacheKey);

      if (cachedData) {
        // Update performance metrics for cache hit
        cachedData.performance = {
          ...cachedData.performance,
          generationTime: Date.now() - startTime,
          cacheHit: true,
        };
        return cachedData;
      }

      // Generate fresh report
      const reportData = await strategy.generateReport(config, this.financialServices);

      // Update performance metrics
      reportData.performance = {
        ...reportData.performance,
        generationTime: Date.now() - startTime,
        cacheHit: false,
      };

      reportData.generatedAt = new Date();
      reportData.generatedBy = userId || "system";

      // Cache the result
      const cacheTTL = config.cacheTTL || strategy.getCacheTTL(config);
      await this.cacheReport(cacheKey, reportData, cacheTTL);

      return reportData;
    } catch (error: any) {
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Generate report asynchronously with job tracking
   */
  async generateReportAsync(config: ReportConfig, userId?: string): Promise<string> {
    const jobId = this.generateJobId();

    const job: ReportJob = {
      id: jobId,
      config,
      status: "pending",
      createdAt: new Date(),
      progress: 0,
    };

    this.jobQueue.set(jobId, job);

    // Start processing in background (non-blocking)
    this.processReportJob(jobId, userId).catch((error) => {
      job.status = "failed";
      job.error = error.message;
      job.completedAt = new Date();
    });

    return jobId;
  }

  /**
   * Get job status and result
   */
  async getJobStatus(jobId: string): Promise<ReportJob | null> {
    return this.jobQueue.get(jobId) || null;
  }

  /**
   * Get multiple reports in batch
   */
  async generateBatchReports(configs: ReportConfig[], userId?: string): Promise<ReportData[]> {
    const promises = configs.map((config) => this.generateReport(config, userId));
    return await Promise.all(promises);
  }

  /**
   * Get available report types
   */
  getAvailableReportTypes(): ReportType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Calculate report cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    hitRate: number;
    avgGenerationTime: number;
  }> {
    // This is a simplified implementation
    // In production, you'd track these metrics properly
    return {
      totalKeys: 0,
      hitRate: 0,
      avgGenerationTime: 0,
    };
  }

  /**
   * Invalidate cached reports for a project
   */
  async invalidateCache(projectId: string, reportType?: ReportType): Promise<void> {
    const pattern = reportType ? `report:${projectId}:${reportType}:*` : `report:${projectId}:*`;

    // Note: This is simplified - Redis pattern deletion would require lua script
    // For now, we'll just clear specific keys when we have them
  }

  /**
   * Validate report configuration
   */
  private validateReportConfig(config: ReportConfig): void {
    if (!config.projectId) {
      throw new Error("Project ID is required");
    }

    if (!config.startDate || !config.endDate) {
      throw new Error("Start date and end date are required");
    }

    if (config.startDate >= config.endDate) {
      throw new Error("Start date must be before end date");
    }

    // Limit date range to prevent performance issues
    const daysDiff =
      (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new Error("Date range cannot exceed 365 days");
    }
  }

  /**
   * Process report job in background
   */
  private async processReportJob(jobId: string, userId?: string): Promise<void> {
    const job = this.jobQueue.get(jobId);
    if (!job) return;

    try {
      job.status = "processing";
      job.startedAt = new Date();
      job.progress = 10;

      const reportData = await this.generateReport(job.config, userId);

      job.result = reportData;
      job.status = "completed";
      job.progress = 100;
      job.completedAt = new Date();
    } catch (error: any) {
      job.status = "failed";
      job.error = error.message;
      job.completedAt = new Date();
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cache report data
   */
  private async cacheReport(key: string, data: ReportData, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch (error) {
      // Log error but don't fail the report generation
      console.warn("Failed to cache report:", error);
    }
  }

  /**
   * Get cached report data
   */
  private async getCachedReport(key: string): Promise<ReportData | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        // Deserialize Money instances
        return this.deserializeReportData(data);
      }
      return null;
    } catch (error) {
      console.warn("Failed to get cached report:", error);
      return null;
    }
  }

  /**
   * Deserialize Money instances in cached report data
   */
  private deserializeReportData(data: any): ReportData {
    // Convert Money fields back to Money instances
    if (data.metrics) {
      const metrics = data.metrics;
      metrics.totalRevenue = new Money(metrics.totalRevenue);
      metrics.totalExpenses = new Money(metrics.totalExpenses);
      metrics.netIncome = new Money(metrics.netIncome);
      metrics.taxLiability = new Money(metrics.taxLiability);
      metrics.vatCollected = new Money(metrics.vatCollected);
      metrics.withholdingTaxPaid = new Money(metrics.withholdingTaxPaid);

      if (metrics.averageDailyRate) {
        metrics.averageDailyRate = new Money(metrics.averageDailyRate);
      }
      if (metrics.revenuePerAvailableRoom) {
        metrics.revenuePerAvailableRoom = new Money(metrics.revenuePerAvailableRoom);
      }
    }

    // Convert dates back to Date objects
    data.generatedAt = new Date(data.generatedAt);
    data.config.startDate = new Date(data.config.startDate);
    data.config.endDate = new Date(data.config.endDate);

    return data;
  }
}

// Base Strategy Class
abstract class BaseReportStrategy implements ReportStrategy {
  abstract generateReport(config: ReportConfig, services: FinancialServices): Promise<ReportData>;

  validateConfig(config: ReportConfig): void {
    // Base validation - can be overridden by specific strategies
    if (!config.projectId || !config.startDate || !config.endDate) {
      throw new Error("Invalid report configuration");
    }
  }

  getCacheKey(config: ReportConfig): string {
    const { projectId, reportType, startDate, endDate } = config;
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    return `report:${projectId}:${reportType}:${start}:${end}`;
  }

  getCacheTTL(config: ReportConfig): number {
    // Default cache TTL based on period
    switch (config.period) {
      case "daily":
        return 5 * 60; // 5 minutes
      case "weekly":
        return 30 * 60; // 30 minutes
      case "monthly":
        return 60 * 60; // 1 hour
      case "quarterly":
      case "yearly":
        return 24 * 60 * 60; // 1 day
      default:
        return 15 * 60; // 15 minutes
    }
  }

  protected createEmptyMetrics(): ReportMetrics {
    return {
      totalRevenue: new Money(0),
      totalExpenses: new Money(0),
      netIncome: new Money(0),
      grossMargin: 0,
      taxLiability: new Money(0),
      vatCollected: new Money(0),
      withholdingTaxPaid: new Money(0),
    };
  }
}

// Placeholder Strategy Implementations (will be implemented in separate files)
class ProfitLossStrategy extends BaseReportStrategy {
  async generateReport(config: ReportConfig, services: FinancialServices): Promise<ReportData> {
    // TODO: Implement P&L report generation
    throw new Error("ProfitLossStrategy not yet implemented");
  }
}

class CashFlowStrategy extends BaseReportStrategy {
  async generateReport(config: ReportConfig, services: FinancialServices): Promise<ReportData> {
    // TODO: Implement Cash Flow report generation
    throw new Error("CashFlowStrategy not yet implemented");
  }
}

class OccupancyStrategy extends BaseReportStrategy {
  async generateReport(config: ReportConfig, services: FinancialServices): Promise<ReportData> {
    // TODO: Implement Occupancy report generation
    throw new Error("OccupancyStrategy not yet implemented");
  }
}

class TaxSummaryStrategy extends BaseReportStrategy {
  async generateReport(config: ReportConfig, services: FinancialServices): Promise<ReportData> {
    // TODO: Implement Tax Summary report generation
    throw new Error("TaxSummaryStrategy not yet implemented");
  }
}

// Export singleton instance
export const reportEngine = new ReportEngineService();

export default ReportEngineService;
