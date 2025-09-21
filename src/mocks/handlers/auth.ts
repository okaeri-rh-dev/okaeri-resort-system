/**
 * Authentication API Handlers
 * MSW handlers for authentication endpoints using IndexedDB backend
 */

import { http, HttpResponse } from "msw";
import { mockDatabase } from "../db/mock-database";
import { mockCredentials } from "../db/seeders";
import type { User } from "@/types/common";

/**
 * Mock JWT token utilities
 */
class MockJWT {
  static generateToken(userId: string, role: string, expiresInSeconds: number = 3600): string {
    const header = btoa(JSON.stringify({ typ: "JWT", alg: "HS256" }));
    const payload = btoa(
      JSON.stringify({
        sub: userId,
        role,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        iat: Math.floor(Date.now() / 1000),
        iss: "okaeri-mock-api",
      })
    );
    const signature = btoa(`mock-signature-${userId}-${Date.now()}`);
    return `${header}.${payload}.${signature}`;
  }

  static generateRefreshToken(userId: string): string {
    return `refresh_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static validateToken(token: string): { valid: boolean; userId?: string; role?: string } {
    try {
      const [header, payload, signature] = token.split(".");
      if (!header || !payload || !signature) {
        return { valid: false };
      }

      const decodedPayload = JSON.parse(atob(payload));
      const now = Math.floor(Date.now() / 1000);

      if (decodedPayload.exp && decodedPayload.exp < now) {
        return { valid: false };
      }

      return {
        valid: true,
        userId: decodedPayload.sub,
        role: decodedPayload.role,
      };
    } catch {
      return { valid: false };
    }
  }
}

/**
 * Rate limiting utilities
 */
class RateLimiter {
  static async checkRateLimit(
    key: string,
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000 // 15 minutes
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const resetAt = now + windowMs;

    // Get current rate limit data (implementation would use IndexedDB)
    // For now, we'll use a simple in-memory approach
    const rateLimitKey = `rate_limit_${key}`;
    const stored = localStorage.getItem(rateLimitKey);

    let attempts = 0;
    let windowStart = now;

    if (stored) {
      const data = JSON.parse(stored);
      if (data.resetAt > now) {
        attempts = data.attempts;
        windowStart = data.windowStart;
      }
    }

    if (attempts >= maxAttempts) {
      const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment attempts
    localStorage.setItem(
      rateLimitKey,
      JSON.stringify({
        attempts: attempts + 1,
        windowStart,
        resetAt,
      })
    );

    return { allowed: true };
  }

  static clearRateLimit(key: string): void {
    const rateLimitKey = `rate_limit_${key}`;
    localStorage.removeItem(rateLimitKey);
  }
}

/**
 * Simulate network delay
 */
async function simulateDelay(minMs: number = 100, maxMs: number = 500): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

const API_BASE_URL = "/api";

export const authHandlers = [
  // Login endpoint
  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    await simulateDelay();

    try {
      const { email, password } = (await request.json()) as {
        email: string;
        password: string;
      };

      // Rate limiting
      const rateLimit = await RateLimiter.checkRateLimit(`login:${email}`, 5, 15 * 60 * 1000);
      if (!rateLimit.allowed) {
        return HttpResponse.json(
          {
            error: "Too many login attempts",
            message: `Please try again in ${rateLimit.retryAfter} seconds`,
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        );
      }

      // Find user by email
      const user = await mockDatabase.getUserByEmail(email);
      if (!user) {
        await simulateDelay(500, 1000); // Security delay for failed attempts
        return HttpResponse.json(
          {
            error: "Authentication failed",
            message: "Invalid email or password",
          },
          { status: 401 }
        );
      }

      // Check password (in real app, this would be hashed)
      const expectedPassword = mockCredentials[email];
      if (!expectedPassword || password !== expectedPassword) {
        await simulateDelay(500, 1000); // Security delay for failed attempts
        return HttpResponse.json(
          {
            error: "Authentication failed",
            message: "Invalid email or password",
          },
          { status: 401 }
        );
      }

      // Generate tokens
      const token = MockJWT.generateToken(user.id, user.role, 3600); // 1 hour
      const refreshToken = MockJWT.generateRefreshToken(user.id);

      // Clear rate limit on successful login
      RateLimiter.clearRateLimit(`login:${email}`);

      // Update last login
      await mockDatabase.updateUser(user.id, {
        lastLogin: new Date().toISOString(),
      });

      return HttpResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
        },
        token,
        refreshToken,
        expiresIn: 3600,
      });
    } catch (error) {
      console.error("[Auth Handler] Login error:", error);
      return HttpResponse.json(
        {
          error: "Internal server error",
          message: "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  }),

  // Get current user
  http.get(`${API_BASE_URL}/auth/me`, async ({ request }) => {
    await simulateDelay(50, 200);

    try {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return HttpResponse.json(
          {
            error: "Authentication required",
            message: "No valid authentication token provided",
          },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const validation = MockJWT.validateToken(token);

      if (!validation.valid || !validation.userId) {
        return HttpResponse.json(
          {
            error: "Invalid token",
            message: "Authentication token is invalid or expired",
          },
          { status: 401 }
        );
      }

      const user = await mockDatabase.getUserById(validation.userId);
      if (!user) {
        return HttpResponse.json(
          {
            error: "User not found",
            message: "User account no longer exists",
          },
          { status: 404 }
        );
      }

      return HttpResponse.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
      });
    } catch (error) {
      console.error("[Auth Handler] Get user error:", error);
      return HttpResponse.json(
        {
          error: "Internal server error",
          message: "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  }),

  // Refresh token
  http.post(`${API_BASE_URL}/auth/refresh`, async ({ request }) => {
    await simulateDelay();

    try {
      const { refreshToken } = (await request.json()) as { refreshToken: string };

      if (!refreshToken || !refreshToken.startsWith("refresh_")) {
        return HttpResponse.json(
          {
            error: "Invalid refresh token",
            message: "Refresh token is missing or invalid",
          },
          { status: 401 }
        );
      }

      // Extract user ID from refresh token
      const tokenParts = refreshToken.split("_");
      if (tokenParts.length < 3) {
        return HttpResponse.json(
          {
            error: "Invalid refresh token",
            message: "Refresh token format is invalid",
          },
          { status: 401 }
        );
      }

      const userId = tokenParts[1];
      const user = await mockDatabase.getUserById(userId);

      if (!user) {
        return HttpResponse.json(
          {
            error: "User not found",
            message: "User account no longer exists",
          },
          { status: 404 }
        );
      }

      // Generate new tokens
      const newToken = MockJWT.generateToken(user.id, user.role, 3600);
      const newRefreshToken = MockJWT.generateRefreshToken(user.id);

      return HttpResponse.json({
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600,
      });
    } catch (error) {
      console.error("[Auth Handler] Refresh token error:", error);
      return HttpResponse.json(
        {
          error: "Internal server error",
          message: "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  }),

  // Logout
  http.post(`${API_BASE_URL}/auth/logout`, async ({ request }) => {
    await simulateDelay(50, 150);

    // In a real implementation, we would invalidate the token server-side
    // For mock purposes, we just return success
    return HttpResponse.json({
      message: "Logged out successfully",
    });
  }),

  // Password reset request
  http.post(`${API_BASE_URL}/auth/reset-password`, async ({ request }) => {
    await simulateDelay();

    try {
      const { email } = (await request.json()) as { email: string };

      // Rate limiting for password reset
      const rateLimit = await RateLimiter.checkRateLimit(
        `password-reset:${email}`,
        3,
        60 * 60 * 1000 // 1 hour
      );

      if (!rateLimit.allowed) {
        return HttpResponse.json(
          {
            error: "Too many password reset attempts",
            message: `Please try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes`,
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        );
      }

      const user = await mockDatabase.getUserByEmail(email);

      // Don't reveal whether user exists (security best practice)
      await simulateDelay(200, 800);

      return HttpResponse.json({
        message: "If an account with that email exists, a password reset link has been sent",
      });
    } catch (error) {
      console.error("[Auth Handler] Password reset error:", error);
      return HttpResponse.json(
        {
          error: "Internal server error",
          message: "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  }),

  // Update profile
  http.patch(`${API_BASE_URL}/auth/profile`, async ({ request }) => {
    await simulateDelay();

    try {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return HttpResponse.json(
          {
            error: "Authentication required",
            message: "No valid authentication token provided",
          },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const validation = MockJWT.validateToken(token);

      if (!validation.valid || !validation.userId) {
        return HttpResponse.json(
          {
            error: "Invalid token",
            message: "Authentication token is invalid or expired",
          },
          { status: 401 }
        );
      }

      const updates = (await request.json()) as Partial<User>;

      // Validate allowed updates (prevent role escalation, etc.)
      const allowedFields = ["name", "avatar"];
      const filteredUpdates: Partial<User> = {};

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          (filteredUpdates as any)[key] = (updates as any)[key];
        }
      });

      const updatedUser = await mockDatabase.updateUser(validation.userId, filteredUpdates);

      if (!updatedUser) {
        return HttpResponse.json(
          {
            error: "User not found",
            message: "User account no longer exists",
          },
          { status: 404 }
        );
      }

      return HttpResponse.json({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        updatedAt: updatedUser.updatedAt,
      });
    } catch (error) {
      console.error("[Auth Handler] Update profile error:", error);
      return HttpResponse.json(
        {
          error: "Internal server error",
          message: "An unexpected error occurred",
        },
        { status: 500 }
      );
    }
  }),
];

// Export utilities for other handlers
export { MockJWT, RateLimiter, simulateDelay };
