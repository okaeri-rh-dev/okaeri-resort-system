/**
 * Database Optimization Performance Tests
 *
 * Validates Phase 4.4 Week 3.1 database optimization improvements:
 * - Target: 50-57% performance improvements across key operations
 * - Report generation: 4.2s → 1.8s (57% improvement)
 * - Dashboard load: 800ms → 350ms (56% improvement)
 * - Tax calculations: 300ms → 150ms (50% improvement)
 * - Real-time queries: 200ms → 100ms (50% improvement)
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { queryOptimizationService } from "../../src/lib/services/query-optimization.service";
import { databasePerformanceService } from "../../src/lib/monitoring/database-performance.service";
import { db } from "../../src/lib/db/connection";
import { sql } from "drizzle-orm";

// =============================================
// Test Configuration and Helpers
// =============================================

interface PerformanceResult {
  operation: string;
  baseline: number;
  optimized: number;
  improvement: number;
  improvementPercentage: number;
  target: number;
  achieved: boolean;
}

const PERFORMANCE_TARGETS = {
  reportGeneration: { baseline: 4200, target: 1800, improvementTarget: 57 },
  dashboardLoad: { baseline: 800, target: 350, improvementTarget: 56 },
  taxCalculations: { baseline: 300, target: 150, improvementTarget: 50 },
  realTimeQueries: { baseline: 200, target: 100, improvementTarget: 50 },
};

// Test data setup helpers
async function setupTestData(): Promise<string> {
  const testProjectId = "test-project-" + Date.now();

  // Create test project
  await db.execute(sql`
    INSERT INTO projects (id, project_name, created_at) 
    VALUES (${testProjectId}, 'Performance Test Project', NOW())
  `);

  // Insert test expenses (simulate 6 months of data)
  const expenseInserts = [];
  for (let month = 0; month < 6; month++) {
    for (let day = 1; day <= 30; day++) {
      const expenseDate = new Date(2024, month, day).toISOString().split("T")[0];
      expenseInserts.push(`
        ('${testProjectId}', 'EXP-${month}-${day}', '${expenseDate}', 
         ${Math.random() * 10000 + 1000}, ${Math.random() * 1200}, 
         ${Math.random() * 500}, 'office_supplies', 'Office Supplies', 
         'VEND-001', 'Test Vendor', '123-456-789-000', true, 0.12, 
         false, null, 'paid', 'cash', 'approved', 'auto', 
         'Test expense ${month}-${day}', NOW(), NOW())
      `);
    }
  }

  await db.execute(sql`
    INSERT INTO expenses (
      project_id, expense_code, expense_date, gross_amount, vat_amount, 
      ewt_amount, category, subcategory, vendor_id, vendor_name, vendor_tin,
      is_vatable, vat_rate, is_ewt_applicable, ewt_rate, payment_status, 
      payment_method, approval_status, approval_level, description, 
      created_at, updated_at
    ) VALUES ${sql.raw(expenseInserts.join(", "))}
  `);

  // Insert test income transactions
  const incomeInserts = [];
  for (let month = 0; month < 6; month++) {
    for (let day = 1; day <= 30; day++) {
      const transactionDate = new Date(2024, month, day).toISOString();
      incomeInserts.push(`
        ('${testProjectId}', 'INC-${month}-${day}', '${transactionDate}', 
         'booking', ${Math.random() * 15000 + 2000}, 0, 
         ${Math.random() * 1800}, 0, ${Math.random() * 15000 + 2000}, 
         'room', 'deluxe', 'cash', 'completed', 'REF-${month}-${day}', 
         'Test income ${month}-${day}', NOW(), NOW())
      `);
    }
  }

  await db.execute(sql`
    INSERT INTO income_transactions (
      project_id, transaction_code, transaction_date, transaction_type,
      gross_amount, discount_amount, tax_amount, service_charge_amount, net_amount,
      income_category, income_subcategory, payment_method, payment_status, 
      payment_reference, description, created_at, updated_at
    ) VALUES ${sql.raw(incomeInserts.join(", "))}
  `);

  // Insert test payment transactions
  const paymentInserts = [];
  for (let month = 0; month < 6; month++) {
    for (let day = 1; day <= 20; day++) {
      const createdAt = new Date(2024, month, day).toISOString();
      paymentInserts.push(`
        ('${testProjectId}', 'TXN-${month}-${day}', 'REF-${month}-${day}', 
         'payment', 'cash', ${Math.random() * 8000 + 1000}, 'PHP', 1.0, 
         ${Math.random() * 8000 + 1000}, 0, 0, ${Math.random() * 8000 + 1000},
         'completed', 'Test Payer ${day}', '${createdAt}', '${createdAt}')
      `);
    }
  }

  await db.execute(sql`
    INSERT INTO payment_transactions (
      project_id, transaction_id, reference_number, payment_type, payment_method,
      amount, currency, exchange_rate, amount_in_php, processing_fee, gateway_fee,
      net_amount, status, payer_name, created_at, updated_at
    ) VALUES ${sql.raw(paymentInserts.join(", "))}
  `);

  return testProjectId;
}

async function cleanupTestData(testProjectId: string): Promise<void> {
  await db.execute(sql`DELETE FROM expenses WHERE project_id = ${testProjectId}`);
  await db.execute(sql`DELETE FROM income_transactions WHERE project_id = ${testProjectId}`);
  await db.execute(sql`DELETE FROM payment_transactions WHERE project_id = ${testProjectId}`);
  await db.execute(sql`DELETE FROM projects WHERE id = ${testProjectId}`);
}

function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    try {
      const result = await fn();
      const endTime = performance.now();
      resolve({ result, duration: endTime - startTime });
    } catch (error) {
      reject(error);
    }
  });
}

// =============================================
// Performance Test Suite
// =============================================

describe("Database Optimization Performance Tests", () => {
  let testProjectId: string;
  const performanceResults: PerformanceResult[] = [];

  beforeAll(async () => {
    console.log("Setting up test data for performance testing...");
    testProjectId = await setupTestData();

    // Refresh materialized views to ensure they contain test data
    console.log("Refreshing materialized views...");
    await queryOptimizationService.refreshMaterializedViews();

    // Allow some time for the refresh to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    console.log("Cleaning up test data...");
    await cleanupTestData(testProjectId);

    // Display performance results summary
    console.log("\n=== PERFORMANCE TEST RESULTS SUMMARY ===");
    performanceResults.forEach((result) => {
      const status = result.achieved ? "✅ PASSED" : "❌ FAILED";
      console.log(
        `${status} ${result.operation}: ${result.baseline}ms → ${result.optimized}ms ` +
          `(${result.improvementPercentage.toFixed(1)}% improvement, target: ${result.target}ms)`
      );
    });

    const passedTests = performanceResults.filter((r) => r.achieved).length;
    const totalTests = performanceResults.length;
    console.log(`\nOverall: ${passedTests}/${totalTests} performance targets achieved`);
  });

  describe("Report Generation Performance", () => {
    test("Financial Summary Report (Target: 57% improvement)", async () => {
      const dateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-06-30"),
      };

      // Baseline: Direct table queries (simulating old approach)
      const baselineQuery = async () => {
        await db.execute(sql`
          SELECT 
            project_id,
            DATE_TRUNC('month', expense_date) as period_month,
            COUNT(*) as expense_count,
            SUM(gross_amount) as total_gross,
            SUM(vat_amount) as total_vat,
            SUM(ewt_amount) as total_ewt,
            AVG(gross_amount) as avg_amount
          FROM expenses
          WHERE project_id = ${testProjectId}
          AND expense_date >= ${dateRange.from.toISOString().split("T")[0]}
          AND expense_date <= ${dateRange.to.toISOString().split("T")[0]}
          AND deleted_at IS NULL
          GROUP BY project_id, DATE_TRUNC('month', expense_date)
          ORDER BY period_month DESC
        `);
      };

      // Optimized: Materialized view queries
      const optimizedQuery = async () => {
        await queryOptimizationService.getFinancialSummary(testProjectId, dateRange);
      };

      const baseline = await measureExecutionTime(baselineQuery);
      const optimized = await measureExecutionTime(optimizedQuery);

      const improvement = baseline.duration - optimized.duration;
      const improvementPercentage = (improvement / baseline.duration) * 100;
      const achieved =
        improvementPercentage >= PERFORMANCE_TARGETS.reportGeneration.improvementTarget;

      const result: PerformanceResult = {
        operation: "Financial Summary Report",
        baseline: baseline.duration,
        optimized: optimized.duration,
        improvement,
        improvementPercentage,
        target: PERFORMANCE_TARGETS.reportGeneration.target,
        achieved,
      };

      performanceResults.push(result);

      expect(improvementPercentage).toBeGreaterThanOrEqual(
        PERFORMANCE_TARGETS.reportGeneration.improvementTarget
      );
      expect(optimized.duration).toBeLessThanOrEqual(PERFORMANCE_TARGETS.reportGeneration.target);
    });

    test("Tax Summary Report (Target: 50% improvement)", async () => {
      const dateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-06-30"),
      };

      // Baseline: Complex tax calculations across multiple tables
      const baselineQuery = async () => {
        await db.execute(sql`
          SELECT 
            project_id,
            DATE_TRUNC('month', expense_date) as period_month,
            SUM(vat_amount) as expense_vat_total,
            SUM(ewt_amount) as total_ewt_withheld,
            COUNT(*) FILTER (WHERE is_vatable = true) as vatable_count,
            COUNT(*) FILTER (WHERE is_ewt_applicable = true) as ewt_count
          FROM expenses e
          WHERE project_id = ${testProjectId}
          AND expense_date >= ${dateRange.from.toISOString().split("T")[0]}
          AND expense_date <= ${dateRange.to.toISOString().split("T")[0]}
          AND deleted_at IS NULL
          GROUP BY project_id, DATE_TRUNC('month', expense_date)
          
          UNION ALL
          
          SELECT 
            project_id,
            DATE_TRUNC('month', transaction_date::date) as period_month,
            SUM(tax_amount) as income_tax_total,
            0 as total_ewt_withheld,
            COUNT(*) FILTER (WHERE tax_amount > 0) as taxable_count,
            0 as ewt_count
          FROM income_transactions i
          WHERE project_id = ${testProjectId}
          AND transaction_date >= ${dateRange.from.toISOString()}
          AND transaction_date <= ${dateRange.to.toISOString()}
          GROUP BY project_id, DATE_TRUNC('month', transaction_date::date)
        `);
      };

      // Optimized: Materialized view tax summary
      const optimizedQuery = async () => {
        await queryOptimizationService.getTaxSummary(testProjectId, dateRange);
      };

      const baseline = await measureExecutionTime(baselineQuery);
      const optimized = await measureExecutionTime(optimizedQuery);

      const improvement = baseline.duration - optimized.duration;
      const improvementPercentage = (improvement / baseline.duration) * 100;
      const achieved =
        improvementPercentage >= PERFORMANCE_TARGETS.taxCalculations.improvementTarget;

      const result: PerformanceResult = {
        operation: "Tax Summary Report",
        baseline: baseline.duration,
        optimized: optimized.duration,
        improvement,
        improvementPercentage,
        target: PERFORMANCE_TARGETS.taxCalculations.target,
        achieved,
      };

      performanceResults.push(result);

      expect(improvementPercentage).toBeGreaterThanOrEqual(
        PERFORMANCE_TARGETS.taxCalculations.improvementTarget
      );
    });
  });

  describe("Dashboard Load Performance", () => {
    test("Income Summary Dashboard (Target: 56% improvement)", async () => {
      const dateRange = {
        from: new Date("2024-04-01"), // Last 3 months
        to: new Date("2024-06-30"),
      };

      // Baseline: Multiple separate queries for dashboard widgets
      const baselineQuery = async () => {
        // Simulate multiple dashboard queries
        const promises = [
          // Total revenue query
          db.execute(sql`
            SELECT SUM(net_amount) as total_revenue
            FROM income_transactions
            WHERE project_id = ${testProjectId}
            AND transaction_date >= ${dateRange.from.toISOString()}
            AND transaction_date <= ${dateRange.to.toISOString()}
          `),

          // Payment method breakdown
          db.execute(sql`
            SELECT payment_method, COUNT(*), SUM(net_amount)
            FROM income_transactions
            WHERE project_id = ${testProjectId}
            AND transaction_date >= ${dateRange.from.toISOString()}
            AND transaction_date <= ${dateRange.to.toISOString()}
            GROUP BY payment_method
          `),

          // Category breakdown
          db.execute(sql`
            SELECT income_category, COUNT(*), SUM(net_amount)
            FROM income_transactions
            WHERE project_id = ${testProjectId}
            AND transaction_date >= ${dateRange.from.toISOString()}
            AND transaction_date <= ${dateRange.to.toISOString()}
            GROUP BY income_category
          `),

          // Monthly trends
          db.execute(sql`
            SELECT DATE_TRUNC('month', transaction_date) as month, SUM(net_amount)
            FROM income_transactions
            WHERE project_id = ${testProjectId}
            AND transaction_date >= ${dateRange.from.toISOString()}
            AND transaction_date <= ${dateRange.to.toISOString()}
            GROUP BY DATE_TRUNC('month', transaction_date)
            ORDER BY month
          `),
        ];

        await Promise.all(promises);
      };

      // Optimized: Single materialized view query
      const optimizedQuery = async () => {
        await queryOptimizationService.getIncomeSummary(testProjectId, dateRange);
      };

      const baseline = await measureExecutionTime(baselineQuery);
      const optimized = await measureExecutionTime(optimizedQuery);

      const improvement = baseline.duration - optimized.duration;
      const improvementPercentage = (improvement / baseline.duration) * 100;
      const achieved = improvementPercentage >= PERFORMANCE_TARGETS.dashboardLoad.improvementTarget;

      const result: PerformanceResult = {
        operation: "Income Summary Dashboard",
        baseline: baseline.duration,
        optimized: optimized.duration,
        improvement,
        improvementPercentage,
        target: PERFORMANCE_TARGETS.dashboardLoad.target,
        achieved,
      };

      performanceResults.push(result);

      expect(improvementPercentage).toBeGreaterThanOrEqual(
        PERFORMANCE_TARGETS.dashboardLoad.improvementTarget
      );
      expect(optimized.duration).toBeLessThanOrEqual(PERFORMANCE_TARGETS.dashboardLoad.target);
    });
  });

  describe("Real-time Query Performance", () => {
    test("Vendor Summary Query (Target: 50% improvement)", async () => {
      // Baseline: Complex joins and aggregations
      const baselineQuery = async () => {
        await db.execute(sql`
          SELECT 
            v.id,
            v.vendor_name,
            v.tin,
            COALESCE(SUM(e.net_amount), 0) as total_expenses,
            COALESCE(SUM(e.vat_amount), 0) as total_vat,
            COALESCE(SUM(e.ewt_amount), 0) as total_ewt,
            COUNT(e.id) as expense_count,
            MAX(e.expense_date) as last_expense_date
          FROM vendors v
          LEFT JOIN expenses e ON v.id = e.vendor_id AND e.deleted_at IS NULL
          WHERE v.project_id = ${testProjectId}
          GROUP BY v.id, v.vendor_name, v.tin
          ORDER BY total_expenses DESC
        `);
      };

      // Optimized: Materialized view query
      const optimizedQuery = async () => {
        await queryOptimizationService.getVendorSummary(testProjectId, {
          limit: 50,
        });
      };

      const baseline = await measureExecutionTime(baselineQuery);
      const optimized = await measureExecutionTime(optimizedQuery);

      const improvement = baseline.duration - optimized.duration;
      const improvementPercentage = (improvement / baseline.duration) * 100;
      const achieved =
        improvementPercentage >= PERFORMANCE_TARGETS.realTimeQueries.improvementTarget;

      const result: PerformanceResult = {
        operation: "Vendor Summary Query",
        baseline: baseline.duration,
        optimized: optimized.duration,
        improvement,
        improvementPercentage,
        target: PERFORMANCE_TARGETS.realTimeQueries.target,
        achieved,
      };

      performanceResults.push(result);

      expect(improvementPercentage).toBeGreaterThanOrEqual(
        PERFORMANCE_TARGETS.realTimeQueries.improvementTarget
      );
    });

    test("Payment Processing Query (Target: 50% improvement)", async () => {
      // Baseline: Complex payment status queries with joins
      const baselineQuery = async () => {
        await db.execute(sql`
          SELECT 
            pt.status,
            COUNT(*) as transaction_count,
            SUM(pt.amount) as total_amount,
            AVG(pt.amount) as avg_amount,
            pt.payment_method,
            COUNT(*) FILTER (WHERE pt.processed_at IS NOT NULL) as processed_count
          FROM payment_transactions pt
          WHERE pt.project_id = ${testProjectId}
          AND pt.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY pt.status, pt.payment_method
          ORDER BY total_amount DESC
        `);
      };

      // Optimized: Using strategic indexes and simplified queries
      const optimizedQuery = async () => {
        await db.execute(sql`
          SELECT 
            status,
            payment_method,
            COUNT(*),
            SUM(amount),
            AVG(amount)
          FROM payment_transactions
          WHERE project_id = ${testProjectId}
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY status, payment_method
        `);
      };

      const baseline = await measureExecutionTime(baselineQuery);
      const optimized = await measureExecutionTime(optimizedQuery);

      const improvement = baseline.duration - optimized.duration;
      const improvementPercentage = (improvement / baseline.duration) * 100;
      const achieved =
        improvementPercentage >= PERFORMANCE_TARGETS.realTimeQueries.improvementTarget;

      const result: PerformanceResult = {
        operation: "Payment Processing Query",
        baseline: baseline.duration,
        optimized: optimized.duration,
        improvement,
        improvementPercentage,
        target: PERFORMANCE_TARGETS.realTimeQueries.target,
        achieved,
      };

      performanceResults.push(result);

      expect(improvementPercentage).toBeGreaterThanOrEqual(
        PERFORMANCE_TARGETS.realTimeQueries.improvementTarget
      );
    });
  });

  describe("Index Usage and Effectiveness", () => {
    test("Covering Index Performance", async () => {
      // Test covering index effectiveness for expense reports
      const { result: indexStats } = await measureExecutionTime(async () => {
        return databasePerformanceService.getIndexUsageStats(1);
      });

      // Find our covering indexes
      const coveringIndexes = indexStats.filter(
        (idx) => idx.indexName.includes("covering") && idx.usage !== "unused"
      );

      expect(coveringIndexes.length).toBeGreaterThan(0);

      // At least 80% of covering indexes should have medium to high usage
      const effectiveIndexes = coveringIndexes.filter(
        (idx) => idx.usage === "medium" || idx.usage === "high"
      );

      const effectiveness = (effectiveIndexes.length / coveringIndexes.length) * 100;
      expect(effectiveness).toBeGreaterThanOrEqual(80);
    });

    test("Partial Index Selectivity", async () => {
      // Test partial index effectiveness for filtered queries
      const unpaidExpensesQuery = async () => {
        await db.execute(sql`
          SELECT * FROM expenses
          WHERE project_id = ${testProjectId}
          AND payment_status = 'unpaid'
          AND deleted_at IS NULL
          ORDER BY due_date
        `);
      };

      const { duration } = await measureExecutionTime(unpaidExpensesQuery);

      // Partial index should make this query very fast
      expect(duration).toBeLessThan(100); // Should be under 100ms
    });
  });

  describe("Materialized View Performance", () => {
    test("Materialized View Refresh Performance", async () => {
      const refreshPerformance = await measureExecutionTime(async () => {
        await queryOptimizationService.refreshMaterializedView("financial_summary_mv");
      });

      // Refresh should complete within reasonable time (< 5 seconds for test data)
      expect(refreshPerformance.duration).toBeLessThan(5000);
    });

    test("Materialized View Query Performance vs Base Tables", async () => {
      const dateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-03-31"),
      };

      // Query base tables directly
      const baseTableQuery = async () => {
        await db.execute(sql`
          SELECT 
            project_id,
            DATE_TRUNC('month', expense_date) as period_month,
            SUM(net_amount) as total_amount,
            COUNT(*) as count
          FROM expenses
          WHERE project_id = ${testProjectId}
          AND expense_date >= ${dateRange.from.toISOString().split("T")[0]}
          AND expense_date <= ${dateRange.to.toISOString().split("T")[0]}
          AND deleted_at IS NULL
          GROUP BY project_id, DATE_TRUNC('month', expense_date)
        `);
      };

      // Query materialized view
      const materializedViewQuery = async () => {
        await queryOptimizationService.getFinancialSummary(testProjectId, dateRange);
      };

      const basePerformance = await measureExecutionTime(baseTableQuery);
      const mvPerformance = await measureExecutionTime(materializedViewQuery);

      const improvement =
        ((basePerformance.duration - mvPerformance.duration) / basePerformance.duration) * 100;

      // Materialized view should be significantly faster
      expect(improvement).toBeGreaterThan(30); // At least 30% improvement
    });
  });
});

// =============================================
// Performance Monitoring Integration Tests
// =============================================

describe("Performance Monitoring Integration", () => {
  test("Database Metrics Collection", async () => {
    const { result: metrics } = await measureExecutionTime(async () => {
      return databasePerformanceService.getDatabaseMetrics();
    });

    expect(metrics.connectionCount).toBeGreaterThanOrEqual(0);
    expect(metrics.activeQueries).toBeGreaterThanOrEqual(0);
    expect(metrics.cacheHitRatio).toBeGreaterThan(0);
    expect(metrics.lastUpdated).toBeInstanceOf(Date);

    // Metrics collection should be fast
    const metricsPerformance = await measureExecutionTime(async () => {
      await databasePerformanceService.getDatabaseMetrics();
    });

    expect(metricsPerformance.duration).toBeLessThan(1000); // Under 1 second
  });

  test("Query Performance Analysis", async () => {
    const testQuery = `
      SELECT COUNT(*) FROM expenses 
      WHERE project_id = $1 AND payment_status = 'paid'
    `;

    const analysis = await queryOptimizationService.analyzeQueryPerformance(testQuery, [
      "test-project-123",
    ]);

    expect(analysis.queryId).toBeDefined();
    expect(analysis.executionTime).toBeGreaterThan(0);
    expect(analysis.recommendation).toBeDefined();
    expect(["high", "medium", "low"]).toContain(analysis.optimizationPotential);
  });

  test("Optimization Recommendations", async () => {
    const recommendations = await databasePerformanceService.getOptimizationRecommendations();

    expect(Array.isArray(recommendations)).toBe(true);

    recommendations.forEach((rec) => {
      expect(rec.category).toBeDefined();
      expect(["high", "medium", "low"]).toContain(rec.priority);
      expect(rec.recommendation).toBeDefined();
      expect(rec.impact).toBeDefined();
      expect(rec.action).toBeDefined();
    });
  });
});

// =============================================
// Neon PostgreSQL Specific Tests
// =============================================

describe("Neon PostgreSQL Optimizations", () => {
  test("Connection Pooling Efficiency", async () => {
    // Test multiple concurrent queries to verify connection handling
    const concurrentQueries = Array.from({ length: 10 }, (_, i) =>
      measureExecutionTime(async () => {
        await db.execute(sql`SELECT 1 as test_query_${i}`);
      })
    );

    const results = await Promise.all(concurrentQueries);

    // All queries should complete successfully
    expect(results.length).toBe(10);

    // Average query time should be reasonable for simple queries
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    expect(avgDuration).toBeLessThan(100); // Under 100ms average
  });

  test("Serverless Connection Optimization", async () => {
    // Test connection settings optimization
    const optimizationResult = await measureExecutionTime(async () => {
      await queryOptimizationService.optimizeConnectionSettings();
    });

    // Optimization should complete quickly
    expect(optimizationResult.duration).toBeLessThan(1000);
  });

  test("Memory-Efficient Query Patterns", async () => {
    // Test that large result sets are handled efficiently
    const largeQueryPerformance = await measureExecutionTime(async () => {
      await db.execute(sql`
        SELECT * FROM expenses 
        LIMIT 1000
      `);
    });

    // Large queries should still be reasonable
    expect(largeQueryPerformance.duration).toBeLessThan(2000); // Under 2 seconds
  });
});

// =============================================
// Overall Performance Validation
// =============================================

describe("Overall Performance Targets Validation", () => {
  test("All Performance Targets Met", async () => {
    // This test runs after all other tests and validates overall success
    const passedTargets = performanceResults.filter((r) => r.achieved).length;
    const totalTargets = performanceResults.length;
    const successRate = (passedTargets / totalTargets) * 100;

    console.log(`\n=== FINAL PERFORMANCE VALIDATION ===`);
    console.log(`Targets achieved: ${passedTargets}/${totalTargets} (${successRate.toFixed(1)}%)`);

    // At least 80% of performance targets should be met
    expect(successRate).toBeGreaterThanOrEqual(80);

    // Critical targets (report generation and dashboard) must be met
    const criticalTargets = performanceResults.filter(
      (r) => r.operation.includes("Report") || r.operation.includes("Dashboard")
    );
    const criticalAchieved = criticalTargets.filter((r) => r.achieved).length;

    expect(criticalAchieved).toBe(criticalTargets.length);
  });
});
