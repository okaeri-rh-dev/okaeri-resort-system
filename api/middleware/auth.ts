/**
 * Authentication middleware for API routes
 * Handles JWT validation and user context extraction
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAccessToken, extractToken } from "../lib/jwt";
import { AuthenticationError, type TenantContext } from "../_lib/types";

export interface AuthenticatedRequest extends VercelRequest {
  user?: TenantContext;
}

/**
 * Authentication middleware - validates JWT and adds user context
 */
export async function authenticateRequest(
  req: AuthenticatedRequest,
  res: VercelResponse,
  next?: () => Promise<void>
): Promise<void> {
  try {
    // Extract token from header or cookie
    const token = extractToken(req.headers.authorization as string, req.cookies?.token);

    if (!token) {
      res.status(401).json({
        error: "Authentication required",
        code: "NO_TOKEN",
      });
      return;
    }

    // Verify token and extract payload
    const payload = verifyAccessToken(token);

    // Build user context
    const userContext: TenantContext = {
      userId: payload.userId,
      projectId: payload.projectId || extractProjectId(req),
      userRole: payload.role,
      permissions: payload.permissions || [],
    };

    // Attach user context to request
    req.user = userContext;

    // Call next middleware if provided
    if (next) {
      await next();
    }
  } catch (error) {
    console.error("[Auth] Authentication error:", error);

    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        res.status(401).json({
          error: "Token has expired",
          code: "TOKEN_EXPIRED",
        });
        return;
      }

      if (error.message.includes("Invalid")) {
        res.status(401).json({
          error: "Invalid token",
          code: "INVALID_TOKEN",
        });
        return;
      }
    }

    res.status(401).json({
      error: "Authentication failed",
      code: "AUTH_FAILED",
    });
  }
}

/**
 * Extract project ID from request headers or query
 */
function extractProjectId(req: VercelRequest): string {
  return (req.headers["x-project-id"] as string) || (req.query.projectId as string) || "";
}

/**
 * Require authentication decorator
 */
export function requireAuth(
  handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    await authenticateRequest(req, res, async () => {
      await handler(req, res);
    });
  };
}

/**
 * Require specific permission
 */
export function requirePermission(permission: string) {
  return (handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>) => {
    return requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
      if (!req.user?.permissions.includes(permission)) {
        res.status(403).json({
          error: `Permission '${permission}' required`,
          code: "INSUFFICIENT_PERMISSIONS",
        });
        return;
      }
      await handler(req, res);
    });
  };
}

/**
 * Require specific role
 */
export function requireRole(role: string) {
  return (handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>) => {
    return requireAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
      if (req.user?.userRole !== role) {
        res.status(403).json({
          error: `Role '${role}' required`,
          code: "INSUFFICIENT_ROLE",
        });
        return;
      }
      await handler(req, res);
    });
  };
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(
  handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: AuthenticatedRequest, res: VercelResponse) => {
    try {
      const token = extractToken(req.headers.authorization as string, req.cookies?.token);

      if (token) {
        const payload = verifyAccessToken(token);
        req.user = {
          userId: payload.userId,
          projectId: payload.projectId || extractProjectId(req),
          userRole: payload.role,
          permissions: payload.permissions || [],
        };
      }
    } catch (error) {
      // Ignore authentication errors for optional auth
      console.error("[Auth] Optional auth error (ignored):", error);
    }

    await handler(req, res);
  };
}
