> ⚠️ **REFERENCE ONLY - NOT USED IN CURRENT IMPLEMENTATION**
>
> The Okaeri Resort System uses **simple application-level filtering** with
> `project_id` for data isolation.
>
> **See [SIMPLE_DATABASE_GUIDE.md](./SIMPLE_DATABASE_GUIDE.md) for the
> authoritative approach.**
>
> This document is preserved for reference only and describes an alternative RLS
> approach that was considered but not implemented.

---

# Neon Connection Pooling Best Practices with RLS

## Important: Vercel Runtime Selection

**Critical**: This document contains examples for both Node.js and Edge
runtimes. Never mix response patterns within the same runtime:

- **Node.js Runtime** (default): Uses `res.status().json()` pattern
- **Edge Runtime**: Uses `new Response()` pattern

Choose your runtime based on your needs:

- Use **Node.js** for: Database-heavy operations, file processing, complex
  computations
- Use **Edge** for: Simple APIs, authentication checks, lightweight operations
  needing global distribution

## Overview

This guide provides comprehensive best practices for using Neon PostgreSQL with
connection pooling in a multi-tenant RLS environment, optimized for a
family-owned resort management system.

## Table of Contents

1. [Neon Free Tier Constraints](#neon-free-tier-constraints)
2. [Connection Pool Configuration](#connection-pool-configuration)
3. [RLS-Safe Connection Patterns](#rls-safe-connection-patterns)
4. [Performance Optimization](#performance-optimization)
5. [Monitoring and Debugging](#monitoring-and-debugging)
6. [Error Handling](#error-handling)
7. [Production Checklist](#production-checklist)

## Neon Free Tier Constraints

### Current Limits (as of January 2025)

- **Compute**: 0.25 vCPU, autosuspend after 5 minutes
- **Storage**: 3 GB across all branches
- **Connections**: 100 concurrent connections (pooled)
- **Data Transfer**: 5 GB per month
- **Branches**: 10 branches per project

### Optimization Strategy

Given these constraints, our approach focuses on:

1. Aggressive connection pooling
2. Minimal connection overhead
3. Quick query execution
4. Efficient data transfer

## Database Abstraction Strategy

### Primary Approach: Drizzle ORM

We use **Drizzle ORM** as our primary database abstraction layer for the
following reasons:

1. **Type Safety**: Full TypeScript support with compile-time query validation
2. **Serverless Optimized**: Designed for edge runtimes and serverless functions
3. **RLS Compatible**: Works seamlessly with our Row Level Security setup
4. **Performance**: Minimal overhead, generates efficient SQL
5. **Developer Experience**: Intuitive API with excellent IDE support

### When to Use Drizzle vs pg Pool

#### Use Drizzle (95% of cases):

- All CRUD operations
- Query building with dynamic filters
- Type-safe joins and relations
- Transaction management
- Schema migrations

```typescript
// Example: Type-safe query with Drizzle
import { db } from "@/lib/db";
import { bookings } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

const activeBookings = await db
  .select()
  .from(bookings)
  .where(
    and(
      eq(bookings.projectId, projectId),
      eq(bookings.status, "confirmed"),
      gte(bookings.checkInDate, new Date())
    )
  );
```

#### Use pg Pool (5% edge cases):

- Complex stored procedures that return custom types
- Bulk operations with COPY commands
- Database administration tasks
- Performance-critical raw SQL with specific optimizations
- Legacy SQL that's difficult to port

```typescript
// Example: Raw SQL for complex analytics
import { poolManager } from "@/lib/db/pool-manager";

const analytics = await poolManager.execute(
  `WITH seasonal_data AS (
    -- Complex CTE logic here
  )
  SELECT * FROM seasonal_data`,
  [],
  { projectId, userId }
);
```

### Migration Path

All new code should use Drizzle unless there's a specific technical requirement
for raw SQL. When using raw SQL:

1. Document why Drizzle couldn't be used
2. Ensure proper RLS context setting
3. Add type definitions for results
4. Consider creating a Drizzle wrapper if the pattern is reused

## Connection Pool Configuration

### Optimal Settings for Neon

```typescript
// src/lib/db/neon-config.ts
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import ws from "ws";

// Configure Neon for serverless environment
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true; // Use HTTP for queries when possible
neonConfig.fetchConnectionCache = true; // Cache connections

export const createNeonPool = () => {
  return new Pool({
    connectionString: process.env.DATABASE_URL,

    // Connection Pool Settings for Neon Free Tier
    max: 20, // Maximum connections (well below 100 limit)
    min: 2, // Keep 2 connections warm

    // Aggressive timeouts for serverless
    idleTimeoutMillis: 10000, // 10 seconds (close idle quickly)
    connectionTimeoutMillis: 5000, // 5 seconds (fail fast)

    // Statement timeout for runaway queries
    statement_timeout: 30000, // 30 seconds max per query

    // Query timeout
    query_timeout: 30000, // 30 seconds

    // Keep alive settings
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    // SSL required for Neon
    ssl: true,

    // Application name for monitoring
    application_name: "okaeri-resort",
  });
};

// Singleton pool instance
let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = createNeonPool();

    // Pool event handlers
    pool.on("error", (err) => {
      console.error("Unexpected pool error:", err);
    });

    pool.on("connect", (client) => {
      // Set default configurations for each new connection
      client.query('SET timezone = "Asia/Manila"');
      client.query("SET statement_timeout = 30000");
    });
  }

  return pool;
};
```

### Connection Pool Manager

```typescript
// src/lib/db/pool-manager.ts
import { Pool, PoolClient } from "pg";
import { performance } from "perf_hooks";

interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingRequests: number;
  averageWaitTime: number;
  connectionErrors: number;
}

class NeonPoolManager {
  private pool: Pool;
  private stats: PoolStats = {
    totalConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    averageWaitTime: 0,
    connectionErrors: 0,
  };
  private waitTimes: number[] = [];

  constructor(pool: Pool) {
    this.pool = pool;
    this.setupMonitoring();
  }

  /**
   * Execute query with automatic retry and monitoring
   */
  async execute<T>(
    query: string,
    params?: any[],
    options?: {
      retries?: number;
      retryDelay?: number;
      projectId?: string;
      userId?: string;
    }
  ): Promise<T[]> {
    const startTime = performance.now();
    const maxRetries = options?.retries ?? 3;
    const retryDelay = options?.retryDelay ?? 1000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let client: PoolClient | null = null;

      try {
        // Get client from pool
        client = await this.pool.connect();
        const waitTime = performance.now() - startTime;
        this.recordWaitTime(waitTime);

        // Set RLS context if provided
        if (options?.projectId) {
          await client.query("SELECT set_config($1, $2, true)", [
            "app.current_project",
            options.projectId,
          ]);
        }

        if (options?.userId) {
          await client.query("SELECT set_config($1, $2, true)", [
            "app.current_user",
            options.userId,
          ]);
        }

        // Execute query
        const result = await client.query<T>(query, params);

        // Update stats
        this.stats.totalConnections++;

        return result.rows;
      } catch (error) {
        lastError = error as Error;
        this.stats.connectionErrors++;

        // Log error
        console.error(`Query attempt ${attempt} failed:`, {
          error: lastError.message,
          query: query.substring(0, 100),
        });

        // Retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } finally {
        // Always release client back to pool
        if (client) {
          client.release();
        }
      }
    }

    throw lastError || new Error("Query execution failed");
  }

  /**
   * Execute within transaction with RLS context
   */
  async transaction<T>(
    projectId: string,
    userId: string,
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Set RLS context for transaction
      await client.query(
        "SELECT set_config($1, $2, true), set_config($3, $4, true)",
        ["app.current_project", projectId, "app.current_user", userId]
      );

      const result = await callback(client);

      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current pool statistics
   */
  getStats(): PoolStats & { health: "healthy" | "degraded" | "unhealthy" } {
    const pool = this.pool as any;

    const stats: PoolStats = {
      totalConnections: pool.totalCount || 0,
      idleConnections: pool.idleCount || 0,
      waitingRequests: pool.waitingCount || 0,
      averageWaitTime: this.calculateAverageWaitTime(),
      connectionErrors: this.stats.connectionErrors,
    };

    // Determine health status
    let health: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (stats.waitingRequests > 10 || stats.averageWaitTime > 1000) {
      health = "degraded";
    }

    if (stats.waitingRequests > 50 || stats.averageWaitTime > 5000) {
      health = "unhealthy";
    }

    return { ...stats, health };
  }

  private setupMonitoring(): void {
    // Monitor pool every 30 seconds
    setInterval(() => {
      const stats = this.getStats();

      if (stats.health !== "healthy") {
        console.warn("Pool health degraded:", stats);
      }

      // Clear old wait times (keep last 100)
      if (this.waitTimes.length > 100) {
        this.waitTimes = this.waitTimes.slice(-100);
      }
    }, 30000);
  }

  private recordWaitTime(time: number): void {
    this.waitTimes.push(time);
  }

  private calculateAverageWaitTime(): number {
    if (this.waitTimes.length === 0) return 0;

    const sum = this.waitTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.waitTimes.length);
  }

  /**
   * Warmup connections for serverless cold starts
   */
  async warmup(): Promise<void> {
    const warmupQueries = [
      "SELECT 1",
      "SELECT current_setting($1, true)",
      "SELECT NOW()",
    ];

    const promises = warmupQueries.map((query) =>
      this.execute(query, ["app.current_project"]).catch(() => {})
    );

    await Promise.all(promises);
  }

  /**
   * Gracefully close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const poolManager = new NeonPoolManager(getPool());
```

## RLS-Safe Connection Patterns

### Runtime Environment Guide

Vercel supports two runtime environments for API routes, each with different
response patterns:

#### Node.js Runtime (Default)

- Uses `VercelRequest` and `VercelResponse` types
- Response pattern: `res.status().json()`
- Better for complex server operations, database connections
- 10-second timeout (Hobby), 60-second (Pro)

#### Edge Runtime

- Uses Web API `Request` and `Response`
- Response pattern: `new Response()`
- Better for lightweight operations, global distribution
- 30-second timeout for all plans

### Node.js Function Pattern

```typescript
// api/bookings/index.ts
// Runtime: Node.js (default, no config needed)
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { poolManager } from "../_lib/db/pool-manager";
import { validateSession } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.method === "GET") {
    try {
      // Validate session from Authorization header
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = await validateSession(token);
      if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Execute query with RLS context
      const bookings = await poolManager.execute(
        `SELECT * FROM bookings 
         WHERE check_in_date >= $1 
         ORDER BY check_in_date ASC 
         LIMIT 50`,
        [new Date()],
        {
          projectId: session.projectId,
          userId: session.userId,
          retries: 3,
        }
      );

      return res.status(200).json({ bookings });
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      return res.status(500).json({ error: "Failed to fetch bookings" });
    }
  }

  if (req.method === "POST") {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = await validateSession(token);
      if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const data = req.body; // Body is automatically parsed in Vercel Functions

      // Use transaction for complex operations
      const booking = await poolManager.transaction(
        session.projectId,
        session.userId,
        async (client) => {
          // Generate booking code
          const codeResult = await client.query(
            `SELECT 'BK' || LPAD(NEXTVAL('booking_code_seq')::TEXT, 6, '0') as code`
          );
          const bookingCode = codeResult.rows[0].code;

          // Insert booking
          const bookingResult = await client.query(
            `INSERT INTO bookings (
              project_id, booking_code, guest_name, guest_phone,
              check_in_date, check_out_date, total_amount, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
              session.projectId,
              bookingCode,
              data.guestName,
              data.guestPhone,
              data.checkInDate,
              data.checkOutDate,
              data.totalAmount,
              session.userId,
            ]
          );

          const booking = bookingResult.rows[0];

          // Add to timeline
          await client.query(
            `INSERT INTO booking_timeline (
              booking_id, event_type, event_title, performed_by
            ) VALUES ($1, $2, $3, $4)`,
            [booking.id, "created", "Booking Created", session.userId]
          );

          return booking;
        }
      );

      return res.status(201).json({ booking });
    } catch (error) {
      console.error("Failed to create booking:", error);
      return res.status(500).json({ error: "Failed to create booking" });
    }
  }
}
```

### Edge Function Pattern

```typescript
// api/bookings/edge.ts
// Runtime: Edge (requires explicit config)
import { poolManager } from "../_lib/db/pool-manager";
import { validateSession } from "../_lib/auth";

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  const { method } = req;

  if (method !== "GET" && method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "GET") {
    try {
      // Validate session from Authorization header
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      const session = await validateSession(token);
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Execute query with RLS context
      const bookings = await poolManager.execute(
        `SELECT * FROM bookings 
         WHERE check_in_date >= $1 
         ORDER BY check_in_date ASC 
         LIMIT 50`,
        [new Date()],
        {
          projectId: session.projectId,
          userId: session.userId,
          retries: 3,
        }
      );

      return new Response(JSON.stringify({ bookings }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch bookings" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  if (method === "POST") {
    try {
      const token = req.headers.get("authorization")?.replace("Bearer ", "");
      const session = await validateSession(token);
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const data = await req.json(); // Must await json() in Edge runtime

      // Use transaction for complex operations
      const booking = await poolManager.transaction(
        session.projectId,
        session.userId,
        async (client) => {
          // Generate booking code
          const codeResult = await client.query(
            `SELECT 'BK' || LPAD(NEXTVAL('booking_code_seq')::TEXT, 6, '0') as code`
          );
          const bookingCode = codeResult.rows[0].code;

          // Insert booking
          const bookingResult = await client.query(
            `INSERT INTO bookings (
              project_id, booking_code, guest_name, guest_phone,
              check_in_date, check_out_date, total_amount, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
              session.projectId,
              bookingCode,
              data.guestName,
              data.guestPhone,
              data.checkInDate,
              data.checkOutDate,
              data.totalAmount,
              session.userId,
            ]
          );

          const booking = bookingResult.rows[0];

          // Add to timeline
          await client.query(
            `INSERT INTO booking_timeline (
              booking_id, event_type, event_title, performed_by
            ) VALUES ($1, $2, $3, $4)`,
            [booking.id, "created", "Booking Created", session.userId]
          );

          return booking;
        }
      );

      return new Response(JSON.stringify({ booking }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to create booking:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create booking" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }
}
```

### Server Action Pattern

```typescript
// src/lib/actions/bookings.ts
// Note: No 'use server' directive needed in Vite

import { poolManager } from "@/lib/db/pool-manager";
import { getServerSession } from "@/lib/auth/session";
import { queryClient } from "@/lib/query-client";

export async function updateBookingStatus(
  bookingId: string,
  newStatus: string
) {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  try {
    const result = await poolManager.transaction(
      session.projectId,
      session.userId,
      async (client) => {
        // Update booking status
        const updateResult = await client.query(
          `UPDATE bookings 
           SET status = $1, updated_at = NOW() 
           WHERE id = $2 AND project_id = $3
           RETURNING *`,
          [newStatus, bookingId, session.projectId]
        );

        if (updateResult.rows.length === 0) {
          throw new Error("Booking not found");
        }

        const booking = updateResult.rows[0];

        // Add timeline entry
        await client.query(
          `INSERT INTO booking_timeline (
            booking_id, event_type, event_title, performed_by, metadata
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            bookingId,
            "status_changed",
            `Status changed to ${newStatus}`,
            session.userId,
            JSON.stringify({ from: booking.status, to: newStatus }),
          ]
        );

        return booking;
      }
    );

    return { success: true, booking: result }; // Client handles cache invalidation
  } catch (error) {
    console.error("Failed to update booking status:", error);
    return { success: false, error: "Failed to update booking" };
  }
}
```

## Performance Optimization

### 1. Query Optimization

```typescript
// src/lib/db/query-optimizer.ts

/**
 * Optimize queries for Neon's characteristics
 */
export class QueryOptimizer {
  /**
   * Use prepared statements for frequently used queries
   */
  static prepareDashboardQueries(client: PoolClient) {
    // Prepare common queries
    const preparedQueries = [
      {
        name: "get_todays_checkins",
        text: `SELECT * FROM bookings 
               WHERE project_id = $1 
                 AND check_in_date = CURRENT_DATE 
                 AND status IN ('confirmed', 'checked_in')
               ORDER BY check_in_time`,
        values: 1,
      },
      {
        name: "get_monthly_revenue",
        text: `SELECT 
                 DATE_TRUNC('day', created_at) as date,
                 SUM(paid_amount) as revenue
               FROM payments
               WHERE project_id = $1
                 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
                 AND status = 'completed'
               GROUP BY DATE_TRUNC('day', created_at)
               ORDER BY date`,
        values: 1,
      },
    ];

    return Promise.all(
      preparedQueries.map((q) =>
        client.query({
          name: q.name,
          text: q.text,
          values: new Array(q.values),
        })
      )
    );
  }

  /**
   * Batch multiple queries into single round trip
   */
  static async batchQueries(
    client: PoolClient,
    queries: Array<{ text: string; values?: any[] }>
  ) {
    const batchQuery = queries
      .map((q, i) => {
        const placeholders = q.values
          ? q.values.map((_, j) => `$${j + 1}`).join(", ")
          : "";
        return `q${i} AS (${q.text}${placeholders ? ` (${placeholders})` : ""})`;
      })
      .join(",\n");

    const fullQuery = `WITH ${batchQuery} SELECT * FROM ${queries.map((_, i) => `q${i}`).join(", ")}`;

    return client.query(
      fullQuery,
      queries.flatMap((q) => q.values || [])
    );
  }

  /**
   * Use cursor for large result sets
   */
  static async *streamLargeQuery<T>(
    client: PoolClient,
    query: string,
    params: any[],
    batchSize: number = 100
  ): AsyncGenerator<T[], void, unknown> {
    const cursorName = `cursor_${Date.now()}`;

    try {
      // Create cursor
      await client.query("BEGIN");
      await client.query(`DECLARE ${cursorName} CURSOR FOR ${query}`, params);

      // Fetch in batches
      while (true) {
        const result = await client.query<T>(
          `FETCH ${batchSize} FROM ${cursorName}`
        );

        if (result.rows.length === 0) break;

        yield result.rows;
      }
    } finally {
      // Clean up cursor
      await client.query(`CLOSE ${cursorName}`);
      await client.query("COMMIT");
    }
  }
}
```

### 2. Caching Strategy

```typescript
// src/lib/cache/query-cache.ts
import { LRUCache } from "lru-cache";
import crypto from "crypto";

interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  max: number; // Maximum items in cache
}

export class QueryCache {
  private cache: LRUCache<string, any>;

  constructor(options: CacheOptions) {
    this.cache = new LRUCache({
      max: options.max,
      ttl: options.ttl,
    });
  }

  /**
   * Generate cache key from query and params
   */
  private getCacheKey(query: string, params?: any[]): string {
    const hash = crypto.createHash("sha256");
    hash.update(query);
    if (params) {
      hash.update(JSON.stringify(params));
    }
    return hash.digest("hex");
  }

  /**
   * Execute query with caching
   */
  async execute<T>(
    executor: () => Promise<T>,
    query: string,
    params?: any[],
    ttl?: number
  ): Promise<T> {
    const key = this.getCacheKey(query, params);

    // Check cache
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute query
    const result = await executor();

    // Store in cache
    this.cache.set(key, result, { ttl });

    return result;
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate: this.cache.calculatedSize || 0,
    };
  }
}

// Create cache instances for different data types
export const bookingCache = new QueryCache({ ttl: 60000, max: 1000 }); // 1 minute
export const financialCache = new QueryCache({ ttl: 300000, max: 500 }); // 5 minutes
export const settingsCache = new QueryCache({ ttl: 600000, max: 100 }); // 10 minutes
```

### 3. Connection Warmup

```typescript
// src/lib/db/warmup.ts

/**
 * Warm up database connections for serverless functions
 */
export async function warmupDatabase(): Promise<void> {
  const startTime = Date.now();

  try {
    // Warm up connection pool
    await poolManager.warmup();

    // Pre-fetch common data
    const warmupQueries = [
      // Load timezone
      poolManager.execute("SET timezone = 'Asia/Manila'"),

      // Check RLS functions
      poolManager.execute("SELECT current_project_id()"),

      // Load settings
      poolManager.execute(
        "SELECT key, value FROM project_settings WHERE is_public = true"
      ),
    ];

    await Promise.all(warmupQueries);

    const duration = Date.now() - startTime;
    console.log(`Database warmed up in ${duration}ms`);
  } catch (error) {
    console.error("Database warmup failed:", error);
    // Don't throw - app should still work even if warmup fails
  }
}

// Call on app startup
if (process.env.NODE_ENV === "production") {
  warmupDatabase();
}
```

## Monitoring and Debugging

### Connection Pool Metrics

```typescript
// api/health/db.ts
// Runtime: Node.js (default)
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { poolManager } from "../_lib/db/pool-manager";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    // Get pool statistics
    const stats = poolManager.getStats();

    // Test query performance
    const startTime = Date.now();
    await poolManager.execute("SELECT 1");
    const queryTime = Date.now() - startTime;

    // Check Neon-specific metrics
    const [neonStats] = await poolManager.execute<{
      connections: number;
      max_connections: number;
    }>(`
      SELECT 
        (SELECT count(*) FROM pg_stat_activity) as connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
    `);

    const response = {
      status: stats.health,
      pool: {
        ...stats,
        utilizationPercent: Math.round((stats.totalConnections / 20) * 100),
      },
      neon: {
        currentConnections: neonStats.connections,
        maxConnections: neonStats.max_connections,
        utilizationPercent: Math.round(
          (neonStats.connections / neonStats.max_connections) * 100
        ),
      },
      performance: {
        queryTimeMs: queryTime,
        status: queryTime < 100 ? "good" : queryTime < 500 ? "ok" : "slow",
      },
      timestamp: new Date().toISOString(),
    };

    // Set appropriate status code based on health
    const statusCode =
      stats.health === "healthy"
        ? 200
        : stats.health === "degraded"
          ? 503
          : 500;

    return res.status(statusCode).json(response);
  } catch (error) {
    console.error("Health check failed:", error);
    return res.status(500).json({
      status: "error",
      error: "Database health check failed",
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Debug Logging

```typescript
// src/lib/db/debug.ts
export class DatabaseDebugger {
  private static enabled = process.env.DB_DEBUG === "true";

  static logQuery(query: string, params?: any[], duration?: number) {
    if (!this.enabled) return;

    console.log("═══ Database Query ═══");
    console.log("Query:", query.substring(0, 200));
    if (params?.length) {
      console.log("Params:", params);
    }
    if (duration) {
      console.log(`Duration: ${duration}ms`);
    }
    console.log("═════════════════════");
  }

  static logPoolStats(stats: any) {
    if (!this.enabled) return;

    console.table({
      "Total Connections": stats.totalConnections,
      "Idle Connections": stats.idleConnections,
      "Waiting Requests": stats.waitingRequests,
      "Average Wait Time": `${stats.averageWaitTime}ms`,
      Health: stats.health,
    });
  }

  static logRLSContext(projectId: string, userId: string) {
    if (!this.enabled) return;

    console.log("RLS Context Set:", { projectId, userId });
  }
}
```

## Error Handling

### Comprehensive Error Handler

```typescript
// src/lib/db/error-handler.ts
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public detail?: string,
    public hint?: string
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export function handleDatabaseError(error: any): never {
  // PostgreSQL error codes
  const errorMap: Record<string, string> = {
    "23505": "Duplicate record found",
    "23503": "Reference constraint violation",
    "23502": "Required field is missing",
    "23514": "Check constraint violation",
    "42501": "Insufficient privileges",
    "42P01": "Table does not exist",
    "57014": "Query timeout exceeded",
    "53300": "Too many connections",
    "08006": "Connection failure",
    "08003": "Connection does not exist",
  };

  const message = errorMap[error.code] || error.message || "Database error";

  // Log detailed error
  console.error("Database Error:", {
    code: error.code,
    message: error.message,
    detail: error.detail,
    hint: error.hint,
    stack: error.stack,
  });

  // Throw user-friendly error
  throw new DatabaseError(message, error.code, error.detail, error.hint);
}

// Usage in API routes
export async function safeDatabaseOperation<T>(
  operation: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    if (error instanceof DatabaseError) {
      return { success: false, error: error.message };
    }

    handleDatabaseError(error);
  }
}
```

## Background Jobs and Scheduled Tasks

### Vercel Cron Configuration

Vercel Cron jobs are essential for maintaining materialized views and running
scheduled tasks in our serverless environment.

#### Setting Up Cron Jobs

1. **Create cron configuration** in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-views",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/daily-analytics",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

2. **Implement cron endpoints** with RLS context:

```typescript
// api/cron/refresh-views.ts
// Runtime: Node.js (default)
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { poolManager } from "../_lib/db/pool-manager";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized calls
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get all active projects for multi-tenant refresh
    const projects = await poolManager.execute<{ id: string }>(
      "SELECT id FROM projects WHERE is_active = true"
    );

    const refreshTasks = projects.map(async (project) => {
      try {
        // Set RLS context for each project
        await poolManager.execute(
          "SELECT refresh_project_views($1)",
          [project.id],
          { projectId: project.id, userId: "system" }
        );
        return { projectId: project.id, success: true };
      } catch (error) {
        console.error(`View refresh failed for project ${project.id}:`, error);
        return { projectId: project.id, success: false, error: error.message };
      }
    });

    const results = await Promise.all(refreshTasks);

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `View refresh complete: ${successful} succeeded, ${failed} failed`
    );

    return res.status(200).json({
      message: "Views refreshed",
      results: { successful, failed, details: results },
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return res.status(500).json({ error: "Cron job failed" });
  }
}
```

3. **Create scheduled job patterns** for common tasks:

```typescript
// lib/jobs/scheduled-jobs.ts
export interface ScheduledJob {
  name: string;
  schedule: string; // Cron expression
  handler: (projectId: string) => Promise<void>;
  requiresRLS: boolean;
}

export const scheduledJobs: ScheduledJob[] = [
  {
    name: "refresh_dashboard_views",
    schedule: "*/5 * * * *", // Every 5 minutes
    requiresRLS: true,
    handler: async (projectId) => {
      await poolManager.execute(
        "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_metrics",
        [],
        { projectId, userId: "system" }
      );
    },
  },
  {
    name: "generate_daily_reports",
    schedule: "0 2 * * *", // 2 AM daily
    requiresRLS: true,
    handler: async (projectId) => {
      await poolManager.transaction(projectId, "system", async (client) => {
        // Generate daily financial summary
        await client.query(
          `
          INSERT INTO daily_reports (project_id, report_date, data)
          SELECT 
            $1,
            CURRENT_DATE - INTERVAL '1 day',
            jsonb_build_object(
              'revenue', SUM(amount),
              'bookings', COUNT(*),
              'occupancy', AVG(occupancy_rate)
            )
          FROM daily_metrics
          WHERE project_id = $1
            AND date = CURRENT_DATE - INTERVAL '1 day'
        `,
          [projectId]
        );
      });
    },
  },
  {
    name: "cleanup_old_logs",
    schedule: "0 3 * * 0", // Sunday 3 AM
    requiresRLS: false, // System-wide cleanup
    handler: async (projectId) => {
      await poolManager.execute(`
        DELETE FROM audit_logs 
        WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
          AND importance = 'low'
      `);
    },
  },
];
```

### Background Job Patterns

#### 1. Long-Running Tasks

For tasks that exceed Vercel's function timeout (10 seconds on hobby, 60 seconds
on pro):

```typescript
// api/jobs/process-csv.ts
import { createClient } from "@vercel/kv";

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function processLargeCSV(jobId: string, fileUrl: string) {
  // Store job status in KV
  await kv.set(`job:${jobId}`, {
    status: "processing",
    startedAt: new Date().toISOString(),
    progress: 0,
  });

  try {
    // Process in chunks to stay under timeout
    const CHUNK_SIZE = 100;
    let offset = 0;

    while (true) {
      const chunk = await fetchCSVChunk(fileUrl, offset, CHUNK_SIZE);
      if (chunk.length === 0) break;

      await processChunk(chunk);
      offset += CHUNK_SIZE;

      // Update progress
      await kv.set(`job:${jobId}`, {
        status: "processing",
        progress: offset,
      });
    }

    await kv.set(`job:${jobId}`, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    await kv.set(`job:${jobId}`, {
      status: "failed",
      error: error.message,
    });
  }
}
```

#### 2. Queue Implementation

For job queuing without external services:

```typescript
// lib/jobs/simple-queue.ts
import { poolManager } from "@/lib/db/pool-manager";

export class SimpleJobQueue {
  async enqueue(jobType: string, payload: any, projectId: string) {
    const [job] = await poolManager.execute<{ id: string }>(
      `INSERT INTO job_queue (type, payload, project_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id`,
      [jobType, JSON.stringify(payload), projectId]
    );

    // Trigger processing (fire and forget)
    fetch("/api/jobs/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(console.error);

    return job.id;
  }

  async process(jobId: string) {
    const [job] = await poolManager.execute<{
      id: string;
      type: string;
      payload: any;
      project_id: string;
    }>(
      `UPDATE job_queue 
       SET status = 'processing', started_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [jobId]
    );

    if (!job) {
      throw new Error("Job not found or already processing");
    }

    try {
      // Process based on job type
      switch (job.type) {
        case "import_bookings":
          await this.importBookings(job.payload, job.project_id);
          break;
        case "generate_report":
          await this.generateReport(job.payload, job.project_id);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      await poolManager.execute(
        `UPDATE job_queue 
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [jobId]
      );
    } catch (error) {
      await poolManager.execute(
        `UPDATE job_queue 
         SET status = 'failed', error = $2, completed_at = NOW()
         WHERE id = $1`,
        [jobId, error.message]
      );
      throw error;
    }
  }
}
```

### Monitoring Background Jobs

```typescript
// api/admin/jobs.ts
export async function getJobStatus(req: VercelRequest, res: VercelResponse) {
  const jobs = await poolManager.execute(`
    SELECT 
      type,
      status,
      COUNT(*) as count,
      AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
      MAX(completed_at) as last_completed
    FROM job_queue
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY type, status
    ORDER BY type, status
  `);

  const health = {
    pending: jobs
      .filter((j) => j.status === "pending")
      .reduce((sum, j) => sum + j.count, 0),
    processing: jobs
      .filter((j) => j.status === "processing")
      .reduce((sum, j) => sum + j.count, 0),
    completed: jobs
      .filter((j) => j.status === "completed")
      .reduce((sum, j) => sum + j.count, 0),
    failed: jobs
      .filter((j) => j.status === "failed")
      .reduce((sum, j) => sum + j.count, 0),
  };

  res.status(200).json({
    health,
    jobs,
    timestamp: new Date().toISOString(),
  });
}
```

### Best Practices for Serverless Background Jobs

1. **Keep jobs idempotent**: Jobs may be retried on failure
2. **Use timeouts**: Set appropriate timeouts for different job types
3. **Monitor queue depth**: Alert if pending jobs exceed threshold
4. **Log comprehensively**: Include project context in all logs
5. **Handle RLS properly**: Set context for each project-specific job
6. **Use transactions**: Ensure data consistency for multi-step operations
7. **Clean up old jobs**: Implement retention policies for job history

## Production Checklist

### Pre-Deployment

- [ ] **Connection Limits**
  - Verify max connections < 80% of Neon limit (80/100)
  - Set aggressive idle timeouts (10-30 seconds)
  - Configure statement timeouts (30 seconds max)

- [ ] **RLS Configuration**
  - All tables have RLS enabled
  - Policies use `current_project_id()` function
  - Context setting uses `set_config(..., true)`
  - No direct table access without context

- [ ] **Query Optimization**
  - All frequent queries have indexes
  - Composite indexes for tenant + common filters
  - Materialized views for dashboard metrics
  - Query execution plans reviewed (EXPLAIN ANALYZE)

- [ ] **Error Handling**
  - Connection retry logic implemented
  - Graceful degradation for pool exhaustion
  - User-friendly error messages
  - Comprehensive error logging

- [ ] **Monitoring**
  - Health check endpoint deployed
  - Pool metrics dashboard configured
  - Alert thresholds set (connections > 80)
  - Query performance tracking enabled

### Environment Variables

```env
# .env.production
DATABASE_URL=postgres://user:pass@neon-endpoint/dbname?sslmode=require
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_IDLE_TIMEOUT=10000
DATABASE_CONNECTION_TIMEOUT=5000
DATABASE_STATEMENT_TIMEOUT=30000
DB_DEBUG=false
ENABLE_QUERY_CACHE=true
CACHE_TTL_SECONDS=60
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying Okaeri Resort System"

# 1. Run migrations
echo "📦 Running database migrations..."
psql $DATABASE_URL -f migrations/004_rls_optimization.sql

# 2. Verify RLS policies
echo "🔒 Verifying RLS policies..."
psql $DATABASE_URL -c "
  SELECT tablename, policyname, permissive, roles, cmd, qual
  FROM pg_policies
  WHERE schemaname = 'public'
"

# 3. Check indexes
echo "📊 Checking indexes..."
psql $DATABASE_URL -c "
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname
"

# 4. Test connection pooling
echo "🔌 Testing connection pool..."
curl -s https://your-app.com/api/health/db | jq '.'

# 5. Warm up connections
echo "♨️ Warming up connections..."
for i in {1..5}; do
  curl -s https://your-app.com/api/warmup &
done
wait

echo "✅ Deployment complete!"
```

## Summary

This configuration provides:

1. **Optimized for Neon Free Tier**: Stays well within connection limits while
   maximizing performance
2. **RLS Safety**: All connections properly scoped with transaction-based
   context
3. **Performance**: Aggressive caching, connection pooling, and query
   optimization
4. **Reliability**: Automatic retry, graceful degradation, comprehensive error
   handling
5. **Monitoring**: Real-time health checks and performance metrics
6. **Scalability**: Ready to grow beyond free tier when needed

The setup balances the constraints of a family-owned business (limited budget,
simple requirements) with professional-grade reliability and security.
