/**
 * Logout API endpoint
 * POST /api/auth/logout
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withErrorHandler, withMethod, withAuth, compose } from "../_lib/middleware";
import { successResponse, type TenantContext } from "../_lib/types";
import { getPool } from "../_lib/database";

async function handler(req: VercelRequest, res: VercelResponse, context?: TenantContext) {
  // Log logout event if user is authenticated
  if (context?.userId) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query(
        `INSERT INTO activity_logs 
          (user_id, action, resource, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          context.userId,
          "LOGOUT",
          "auth",
          req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
          req.headers["user-agent"],
        ]
      );
    } catch (error) {
      console.error("Failed to log logout event:", error);
    } finally {
      client.release();
    }
  }

  // Clear authentication cookie
  res.setHeader("Set-Cookie", "token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");

  return res.status(200).json(successResponse(null, "Logout successful"));
}

// Export handler with middleware
export default compose(
  withErrorHandler,
  withMethod(["POST"]),
  withAuth // Optional auth - logout should work even with expired token
)(handler);
