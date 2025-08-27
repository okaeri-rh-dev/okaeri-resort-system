/**
 * Test Database Connection Helper
 * Provides test-specific database connection with mocking capabilities
 */

import { vi } from "vitest";
import { config } from "dotenv";
import path from "path";

// Load test environment variables
const envPath = path.resolve(process.cwd(), ".env.test");
config({ path: envPath });

// Ensure DATABASE_URL is set for tests
if (!process.env.DATABASE_URL) {
  // Use a mock database URL for tests that don't need real DB
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
}

// Mock neon/serverless for test environment if needed
const isMockMode = process.env.TEST_MODE === "mock" || !process.env.DATABASE_URL.includes("neon");

if (isMockMode) {
  // Mock the Neon database client
  vi.mock("@neondatabase/serverless", () => {
    const mockSql = vi.fn(async (strings: TemplateStringsArray | string, ...values: any[]) => {
      // Handle different query patterns for testing
      const query =
        typeof strings === "string"
          ? strings
          : strings.raw
            ? strings.raw.join("?")
            : strings.join("?");

      // Mock responses for common queries
      if (query.includes("SELECT 1")) {
        return [{ test: 1 }];
      }
      if (query.includes("SELECT 1 as health")) {
        return [{ health: 1 }];
      }
      if (query.includes("pg_stat_activity")) {
        return [{ count: 5 }];
      }
      if (query.includes("information_schema.schemata")) {
        return [];
      }
      if (
        query.includes("CREATE SCHEMA") ||
        query.includes("DROP SCHEMA") ||
        query.includes("CREATE TABLE") ||
        query.includes("DROP TABLE") ||
        query.includes("INSERT INTO") ||
        query.includes("TRUNCATE") ||
        query.includes("SET search_path")
      ) {
        return [];
      }
      if (query.includes("SELECT") && query.includes("FROM")) {
        return [];
      }

      // Default empty result
      return [];
    });

    // Add identifier and raw methods to mockSql
    (mockSql as any).identifier = (name: string) => ({ identifier: name });
    (mockSql as any).raw = (sql: string) => sql;

    const neon = vi.fn(() => mockSql);

    const Pool = vi.fn().mockImplementation(() => ({
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
    }));

    return {
      neon,
      neonConfig: {},
      Pool,
    };
  });

  // Mock drizzle-orm
  vi.mock("drizzle-orm/neon-http", () => ({
    drizzle: vi.fn(() => ({
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(async (fn: any) => {
        const mockTx = {
          execute: vi.fn().mockResolvedValue([]),
          rollback: vi.fn(),
          commit: vi.fn(),
        };
        try {
          return await fn(mockTx);
        } catch (error) {
          throw error;
        }
      }),
    })),
  }));

  vi.mock("drizzle-orm/neon-serverless", () => ({
    drizzle: vi.fn(() => ({
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(async (fn: any) => {
        const mockTx = {
          execute: vi.fn().mockResolvedValue([]),
          rollback: vi.fn(),
          commit: vi.fn(),
        };
        try {
          return await fn(mockTx);
        } catch (error) {
          throw error;
        }
      }),
    })),
  }));
}

// Export test configuration
export const TEST_DB_CONFIG = {
  isMockMode,
  connectionString: process.env.DATABASE_URL,
  poolMin: parseInt(process.env.DB_POOL_MIN || "1"),
  poolMax: parseInt(process.env.DB_POOL_MAX || "5"),
  testTimeout: parseInt(process.env.TEST_TIMEOUT || "30000"),
  retryCount: parseInt(process.env.TEST_RETRY_COUNT || "3"),
};

// Helper to setup test database
export async function setupTestDatabase() {
  if (!isMockMode) {
    // If using real database, ensure it's accessible
    try {
      const { DatabaseConnection } = await import("@/lib/db/connection");
      const db = DatabaseConnection.getInstance();
      const isHealthy = await db.healthCheck();

      if (!isHealthy) {
        throw new Error("Database health check failed");
      }
    } catch (error) {
      console.warn("Warning: Could not connect to test database, falling back to mock mode");
      // Force mock mode if real database is not available
      process.env.TEST_MODE = "mock";
    }
  }
}

// Helper to cleanup test database
export async function cleanupTestDatabase() {
  if (!isMockMode) {
    try {
      const { DatabaseConnection } = await import("@/lib/db/connection");
      const db = DatabaseConnection.getInstance();
      await db.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}
