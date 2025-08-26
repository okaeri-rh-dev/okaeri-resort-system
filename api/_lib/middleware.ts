/**
 * Middleware utilities for Vercel API routes
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  errorResponse,
  type TokenPayload,
  type TenantContext,
} from "./types";

// Initialize rate limiter (requires Upstash Redis)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
    })
  : null;

// CORS configuration
export const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGINS || "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Project-ID",
  "Access-Control-Max-Age": "86400",
};

// Method handler wrapper
export type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse,
  context?: TenantContext
) => Promise<void> | void;

export const withMethod = (methods: string[], handler: ApiHandler): ApiHandler => {
  return async (req, res, context) => {
    if (!methods.includes(req.method || "")) {
      return res.status(405).json({
        error: "Method not allowed",
        allowed: methods,
      });
    }
    return handler(req, res, context);
  };
};

// Authentication middleware
export const withAuth = (handler: ApiHandler): ApiHandler => {
  return async (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        throw new AuthenticationError("No token provided");
      }

      if (!process.env.JWT_SECRET) {
        throw new AuthenticationError("JWT_SECRET not configured");
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET) as TokenPayload;

      const context: TenantContext = {
        userId: payload.userId,
        projectId: extractProjectId(req) || payload.projectId || "",
        userRole: payload.role,
        permissions: payload.permissions || [],
      };

      return handler(req, res, context);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json(errorResponse(new AuthenticationError("Invalid token")));
      }
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json(errorResponse(new AuthenticationError("Token expired")));
      }
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json(errorResponse(error));
      }
      return res.status(500).json(errorResponse(new Error("Authentication failed")));
    }
  };
};

// Project authorization middleware
export const withProject = (handler: ApiHandler): ApiHandler => {
  return withAuth(async (req, res, context) => {
    if (!context?.projectId) {
      throw new AuthorizationError("Project context required");
    }

    // Verify user has access to the project
    // This would typically check against database
    // For now, we'll assume the token contains valid project access

    return handler(req, res, context);
  });
};

// Permission check middleware
export const withPermission = (permission: string, handler: ApiHandler): ApiHandler => {
  return withProject(async (req, res, context) => {
    if (!context?.permissions.includes(permission)) {
      throw new AuthorizationError(`Permission "${permission}" required`);
    }
    return handler(req, res, context);
  });
};

// Validation middleware
export const withValidation = <T extends z.ZodSchema>(
  schema: T,
  target: "body" | "query" | "params" = "body"
) => {
  return (handler: ApiHandler): ApiHandler => {
    return async (req, res, context) => {
      try {
        const data = target === "body" ? req.body : req.query;

        const validated = await schema.parseAsync(data);

        // Attach validated data to request
        if (target === "body") {
          req.body = validated;
        } else if (target === "query") {
          req.query = validated;
        }

        return handler(req, res, context);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json(errorResponse(new ValidationError("Validation failed", error.errors)));
        }
        throw error;
      }
    };
  };
};

// Rate limiting middleware
export const withRateLimit = (handler: ApiHandler, identifier?: string): ApiHandler => {
  return async (req, res, context) => {
    if (!ratelimit) {
      // If rate limiting is not configured, pass through
      return handler(req, res, context);
    }

    const id =
      identifier || context?.userId || (req.headers["x-forwarded-for"] as string) || "anonymous";

    const { success, limit, reset, remaining } = await ratelimit.limit(id);

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", new Date(reset).toISOString());

    if (!success) {
      return res.status(429).json(errorResponse(new RateLimitError(reset)));
    }

    return handler(req, res, context);
  };
};

// Error handling wrapper
export const withErrorHandler = (handler: ApiHandler): ApiHandler => {
  return async (req, res, context) => {
    try {
      // Set CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Handle OPTIONS request
      if (req.method === "OPTIONS") {
        return res.status(200).end();
      }

      await handler(req, res, context);
    } catch (error) {
      console.error("API Error:", error);

      if (error instanceof ApiError) {
        return res.status(error.statusCode).json(errorResponse(error));
      }

      // Log unexpected errors
      if (process.env.NODE_ENV === "production") {
        // Send to error tracking service (Sentry, etc.)
        console.error("Unexpected error:", error);
      }

      return res.status(500).json(errorResponse(new Error("Internal server error")));
    }
  };
};

// Audit logging middleware
export const withAuditLog = (action: string, resource: string): ApiHandler => {
  return async (req, res, context) => {
    const startTime = Date.now();
    const originalEnd = res.end;

    // Override res.end to capture response
    res.end = function (...args: unknown[]) {
      const duration = Date.now() - startTime;

      // Log audit entry
      void logAuditEntry({
        userId: context?.userId || "anonymous",
        projectId: context?.projectId,
        action,
        resource,
        method: req.method || "UNKNOWN",
        path: req.url || "",
        statusCode: res.statusCode,
        duration,
        ip: (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
        timestamp: new Date().toISOString(),
      });

      // Call original end
      return originalEnd.apply(res, args);
    };

    return await handler(req, res, context);
  };
};

// Helper functions
function extractToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return req.cookies?.token || null;
}

function extractProjectId(req: VercelRequest): string | null {
  return (req.headers["x-project-id"] as string) || (req.query.projectId as string) || null;
}

interface AuditEntry {
  userId: string;
  projectId?: string;
  action: string;
  resource: string;
  method?: string;
  path?: string;
  statusCode: number;
  duration: number;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

async function logAuditEntry(_entry: AuditEntry): Promise<void> {
  // In production, this would send to a logging service
  // For now, just console log in development
  if (process.env.NODE_ENV !== "production") {
    // Development logging - consider using a proper logger in production
  }

  // TODO: Send to logging service (CloudWatch, Datadog, etc.)
}

// Combine multiple middleware
export const compose = (
  ...middlewares: ((handler: ApiHandler) => ApiHandler)[]
): ((handler: ApiHandler) => ApiHandler) => {
  return (handler: ApiHandler) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
};
