/**
 * Basic Report Engine Tests
 *
 * Simple tests to verify the report engine initialization and basic functionality.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Money } from "@/lib/money";

// Mock all dependencies to isolate the service
vi.mock("@/lib/cache/redis", () => ({
  getRedisClient: () => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(0),
  }),
}));

vi.mock("@/features/financial/services", () => ({
  createFinancialServices: () => ({
    expense: {
      getExpenses: vi.fn().mockResolvedValue([]),
    },
    income: {
      getIncomes: vi.fn().mockResolvedValue([]),
    },
    payment: {
      getPayments: vi.fn().mockResolvedValue([]),
    },
    tax: {
      calculateIncomeTax: vi.fn(),
      calculateVAT: vi.fn(),
    },
  }),
}));

vi.mock("@/lib/strategies/profit-loss.strategy", () => ({
  ProfitLossStrategy: vi.fn().mockImplementation(() => ({
    generateReport: vi.fn().mockRejectedValue(new Error("Strategy not implemented")),
    validateConfig: vi.fn(),
    getCacheKey: vi.fn().mockReturnValue("test-cache-key"),
    getCacheTTL: vi.fn().mockReturnValue(300),
  })),
}));

vi.mock("@/lib/strategies/cash-flow.strategy", () => ({
  CashFlowStrategy: vi.fn().mockImplementation(() => ({
    generateReport: vi.fn().mockRejectedValue(new Error("Strategy not implemented")),
    validateConfig: vi.fn(),
    getCacheKey: vi.fn().mockReturnValue("test-cache-key"),
    getCacheTTL: vi.fn().mockReturnValue(300),
  })),
}));

// Import after mocking
const { ReportEngineService } = await import("../report-engine.service");

describe("ReportEngineService - Basic Functionality", () => {
  let reportEngine: ReportEngineService;

  beforeEach(() => {
    reportEngine = new ReportEngineService();
    vi.clearAllMocks();
  });

  describe("Service Initialization", () => {
    it("should initialize without errors", () => {
      expect(reportEngine).toBeDefined();
      expect(reportEngine).toBeInstanceOf(ReportEngineService);
    });

    it("should provide available report types", () => {
      const types = reportEngine.getAvailableReportTypes();
      expect(types).toContain("profit-loss");
      expect(types).toContain("cash-flow");
      expect(types).toContain("occupancy");
      expect(types).toContain("tax-summary");
    });

    it("should have correct number of report types", () => {
      const types = reportEngine.getAvailableReportTypes();
      expect(types).toHaveLength(4);
    });
  });

  describe("Configuration Validation", () => {
    const validConfig = {
      projectId: "test-project",
      reportType: "profit-loss" as const,
      period: "monthly" as const,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
      currency: "PHP",
    };

    it("should validate required fields", async () => {
      const invalidConfig = { ...validConfig, projectId: "" };

      await expect(reportEngine.generateReport(invalidConfig)).rejects.toThrow(
        "Project ID is required"
      );
    });

    it("should validate date range", async () => {
      const invalidConfig = {
        ...validConfig,
        startDate: new Date("2024-01-31"),
        endDate: new Date("2024-01-01"), // End before start
      };

      await expect(reportEngine.generateReport(invalidConfig)).rejects.toThrow(
        "Start date must be before end date"
      );
    });

    it("should validate maximum date range", async () => {
      const longRangeConfig = {
        ...validConfig,
        startDate: new Date("2020-01-01"),
        endDate: new Date("2024-01-01"), // More than 365 days
      };

      await expect(reportEngine.generateReport(longRangeConfig)).rejects.toThrow(
        "Date range cannot exceed 365 days"
      );
    });
  });

  describe("Async Job Management", () => {
    const validConfig = {
      projectId: "test-project",
      reportType: "profit-loss" as const,
      period: "monthly" as const,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
      currency: "PHP",
    };

    it("should create async job and return job ID", async () => {
      const jobId = await reportEngine.generateReportAsync(validConfig);

      expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });

    it("should track job status", async () => {
      const jobId = await reportEngine.generateReportAsync(validConfig);

      const job = await reportEngine.getJobStatus(jobId);
      expect(job).toBeTruthy();
      expect(job?.id).toBe(jobId);
      expect(job?.status).toMatch(/^(pending|processing|failed|completed)$/);
    });

    it("should return null for non-existent job", async () => {
      const job = await reportEngine.getJobStatus("non-existent-job-id");
      expect(job).toBeNull();
    });
  });

  describe("Cache Statistics", () => {
    it("should return cache statistics", async () => {
      const stats = await reportEngine.getCacheStats();

      expect(stats).toHaveProperty("totalKeys");
      expect(stats).toHaveProperty("hitRate");
      expect(stats).toHaveProperty("avgGenerationTime");
      expect(typeof stats.totalKeys).toBe("number");
      expect(typeof stats.hitRate).toBe("number");
      expect(typeof stats.avgGenerationTime).toBe("number");
    });
  });

  describe("Money Integration", () => {
    it("should handle Money instances correctly", () => {
      const amount = new Money(12345.67);
      expect(amount).toBeInstanceOf(Money);
      expect(amount.toNumber()).toBe(12345.67);
      expect(amount.format()).toMatch(/₱12,345\.67/);
    });

    it("should perform precise calculations", () => {
      const revenue = new Money(100000.99);
      const expenses = new Money(75000.44);
      const profit = revenue.subtract(expenses);

      expect(profit.toString()).toBe("25000.55");
      expect(profit.toNumber()).toBe(25000.55);
    });

    it("should handle serialization for caching", () => {
      const original = new Money(54321.98);
      const serialized = JSON.stringify({ amount: original.toNumber() });
      const parsed = JSON.parse(serialized);
      const restored = new Money(parsed.amount);

      expect(restored.toString()).toBe(original.toString());
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid report types", async () => {
      const invalidConfig = {
        projectId: "test-project",
        reportType: "invalid-type" as any,
        period: "monthly" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        currency: "PHP",
      };

      await expect(reportEngine.generateReport(invalidConfig)).rejects.toThrow(
        "Report strategy not found for type: invalid-type"
      );
    });

    it("should provide meaningful error messages", async () => {
      const emptyConfig = {
        projectId: "",
        reportType: "profit-loss" as const,
        period: "monthly" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        currency: "PHP",
      };

      await expect(reportEngine.generateReport(emptyConfig)).rejects.toThrow(
        "Project ID is required"
      );
    });
  });

  describe("Batch Operations", () => {
    const config1 = {
      projectId: "test-project",
      reportType: "profit-loss" as const,
      period: "monthly" as const,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-31"),
      currency: "PHP",
    };

    const config2 = {
      ...config1,
      reportType: "cash-flow" as const,
    };

    it("should handle empty batch", async () => {
      const results = await reportEngine.generateBatchReports([]);
      expect(results).toEqual([]);
    });

    it("should process batch with expected failures", async () => {
      // Since strategies are not fully implemented, we expect failures
      await expect(reportEngine.generateBatchReports([config1, config2])).rejects.toThrow();
    });
  });

  describe("Performance", () => {
    it("should complete validation quickly", async () => {
      const config = {
        projectId: "test-project",
        reportType: "profit-loss" as const,
        period: "monthly" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        currency: "PHP",
      };

      const startTime = Date.now();

      try {
        await reportEngine.generateReport(config);
      } catch (error) {
        // Expected to fail, but check timing
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(100); // Very fast for validation
      }
    });
  });
});
