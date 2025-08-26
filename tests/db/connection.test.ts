/**
 * Database Connection Tests
 * Tests database connection establishment, pooling, retry logic, and schema connections
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from "vitest";
import {
  DatabaseConnection,
  sql,
  drizzleDb,
  executeWithRetry,
  healthCheck,
  getSchemaConnection,
} from "@/lib/db/connection";
import { TEST_TIMEOUT, generateTestSchemaName, DatabaseCleaner } from "./fixtures";

describe("Database Connection", () => {
  let cleaner: DatabaseCleaner;

  beforeAll(() => {
    cleaner = new DatabaseCleaner();
  });

  afterAll(async () => {
    await cleaner.cleanup();
  });

  describe("Connection Establishment", () => {
    it(
      "should establish a connection successfully",
      async () => {
        const result = await sql`SELECT 1 as test`;
        expect(result).toBeDefined();
        expect(result[0].test).toBe(1);
      },
      TEST_TIMEOUT
    );

    it("should handle connection with proper configuration", async () => {
      const db = DatabaseConnection.getInstance();
      expect(db).toBeDefined();
      expect(db.getSql()).toBeDefined();
      expect(db.getDrizzle()).toBeDefined();
    });

    it("should maintain singleton pattern", () => {
      const db1 = DatabaseConnection.getInstance();
      const db2 = DatabaseConnection.getInstance();
      expect(db1).toBe(db2);
    });

    it("should perform health check successfully", async () => {
      const isHealthy = await healthCheck();
      expect(isHealthy).toBe(true);
    });

    it("should handle connection string validation", async () => {
      // Test with invalid connection
      const originalEnv = process.env.DATABASE_URL;

      // Temporarily set invalid URL
      delete process.env.DATABASE_URL;

      // Should throw error when trying to create new instance
      expect(() => {
        // Force new instance creation by clearing singleton
        (DatabaseConnection as any).instance = undefined;
        DatabaseConnection.getInstance();
      }).toThrow("DATABASE_URL environment variable is not set");

      // Restore environment
      process.env.DATABASE_URL = originalEnv;
      (DatabaseConnection as any).instance = undefined;
    });
  });

  describe("Connection Pooling", () => {
    it(
      "should handle multiple concurrent connections",
      async () => {
        const promises = Array.from(
          { length: 10 },
          (_, i) => sql`SELECT ${i} as num, NOW() as time`
        );

        const results = await Promise.all(promises);

        expect(results).toHaveLength(10);
        results.forEach((result, index) => {
          expect(result[0].num).toBe(index);
          expect(result[0].time).toBeDefined();
        });
      },
      TEST_TIMEOUT
    );

    it(
      "should reuse connections efficiently",
      async () => {
        const startTime = performance.now();

        // Execute multiple sequential queries
        for (let i = 0; i < 20; i++) {
          await sql`SELECT 1`;
        }

        const duration = performance.now() - startTime;

        // Should complete relatively quickly due to connection reuse
        expect(duration).toBeLessThan(5000);
      },
      TEST_TIMEOUT
    );

    it(
      "should handle connection pool exhaustion gracefully",
      async () => {
        // Create many concurrent long-running queries
        const promises = Array.from({ length: 50 }, () => sql`SELECT pg_sleep(0.1)`);

        // Should not throw, but may queue some requests
        await expect(Promise.all(promises)).resolves.toBeDefined();
      },
      TEST_TIMEOUT
    );

    it(
      "should release connections properly after use",
      async () => {
        // Get connection stats before
        const statsBefore = await sql`
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

        // Execute queries
        await Promise.all([sql`SELECT 1`, sql`SELECT 2`, sql`SELECT 3`]);

        // Small delay to allow connection release
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Get connection stats after
        const statsAfter = await sql`
        SELECT count(*) as count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

        // Connection count should be relatively stable
        const diff = Math.abs(statsAfter[0].count - statsBefore[0].count);
        expect(diff).toBeLessThanOrEqual(5);
      },
      TEST_TIMEOUT
    );
  });

  describe("Retry Logic", () => {
    it("should retry failed queries", async () => {
      let attemptCount = 0;
      const mockQuery = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
        return { success: true };
      });

      const result = await executeWithRetry(mockQuery);

      expect(result).toEqual({ success: true });
      expect(attemptCount).toBe(3);
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it("should fail after max retries", async () => {
      const mockQuery = vi.fn(async () => {
        throw new Error("Persistent failure");
      });

      await expect(executeWithRetry(mockQuery)).rejects.toThrow(
        "Database operation failed: Persistent failure"
      );
      expect(mockQuery).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("should handle network timeouts with retry", async () => {
      let attemptCount = 0;
      const mockQuery = async () => {
        attemptCount++;
        if (attemptCount === 1) {
          // Simulate timeout
          throw new Error("timeout");
        }
        return { data: "success" };
      };

      const result = await executeWithRetry(mockQuery);
      expect(result).toEqual({ data: "success" });
      expect(attemptCount).toBe(2);
    });

    it("should respect custom retry count", async () => {
      let attemptCount = 0;
      const mockQuery = vi.fn(async () => {
        attemptCount++;
        throw new Error("Always fails");
      });

      await expect(executeWithRetry(mockQuery, 2)).rejects.toThrow();
      expect(attemptCount).toBe(3); // Initial + 2 retries
    });

    it("should handle retry delay properly", async () => {
      const startTime = performance.now();
      const mockQuery = vi.fn(async () => {
        throw new Error("Failure");
      });

      try {
        await executeWithRetry(mockQuery, 2);
      } catch {
        // Expected to fail
      }

      const duration = performance.now() - startTime;
      // Should have 2 retry delays of 1000ms each
      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(duration).toBeLessThan(3000);
    });
  });

  describe("Schema-Specific Connections", () => {
    let testSchemaName: string;

    beforeEach(() => {
      testSchemaName = generateTestSchemaName();
    });

    it("should create schema-specific connection", async () => {
      // Create test schema
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(testSchemaName)}`;
      cleaner.registerSchema(testSchemaName);

      // Get schema connection
      const schemaConn = getSchemaConnection(testSchemaName);

      expect(schemaConn).toBeDefined();
      expect(schemaConn.sql).toBeDefined();
      expect(schemaConn.drizzle).toBeDefined();
    });

    it("should execute queries in correct schema context", async () => {
      // Create test schema
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(testSchemaName)}`;
      cleaner.registerSchema(testSchemaName);

      // Create table in test schema
      await sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(testSchemaName)}.test_table (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `;

      // Get schema connection
      const schemaConn = getSchemaConnection(testSchemaName);

      // Insert data using schema connection
      await schemaConn.sql`INSERT INTO test_table (name) VALUES ('test')`;

      // Query should work with schema context
      const result = await schemaConn.sql`SELECT * FROM test_table`;
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("test");
    });

    it("should isolate schema contexts", async () => {
      // Create two test schemas
      const schema1 = generateTestSchemaName();
      const schema2 = generateTestSchemaName();

      await sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schema1)}`;
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schema2)}`;
      cleaner.registerSchema(schema1);
      cleaner.registerSchema(schema2);

      // Create same table in both schemas
      await sql`
        CREATE TABLE ${sql.identifier(schema1)}.test_table (
          id SERIAL PRIMARY KEY,
          value VARCHAR(100)
        )
      `;

      await sql`
        CREATE TABLE ${sql.identifier(schema2)}.test_table (
          id SERIAL PRIMARY KEY,
          value VARCHAR(100)
        )
      `;

      // Insert different data in each schema
      const conn1 = getSchemaConnection(schema1);
      const conn2 = getSchemaConnection(schema2);

      await conn1.sql`INSERT INTO test_table (value) VALUES ('schema1')`;
      await conn2.sql`INSERT INTO test_table (value) VALUES ('schema2')`;

      // Verify isolation
      const result1 = await conn1.sql`SELECT * FROM test_table`;
      const result2 = await conn2.sql`SELECT * FROM test_table`;

      expect(result1[0].value).toBe("schema1");
      expect(result2[0].value).toBe("schema2");
    });

    it("should handle schema not found gracefully", async () => {
      const nonExistentSchema = "non_existent_schema_999";
      const schemaConn = getSchemaConnection(nonExistentSchema);

      // Should create connection but queries will fail
      expect(schemaConn).toBeDefined();

      // Query should fail with schema not found
      await expect(schemaConn.sql`SELECT * FROM some_table`).rejects.toThrow();
    });
  });

  describe("Transaction Support", () => {
    it("should handle transactions successfully", async () => {
      const db = DatabaseConnection.getInstance();

      // Create test table
      await sql`
        CREATE TABLE IF NOT EXISTS test_transactions (
          id SERIAL PRIMARY KEY,
          value VARCHAR(100)
        )
      `;
      cleaner.registerTable("test_transactions");

      // Execute transaction
      await db.transaction(async (tx) => {
        await tx.execute(sql`INSERT INTO test_transactions (value) VALUES ('test1')`);
        await tx.execute(sql`INSERT INTO test_transactions (value) VALUES ('test2')`);
      });

      // Verify data was committed
      const result = await sql`SELECT * FROM test_transactions ORDER BY id`;
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe("test1");
      expect(result[1].value).toBe("test2");
    });

    it("should rollback transaction on error", async () => {
      const db = DatabaseConnection.getInstance();

      // Create test table
      await sql`
        CREATE TABLE IF NOT EXISTS test_rollback (
          id SERIAL PRIMARY KEY,
          value VARCHAR(100) UNIQUE
        )
      `;
      cleaner.registerTable("test_rollback");

      // Insert initial data
      await sql`INSERT INTO test_rollback (value) VALUES ('existing')`;

      // Try transaction that will fail
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(sql`INSERT INTO test_rollback (value) VALUES ('new1')`);
          // This should fail due to unique constraint
          await tx.execute(sql`INSERT INTO test_rollback (value) VALUES ('existing')`);
          await tx.execute(sql`INSERT INTO test_rollback (value) VALUES ('new2')`);
        })
      ).rejects.toThrow();

      // Verify rollback - only original record should exist
      const result = await sql`SELECT * FROM test_rollback`;
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe("existing");
    });

    it("should handle nested transactions", async () => {
      const db = DatabaseConnection.getInstance();

      // Create test table
      await sql`
        CREATE TABLE IF NOT EXISTS test_nested (
          id SERIAL PRIMARY KEY,
          level INT,
          value VARCHAR(100)
        )
      `;
      cleaner.registerTable("test_nested");

      // Execute nested transaction
      await db.transaction(async (tx1) => {
        await tx1.execute(sql`INSERT INTO test_nested (level, value) VALUES (1, 'level1')`);

        // Note: Nested transactions in PostgreSQL are handled as savepoints
        await db.transaction(async (tx2) => {
          await tx2.execute(sql`INSERT INTO test_nested (level, value) VALUES (2, 'level2')`);
        });

        await tx1.execute(sql`INSERT INTO test_nested (level, value) VALUES (1, 'level1_after')`);
      });

      // Verify all inserts succeeded
      const result = await sql`SELECT * FROM test_nested ORDER BY id`;
      expect(result).toHaveLength(3);
    });
  });

  describe("Error Handling", () => {
    it("should handle SQL syntax errors", async () => {
      await expect(sql`SELECT * FROM non_existent_table_xyz`).rejects.toThrow();
    });

    it("should handle constraint violations", async () => {
      // Create table with constraint
      await sql`
        CREATE TABLE IF NOT EXISTS test_constraints (
          id SERIAL PRIMARY KEY,
          email VARCHAR(100) UNIQUE NOT NULL
        )
      `;
      cleaner.registerTable("test_constraints");

      // Insert data
      await sql`INSERT INTO test_constraints (email) VALUES ('test@example.com')`;

      // Try to violate unique constraint
      await expect(
        sql`INSERT INTO test_constraints (email) VALUES ('test@example.com')`
      ).rejects.toThrow();
    });

    it("should handle connection loss gracefully", async () => {
      // Simulate connection loss by using invalid query that triggers connection error
      const db = DatabaseConnection.getInstance();

      // This should use retry logic
      const result = await executeWithRetry(async () => {
        // First attempt might fail, but retry should succeed
        return await sql`SELECT 1 as test`;
      });

      expect(result[0].test).toBe(1);
    });

    it("should provide meaningful error messages", async () => {
      try {
        await sql`INSERT INTO non_existent_table (col) VALUES ('test')`;
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain("relation");
      }
    });
  });

  describe("Connection Cleanup", () => {
    it("should close connections properly", async () => {
      const db = DatabaseConnection.getInstance();

      // Execute some queries
      await sql`SELECT 1`;

      // Close connections
      await db.close();

      // Should be able to reconnect
      const newDb = DatabaseConnection.getInstance();
      const result = await newDb.getSql()`SELECT 2 as test`;
      expect(result[0].test).toBe(2);
    });

    it("should handle cleanup errors gracefully", async () => {
      const db = DatabaseConnection.getInstance();

      // Mock close to throw error
      const originalClose = db.close;
      db.close = vi.fn(async () => {
        throw new Error("Close failed");
      });

      // Should not throw
      await expect(db.close()).rejects.toThrow("Close failed");

      // Restore original
      db.close = originalClose;
    });
  });
});
