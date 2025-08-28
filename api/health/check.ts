/**
 * Health check API endpoint
 * GET /api/health/check
 */

import type { VercelRequest as _VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandler, withMethod, compose, type ExtendedRequest } from "../_lib/middleware";
import { successResponse } from "../_lib/types";
import { getPool } from "../_lib/database";
import { env } from "../../src/lib/env";
import { ErrorHandler } from "../../src/lib/error-handler";

async function handler(req: ExtendedRequest, res: VercelResponse) {
  const requestLogger = req.requestLogger!;

  requestLogger.debug("Starting health check");

  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: process.env.VITE_APP_VERSION || "1.0.0",
    requestId: req.requestId,
    checks: {
      database: false,
      redis: false,
      environment: false,
    },
  };

  // Check environment configuration
  try {
    // Verify critical environment variables are set
    health.checks.environment = !!env.DATABASE_URL;
  } catch (error) {
    health.status = "unhealthy";
    requestLogger.error("Environment check failed", error as Error);
  }

  // Check database connection
  try {
    const startTime = performance.now();
    const pool = getPool();
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    health.checks.database = true;

    const duration = performance.now() - startTime;
    requestLogger.debug("Database health check passed", { duration: Math.round(duration) });
  } catch (error) {
    health.status = "degraded";
    const appError = ErrorHandler.handle(error, { check: "database" });
    requestLogger.error("Database health check failed", appError);
  }

  // Check Redis connection (if configured)
  if (env.UPSTASH_REDIS_REST_URL) {
    try {
      const startTime = performance.now();
      const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
      health.checks.redis = response.ok;

      const duration = performance.now() - startTime;
      if (response.ok) {
        requestLogger.debug("Redis health check passed", { duration: Math.round(duration) });
      } else {
        requestLogger.warn("Redis health check failed", {
          status: response.status,
          duration: Math.round(duration),
        });
      }
    } catch (error) {
      const appError = ErrorHandler.handle(error, { check: "redis" });
      requestLogger.error("Redis health check failed", appError);
    }
  } else {
    requestLogger.debug("Redis health check skipped - not configured");
  }

  // Determine overall health status
  if (!health.checks.database || !health.checks.environment) {
    health.status = "unhealthy";
  }

  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  requestLogger.info("Health check completed", {
    status: health.status,
    checks: health.checks,
    statusCode,
  });

  return res.status(statusCode).json(successResponse(health));
}

// Export handler with middleware
export default compose(withErrorHandler, withMethod(["GET"]))(handler);
