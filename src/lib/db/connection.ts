import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { isServer, getEnvVar } from "../env-client";

// Configure Neon for serverless/edge environments
neonConfig.fetchConnectionCache = true;
neonConfig.useSecureWebSocket = true;
neonConfig.wsProxy = (host, port) => `wss://${host}:${port}`;

// Enable WebSocket in Node.js environments (for local development)
if (isServer) {
  neonConfig.webSocketConstructor = ws;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private sqlClient: ReturnType<typeof neon>;
  private pool: Pool | null = null;
  private drizzleDb: ReturnType<typeof drizzle>;
  private drizzlePoolDb: ReturnType<typeof drizzlePool> | null = null;

  private constructor() {
    // Prevent initialization in browser environment
    if (!isServer) {
      throw new Error("Database connection cannot be initialized in browser environment");
    }

    const databaseUrl = getEnvVar("DATABASE_URL");

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
    if (isServer) {
      try {
        this.pool = new Pool({ connectionString: databaseUrl });
        this.drizzlePoolDb = drizzlePool(this.pool);
      } catch (error) {
        console.warn("WebSocket pool initialization failed, falling back to HTTP:", error);
      }
    }
  }

  static getInstance(): DatabaseConnection {
    // Prevent initialization in browser environment
    if (!isServer) {
      throw new Error("Database connection cannot be accessed in browser environment");
    }

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

// Export singleton instance methods with lazy initialization via Proxy
// This maintains the existing API while preventing browser initialization

// Create a proxy that lazily initializes the database connection
function createLazyProxy<T>(getter: () => T, errorMessage: string): T {
  let cached: T | null = null;

  return new Proxy({} as T, {
    get(target, prop, receiver) {
      if (!isServer) {
        throw new Error(errorMessage);
      }

      if (!cached) {
        cached = getter();
      }

      return Reflect.get(cached as any, prop, receiver);
    },

    has(target, prop) {
      if (!isServer) {
        return false;
      }

      if (!cached) {
        cached = getter();
      }

      return Reflect.has(cached as any, prop);
    },

    apply(target, thisArg, argArray) {
      if (!isServer) {
        throw new Error(errorMessage);
      }

      if (!cached) {
        cached = getter();
      }

      if (typeof cached === "function") {
        return Reflect.apply(cached as any, thisArg, argArray);
      }

      throw new Error("Not a function");
    },
  });
}

export const sql = createLazyProxy(
  () => DatabaseConnection.getInstance().getSql(),
  "Database SQL client is not available in browser environment"
);

export const drizzleDb = createLazyProxy(
  () => DatabaseConnection.getInstance().getDrizzle(),
  "Drizzle database is not available in browser environment"
);

export const drizzlePoolDb = createLazyProxy(
  () => DatabaseConnection.getInstance().getDrizzlePool(),
  "Drizzle pool database is not available in browser environment"
);

export const executeWithRetry = (queryFn: () => Promise<any>, retries?: number) => {
  if (!isServer) {
    throw new Error("Database operations are not available in browser environment");
  }
  return DatabaseConnection.getInstance().executeWithRetry(queryFn, retries);
};

export const transaction = (transactionFn: (tx: any) => Promise<any>) => {
  if (!isServer) {
    throw new Error("Database transactions are not available in browser environment");
  }
  return DatabaseConnection.getInstance().transaction(transactionFn);
};

export const healthCheck = () => {
  if (!isServer) {
    throw new Error("Database health check is not available in browser environment");
  }
  return DatabaseConnection.getInstance().healthCheck();
};

// Export the class for testing purposes
export { DatabaseConnection };

// Export convenience function for schema-specific queries
export function getSchemaConnection(schemaName: string) {
  const db = DatabaseConnection.getInstance();
  const baseSql = db.getSql();

  // Create a schema-specific SQL client that sets the search path
  const schemaSql = async (strings: TemplateStringsArray | string, ...values: any[]) => {
    // First set the search path
    await baseSql`SET search_path TO ${baseSql(schemaName)}, public`;

    // Then execute the actual query
    if (typeof strings === "string") {
      // Handle raw SQL strings
      return baseSql(strings, ...values);
    } else {
      // Handle template literals
      return baseSql(strings as TemplateStringsArray, ...values);
    }
  };

  // Add identifier method for proper SQL identifier escaping
  (schemaSql as any).identifier = (name: string) => baseSql(name);

  return {
    sql: schemaSql,
    drizzle: db.getDrizzle(),
  };
}
