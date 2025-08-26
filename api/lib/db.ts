/**
 * Database connection utility for Neon PostgreSQL
 * Provides connection pooling and query helpers optimized for serverless
 */

import { Pool, type PoolConfig, type PoolClient } from "pg";
import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

// Configure Neon for Vercel Edge
neonConfig.fetchConnectionCache = true;
neonConfig.poolQueryViaFetch = true;

// Connection pool configuration optimized for serverless
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduced for serverless (was 10)
  min: 0, // Allow pool to shrink to 0
  idleTimeoutMillis: 10000, // 10 seconds (reduced from 30)
  connectionTimeoutMillis: 3000, // 3 seconds (reduced from 5)
  allowExitOnIdle: true, // Allow process to exit when idle
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
};

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get or create connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not configured");
    }

    pool = new Pool(poolConfig);

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("[DB] Unexpected pool error:", err);
    });

    // Log pool events in development
    if (process.env.NODE_ENV === "development") {
      pool.on("connect", () => {
        console.log("[DB] New client connected to pool");
      });
      pool.on("acquire", () => {
        console.log("[DB] Client acquired from pool");
      });
      pool.on("release", () => {
        console.log("[DB] Client released back to pool");
      });
    }
  }
  return pool;
}

/**
 * Get Neon SQL function for edge runtime
 */
export function getNeonClient(): NeonQueryFunction<false, false> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not configured");
  }
  return neon(process.env.DATABASE_URL);
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  } catch (error) {
    console.error("[DB] Query error:", error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Execute a query using Neon edge client (for Vercel Edge functions)
 */
export async function edgeQuery<T = any>(text: string, params?: any[]): Promise<T[]> {
  try {
    const sql = getNeonClient();
    const result = await sql(text, params);
    return result as T[];
  } catch (error) {
    console.error("[DB] Edge query error:", error);
    throw error;
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T = any>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[DB] Transaction error:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a single row from query result
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return affected row count
 */
export async function execute(text: string, params?: any[]): Promise<number> {
  const result = await query(text, params);
  return result.rowCount;
}

/**
 * Database helper utilities
 */
export const db = {
  /**
   * Escape identifier for SQL (table/column names)
   */
  escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  },

  /**
   * Build INSERT query with RETURNING clause
   */
  buildInsertQuery(
    table: string,
    data: Record<string, any>,
    returning = "*"
  ): { text: string; values: any[] } {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.map((k) => db.escapeIdentifier(k)).join(", ");
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

    return {
      text: `INSERT INTO ${db.escapeIdentifier(table)} (${columns}) VALUES (${placeholders}) RETURNING ${returning}`,
      values,
    };
  },

  /**
   * Build UPDATE query with RETURNING clause
   */
  buildUpdateQuery(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>,
    returning = "*"
  ): { text: string; values: any[] } {
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    const whereKeys = Object.keys(where);
    const whereValues = Object.values(where);

    const setClause = dataKeys.map((k, i) => `${db.escapeIdentifier(k)} = $${i + 1}`).join(", ");

    const whereClause = whereKeys
      .map((k, i) => `${db.escapeIdentifier(k)} = $${dataKeys.length + i + 1}`)
      .join(" AND ");

    return {
      text: `UPDATE ${db.escapeIdentifier(table)} SET ${setClause} WHERE ${whereClause} RETURNING ${returning}`,
      values: [...dataValues, ...whereValues],
    };
  },

  /**
   * Build DELETE query
   */
  buildDeleteQuery(table: string, where: Record<string, any>): { text: string; values: any[] } {
    const keys = Object.keys(where);
    const values = Object.values(where);
    const whereClause = keys.map((k, i) => `${db.escapeIdentifier(k)} = $${i + 1}`).join(" AND ");

    return {
      text: `DELETE FROM ${db.escapeIdentifier(table)} WHERE ${whereClause}`,
      values,
    };
  },

  /**
   * Format date for PostgreSQL
   */
  formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString();
  },

  /**
   * Convert to Philippine timezone
   */
  toPhilippineTime(date: Date | string): Date {
    const d = typeof date === "string" ? new Date(date) : date;
    // Philippines is UTC+8
    const philippineTime = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    return philippineTime;
  },
};

/**
 * Close database pool (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[DB] Connection pool closed");
  }
}

// Graceful shutdown handlers
if (process.env.NODE_ENV !== "production") {
  process.on("SIGINT", async () => {
    await closePool();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await closePool();
    process.exit(0);
  });
}
