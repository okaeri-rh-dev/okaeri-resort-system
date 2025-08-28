/**
 * Database Performance Tests
 * Tests query response times, connection efficiency, bulk operations, and index usage
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql, drizzleDb, executeWithRetry } from "@/lib/db/connection";
import { createProjectSchema, getProjectDb } from "@/lib/db/utils";
import { users, projects, userProjectPermissions, auditLogs } from "@/lib/db/schema";
import { eq, and, gte, lte, or, inArray, desc } from "drizzle-orm";
import {
  TEST_TIMEOUT,
  DatabaseCleaner,
  TestDatabaseSetup,
  PerformanceTracker,
  userFactory,
  projectFactory,
  bookingFactory,
  paymentFactory,
  expenseFactory,
} from "./fixtures";
import { v4 as uuidv4 } from "crypto";

describe("Database Performance", () => {
  let cleaner: DatabaseCleaner;
  let setup: TestDatabaseSetup;
  let tracker: PerformanceTracker;

  beforeAll(() => {
    cleaner = new DatabaseCleaner();
    setup = new TestDatabaseSetup();
    tracker = new PerformanceTracker();
  });

  afterAll(async () => {
    await cleaner.cleanup();

    // Log performance summary
    console.log("\n=== Performance Test Summary ===");
    const stats = tracker.getAllStats();
    stats.forEach((stat, name) => {
      if (stat) {
        console.log(`${name}:`);
        console.log(`  Count: ${stat.count}`);
        console.log(`  Avg: ${stat.avg.toFixed(2)}ms`);
        console.log(`  Median: ${stat.median.toFixed(2)}ms`);
        console.log(`  P95: ${stat.p95.toFixed(2)}ms`);
        console.log(`  Min: ${stat.min.toFixed(2)}ms`);
        console.log(`  Max: ${stat.max.toFixed(2)}ms`);
      }
    });
  });

  describe("Query Response Times", () => {
    let testProject: any;
    let testSchema: string;

    beforeAll(async () => {
      const result = await setup.setupTestProject({ createSchema: true });
      testProject = result.project;
      testSchema = result.schemaName;

      // Populate test data
      const bookings = bookingFactory.createMany(100);
      for (const booking of bookings) {
        await sql`
          INSERT INTO ${sql.identifier(testSchema)}.bookings (
            booking_code, guest_name, guest_phone, guest_email,
            check_in_date, check_out_date,
            base_price, total_amount, balance_amount,
            status, payment_status
          ) VALUES (
            ${booking.bookingCode}, ${booking.guestName}, ${booking.guestPhone}, ${booking.guestEmail},
            ${booking.checkInDate}, ${booking.checkOutDate},
            ${booking.basePrice}, ${booking.totalAmount}, ${booking.balanceAmount},
            ${booking.status}, ${booking.paymentStatus}
          )
        `;
      }
    });

    it("should execute simple queries under 50ms", async () => {
      const measurements = [];

      for (let i = 0; i < 20; i++) {
        const stop = tracker.start("simple_query");
        await sql`SELECT 1`;
        stop();
      }

      const stats = tracker.getStats("simple_query");
      expect(stats?.avg).toBeLessThan(50);
      expect(stats?.p95).toBeLessThan(100);
    });

    it("should execute indexed queries efficiently", async () => {
      // Query using indexed column (booking_code)
      for (let i = 0; i < 10; i++) {
        const stop = tracker.start("indexed_query");
        await sql`
          SELECT * FROM ${sql.identifier(testSchema)}.bookings
          WHERE booking_code = ${`BK-TEST-${i}`}
        `;
        stop();
      }

      const stats = tracker.getStats("indexed_query");
      expect(stats?.avg).toBeLessThan(100);
      expect(stats?.p95).toBeLessThan(200);
    });

    it("should handle date range queries efficiently", async () => {
      for (let i = 0; i < 10; i++) {
        const stop = tracker.start("date_range_query");
        await sql`
          SELECT * FROM ${sql.identifier(testSchema)}.bookings
          WHERE check_in_date BETWEEN '2024-01-01' AND '2024-12-31'
          ORDER BY check_in_date
          LIMIT 20
        `;
        stop();
      }

      const stats = tracker.getStats("date_range_query");
      expect(stats?.avg).toBeLessThan(200);
    });

    it("should execute aggregation queries within reasonable time", async () => {
      for (let i = 0; i < 5; i++) {
        const stop = tracker.start("aggregation_query");
        await sql`
          SELECT 
            status,
            COUNT(*) as count,
            SUM(total_amount) as total,
            AVG(total_amount) as average,
            MIN(check_in_date) as first_checkin,
            MAX(check_out_date) as last_checkout
          FROM ${sql.identifier(testSchema)}.bookings
          GROUP BY status
        `;
        stop();
      }

      const stats = tracker.getStats("aggregation_query");
      expect(stats?.avg).toBeLessThan(300);
    });

    it("should handle complex joins efficiently", async () => {
      // Create some payments for testing
      const bookings = await sql`
        SELECT id, booking_code 
        FROM ${sql.identifier(testSchema)}.bookings 
        LIMIT 20
      `;

      for (const booking of bookings) {
        const payment = paymentFactory.create({ bookingId: booking.id });
        await sql`
          INSERT INTO ${sql.identifier(testSchema)}.payments (
            booking_id, payment_code, amount, 
            payment_method, payment_type, status
          ) VALUES (
            ${payment.bookingId}, ${payment.paymentCode}, ${payment.amount},
            ${payment.paymentMethod}, ${payment.paymentType}, ${payment.status}
          )
        `;
      }

      for (let i = 0; i < 5; i++) {
        const stop = tracker.start("join_query");
        await sql`
          SELECT 
            b.booking_code,
            b.guest_name,
            b.total_amount,
            p.payment_code,
            p.amount as payment_amount,
            p.payment_method
          FROM ${sql.identifier(testSchema)}.bookings b
          LEFT JOIN ${sql.identifier(testSchema)}.payments p ON b.id = p.booking_id
          WHERE b.status = 'confirmed'
          LIMIT 50
        `;
        stop();
      }

      const stats = tracker.getStats("join_query");
      expect(stats?.avg).toBeLessThan(300);
    });
  });

  describe("Connection Pool Efficiency", () => {
    it("should handle connection reuse efficiently", async () => {
      const iterations = 50;

      const stop = tracker.start("connection_reuse");
      for (let i = 0; i < iterations; i++) {
        await sql`SELECT current_timestamp`;
      }
      stop();

      const stats = tracker.getStats("connection_reuse");
      // Average time per query should be very low due to connection reuse
      const avgPerQuery = stats!.avg / iterations;
      expect(avgPerQuery).toBeLessThan(10);
    });

    it("should handle concurrent connections efficiently", async () => {
      const concurrency = 20;

      const stop = tracker.start("concurrent_connections");
      await Promise.all(
        Array.from({ length: concurrency }, async (_, i) => {
          await sql`SELECT pg_sleep(0.01), ${i} as num`;
        })
      );
      stop();

      const stats = tracker.getStats("concurrent_connections");
      // Should complete much faster than sequential (20 * 10ms = 200ms)
      expect(stats?.avg).toBeLessThan(200);
    });

    it("should recover from connection failures quickly", async () => {
      let recoveryTime = 0;

      for (let i = 0; i < 3; i++) {
        const startTime = performance.now();

        // Simulate potential connection issue and recovery
        await executeWithRetry(async () => {
          if (Math.random() < 0.3) {
            throw new Error("Simulated connection error");
          }
          return await sql`SELECT 1`;
        });

        recoveryTime += performance.now() - startTime;
      }

      // Average recovery time should be reasonable
      expect(recoveryTime / 3).toBeLessThan(3000);
    });

    it("should maintain stable connection count", async () => {
      // Get initial connection count
      const [initial] = await sql`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state != 'idle'
      `;

      // Perform many operations
      const operations = Array.from({ length: 100 }, (_, i) => sql`SELECT ${i} as num`);

      await Promise.all(operations.slice(0, 50));

      // Check connection count mid-way
      const [midway] = await sql`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state != 'idle'
      `;

      await Promise.all(operations.slice(50));

      // Check final connection count
      const [final] = await sql`
        SELECT count(*) as count
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state != 'idle'
      `;

      // Connection count should remain relatively stable
      const variance = Math.max(
        Math.abs(midway.count - initial.count),
        Math.abs(final.count - initial.count)
      );

      expect(variance).toBeLessThanOrEqual(10);
    });
  });

  describe("Bulk Operations Performance", () => {
    let testSchema: string;

    beforeEach(async () => {
      const result = await setup.setupTestProject({ createSchema: true });
      testSchema = result.schemaName;
    });

    it("should insert bulk records efficiently", async () => {
      const bookings = bookingFactory.createMany(1000);

      const stop = tracker.start("bulk_insert");

      // Use COPY-like approach with multiple values
      const chunkSize = 100;
      for (let i = 0; i < bookings.length; i += chunkSize) {
        const chunk = bookings.slice(i, i + chunkSize);
        const values = chunk
          .map(
            (b) =>
              `('${b.bookingCode}', '${b.guestName}', '${b.guestPhone}', 
            '${b.checkInDate}', '${b.checkOutDate}',
            ${b.basePrice}, ${b.totalAmount}, ${b.balanceAmount})`
          )
          .join(",");

        await sql.unsafe(`
          INSERT INTO ${testSchema}.bookings (
            booking_code, guest_name, guest_phone,
            check_in_date, check_out_date,
            base_price, total_amount, balance_amount
          ) VALUES ${values}
        `);
      }

      stop();

      const stats = tracker.getStats("bulk_insert");
      // Should insert 1000 records in under 5 seconds
      expect(stats?.avg).toBeLessThan(5000);

      // Verify all records were inserted
      const [count] = await sql`
        SELECT COUNT(*) as count FROM ${sql.identifier(testSchema)}.bookings
      `;
      expect(Number(count.count)).toBe(1000);
    });

    it("should update bulk records efficiently", async () => {
      // Insert test data
      const bookings = bookingFactory.createMany(500);
      for (const booking of bookings) {
        await sql`
          INSERT INTO ${sql.identifier(testSchema)}.bookings (
            booking_code, guest_name, guest_phone,
            check_in_date, check_out_date,
            base_price, total_amount, balance_amount,
            status
          ) VALUES (
            ${booking.bookingCode}, ${booking.guestName}, ${booking.guestPhone},
            ${booking.checkInDate}, ${booking.checkOutDate},
            ${booking.basePrice}, ${booking.totalAmount}, ${booking.balanceAmount},
            'pending'
          )
        `;
      }

      const stop = tracker.start("bulk_update");

      // Bulk update status
      await sql`
        UPDATE ${sql.identifier(testSchema)}.bookings
        SET status = 'confirmed',
            updated_at = NOW()
        WHERE status = 'pending'
      `;

      stop();

      const stats = tracker.getStats("bulk_update");
      expect(stats?.avg).toBeLessThan(1000);

      // Verify updates
      const [count] = await sql`
        SELECT COUNT(*) as count 
        FROM ${sql.identifier(testSchema)}.bookings
        WHERE status = 'confirmed'
      `;
      expect(Number(count.count)).toBe(500);
    });

    it("should delete bulk records efficiently", async () => {
      // Insert test data
      const expenseCategories = await sql`
        INSERT INTO ${sql.identifier(testSchema)}.expense_categories (
          id, name, slug
        ) VALUES (
          gen_random_uuid(), 'Test Category', 'test-category'
        ) RETURNING id
      `;

      const expenses = expenseFactory.createMany(500, {
        categoryId: expenseCategories[0].id,
      });

      for (const expense of expenses) {
        await sql`
          INSERT INTO ${sql.identifier(testSchema)}.expenses (
            expense_code, category_id, description, amount
          ) VALUES (
            ${expense.expenseCode}, ${expense.categoryId}, 
            ${expense.description}, ${expense.amount}
          )
        `;
      }

      const stop = tracker.start("bulk_delete");

      // Bulk delete
      await sql`
        DELETE FROM ${sql.identifier(testSchema)}.expenses
        WHERE category_id = ${expenseCategories[0].id}
      `;

      stop();

      const stats = tracker.getStats("bulk_delete");
      expect(stats?.avg).toBeLessThan(1000);

      // Verify deletion
      const [count] = await sql`
        SELECT COUNT(*) as count 
        FROM ${sql.identifier(testSchema)}.expenses
        WHERE category_id = ${expenseCategories[0].id}
      `;
      expect(Number(count.count)).toBe(0);
    });

    it("should handle batch processing efficiently", async () => {
      // Insert large dataset
      const bookings = bookingFactory.createMany(2000);
      const chunkSize = 100;

      for (let i = 0; i < bookings.length; i += chunkSize) {
        const chunk = bookings.slice(i, i + chunkSize);
        for (const booking of chunk) {
          await sql`
            INSERT INTO ${sql.identifier(testSchema)}.bookings (
              booking_code, guest_name, guest_phone,
              check_in_date, check_out_date,
              base_price, total_amount, balance_amount
            ) VALUES (
              ${booking.bookingCode}, ${booking.guestName}, ${booking.guestPhone},
              ${booking.checkInDate}, ${booking.checkOutDate},
              ${booking.basePrice}, ${booking.totalAmount}, ${booking.balanceAmount}
            )
          `;
        }
      }

      // Process in batches
      const stop = tracker.start("batch_processing");

      let processed = 0;
      let lastId = null;
      const batchSize = 200;

      while (true) {
        const batch = await sql`
          SELECT id, booking_code, total_amount
          FROM ${sql.identifier(testSchema)}.bookings
          ${lastId ? sql`WHERE id > ${lastId}` : sql``}
          ORDER BY id
          LIMIT ${batchSize}
        `;

        if (batch.length === 0) break;

        // Simulate processing
        for (const record of batch) {
          // Process record (e.g., calculate fees, update status, etc.)
          processed++;
        }

        lastId = batch[batch.length - 1].id;
      }

      stop();

      expect(processed).toBe(2000);

      const stats = tracker.getStats("batch_processing");
      // Should process 2000 records efficiently
      expect(stats?.avg).toBeLessThan(5000);
    });
  });

  describe("Index Usage Verification", () => {
    let testSchema: string;

    beforeAll(async () => {
      const result = await setup.setupTestProject({ createSchema: true });
      testSchema = result.schemaName;

      // Populate with test data
      const bookings = bookingFactory.createMany(1000);
      for (const booking of bookings) {
        await sql`
          INSERT INTO ${sql.identifier(testSchema)}.bookings (
            booking_code, guest_name, guest_phone,
            check_in_date, check_out_date,
            base_price, total_amount, balance_amount,
            status, payment_status
          ) VALUES (
            ${booking.bookingCode}, ${booking.guestName}, ${booking.guestPhone},
            ${booking.checkInDate}, ${booking.checkOutDate},
            ${booking.basePrice}, ${booking.totalAmount}, ${booking.balanceAmount},
            ${booking.status}, ${booking.paymentStatus}
          )
        `;
      }

      // Run ANALYZE to update statistics
      await sql`ANALYZE ${sql.identifier(testSchema)}.bookings`;
    });

    it("should use index for unique lookups", async () => {
      const plan = await sql`
        EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS)
        SELECT * FROM ${sql.identifier(testSchema)}.bookings
        WHERE booking_code = 'BK-TEST-001'
      `;

      const planJson = plan[0]["QUERY PLAN"][0];

      // Should use index scan
      expect(JSON.stringify(planJson)).toContain("Index Scan");

      // Execution time should be low
      const executionTime =
        planJson["Execution Time"] || planJson["Planning Time"] + planJson["Execution Time"];
      expect(executionTime).toBeLessThan(10);
    });

    it("should use index for date range queries", async () => {
      const plan = await sql`
        EXPLAIN (FORMAT JSON, ANALYZE)
        SELECT * FROM ${sql.identifier(testSchema)}.bookings
        WHERE check_in_date BETWEEN '2024-01-01' AND '2024-01-31'
      `;

      const planText = JSON.stringify(plan[0]["QUERY PLAN"]);

      // Should use index for date filtering
      expect(planText.toLowerCase()).toMatch(/index|bitmap/);
    });

    it("should use covering index for count queries", async () => {
      const plan = await sql`
        EXPLAIN (FORMAT JSON, ANALYZE)
        SELECT COUNT(*) FROM ${sql.identifier(testSchema)}.bookings
        WHERE status = 'confirmed'
      `;

      const planJson = plan[0]["QUERY PLAN"][0];

      // Should be efficient
      const totalCost = planJson["Total Cost"] || planJson["Plan"]["Total Cost"];
      expect(totalCost).toBeLessThan(10000);
    });

    it("should use composite index effectively", async () => {
      // Create composite index if not exists
      await sql`
        CREATE INDEX IF NOT EXISTS bookings_status_payment_idx
        ON ${sql.identifier(testSchema)}.bookings(status, payment_status)
      `;

      const plan = await sql`
        EXPLAIN (FORMAT JSON, ANALYZE)
        SELECT * FROM ${sql.identifier(testSchema)}.bookings
        WHERE status = 'confirmed' AND payment_status = 'paid'
        LIMIT 10
      `;

      const planText = JSON.stringify(plan[0]["QUERY PLAN"]);

      // Should use the composite index
      expect(planText).toContain("Index");
    });

    it("should optimize ORDER BY with indexes", async () => {
      const plan = await sql`
        EXPLAIN (FORMAT JSON, ANALYZE)
        SELECT * FROM ${sql.identifier(testSchema)}.bookings
        ORDER BY created_at DESC
        LIMIT 20
      `;

      const planJson = plan[0]["QUERY PLAN"][0];

      // Should avoid full sort if index exists
      const planText = JSON.stringify(planJson);
      if (planText.includes("Sort")) {
        // If sorting, it should be on a small result set
        const sortNode = JSON.stringify(planJson).match(/"Sort Method":"[^"]+"/);
        expect(sortNode).toBeTruthy();
      }
    });

    it("should identify missing indexes", async () => {
      // Query without good index
      const plan = await sql`
        EXPLAIN (FORMAT JSON, ANALYZE)
        SELECT * FROM ${sql.identifier(testSchema)}.bookings
        WHERE guest_email LIKE '%@gmail.com'
      `;

      const planText = JSON.stringify(plan[0]["QUERY PLAN"]);

      // Should show sequential scan (indicating potential for index)
      expect(planText).toContain("Seq Scan");

      // This helps identify where indexes might be needed
      console.log("Potential index needed for guest_email pattern matching");
    });
  });

  describe("Query Optimization", () => {
    let testSchema: string;

    beforeAll(async () => {
      const result = await setup.setupTestProject({ createSchema: true });
      testSchema = result.schemaName;
    });

    it("should optimize subqueries with EXISTS", async () => {
      // Less optimal: Using IN with subquery
      const stopIn = tracker.start("subquery_in");
      await sql`
        SELECT * FROM ${sql.identifier(testSchema)}.bookings b
        WHERE b.id IN (
          SELECT booking_id FROM ${sql.identifier(testSchema)}.payments
          WHERE status = 'completed'
        )
      `;
      stopIn();

      // More optimal: Using EXISTS
      const stopExists = tracker.start("subquery_exists");
      await sql`
        SELECT * FROM ${sql.identifier(testSchema)}.bookings b
        WHERE EXISTS (
          SELECT 1 FROM ${sql.identifier(testSchema)}.payments p
          WHERE p.booking_id = b.id AND p.status = 'completed'
        )
      `;
      stopExists();

      const inStats = tracker.getStats("subquery_in");
      const existsStats = tracker.getStats("subquery_exists");

      // EXISTS should generally be faster or equal
      if (inStats && existsStats) {
        expect(existsStats.avg).toBeLessThanOrEqual(inStats.avg * 1.5);
      }
    });

    it("should optimize pagination queries", async () => {
      // Insert test data
      const bookings = bookingFactory.createMany(500);
      for (const booking of bookings) {
        await sql`
          INSERT INTO ${sql.identifier(testSchema)}.bookings (
            booking_code, guest_name, guest_phone,
            check_in_date, check_out_date,
            base_price, total_amount, balance_amount
          ) VALUES (
            ${booking.bookingCode}, ${booking.guestName}, ${booking.guestPhone},
            ${booking.checkInDate}, ${booking.checkOutDate},
            ${booking.basePrice}, ${booking.totalAmount}, ${booking.balanceAmount}
          )
        `;
      }

      // Test OFFSET pagination (less optimal for large offsets)
      const stopOffset = tracker.start("pagination_offset");
      await sql`
        SELECT * FROM ${sql.identifier(testSchema)}.bookings
        ORDER BY created_at DESC
        LIMIT 20 OFFSET 200
      `;
      stopOffset();

      // Test cursor-based pagination (more optimal)
      const [lastRecord] = await sql`
        SELECT id, created_at FROM ${sql.identifier(testSchema)}.bookings
        ORDER BY created_at DESC
        LIMIT 1 OFFSET 199
      `;

      const stopCursor = tracker.start("pagination_cursor");
      await sql`
        SELECT * FROM ${sql.identifier(testSchema)}.bookings
        WHERE created_at <= ${lastRecord.created_at}
          AND id < ${lastRecord.id}
        ORDER BY created_at DESC, id DESC
        LIMIT 20
      `;
      stopCursor();

      const offsetStats = tracker.getStats("pagination_offset");
      const cursorStats = tracker.getStats("pagination_cursor");

      // Cursor pagination should be faster for deep pagination
      if (offsetStats && cursorStats) {
        expect(cursorStats.avg).toBeLessThanOrEqual(offsetStats.avg * 1.2);
      }
    });

    it("should optimize aggregate queries with materialized views", async () => {
      // Create a materialized view for common aggregates
      await sql`
        CREATE MATERIALIZED VIEW IF NOT EXISTS ${sql.identifier(testSchema)}.booking_stats AS
        SELECT 
          DATE(check_in_date) as date,
          COUNT(*) as total_bookings,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_booking_value,
          COUNT(DISTINCT guest_phone) as unique_guests
        FROM ${sql.identifier(testSchema)}.bookings
        GROUP BY DATE(check_in_date)
      `;

      await sql`
        REFRESH MATERIALIZED VIEW ${sql.identifier(testSchema)}.booking_stats
      `;

      // Query from materialized view (fast)
      const stopMV = tracker.start("query_materialized_view");
      await sql`
        SELECT * FROM ${sql.identifier(testSchema)}.booking_stats
        WHERE date BETWEEN '2024-01-01' AND '2024-12-31'
      `;
      stopMV();

      // Same query from base table (slower)
      const stopBase = tracker.start("query_base_aggregate");
      await sql`
        SELECT 
          DATE(check_in_date) as date,
          COUNT(*) as total_bookings,
          SUM(total_amount) as total_revenue,
          AVG(total_amount) as avg_booking_value,
          COUNT(DISTINCT guest_phone) as unique_guests
        FROM ${sql.identifier(testSchema)}.bookings
        WHERE DATE(check_in_date) BETWEEN '2024-01-01' AND '2024-12-31'
        GROUP BY DATE(check_in_date)
      `;
      stopBase();

      const mvStats = tracker.getStats("query_materialized_view");
      const baseStats = tracker.getStats("query_base_aggregate");

      // Materialized view should be significantly faster
      if (mvStats && baseStats) {
        expect(mvStats.avg).toBeLessThan(baseStats.avg);
      }
    });
  });

  describe("Connection Recovery", () => {
    it("should handle connection drops gracefully", async () => {
      const operations = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          executeWithRetry(async () => {
            // Simulate occasional connection issues
            if (Math.random() < 0.2) {
              throw new Error("Connection lost");
            }
            return await sql`SELECT ${i} as num`;
          })
        );
      }

      const results = await Promise.allSettled(operations);

      // Most operations should succeed despite simulated failures
      const successful = results.filter((r) => r.status === "fulfilled");
      expect(successful.length).toBeGreaterThanOrEqual(8);
    });

    it("should maintain performance after connection recovery", async () => {
      // Measure performance before simulated failure
      const stopBefore = tracker.start("before_recovery");
      for (let i = 0; i < 5; i++) {
        await sql`SELECT 1`;
      }
      stopBefore();

      // Simulate connection issue and recovery
      try {
        await sql`SELECT pg_terminate_backend(pg_backend_pid())`;
      } catch {
        // Expected to fail
      }

      // Wait a moment for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Measure performance after recovery
      const stopAfter = tracker.start("after_recovery");
      for (let i = 0; i < 5; i++) {
        await sql`SELECT 1`;
      }
      stopAfter();

      const beforeStats = tracker.getStats("before_recovery");
      const afterStats = tracker.getStats("after_recovery");

      // Performance should be similar after recovery
      if (beforeStats && afterStats) {
        expect(afterStats.avg).toBeLessThan(beforeStats.avg * 2);
      }
    });
  });
});
