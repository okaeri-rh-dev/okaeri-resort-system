/**
 * Refresh token API endpoint
 * POST /api/auth/refresh
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { withErrorHandler, withMethod, withValidation, compose } from "../_lib/middleware";
import { successResponse, AuthenticationError, type TokenPayload } from "../_lib/types";
import { getPool } from "../_lib/database";

// Request validation schema
const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
  projectId: z.string().uuid().optional(),
});

type RefreshRequest = z.infer<typeof refreshSchema>;

async function handler(req: VercelRequest, res: VercelResponse) {
  const { refreshToken, projectId } = req.body as RefreshRequest;

  try {
    // Verify refresh token
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new AuthenticationError("JWT_REFRESH_SECRET not configured");
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET) as { userId: string };

    // Get user from database
    const pool = getPool();
    const client = await pool.connect();

    try {
      const userResult = await client.query(
        `SELECT 
          u.id,
          u.email,
          u.name,
          u.role,
          u.is_active
        FROM users u
        WHERE u.id = $1`,
        [payload.userId]
      );

      if (userResult.rows.length === 0) {
        throw new AuthenticationError("User not found");
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        throw new AuthenticationError("Account is disabled");
      }

      // Get permissions for the specified project or default project
      let currentProject = null;
      let permissions = [];

      if (projectId) {
        const projectResult = await client.query(
          `SELECT 
            p.id,
            p.name,
            p.slug,
            pm.role as project_role,
            pm.permissions
          FROM projects p
          JOIN project_members pm ON pm.project_id = p.id
          WHERE pm.user_id = $1 AND p.id = $2 AND p.status = 'ACTIVE'`,
          [user.id, projectId]
        );

        if (projectResult.rows.length > 0) {
          currentProject = projectResult.rows[0];
          permissions = currentProject.permissions || [];
        }
      } else {
        // Get default project
        const projectResult = await client.query(
          `SELECT 
            p.id,
            p.name,
            p.slug,
            pm.role as project_role,
            pm.permissions
          FROM projects p
          JOIN project_members pm ON pm.project_id = p.id
          WHERE pm.user_id = $1 AND p.status = 'ACTIVE'
          ORDER BY pm.joined_at DESC
          LIMIT 1`,
          [user.id]
        );

        if (projectResult.rows.length > 0) {
          currentProject = projectResult.rows[0];
          permissions = currentProject.permissions || [];
        }
      }

      // Generate new access token
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        projectId: currentProject?.id,
        permissions,
      };

      if (!process.env.JWT_SECRET) {
        throw new AuthenticationError("JWT_SECRET not configured");
      }

      const newToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "24h" });

      // Generate new refresh token (rotate refresh tokens for security)
      const newRefreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: "90d",
      });

      // Log token refresh
      await client.query(
        `INSERT INTO activity_logs 
          (user_id, action, resource, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          "TOKEN_REFRESH",
          "auth",
          { projectId: currentProject?.id },
          req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
          req.headers["user-agent"],
        ]
      );

      // Set secure cookie for new token
      res.setHeader(
        "Set-Cookie",
        `token=${newToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
      );

      return res.status(200).json(
        successResponse(
          {
            token: newToken,
            refreshToken: newRefreshToken,
            currentProject,
          },
          "Token refreshed successfully"
        )
      );
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError("Refresh token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError("Invalid refresh token");
    }
    throw error;
  }
}

// Export handler with middleware
export default compose(
  withErrorHandler,
  withMethod(["POST"]),
  withValidation(refreshSchema, "body")
)(handler);
