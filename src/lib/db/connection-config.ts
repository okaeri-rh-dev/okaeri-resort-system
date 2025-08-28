/**
 * Neon PostgreSQL Connection Configuration
 * Optimized for serverless functions with connection pooling
 * Designed for Philippine timezone and business requirements
 */

import type { PoolConfig } from "pg";
import { Pool } from "pg";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import * as schema from "./schema";

// =============================================
// CONNECTION POOL CONFIGURATION
// =============================================

/**
 * Optimized pool configuration for Neon PostgreSQL
 * Balances performance with free tier connection limits
 */
const createPoolConfig = (databaseUrl: string): PoolConfig => ({
  connectionString: databaseUrl,

  // Connection limits optimized for serverless
  max: env.NODE_ENV === "production" ? 10 : 5, // Total connections
  min: 2, // Keep minimum connections alive

  // Aggressive timeouts for serverless efficiency
  idleTimeoutMillis: 30000, // 30 seconds - close idle connections quickly
  connectionTimeoutMillis: 10000, // 10 seconds - fail fast on connection issues

  // Query timeout for long-running operations
  query_timeout: 60000, // 1 minute max query time

  // SSL configuration for Neon
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,

  // Application name for monitoring
  application_name: `okaeri-resort-${env.NODE_ENV}`,

  // Philippine timezone setting
  options: "-c timezone=Asia/Manila",
});

// =============================================
// CONNECTION MANAGER
// =============================================

class DatabaseConnectionManager {
  private pools: Map<string, Pool> = new Map();
  private databases: Map<string, NodePgDatabase<typeof schema>> = new Map();
  private connectionHealth: Map<string, { lastCheck: Date; isHealthy: boolean }> = new Map();

  /**
   * Get or create a connection pool for a database
   */
  private getPool(databaseUrl: string, poolKey: string): Pool {
    if (!this.pools.has(poolKey)) {
      const pool = new Pool(createPoolConfig(databaseUrl));

      // Connection pool event handlers
      pool.on("connect", () => {
        logger.debug(`Database pool connected: ${poolKey}`);
      });

      pool.on("error", (err) => {
        logger.error("Database pool error:", { error: err.message, pool: poolKey });
        this.markUnhealthy(poolKey);
      });

      pool.on("remove", () => {
        logger.debug(`Database connection removed from pool: ${poolKey}`);
      });

      this.pools.set(poolKey, pool);
      this.markHealthy(poolKey);
    }

    return this.pools.get(poolKey)!;
  }

  /**
   * Get main database connection (global schema)
   */
  getMainDatabase(): NodePgDatabase<typeof schema> {
    const poolKey = "main";

    if (!this.databases.has(poolKey)) {
      const pool = this.getPool(env.DATABASE_URL, poolKey);
      const database = drizzle(pool, { schema });

      this.databases.set(poolKey, database);
    }

    return this.databases.get(poolKey)!;
  }

  /**
   * Get project-specific database connection
   * Uses the same physical database but with schema isolation
   */
  getProjectDatabase(projectId: string, schemaName?: string): NodePgDatabase<typeof schema> {
    const poolKey = `project_${projectId}`;

    if (!this.databases.has(poolKey)) {
      // Create URL with schema-specific search path
      const urlWithSchema = schemaName
        ? `${env.DATABASE_URL}?options=-c search_path=${schemaName},public`
        : env.DATABASE_URL;

      const pool = this.getPool(urlWithSchema, poolKey);
      const database = drizzle(pool, { schema });

      this.databases.set(poolKey, database);
    }

    return this.databases.get(poolKey)!;
  }

  /**
   * Health check for connection pools
   */
  async checkHealth(poolKey: string = "main"): Promise<boolean> {
    const pool = this.pools.get(poolKey);
    if (!pool) return false;

    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();

      this.markHealthy(poolKey);
      return true;
    } catch (error) {
      logger.error("Database health check failed:", { error, pool: poolKey });
      this.markUnhealthy(poolKey);
      return false;
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(poolKey: string = "main") {
    const pool = this.pools.get(poolKey);
    if (!pool) return null;

    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      maxConnections: pool.options.max || 10,
      isHealthy: this.connectionHealth.get(poolKey)?.isHealthy || false,
      lastHealthCheck: this.connectionHealth.get(poolKey)?.lastCheck,
    };
  }

  /**
   * Gracefully close all connections
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.entries()).map(async ([key, pool]) => {
      try {
        await pool.end();
        logger.info(`Closed database pool: ${key}`);
      } catch (error) {
        logger.error(`Error closing database pool ${key}:`, error);
      }
    });

    await Promise.all(closePromises);

    this.pools.clear();
    this.databases.clear();
    this.connectionHealth.clear();
  }

  /**
   * Warm up connections (useful for serverless functions)
   */
  async warmUp(): Promise<void> {
    const mainDb = this.getMainDatabase();

    try {
      // Execute a simple query to warm up the connection
      await mainDb.execute(`SELECT 1 as warm_up`);
      logger.debug("Database connection warmed up successfully");
    } catch (error) {
      logger.error("Database warm-up failed:", error);
      throw error;
    }
  }

  private markHealthy(poolKey: string): void {
    this.connectionHealth.set(poolKey, {
      lastCheck: new Date(),
      isHealthy: true,
    });
  }

  private markUnhealthy(poolKey: string): void {
    this.connectionHealth.set(poolKey, {
      lastCheck: new Date(),
      isHealthy: false,
    });
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const dbManager = new DatabaseConnectionManager();

// =============================================
// EXPORTS
// =============================================

/**
 * Get the main database connection for global operations
 */
export const getDatabase = () => dbManager.getMainDatabase();

/**
 * Get a project-specific database connection with schema isolation
 */
export const getProjectDatabase = (projectId: string, schemaName?: string) =>
  dbManager.getProjectDatabase(projectId, schemaName);

/**
 * Utility functions
 */
export const dbUtils = {
  checkHealth: (poolKey?: string) => dbManager.checkHealth(poolKey),
  getPoolStats: (poolKey?: string) => dbManager.getPoolStats(poolKey),
  closeAll: () => dbManager.closeAll(),
  warmUp: () => dbManager.warmUp(),
};

/**
 * Connection middleware for API routes
 * Ensures database is ready and healthy
 */
export const withDatabase = async <T>(
  operation: (db: NodePgDatabase<typeof schema>) => Promise<T>
): Promise<T> => {
  const startTime = Date.now();

  try {
    // Warm up connection if needed
    await dbManager.warmUp();

    const db = dbManager.getMainDatabase();
    const result = await operation(db);

    const duration = Date.now() - startTime;
    logger.debug("Database operation completed", { duration });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Database operation failed", { error, duration });
    throw error;
  }
};

/**
 * Project-specific database middleware
 */
export const withProjectDatabase = async <T>(
  projectId: string,
  operation: (db: NodePgDatabase<typeof schema>) => Promise<T>,
  schemaName?: string
): Promise<T> => {
  const startTime = Date.now();

  try {
    const db = dbManager.getProjectDatabase(projectId, schemaName);
    const result = await operation(db);

    const duration = Date.now() - startTime;
    logger.debug("Project database operation completed", { projectId, duration });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Project database operation failed", { projectId, error, duration });
    throw error;
  }
};

/**
 * Transaction wrapper with retry logic
 */
export const withTransaction = async <T>(
  operation: (db: NodePgDatabase<typeof schema>) => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withDatabase(async (db) => {
        return await db.transaction(async (tx) => {
          return await operation(tx as any);
        });
      });
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.warn(`Transaction attempt ${attempt} failed, retrying in ${delay}ms`, { error });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
};

// =============================================
// GRACEFUL SHUTDOWN
// =============================================

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    await dbManager.closeAll();
    logger.info("Database connections closed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Export the manager instance for advanced usage
export { dbManager };
