/**
 * Database utilities for Neon PostgreSQL with multi-tenant support
 */

import { Pool, type PoolConfig } from "pg";
import { neon, neonConfig } from "@neondatabase/serverless";
import type { TenantContext } from "./types";

// Configure Neon for Vercel Edge
neonConfig.fetchConnectionCache = true;

// Connection pool configuration
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of connections
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 5000, // 5 seconds
  // Enable SSL for production
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
};

// Create connection pool
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("Unexpected pool error:", err);
    });
  }
  return pool;
}

// Get database client for Edge runtime
export function getEdgeClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }
  return neon(process.env.DATABASE_URL);
}

// Multi-tenant query builder
export class TenantQuery {
  private projectId: string;
  private schema: string;

  constructor(context: TenantContext) {
    this.projectId = context.projectId;
    // Use project ID as schema name (sanitized)
    this.schema = `project_${context.projectId.replace(/-/g, "_")}`;
  }

  /**
   * Set search path for multi-tenant queries
   */
  async setSearchPath(client: {
    query: (text: string, params?: unknown[]) => Promise<unknown>;
  }): Promise<void> {
    await client.query(`SET search_path TO ${this.schema}, public`);
  }

  /**
   * Execute query with tenant context
   */
  async query<T = unknown>(text: string, params?: unknown[], useEdge = false): Promise<T[]> {
    if (useEdge) {
      const sql = getEdgeClient();
      // For edge runtime, prepend schema to table names
      const modifiedText = this.prependSchema(text);
      const result = await sql(modifiedText, params);
      return result as T[];
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await this.setSearchPath(client);
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Execute transaction with tenant context
   */
  async transaction<T = unknown>(
    callback: (client: {
      query: (text: string, params?: unknown[]) => Promise<unknown>;
    }) => Promise<T>
  ): Promise<T> {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await this.setSearchPath(client);
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
   * Prepend schema name to table references (for edge runtime)
   */
  private prependSchema(query: string): string {
    // Simple implementation - in production, use proper SQL parser
    const tables = [
      "bookings",
      "properties",
      "expenses",
      "payments",
      "users",
      "team_members",
      "activity_logs",
    ];

    let modifiedQuery = query;
    tables.forEach((table) => {
      // Replace table name with schema.table
      const regex = new RegExp(`\\b${table}\\b`, "gi");
      modifiedQuery = modifiedQuery.replace(regex, `${this.schema}.${table}`);
    });

    return modifiedQuery;
  }
}

// Database migration utilities
export async function ensureTenantSchema(projectId: string): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  const schemaName = `project_${projectId.replace(/-/g, "_")}`;

  try {
    await client.query("BEGIN");

    // Create schema if not exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

    // Set search path
    await client.query(`SET search_path TO ${schemaName}, public`);

    // Create tables (simplified example)
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'AVAILABLE',
        capacity INTEGER,
        base_rate DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID REFERENCES properties(id),
        guest_name VARCHAR(255) NOT NULL,
        guest_email VARCHAR(255),
        guest_phone VARCHAR(50),
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        nights INTEGER,
        guests INTEGER,
        status VARCHAR(50) DEFAULT 'PENDING',
        total_amount DECIMAL(10, 2),
        paid_amount DECIMAL(10, 2) DEFAULT 0,
        payment_status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID REFERENCES properties(id),
        category VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        vendor VARCHAR(255),
        date DATE NOT NULL,
        payment_method VARCHAR(50),
        receipt_url TEXT,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID REFERENCES bookings(id),
        amount DECIMAL(10, 2) NOT NULL,
        method VARCHAR(50),
        status VARCHAR(50) DEFAULT 'PENDING',
        transaction_id VARCHAR(255),
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        role VARCHAR(50) NOT NULL,
        permissions JSONB DEFAULT '[]',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100),
        resource_id UUID,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON bookings(check_in)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)`
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Query helpers
export const queryHelpers = {
  /**
   * Build WHERE clause from filters
   */
  buildWhereClause(filters: Record<string, unknown>): {
    clause: string;
    params: unknown[];
  } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        if (Array.isArray(value)) {
          // Handle array values (IN clause)
          const placeholders = value.map(() => `$${paramIndex++}`).join(", ");
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...value);
        } else if (key.endsWith("_from")) {
          // Handle date range (from)
          const field = key.replace("_from", "");
          conditions.push(`${field} >= $${paramIndex++}`);
          params.push(value);
        } else if (key.endsWith("_to")) {
          // Handle date range (to)
          const field = key.replace("_to", "");
          conditions.push(`${field} <= $${paramIndex++}`);
          params.push(value);
        } else if (key === "search") {
          // Handle search (ILIKE)
          conditions.push(
            `(guest_name ILIKE $${paramIndex} OR guest_email ILIKE $${paramIndex} OR guest_phone ILIKE $${paramIndex})`
          );
          params.push(`%${value}%`);
          paramIndex++;
        } else {
          // Handle exact match
          conditions.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      }
    });

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
      params,
    };
  },

  /**
   * Build ORDER BY clause
   */
  buildOrderByClause(sortBy?: string, sortOrder?: "asc" | "desc"): string {
    if (!sortBy) return "ORDER BY created_at DESC";
    return `ORDER BY ${sortBy} ${sortOrder?.toUpperCase() || "DESC"}`;
  },

  /**
   * Build LIMIT/OFFSET clause
   */
  buildPaginationClause(
    page: number = 1,
    limit: number = 20
  ): {
    clause: string;
    offset: number;
  } {
    const offset = (page - 1) * limit;
    return {
      clause: `LIMIT ${limit} OFFSET ${offset}`,
      offset,
    };
  },

  /**
   * Count total rows for pagination
   */
  async countRows(
    table: string,
    whereClause: string,
    params: unknown[],
    context: TenantContext
  ): Promise<number> {
    const query = new TenantQuery(context);
    const result = await query.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${table} ${whereClause}`,
      params
    );
    return parseInt(result[0]?.count || "0", 10);
  },
};
