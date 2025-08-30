/**
 * User Factory
 * Generates test user data for consistent testing
 */

import type { User } from "@/types/common";

let userIdCounter = 1;

/**
 * User factory options
 */
export interface UserFactoryOptions {
  id?: string;
  email?: string;
  fullName?: string;
  role?: "admin" | "manager" | "staff" | "viewer";
  emailVerified?: boolean;
  phoneNumber?: string | null;
  avatar?: string;
  timezone?: string;
  language?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Create a test user with sensible defaults
 */
export function createUser(overrides?: UserFactoryOptions): User {
  const id = overrides?.id || `user-test-${userIdCounter++}`;
  const email = overrides?.email || `test${userIdCounter}@example.com`;
  const createdAt = overrides?.createdAt || new Date("2024-01-01");
  const updatedAt = overrides?.updatedAt || new Date("2024-01-01");

  return {
    id,
    email,
    name: overrides?.fullName || `Test User ${userIdCounter}`,
    role: overrides?.role || ("VIEWER" as any), // Using proper role enum
    avatar: overrides?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/**
 * Create an admin user
 */
export function createAdminUser(overrides?: UserFactoryOptions): User {
  return createUser({
    ...overrides,
    role: "ADMIN" as any,
    email: overrides?.email || "admin@test.com",
    fullName: overrides?.fullName || "Admin User",
  });
}

/**
 * Create a manager user
 */
export function createManagerUser(overrides?: UserFactoryOptions): User {
  return createUser({
    ...overrides,
    role: "MANAGER" as any,
    email: overrides?.email || "manager@test.com",
    fullName: overrides?.fullName || "Manager User",
  });
}

/**
 * Create a staff user
 */
export function createStaffUser(overrides?: UserFactoryOptions): User {
  return createUser({
    ...overrides,
    role: "STAFF" as any,
    email: overrides?.email || "staff@test.com",
    fullName: overrides?.fullName || "Staff User",
  });
}

/**
 * Create a viewer user
 */
export function createViewerUser(overrides?: UserFactoryOptions): User {
  return createUser({
    ...overrides,
    role: "VIEWER" as any,
    email: overrides?.email || "viewer@test.com",
    fullName: overrides?.fullName || "Viewer User",
  });
}

/**
 * Create an unverified user
 */
export function createUnverifiedUser(overrides?: UserFactoryOptions): User {
  return createUser({
    ...overrides,
    emailVerified: false,
    email: overrides?.email || "unverified@test.com",
    fullName: overrides?.fullName || "Unverified User",
  });
}

/**
 * Create multiple users
 */
export function createUsers(count: number, overrides?: UserFactoryOptions): User[] {
  return Array.from({ length: count }, (_, i) =>
    createUser({
      ...overrides,
      email: overrides?.email || `test${i + 1}@example.com`,
      fullName: overrides?.fullName || `Test User ${i + 1}`,
    })
  );
}

/**
 * Create a user with authentication tokens
 */
export interface AuthenticatedUser {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export function createAuthenticatedUser(userOverrides?: UserFactoryOptions): AuthenticatedUser {
  const user = createUser(userOverrides);

  return {
    user,
    token: createMockJWT(user),
    refreshToken: `refresh-${user.id}-${Date.now()}`,
    expiresIn: 3600, // 1 hour
  };
}

/**
 * Create a mock JWT token
 */
export function createMockJWT(user: User, projectId: string = "project-1"): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      projectId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  );
  const signature = btoa(`mock-signature-${user.id}`);

  return `${header}.${payload}.${signature}`;
}

/**
 * Parse a mock JWT token
 */
export function parseMockJWT(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

/**
 * Reset the user ID counter (useful between tests)
 */
export function resetUserIdCounter() {
  userIdCounter = 1;
}
