/**
 * Sessions management API endpoint
 * GET /api/auth/sessions - List active sessions
 * DELETE /api/auth/sessions/:id - Revoke a session
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";
import { query, execute } from "../lib/db";
import { successResponse, errorResponse, AuthorizationError } from "../_lib/types";

interface Session {
  id: string;
  user_id: string;
  token_id: string;
  ip_address: string;
  user_agent: string;
  last_activity: Date;
  created_at: Date;
  expires_at: Date;
  is_current: boolean;
}

async function listSessions(req: AuthenticatedRequest, res: VercelResponse) {
  if (!req.user?.userId) {
    return res.status(401).json(errorResponse(new AuthorizationError("Authentication required")));
  }

  try {
    // Get all active sessions for the user
    const sessions = await query<Session>(
      `SELECT 
        s.id,
        s.user_id,
        s.token_id,
        s.ip_address,
        s.user_agent,
        s.last_activity,
        s.created_at,
        s.expires_at,
        (s.token_id = $2) as is_current
      FROM sessions s
      WHERE s.user_id = $1 
        AND s.expires_at > CURRENT_TIMESTAMP
        AND s.revoked_at IS NULL
      ORDER BY s.last_activity DESC`,
      [req.user.userId, req.headers["x-session-id"] || ""]
    );

    // Parse user agents for better display
    const parsedSessions = sessions.rows.map((session) => ({
      id: session.id,
      ipAddress: session.ip_address,
      device: parseUserAgent(session.user_agent),
      lastActivity: session.last_activity,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      isCurrent: session.is_current,
    }));

    return res.status(200).json(
      successResponse({
        sessions: parsedSessions,
        total: parsedSessions.length,
      })
    );
  } catch (error) {
    console.error("[Sessions] List error:", error);
    return res.status(500).json(errorResponse(new Error("Failed to retrieve sessions")));
  }
}

async function revokeSession(req: AuthenticatedRequest, res: VercelResponse) {
  if (!req.user?.userId) {
    return res.status(401).json(errorResponse(new AuthorizationError("Authentication required")));
  }

  const sessionId = req.query.id as string;

  if (!sessionId) {
    return res.status(400).json(errorResponse(new Error("Session ID is required")));
  }

  try {
    // Verify the session belongs to the user
    const result = await query("SELECT id, user_id FROM sessions WHERE id = $1 AND user_id = $2", [
      sessionId,
      req.user.userId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse(new Error("Session not found")));
    }

    // Revoke the session
    await execute("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1", [sessionId]);

    // Log session revocation
    await execute(
      `INSERT INTO activity_logs 
        (user_id, action, resource, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        req.user.userId,
        "SESSION_REVOKED",
        "auth",
        { sessionId },
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        req.headers["user-agent"],
      ]
    );

    return res.status(200).json(successResponse(null, "Session revoked successfully"));
  } catch (error) {
    console.error("[Sessions] Revoke error:", error);
    return res.status(500).json(errorResponse(new Error("Failed to revoke session")));
  }
}

async function revokeAllSessions(req: AuthenticatedRequest, res: VercelResponse) {
  if (!req.user?.userId) {
    return res.status(401).json(errorResponse(new AuthorizationError("Authentication required")));
  }

  try {
    const currentSessionId = req.headers["x-session-id"] as string;

    // Revoke all sessions except the current one
    const result = await execute(
      `UPDATE sessions 
       SET revoked_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 
         AND ($2 IS NULL OR token_id != $2)
         AND revoked_at IS NULL`,
      [req.user.userId, currentSessionId]
    );

    // Log bulk session revocation
    await execute(
      `INSERT INTO activity_logs 
        (user_id, action, resource, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        req.user.userId,
        "ALL_SESSIONS_REVOKED",
        "auth",
        { revokedCount: result, keepCurrent: !!currentSessionId },
        req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        req.headers["user-agent"],
      ]
    );

    return res
      .status(200)
      .json(successResponse({ revokedCount: result }, "All other sessions revoked successfully"));
  } catch (error) {
    console.error("[Sessions] Revoke all error:", error);
    return res.status(500).json(errorResponse(new Error("Failed to revoke sessions")));
  }
}

// Helper function to parse user agent
function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
  device: string;
} {
  // Simple parsing - in production, use a library like ua-parser-js
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let device = "Unknown Device";

  if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Safari")) browser = "Safari";
  else if (userAgent.includes("Edge")) browser = "Edge";

  if (userAgent.includes("Windows")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "macOS";
  else if (userAgent.includes("Linux")) os = "Linux";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iOS") || userAgent.includes("iPhone")) os = "iOS";

  if (userAgent.includes("Mobile")) device = "Mobile";
  else if (userAgent.includes("Tablet")) device = "Tablet";
  else device = "Desktop";

  return { browser, os, device };
}

// Main handler
async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  switch (req.method) {
    case "GET":
      return listSessions(req, res);
    case "DELETE":
      if (req.query.all === "true") {
        return revokeAllSessions(req, res);
      }
      return revokeSession(req, res);
    default:
      return res.status(405).json({
        error: "Method not allowed",
        allowed: ["GET", "DELETE"],
      });
  }
}

// Export with authentication required
export default requireAuth(handler);
