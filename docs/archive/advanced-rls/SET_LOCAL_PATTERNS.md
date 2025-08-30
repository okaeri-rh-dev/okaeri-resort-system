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

# SET LOCAL Patterns for RLS in Neon PostgreSQL

## Important: API Response Patterns

**Note**: All examples in this document use Node.js runtime patterns
(`res.status().json()`) as database operations typically require the Node.js
runtime for optimal performance. If you need Edge runtime examples, refer to the
Edge-specific sections in NEON_CONNECTION_POOLING.md or RLS_MULTI_TENANT.md.

## Overview

This document provides comprehensive guidance on using `SET LOCAL` with
Row-Level Security (RLS) in a multi-tenant environment with Neon PostgreSQL
connection pooling.

## Table of Contents

1. [Understanding SET LOCAL vs SET](#understanding-set-local-vs-set)
2. [Transaction-Scoped Context Management](#transaction-scoped-context-management)
3. [Connection Pool Safety](#connection-pool-safety)
4. [Implementation Examples](#implementation-examples)
5. [Best Practices](#best-practices)
6. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)

## Understanding SET LOCAL vs SET

### SET LOCAL

- **Scope**: Transaction-level only
- **Duration**: Automatically cleared at transaction end
- **Pool Safety**: Safe for connection pooling
- **Use Case**: Preferred for RLS context in web applications

### SET

- **Scope**: Session-level
- **Duration**: Persists until explicitly changed or connection ends
- **Pool Safety**: Can leak between pooled connections
- **Use Case**: Long-running batch operations

### SET with LOCAL parameter

```sql
-- Best approach: Combines benefits of both
SELECT set_config('app.current_project', 'project_id', true); -- true = LOCAL
```

## Transaction-Scoped Context Management

### Basic Pattern

```typescript
// src/lib/db/rls-context.ts
import { sql } from "drizzle-orm";
import { db } from "./connection";

/**
 * Execute operation with RLS context
 * Ensures context is properly set and cleared
 */
export async function withRLSContext<T>(
  projectId: string,
  userId: string,
  operation: () => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Set context using SET LOCAL (transaction-scoped)
    await tx.execute(sql`
      SELECT set_config('app.current_project', ${projectId}, true),
             set_config('app.current_user', ${userId}, true)
    `);

    // Execute the actual operation
    const result = await operation();

    // Context automatically cleared at transaction end
    return result;
  });
}
```

### Advanced Pattern with Error Handling

```typescript
// src/lib/db/rls-transaction.ts
export async function executeWithContext<T>(
  projectId: string,
  userId: string,
  operation: () => Promise<T>,
  options?: {
    isolationLevel?: "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";
    readOnly?: boolean;
    deferrable?: boolean;
  }
): Promise<T> {
  const isolationLevel = options?.isolationLevel || "READ COMMITTED";

  try {
    return await db.transaction(
      async (tx) => {
        // Set transaction characteristics
        if (options?.readOnly) {
          await tx.execute(sql`SET TRANSACTION READ ONLY`);
        }

        if (options?.deferrable) {
          await tx.execute(sql`SET TRANSACTION DEFERRABLE`);
        }

        // Set isolation level if different from default
        if (isolationLevel !== "READ COMMITTED") {
          await tx.execute(
            sql`SET TRANSACTION ISOLATION LEVEL ${sql.raw(isolationLevel)}`
          );
        }

        // Set RLS context
        await tx.execute(sql`
        SELECT 
          set_config('app.current_project', ${projectId}, true) as project_set,
          set_config('app.current_user', ${userId}, true) as user_set
      `);

        // Verify context was set correctly
        const [context] = await tx.execute<{
          project_id: string;
          user_id: string;
        }>(sql`
        SELECT 
          current_setting('app.current_project', true) as project_id,
          current_setting('app.current_user', true) as user_id
      `);

        if (context.project_id !== projectId || context.user_id !== userId) {
          throw new Error("Failed to set RLS context");
        }

        // Execute the operation
        return await operation();
      },
      {
        isolationLevel,
      }
    );
  } catch (error) {
    // Log the error with context information
    console.error("RLS transaction failed:", {
      projectId,
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
```

## Connection Pool Safety

### Safe Middleware Pattern for Vercel Functions

```typescript
// api/_lib/middleware/database-context.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDatabase } from "../db/connection";
import { sql } from "drizzle-orm";

export async function withDatabaseContext(
  req: VercelRequest,
  res: VercelResponse,
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>
): Promise<void> {
  const projectId = req.headers["x-project-id"] as string;
  const userId = req.headers["x-user-id"] as string;

  if (!projectId || !userId) {
    return res.status(400).json({ error: "Missing context headers" });
  }

  const db = getDatabase();

  // Use transaction to ensure context doesn't leak
  await db.transaction(async (tx) => {
    // Set context for this transaction only
    await tx.execute(sql`
      SELECT set_config('app.current_project', ${projectId}, true),
             set_config('app.current_user', ${userId}, true)
    `);

    // Process request with context set
    await handler(req, res);

    // Context automatically cleared when transaction ends
  });
}
```

### Batch Operations Pattern

```typescript
// api/_lib/db/batch-operations.ts
export async function processBatchWithContext(
  projectId: string,
  items: Array<any>,
  processItem: (item: any, tx: any) => Promise<void>
): Promise<void> {
  const BATCH_SIZE = 100;
  const db = getDatabase();

  // Process in batches to avoid long transactions
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    await db.transaction(async (tx) => {
      // Set context for this batch
      await tx.execute(sql`
        SELECT set_config('app.current_project', ${projectId}, true)
      `);

      // Process batch items
      for (const item of batch) {
        await processItem(item, tx);
      }

      // Log batch completion
      await tx.execute(sql`
        INSERT INTO batch_processing_log (project_id, batch_size, processed_at)
        VALUES (${projectId}, ${batch.length}, NOW())
      `);
    });

    // Optional: Add delay between batches to reduce load
    if (i + BATCH_SIZE < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
```

## Implementation Examples

### Example 1: Booking Creation with RLS

```typescript
// src/services/booking.service.ts
export async function createBooking(
  projectId: string,
  userId: string,
  bookingData: BookingInput
): Promise<Booking> {
  const db = getDatabase();

  return await db.transaction(async (tx) => {
    // Set RLS context
    await tx.execute(sql`
      SELECT set_config('app.current_project', ${projectId}, true),
             set_config('app.current_user', ${userId}, true)
    `);

    // Generate booking code
    const bookingCode = await generateBookingCode(projectId);

    // Create booking (RLS ensures it's created for correct project)
    const [booking] = await tx
      .insert(bookings)
      .values({
        ...bookingData,
        project_id: projectId,
        booking_code: bookingCode,
        created_by: userId,
      })
      .returning();

    // Create audit log
    await tx.insert(auditLogs).values({
      project_id: projectId,
      user_id: userId,
      action: "BOOKING_CREATED",
      entity_type: "booking",
      entity_id: booking.id,
      metadata: { booking_code: bookingCode },
    });

    // Create timeline entry
    await tx.insert(bookingTimeline).values({
      booking_id: booking.id,
      event_type: "created",
      event_title: "Booking Created",
      performed_by: userId,
    });

    return booking;
  });
}
```

### Example 2: Cross-Project Analytics

```typescript
// src/services/analytics.service.ts
export async function getProjectComparison(
  adminUserId: string,
  projectIds: string[]
): Promise<ProjectMetrics[]> {
  const db = getDatabase();
  const results: ProjectMetrics[] = [];

  // Admin check
  const isAdmin = await checkAdminAccess(adminUserId);
  if (!isAdmin) {
    throw new Error("Unauthorized");
  }

  // Process each project in separate transactions
  for (const projectId of projectIds) {
    const metrics = await db.transaction(async (tx) => {
      // Set context for this project
      await tx.execute(sql`
        SELECT set_config('app.current_project', ${projectId}, true),
               set_config('app.current_user', ${adminUserId}, true)
      `);

      // Get metrics with RLS applied
      const [bookingStats] = await tx.execute<{
        total_bookings: number;
        total_revenue: number;
      }>(sql`
        SELECT 
          COUNT(*) as total_bookings,
          COALESCE(SUM(total_amount), 0) as total_revenue
        FROM bookings
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `);

      const [expenseStats] = await tx.execute<{
        total_expenses: number;
      }>(sql`
        SELECT COALESCE(SUM(amount), 0) as total_expenses
        FROM expenses
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
          AND status = 'approved'
      `);

      return {
        project_id: projectId,
        ...bookingStats,
        ...expenseStats,
      };
    });

    results.push(metrics);
  }

  return results;
}
```

### Example 3: Scheduled Jobs with RLS

```typescript
// src/jobs/daily-reports.ts
export async function generateDailyReports(): Promise<void> {
  const db = getDatabase();

  // Get all active projects
  const activeProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.is_active, true));

  for (const project of activeProjects) {
    try {
      await db.transaction(async (tx) => {
        // Set context for this project
        await tx.execute(sql`
          SELECT set_config('app.current_project', ${project.id}, true),
                 set_config('app.current_user', ${project.owner_id}, true)
        `);

        // Generate report data
        const reportData = await tx.execute(sql`
          WITH daily_stats AS (
            SELECT 
              COUNT(*) FILTER (WHERE status = 'checked_in') as checkins_today,
              COUNT(*) FILTER (WHERE status = 'checked_out') as checkouts_today,
              SUM(paid_amount) FILTER (WHERE payment_status = 'paid') as revenue_today
            FROM bookings
            WHERE DATE(check_in_date) = CURRENT_DATE
               OR DATE(check_out_date) = CURRENT_DATE
          ),
          expense_stats AS (
            SELECT SUM(amount) as expenses_today
            FROM expenses
            WHERE DATE(created_at) = CURRENT_DATE
              AND status = 'approved'
          )
          SELECT * FROM daily_stats, expense_stats
        `);

        // Store report
        await tx.insert(dailyReports).values({
          project_id: project.id,
          report_date: new Date(),
          data: reportData[0],
        });

        // Send notification if configured
        if (project.settings?.notifications?.dailyReport) {
          await sendDailyReportEmail(project, reportData[0]);
        }
      });
    } catch (error) {
      console.error(
        `Failed to generate report for project ${project.id}:`,
        error
      );
      // Continue with next project
    }
  }
}
```

## Best Practices

### 1. Always Use Transactions

```typescript
// ✅ GOOD: Context is transaction-scoped
await db.transaction(async (tx) => {
  await tx.execute(
    sql`SELECT set_config('app.current_project', ${projectId}, true)`
  );
  // Operations here
});

// ❌ BAD: Context might leak in connection pool
await db.execute(sql`SET app.current_project = ${projectId}`);
// Operations here
```

### 2. Validate Context Before Operations

```typescript
async function validateAndSetContext(
  tx: any,
  projectId: string,
  userId: string
) {
  // Set context
  await tx.execute(sql`
    SELECT set_config('app.current_project', ${projectId}, true),
           set_config('app.current_user', ${userId}, true)
  `);

  // Validate it was set correctly
  const [validation] = await tx.execute(sql`
    SELECT 
      current_setting('app.current_project', true) = ${projectId} as project_valid,
      current_setting('app.current_user', true) = ${userId} as user_valid
  `);

  if (!validation.project_valid || !validation.user_valid) {
    throw new Error("Context validation failed");
  }
}
```

### 3. Use Helper Functions for Consistency

```typescript
// src/lib/db/rls-helpers.ts
export const rlsHelpers = {
  setContext: async (tx: any, projectId: string, userId?: string) => {
    const userParam = userId || "system";
    return tx.execute(sql`
      SELECT set_config('app.current_project', ${projectId}, true),
             set_config('app.current_user', ${userParam}, true)
    `);
  },

  clearContext: async (tx: any) => {
    return tx.execute(sql`
      SELECT set_config('app.current_project', NULL, true),
             set_config('app.current_user', NULL, true)
    `);
  },

  getCurrentContext: async (tx: any) => {
    const [context] = await tx.execute(sql`
      SELECT 
        current_setting('app.current_project', true) as project_id,
        current_setting('app.current_user', true) as user_id
    `);
    return context;
  },
};
```

### 4. Handle Nested Transactions Carefully

```typescript
export async function complexOperation(projectId: string, userId: string) {
  return await db.transaction(async (tx) => {
    // Set context at outer transaction
    await rlsHelpers.setContext(tx, projectId, userId);

    // Savepoint for nested operation
    await tx.execute(sql`SAVEPOINT sp1`);

    try {
      // Nested operation
      await riskyOperation(tx);
      await tx.execute(sql`RELEASE SAVEPOINT sp1`);
    } catch (error) {
      // Rollback to savepoint, context remains
      await tx.execute(sql`ROLLBACK TO SAVEPOINT sp1`);
      // Handle error or retry
    }

    // Continue with context still set
    await safeOperation(tx);
  });
}
```

### 5. Monitor Context Usage

```typescript
// src/lib/monitoring/rls-monitor.ts
export async function auditContextUsage(
  tx: any,
  operation: string,
  startTime: number
) {
  const context = await rlsHelpers.getCurrentContext(tx);
  const duration = Date.now() - startTime;

  await tx.insert(contextAuditLog).values({
    project_id: context.project_id,
    user_id: context.user_id,
    operation,
    duration_ms: duration,
    timestamp: new Date(),
  });

  // Alert if operation took too long
  if (duration > 1000) {
    console.warn(`Slow RLS operation: ${operation} took ${duration}ms`);
  }
}
```

## Common Pitfalls and Solutions

### Pitfall 1: Context Leaking Between Requests

**Problem:**

```typescript
// ❌ Context might persist in pooled connection
await db.execute(sql`SET app.current_project = ${projectId}`);
```

**Solution:**

```typescript
// ✅ Use transaction-scoped context
await db.transaction(async (tx) => {
  await tx.execute(
    sql`SELECT set_config('app.current_project', ${projectId}, true)`
  );
});
```

### Pitfall 2: Missing Context in Background Jobs

**Problem:**

```typescript
// ❌ Background job without context
async function processExpiredBookings() {
  const expired = await db
    .select()
    .from(bookings)
    .where(lt(bookings.check_out_date, new Date()));
  // Fails due to missing project context
}
```

**Solution:**

```typescript
// ✅ Set context for each project
async function processExpiredBookings() {
  const projects = await getActiveProjects();

  for (const project of projects) {
    await db.transaction(async (tx) => {
      await rlsHelpers.setContext(tx, project.id, "system");

      const expired = await tx
        .select()
        .from(bookings)
        .where(lt(bookings.check_out_date, new Date()));

      // Process expired bookings
    });
  }
}
```

### Pitfall 3: Context in Long-Running Transactions

**Problem:**

```typescript
// ❌ Long transaction holds connection
await db.transaction(async (tx) => {
  await rlsHelpers.setContext(tx, projectId, userId);

  for (const item of veryLargeArray) {
    await processItem(tx, item); // Takes long time
  }
});
```

**Solution:**

```typescript
// ✅ Break into smaller transactions
for (const batch of chunk(veryLargeArray, 100)) {
  await db.transaction(async (tx) => {
    await rlsHelpers.setContext(tx, projectId, userId);

    for (const item of batch) {
      await processItem(tx, item);
    }
  });

  // Optional: yield to other operations
  await new Promise((resolve) => setImmediate(resolve));
}
```

### Pitfall 4: Forgetting Context in Subqueries

**Problem:**

```sql
-- ❌ Subquery might not have context
SELECT * FROM bookings
WHERE guest_id IN (
  SELECT id FROM guests -- Might fail if guests table has RLS
);
```

**Solution:**

```sql
-- ✅ Ensure context is available for all tables
WITH project_context AS (
  SELECT current_setting('app.current_project', true)::UUID as project_id
)
SELECT b.* FROM bookings b, project_context pc
WHERE b.project_id = pc.project_id
  AND b.guest_id IN (
    SELECT g.id FROM guests g
    WHERE g.project_id = pc.project_id
  );
```

## Testing RLS Context

```typescript
// src/tests/rls-context.test.ts
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db/connection";
import { rlsHelpers } from "@/lib/db/rls-helpers";

describe("RLS Context Management", () => {
  it("should isolate data between projects", async () => {
    const project1 = "project-id-1";
    const project2 = "project-id-2";

    // Create data for project 1
    await db.transaction(async (tx) => {
      await rlsHelpers.setContext(tx, project1, "user1");
      await tx.insert(bookings).values({
        project_id: project1,
        // ... other fields
      });
    });

    // Try to access from project 2
    await db.transaction(async (tx) => {
      await rlsHelpers.setContext(tx, project2, "user2");
      const results = await tx.select().from(bookings);

      // Should not see project 1 data
      expect(results.every((b) => b.project_id === project2)).toBe(true);
    });
  });

  it("should clear context after transaction", async () => {
    await db.transaction(async (tx) => {
      await rlsHelpers.setContext(tx, "test-project", "test-user");

      const during = await rlsHelpers.getCurrentContext(tx);
      expect(during.project_id).toBe("test-project");
    });

    // After transaction, context should be cleared
    const after = await db.execute(sql`
      SELECT current_setting('app.current_project', true) as project_id
    `);
    expect(after[0].project_id).toBeNull();
  });
});
```

## Performance Considerations

### Context Setting Overhead

The `set_config()` function has minimal overhead, but it's important to
understand the performance implications:

```sql
-- Benchmark: Setting context
-- Typical execution time: 0.1-0.3ms per set_config call
EXPLAIN (ANALYZE, BUFFERS)
SELECT set_config('app.current_project', 'proj_123', true),
       set_config('app.current_user', 'user_456', true);
```

**Performance Notes:**

- Each `set_config()` call adds ~0.2ms overhead
- Setting multiple values in one SELECT is more efficient than separate calls
- Context is stored in session memory (minimal RAM impact)
- No disk I/O involved in context setting

### Transaction Duration Impact

**WARNING**: Long-running transactions with SET LOCAL can impact connection pool
efficiency:

```typescript
// ❌ BAD: Long transaction holds connection
await db.transaction(async (tx) => {
  await setRLSContext(tx, projectId, userId);

  // Process 10,000 records - holds connection for minutes
  for (const record of largeDataset) {
    await processRecord(tx, record);
  }
}); // Connection blocked for entire duration

// ✅ GOOD: Batch processing with shorter transactions
const BATCH_SIZE = 100;
for (let i = 0; i < largeDataset.length; i += BATCH_SIZE) {
  const batch = largeDataset.slice(i, i + BATCH_SIZE);

  await db.transaction(async (tx) => {
    await setRLSContext(tx, projectId, userId);

    // Process smaller batch - releases connection quickly
    await Promise.all(batch.map((record) => processRecord(tx, record)));
  });
}
```

**Connection Pool Considerations:**

- Neon default pool size: 25 connections
- Long transactions reduce available connections
- Aim for transactions < 100ms for high-traffic endpoints
- Use read replicas for long-running queries

### RLS Policy Performance

RLS policies with context checks add query overhead:

```sql
-- Example RLS policy cost
CREATE POLICY tenant_isolation ON bookings
  USING (project_id = current_setting('app.current_project')::uuid);

-- Query plan shows RLS filter cost
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM bookings WHERE status = 'active';
-- Filter: (project_id = (current_setting('app.current_project'::text))::uuid)
-- Planning Time: 0.5ms (includes RLS policy evaluation)
-- Execution Time: 2.3ms (includes filtering)
```

**Optimization Strategies:**

1. **Index on RLS columns**: Always index `project_id`
2. **Partial indexes**: Create project-specific partial indexes for hot data
3. **Materialized views**: For complex aggregations, use per-project
   materialized views
4. **Query planning cache**: Prepared statements reuse RLS-aware plans

### Monitoring Queries

Track SET LOCAL performance in production:

```sql
-- Monitor context-setting frequency and duration
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%set_config%'
ORDER BY calls DESC;

-- Check for long-running transactions with context
SELECT
  pid,
  usename,
  application_name,
  state,
  query_start,
  state_change,
  age(clock_timestamp(), query_start) as query_duration,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query LIKE '%set_config%'
  AND age(clock_timestamp(), query_start) > interval '5 seconds';

-- Identify connection pool saturation
SELECT
  count(*) as active_connections,
  count(*) FILTER (WHERE state = 'active') as active_queries,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
FROM pg_stat_activity
WHERE datname = current_database();
```

### Best Practices for Performance

1. **Minimize Context Switches**

   ```typescript
   // Set context once per request, not per query
   app.use(async (req, res, next) => {
     req.db = await db.transaction(async (tx) => {
       await setRLSContext(tx, req.projectId, req.userId);
       return tx;
     });
     next();
   });
   ```

2. **Use Connection Pooling Wisely**

   ```typescript
   // Configure pool for your workload
   const pool = new Pool({
     max: 25, // Total connections
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
     statement_timeout: 30000, // Kill long queries
     lock_timeout: 10000, // Fail fast on locks
   });
   ```

3. **Optimize for Cold Starts (Serverless)**

   ```typescript
   // Warm connection on function init
   let warmConnection: PoolClient | null = null;

   export async function handler(event: any) {
     // Reuse warm connection if available
     const conn = warmConnection || (await pool.connect());

     try {
       await conn.query("SELECT set_config($1, $2, true)", [
         "app.current_project",
         event.projectId,
       ]);
       // ... handle request
     } finally {
       if (!warmConnection) {
         warmConnection = conn; // Keep warm for next invocation
       }
     }
   }
   ```

## Summary

Using `SET LOCAL` or `set_config` with the `true` parameter ensures that RLS
context is properly scoped to transactions, preventing context leakage in
connection pools. This approach is essential for secure multi-tenant
applications using Neon PostgreSQL.

Key takeaways:

1. Always use transaction-scoped context (`SET LOCAL` or
   `set_config(..., true)`)
2. Validate context before critical operations
3. Use helper functions for consistency
4. Monitor and audit context usage
5. Test isolation between tenants thoroughly

By following these patterns, you can build a secure, scalable multi-tenant
application that works efficiently with Neon's connection pooling.
