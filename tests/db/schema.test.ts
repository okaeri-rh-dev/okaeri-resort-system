/**
 * Database Schema Tests
 * Tests schema creation, foreign key relationships, indexes, and table structures
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql, drizzleDb } from "@/lib/db/connection";
import { createProjectSchema, dropProjectSchema } from "@/lib/db/utils";
import { users, projects, userProjectPermissions, auditLogs } from "@/lib/db/schema";
import {
  TEST_TIMEOUT,
  DatabaseCleaner,
  TestDatabaseSetup,
  generateTestSchemaName,
  userFactory,
  projectFactory,
} from "./fixtures";

describe("Database Schema", () => {
  let cleaner: DatabaseCleaner;
  let setup: TestDatabaseSetup;

  beforeAll(() => {
    cleaner = new DatabaseCleaner();
    setup = new TestDatabaseSetup();
  });

  afterAll(async () => {
    await cleaner.cleanup();
  });

  describe("Global Schema Tables", () => {
    describe("Users Table", () => {
      it(
        "should have all required columns",
        async () => {
          const result = await sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position
        `;

          const columnMap = new Map(result.map((col) => [col.column_name, col]));

          // Check required columns exist
          expect(columnMap.has("id")).toBe(true);
          expect(columnMap.has("email")).toBe(true);
          expect(columnMap.has("password_hash")).toBe(true);
          expect(columnMap.has("first_name")).toBe(true);
          expect(columnMap.has("last_name")).toBe(true);
          expect(columnMap.has("created_at")).toBe(true);
          expect(columnMap.has("updated_at")).toBe(true);

          // Check data types
          expect(columnMap.get("id")?.data_type).toBe("uuid");
          expect(columnMap.get("email")?.data_type).toBe("character varying");
          expect(columnMap.get("password_hash")?.data_type).toBe("text");

          // Check nullable constraints
          expect(columnMap.get("email")?.is_nullable).toBe("NO");
          expect(columnMap.get("password_hash")?.is_nullable).toBe("NO");
          expect(columnMap.get("phone")?.is_nullable).toBe("YES");
        },
        TEST_TIMEOUT
      );

      it("should have proper indexes", async () => {
        const result = await sql`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'users'
        `;

        const indexNames = result.map((idx) => idx.indexname);

        // Check for expected indexes
        expect(indexNames).toContain("users_pkey");
        expect(indexNames).toContain("users_email_idx");
        expect(indexNames.some((name) => name.includes("phone"))).toBe(true);
        expect(indexNames.some((name) => name.includes("last_login"))).toBe(true);
      });

      it("should enforce unique email constraint", async () => {
        const user1 = userFactory.create({ email: "unique@test.com" });
        const user2 = userFactory.create({ email: "unique@test.com" });

        // First insert should succeed
        await drizzleDb.insert(users).values(user1);
        cleaner.registerTable("users");

        // Second insert should fail
        await expect(drizzleDb.insert(users).values(user2)).rejects.toThrow();
      });

      it("should store and retrieve JSON preferences correctly", async () => {
        const user = userFactory.create({
          preferences: {
            language: "fil",
            timezone: "Asia/Manila",
            notifications: {
              email: true,
              sms: false,
              push: true,
            },
          },
        });

        await drizzleDb.insert(users).values(user);
        cleaner.registerTable("users");

        const [retrieved] = await drizzleDb.select().from(users).where(eq(users.id, user.id));

        expect(retrieved.preferences).toEqual(user.preferences);
      });
    });

    describe("Projects Table", () => {
      it("should have all required columns", async () => {
        const result = await sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'projects'
          ORDER BY ordinal_position
        `;

        const columnMap = new Map(result.map((col) => [col.column_name, col]));

        // Check business-critical columns
        expect(columnMap.has("id")).toBe(true);
        expect(columnMap.has("name")).toBe(true);
        expect(columnMap.has("slug")).toBe(true);
        expect(columnMap.has("schema_name")).toBe(true);
        expect(columnMap.has("owner_id")).toBe(true);
        expect(columnMap.has("currency")).toBe(true);
        expect(columnMap.has("timezone")).toBe(true);
        expect(columnMap.has("is_active")).toBe(true);

        // Check Philippine-specific fields
        expect(columnMap.has("country")).toBe(true);
        expect(columnMap.get("country")?.column_default).toContain("PH");
        expect(columnMap.get("currency")?.column_default).toContain("PHP");
        expect(columnMap.get("timezone")?.column_default).toContain("Asia/Manila");
      });

      it("should enforce unique constraints", async () => {
        const owner = userFactory.create();
        await drizzleDb.insert(users).values(owner);
        cleaner.registerTable("users");

        const project1 = projectFactory.create({
          ownerId: owner.id,
          slug: "unique-slug",
          schemaName: "unique_schema",
        });

        const project2 = projectFactory.create({
          ownerId: owner.id,
          slug: "unique-slug", // Same slug
          schemaName: "different_schema",
        });

        await drizzleDb.insert(projects).values(project1);
        cleaner.registerTable("projects");

        // Should fail due to duplicate slug
        await expect(drizzleDb.insert(projects).values(project2)).rejects.toThrow();
      });

      it("should have proper foreign key to users table", async () => {
        const result = await sql`
          SELECT 
            conname as constraint_name,
            confrelid::regclass as foreign_table
          FROM pg_constraint
          WHERE conrelid = 'public.projects'::regclass
            AND contype = 'f'
            AND conname LIKE '%owner%'
        `;

        expect(result.length).toBeGreaterThan(0);
        expect(result[0].foreign_table).toBe("users");
      });

      it("should store complex settings JSON correctly", async () => {
        const owner = userFactory.create();
        await drizzleDb.insert(users).values(owner);
        cleaner.registerTable("users");

        const complexSettings = {
          bookingRules: {
            advanceBookingDays: 90,
            cancellationHours: 24,
            requireDeposit: true,
            depositPercentage: 30,
          },
          paymentMethods: {
            cash: true,
            gcash: true,
            bankTransfer: true,
            creditCard: false,
          },
          notifications: {
            bookingConfirmation: true,
            paymentReceived: true,
            dailyReport: false,
          },
        };

        const project = projectFactory.create({
          ownerId: owner.id,
          settings: complexSettings,
        });

        await drizzleDb.insert(projects).values(project);
        cleaner.registerTable("projects");

        const [retrieved] = await drizzleDb
          .select()
          .from(projects)
          .where(eq(projects.id, project.id));

        expect(retrieved.settings).toEqual(complexSettings);
      });
    });

    describe("User Project Permissions Table", () => {
      it("should have composite primary key", async () => {
        const result = await sql`
          SELECT 
            conname as constraint_name,
            contype as constraint_type
          FROM pg_constraint
          WHERE conrelid = 'public.user_project_permissions'::regclass
            AND contype = 'p'
        `;

        expect(result.length).toBe(1);
        expect(result[0].constraint_type).toBe("p"); // Primary key
      });

      it("should enforce foreign key relationships", async () => {
        const result = await sql`
          SELECT 
            conname as constraint_name,
            confrelid::regclass as foreign_table
          FROM pg_constraint
          WHERE conrelid = 'public.user_project_permissions'::regclass
            AND contype = 'f'
          ORDER BY conname
        `;

        const foreignTables = result.map((r) => r.foreign_table);
        expect(foreignTables).toContain("users");
        expect(foreignTables).toContain("projects");
      });

      it("should cascade delete when user is deleted", async () => {
        const { user, project, cleanup } = await setup.setupTestProject();

        // Add permission
        await drizzleDb.insert(userProjectPermissions).values({
          userId: user.id,
          projectId: project.id,
          role: "admin",
          permissions: {},
          isActive: true,
        });

        // Delete user
        await drizzleDb.delete(users).where(eq(users.id, user.id));

        // Permission should be deleted
        const permissions = await drizzleDb
          .select()
          .from(userProjectPermissions)
          .where(eq(userProjectPermissions.userId, user.id));

        expect(permissions).toHaveLength(0);

        await cleanup();
      });

      it("should store granular permissions correctly", async () => {
        const { user, project, cleanup } = await setup.setupTestProject();

        const detailedPermissions = {
          bookings: {
            view: true,
            create: true,
            update: false,
            delete: false,
          },
          payments: {
            view: true,
            create: false,
            update: false,
            delete: false,
          },
          reports: {
            view: true,
            export: false,
          },
        };

        await drizzleDb.insert(userProjectPermissions).values({
          userId: user.id,
          projectId: project.id,
          role: "staff",
          permissions: detailedPermissions,
          isActive: true,
        });

        const [retrieved] = await drizzleDb
          .select()
          .from(userProjectPermissions)
          .where(
            and(
              eq(userProjectPermissions.userId, user.id),
              eq(userProjectPermissions.projectId, project.id)
            )
          );

        expect(retrieved.permissions).toEqual(detailedPermissions);

        await cleanup();
      });
    });

    describe("Audit Logs Table", () => {
      it("should have proper indexes for querying", async () => {
        const result = await sql`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'audit_logs'
        `;

        const indexNames = result.map((idx) => idx.indexname);

        // Check for performance-critical indexes
        expect(indexNames.some((name) => name.includes("user"))).toBe(true);
        expect(indexNames.some((name) => name.includes("project"))).toBe(true);
        expect(indexNames.some((name) => name.includes("category"))).toBe(true);
        expect(indexNames.some((name) => name.includes("created_at"))).toBe(true);
        expect(indexNames.some((name) => name.includes("request_id"))).toBe(true);
      });

      it("should store audit entries with all fields", async () => {
        const user = userFactory.create();
        const project = projectFactory.create({ ownerId: user.id });

        await drizzleDb.insert(users).values(user);
        await drizzleDb.insert(projects).values(project);
        cleaner.registerTable("audit_logs");
        cleaner.registerTable("projects");
        cleaner.registerTable("users");

        const auditEntry = {
          userId: user.id,
          projectId: project.id,
          action: "test_action",
          category: "booking",
          severity: "info",
          ipAddress: "127.0.0.1",
          userAgent: "Test Agent",
          requestMethod: "POST",
          requestPath: "/api/test",
          requestId: uuidv4(),
          entityType: "booking",
          entityId: uuidv4(),
          oldValues: { status: "pending" },
          newValues: { status: "confirmed" },
          success: true,
          metadata: { test: true },
        };

        await drizzleDb.insert(auditLogs).values(auditEntry);

        const [retrieved] = await drizzleDb
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.requestId, auditEntry.requestId));

        expect(retrieved.action).toBe(auditEntry.action);
        expect(retrieved.oldValues).toEqual(auditEntry.oldValues);
        expect(retrieved.newValues).toEqual(auditEntry.newValues);
      });
    });
  });

  describe("Project Schema Creation", () => {
    it(
      "should create all project-specific tables",
      async () => {
        const schemaName = generateTestSchemaName();
        const projectId = uuidv4();

        const result = await createProjectSchema(projectId, schemaName);
        expect(result.success).toBe(true);

        cleaner.registerSchema(schemaName);

        // Check that all tables exist in the schema
        const tables = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schemaName}
        ORDER BY table_name
      `;

        const tableNames = tables.map((t) => t.table_name);

        // Verify all required tables exist
        expect(tableNames).toContain("bookings");
        expect(tableNames).toContain("payments");
        expect(tableNames).toContain("expense_categories");
        expect(tableNames).toContain("expenses");
        expect(tableNames).toContain("income");
        expect(tableNames).toContain("booking_timeline");
        expect(tableNames).toContain("project_settings");
      },
      TEST_TIMEOUT
    );

    it("should create proper indexes on project tables", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Check bookings table indexes
      const bookingIndexes = await sql`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = ${schemaName} AND tablename = 'bookings'
      `;

      const indexNames = bookingIndexes.map((idx) => idx.indexname);

      expect(indexNames.some((name) => name.includes("booking_code"))).toBe(true);
      expect(indexNames.some((name) => name.includes("check_in_date"))).toBe(true);
      expect(indexNames.some((name) => name.includes("check_out_date"))).toBe(true);
      expect(indexNames.some((name) => name.includes("status"))).toBe(true);
    });

    it("should create foreign key relationships within schema", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Check foreign keys in payments table
      const result = await sql`
        SELECT 
          conname as constraint_name,
          confrelid::regclass as foreign_table
        FROM pg_constraint
        WHERE conrelid = '${sql.identifier(schemaName)}.payments'::regclass
          AND contype = 'f'
      `;

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].foreign_table).toContain("bookings");
    });

    it("should handle Philippine Peso decimal precision", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Check decimal precision for amount fields
      const result = await sql`
        SELECT column_name, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = ${schemaName} 
          AND table_name = 'bookings'
          AND data_type = 'numeric'
      `;

      result.forEach((col) => {
        if (col.column_name.includes("amount") || col.column_name.includes("price")) {
          expect(col.numeric_precision).toBe(12);
          expect(col.numeric_scale).toBe(2);
        }
      });
    });

    it("should create default expense categories", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Check default categories
      const categories = await sql`
        SELECT name, slug
        FROM ${sql.identifier(schemaName)}.expense_categories
        ORDER BY sort_order
      `;

      const slugs = categories.map((c) => c.slug);

      // Verify essential categories exist
      expect(slugs).toContain("utilities");
      expect(slugs).toContain("maintenance");
      expect(slugs).toContain("supplies");
      expect(slugs).toContain("staff");
      expect(slugs).toContain("marketing");
    });

    it("should support GCash payment fields", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Check GCash-specific columns
      const result = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = ${schemaName}
          AND table_name = 'payments'
          AND column_name LIKE 'gcash%'
      `;

      const gcashColumns = result.map((c) => c.column_name);

      expect(gcashColumns).toContain("gcash_reference_number");
      expect(gcashColumns).toContain("gcash_account_name");
      expect(gcashColumns).toContain("gcash_account_number");
    });
  });

  describe("Schema Constraints", () => {
    it("should enforce booking date constraints", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Try to insert booking with check-out before check-in
      await expect(sql`
        INSERT INTO ${sql.identifier(schemaName)}.bookings (
          booking_code, guest_name, guest_phone,
          check_in_date, check_out_date,
          base_price, total_amount, balance_amount
        ) VALUES (
          'TEST001', 'Test Guest', '09171234567',
          '2024-12-02', '2024-12-01',
          5000, 5000, 5000
        )
      `).rejects.toThrow();
    });

    it("should enforce positive amount constraints", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Try to insert payment with negative amount
      await expect(sql`
        INSERT INTO ${sql.identifier(schemaName)}.payments (
          payment_code, amount, payment_method, payment_type
        ) VALUES (
          'PAY001', -1000, 'cash', 'deposit'
        )
      `).rejects.toThrow();
    });

    it("should handle cascade deletes in booking timeline", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Insert booking
      await sql`
        INSERT INTO ${sql.identifier(schemaName)}.bookings (
          id, booking_code, guest_name, guest_phone,
          check_in_date, check_out_date,
          base_price, total_amount, balance_amount
        ) VALUES (
          gen_random_uuid(), 'TEST001', 'Test Guest', '09171234567',
          '2024-12-01', '2024-12-03',
          5000, 5000, 5000
        )
      `;

      const [booking] = await sql`
        SELECT id FROM ${sql.identifier(schemaName)}.bookings
        WHERE booking_code = 'TEST001'
      `;

      // Insert timeline entry
      await sql`
        INSERT INTO ${sql.identifier(schemaName)}.booking_timeline (
          booking_id, event_type, event_title
        ) VALUES (
          ${booking.id}, 'created', 'Booking created'
        )
      `;

      // Delete booking
      await sql`
        DELETE FROM ${sql.identifier(schemaName)}.bookings
        WHERE id = ${booking.id}
      `;

      // Timeline entry should be deleted
      const timeline = await sql`
        SELECT * FROM ${sql.identifier(schemaName)}.booking_timeline
        WHERE booking_id = ${booking.id}
      `;

      expect(timeline).toHaveLength(0);
    });
  });

  describe("Index Performance", () => {
    it("should use index for booking date queries", async () => {
      const schemaName = generateTestSchemaName();
      const projectId = uuidv4();

      await createProjectSchema(projectId, schemaName);
      cleaner.registerSchema(schemaName);

      // Check query plan uses index
      const plan = await sql`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM ${sql.identifier(schemaName)}.bookings
        WHERE check_in_date = '2024-12-01'
      `;

      const planText = JSON.stringify(plan[0]["QUERY PLAN"]);
      expect(planText).toContain("Index");
    });

    it("should use composite indexes effectively", async () => {
      // Check audit logs composite index usage
      const plan = await sql`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM audit_logs
        WHERE entity_type = 'booking' AND entity_id = gen_random_uuid()
      `;

      const planText = JSON.stringify(plan[0]["QUERY PLAN"]);
      expect(planText).toContain("Index");
    });
  });
});

// Import required functions
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "crypto";
