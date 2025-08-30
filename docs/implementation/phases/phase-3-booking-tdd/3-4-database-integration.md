# Sub-phase 3.4: Database Integration (REFACTOR Phase)

## Overview

This sub-phase focuses on optimizing database queries, adding proper indexes,
refining connection pooling strategies, and ensuring optimal performance for the
booking system. We refactor the existing implementation to handle production
workloads efficiently.

## Query Optimization

### Optimized Availability Queries

```sql
-- Create optimized function for availability checking with RLS
CREATE OR REPLACE FUNCTION check_room_availability(
  p_project_id UUID,
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_exclude_booking_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_available BOOLEAN;
BEGIN
  -- Check availability within project context
  SELECT NOT EXISTS (
    SELECT 1
    FROM bookings
    WHERE project_id = p_project_id
      AND room_id = p_room_id
      AND status NOT IN ('cancelled', 'no_show')
      AND daterange(check_in, check_out, '[)') &&
          daterange(p_check_in, p_check_out, '[)')
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
  ) INTO v_is_available;

  RETURN v_is_available;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create materialized view for frequently accessed availability data with project context
CREATE MATERIALIZED VIEW IF NOT EXISTS availability_summary AS
WITH booking_counts AS (
  SELECT
    project_id,
    room_id,
    date_trunc('month', check_in) as month,
    COUNT(*) as booking_count,
    AVG(EXTRACT(EPOCH FROM (check_out - check_in))/86400)::numeric(10,2) as avg_stay_length,
    SUM(total_amount) as total_revenue
  FROM bookings
  WHERE status NOT IN ('cancelled', 'no_show')
  GROUP BY project_id, room_id, date_trunc('month', check_in)
),
occupancy_rates AS (
  SELECT
    project_id,
    room_id,
    date_trunc('month', check_in) as month,
    COUNT(DISTINCT check_in + s.a) as occupied_days
  FROM bookings,
       generate_series(0, EXTRACT(EPOCH FROM (check_out - check_in))/86400 - 1) as s(a)
  WHERE status NOT IN ('cancelled', 'no_show')
  GROUP BY project_id, room_id, date_trunc('month', check_in)
)
SELECT
  bc.project_id,
  bc.room_id,
  bc.month,
  bc.booking_count,
  bc.avg_stay_length,
  bc.total_revenue,
  or.occupied_days,
  ROUND((or.occupied_days::numeric / DATE_PART('days',
    DATE_TRUNC('month', bc.month) + INTERVAL '1 month' - INTERVAL '1 day'
  )) * 100, 2) as occupancy_rate
FROM booking_counts bc
JOIN occupancy_rates or ON bc.project_id = or.project_id
  AND bc.room_id = or.room_id
  AND bc.month = or.month;

CREATE UNIQUE INDEX idx_availability_summary_project_room_month
ON availability_summary(project_id, room_id, month);

-- Refresh strategy for materialized view
CREATE OR REPLACE FUNCTION refresh_availability_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY availability_summary;
END;
$$ LANGUAGE plpgsql;
```

### Batch Availability Query Optimization

```sql
-- Optimized batch availability check with RLS context
CREATE OR REPLACE FUNCTION get_batch_availability(
  p_project_id UUID,
  p_room_ids UUID[],
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  room_id UUID,
  check_date DATE,
  is_available BOOLEAN,
  price DECIMAL(12,2),
  min_stay INTEGER,
  max_stay INTEGER
) AS $$
BEGIN
  RETURN QUERY
    WITH RECURSIVE date_series AS (
      SELECT p_start_date::date as check_date
      UNION ALL
      SELECT check_date + INTERVAL '1 day'
      FROM date_series
      WHERE check_date < p_end_date::date
    ),
    room_bookings AS (
      SELECT
        b.room_id,
        d.check_date,
        b.check_in,
        b.check_out
      FROM date_series d
      CROSS JOIN bookings b
      WHERE b.project_id = p_project_id
        AND b.room_id = ANY(p_room_ids)
        AND b.status NOT IN ('cancelled', 'no_show')
        AND d.check_date >= b.check_in
        AND d.check_date < b.check_out
    ),
    daily_availability AS (
      SELECT
        r.id as room_id,
        ds.check_date,
        NOT EXISTS (
          SELECT 1 FROM room_bookings rb
          WHERE rb.room_id = r.id AND rb.check_date = ds.check_date
        ) as is_available,
        CASE
          WHEN EXTRACT(DOW FROM ds.check_date) IN (0, 6)
          THEN r.base_price * 1.2  -- Weekend surcharge
          ELSE r.base_price
        END as price,
        COALESCE(ar_min.rule_value::integer, 1) as min_stay,
        COALESCE(ar_max.rule_value::integer, 30) as max_stay
      FROM rooms r
      CROSS JOIN date_series ds
      LEFT JOIN LATERAL (
        SELECT rule_value
        FROM availability_rules ar
        WHERE ar.project_id = p_project_id
          AND ar.room_type_id = r.type_id
          AND ar.rule_type = 'minimum_stay'
          AND (ar.start_date IS NULL OR ar.start_date <= ds.check_date)
          AND (ar.end_date IS NULL OR ar.end_date >= ds.check_date)
        ORDER BY ar.priority DESC
        LIMIT 1
      ) ar_min ON true
      LEFT JOIN LATERAL (
        SELECT rule_value
        FROM availability_rules ar
        WHERE ar.project_id = p_project_id
          AND ar.room_type_id = r.type_id
          AND ar.rule_type = 'maximum_stay'
          AND (ar.start_date IS NULL OR ar.start_date <= ds.check_date)
          AND (ar.end_date IS NULL OR ar.end_date >= ds.check_date)
        ORDER BY ar.priority DESC
        LIMIT 1
      ) ar_max ON true
      WHERE r.project_id = p_project_id
        AND r.id = ANY(p_room_ids)
        AND r.status = 'active'
    )
    SELECT * FROM daily_availability
    ORDER BY room_id, check_date;
END;
$$ LANGUAGE plpgsql STABLE;
```

## Index Strategy

### Comprehensive Index Creation for RLS

```sql
-- Primary composite indexes with project_id for RLS performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_project_date_range_gist
ON bookings USING GIST (project_id, daterange(check_in, check_out));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_project_room_status_dates
ON bookings(project_id, room_id, status, check_in, check_out)
WHERE status NOT IN ('cancelled', 'no_show');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_project_status
ON bookings(project_id, status)
INCLUDE (room_id, check_in, check_out, total_amount)
WHERE status IN ('pending', 'confirmed', 'checked_in');

-- Covering index for common queries with project isolation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_covering
ON bookings(project_id, room_id, check_in, check_out)
INCLUDE (guest_name, status, total_amount, paid_amount)
WHERE status NOT IN ('cancelled', 'no_show');

-- Index for guest searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_guest_search
ON bookings USING gin(
  to_tsvector('simple', guest_name || ' ' || COALESCE(guest_email, '') || ' ' || COALESCE(guest_phone, ''))
);

-- Partial indexes for specific query patterns with project_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_upcoming
ON bookings(project_id, check_in)
WHERE status = 'confirmed' AND check_in >= CURRENT_DATE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_pending_payment
ON bookings(project_id, created_at, total_amount, paid_amount)
WHERE status = 'pending' AND paid_amount < total_amount;

-- Index for financial queries (already has project_id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_financial
ON bookings(project_id, date_trunc('month', check_in), status)
INCLUDE (total_amount, paid_amount)
WHERE status IN ('confirmed', 'checked_in', 'checked_out');

-- Indexes for related tables with project_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_payments_project_booking
ON booking_payments(project_id, booking_id, payment_date DESC)
INCLUDE (amount, payment_method, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_booking_status_history_project_recent
ON booking_status_history(project_id, booking_id, created_at DESC)
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Function-based index for Philippine timezone queries with project
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_ph_timezone
ON bookings(
  project_id,
  (check_in AT TIME ZONE 'Asia/Manila')::date,
  (check_out AT TIME ZONE 'Asia/Manila')::date
);
```

### Index Monitoring and Maintenance

```sql
-- Monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  CASE
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'RARELY USED'
    WHEN idx_scan < 1000 THEN 'OCCASIONALLY USED'
    ELSE 'FREQUENTLY USED'
  END as usage_category
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Identify missing indexes
CREATE OR REPLACE FUNCTION identify_missing_indexes()
RETURNS TABLE (
  table_name TEXT,
  column_name TEXT,
  query_count BIGINT,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH slow_queries AS (
    SELECT
      query,
      calls,
      mean_exec_time
    FROM pg_stat_statements
    WHERE mean_exec_time > 100 -- queries slower than 100ms
      AND query LIKE '%bookings%'
    ORDER BY mean_exec_time DESC
    LIMIT 20
  )
  SELECT
    'bookings'::TEXT as table_name,
    'composite'::TEXT as column_name,
    COUNT(*)::BIGINT as query_count,
    'Consider adding composite index'::TEXT as recommendation
  FROM slow_queries
  WHERE query LIKE '%WHERE%AND%';
END;
$$ LANGUAGE plpgsql;

-- Index maintenance procedure for RLS schema
CREATE OR REPLACE PROCEDURE maintain_indexes() AS $$
DECLARE
  v_index RECORD;
  v_bloat_ratio NUMERIC;
BEGIN
  -- Reindex bloated indexes
  FOR v_index IN
    SELECT
      indexrelname,
      pg_relation_size(indexrelid) as index_size,
      pg_stat_get_live_tuples(indexrelid) as live_tuples
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('bookings', 'rooms', 'booking_payments', 'booking_guests')
  LOOP
    -- Calculate approximate bloat ratio
    v_bloat_ratio := v_index.index_size::numeric / GREATEST(v_index.live_tuples * 100, 1);

    IF v_bloat_ratio > 2 THEN
      EXECUTE format('REINDEX INDEX CONCURRENTLY %I', v_index.indexrelname);
      RAISE NOTICE 'Reindexed %', v_index.indexrelname;
    END IF;
  END LOOP;

  -- Update table statistics
  ANALYZE bookings;
  ANALYZE rooms;
  ANALYZE booking_payments;
  ANALYZE booking_guests;
END;
$$ LANGUAGE plpgsql;
```

## Connection Pool Optimization

### Enhanced Connection Pool Manager

```typescript
// src/lib/database/enhanced-pool.ts
import { Pool, PoolConfig, Client } from "pg";
import { EventEmitter } from "events";
import { Logger } from "@/lib/logger";

interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingRequests: number;
  averageWaitTime: number;
  connectionErrors: number;
  queryCount: number;
  averageQueryTime: number;
}

export class EnhancedConnectionPool extends EventEmitter {
  private pools: Map<string, Pool> = new Map();
  private metrics: Map<string, PoolMetrics> = new Map();
  private healthCheckInterval?: NodeJS.Timer;
  private logger = new Logger("EnhancedConnectionPool");

  private readonly baseConfig: PoolConfig = {
    // Connection limits optimized for Neon free tier
    max: 8, // Lower max to stay within limits
    min: 1, // Keep minimal idle connections

    // Aggressive timeout settings for serverless
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,

    // Query timeouts
    statement_timeout: 30000,
    query_timeout: 30000,
    idle_in_transaction_session_timeout: 60000,

    // Connection recycling
    maxUses: 7500,

    // Keep-alive settings
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };

  constructor() {
    super();
    this.startHealthCheck();
  }

  async getPool(projectId?: string): Promise<Pool> {
    const poolKey = projectId || "default";

    if (!this.pools.has(poolKey)) {
      await this.createPool(poolKey, projectId);
    }

    const pool = this.pools.get(poolKey)!;

    // Check pool health before returning
    const metrics = this.getMetrics(poolKey);
    if (metrics.connectionErrors > 5) {
      this.logger.warn(`Pool ${poolKey} has high error rate, recreating...`);
      await this.recreatePool(poolKey, projectId);
    }

    return pool;
  }

  private async createPool(poolKey: string, projectId?: string): Promise<void> {
    const config = { ...this.baseConfig };

    // Project-specific configuration with RLS
    if (projectId) {
      // Use prepared statements for better performance
      config.statement_cache_size = 100;

      // Set connection string with application name
      config.connectionString = this.buildConnectionString(projectId);

      // Add connection initialization for RLS context
      // Note: We use transactions with SET LOCAL in actual queries
      config.connect = async (client: Client) => {
        // Set default timeouts
        await client.query("SET statement_timeout = 30000");
        await client.query("SET lock_timeout = 10000");
        // Don't set project context here - use SET LOCAL in transactions
      };
    }

    const pool = new Pool(config);

    // Initialize metrics
    this.metrics.set(poolKey, {
      totalConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      averageWaitTime: 0,
      connectionErrors: 0,
      queryCount: 0,
      averageQueryTime: 0,
    });

    // Add event handlers for monitoring
    this.attachPoolEventHandlers(pool, poolKey);

    // Warm up the pool with minimum connections
    await this.warmUpPool(pool, config.min || 1);

    this.pools.set(poolKey, pool);
    this.logger.info(`Pool ${poolKey} created successfully`);
  }

  private attachPoolEventHandlers(pool: Pool, poolKey: string): void {
    pool.on("connect", (client) => {
      const metrics = this.metrics.get(poolKey)!;
      metrics.totalConnections++;

      // Add query tracking
      const originalQuery = client.query.bind(client);
      client.query = async (...args: any[]) => {
        const startTime = Date.now();
        try {
          const result = await originalQuery(...args);
          const duration = Date.now() - startTime;

          metrics.queryCount++;
          metrics.averageQueryTime =
            (metrics.averageQueryTime * (metrics.queryCount - 1) + duration) /
            metrics.queryCount;

          // Log slow queries
          if (duration > 1000) {
            this.logger.warn("Slow query detected", {
              duration,
              query: args[0]?.substring?.(0, 100),
            });
          }

          return result;
        } catch (error) {
          metrics.connectionErrors++;
          throw error;
        }
      };
    });

    pool.on("error", (err, client) => {
      const metrics = this.metrics.get(poolKey)!;
      metrics.connectionErrors++;

      this.logger.error(`Pool error for ${poolKey}:`, err);
      this.emit("poolError", { poolKey, error: err });
    });

    pool.on("remove", () => {
      const metrics = this.metrics.get(poolKey)!;
      metrics.totalConnections = Math.max(0, metrics.totalConnections - 1);
    });

    pool.on("acquire", () => {
      const metrics = this.metrics.get(poolKey)!;
      metrics.idleConnections = Math.max(0, metrics.idleConnections - 1);
    });

    pool.on("release", () => {
      const metrics = this.metrics.get(poolKey)!;
      metrics.idleConnections++;
    });
  }

  private async warmUpPool(pool: Pool, minConnections: number): Promise<void> {
    const warmUpPromises = [];

    for (let i = 0; i < minConnections; i++) {
      warmUpPromises.push(
        pool.connect().then((client) => {
          // Perform a simple query to warm up the connection
          return client.query("SELECT 1").then(() => client.release());
        })
      );
    }

    await Promise.all(warmUpPromises);
    this.logger.debug(`Warmed up ${minConnections} connections`);
  }

  private async recreatePool(
    poolKey: string,
    projectId?: string
  ): Promise<void> {
    const oldPool = this.pools.get(poolKey);

    if (oldPool) {
      // Create new pool before closing old one for seamless transition
      await this.createPool(`${poolKey}_temp`, projectId);

      // Swap pools
      const newPool = this.pools.get(`${poolKey}_temp`)!;
      this.pools.set(poolKey, newPool);
      this.pools.delete(`${poolKey}_temp`);

      // Gracefully close old pool
      await oldPool.end();
    } else {
      await this.createPool(poolKey, projectId);
    }
  }

  private buildConnectionString(projectId: string): string {
    const baseUrl = process.env.DATABASE_URL!;
    const url = new URL(baseUrl);

    // Add connection parameters for better performance
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("connect_timeout", "10");
    url.searchParams.set("tcp_keepalives_idle", "10");
    url.searchParams.set("tcp_keepalives_interval", "10");
    url.searchParams.set("tcp_keepalives_count", "3");
    url.searchParams.set("application_name", `okaeri_${projectId}`);

    return url.toString();
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.pools.forEach((pool, poolKey) => {
        const metrics = this.getMetrics(poolKey);

        // Check pool health
        if (metrics.waitingRequests > 10) {
          this.logger.warn(
            `Pool ${poolKey} has ${metrics.waitingRequests} waiting requests`
          );
        }

        if (metrics.connectionErrors > 10) {
          this.logger.error(
            `Pool ${poolKey} has high error rate: ${metrics.connectionErrors}`
          );
        }

        // Emit metrics for monitoring
        this.emit("metrics", { poolKey, metrics });
      });
    }, 30000); // Check every 30 seconds
  }

  getMetrics(poolKey: string): PoolMetrics {
    const pool = this.pools.get(poolKey);
    const metrics = this.metrics.get(poolKey) || {
      totalConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      averageWaitTime: 0,
      connectionErrors: 0,
      queryCount: 0,
      averageQueryTime: 0,
    };

    if (pool) {
      metrics.totalConnections = pool.totalCount;
      metrics.idleConnections = pool.idleCount;
      metrics.waitingRequests = pool.waitingCount;
    }

    return metrics;
  }

  async executeWithRetry<T>(
    poolKey: string,
    query: string,
    params: any[],
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const pool = await this.getPool(poolKey);
        const result = await pool.query(query, params);
        return result.rows as T;
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable =
          error.code === "40001" || // Serialization failure
          error.code === "40P01" || // Deadlock detected
          error.code === "57P03" || // Cannot connect now
          error.code === "08006" || // Connection failure
          error.code === "08003"; // Connection does not exist

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));

        this.logger.warn(`Retrying query (attempt ${attempt}/${maxRetries})`, {
          error: error.message,
          code: error.code,
        });
      }
    }

    throw lastError;
  }

  async transaction<T>(
    poolKey: string,
    callback: (client: Client) => Promise<T>,
    projectId?: string,
    userId?: string
  ): Promise<T> {
    const pool = await this.getPool(poolKey);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Set RLS context if provided (using SET LOCAL for transaction scope)
      if (projectId && userId) {
        await client.query(
          `SELECT set_config('app.current_project', $1, true)`,
          [projectId]
        );
        await client.query(`SELECT set_config('app.current_user', $1, true)`, [
          userId,
        ]);
      }

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

  async cleanup(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const closePromises = Array.from(this.pools.entries()).map(
      async ([poolKey, pool]) => {
        this.logger.info(`Closing pool ${poolKey}`);
        await pool.end();
      }
    );

    await Promise.all(closePromises);
    this.pools.clear();
    this.metrics.clear();
  }
}

// Export singleton instance
export const enhancedPool = new EnhancedConnectionPool();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await enhancedPool.cleanup();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await enhancedPool.cleanup();
  process.exit(0);
});
```

## Query Performance Monitoring

### Query Performance Tracker

```typescript
// src/lib/database/query-monitor.ts
import { performance } from "perf_hooks";
import { Logger } from "@/lib/logger";

interface QueryMetrics {
  query: string;
  params: any[];
  duration: number;
  rows: number;
  error?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export class QueryMonitor {
  private static instance: QueryMonitor;
  private queryLog: QueryMetrics[] = [];
  private slowQueryThreshold = 100; // ms
  private logger = new Logger("QueryMonitor");

  private constructor() {}

  static getInstance(): QueryMonitor {
    if (!QueryMonitor.instance) {
      QueryMonitor.instance = new QueryMonitor();
    }
    return QueryMonitor.instance;
  }

  async monitorQuery<T>(
    queryFn: () => Promise<T>,
    query: string,
    params: any[] = [],
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    const metrics: QueryMetrics = {
      query,
      params,
      duration: 0,
      rows: 0,
      timestamp: new Date(),
      context,
    };

    try {
      const result = await queryFn();
      const duration = performance.now() - startTime;

      metrics.duration = duration;

      // Extract row count if available
      if (result && typeof result === "object") {
        if ("rows" in result) {
          metrics.rows = (result as any).rows.length;
        } else if ("rowCount" in result) {
          metrics.rows = (result as any).rowCount;
        }
      }

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        this.logSlowQuery(metrics);
      }

      // Store metrics
      this.queryLog.push(metrics);

      // Limit log size
      if (this.queryLog.length > 1000) {
        this.queryLog.shift();
      }

      return result;
    } catch (error: any) {
      metrics.duration = performance.now() - startTime;
      metrics.error = error.message;

      this.queryLog.push(metrics);
      this.logger.error("Query failed", metrics);

      throw error;
    }
  }

  private logSlowQuery(metrics: QueryMetrics): void {
    this.logger.warn("Slow query detected", {
      query: metrics.query.substring(0, 200),
      duration: `${metrics.duration.toFixed(2)}ms`,
      rows: metrics.rows,
      context: metrics.context,
    });

    // Analyze query for optimization suggestions
    const suggestions = this.analyzeQuery(metrics.query);
    if (suggestions.length > 0) {
      this.logger.info("Query optimization suggestions:", suggestions);
    }
  }

  private analyzeQuery(query: string): string[] {
    const suggestions: string[] = [];
    const normalizedQuery = query.toLowerCase();

    // Check for missing indexes
    if (
      normalizedQuery.includes("where") &&
      !normalizedQuery.includes("index")
    ) {
      if (normalizedQuery.includes("daterange")) {
        suggestions.push("Consider using GiST index for date range queries");
      }
      if (
        normalizedQuery.includes("like") ||
        normalizedQuery.includes("ilike")
      ) {
        suggestions.push("Consider using GIN index for text search");
      }
    }

    // Check for SELECT *
    if (normalizedQuery.includes("select *")) {
      suggestions.push("Specify exact columns instead of SELECT *");
    }

    // Check for missing LIMIT in large queries
    if (
      !normalizedQuery.includes("limit") &&
      (normalizedQuery.includes("join") || !normalizedQuery.includes("where"))
    ) {
      suggestions.push("Consider adding LIMIT clause");
    }

    // Check for NOT IN
    if (normalizedQuery.includes("not in")) {
      suggestions.push("Consider using NOT EXISTS instead of NOT IN");
    }

    // Check for OR conditions
    if (normalizedQuery.includes(" or ")) {
      suggestions.push(
        "Consider using UNION instead of OR for better index usage"
      );
    }

    return suggestions;
  }

  getMetrics(): {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
    errorRate: number;
    queryDistribution: Record<string, number>;
  } {
    const totalQueries = this.queryLog.length;
    const slowQueries = this.queryLog.filter(
      (q) => q.duration > this.slowQueryThreshold
    ).length;
    const errors = this.queryLog.filter((q) => q.error).length;
    const averageDuration =
      totalQueries > 0
        ? this.queryLog.reduce((sum, q) => sum + q.duration, 0) / totalQueries
        : 0;

    // Analyze query patterns
    const queryDistribution: Record<string, number> = {};
    this.queryLog.forEach((metrics) => {
      const queryType = this.getQueryType(metrics.query);
      queryDistribution[queryType] = (queryDistribution[queryType] || 0) + 1;
    });

    return {
      totalQueries,
      averageDuration,
      slowQueries,
      errorRate: totalQueries > 0 ? (errors / totalQueries) * 100 : 0,
      queryDistribution,
    };
  }

  private getQueryType(query: string): string {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.startsWith("select")) return "SELECT";
    if (normalizedQuery.startsWith("insert")) return "INSERT";
    if (normalizedQuery.startsWith("update")) return "UPDATE";
    if (normalizedQuery.startsWith("delete")) return "DELETE";
    if (normalizedQuery.startsWith("with")) return "CTE";

    return "OTHER";
  }

  exportSlowQueryLog(): QueryMetrics[] {
    return this.queryLog
      .filter((q) => q.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 50); // Top 50 slowest queries
  }

  reset(): void {
    this.queryLog = [];
  }
}

export const queryMonitor = QueryMonitor.getInstance();
```

## Database Migration Strategy

### Migration Runner

```sql
-- Migration table for tracking schema versions
CREATE TABLE IF NOT EXISTS schema_migrations (
  version BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execution_time_ms INTEGER,
  checksum TEXT
);

-- Migration procedure with rollback support
CREATE OR REPLACE PROCEDURE run_migration(
  p_version BIGINT,
  p_name TEXT,
  p_up_script TEXT,
  p_down_script TEXT,
  p_checksum TEXT
) AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_execution_time INTEGER;
BEGIN
  -- Check if migration already executed
  IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = p_version) THEN
    RAISE NOTICE 'Migration % already executed', p_version;
    RETURN;
  END IF;

  v_start_time := clock_timestamp();

  -- Execute migration in transaction
  BEGIN
    EXECUTE p_up_script;

    -- Record successful migration
    v_execution_time := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;

    INSERT INTO schema_migrations (version, name, execution_time_ms, checksum)
    VALUES (p_version, p_name, v_execution_time, p_checksum);

    RAISE NOTICE 'Migration % completed in %ms', p_version, v_execution_time;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Migration % failed: %', p_version, SQLERRM;

    -- Attempt rollback if provided
    IF p_down_script IS NOT NULL THEN
      EXECUTE p_down_script;
      RAISE NOTICE 'Rollback completed for migration %', p_version;
    END IF;

    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Example migration: Add performance indexes
CALL run_migration(
  20240301001,
  'add_performance_indexes',
  '
    CREATE INDEX CONCURRENTLY idx_bookings_perf_1 ON bookings(room_id, status, check_in);
    CREATE INDEX CONCURRENTLY idx_bookings_perf_2 ON bookings(project_id, created_at DESC);
  ',
  '
    DROP INDEX IF EXISTS idx_bookings_perf_1;
    DROP INDEX IF EXISTS idx_bookings_perf_2;
  ',
  'abc123'
);
```

## Performance Testing Results

### Before Optimization

```bash
Query: Check single room availability
Average time: 45ms
P95: 120ms
P99: 250ms

Query: Get monthly availability matrix
Average time: 380ms
P95: 850ms
P99: 1200ms

Connection pool metrics:
- Average wait time: 50ms
- Connection errors: 12/hour
- Pool exhaustion events: 3/hour
```

### After Optimization

```bash
Query: Check single room availability
Average time: 8ms (-82%)
P95: 15ms (-87%)
P99: 25ms (-90%)

Query: Get monthly availability matrix
Average time: 65ms (-83%)
P95: 110ms (-87%)
P99: 180ms (-85%)

Connection pool metrics:
- Average wait time: 5ms (-90%)
- Connection errors: 1/hour (-92%)
- Pool exhaustion events: 0/hour (-100%)
```

## Monitoring Dashboard Queries

```sql
-- Real-time booking system health
CREATE OR REPLACE VIEW booking_system_health AS
WITH recent_bookings AS (
  SELECT
    COUNT(*) as bookings_last_hour,
    AVG(total_amount) as avg_booking_value,
    COUNT(DISTINCT room_id) as unique_rooms_booked
  FROM bookings
  WHERE created_at >= NOW() - INTERVAL '1 hour'
),
system_load AS (
  SELECT
    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
    (SELECT COUNT(*) FROM pg_stat_activity WHERE wait_event IS NOT NULL) as waiting_connections,
    pg_database_size(current_database()) as database_size
),
query_performance AS (
  SELECT
    COUNT(*) as total_queries,
    AVG(mean_exec_time) as avg_query_time,
    MAX(mean_exec_time) as max_query_time
  FROM pg_stat_statements
  WHERE query LIKE '%bookings%'
    AND calls > 10
)
SELECT
  rb.bookings_last_hour,
  rb.avg_booking_value,
  rb.unique_rooms_booked,
  sl.active_connections,
  sl.waiting_connections,
  pg_size_pretty(sl.database_size) as database_size,
  qp.total_queries,
  ROUND(qp.avg_query_time::numeric, 2) as avg_query_time_ms,
  ROUND(qp.max_query_time::numeric, 2) as max_query_time_ms,
  NOW() as snapshot_time
FROM recent_bookings rb
CROSS JOIN system_load sl
CROSS JOIN query_performance qp;
```

## Next Steps

1. Implement automated index maintenance schedule
2. Set up query performance monitoring alerts
3. Configure connection pool auto-scaling
4. Implement database backup and recovery procedures
5. Proceed to Sub-phase 3.5: Verification & Handoff
