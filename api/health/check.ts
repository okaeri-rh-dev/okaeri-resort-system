/**
 * Health check API endpoint
 * GET /api/health/check
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandler, withMethod, compose } from "../_lib/middleware";
import { successResponse } from "../_lib/types";
import { getPool } from "../_lib/database";

async function handler(req: VercelRequest, res: VercelResponse) {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.VITE_APP_VERSION || "1.0.0",
    checks: {
      database: false,
      redis: false,
    },
  };

  // Check database connection
  try {
    const pool = getPool();
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    health.checks.database = true;
  } catch (error) {
    health.status = "degraded";
    console.error("Database health check failed:", error);
  }

  // Check Redis connection (if configured)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      });
      health.checks.redis = response.ok;
    } catch (error) {
      console.error("Redis health check failed:", error);
    }
  }

  // Determine overall health status
  if (!health.checks.database) {
    health.status = "unhealthy";
  }

  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  return res.status(statusCode).json(successResponse(health));
}

// Export handler with middleware
export default compose(withErrorHandler, withMethod(["GET"]))(handler);
