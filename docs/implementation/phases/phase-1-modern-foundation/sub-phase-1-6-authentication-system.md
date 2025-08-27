# Sub-Phase 1.6: Authentication System

## Overview

This sub-phase implements a comprehensive JWT-based authentication system with
refresh tokens, role-based access control (RBAC), and secure session management
optimized for serverless deployment.

## Objectives

1. Implement JWT authentication with refresh tokens
2. Create auth API endpoints (login, register, refresh, logout)
3. Setup auth store with Zustand and persistence
4. Implement protected routes with TanStack Router
5. Create role-based access control system

## Technical Requirements

### Core Dependencies

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.0",
    "jose": "^5.10.0",
    "nanoid": "^5.0.0",
    "cookie": "^1.0.0",
    "@tanstack/react-router": "^1.114.3"
  },
```

## Test-First Development Process

### Step 1: Define Test Specifications

- Agent writes comprehensive test suite based on requirements
- Tests cover expected input/output pairs for authentication system
- Include edge cases, error scenarios, and Philippine-specific requirements
- Reference test templates from `/tests/templates/`

### Step 2: Validate Tests Fail

- Run test suite to confirm all tests fail (no implementation exists)
- Command: `npm test authentication-system.test.ts`
- Expected: All tests should fail with clear error messages
- NO implementation code should be written at this stage

### Step 3: Commit Test Suite

- Tests are committed as the immutable specification
- Commit message: "test: add failing tests for authentication system"
- These tests CANNOT be modified during implementation

### Step 4: Implement Feature

- Agent writes minimal code to pass ALL tests
- Tests remain unchanged - implementation must adapt
- Use repository patterns from `/src/lib/repositories/`
- Apply dependency injection for testability

### Step 5: Independent Verification

- Different specialized agent reviews implementation
- Ensures no overfitting to test cases
- Validates general solution beyond test scenarios
- Confirms best practices and patterns are followed

## Original Technical Requirements (continued)

### Core Dependencies (continued)

```json
  "dependencies": {
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.0",
    "jose": "^5.10.0",
    "nanoid": "^5.0.0",
    "cookie": "^1.0.0",
    "@tanstack/react-router": "^1.114.3"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/cookie": "^1.0.0"
  }
}
```

## Implementation

### JWT Token Management

```typescript
// api/_lib/jwt.ts
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type { User } from "@/types/auth";

const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES = "7d";

export interface TokenPayload {
  userId: string;
  email: string;
  sessionId: string;
  tokenVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function generateTokens(user: User): AuthTokens {
  const sessionId = nanoid();

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    sessionId,
    tokenVersion: user.tokenVersion || 1,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
    issuer: "orms",
    audience: "orms-client",
    subject: user.id,
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
    issuer: "orms",
    audience: "orms-client",
    subject: user.id,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!, {
      issuer: "orms",
      audience: "orms-client",
    }) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET!, {
      issuer: "orms",
      audience: "orms-client",
    }) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}
```

### Password Hashing

```typescript
// api/_lib/password.ts
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

### Auth API Endpoints

```typescript
// api/auth/register.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import {
  compose,
  cors,
  rateLimit,
  validate,
  errorHandler,
} from "../_lib/middleware";
import { hashPassword, validatePasswordStrength } from "../_lib/password";
import { generateTokens } from "../_lib/jwt";
import { db } from "../_lib/db";
import { users } from "../_lib/db/schema";
import { ApiError } from "../_lib/errors";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
});

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    throw new ApiError(405, "Method not allowed");
  }

  const data = (req as any).validatedBody as z.infer<typeof RegisterSchema>;

  // Validate password strength
  const passwordValidation = validatePasswordStrength(data.password);
  if (!passwordValidation.isValid) {
    throw new ApiError(400, "Weak password", passwordValidation.errors);
  }

  // Check if user exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (existingUser.length > 0) {
    throw new ApiError(409, "Email already registered");
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    })
    .returning();

  // Generate tokens
  const tokens = generateTokens(newUser);

  // Set refresh token as httpOnly cookie
  res.setHeader(
    "Set-Cookie",
    `refreshToken=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}`
  );

  return res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    },
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
  });
}

export default compose(
  errorHandler,
  cors,
  rateLimit,
  validate(RegisterSchema)
)(handler);
```

```typescript
// api/auth/login.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import {
  compose,
  cors,
  rateLimit,
  validate,
  errorHandler,
} from "../_lib/middleware";
import { verifyPassword } from "../_lib/password";
import { generateTokens } from "../_lib/jwt";
import { db } from "../_lib/db";
import { users } from "../_lib/db/schema";
import { ApiError } from "../_lib/errors";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    throw new ApiError(405, "Method not allowed");
  }

  const data = (req as any).validatedBody as z.infer<typeof LoginSchema>;

  // Find user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Verify password
  const isValidPassword = await verifyPassword(
    data.password,
    user.passwordHash
  );
  if (!isValidPassword) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Check if account is active
  if (!user.isActive) {
    throw new ApiError(403, "Account is disabled");
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id));

  // Generate tokens
  const tokens = generateTokens(user);

  // Set refresh token as httpOnly cookie
  res.setHeader(
    "Set-Cookie",
    `refreshToken=${tokens.refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${7 * 24 * 60 * 60}`
  );

  return res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
  });
}

export default compose(
  errorHandler,
  cors,
  rateLimit,
  validate(LoginSchema)
)(handler);
```

### Frontend Auth Store

```typescript
// src/stores/authStore.ts
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { authApi } from '@/api/auth'
import type { User, AuthTokens, LoginCredentials, RegisterData } from '@/types/auth'

interface AuthState {
  user: User | null
  accessToken: string | null
  expiresAt: number | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  setAccessToken: (token: string, expiresIn: number) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState & AuthActions>()(n  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // State
          user: null,
          accessToken: null,
          expiresAt: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,

          // Actions
          login: async (credentials) => {
            set((state) => {
              state.isLoading = true
              state.error = null
            })

            try {
              const response = await authApi.login(credentials)

              set((state) => {
                state.user = response.user
                state.accessToken = response.accessToken
                state.expiresAt = Date.now() + response.expiresIn * 1000
                state.isAuthenticated = true
                state.isLoading = false
              })

              // Setup token refresh
              get().scheduleTokenRefresh()
            } catch (error) {
              set((state) => {
                state.error = error instanceof Error ? error.message : 'Login failed'
                state.isLoading = false
              })
              throw error
            }
          },

          register: async (data) => {
            set((state) => {
              state.isLoading = true
              state.error = null
            })

            try {
              const response = await authApi.register(data)

              set((state) => {
                state.user = response.user
                state.accessToken = response.accessToken
                state.expiresAt = Date.now() + response.expiresIn * 1000
                state.isAuthenticated = true
                state.isLoading = false
              })

              // Setup token refresh
              get().scheduleTokenRefresh()
            } catch (error) {
              set((state) => {
                state.error = error instanceof Error ? error.message : 'Registration failed'
                state.isLoading = false
              })
              throw error
            }
          },

          logout: async () => {
            try {
              await authApi.logout()
            } catch {
              // Ignore logout errors
            } finally {
              get().clearAuth()
            }
          },

          refreshToken: async () => {
            try {
              const response = await authApi.refresh()

              set((state) => {
                state.accessToken = response.accessToken
                state.expiresAt = Date.now() + response.expiresIn * 1000
              })

              // Reschedule next refresh
              get().scheduleTokenRefresh()
            } catch (error) {
              // If refresh fails, clear auth
              get().clearAuth()
            }
          },

          setAccessToken: (token, expiresIn) => {
            set((state) => {
              state.accessToken = token
              state.expiresAt = Date.now() + expiresIn * 1000
            })
          },

          clearAuth: () => {
            set((state) => {
              state.user = null
              state.accessToken = null
              state.expiresAt = null
              state.isAuthenticated = false
              state.error = null
            })
          },

          // Helper method (not in interface)
          scheduleTokenRefresh: () => {
            const { expiresAt } = get()
            if (!expiresAt) return

            // Refresh 1 minute before expiry
            const refreshTime = expiresAt - Date.now() - 60000

            if (refreshTime > 0) {
              setTimeout(() => {
                get().refreshToken()
              }, refreshTime)
            }
          },
        }))
      ),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          expiresAt: state.expiresAt,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'AuthStore',
    }
  )
)

// Selectors
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useAccessToken = () => useAuthStore((state) => state.accessToken)
```

### Protected Routes

```typescript
// src/routes/_auth.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'

export const Route = createFileRoute('/_auth')({{
  beforeLoad: async ({ location }) => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated

    if (!isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
})
```

```typescript
// src/routes/dashboard/_layout.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/stores/authStore'

export const Route = createFileRoute('/dashboard/_layout')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const user = useAuthStore((state) => state.user)

  if (!user) {
    return null // or redirect
  }

  return (
    <DashboardLayout user={user}>
      <Outlet />
    </DashboardLayout>
  )
}
```

### Role-Based Access Control

```typescript
// src/lib/rbac.ts
import { useAuthStore } from '@/stores/authStore'
import { useProjectStore } from '@/stores/projectStore'

export type Role = 'owner' | 'manager' | 'staff' | 'viewer'
export type Permission =
  | 'bookings.view'
  | 'bookings.create'
  | 'bookings.edit'
  | 'bookings.delete'
  | 'expenses.view'
  | 'expenses.create'
  | 'expenses.edit'
  | 'expenses.delete'
  | 'reports.view'
  | 'reports.export'
  | 'settings.view'
  | 'settings.edit'
  | 'users.view'
  | 'users.manage'

const rolePermissions: Record<Role, Permission[]> = {
  owner: [
    'bookings.view', 'bookings.create', 'bookings.edit', 'bookings.delete',
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete',
    'reports.view', 'reports.export',
    'settings.view', 'settings.edit',
    'users.view', 'users.manage',
  ],
  manager: [
    'bookings.view', 'bookings.create', 'bookings.edit',
    'expenses.view', 'expenses.create', 'expenses.edit',
    'reports.view', 'reports.export',
    'settings.view',
    'users.view',
  ],
  staff: [
    'bookings.view', 'bookings.create',
    'expenses.view', 'expenses.create',
    'reports.view',
  ],
  viewer: [
    'bookings.view',
    'expenses.view',
    'reports.view',
  ],
}

export function usePermissions() {
  const user = useAuthStore((state) => state.user)
  const currentProject = useProjectStore((state) => state.currentProject)

  if (!user || !currentProject) {
    return {
      role: null,
      permissions: [],
      hasPermission: () => false,
      hasRole: () => false,
    }
  }

  // Get user's role for current project
  const userRole = currentProject.userRole || 'viewer'
  const permissions = rolePermissions[userRole] || []

  return {
    role: userRole,
    permissions,
    hasPermission: (permission: Permission) => permissions.includes(permission),
    hasRole: (role: Role) => {
      const roleHierarchy = ['viewer', 'staff', 'manager', 'owner']
      const userIndex = roleHierarchy.indexOf(userRole)
      const requiredIndex = roleHierarchy.indexOf(role)
      return userIndex >= requiredIndex
    },
  }
}

export function ProtectedComponent({
  permission,
  role,
  children,
  fallback = null,
}: {
  permission?: Permission
  role?: Role
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { hasPermission, hasRole } = usePermissions()

  const canAccess = permission
    ? hasPermission(permission)
    : role
    ? hasRole(role)
    : false

  return canAccess ? <>{children}</> : <>{fallback}</>
}
```

## Type Definitions

### Auth Types

```typescript
// src/types/auth.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profileImageUrl?: string;
  tokenVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
}
```

## Test Requirements

### Auth Flow Testing

```typescript
// tests/auth/auth-flow.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/api/auth";

describe("Authentication Flow", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  describe("Login", () => {
    it("logs in successfully", async () => {
      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login({
          email: "test@example.com",
          password: "Test123!@#",
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toBeDefined();
      expect(result.current.accessToken).toBeDefined();
    });

    it("handles invalid credentials", async () => {
      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login({
            email: "wrong@example.com",
            password: "wrong",
          });
        })
      ).rejects.toThrow();

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeDefined();
    });
  });

  describe("Token Refresh", () => {
    it("refreshes token before expiry", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial auth state
      act(() => {
        result.current.setAccessToken("initial-token", 900); // 15 minutes
      });

      // Fast-forward time
      vi.useFakeTimers();
      vi.advanceTimersByTime(14 * 60 * 1000); // 14 minutes

      await waitFor(() => {
        expect(authApi.refresh).toHaveBeenCalled();
      });

      vi.useRealTimers();
    });
  });

  describe("Logout", () => {
    it("clears auth state on logout", async () => {
      const { result } = renderHook(() => useAuthStore());

      // Set authenticated state
      act(() => {
        useAuthStore.setState({
          user: { id: "1", email: "test@example.com" },
          accessToken: "token",
          isAuthenticated: true,
        });
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
    });
  });
});
```

## Agent Validation Checklist

### security-compliance-auditor Validation

- [ ] JWT secrets properly configured and secure
- [ ] Password hashing using bcrypt with sufficient rounds
- [ ] Refresh tokens stored as httpOnly cookies
- [ ] CSRF protection implemented
- [ ] Rate limiting on auth endpoints
- [ ] Session management secure
- [ ] Token expiry and refresh logic correct
- [ ] Audit logging for auth events

### vercel-resort-api-architect Validation

- [ ] Auth endpoints optimized for serverless
- [ ] Token verification efficient
- [ ] Database queries for auth optimized
- [ ] Error handling comprehensive
- [ ] CORS properly configured
- [ ] Cookie settings appropriate for production
- [ ] Response formats consistent
- [ ] Middleware chain efficient

## Success Criteria

1. **JWT Auth** - Access and refresh tokens working
2. **Registration** - New users can register with validation
3. **Login** - Users can login with credentials
4. **Token Refresh** - Automatic token refresh before expiry
5. **Protected Routes** - Unauthorized access prevented
6. **RBAC** - Role-based permissions enforced
7. **Security** - All OWASP best practices followed
8. **Performance** - Auth operations < 200ms

## Deliverables

- [ ] JWT token generation and validation
- [ ] Complete auth API endpoints
- [ ] Auth store with persistence
- [ ] Protected route implementation
- [ ] RBAC system functional
- [ ] Password strength validation
- [ ] Token refresh mechanism
- [ ] Comprehensive auth tests

## Completion Checklist

- [ ] All auth endpoints implemented
- [ ] JWT tokens properly configured
- [ ] Auth store managing state correctly
- [ ] Protected routes working
- [ ] RBAC permissions enforced
- [ ] Token refresh automatic
- [ ] Security best practices followed
- [ ] All tests passing
- [ ] Agent validations passed
- [ ] Ready for Sub-Phase 1.7

---

_Sub-Phase 1.6 implements a secure, scalable authentication system with JWT
tokens, RBAC, and serverless optimization._
