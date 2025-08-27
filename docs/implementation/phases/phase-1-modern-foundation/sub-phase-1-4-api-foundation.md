# Sub-Phase 1.4: Serverless API Foundation

## Overview

This sub-phase establishes the serverless API architecture using Vercel API
Routes. It implements a robust middleware stack for authentication, validation,
error handling, and database connectivity optimized for serverless environments.

## Objectives

1. Setup Vercel API routes structure with TypeScript
2. Implement comprehensive middleware architecture
3. Create database connection utilities for serverless
4. Establish error handling and logging patterns
5. Configure environment variables and secrets management

## Technical Requirements

### Core Dependencies

```json
{
  "dependencies": {
    "@neondatabase/serverless": "^0.10.0",
    "@vercel/postgres": "^0.10.0",
```

## Test-First Development Process

### Step 1: Define Test Specifications

- Agent writes comprehensive test suite based on requirements
- Tests cover expected input/output pairs for serverless API foundation
- Include edge cases, error scenarios, and Philippine-specific requirements
- Reference test templates from `/tests/templates/`

### Step 2: Validate Tests Fail

- Run test suite to confirm all tests fail (no implementation exists)
- Command: `npm test api-foundation.test.ts`
- Expected: All tests should fail with clear error messages
- NO implementation code should be written at this stage

### Step 3: Commit Test Suite

- Tests are committed as the immutable specification
- Commit message: "test: add failing tests for serverless API foundation"
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
    "@neondatabase/serverless": "^0.10.0",
    "@vercel/postgres": "^0.10.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.0",
    "zod": "^3.24.0",
    "cors": "^2.8.0",
    "rate-limiter-flexible": "^5.0.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/cors": "^2.8.0",
    "@vercel/node": "^3.2.0"
  }
}
```

### API Route Structure

```
api/
├── _lib/                      # Shared utilities
│   ├── auth.ts               # Auth middleware
│   ├── db.ts                  # Database connection
│   ├── errors.ts              # Error handling
│   ├── middleware.ts          # Middleware chain
│   ├── validation.ts          # Request validation
│   └── response.ts            # Response helpers
├── auth/
│   ├── login.ts               # POST /api/auth/login
│   ├── register.ts            # POST /api/auth/register
│   ├── refresh.ts             # POST /api/auth/refresh
│   ├── logout.ts              # POST /api/auth/logout
│   └── me.ts                  # GET /api/auth/me
├── projects/
│   ├── index.ts               # GET, POST /api/projects
│   └── [id]/
│       ├── index.ts           # GET, PUT, DELETE /api/projects/[id]
│       └── users.ts           # GET, POST /api/projects/[id]/users
└── [projectId]/               # Project-scoped routes
    ├── bookings/
    │   ├── index.ts           # GET, POST
    │   └── [id].ts            # GET, PUT, DELETE
    ├── expenses/
    │   ├── index.ts           # GET, POST
    │   └── [id].ts            # GET, PUT, DELETE
    └── dashboard.ts           # GET dashboard data
```

## Implementation

### Database Connection Manager

```typescript
// api/_lib/db.ts
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Configure for Vercel Edge Runtime
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

let globalDb: ReturnType<typeof neon> | undefined;
let globalPool: Pool | undefined;
let globalPrisma: PrismaClient | undefined;

export function getDb() {
  if (!globalDb) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured");
    }

    globalDb = neon(process.env.DATABASE_URL, {
      fetchOptions: {
        priority: "high",
      },
    });
  }
  return globalDb;
}

export function getPool() {
  if (!globalPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not configured");
    }

    globalPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // Minimal for serverless
    });
  }
  return globalPool;
}

export function getPrisma() {
  if (!globalPrisma) {
    const pool = getPool();
    const adapter = new PrismaNeon(pool);

    globalPrisma = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }
  return globalPrisma;
}

// Project-scoped query helper
export function createProjectDb(projectId: string) {
  const sql = getDb();
  const schemaName = `project_${projectId.replace(/[^a-z0-9_]/gi, "_")}`;

  return {
    query: async <T = any>(query: string, params: any[] = []): Promise<T[]> => {
      // Prefix tables with schema
      const prefixedQuery = query.replace(
        /FROM\s+(\w+)/gi,
        `FROM ${schemaName}.$1`
      );
      return sql(prefixedQuery, params) as Promise<T[]>;
    },

    execute: async (query: string, params: any[] = []) => {
      const prefixedQuery = query
        .replace(/INTO\s+(\w+)/gi, `INTO ${schemaName}.$1`)
        .replace(/UPDATE\s+(\w+)/gi, `UPDATE ${schemaName}.$1`);
      return sql(prefixedQuery, params);
    },
  };
}
```

### Middleware Architecture

```typescript
// api/_lib/middleware.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { RateLimiterMemory } from 'rate-limiter-flexible'

export type Handler = (
  req: VercelRequest,
  res: VercelResponse
) => Promise<void | VercelResponse>

export type Middleware = (
  handler: Handler
) => Handler

// Compose multiple middleware
export function compose(...middleware: Middleware[]): Middleware {
  return (handler: Handler) => {
    return middleware.reduceRight(
      (acc, mid) => mid(acc),
      handler
    )
  }
}

// CORS middleware
export const cors: Middleware = (handler) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  return handler(req, res)
}

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 60, // Per minute
})

export const rateLimit: Middleware = (handler) => async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
    await rateLimiter.consume(String(ip))
    return handler(req, res)
  } catch (error) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
    })
  }
}

// Authentication middleware
export const authenticate: Middleware = (handler) => async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any

    // Attach user to request
    (req as any).user = {
      id: decoded.userId,
      email: decoded.email,
    }

    return handler(req, res)
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
    })
  }
}

// Validation middleware factory
export function validate<T extends z.ZodType>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
): Middleware {
  return (handler) => async (req, res) => {
    try {
      const data = source === 'body'
        ? req.body
        : source === 'query'
        ? req.query
        : (req as any).params

      const validated = await schema.parseAsync(data)

      // Attach validated data to request
      (req as any)[`validated${source.charAt(0).toUpperCase() + source.slice(1)}`] = validated

      return handler(req, res)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          details: error.errors,
        })
      }
      throw error
    }
  }
}

// Error handling middleware
export const errorHandler: Middleware = (handler) => async (req, res) => {
  try {
    return await handler(req, res)
  } catch (error) {
    console.error('API Error:', error)

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        error: error.name,
        message: error.message,
        details: error.details,
      })
    }

    return res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : 'Something went wrong',
    })
  }
}

// Custom error class
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
```

### API Route Example

```typescript
// api/[projectId]/bookings/index.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import {
  compose,
  cors,
  rateLimit,
  authenticate,
  validate,
  errorHandler,
} from "../../_lib/middleware";
import { createProjectDb } from "../../_lib/db";
import { checkProjectAccess } from "../../_lib/auth";
import { ApiError } from "../../_lib/errors";

const CreateBookingSchema = z.object({
  guestName: z.string().min(1).max(200),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  checkinDate: z.string().datetime(),
  checkoutDate: z.string().datetime(),
  guestCount: z.number().int().min(1),
  totalAmount: z.number().positive(),
  source: z.enum(["airbnb", "facebook", "direct"]),
  bookingReference: z.string(),
});

const QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
  source: z.enum(["airbnb", "facebook", "direct"]).optional(),
});

async function handler(req: VercelRequest, res: VercelResponse) {
  const { projectId } = req.query as { projectId: string };
  const user = (req as any).user;

  // Check project access
  const hasAccess = await checkProjectAccess(user.id, projectId);
  if (!hasAccess) {
    throw new ApiError(403, "Access denied to this project");
  }

  const db = createProjectDb(projectId);

  switch (req.method) {
    case "GET": {
      const query = (req as any).validatedQuery as z.infer<typeof QuerySchema>;
      const { page, limit, status, source } = query;
      const offset = (page - 1) * limit;

      let whereClause = "WHERE 1=1";
      const params: any[] = [];

      if (status) {
        params.push(status);
        whereClause += ` AND booking_status = $${params.length}`;
      }

      if (source) {
        params.push(source);
        whereClause += ` AND source = $${params.length}`;
      }

      params.push(limit, offset);

      const bookings = await db.query(
        `
        SELECT * FROM bookings
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `,
        params
      );

      const [{ count }] = await db.query<{ count: number }>(
        `
        SELECT COUNT(*) as count FROM bookings ${whereClause}
      `,
        params.slice(0, -2)
      );

      return res.status(200).json({
        data: bookings,
        meta: {
          page,
          limit,
          total: Number(count),
          totalPages: Math.ceil(Number(count) / limit),
          hasMore: page * limit < Number(count),
        },
      });
    }

    case "POST": {
      const data = (req as any).validatedBody as z.infer<
        typeof CreateBookingSchema
      >;

      const [booking] = await db.query(
        `
        INSERT INTO bookings (
          guest_name, guest_email, guest_phone,
          checkin_date, checkout_date, guest_count,
          total_amount, source, booking_reference,
          booking_status, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          'pending', $10, NOW(), NOW()
        )
        RETURNING *
      `,
        [
          data.guestName,
          data.guestEmail,
          data.guestPhone,
          data.checkinDate,
          data.checkoutDate,
          data.guestCount,
          data.totalAmount,
          data.source,
          data.bookingReference,
          user.id,
        ]
      );

      return res.status(201).json({ data: booking });
    }

    default:
      return res.status(405).json({
        error: "Method Not Allowed",
        message: `Method ${req.method} not supported`,
      });
  }
}

// Apply middleware and export
export default compose(errorHandler, cors, rateLimit, authenticate, (req) =>
  req.method === "GET"
    ? validate(QuerySchema, "query")(req)
    : req.method === "POST"
      ? validate(CreateBookingSchema, "body")(req)
      : req
)(handler);
```

### Response Helpers

```typescript
// api/_lib/response.ts
import type { VercelResponse } from "@vercel/node";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

export function sendSuccess<T>(
  res: VercelResponse,
  data: T,
  meta?: ApiResponse["meta"],
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

export function sendError(
  res: VercelResponse,
  code: string,
  message: string,
  statusCode = 400,
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}

export function sendValidationError(res: VercelResponse, errors: any) {
  return sendError(
    res,
    "VALIDATION_ERROR",
    "Invalid request data",
    400,
    errors
  );
}

export function sendUnauthorized(
  res: VercelResponse,
  message = "Unauthorized access"
) {
  return sendError(res, "UNAUTHORIZED", message, 401);
}

export function sendForbidden(
  res: VercelResponse,
  message = "Access forbidden"
) {
  return sendError(res, "FORBIDDEN", message, 403);
}

export function sendNotFound(res: VercelResponse, resource = "Resource") {
  return sendError(res, "NOT_FOUND", `${resource} not found`, 404);
}
```

## Type Definitions

### API Types

```typescript
// src/types/api.ts
export interface ApiRequest extends VercelRequest {
  user?: {
    id: string;
    email: string;
  };
  validatedBody?: any;
  validatedQuery?: any;
  validatedParams?: any;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: any;
  timestamp?: string;
  path?: string;
}
```

## Test Requirements

### API Route Testing

```typescript
// tests/api/bookings.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { createMocks } from "node-mocks-http";
import handler from "@/api/[projectId]/bookings/index";

describe("Bookings API", () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup auth token for tests
    authToken = "test-jwt-token";
  });

  describe("GET /api/[projectId]/bookings", () => {
    it("returns paginated bookings", async () => {
      const { req, res } = createMocks({
        method: "GET",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        query: {
          projectId: "test-project",
          page: "1",
          limit: "10",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toHaveProperty("data");
      expect(data).toHaveProperty("meta");
      expect(Array.isArray(data.data)).toBe(true);
    });

    it("requires authentication", async () => {
      const { req, res } = createMocks({
        method: "GET",
        query: {
          projectId: "test-project",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
    });
  });

  describe("POST /api/[projectId]/bookings", () => {
    it("creates a new booking", async () => {
      const { req, res } = createMocks({
        method: "POST",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        query: {
          projectId: "test-project",
        },
        body: {
          guestName: "John Doe",
          guestEmail: "john@example.com",
          checkinDate: "2025-02-01T14:00:00Z",
          checkoutDate: "2025-02-03T11:00:00Z",
          guestCount: 2,
          totalAmount: 5000,
          source: "direct",
          bookingReference: "BOOK-001",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(201);
      const data = JSON.parse(res._getData());
      expect(data.data).toHaveProperty("id");
      expect(data.data.guest_name).toBe("John Doe");
    });

    it("validates request body", async () => {
      const { req, res } = createMocks({
        method: "POST",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        query: {
          projectId: "test-project",
        },
        body: {
          // Missing required fields
          guestName: "John Doe",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe("Validation Error");
    });
  });
});
```

## Agent Validation Checklist

### tanstack-router-expert Validation

- [ ] TanStack Router properly configured for file-based routing
- [ ] Route guards implemented for protected routes
- [ ] Data loading patterns optimized
- [ ] Search params handling configured
- [ ] Nested layouts correctly structured
- [ ] Route prefetching enabled
- [ ] Error boundaries set up
- [ ] Type-safe routing established

### vercel-resort-api-architect Validation

- [ ] API routes properly structured for Vercel
- [ ] Serverless functions optimized for cold starts
- [ ] Database connections pooled correctly
- [ ] Multi-tenant isolation implemented
- [ ] File upload handling configured
- [ ] CORS and security headers set
- [ ] Rate limiting implemented
- [ ] Error handling comprehensive

### serverless-saas-architect Validation

- [ ] Serverless patterns correctly implemented
- [ ] Connection pooling optimized
- [ ] Cold start mitigation strategies
- [ ] Cost-efficient query patterns
- [ ] Proper use of edge functions
- [ ] Caching strategies defined
- [ ] Multi-tenant architecture secure
- [ ] Monitoring and logging setup

## Success Criteria

1. **API Structure** - All routes organized and typed
2. **Middleware** - Complete middleware stack operational
3. **Database** - Serverless connections working
4. **Authentication** - JWT auth fully functional
5. **Validation** - Zod schemas for all endpoints
6. **Error Handling** - Consistent error responses
7. **Performance** - Cold starts < 500ms
8. **Security** - Rate limiting and CORS configured

## Deliverables

- [ ] Complete API route structure
- [ ] Middleware architecture implemented
- [ ] Database connection utilities
- [ ] Authentication and authorization
- [ ] Request validation with Zod
- [ ] Error handling patterns
- [ ] Response helpers and types
- [ ] Comprehensive API tests

## Completion Checklist

- [ ] All API routes created and typed
- [ ] Middleware chain functioning
- [ ] Database connections optimized
- [ ] Auth middleware working
- [ ] Validation schemas complete
- [ ] Error handling consistent
- [ ] Rate limiting active
- [ ] All tests passing
- [ ] Agent validations passed
- [ ] Ready for Sub-Phase 1.5

---

_Sub-Phase 1.4 establishes a robust, serverless API foundation optimized for
performance, security, and scalability._
