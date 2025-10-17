// @ts-nocheck
/**
 * Performance Validation for Optimized Availability System - PHASE 4
 *
 * This utility validates that the availability optimizations are working
 * correctly and meeting performance targets in the serverless environment.
 * Note: Advanced features deferred to Phase 4
 */

import { supabase } from "@/lib/supabase";
import {
  checkUnitAvailability,
  checkMultiUnitAvailability,
  // getUnitAvailabilityCalendar, // ❌ DISABLED: Function not deployed yet (Phase 4)
  batchCheckUnitAvailability,
  // refreshAvailabilityCache, // ❌ DISABLED: Function not deployed yet (Phase 4)
  // getCachePerformanceMetrics, // ❌ DISABLED: Function not deployed yet (Phase 4)
} from "@/lib/availability";

// Performance targets
const PERFORMANCE_TARGETS = {
  SINGLE_UNIT_CHECK: 100, // ms
  MULTI_UNIT_CHECK: 200, // ms
  // CALENDAR_LOAD: 300, // ❌ Phase 4: Requires calendar function
  BATCH_CHECK: 250, // ms
  // CACHE_REFRESH: 1000, // ❌ Phase 4: Requires cache functions
} as const;

interface PerformanceResult {
  test: string;
  duration: number;
  target: number;
  passed: boolean;
  error?: string;
  details?: any;
}

interface ValidationReport {
  timestamp: string;
  environment: string;
  overallPassed: boolean;
  results: PerformanceResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageDuration: number;
  };
  recommendations: string[];
}

/**
 * Performance timer utility
 */
function createTimer() {
  const start = performance.now();
  return {
    stop: () => performance.now() - start,
  };
}

/**
 * Test single unit availability check performance
 */
async function testSingleUnitPerformance(): Promise<PerformanceResult> {
  const timer = createTimer();

  try {
    // Get first available unit for testing
    const { data: units } = await supabase.from("units").select("unit_id").limit(1);

    if (!units || units.length === 0) {
      throw new Error("No units available for testing");
    }

    const unitId = units[0].unit_id;
    const checkIn = new Date().toISOString().split("T")[0];
    const checkOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const result = await checkUnitAvailability(unitId, checkIn, checkOut);
    const duration = timer.stop();

    return {
      test: "Single Unit Availability Check",
      duration,
      target: PERFORMANCE_TARGETS.SINGLE_UNIT_CHECK,
      passed: duration <= PERFORMANCE_TARGETS.SINGLE_UNIT_CHECK,
      details: { unitId, checkIn, checkOut, result },
    };
  } catch (error) {
    const duration = timer.stop();
    return {
      test: "Single Unit Availability Check",
      duration,
      target: PERFORMANCE_TARGETS.SINGLE_UNIT_CHECK,
      passed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test multi-unit availability search performance
 */
async function testMultiUnitPerformance(): Promise<PerformanceResult> {
  const timer = createTimer();

  try {
    const checkIn = new Date().toISOString().split("T")[0];
    const checkOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const result = await checkMultiUnitAvailability(checkIn, checkOut, { limit: 10 });
    const duration = timer.stop();

    return {
      test: "Multi-Unit Availability Search",
      duration,
      target: PERFORMANCE_TARGETS.MULTI_UNIT_CHECK,
      passed: duration <= PERFORMANCE_TARGETS.MULTI_UNIT_CHECK,
      details: { checkIn, checkOut, unitsFound: result.length },
    };
  } catch (error) {
    const duration = timer.stop();
    return {
      test: "Multi-Unit Availability Search",
      duration,
      target: PERFORMANCE_TARGETS.MULTI_UNIT_CHECK,
      passed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test availability calendar performance
 * ❌ TEMPORARILY DISABLED: Requires get_unit_availability_calendar() database function
 * TODO Phase 4: Uncomment after deploying availability calendar migration
 */
/*
async function testCalendarPerformance(): Promise<PerformanceResult> {
  const timer = createTimer();

  try {
    // Get first available unit for testing
    const { data: units } = await supabase.from("units").select("unit_id").limit(1);

    if (!units || units.length === 0) {
      throw new Error("No units available for testing");
    }

    const unitId = units[0].unit_id;
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // 30 days

    const result = await getUnitAvailabilityCalendar(unitId, startDate, endDate);
    const duration = timer.stop();

    return {
      test: "Availability Calendar Load",
      duration,
      target: PERFORMANCE_TARGETS.CALENDAR_LOAD,
      passed: duration <= PERFORMANCE_TARGETS.CALENDAR_LOAD,
      details: { unitId, startDate, endDate, daysLoaded: result.length },
    };
  } catch (error) {
    const duration = timer.stop();
    return {
      test: "Availability Calendar Load",
      duration,
      target: PERFORMANCE_TARGETS.CALENDAR_LOAD,
      passed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
*/

/**
 * Test batch availability check performance
 */
async function testBatchPerformance(): Promise<PerformanceResult> {
  const timer = createTimer();

  try {
    // Get multiple units for testing
    const { data: units } = await supabase.from("units").select("unit_id").limit(5);

    if (!units || units.length === 0) {
      throw new Error("No units available for testing");
    }

    const unitIds = units.map((u) => u.unit_id);
    const checkIn = new Date().toISOString().split("T")[0];
    const checkOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const result = await batchCheckUnitAvailability(unitIds, checkIn, checkOut);
    const duration = timer.stop();

    return {
      test: "Batch Availability Check",
      duration,
      target: PERFORMANCE_TARGETS.BATCH_CHECK,
      passed: duration <= PERFORMANCE_TARGETS.BATCH_CHECK,
      details: {
        unitCount: unitIds.length,
        checkIn,
        checkOut,
        resultsCount: Object.keys(result).length,
      },
    };
  } catch (error) {
    const duration = timer.stop();
    return {
      test: "Batch Availability Check",
      duration,
      target: PERFORMANCE_TARGETS.BATCH_CHECK,
      passed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test cache refresh performance
 * ❌ TEMPORARILY DISABLED: Requires refresh_availability_cache() database function
 * TODO Phase 4: Uncomment after deploying availability cache migration
 */
/*
async function testCachePerformance(): Promise<PerformanceResult> {
  const timer = createTimer();

  try {
    // Refresh cache for a single unit
    const { data: units } = await supabase.from("units").select("unit_id").limit(1);

    if (!units || units.length === 0) {
      throw new Error("No units available for testing");
    }

    const unitId = units[0].unit_id;
    const cacheCount = await refreshAvailabilityCache(unitId, 30); // 30 days
    const duration = timer.stop();

    return {
      test: "Cache Refresh",
      duration,
      target: PERFORMANCE_TARGETS.CACHE_REFRESH,
      passed: duration <= PERFORMANCE_TARGETS.CACHE_REFRESH,
      details: { unitId, daysAhead: 30, cacheCount },
    };
  } catch (error) {
    const duration = timer.stop();
    return {
      test: "Cache Refresh",
      duration,
      target: PERFORMANCE_TARGETS.CACHE_REFRESH,
      passed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
*/

/**
 * Test database connection and query performance
 */
async function testDatabasePerformance(): Promise<PerformanceResult> {
  const timer = createTimer();

  try {
    // Test basic database connectivity and performance
    const { data, error } = await supabase.from("units").select("count(*)").single();

    if (error) throw error;

    const duration = timer.stop();

    return {
      test: "Database Connection",
      duration,
      target: 50, // ms for simple count query
      passed: duration <= 50,
      details: { unitCount: data.count },
    };
  } catch (error) {
    const duration = timer.stop();
    return {
      test: "Database Connection",
      duration,
      target: 50,
      passed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get cache performance metrics
 * ❌ TEMPORARILY DISABLED: Requires getCachePerformanceMetrics() function and availability_cache table
 * TODO Phase 4: Uncomment after deploying availability cache migration
 */
/*
async function getCacheMetrics(): Promise<any> {
  try {
    return await getCachePerformanceMetrics();
  } catch (error) {
    console.warn("Could not fetch cache metrics:", error);
    return null;
  }
}
*/

/**
 * Generate performance recommendations based on test results
 */
function generateRecommendations(results: PerformanceResult[]): string[] {
  const recommendations: string[] = [];

  // Check for failed tests
  const failedTests = results.filter((r) => !r.passed);

  if (failedTests.length === 0) {
    recommendations.push("✅ All performance tests passed! System is optimized.");
    return recommendations;
  }

  // Specific recommendations based on failed tests
  failedTests.forEach((test) => {
    switch (test.test) {
      case "Database Connection":
        recommendations.push(
          "❌ Database connection is slow. Check network latency and connection pooling."
        );
        break;

      case "Single Unit Availability Check":
        recommendations.push(
          "❌ Single unit checks are slow. Verify indexes are created and statistics are updated."
        );
        break;

      case "Multi-Unit Availability Search":
        recommendations.push(
          "❌ Multi-unit searches are slow. Consider reducing result limit or optimizing filters."
        );
        break;

      case "Availability Calendar Load":
        recommendations.push(
          "❌ Calendar loading is slow. Consider reducing date range or implementing pagination."
        );
        break;

      case "Batch Availability Check":
        recommendations.push(
          "❌ Batch checks are slow. Reduce batch size or implement parallel processing."
        );
        break;

      case "Cache Refresh":
        recommendations.push(
          "❌ Cache refresh is slow. Consider reducing cache scope or running during off-peak hours."
        );
        break;
    }
  });

  // General recommendations
  if (failedTests.length > 2) {
    recommendations.push("⚠️ Multiple tests failed. Consider running ANALYZE on database tables.");
    recommendations.push("⚠️ Check Neon PostgreSQL connection settings and pooling configuration.");
  }

  return recommendations;
}

/**
 * Run comprehensive performance validation
 */
export async function validatePerformance(): Promise<ValidationReport> {
  console.log("🚀 Starting availability system performance validation...");

  const results: PerformanceResult[] = [];

  // Run all performance tests
  const tests = [
    testDatabasePerformance,
    testSingleUnitPerformance,
    testMultiUnitPerformance,
    // testCalendarPerformance, // ❌ Phase 4: Requires calendar function
    testBatchPerformance,
    // testCachePerformance, // ❌ Phase 4: Requires cache functions
  ];

  for (const test of tests) {
    try {
      console.log(`Running ${test.name}...`);
      const result = await test();
      results.push(result);

      const status = result.passed ? "✅" : "❌";
      console.log(
        `${status} ${result.test}: ${result.duration.toFixed(1)}ms (target: ${result.target}ms)`
      );
    } catch (error) {
      console.error(`Error running ${test.name}:`, error);
      results.push({
        test: test.name,
        duration: 0,
        target: 0,
        passed: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Calculate summary statistics
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = results.length - passedTests;
  const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  // Get cache metrics
  // ❌ Phase 4: Requires cache functions
  // const cacheMetrics = await getCacheMetrics();

  // Generate recommendations
  const recommendations = generateRecommendations(results);

  // Create validation report
  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    overallPassed: failedTests === 0,
    results,
    summary: {
      totalTests: results.length,
      passedTests,
      failedTests,
      averageDuration,
    },
    recommendations,
  };

  // Log summary
  console.log("\n📊 Performance Validation Summary:");
  console.log(`Total Tests: ${report.summary.totalTests}`);
  console.log(`Passed: ${report.summary.passedTests}`);
  console.log(`Failed: ${report.summary.failedTests}`);
  console.log(`Average Duration: ${report.summary.averageDuration.toFixed(1)}ms`);

  // ❌ Phase 4: Cache metrics disabled
  // if (cacheMetrics) {
  //   console.log(`Cache Hit Ratio: ${cacheMetrics.cacheHitRatio}%`);
  // }

  console.log("\n💡 Recommendations:");
  recommendations.forEach((rec) => console.log(`  ${rec}`));

  return report;
}

/**
 * Run continuous performance monitoring
 */
export async function startPerformanceMonitoring(intervalMinutes: number = 5): Promise<() => void> {
  console.log(
    `🔄 Starting continuous performance monitoring (every ${intervalMinutes} minutes)...`
  );

  const interval = setInterval(
    async () => {
      try {
        const report = await validatePerformance();

        // Log only if there are performance issues
        if (!report.overallPassed) {
          console.warn("⚠️ Performance issues detected:");
          report.results
            .filter((r) => !r.passed)
            .forEach((r) =>
              console.warn(`  - ${r.test}: ${r.duration.toFixed(1)}ms (${r.error || "too slow"})`)
            );
        }
      } catch (error) {
        console.error("Error in performance monitoring:", error);
      }
    },
    intervalMinutes * 60 * 1000
  );

  // Return cleanup function
  return () => {
    clearInterval(interval);
    console.log("🛑 Performance monitoring stopped.");
  };
}

/**
 * Export for use in development and testing
 */
export const performanceUtils = {
  validatePerformance,
  startPerformanceMonitoring,
  PERFORMANCE_TARGETS,
};
