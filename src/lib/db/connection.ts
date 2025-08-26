import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import ws from "ws";

// Configure Neon for serverless/edge environments
neonConfig.fetchConnectionCache = true;
neonConfig.useSecureWebSocket = true;
neonConfig.wsProxy = (host, port) => `wss://${host}:${port}`;

// Enable WebSocket in Node.js environments (for local development)
if (typeof process !== "undefined" && process.versions?.node) {
  neonConfig.webSocketConstructor = ws;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private sqlClient: ReturnType<typeof neon>;
  private pool: Pool | null = null;
  private drizzleDb: ReturnType<typeof drizzle>;
  private drizzlePoolDb: ReturnType<typeof drizzlePool> | null = null;

  private constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Initialize HTTP client for edge environments
    this.sqlClient = neon(databaseUrl, {
      fetchOptions: {
        cache: "no-store",
      },
    });

    // Initialize Drizzle with HTTP client
    this.drizzleDb = drizzle(this.sqlClient);

    // Initialize WebSocket pool for non-edge environments (optional)
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        this.pool = new Pool({ connectionString: databaseUrl });
        this.drizzlePoolDb = drizzlePool(this.pool);
      } catch (error) {
        console.warn("WebSocket pool initialization failed, falling back to HTTP:", error);
      }
    }
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Execute a query with automatic retry logic
   */
  async executeWithRetry<T>(queryFn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      if (retries > 0) {
        console.warn(`Database query failed, retrying... (${retries} attempts remaining)`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.executeWithRetry(queryFn, retries - 1);
      }

      // Log error details for debugging
      console.error("Database query failed after all retries:", error);

      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Database operation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get the SQL client for raw queries
   */
  getSql() {
    return this.sqlClient;
  }

  /**
   * Get the Drizzle database instance (HTTP-based for edge)
   */
  getDrizzle() {
    return this.drizzleDb;
  }

  /**
   * Get the Drizzle pool instance (WebSocket-based for Node.js)
   * Falls back to HTTP-based instance in edge environments
   */
  getDrizzlePool() {
    return this.drizzlePoolDb || this.drizzleDb;
  }

  /**
   * Execute a transaction with proper error handling
   */
  async transaction<T>(transactionFn: (tx: any) => Promise<T>): Promise<T> {
    const db = this.getDrizzle();

    return this.executeWithRetry(async () => {
      // Drizzle ORM transaction
      return await (db as any).transaction(transactionFn);
    });
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeWithRetry(async () => {
        const result = await this.sqlClient`SELECT 1 as health`;
        return result;
      });
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }

  /**
   * Close the connection pool (for cleanup)
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Export singleton instance methods
const db = DatabaseConnection.getInstance();

export const sql = db.getSql();
export const drizzleDb = db.getDrizzle();
export const drizzlePoolDb = db.getDrizzlePool();
export const executeWithRetry = db.executeWithRetry.bind(db);
export const transaction = db.transaction.bind(db);
export const healthCheck = db.healthCheck.bind(db);

// Export the class for testing purposes
export { DatabaseConnection };

// Export convenience function for schema-specific queries
export function getSchemaConnection(schemaName: string) {
  const db = DatabaseConnection.getInstance();
  const sql = db.getSql();

  return {
    sql: async (strings: TemplateStringsArray, ...values: any[]) => {
      // Set search_path for this query
      await sql`SET search_path TO ${sql(schemaName)}, public`;
      return sql(strings, ...values);
    },
    drizzle: db.getDrizzle(),
  };
}
