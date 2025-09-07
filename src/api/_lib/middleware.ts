/**
 * API Middleware Utilities
 * Shared authentication, rate limiting, and error handling
 */

import { NextRequest } from "next/server";
import { verify } from "jsonwebtoken";
import { z } from "zod";

// JWT payload schema
const jwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  projectId: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export interface AuthContext {
  userId: string;
  projectId: string;
  email: string;
  role: string;
}

/**
 * Extract and verify JWT from Authorization header
 */
export async function withAuth(req: NextRequest): Promise<AuthContext | null> {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET not configured");
    }

    const decoded = verify(token, secret);
    const payload = jwtPayloadSchema.parse(decoded);

    return {
      userId: payload.userId,
      projectId: payload.projectId,
      email: payload.email,
      role: payload.role,
    };
  } catch (error) {
    console.error("Auth middleware error:", error);
    return null;
  }
}

/**
 * CORS headers for API responses
 */
export function getCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Rate limiting check (requires Redis in production)
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 60,
  window: number = 60
): Promise<boolean> {
  // TODO: Implement with Upstash Redis
  // For now, always allow in development
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // In production, this would check Redis for rate limiting
  return true;
}
