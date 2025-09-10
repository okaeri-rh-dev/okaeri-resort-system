/**
 * Enhanced Health Check API Endpoint
 * Phase 5.4: Monitoring Setup - Comprehensive system health monitoring
 *
 * GET /api/monitoring/health-detailed
 */

import type { VercelRequest as _VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandler, withMethod, compose, type ExtendedRequest } from "../_lib/middleware";
import { successResponse, errorResponse } from "../_lib/types";
import { getPool } from "../_lib/database";
import { env } from "../../src/lib/env";
import { ErrorHandler } from "../../src/lib/error-handler";

interface HealthCheck {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  details: Record<string, any>;
  timestamp: number;
}

interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  uptime: number;
  version: string;
  environment: string;
  region: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    usagePercent: number;
  };
  performance: {
    cpuUsage: {
      user: number;
      system: number;
    };
    eventLoopDelay?: number;
  };
  timestamp: string;
  requestId: string;
}

async function handler(req: ExtendedRequest, res: VercelResponse) {
  const requestLogger = req.requestLogger!;
  const startTime = performance.now();

  requestLogger.debug("Starting detailed health check");

  const checks: HealthCheck[] = [];
  const health: Partial<SystemHealth> = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: process.env.VITE_APP_VERSION || "1.0.0",
    region: process.env.VERCEL_REGION || "unknown",
    requestId: req.requestId,
  };

  // System memory check
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    health.memory = {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      usagePercent: Math.round(usagePercent * 10) / 10,
    };

    const memoryStatus =
      usagePercent > 85 ? "unhealthy" : usagePercent > 70 ? "degraded" : "healthy";

    checks.push({
      service: "memory",
      status: memoryStatus,
      responseTime: 0,
      details: health.memory,
      timestamp: Date.now(),
    });

    requestLogger.debug("Memory check completed", { usagePercent, status: memoryStatus });
  } catch (error) {
    const appError = ErrorHandler.handle(error, { check: "memory" });
    requestLogger.error("Memory check failed", appError);

    checks.push({
      service: "memory",
      status: "unhealthy",
      responseTime: 0,
      details: { error: appError.message },
      timestamp: Date.now(),
    });
  }

  // CPU usage check
  try {
    const cpuUsage = process.cpuUsage();

    health.performance = {
      cpuUsage: {
        user: Math.round(cpuUsage.user / 1000), // Convert to ms
        system: Math.round(cpuUsage.system / 1000),
      },
    };

    checks.push({
      service: "cpu",
      status: "healthy", // CPU check is informational
      responseTime: 0,
      details: health.performance.cpuUsage,
      timestamp: Date.now(),
    });

    requestLogger.debug("CPU check completed", health.performance.cpuUsage);
  } catch (error) {
    const appError = ErrorHandler.handle(error, { check: "cpu" });
    requestLogger.error("CPU check failed", appError);
  }

  // Database connection check
  try {
    const dbStartTime = performance.now();
    const pool = getPool();
    const client = await pool.connect();

    // Test with a more comprehensive query
    await client.query("SELECT 1 as health_check, NOW() as server_time, version() as version");

    // Test connection pool status
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };

    client.release();

    const responseTime = performance.now() - dbStartTime;
    const dbStatus =
      responseTime < 1000 ? "healthy" : responseTime < 3000 ? "degraded" : "unhealthy";

    checks.push({
      service: "database",
      status: dbStatus,
      responseTime: Math.round(responseTime),
      details: {
        latency: `${Math.round(responseTime)}ms`,
        pool: poolStats,
        type: "postgresql",
      },
      timestamp: Date.now(),
    });

    requestLogger.debug("Database check passed", {
      responseTime: Math.round(responseTime),
      status: dbStatus,
      pool: poolStats,
    });
  } catch (error) {
    const responseTime = performance.now() - performance.now();
    const appError = ErrorHandler.handle(error, { check: "database" });
    requestLogger.error("Database health check failed", appError);

    checks.push({
      service: "database",
      status: "unhealthy",
      responseTime: Math.round(responseTime),
      details: { error: appError.message },
      timestamp: Date.now(),
    });
  }

  // Redis connection check (if configured)
  if (env.UPSTASH_REDIS_REST_URL) {
    try {
      const redisStartTime = performance.now();
      const testKey = `health:${Date.now()}`;

      // Test Redis with set/get/delete operations
      const setResponse = await fetch(`${env.UPSTASH_REDIS_REST_URL}/set/${testKey}/ok`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      if (!setResponse.ok) {
        throw new Error(`Redis SET failed: ${setResponse.status}`);
      }

      const getResponse = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${testKey}`, {
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      const getValue = await getResponse.json();

      // Clean up test key
      await fetch(`${env.UPSTASH_REDIS_REST_URL}/del/${testKey}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      const responseTime = performance.now() - redisStartTime;
      const redisStatus = getValue.result === "ok" && responseTime < 2000 ? "healthy" : "degraded";

      checks.push({
        service: "redis",
        status: redisStatus,
        responseTime: Math.round(responseTime),
        details: {
          latency: `${Math.round(responseTime)}ms`,
          test: "set/get/del",
          result: getValue.result,
        },
        timestamp: Date.now(),
      });

      requestLogger.debug("Redis check passed", {
        responseTime: Math.round(responseTime),
        status: redisStatus,
        result: getValue.result,
      });
    } catch (error) {
      const appError = ErrorHandler.handle(error, { check: "redis" });
      requestLogger.error("Redis health check failed", appError);

      checks.push({
        service: "redis",
        status: "unhealthy",
        responseTime: 0,
        details: { error: appError.message },
        timestamp: Date.now(),
      });
    }
  } else {
    requestLogger.debug("Redis health check skipped - not configured");

    checks.push({
      service: "redis",
      status: "healthy",
      responseTime: 0,
      details: { message: "Redis not configured - skipped" },
      timestamp: Date.now(),
    });
  }

  // Environment variables check
  try {
    const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];

    const optionalEnvVars = [
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "VITE_SENTRY_DSN",
    ];

    const envCheck = {
      required: {} as Record<string, boolean>,
      optional: {} as Record<string, boolean>,
      missing: [] as string[],
    };

    // Check required environment variables
    requiredEnvVars.forEach((varName) => {
      const exists = !!process.env[varName];
      envCheck.required[varName] = exists;
      if (!exists) {
        envCheck.missing.push(varName);
      }
    });

    // Check optional environment variables
    optionalEnvVars.forEach((varName) => {
      envCheck.optional[varName] = !!process.env[varName];
    });

    const envStatus = envCheck.missing.length === 0 ? "healthy" : "unhealthy";

    checks.push({
      service: "environment",
      status: envStatus,
      responseTime: 0,
      details: envCheck,
      timestamp: Date.now(),
    });

    requestLogger.debug("Environment check completed", {
      status: envStatus,
      missing: envCheck.missing.length,
    });
  } catch (error) {
    const appError = ErrorHandler.handle(error, { check: "environment" });
    requestLogger.error("Environment check failed", appError);

    checks.push({
      service: "environment",
      status: "unhealthy",
      responseTime: 0,
      details: { error: appError.message },
      timestamp: Date.now(),
    });
  }

  // Determine overall health status
  const unhealthyCount = checks.filter((check) => check.status === "unhealthy").length;
  const degradedCount = checks.filter((check) => check.status === "degraded").length;

  let overall: "healthy" | "degraded" | "unhealthy";
  if (unhealthyCount > 0) {
    overall = "unhealthy";
  } else if (degradedCount > 0) {
    overall = "degraded";
  } else {
    overall = "healthy";
  }

  const finalHealth: SystemHealth = {
    ...health,
    overall,
    checks,
  } as SystemHealth;

  const totalTime = performance.now() - startTime;
  const statusCode = overall === "healthy" ? 200 : overall === "degraded" ? 200 : 503;

  requestLogger.info("Detailed health check completed", {
    overall,
    totalTime: Math.round(totalTime),
    checksCount: checks.length,
    statusCode,
  });

  // Set appropriate headers
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("X-Health-Check", "detailed");
  res.setHeader("X-Response-Time", Math.round(totalTime).toString());

  return res.status(statusCode).json(successResponse(finalHealth));
}

// Export handler with middleware
export default compose(withErrorHandler, withMethod(["GET"]))(handler);
