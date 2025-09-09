/**
 * Enhanced Middleware utilities for Vercel API routes
 * Integrates with comprehensive error handling and logging
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";
import {
  ApiError,
  AuthenticationError as _AuthenticationError,
  AuthorizationError as _AuthorizationError,
  ValidationError as _ValidationError,
  RateLimitError as _RateLimitError,
  errorResponse as _errorResponse,
  type TokenPayload,
  type TenantContext,
} from "./types";

// Import enhanced error handling and logging
import { logger, createRequestLogger, type LogContext as _LogContext } from "../../src/lib/logger";
import {
  ErrorHandler,
  createAuthenticationError,
  createAuthorizationError,
  createValidationError,
  type AppError,
} from "../../src/lib/error-handler";
import { env, corsOrigin } from "../../src/lib/env";
import { checkDDoSProtection, recordRequestCompletion } from "./ddos-protection";

// Initialize rate limiter (requires Upstash Redis)
const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(env.RATE_LIMIT_MAX || 100, "1 m"), // Configurable requests per minute
    })
  : null;

// Log rate limiter initialization status
if (ratelimit) {
  logger.info("Rate limiter initialized", {
    maxRequests: env.RATE_LIMIT_MAX || 100,
    window: "1 minute",
  });
} else {
  logger.warn("Rate limiter not configured - Upstash Redis credentials missing");
}

// Enhanced CORS configuration
const getCorsHeaders = (origin?: string) => {
  const allowedOrigins = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin];
  const requestOrigin = origin || "";

  // Check if origin is allowed
  const isAllowed = allowedOrigins.some((allowed) => {
    if (allowed === "*") return true;
    if (allowed.includes("*")) {
      // Handle wildcard domains like *.vercel.app
      const pattern = allowed.replace(/\*/g, ".*");
      return new RegExp(`^${pattern}$`).test(requestOrigin);
    }
    return allowed === requestOrigin;
  });

  return {
    "Access-Control-Allow-Origin": isAllowed ? requestOrigin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Project-ID, X-Request-ID",
    "Access-Control-Max-Age": "86400",
    // JWT-only auth: No credentials needed (removed Access-Control-Allow-Credentials)
    // Security headers
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
};

// Extended request interface with request ID
interface ExtendedRequest extends VercelRequest {
  requestId?: string;
  requestLogger?: ReturnType<typeof createRequestLogger>;
}

// Method handler wrapper - PHASE 1 TEMPORARY: Allow returning response for chaining
export type ApiHandler = (
  req: ExtendedRequest,
  res: VercelResponse,
  context?: TenantContext
) => Promise<VercelResponse | undefined> | VercelResponse | undefined;

export const withMethod = (methods: string[], handler: ApiHandler): ApiHandler => {
  return async (req, res, context) => {
    if (!methods.includes(req.method || "")) {
      const requestLogger = req.requestLogger || logger;
      requestLogger.warn("Method not allowed", {
        method: req.method,
        allowed: methods,
        path: req.url,
      });

      return res.status(405).json({
        error: "Method not allowed",
        allowed: methods,
        requestId: req.requestId,
      });
    }
    return handler(req, res, context);
  };
};

// Authentication middleware
export const withAuth = (handler: ApiHandler): ApiHandler => {
  return async (req, res) => {
    const requestLogger = req.requestLogger || logger;

    try {
      const token = extractToken(req);
      if (!token) {
        const error = createAuthenticationError("No token provided");
        requestLogger.warn("Authentication failed - no token", {
          path: req.url,
          method: req.method,
        });
        throw error;
      }

      if (!env.JWT_SECRET) {
        const error = createAuthenticationError("JWT_SECRET not configured");
        requestLogger.error("JWT_SECRET not configured in environment");
        throw error;
      }

      const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

      const context: TenantContext = {
        userId: payload.userId,
        projectId: extractProjectId(req) || payload.projectId || "",
        userRole: payload.role,
        permissions: payload.permissions || [],
      };

      requestLogger.debug("Authentication successful", {
        userId: context.userId,
        projectId: context.projectId,
        role: context.userRole,
      });

      return handler(req, res, context);
    } catch (error) {
      let appError: AppError;

      if (error instanceof jwt.JsonWebTokenError) {
        appError = createAuthenticationError("Invalid token");
        requestLogger.warn("Invalid JWT token", { error: error.message });
      } else if (error instanceof jwt.TokenExpiredError) {
        appError = createAuthenticationError("Token expired");
        requestLogger.warn("JWT token expired");
      } else if (error instanceof ApiError) {
        appError = ErrorHandler.handle(error, { middleware: "withAuth" });
      } else {
        appError = ErrorHandler.handle(error, { middleware: "withAuth" });
      }

      return res.status(appError.statusCode || 500).json({
        error: ErrorHandler.getUserMessage(appError),
        code: appError.code,
        requestId: req.requestId,
      });
    }
  };
};

// Project authorization middleware
export const withProject = (handler: ApiHandler): ApiHandler => {
  return withAuth(async (req, res, context) => {
    const requestLogger = req.requestLogger || logger;

    if (!context?.projectId) {
      const error = createAuthorizationError("Project context required");
      requestLogger.warn("Project authorization failed - no project context", {
        userId: context?.userId,
        path: req.url,
      });

      return res.status(403).json({
        error: ErrorHandler.getUserMessage(error),
        code: error.code,
        requestId: req.requestId,
      });
    }

    requestLogger.debug("Project authorization successful", {
      userId: context.userId,
      projectId: context.projectId,
    });

    // Verify user has access to the project
    // This would typically check against database
    // For now, we'll assume the token contains valid project access

    return handler(req, res, context);
  });
};

// Permission check middleware
export const withPermission = (permission: string, handler: ApiHandler): ApiHandler => {
  return withProject(async (req, res, context) => {
    const requestLogger = req.requestLogger || logger;

    if (!context?.permissions.includes(permission)) {
      const error = createAuthorizationError(`Permission "${permission}" required`);
      requestLogger.warn("Permission check failed", {
        userId: context?.userId,
        projectId: context?.projectId,
        requiredPermission: permission,
        userPermissions: context?.permissions,
        path: req.url,
      });

      return res.status(403).json({
        error: ErrorHandler.getUserMessage(error),
        code: error.code,
        details: { requiredPermission: permission },
        requestId: req.requestId,
      });
    }

    requestLogger.debug("Permission check successful", {
      userId: context.userId,
      permission,
    });

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
      const requestLogger = req.requestLogger || logger;

      try {
        const data = target === "body" ? req.body : req.query;

        requestLogger.debug("Validating request data", {
          target,
          dataKeys: data ? Object.keys(data) : [],
        });

        const validated = await schema.parseAsync(data);

        // Attach validated data to request
        if (target === "body") {
          req.body = validated;
        } else if (target === "query") {
          req.query = validated;
        }

        requestLogger.debug("Validation successful");
        return handler(req, res, context);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = createValidationError("Validation failed", {
            errors: error.errors,
            target,
          });

          requestLogger.warn("Validation failed", {
            target,
            errors: error.errors,
            path: req.url,
          });

          return res.status(400).json({
            error: ErrorHandler.getUserMessage(validationError),
            code: validationError.code,
            details: error.errors,
            requestId: req.requestId,
          });
        }
        throw error;
      }
    };
  };
};

// Rate limiting middleware
export const withRateLimit =
  (identifier?: string) =>
  (handler: ApiHandler): ApiHandler => {
    // PHASE 1 TEMPORARY: Fixed middleware pattern
    return async (req, res, context) => {
      const requestLogger = req.requestLogger || logger;

      // Check DDoS protection first (cost-based monitoring)
      try {
        const ddosCheck = await checkDDoSProtection();
        if (!ddosCheck.allowed) {
          requestLogger.warn("DDoS protection triggered", {
            reason: ddosCheck.reason,
            limits: ddosCheck.currentLimits,
            path: req.url,
          });

          return res.status(503).json({
            error: "Service temporarily unavailable due to high load",
            code: "DDOS_PROTECTION_ACTIVE",
            reason: ddosCheck.reason,
            retryAfter: "5m",
            requestId: req.requestId,
          });
        }
      } catch (ddosError) {
        // If DDoS check fails, log but don't block (fail open)
        requestLogger.warn("DDoS protection check failed", {
          error: ddosError instanceof Error ? ddosError.message : "Unknown error",
        });
      }

      if (!ratelimit) {
        // If rate limiting is not configured, pass through
        requestLogger.debug("Rate limiting bypassed - not configured");
        return handler(req, res, context);
      }

      const id =
        identifier || context?.userId || (req.headers["x-forwarded-for"] as string) || "anonymous";

      try {
        const { success, limit, reset, remaining } = await ratelimit.limit(id);

        res.setHeader("X-RateLimit-Limit", limit.toString());
        res.setHeader("X-RateLimit-Remaining", remaining.toString());
        res.setHeader("X-RateLimit-Reset", new Date(reset).toISOString());

        if (!success) {
          requestLogger.warn("Rate limit exceeded", {
            identifier: id,
            limit,
            reset: new Date(reset).toISOString(),
            path: req.url,
          });

          return res.status(429).json({
            error: "Too many requests. Please try again later.",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: new Date(reset).toISOString(),
            requestId: req.requestId,
          });
        }

        requestLogger.debug("Rate limit check passed", {
          identifier: id,
          remaining,
        });

        // Execute handler and record completion for DDoS monitoring
        const handlerResponse = await handler(req, res, context);

        // Record successful request completion
        try {
          await recordRequestCompletion();
        } catch (recordError) {
          // Log but don't affect response if recording fails
          requestLogger.debug("Request completion recording failed", {
            error: recordError instanceof Error ? recordError.message : "Unknown error",
          });
        }

        return handlerResponse;
      } catch (error) {
        // If rate limiting fails, log but don't block the request
        requestLogger.error("Rate limiting error", error as Error);
        return handler(req, res, context);
      }
    };
  };

// Error handling wrapper with request tracking
export const withErrorHandler = (handler: ApiHandler): ApiHandler => {
  return async (req: ExtendedRequest, res, context) => {
    // Generate request ID
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    req.requestId = requestId;

    // Create request-specific logger
    const requestLogger = createRequestLogger(requestId, context?.userId, context?.projectId);
    req.requestLogger = requestLogger;

    // Log incoming request
    requestLogger.info("Incoming request", {
      method: req.method,
      url: req.url,
      userAgent: req.headers["user-agent"],
      ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
      referer: req.headers.referer,
    });

    const startTime = Date.now();

    try {
      // Set CORS headers using env configuration
      const corsHeaders = getCorsHeaders(req.headers.origin as string);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        if (value !== undefined) {
          // PHASE 1 TEMPORARY: Guard against undefined values
          res.setHeader(key, value);
        }
      });

      // Add request ID to response headers
      res.setHeader("X-Request-ID", requestId);

      // Handle OPTIONS request
      if (req.method === "OPTIONS") {
        requestLogger.debug("OPTIONS request handled");
        return res.status(200).end();
      }

      const result = await handler(req, res, context);

      // Log successful response
      const duration = Date.now() - startTime;
      requestLogger.info("Request completed", {
        statusCode: res.statusCode,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle error using ErrorHandler
      const appError = ErrorHandler.handle(error, {
        requestId,
        method: req.method,
        url: req.url,
        userId: context?.userId,
        projectId: context?.projectId,
        duration,
      });

      // Determine status code
      const statusCode =
        appError.statusCode || (appError instanceof ApiError ? appError.statusCode : 500);

      // Log error with full context
      requestLogger.error(
        "Request failed",
        {
          statusCode,
          duration,
          errorType: appError.type,
          errorCode: appError.code,
          errorMessage: appError.message,
        },
        appError
      );

      // Send error response
      return res.status(statusCode).json({
        error: ErrorHandler.getUserMessage(appError),
        code: appError.code || "INTERNAL_ERROR",
        requestId,
        ...(env.NODE_ENV === "development" && {
          details: appError.details,
          stack: appError.stack,
        }),
      });
    }
  };
};

// Audit logging middleware - PHASE 1 TEMPORARY: Fixed return type
export const withAuditLog = (action: string, resource: string) => {
  return (handler: ApiHandler): ApiHandler => {
    return async (req, res, context) => {
      const requestLogger = req.requestLogger || logger;
      const startTime = Date.now();
      const originalEnd = res.end;

      // Override res.end to capture response
      res.end = function (...args: unknown[]) {
        const duration = Date.now() - startTime;

        const auditEntry: AuditEntry = {
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
          requestId: req.requestId,
        };

        // Log audit entry
        requestLogger.info("Audit log", {
          action,
          resource,
          statusCode: res.statusCode,
          duration,
          userId: auditEntry.userId,
          projectId: auditEntry.projectId,
        });

        // Async log to external service
        void logAuditEntry(auditEntry);

        // Call original end - PHASE 1 TEMPORARY: Type assertion for args
        return originalEnd.apply(res, args as Parameters<typeof originalEnd>);
      };

      return await handler(req, res, context);
    };
  };
};

// Helper functions
function extractToken(req: ExtendedRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  // JWT-only auth: Never check cookies for tokens
  return null;
}

function extractProjectId(req: ExtendedRequest): string | null {
  // Check multiple sources for project ID
  return (
    (req.headers["x-project-id"] as string) ||
    (req.query.projectId as string) ||
    (req.body?.projectId as string) ||
    null
  );
}

interface AuditEntry {
  [key: string]: unknown; // PHASE 1 TEMPORARY: Make compatible with LogContext
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
  requestId?: string;
}

async function logAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    // In production, send to logging service
    if (env.NODE_ENV === "production") {
      // TODO: Implement integration with external audit service
      // Examples: CloudWatch, Datadog, Sumo Logic, etc.
      // await sendToAuditService(entry);
    } else {
      // Development logging
      logger.debug("Audit entry created", entry);
    }

    // Optional: Store critical audit logs in database
    // This would be for compliance or security-sensitive operations
    if (isCriticalOperation(entry.action)) {
      // await storeAuditInDatabase(entry);
    }
  } catch (error) {
    // Don't let audit logging failures break the main flow
    logger.error("Failed to log audit entry", error as Error);
  }
}

// Helper to identify critical operations that require persistent audit
function isCriticalOperation(action: string): boolean {
  const criticalActions = [
    "delete_user",
    "delete_project",
    "change_permissions",
    "financial_transaction",
    "export_data",
  ];
  return criticalActions.includes(action.toLowerCase());
}

// Combine multiple middleware
export const compose = (
  ...middlewares: ((handler: ApiHandler) => ApiHandler)[]
): ((handler: ApiHandler) => ApiHandler) => {
  return (handler: ApiHandler) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
};

// Pre-composed middleware for common patterns
export const withStandardMiddleware = compose(withErrorHandler, withRateLimit("standard")); // PHASE 1 TEMPORARY: Added identifier

export const withAuthenticatedRoute = compose(withErrorHandler, withRateLimit("auth"), withAuth); // PHASE 1 TEMPORARY: Added identifier

export const withProjectRoute = compose(withErrorHandler, withRateLimit("project"), withProject); // PHASE 1 TEMPORARY: Added identifier

// Export types for external use
export type { ExtendedRequest, AuditEntry };
