---
⚠️ **REFERENCE ONLY - Not Used in Current Implementation**

The Okaeri Resort System uses **application-level filtering** with `project_id`
columns. Database queries filter data at the service layer, not through RLS
policies.

**See:** `/docs/implementation/SIMPLE_DATABASE_GUIDE.md` for the authoritative
approach.

**Why archived:** This document describes Row-Level Security patterns that were
considered but not implemented. The system uses simpler application-level
filtering that's easier to maintain and debug for a small family business.
---

# Row-Level Security (RLS) Multi-Tenant Implementation Guide

> ⚠️ **IMPORTANT**: This document describes an ADVANCED feature for FUTURE
> SCALING (10+ properties).
>
> **For 1-3 properties (current target)**: Use simple application-level
> filtering as described in
> [SIMPLE_DATABASE_GUIDE.md](./SIMPLE_DATABASE_GUIDE.md) and
> [FINANCIAL_DATABASE_SCHEMA.md](./FINANCIAL_DATABASE_SCHEMA.md).
>
> **This RLS approach is ONLY needed when**:
>
> - Managing 10+ resort properties
> - Requiring database-level isolation for compliance
> - Having dedicated database administration resources
> - Scaling beyond family business operations

> **RLS (Row-Level Security)**: A PostgreSQL feature that enables fine-grained
> access control at the row level, allowing different users to see different
> subsets of data from the same table based on security policies. Essential for
> multi-tenant applications where data isolation between tenants is critical.

## Important: Vercel Runtime Selection

**Critical**: This document contains examples for both Node.js and Edge
runtimes. Never mix response patterns within the same runtime:

- **Node.js Runtime** (default): Uses `res.status().json()` pattern with
  `VercelRequest/VercelResponse`
- **Edge Runtime**: Uses `new Response()` pattern with Web API
  `Request/Response`

Choose your runtime based on your needs:

- Use **Node.js** for: Database operations, RLS context management, complex
  business logic
- Use **Edge** for: Simple authentication checks, lightweight APIs, global
  distribution

## Overview

This document provides a secure, production-ready implementation guide for
Row-Level Security (RLS) based multi-tenancy in the Okaeri Resort Management
System. This approach provides cost-effective data isolation while preventing
data leaks between projects/tenants, even with connection pooling.

**Critical Security Note**: This implementation uses `SET LOCAL` for
transaction-scoped context to prevent session bleeding in pooled connections.

## Architecture Decision

We chose RLS over schema-per-tenant based on:

- **Cost efficiency** for small-medium Philippine resorts
- **Neon/Supabase optimization** for connection pooling
- **Simpler operations** with single schema migrations
- **Cross-tenant analytics** capability
- **Migration path** to schema-per-tenant when needed

## Database Schema Design

### Core Principles

1. **Every table includes `project_id`** column
2. **RLS policies enforce isolation** at database level with proper WITH CHECK
   constraints
3. **API sets transaction-scoped context** using SET LOCAL
4. **No direct table access** without project context
5. **Connection pooling safe** through transaction-scoped settings

### Schema Implementation

```sql
-- 1. Add project_id to all tables with NOT NULL constraint
ALTER TABLE users ADD COLUMN project_id UUID NOT NULL;
ALTER TABLE bookings ADD COLUMN project_id UUID NOT NULL;
ALTER TABLE guests ADD COLUMN project_id UUID NOT NULL;
ALTER TABLE expenses ADD COLUMN project_id UUID NOT NULL;
ALTER TABLE properties ADD COLUMN project_id UUID NOT NULL;
ALTER TABLE rooms ADD COLUMN project_id UUID NOT NULL;
ALTER TABLE payments ADD COLUMN project_id UUID NOT NULL;

-- 2. Create indexes for performance
CREATE INDEX idx_users_project_id ON users(project_id);
CREATE INDEX idx_bookings_project_id ON bookings(project_id);
CREATE INDEX idx_guests_project_id ON guests(project_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_properties_project_id ON properties(project_id);
CREATE INDEX idx_rooms_project_id ON rooms(project_id);
CREATE INDEX idx_payments_project_id ON payments(project_id);

-- 3. Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 4. Force RLS for table owners (critical for security)
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE guests FORCE ROW LEVEL SECURITY;
ALTER TABLE expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE properties FORCE ROW LEVEL SECURITY;
ALTER TABLE rooms FORCE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
```

## RLS Policy Implementation

### Secure Helper Function with Validation

```sql
-- Create secure function to get current project with validation
CREATE OR REPLACE FUNCTION current_project_id()
RETURNS UUID AS $$
DECLARE
  project_id TEXT;
BEGIN
  -- Use 'true' flag to return NULL instead of throwing error
  project_id := current_setting('app.current_project', true);

  -- Return NULL if not set (will cause RLS to deny access)
  IF project_id IS NULL OR project_id = '' THEN
    RETURN NULL;
  END IF;

  -- Validate UUID format to prevent injection
  BEGIN
    RETURN project_id::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create function for user context
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
DECLARE
  user_id TEXT;
BEGIN
  user_id := current_setting('app.current_user', true);

  IF user_id IS NULL OR user_id = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN user_id::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### Standard Tenant Isolation Policies

```sql
-- Template for all tables (using bookings as example)
-- DROP existing policies first
DROP POLICY IF EXISTS project_isolation_select ON bookings;
DROP POLICY IF EXISTS project_isolation_insert ON bookings;
DROP POLICY IF EXISTS project_isolation_update ON bookings;
DROP POLICY IF EXISTS project_isolation_delete ON bookings;

-- SELECT: Can only see records from current project
CREATE POLICY project_isolation_select ON bookings
  FOR SELECT
  USING (project_id = current_project_id());

-- INSERT: Can only insert with current project_id
CREATE POLICY project_isolation_insert ON bookings
  FOR INSERT
  WITH CHECK (project_id = current_project_id());

-- UPDATE: Can only update records from current project and maintain project_id
CREATE POLICY project_isolation_update ON bookings
  FOR UPDATE
  USING (project_id = current_project_id())
  WITH CHECK (project_id = current_project_id());

-- DELETE: Can only delete records from current project
CREATE POLICY project_isolation_delete ON bookings
  FOR DELETE
  USING (project_id = current_project_id());
```

### Admin Override Policy with Proper Constraints

```sql
-- Drop existing admin policies
DROP POLICY IF EXISTS admin_bypass ON bookings;

-- Admin SELECT policy
CREATE POLICY admin_select_all ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = current_user_id()
        AND users.role = 'super_admin'
        AND users.is_active = true
    )
  );

-- Admin INSERT policy - must still provide valid project_id
CREATE POLICY admin_insert ON bookings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = current_user_id()
        AND users.role = 'super_admin'
        AND users.is_active = true
    )
    AND project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_id
        AND projects.is_active = true
    )
  );

-- Admin UPDATE policy - cannot change project_id
CREATE POLICY admin_update ON bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = current_user_id()
        AND users.role = 'super_admin'
        AND users.is_active = true
    )
  )
  WITH CHECK (
    -- Ensure project_id doesn't change
    project_id = (SELECT project_id FROM bookings WHERE id = bookings.id)
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = current_user_id()
        AND users.role = 'super_admin'
        AND users.is_active = true
    )
  );

-- Admin DELETE policy
CREATE POLICY admin_delete ON bookings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = current_user_id()
        AND users.role = 'super_admin'
        AND users.is_active = true
    )
  );
```

## Connection Pooling Safe Implementation

### Transaction-Scoped Context (SET LOCAL)

```typescript
// api/_lib/db/context.ts
import { db } from "./connection";
import { sql } from "drizzle-orm";

/**
 * Sets project context using SET LOCAL for transaction safety.
 * This ensures context doesn't bleed across pooled connections.
 */
export async function executeWithProjectContext<T>(
  projectId: string,
  userId: string,
  operation: () => Promise<T>
): Promise<T> {
  // Validate inputs
  if (!isValidUUID(projectId)) {
    throw new Error("Invalid project ID format");
  }
  if (!isValidUUID(userId)) {
    throw new Error("Invalid user ID format");
  }

  return await db.transaction(async (tx) => {
    // SET LOCAL only affects this transaction
    await tx.execute(
      sql`SELECT set_config('app.current_project', ${projectId}, true)`
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user', ${userId}, true)`
    );

    // Execute the actual operation within the transaction
    return await operation();
  });
}

/**
 * UUID validation helper
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * For read operations that don't need transaction
 */
export async function setTransactionLocalContext(
  tx: any,
  projectId: string,
  userId: string
): Promise<void> {
  // Validate before setting
  if (!isValidUUID(projectId) || !isValidUUID(userId)) {
    throw new Error("Invalid context parameters");
  }

  await tx.execute(
    sql`SELECT set_config('app.current_project', ${projectId}, true)`
  );
  await tx.execute(sql`SELECT set_config('app.current_user', ${userId}, true)`);
}
```

### API Middleware with Transaction Scope

#### Node.js Runtime Middleware

```typescript
// api/_lib/middleware/tenant-context.ts
// For Node.js runtime (default)
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "../auth";
import { executeWithProjectContext } from "../db/context";
import { db } from "../db/connection";
import { sql } from "drizzle-orm";

export async function withTenantContext(
  req: VercelRequest,
  res: VercelResponse,
  handler: (
    req: VercelRequest,
    res: VercelResponse,
    projectId: string,
    userId: string
  ) => Promise<void>
): Promise<void> {
  try {
    // Extract and verify JWT token
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = await verifyToken(token);

    // Validate payload
    if (!payload.projectId || !payload.userId) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    // Verify project access
    const hasAccess = await verifyProjectAccess(
      payload.userId,
      payload.projectId
    );
    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Execute handler with context
    await executeWithProjectContext(
      payload.projectId,
      payload.userId,
      async () => handler(req, res, payload.projectId, payload.userId)
    );
  } catch (error) {
    console.error("Tenant context error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
```

#### Edge Runtime Middleware

```typescript
// api/_lib/middleware/tenant-context-edge.ts
// For Edge runtime
import { verifyToken } from "../auth";
import { executeWithProjectContext } from "../db/context";
import { db } from "../db/connection";
import { sql } from "drizzle-orm";

export async function withTenantContextEdge(
  req: Request,
  handler: (
    req: Request,
    projectId: string,
    userId: string
  ) => Promise<Response>
): Promise<Response> {
  try {
    // Extract and verify JWT token
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = await verifyToken(token);

    // Validate payload
    if (!payload.projectId || !payload.userId) {
      return new Response(JSON.stringify({ error: "Invalid token payload" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify project access
    const hasAccess = await verifyProjectAccess(
      payload.userId,
      payload.projectId
    );
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Execute handler with context
    return await executeWithProjectContext(
      payload.projectId,
      payload.userId,
      async () => handler(req, payload.projectId, payload.userId)
    );
  } catch (error) {
    console.error("Tenant context error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function verifyProjectAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  // This query runs without RLS context to verify access
  const result = await db.execute(sql`
    SELECT 1 FROM project_members
    WHERE user_id = ${userId}::uuid
      AND project_id = ${projectId}::uuid
      AND status = 'active'
    LIMIT 1
  `);

  return result.rows.length > 0;
}
```

### Safe API Route Implementation

#### Node.js Runtime Implementation

```typescript
// api/bookings/index.ts
// Runtime: Node.js (default)
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withTenantContext } from "../_lib/middleware/tenant-context";
import { db } from "../_lib/db/connection";
import { bookingsTable } from "../_lib/db/schema";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return withTenantContext(req, res, async (req, res, projectId, userId) => {
      // All database operations here are automatically scoped to the project
      const bookings = await db.select().from(bookingsTable);

      res.status(200).json({
        bookings,
        project: projectId, // Include for debugging/verification
      });
    });
  }

  if (req.method === "POST") {
    return withTenantContext(req, res, async (req, res, projectId, userId) => {
      const data = req.body;

      // Validate input
      if (!data.guest_name || !data.check_in || !data.check_out) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Insert with explicit project_id (RLS will verify it matches context)
      const [booking] = await db
        .insert(bookingsTable)
        .values({
          ...data,
          project_id: projectId, // Explicitly set to ensure consistency
          created_by: userId,
          created_at: new Date(),
        })
        .returning();

      res.status(201).json({ booking });
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
```

#### Edge Runtime Implementation

```typescript
// api/bookings/edge.ts
// Runtime: Edge
import { withTenantContextEdge } from "../_lib/middleware/tenant-context-edge";
import { db } from "../_lib/db/connection";
import { bookingsTable } from "../_lib/db/schema";

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  const { method } = req;

  if (method === "GET") {
    return withTenantContextEdge(req, async (req, projectId, userId) => {
      // All database operations here are automatically scoped to the project
      const bookings = await db.select().from(bookingsTable);

      return new Response(
        JSON.stringify({
          bookings,
          project: projectId, // Include for debugging/verification
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    });
  }

  if (method === "POST") {
    return withTenantContextEdge(req, async (req, projectId, userId) => {
      const data = await req.json();

      // Validate input
      if (!data.guest_name || !data.check_in || !data.check_out) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Insert with explicit project_id (RLS will verify it matches context)
      const [booking] = await db
        .insert(bookingsTable)
        .values({
          ...data,
          project_id: projectId, // Explicitly set to ensure consistency
          created_by: userId,
          created_at: new Date(),
        })
        .returning();

      return new Response(JSON.stringify({ booking }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
```

## Secret Management

### Environment Variables Structure

```bash
# .env.local (never commit this file)
# Database
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DATABASE_POOL_URL="postgresql://user:pass@host-pooler/db?sslmode=require"

# JWT Secrets (use strong random values)
JWT_SECRET="<generate-with: openssl rand -base64 32>"
JWT_REFRESH_SECRET="<generate-with: openssl rand -base64 32>"

# Encryption keys for sensitive data
ENCRYPTION_KEY="<generate-with: openssl rand -hex 32>"

# API Keys (for external services)
GOOGLE_SHEETS_API_KEY="<from-google-cloud-console>"
CLOUDFLARE_API_KEY="<from-cloudflare-dashboard>"
```

### Secret Validation on Startup

```typescript
// api/_lib/config/secrets.ts
import { z } from "zod";

const secretsSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[a-f0-9]{64}$/i),
});

export function validateSecrets() {
  try {
    const secrets = secretsSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_URL: process.env.DATABASE_POOL_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    });

    // Additional runtime checks
    if (secrets.JWT_SECRET === secrets.JWT_REFRESH_SECRET) {
      throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different");
    }

    return secrets;
  } catch (error) {
    console.error("Secret validation failed:", error);
    process.exit(1); // Stop the application if secrets are invalid
  }
}

// Call on app initialization
const secrets = validateSecrets();
```

### Secure Token Generation

```typescript
// api/_lib/auth/tokens.ts
import jwt from "jsonwebtoken";
import crypto from "crypto";

const secrets = validateSecrets();

export interface TokenPayload {
  userId: string;
  projectId: string;
  role: string;
  sessionId: string; // For token revocation
}

export async function generateTokenPair(payload: TokenPayload) {
  // Add security fields
  const securePayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomBytes(16).toString("hex"), // Unique token ID
  };

  const accessToken = jwt.sign(securePayload, secrets.JWT_SECRET, {
    expiresIn: "15m", // Short-lived access token
    issuer: "okaeri-resort",
    audience: "api",
  });

  const refreshToken = jwt.sign(
    { ...securePayload, type: "refresh" },
    secrets.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
      issuer: "okaeri-resort",
      audience: "refresh",
    }
  );

  return { accessToken, refreshToken };
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const decoded = jwt.verify(token, secrets.JWT_SECRET, {
      issuer: "okaeri-resort",
      audience: "api",
    }) as TokenPayload;

    // Additional validation
    if (!decoded.userId || !decoded.projectId) {
      throw new Error("Invalid token structure");
    }

    // Check if session is still valid (implement redis/db check)
    const isValidSession = await checkSessionValidity(decoded.sessionId);
    if (!isValidSession) {
      throw new Error("Session expired or revoked");
    }

    return decoded;
  } catch (error) {
    throw new Error("Token verification failed");
  }
}
```

## Testing Strategy

### Test Isolation with Transactions

```typescript
// test/helpers/database.ts
import { db } from "../../api/_lib/db/connection";
import { v4 as uuid } from "uuid";
import { sql } from "drizzle-orm";

export async function withTestProject(
  testFn: (projectId: string, userId: string) => Promise<void>
): Promise<void> {
  // Create test data outside transaction
  const projectId = uuid();
  const userId = uuid();

  try {
    // Setup test project and user
    await db.execute(sql`
      INSERT INTO projects (id, name, slug, is_active)
      VALUES (${projectId}::uuid, ${`test_${projectId}`}, ${`test-${projectId}`}, true)
    `);

    await db.execute(sql`
      INSERT INTO users (id, email, role, project_id, is_active)
      VALUES (${userId}::uuid, ${`test@${projectId}.test`}, 'admin', ${projectId}::uuid, true)
    `);

    // Run test with transaction-scoped context
    await db
      .transaction(async (tx) => {
        await tx.execute(
          sql`SELECT set_config('app.current_project', ${projectId}, true)`
        );
        await tx.execute(
          sql`SELECT set_config('app.current_user', ${userId}, true)`
        );

        await testFn(projectId, userId);

        // Rollback transaction to keep tests isolated
        throw new Error("ROLLBACK_TEST");
      })
      .catch((error) => {
        if (error.message !== "ROLLBACK_TEST") throw error;
      });
  } finally {
    // Clean up test data
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`);
    await db.execute(sql`DELETE FROM projects WHERE id = ${projectId}::uuid`);
  }
}
```

### Security Testing

```typescript
// test/security.test.ts
describe("RLS Security Tests", () => {
  it("should prevent cross-tenant data access", async () => {
    const projectA = uuid();
    const projectB = uuid();
    const userA = uuid();
    const userB = uuid();

    // Setup two projects
    await setupTestProject(projectA, userA);
    await setupTestProject(projectB, userB);

    // Create booking in project A
    let bookingId: string;
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_project', ${projectA}, true)`
      );
      await tx.execute(
        sql`SELECT set_config('app.current_user', ${userA}, true)`
      );

      const result = await tx.execute(sql`
        INSERT INTO bookings (id, project_id, guest_name)
        VALUES (gen_random_uuid(), ${projectA}::uuid, 'Project A Guest')
        RETURNING id
      `);
      bookingId = result.rows[0].id;
    });

    // Try to access from project B - should return empty
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_project', ${projectB}, true)`
      );
      await tx.execute(
        sql`SELECT set_config('app.current_user', ${userB}, true)`
      );

      const result = await tx.execute(sql`
        SELECT * FROM bookings WHERE id = ${bookingId}::uuid
      `);

      expect(result.rows).toHaveLength(0); // Should not see project A's booking
    });

    // Verify original booking still exists in project A
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_project', ${projectA}, true)`
      );
      await tx.execute(
        sql`SELECT set_config('app.current_user', ${userA}, true)`
      );

      const result = await tx.execute(sql`
        SELECT * FROM bookings WHERE id = ${bookingId}::uuid
      `);

      expect(result.rows).toHaveLength(1); // Should see the booking
    });
  });

  it("should prevent context injection attacks", async () => {
    const projectId = uuid();
    const userId = uuid();
    const maliciousInput = "'; DROP TABLE bookings; --";

    await setupTestProject(projectId, userId);

    // Attempt SQL injection through context setting
    await expect(
      db.transaction(async (tx) => {
        // This should fail safely
        await tx.execute(
          sql`SELECT set_config('app.current_project', ${maliciousInput}, true)`
        );
      })
    ).rejects.toThrow(); // Should throw UUID validation error
  });

  it("should enforce admin WITH CHECK constraints", async () => {
    const adminId = uuid();
    const projectId = uuid();

    // Setup admin user
    await db.execute(sql`
      INSERT INTO users (id, email, role, is_active)
      VALUES (${adminId}::uuid, 'admin@test.com', 'super_admin', true)
    `);

    // Admin should NOT be able to insert without valid project_id
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT set_config('app.current_user', ${adminId}, true)`
        );

        // This should fail due to WITH CHECK constraint
        await tx.execute(sql`
          INSERT INTO bookings (id, project_id, guest_name)
          VALUES (gen_random_uuid(), NULL, 'Test Guest')
        `);
      })
    ).rejects.toThrow();
  });
});
```

## Performance Optimization

### Optimized Indexes

```sql
-- Primary indexes for tenant isolation
CREATE INDEX CONCURRENTLY idx_bookings_project_id ON bookings(project_id);
CREATE INDEX CONCURRENTLY idx_users_project_id ON users(project_id);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_bookings_project_dates
  ON bookings(project_id, check_in, check_out)
  WHERE status != 'cancelled';

CREATE INDEX CONCURRENTLY idx_expenses_project_date
  ON expenses(project_id, date DESC);

-- Partial indexes for active records only
CREATE INDEX CONCURRENTLY idx_bookings_project_active
  ON bookings(project_id)
  WHERE status IN ('confirmed', 'checked_in');

-- Index for admin bypass checks
CREATE INDEX CONCURRENTLY idx_users_role_active
  ON users(role, is_active)
  WHERE role = 'super_admin';
```

### Query Optimization Patterns

```typescript
// Always include project_id explicitly for better query plans
const bookings = await db
  .select()
  .from(bookingsTable)
  .where(
    and(
      eq(bookingsTable.project_id, projectId), // Helps query planner
      gte(bookingsTable.check_in, startDate),
      lte(bookingsTable.check_out, endDate),
      ne(bookingsTable.status, "cancelled")
    )
  )
  .orderBy(desc(bookingsTable.check_in))
  .limit(100); // Always limit large queries
```

## Monitoring and Auditing

### Comprehensive Audit Logging

```sql
-- Enhanced audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create partitioned table for performance (by month)
CREATE TABLE audit_log_2025_01 PARTITION OF audit_log
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Index for efficient queries
CREATE INDEX idx_audit_log_project_user
  ON audit_log(project_id, user_id, created_at DESC);

-- Audit trigger function with error handling
CREATE OR REPLACE FUNCTION audit_changes() RETURNS TRIGGER AS $$
BEGIN
  -- Skip audit for audit_log table to prevent recursion
  IF TG_TABLE_NAME = 'audit_log' THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO audit_log (
      project_id,
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    )
    VALUES (
      current_setting('app.current_project', true)::uuid,
      current_setting('app.current_user', true)::uuid,
      TG_OP,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't block the operation
      RAISE WARNING 'Audit logging failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Connection Pool Monitoring

```typescript
// api/_lib/monitoring/pool-health.ts
export async function monitorConnectionPool() {
  const metrics = await db.execute(sql`
    SELECT 
      numbackends as active_connections,
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
      (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
      (SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock') as waiting_connections
    FROM pg_stat_database
    WHERE datname = current_database()
  `);

  const poolHealth = metrics.rows[0];

  // Alert if connection usage is high
  if (poolHealth.active_connections > poolHealth.max_connections * 0.8) {
    console.warn("High connection pool usage:", poolHealth);
  }

  return poolHealth;
}
```

## Security Best Practices Checklist

### Implementation Checklist

- [ ] All tables have `project_id` column with NOT NULL constraint
- [ ] RLS enabled with FORCE on all tables
- [ ] All policies have both USING and WITH CHECK clauses
- [ ] Admin policies validate project existence
- [ ] Using SET LOCAL instead of SET for context
- [ ] All database operations wrapped in transactions
- [ ] UUID validation before setting context
- [ ] JWT tokens have short expiration (15 minutes)
- [ ] Refresh tokens stored securely
- [ ] Session validation on each request
- [ ] Audit logging enabled for sensitive operations
- [ ] Connection pool monitoring in place
- [ ] Secrets validated on startup
- [ ] No hardcoded secrets in code
- [ ] Environment variables properly typed

### Security Testing Checklist

- [ ] Cross-tenant isolation verified
- [ ] SQL injection attempts blocked
- [ ] Context injection prevented
- [ ] Admin constraints enforced
- [ ] Token expiration working
- [ ] Session revocation tested
- [ ] Connection pool bleeding prevented
- [ ] Audit logs capturing all changes
- [ ] Performance under load tested
- [ ] Rollback procedures verified

## Troubleshooting Guide

### Common Issues and Solutions

```typescript
// Issue: "No rows returned" when data exists
// Cause: Context not set or incorrect
// Solution: Verify context is set in transaction
await db.transaction(async (tx) => {
  // Always set context first
  await tx.execute(sql`SELECT set_config('app.current_project', ${projectId}, true)`);
  await tx.execute(sql`SELECT set_config('app.current_user', ${userId}, true)`);

  // Then perform operations
  const result = await tx.select().from(bookingsTable);
});

// Issue: Context bleeding between requests
// Cause: Using SET instead of SET LOCAL
// Solution: Always use SET LOCAL or transactions
// WRONG:
await db.execute(sql`SET app.current_project = ${projectId}`);

// CORRECT:
await db.execute(sql`SELECT set_config('app.current_project', ${projectId}, true)`);

// Issue: Admin can't update records
// Cause: Missing WITH CHECK clause
// Solution: Ensure admin policies have proper WITH CHECK
CREATE POLICY admin_update ON table_name
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin() AND project_id IS NOT NULL);

// Issue: Performance degradation
// Cause: Missing indexes on project_id
// Solution: Create indexes and analyze
CREATE INDEX CONCURRENTLY idx_table_project
  ON table_name(project_id);
ANALYZE table_name;
```

## Emergency Procedures

### Disable RLS (Emergency Only)

```sql
-- First, document the reason
INSERT INTO audit_log (action, table_name, new_values)
VALUES ('EMERGENCY_RLS_DISABLE', 'all_tables',
  jsonb_build_object('reason', 'Emergency maintenance', 'timestamp', NOW()));

-- Disable RLS on specific table
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Re-enable immediately after fix
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
```

### Reset All Contexts

```sql
-- Clear all session settings (run as superuser)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid();
```

## Compliance Notes

For this family-owned internal application:

1. **Data Privacy**: While not subject to full DPA compliance, we implement:
   - Audit logging for accountability
   - Secure deletion procedures
   - Access controls per user

2. **Business Records**: Maintain for Philippine BIR requirements:
   - Financial transaction logs (keep 5 years)
   - Booking records with guest information
   - Audit trail for modifications

3. **Security Standards**: Practical security without enterprise overhead:
   - Strong password hashing (bcrypt)
   - JWT with short expiration
   - HTTPS only in production
   - Regular backup procedures

---

_Last Updated: January 28, 2025_  
_Version: 2.0.0_  
_Security Hardened Edition_
