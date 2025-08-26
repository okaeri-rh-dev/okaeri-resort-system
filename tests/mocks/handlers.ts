/**
 * MSW request handlers for authentication API mocking
 * Provides realistic API responses with Philippine-specific data
 */

import { http, HttpResponse } from "msw";
import { MOCK_USERS, TEST_CONSTANTS } from "../utils/test-utils";
import type { User } from "@/types/common";

// Mock database for testing
let mockDatabase = {
  users: new Map<string, User>([
    [MOCK_USERS.OWNER.id, MOCK_USERS.OWNER],
    [MOCK_USERS.MANAGER.id, MOCK_USERS.MANAGER],
    [MOCK_USERS.STAFF.id, MOCK_USERS.STAFF],
  ]),
  sessions: new Map<string, { userId: string; expiresAt: number }>(),
  refreshTokens: new Map<string, { userId: string; expiresAt: number }>(),
  rateLimits: new Map<string, { count: number; resetAt: number }>(),
  auditLogs: [] as Array<{ event: string; userId?: string; timestamp: number; details?: any }>,
};

// Helper functions
const delay = (ms: number = 100) => new Promise((resolve) => setTimeout(resolve, ms));

const generateToken = (userId: string, role: string) => {
  const header = btoa(JSON.stringify({ typ: "JWT", alg: "HS256" }));
  const payload = btoa(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      role,
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = "mock-signature";
  return `${header}.${payload}.${signature}`;
};

const generateRefreshToken = () => {
  return `refresh_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

const isRateLimited = (key: string, limit: number = 5, windowMs: number = 300000) => {
  const now = Date.now();
  const rateLimitEntry = mockDatabase.rateLimits.get(key);

  if (!rateLimitEntry || now > rateLimitEntry.resetAt) {
    mockDatabase.rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfter: 0 };
  }

  if (rateLimitEntry.count >= limit) {
    return {
      limited: true,
      retryAfter: Math.ceil((rateLimitEntry.resetAt - now) / 1000),
    };
  }

  rateLimitEntry.count++;
  return { limited: false, retryAfter: 0 };
};

const findUserByEmail = (email: string): User | undefined => {
  return Array.from(mockDatabase.users.values()).find((user) => user.email === email);
};

export const handlers = [
  // Auth endpoints
  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login`, async ({ request }) => {
    await delay();

    const { email, password } = (await request.json()) as { email: string; password: string };

    // Check rate limiting
    const rateLimit = isRateLimited(`login:${email}`, 5, 300000);
    if (rateLimit.limited) {
      return HttpResponse.json(
        { error: "Too many login attempts", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Find user
    const user = findUserByEmail(email);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mock password validation (in real app, compare hashed passwords)
    if (password === "wrong-password") {
      return HttpResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Generate tokens
    const token = generateToken(user.id, user.role);
    const refreshToken = generateRefreshToken();

    // Store session
    mockDatabase.sessions.set(token, { userId: user.id, expiresAt: Date.now() + 3600000 });
    mockDatabase.refreshTokens.set(refreshToken, {
      userId: user.id,
      expiresAt: Date.now() + 7 * 24 * 3600000,
    });

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "LOGIN_SUCCESS",
      userId: user.id,
      timestamp: Date.now(),
      details: { email, userAgent: "test-agent" },
    });

    return HttpResponse.json({
      user,
      token,
      refreshToken,
    });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/register`, async ({ request }) => {
    await delay();

    const { email, password, name, projectName, phone } = (await request.json()) as {
      email: string;
      password: string;
      name: string;
      projectName?: string;
      phone?: string;
    };

    // Check if user already exists
    if (findUserByEmail(email)) {
      return HttpResponse.json({ error: "User already exists" }, { status: 409 });
    }

    // Check rate limiting
    const rateLimit = isRateLimited(`register:${email}`, 3, 3600000);
    if (rateLimit.limited) {
      return HttpResponse.json(
        { error: "Too many registration attempts", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    // Create new user
    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      name,
      role: "OWNER", // First user becomes owner
      phone: phone || null,
      projectId: `project-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDatabase.users.set(newUser.id, newUser);

    // Generate tokens
    const token = generateToken(newUser.id, newUser.role);
    const refreshToken = generateRefreshToken();

    // Store session
    mockDatabase.sessions.set(token, { userId: newUser.id, expiresAt: Date.now() + 3600000 });
    mockDatabase.refreshTokens.set(refreshToken, {
      userId: newUser.id,
      expiresAt: Date.now() + 7 * 24 * 3600000,
    });

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "REGISTER_SUCCESS",
      userId: newUser.id,
      timestamp: Date.now(),
      details: { email, projectName },
    });

    return HttpResponse.json({
      user: newUser,
      token,
      refreshToken,
    });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/refresh`, async ({ request }) => {
    await delay();

    const { refreshToken } = (await request.json()) as { refreshToken: string };

    // Validate refresh token
    const refreshEntry = mockDatabase.refreshTokens.get(refreshToken);
    if (!refreshEntry || Date.now() > refreshEntry.expiresAt) {
      return HttpResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    // Get user
    const user = mockDatabase.users.get(refreshEntry.userId);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate new tokens
    const newToken = generateToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken();

    // Update sessions
    mockDatabase.refreshTokens.delete(refreshToken);
    mockDatabase.sessions.set(newToken, { userId: user.id, expiresAt: Date.now() + 3600000 });
    mockDatabase.refreshTokens.set(newRefreshToken, {
      userId: user.id,
      expiresAt: Date.now() + 7 * 24 * 3600000,
    });

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "TOKEN_REFRESH_SUCCESS",
      userId: user.id,
      timestamp: Date.now(),
    });

    return HttpResponse.json({
      token: newToken,
      refreshToken: newRefreshToken,
    });
  }),

  http.get(`${TEST_CONSTANTS.API_BASE_URL}/auth/me`, async ({ request }) => {
    await delay();

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "No authorization token provided" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const session = mockDatabase.sessions.get(token);

    if (!session || Date.now() > session.expiresAt) {
      return HttpResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const user = mockDatabase.users.get(session.userId);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    return HttpResponse.json(user);
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/logout`, async ({ request }) => {
    await delay();

    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const session = mockDatabase.sessions.get(token);

      if (session) {
        // Remove session
        mockDatabase.sessions.delete(token);

        // Log audit event
        mockDatabase.auditLogs.push({
          event: "LOGOUT_SUCCESS",
          userId: session.userId,
          timestamp: Date.now(),
        });
      }
    }

    return HttpResponse.json({ message: "Logged out successfully" });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/reset-password`, async ({ request }) => {
    await delay();

    const { email } = (await request.json()) as { email: string };

    // Check rate limiting
    const rateLimit = isRateLimited(`password-reset:${email}`, 3, 3600000);
    if (rateLimit.limited) {
      return HttpResponse.json(
        { error: "Too many password reset attempts", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const user = findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return HttpResponse.json({ message: "If the email exists, a reset link has been sent" });
    }

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "PASSWORD_RESET_REQUEST",
      userId: user.id,
      timestamp: Date.now(),
      details: { email },
    });

    return HttpResponse.json({ message: "Password reset email sent" });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/update-password`, async ({ request }) => {
    await delay();

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "No authorization token provided" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const session = mockDatabase.sessions.get(token);

    if (!session || Date.now() > session.expiresAt) {
      return HttpResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword: string;
      newPassword: string;
    };

    // Mock current password validation
    if (currentPassword === "wrong-current-password") {
      return HttpResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "PASSWORD_CHANGE_SUCCESS",
      userId: session.userId,
      timestamp: Date.now(),
    });

    return HttpResponse.json({ message: "Password updated successfully" });
  }),

  http.patch(`${TEST_CONSTANTS.API_BASE_URL}/auth/profile`, async ({ request }) => {
    await delay();

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return HttpResponse.json({ error: "No authorization token provided" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const session = mockDatabase.sessions.get(token);

    if (!session || Date.now() > session.expiresAt) {
      return HttpResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const user = mockDatabase.users.get(session.userId);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates = (await request.json()) as Partial<User>;

    // Update user
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    mockDatabase.users.set(user.id, updatedUser);

    // Log audit event
    mockDatabase.auditLogs.push({
      event: "PROFILE_UPDATE_SUCCESS",
      userId: user.id,
      timestamp: Date.now(),
      details: updates,
    });

    return HttpResponse.json(updatedUser);
  }),

  // Health check endpoint
  http.get(`${TEST_CONSTANTS.API_BASE_URL}/health/check`, async () => {
    await delay(50);
    return HttpResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: "test",
    });
  }),

  // Mock error scenarios for testing
  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login-slow`, async () => {
    await delay(5000); // Simulate slow response
    return HttpResponse.json({ error: "Request timeout" }, { status: 408 });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login-server-error`, async () => {
    await delay();
    return HttpResponse.json({ error: "Internal server error" }, { status: 500 });
  }),

  http.post(`${TEST_CONSTANTS.API_BASE_URL}/auth/login-network-error`, async () => {
    // Simulate network error
    return HttpResponse.error();
  }),

  // Fallback handler for unhandled requests
  http.all("*", ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json(
      { error: `Unhandled request: ${request.method} ${request.url}` },
      { status: 404 }
    );
  }),
];

// Export mock database for testing utilities
export { mockDatabase };

// Helper functions for test setup
export const mockHelpers = {
  reset: () => {
    mockDatabase = {
      users: new Map([
        [MOCK_USERS.OWNER.id, MOCK_USERS.OWNER],
        [MOCK_USERS.MANAGER.id, MOCK_USERS.MANAGER],
        [MOCK_USERS.STAFF.id, MOCK_USERS.STAFF],
      ]),
      sessions: new Map(),
      refreshTokens: new Map(),
      rateLimits: new Map(),
      auditLogs: [],
    };
  },

  addUser: (user: User) => {
    mockDatabase.users.set(user.id, user);
  },

  removeUser: (userId: string) => {
    mockDatabase.users.delete(userId);
  },

  setRateLimit: (key: string, count: number, resetAt: number) => {
    mockDatabase.rateLimits.set(key, { count, resetAt });
  },

  getAuditLogs: () => mockDatabase.auditLogs,

  clearAuditLogs: () => {
    mockDatabase.auditLogs = [];
  },
};
