/**
 * Database Connection Optimizer
 * Phase 4.4 Week 3.2 - Serverless-Optimized Database Performance
 *
 * Advanced connection pooling and query optimization specifically designed for
 * Neon PostgreSQL serverless architecture with Philippine resort workload patterns.
 *
 * Key Features:
 * - Intelligent connection pooling with cold start mitigation
 * - Prepared statement caching for common resort operations
 * - Query result streaming for large transaction datasets
 * - Connection health monitoring and auto-recovery
 * - Batch operation optimization for BIR compliance
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, PoolClient } from "@neondatabase/serverless";
import ws from "ws";
import { sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

// Configure WebSocket for Neon serverless
if (typeof WebSocket === "undefined") {
  global.WebSocket = ws as any;
}

export interface ConnectionConfig {
  // Basic connection settings
  connectionString: string;

  // Pool configuration optimized for serverless
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;

  // Prepared statement settings
  enablePreparedStatements: boolean;
  maxPreparedStatements: number;
  preparedStatementTTL: number;

  // Performance monitoring
  enableQueryLogging: boolean;
  slowQueryThreshold: number; // ms

  // Serverless optimizations
  enableConnectionWarmup: boolean;
  warmupQueries: string[];
  enableBatchOptimization: boolean;
  batchSize: number;
}

export interface ConnectionHealth {
  isHealthy: boolean;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  averageQueryTime: number;
  slowQueries: number;
  errors: number;
  lastHealthCheck: Date;
}

export interface PreparedStatement {
  id: string;
  query: string;
  parameterTypes: string[];
  createdAt: Date;
  useCount: number;
  avgExecutionTime: number;
}

export interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  cacheHits: number;
  errors: number;
  batchedOperations: number;
  connectionReuseRate: number;
}

/**
 * Common Philippine Resort SQL Patterns for Prepared Statements
 */
export const RESORT_QUERY_PATTERNS = {
  // Daily operations (high frequency)
  DAILY_BOOKINGS: {
    id: "daily_bookings",
    query: `
      SELECT b.*, g.name as guest_name, g.email, g.phone 
      FROM bookings b 
      JOIN guests g ON b.guest_id = g.id 
      WHERE b.project_id = $1 
        AND b.check_in_date >= $2 
        AND b.check_in_date < $3
      ORDER BY b.check_in_date ASC
    `,
    params: ["uuid", "date", "date"],
    frequency: "high",
    category: "operations",
  },

  // Financial queries (medium frequency)
  REVENUE_SUMMARY: {
    id: "revenue_summary",
    query: `
      SELECT 
        DATE_TRUNC($1, payment_date) as period,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        payment_method,
        currency
      FROM payments 
      WHERE project_id = $2 
        AND payment_date >= $3 
        AND payment_date <= $4
        AND status = 'completed'
      GROUP BY period, payment_method, currency
      ORDER BY period DESC
    `,
    params: ["text", "uuid", "date", "date"],
    frequency: "medium",
    category: "financial",
  },

  // BIR compliance queries (predictable, scheduled)
  BIR_TAX_SUMMARY: {
    id: "bir_tax_summary",
    query: `
      SELECT 
        extract('month' from payment_date) as month,
        extract('year' from payment_date) as year,
        SUM(amount) as gross_receipts,
        SUM(amount * 0.12) as vat_amount,
        SUM(CASE WHEN payment_method = 'ewt' THEN amount * 0.01 ELSE 0 END) as ewt_amount
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.project_id = $1
        AND p.payment_date >= $2
        AND p.payment_date <= $3
        AND p.status = 'completed'
      GROUP BY month, year
      ORDER BY year DESC, month DESC
    `,
    params: ["uuid", "date", "date"],
    frequency: "scheduled",
    category: "compliance",
  },

  // Occupancy analytics (medium frequency)
  OCCUPANCY_ANALYSIS: {
    id: "occupancy_analysis",
    query: `
      WITH room_nights AS (
        SELECT 
          generate_series(check_in_date, check_out_date - INTERVAL '1 day', '1 day') as date,
          room_count
        FROM bookings 
        WHERE project_id = $1
          AND check_in_date >= $2
          AND check_out_date <= $3
          AND status IN ('confirmed', 'checked_in', 'checked_out')
      )
      SELECT 
        DATE(date) as date,
        SUM(room_count) as occupied_rooms,
        $4::integer as total_rooms,
        (SUM(room_count)::float / $4::integer * 100) as occupancy_rate
      FROM room_nights
      GROUP BY DATE(date)
      ORDER BY date
    `,
    params: ["uuid", "date", "date", "integer"],
    frequency: "medium",
    category: "analytics",
  },

  // Expense tracking (high frequency)
  EXPENSE_CATEGORIZATION: {
    id: "expense_categorization",
    query: `
      SELECT 
        category,
        subcategory,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(amount) as average_amount
      FROM expenses
      WHERE project_id = $1
        AND expense_date >= $2
        AND expense_date <= $3
        AND status = 'approved'
      GROUP BY category, subcategory
      ORDER BY total_amount DESC
    `,
    params: ["uuid", "date", "date"],
    frequency: "high",
    category: "financial",
  },
} as const;

export class ConnectionOptimizer {
  private pool: Pool;
  private db: ReturnType<typeof drizzle>;
  private config: ConnectionConfig;
  private preparedStatements: Map<string, PreparedStatement> = new Map();
  private queryMetrics: QueryMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionHealth: ConnectionHealth;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.queryMetrics = {
      totalQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      cacheHits: 0,
      errors: 0,
      batchedOperations: 0,
      connectionReuseRate: 0,
    };

    this.connectionHealth = {
      isHealthy: true,
      activeConnections: 0,
      idleConnections: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      errors: 0,
      lastHealthCheck: new Date(),
    };

    this.initializePool();
    this.initializeHealthMonitoring();
  }

  /**
   * Initialize Neon serverless connection pool with optimizations
   */
  private initializePool(): void {
    this.pool = new Pool({
      connectionString: this.config.connectionString,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMs,
      connectionTimeoutMillis: this.config.connectionTimeoutMs,

      // Neon serverless specific optimizations
      ssl: true,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,

      // Error handling
      onError: (err, client) => {
        logger.error("Database pool error:", err);
        this.queryMetrics.errors++;
      },
    });

    // Initialize Drizzle with the pool
    this.db = drizzle(this.pool, {
      logger: this.config.enableQueryLogging
        ? {
            logQuery: (query, params) => {
              if (this.config.enableQueryLogging) {
                logger.debug("SQL Query:", { query, params });
              }
            },
          }
        : false,
    });
  }

  /**
   * Optimize for serverless cold starts
   */
  async optimizeForServerless(): Promise<void> {
    if (!this.config.enableConnectionWarmup) return;

    try {
      // Pre-warm connection with lightweight query
      await this.pool.query("SELECT 1 as warmup");

      // Pre-populate prepared statements for common operations
      if (this.config.enablePreparedStatements) {
        await this.preloadPreparedStatements();
      }

      // Run warmup queries to optimize query planner
      for (const warmupQuery of this.config.warmupQueries) {
        try {
          await this.pool.query(warmupQuery);
        } catch (error) {
          logger.warn("Warmup query failed:", { query: warmupQuery, error });
        }
      }

      logger.info("Database connection optimized for serverless");
    } catch (error) {
      logger.error("Serverless optimization failed:", error);
    }
  }

  /**
   * Cache frequent queries as prepared statements
   */
  async cacheFrequentQueries(): Promise<void> {
    if (!this.config.enablePreparedStatements) return;

    const patterns = Object.values(RESORT_QUERY_PATTERNS);
    const highFrequencyPatterns = patterns.filter((p) => p.frequency === "high");

    for (const pattern of highFrequencyPatterns) {
      await this.createPreparedStatement(pattern.id, pattern.query, pattern.params);
    }

    logger.info(`Cached ${highFrequencyPatterns.length} high-frequency queries`);
  }

  /**
   * Create and cache prepared statement
   */
  private async createPreparedStatement(
    id: string,
    query: string,
    paramTypes: string[]
  ): Promise<void> {
    if (this.preparedStatements.has(id)) return;

    try {
      const client = await this.pool.connect();

      // Create prepared statement
      await client.query(`PREPARE ${id} AS ${query}`);

      const preparedStatement: PreparedStatement = {
        id,
        query,
        parameterTypes: paramTypes,
        createdAt: new Date(),
        useCount: 0,
        avgExecutionTime: 0,
      };

      this.preparedStatements.set(id, preparedStatement);
      client.release();

      logger.debug(`Prepared statement created: ${id}`);
    } catch (error) {
      logger.error(`Failed to create prepared statement ${id}:`, error);
    }
  }

  /**
   * Execute query with prepared statement optimization
   */
  async executeOptimizedQuery<T = any>(statementId: string, params: any[] = []): Promise<T[]> {
    const startTime = Date.now();

    try {
      let result;

      if (this.preparedStatements.has(statementId)) {
        // Use prepared statement
        const client = await this.pool.connect();
        result = await client.query(
          `EXECUTE ${statementId}(${params.map((_, i) => `$${i + 1}`).join(",")})`,
          params
        );
        client.release();

        // Update prepared statement metrics
        const stmt = this.preparedStatements.get(statementId)!;
        stmt.useCount++;
        const duration = Date.now() - startTime;
        stmt.avgExecutionTime =
          (stmt.avgExecutionTime * (stmt.useCount - 1) + duration) / stmt.useCount;

        this.queryMetrics.cacheHits++;
      } else {
        // Fall back to regular query
        const pattern = Object.values(RESORT_QUERY_PATTERNS).find((p) => p.id === statementId);
        if (pattern) {
          result = await this.pool.query(pattern.query, params);
        } else {
          throw new Error(`Unknown statement ID: ${statementId}`);
        }
      }

      this.updateQueryMetrics(Date.now() - startTime);
      return result.rows;
    } catch (error) {
      this.queryMetrics.errors++;
      logger.error(`Query execution failed for ${statementId}:`, error);
      throw error;
    }
  }

  /**
   * Batch operations for better performance
   */
  async executeBatchOperation<T = any>(
    operations: Array<{
      statementId: string;
      params: any[];
    }>
  ): Promise<T[][]> {
    if (!this.config.enableBatchOptimization) {
      // Execute sequentially if batching disabled
      const results: T[][] = [];
      for (const op of operations) {
        const result = await this.executeOptimizedQuery<T>(op.statementId, op.params);
        results.push(result);
      }
      return results;
    }

    const startTime = Date.now();
    const client = await this.pool.connect();

    try {
      // Begin transaction for batch operations
      await client.query("BEGIN");

      const results: T[][] = [];
      const batches = this.chunkArray(operations, this.config.batchSize);

      for (const batch of batches) {
        const batchPromises = batch.map(async (op) => {
          if (this.preparedStatements.has(op.statementId)) {
            return await client.query(
              `EXECUTE ${op.statementId}(${op.params.map((_, i) => `$${i + 1}`).join(",")})`,
              op.params
            );
          } else {
            const pattern = Object.values(RESORT_QUERY_PATTERNS).find(
              (p) => p.id === op.statementId
            );
            if (pattern) {
              return await client.query(pattern.query, op.params);
            }
            throw new Error(`Unknown statement ID: ${op.statementId}`);
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.map((r) => r.rows));
      }

      await client.query("COMMIT");

      this.queryMetrics.batchedOperations++;
      this.updateQueryMetrics(Date.now() - startTime);

      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      this.queryMetrics.errors++;
      logger.error("Batch operation failed:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Stream large result sets to avoid memory issues
   */
  async streamLargeResultSet<T = any>(
    statementId: string,
    params: any[] = [],
    batchSize: number = 1000
  ): Promise<AsyncIterable<T[]>> {
    const pattern = Object.values(RESORT_QUERY_PATTERNS).find((p) => p.id === statementId);
    if (!pattern) {
      throw new Error(`Unknown statement ID: ${statementId}`);
    }

    const client = await this.pool.connect();
    let offset = 0;

    const iterator = {
      async *[Symbol.asyncIterator]() {
        try {
          while (true) {
            const paginatedQuery = `${pattern.query} LIMIT ${batchSize} OFFSET ${offset}`;
            const result = await client.query(paginatedQuery, params);

            if (result.rows.length === 0) break;

            yield result.rows as T[];
            offset += batchSize;

            // Small delay to prevent overwhelming the database
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } finally {
          client.release();
        }
      },
    };

    return iterator;
  }

  /**
   * Monitor connection health
   */
  async monitorConnectionHealth(): Promise<ConnectionHealth> {
    try {
      const startTime = Date.now();

      // Test connection with simple query
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as active_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      `);

      const queryTime = Date.now() - startTime;

      // Update health metrics
      this.connectionHealth = {
        isHealthy: queryTime < 5000, // Consider unhealthy if takes > 5 seconds
        activeConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        totalQueries: this.queryMetrics.totalQueries,
        averageQueryTime: this.queryMetrics.averageQueryTime,
        slowQueries: this.queryMetrics.slowQueries,
        errors: this.queryMetrics.errors,
        lastHealthCheck: new Date(),
      };

      return this.connectionHealth;
    } catch (error) {
      logger.error("Health check failed:", error);
      this.connectionHealth.isHealthy = false;
      this.connectionHealth.errors++;
      return this.connectionHealth;
    }
  }

  /**
   * Get prepared statement performance metrics
   */
  getPreparedStatementMetrics(): Array<PreparedStatement & { efficiency: number }> {
    return Array.from(this.preparedStatements.values())
      .map((stmt) => ({
        ...stmt,
        efficiency:
          stmt.useCount / Math.max(1, (Date.now() - stmt.createdAt.getTime()) / (1000 * 60)), // Uses per minute
      }))
      .sort((a, b) => b.efficiency - a.efficiency);
  }

  /**
   * Optimize prepared statement cache
   */
  async optimizePreparedStatements(): Promise<{
    removed: number;
    added: number;
    optimized: number;
  }> {
    let removed = 0;
    let added = 0;
    let optimized = 0;

    const cutoffTime = Date.now() - this.config.preparedStatementTTL;

    // Remove unused prepared statements
    for (const [id, stmt] of this.preparedStatements.entries()) {
      if (stmt.createdAt.getTime() < cutoffTime && stmt.useCount === 0) {
        try {
          const client = await this.pool.connect();
          await client.query(`DEALLOCATE ${id}`);
          client.release();

          this.preparedStatements.delete(id);
          removed++;
        } catch (error) {
          logger.warn(`Failed to deallocate prepared statement ${id}:`, error);
        }
      }
    }

    // Add high-frequency patterns that aren't cached yet
    const patterns = Object.values(RESORT_QUERY_PATTERNS);
    for (const pattern of patterns) {
      if (pattern.frequency === "high" && !this.preparedStatements.has(pattern.id)) {
        await this.createPreparedStatement(pattern.id, pattern.query, pattern.params);
        added++;
      }
    }

    optimized = removed + added;
    logger.info(`Prepared statement optimization: ${removed} removed, ${added} added`);

    return { removed, added, optimized };
  }

  /**
   * Pre-load essential prepared statements for cold start optimization
   */
  private async preloadPreparedStatements(): Promise<void> {
    const essentialPatterns = Object.values(RESORT_QUERY_PATTERNS).filter(
      (p) => p.frequency === "high" || p.category === "operations"
    );

    for (const pattern of essentialPatterns) {
      await this.createPreparedStatement(pattern.id, pattern.query, pattern.params);
    }
  }

  /**
   * Initialize health monitoring
   */
  private initializeHealthMonitoring(): void {
    // Health check every 5 minutes
    this.healthCheckInterval = setInterval(
      () => {
        this.monitorConnectionHealth();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Update query performance metrics
   */
  private updateQueryMetrics(duration: number): void {
    this.queryMetrics.totalQueries++;

    if (duration > this.config.slowQueryThreshold) {
      this.queryMetrics.slowQueries++;
    }

    // Update average query time
    this.queryMetrics.averageQueryTime =
      (this.queryMetrics.averageQueryTime * (this.queryMetrics.totalQueries - 1) + duration) /
      this.queryMetrics.totalQueries;

    // Update connection reuse rate
    this.queryMetrics.connectionReuseRate =
      this.queryMetrics.cacheHits / Math.max(1, this.queryMetrics.totalQueries);
  }

  /**
   * Utility function to chunk arrays for batch processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get comprehensive performance metrics
   */
  getPerformanceMetrics(): {
    queries: QueryMetrics;
    connections: ConnectionHealth;
    preparedStatements: number;
    cacheEfficiency: number;
  } {
    return {
      queries: { ...this.queryMetrics },
      connections: { ...this.connectionHealth },
      preparedStatements: this.preparedStatements.size,
      cacheEfficiency: this.queryMetrics.connectionReuseRate * 100,
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Deallocate all prepared statements
    const client = await this.pool.connect();
    for (const id of this.preparedStatements.keys()) {
      try {
        await client.query(`DEALLOCATE ${id}`);
      } catch (error) {
        logger.warn(`Failed to deallocate prepared statement ${id}:`, error);
      }
    }
    client.release();

    // Close pool
    await this.pool.end();

    this.preparedStatements.clear();
  }
}

// Default configuration for Philippine resort workload
export const RESORT_CONNECTION_CONFIG: ConnectionConfig = {
  connectionString: process.env.DATABASE_URL!,
  maxConnections: 10, // Conservative for serverless
  idleTimeoutMs: 30 * 1000, // 30 seconds
  connectionTimeoutMs: 10 * 1000, // 10 seconds
  enablePreparedStatements: true,
  maxPreparedStatements: 20,
  preparedStatementTTL: 60 * 60 * 1000, // 1 hour
  enableQueryLogging: process.env.NODE_ENV === "development",
  slowQueryThreshold: 1000, // 1 second
  enableConnectionWarmup: true,
  warmupQueries: [
    "SELECT NOW()",
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema()",
  ],
  enableBatchOptimization: true,
  batchSize: 10,
};

// Export singleton instance
export const connectionOptimizer = new ConnectionOptimizer(RESORT_CONNECTION_CONFIG);

export default ConnectionOptimizer;
