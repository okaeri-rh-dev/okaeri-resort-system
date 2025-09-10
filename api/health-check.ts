/**
 * Health check API endpoint (Production Deployment Format)
 * GET /api/health-check
 *
 * This endpoint provides comprehensive system health information
 * optimized for production monitoring, external health checks,
 * and deployment validation.
 */

import type { VercelRequest as _VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandler, withMethod, compose, type ExtendedRequest } from "./_lib/middleware";
import { successResponse } from "./_lib/types";
import { getPool } from "./_lib/database";
import { env } from "../src/lib/env";
import { ErrorHandler } from "../src/lib/error-handler";
import os from "os";

async function handler(req: ExtendedRequest, res: VercelResponse) {
  const requestLogger = req.requestLogger!;

  requestLogger.debug("Starting comprehensive health check");

  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: process.env.VITE_APP_VERSION || "1.0.0",
    nodeVersion: process.version,
    requestId: req.requestId,
    checks: {
      database: false,
      redis: false,
      environment: false,
    },
    database: {
      status: "disconnected",
      responseTime: 0,
      connectionPool: {
        total: 0,
        active: 0,
        idle: 0,
      },
    },
    redis: {
      status: "disconnected",
      responseTime: 0,
      memory: {
        used: 0,
        total: 0,
      },
    },
    system: {
      memory: {
        used: 0,
        total: 0,
        free: 0,
      },
      cpu: {
        cores: os.cpus().length,
        usage: 0,
      },
      loadAverage: os.loadavg(),
    },
    requests: {
      total: 0,
      averageResponseTime: 0,
    },
    errors: {
      rate: 0,
      total: 0,
    },
    externalServices: {},
  };

  // Check environment configuration
  try {
    // Verify critical environment variables are set
    const hasRequiredVars = !!(env.DATABASE_URL && env.JWT_SECRET && env.JWT_REFRESH_SECRET);

    health.checks.environment = hasRequiredVars;

    if (!hasRequiredVars) {
      health.status = "unhealthy";
      requestLogger.warn("Missing critical environment variables");
    }
  } catch (error) {
    health.status = "unhealthy";
    health.checks.environment = false;
    requestLogger.error("Environment check failed", error as Error);
  }

  // Check database connection with detailed metrics
  try {
    const startTime = performance.now();
    const pool = getPool();
    const client = await pool.connect();

    // Test basic connectivity
    await client.query("SELECT 1 as health_check");

    // Get connection pool stats
    const poolStats = {
      total: pool.totalCount,
      active: pool.totalCount - pool.idleCount,
      idle: pool.idleCount,
    };

    client.release();

    const responseTime = Math.round(performance.now() - startTime);

    health.checks.database = true;
    health.database = {
      status: "connected",
      responseTime,
      connectionPool: poolStats,
    };

    requestLogger.debug("Database health check passed", {
      responseTime,
      poolStats,
    });
  } catch (error) {
    health.status = health.status === "healthy" ? "degraded" : "unhealthy";
    health.database.status = "disconnected";
    const appError = ErrorHandler.handle(error, { check: "database" });
    requestLogger.error("Database health check failed", appError);
  }

  // Check Redis connection with detailed metrics (if configured)
  if (env.UPSTASH_REDIS_REST_URL) {
    try {
      const startTime = performance.now();

      // Test basic connectivity with SET/GET/DEL operations
      const testKey = `health_check_${Date.now()}`;
      const testValue = "ok";

      // SET test
      const setResponse = await fetch(`${env.UPSTASH_REDIS_REST_URL}/set/${testKey}/${testValue}`, {
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      if (!setResponse.ok) throw new Error(`SET failed: ${setResponse.status}`);

      // GET test
      const getResponse = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${testKey}`, {
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      if (!getResponse.ok) throw new Error(`GET failed: ${getResponse.status}`);

      const getValue = await getResponse.json();
      if (getValue.result !== testValue) {
        throw new Error("GET returned incorrect value");
      }

      // DELETE test (cleanup)
      await fetch(`${env.UPSTASH_REDIS_REST_URL}/del/${testKey}`, {
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });

      const responseTime = Math.round(performance.now() - startTime);

      health.checks.redis = true;
      health.redis = {
        status: "connected",
        responseTime,
        memory: {
          used: 0, // Upstash doesn't expose memory stats via REST
          total: 0,
        },
      };

      requestLogger.debug("Redis health check passed", { responseTime });
    } catch (error) {
      health.redis.status = "disconnected";
      const appError = ErrorHandler.handle(error, { check: "redis" });
      requestLogger.error("Redis health check failed", appError);
    }
  } else {
    requestLogger.debug("Redis health check skipped - not configured");
  }

  // System resource monitoring
  try {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      used: memoryUsage.heapUsed,
      total: memoryUsage.heapTotal,
      free: memoryUsage.heapTotal - memoryUsage.heapUsed,
    };

    health.system.memory = systemMemory;

    // CPU usage approximation (not available in serverless easily)
    health.system.cpu.usage = 0; // Will be 0 in serverless

    requestLogger.debug("System resource check completed", {
      memory: systemMemory,
      loadAverage: health.system.loadAverage,
    });
  } catch (error) {
    requestLogger.error("System resource check failed", error as Error);
  }

  // Request statistics (basic implementation)
  health.requests = {
    total: 1, // Current request
    averageResponseTime: Math.round(performance.now()),
  };

  // Error rate (basic implementation - would need persistence for real metrics)
  health.errors = {
    rate: 0, // No errors detected in current health check
    total: 0,
  };

  // Determine overall health status
  if (!health.checks.database || !health.checks.environment) {
    health.status = "unhealthy";
  } else if (!health.checks.redis && env.UPSTASH_REDIS_REST_URL) {
    health.status = "degraded";
  }

  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  requestLogger.info("Comprehensive health check completed", {
    status: health.status,
    checks: health.checks,
    databaseResponseTime: health.database.responseTime,
    redisResponseTime: health.redis.responseTime,
    statusCode,
  });

  return res.status(statusCode).json(successResponse(health));
}

// Export handler with middleware
export default compose(withErrorHandler, withMethod(["GET"]))(handler);
