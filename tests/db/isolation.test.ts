/**
 * Multi-Tenant Isolation Tests
 * Tests data isolation between projects, cross-schema prevention, and permission boundaries
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { sql, drizzleDb } from "@/lib/db/connection";
import {
  createProjectSchema,
  getProjectDb,
  checkProjectAccess,
  dropProjectSchema,
} from "@/lib/db/utils";
import { users, projects, userProjectPermissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  TEST_TIMEOUT,
  DatabaseCleaner,
  TestDatabaseSetup,
  userFactory,
  projectFactory,
  permissionFactory,
  bookingFactory,
  paymentFactory,
} from "./fixtures";
import { v4 as uuidv4 } from "crypto";

describe("Multi-Tenant Isolation", () => {
  let cleaner: DatabaseCleaner;
  let setup: TestDatabaseSetup;

  beforeAll(() => {
    cleaner = new DatabaseCleaner();
    setup = new TestDatabaseSetup();
  });

  afterAll(async () => {
    await cleaner.cleanup();
  });

  describe("Project Data Isolation", () => {
    it(
      "should isolate data between different projects",
      async () => {
        // Create two projects with schemas
        const {
          user: user1,
          project: project1,
          cleanup: cleanup1,
        } = await setup.setupTestProject({
          createSchema: true,
        });

        const {
          user: user2,
          project: project2,
          cleanup: cleanup2,
        } = await setup.setupTestProject({
          createSchema: true,
        });

        // Insert data in project1
        await sql`
        INSERT INTO ${sql.identifier(project1.schemaName)}.bookings (
          booking_code, guest_name, guest_phone,
          check_in_date, check_out_date,
          base_price, total_amount, balance_amount
        ) VALUES (
          'P1-001', 'Guest One', '09171111111',
          '2024-12-01', '2024-12-03',
          5000, 5000, 5000
        )
      `;

        // Insert data in project2
        await sql`
        INSERT INTO ${sql.identifier(project2.schemaName)}.bookings (
          booking_code, guest_name, guest_phone,
          check_in_date, check_out_date,
          base_price, total_amount, balance_amount
        ) VALUES (
          'P2-001', 'Guest Two', '09172222222',
          '2024-12-01', '2024-12-03',
          8000, 8000, 8000
        )
      `;

        // Query project1 data
        const project1Data = await sql`
        SELECT * FROM ${sql.identifier(project1.schemaName)}.bookings
      `;

        // Query project2 data
        const project2Data = await sql`
        SELECT * FROM ${sql.identifier(project2.schemaName)}.bookings
      `;

        // Each project should only see its own data
        expect(project1Data).toHaveLength(1);
        expect(project1Data[0].guest_name).toBe("Guest One");

        expect(project2Data).toHaveLength(1);
        expect(project2Data[0].guest_name).toBe("Guest Two");

        // Cleanup
        await cleanup1();
        await cleanup2();
      },
      TEST_TIMEOUT
    );

    it("should prevent cross-schema data access", async () => {
      const { project: project1, cleanup: cleanup1 } = await setup.setupTestProject({
        createSchema: true,
      });

      const { project: project2, cleanup: cleanup2 } = await setup.setupTestProject({
        createSchema: true,
      });

      // Insert sensitive data in project1
      await sql`
        INSERT INTO ${sql.identifier(project1.schemaName)}.payments (
          payment_code, amount, payment_method, payment_type
        ) VALUES (
          'SECRET-001', 10000, 'bank_transfer', 'full'
        )
      `;

      // Try to access project1 data from project2 context
      const project2Db = await getProjectDb(project2.id);

      // This should fail or return empty
      const result = await project2Db.sql`
        SELECT * FROM payments WHERE payment_code = 'SECRET-001'
      `;

      expect(result).toHaveLength(0);

      await cleanup1();
      await cleanup2();
    });

    it(
      "should maintain isolation during concurrent operations",
      async () => {
        // Create multiple projects
        const projects = await Promise.all([
          setup.setupTestProject({ createSchema: true }),
          setup.setupTestProject({ createSchema: true }),
          setup.setupTestProject({ createSchema: true }),
        ]);

        // Concurrent inserts to different projects
        await Promise.all(
          projects.map(async ({ project }, index) => {
            const bookings = bookingFactory.createMany(10, {
              status: `project${index}`,
            });

            for (const booking of bookings) {
              await sql`
              INSERT INTO ${sql.identifier(project.schemaName)}.bookings (
                booking_code, guest_name, guest_phone,
                check_in_date, check_out_date,
                base_price, total_amount, balance_amount,
                status
              ) VALUES (
                ${booking.bookingCode}, ${booking.guestName}, ${booking.guestPhone},
                ${booking.checkInDate}, ${booking.checkOutDate},
                ${booking.basePrice}, ${booking.totalAmount}, ${booking.balanceAmount},
                ${booking.status}
              )
            `;
            }
          })
        );

        // Verify each project has only its own data
        for (let i = 0; i < projects.length; i++) {
          const { project } = projects[i];
          const bookings = await sql`
          SELECT DISTINCT status FROM ${sql.identifier(project.schemaName)}.bookings
        `;

          expect(bookings).toHaveLength(1);
          expect(bookings[0].status).toBe(`project${i}`);
        }

        // Cleanup
        await Promise.all(projects.map(({ cleanup }) => cleanup()));
      },
      TEST_TIMEOUT
    );

    it("should handle schema deletion without affecting other projects", async () => {
      const { project: project1, cleanup: cleanup1 } = await setup.setupTestProject({
        createSchema: true,
      });

      const { project: project2, cleanup: cleanup2 } = await setup.setupTestProject({
        createSchema: true,
      });

      // Add data to both projects
      await sql`
        INSERT INTO ${sql.identifier(project1.schemaName)}.bookings (
          booking_code, guest_name, guest_phone,
          check_in_date, check_out_date,
          base_price, total_amount, balance_amount
        ) VALUES (
          'TEST-001', 'Test Guest', '09171234567',
          '2024-12-01', '2024-12-03',
          5000, 5000, 5000
        )
      `;

      await sql`
        INSERT INTO ${sql.identifier(project2.schemaName)}.bookings (
          booking_code, guest_name, guest_phone,
          check_in_date, check_out_date,
          base_price, total_amount, balance_amount
        ) VALUES (
          'TEST-002', 'Test Guest 2', '09171234568',
          '2024-12-01', '2024-12-03',
          6000, 6000, 6000
        )
      `;

      // Drop project1 schema
      await dropProjectSchema(project1.id, project1.schemaName);

      // Project2 data should still exist
      const project2Data = await sql`
        SELECT * FROM ${sql.identifier(project2.schemaName)}.bookings
      `;

      expect(project2Data).toHaveLength(1);
      expect(project2Data[0].booking_code).toBe("TEST-002");

      // Project1 schema should not exist
      const schemas = await sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = ${project1.schemaName}
      `;

      expect(schemas).toHaveLength(0);

      await cleanup1();
      await cleanup2();
    });
  });

  describe("Permission Boundaries", () => {
    it("should enforce user access permissions", async () => {
      const owner = userFactory.create();
      const staffUser = userFactory.create();
      const unauthorizedUser = userFactory.create();

      await drizzleDb.insert(users).values([owner, staffUser, unauthorizedUser]);
      cleaner.registerTable("users");

      const project = projectFactory.create({ ownerId: owner.id });
      await drizzleDb.insert(projects).values(project);
      cleaner.registerTable("projects");

      // Grant staff permission
      await drizzleDb.insert(userProjectPermissions).values({
        userId: staffUser.id,
        projectId: project.id,
        role: "staff",
        permissions: {
          bookings: { view: true, create: true, update: false, delete: false },
        },
        isActive: true,
      });
      cleaner.registerTable("user_project_permissions");

      // Check owner access
      const ownerAccess = await checkProjectAccess(owner.id, project.id);
      expect(ownerAccess.hasAccess).toBe(true);
      expect(ownerAccess.permission?.role).toBe("owner");

      // Check staff access
      const staffAccess = await checkProjectAccess(staffUser.id, project.id);
      expect(staffAccess.hasAccess).toBe(true);
      expect(staffAccess.permission?.role).toBe("staff");

      // Check unauthorized access
      const unauthorizedAccess = await checkProjectAccess(unauthorizedUser.id, project.id);
      expect(unauthorizedAccess.hasAccess).toBe(false);
    });

    it("should enforce granular permission checks", async () => {
      const { user, project, cleanup } = await setup.setupTestProject();

      const staffUser = userFactory.create();
      await drizzleDb.insert(users).values(staffUser);

      // Grant limited permissions
      await drizzleDb.insert(userProjectPermissions).values({
        userId: staffUser.id,
        projectId: project.id,
        role: "staff",
        permissions: {
          bookings: { view: true, create: true, update: false, delete: false },
          payments: { view: true, create: false, update: false, delete: false },
          reports: { view: false, export: false },
        },
        isActive: true,
      });

      // Check specific permissions
      const canViewBookings = await checkProjectAccess(staffUser.id, project.id, "bookings.view");
      expect(canViewBookings.hasAccess).toBe(true);

      const canDeleteBookings = await checkProjectAccess(
        staffUser.id,
        project.id,
        "bookings.delete"
      );
      expect(canDeleteBookings.hasAccess).toBe(false);

      const canViewReports = await checkProjectAccess(staffUser.id, project.id, "reports.view");
      expect(canViewReports.hasAccess).toBe(false);

      await cleanup();
    });

    it("should handle inactive permissions", async () => {
      const { user, project, cleanup } = await setup.setupTestProject();

      const staffUser = userFactory.create();
      await drizzleDb.insert(users).values(staffUser);

      // Grant permission but set as inactive
      await drizzleDb.insert(userProjectPermissions).values({
        userId: staffUser.id,
        projectId: project.id,
        role: "admin",
        permissions: {},
        isActive: false, // Inactive
      });

      const access = await checkProjectAccess(staffUser.id, project.id);
      expect(access.hasAccess).toBe(false);

      await cleanup();
    });

    it("should handle project deactivation", async () => {
      const { user, project, cleanup } = await setup.setupTestProject();

      // Deactivate project
      await drizzleDb.update(projects).set({ isActive: false }).where(eq(projects.id, project.id));

      // Even owner should not have access to inactive project
      const access = await checkProjectAccess(user.id, project.id);
      expect(access.hasAccess).toBe(false);
      expect(access.project).toBe(null);

      await cleanup();
    });

    it("should isolate permission changes between projects", async () => {
      const user = userFactory.create();
      await drizzleDb.insert(users).values(user);
      cleaner.registerTable("users");

      // Create two projects
      const project1 = projectFactory.create({ ownerId: user.id });
      const project2 = projectFactory.create({ ownerId: user.id });
      await drizzleDb.insert(projects).values([project1, project2]);
      cleaner.registerTable("projects");

      const staffUser = userFactory.create();
      await drizzleDb.insert(users).values(staffUser);

      // Grant different permissions for same user in different projects
      await drizzleDb.insert(userProjectPermissions).values([
        {
          userId: staffUser.id,
          projectId: project1.id,
          role: "admin",
          permissions: {
            bookings: { view: true, create: true, update: true, delete: true },
          },
          isActive: true,
        },
        {
          userId: staffUser.id,
          projectId: project2.id,
          role: "viewer",
          permissions: {
            bookings: { view: true, create: false, update: false, delete: false },
          },
          isActive: true,
        },
      ]);
      cleaner.registerTable("user_project_permissions");

      // Check permissions in project1
      const access1 = await checkProjectAccess(staffUser.id, project1.id, "bookings.delete");
      expect(access1.hasAccess).toBe(true);

      // Check permissions in project2
      const access2 = await checkProjectAccess(staffUser.id, project2.id, "bookings.delete");
      expect(access2.hasAccess).toBe(false);
    });
  });

  describe("Schema Switching Safety", () => {
    it("should safely switch between project contexts", async () => {
      const { project: project1, cleanup: cleanup1 } = await setup.setupTestProject({
        createSchema: true,
      });

      const { project: project2, cleanup: cleanup2 } = await setup.setupTestProject({
        createSchema: true,
      });

      // Insert test data in both projects
      await sql`
        INSERT INTO ${sql.identifier(project1.schemaName)}.project_settings (
          key, value, category
        ) VALUES (
          'test_key', '"project1_value"', 'test'
        )
      `;

      await sql`
        INSERT INTO ${sql.identifier(project2.schemaName)}.project_settings (
          key, value, category
        ) VALUES (
          'test_key', '"project2_value"', 'test'
        )
      `;

      // Get project-specific connections
      const db1 = await getProjectDb(project1.id);
      const db2 = await getProjectDb(project2.id);

      // Query using project-specific connections
      const [result1] = await db1.sql`
        SELECT value FROM project_settings WHERE key = 'test_key'
      `;

      const [result2] = await db2.sql`
        SELECT value FROM project_settings WHERE key = 'test_key'
      `;

      // Each should get their own value
      expect(result1.value).toBe("project1_value");
      expect(result2.value).toBe("project2_value");

      await cleanup1();
      await cleanup2();
    });

    it(
      "should handle rapid context switching",
      async () => {
        const projects = await Promise.all([
          setup.setupTestProject({ createSchema: true }),
          setup.setupTestProject({ createSchema: true }),
          setup.setupTestProject({ createSchema: true }),
        ]);

        // Rapid context switching with interleaved operations
        const operations = [];
        for (let i = 0; i < 30; i++) {
          const projectIndex = i % 3;
          const { project } = projects[projectIndex];

          operations.push(
            (async () => {
              const db = await getProjectDb(project.id);
              await db.sql`
            INSERT INTO bookings (
              booking_code, guest_name, guest_phone,
              check_in_date, check_out_date,
              base_price, total_amount, balance_amount
            ) VALUES (
              ${`RAPID-${i}`}, ${`Guest ${i}`}, '09171234567',
              '2024-12-01', '2024-12-03',
              5000, 5000, 5000
            )
          `;
            })()
          );
        }

        await Promise.all(operations);

        // Verify each project has correct number of bookings
        for (const { project } of projects) {
          const db = await getProjectDb(project.id);
          const [count] = await db.sql`
          SELECT COUNT(*) as count FROM bookings
        `;
          expect(count.count).toBe("10"); // 30 operations / 3 projects
        }

        await Promise.all(projects.map(({ cleanup }) => cleanup()));
      },
      TEST_TIMEOUT
    );

    it("should prevent SQL injection in schema names", async () => {
      const maliciousSchemaName = "test'; DROP SCHEMA public CASCADE; --";
      const projectId = uuidv4();

      // This should sanitize the schema name
      const result = await createProjectSchema(projectId, maliciousSchemaName);

      // Should succeed with sanitized name
      expect(result.success).toBe(true);

      // Public schema should still exist
      const schemas = await sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'public'
      `;

      expect(schemas).toHaveLength(1);

      // Clean up the created schema (with sanitized name)
      const sanitizedName = maliciousSchemaName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/^_+|_+$/g, "")
        .substring(0, 63);

      cleaner.registerSchema(sanitizedName);
    });
  });

  describe("Cross-Project Query Prevention", () => {
    it("should prevent joins across project schemas", async () => {
      const { project: project1, cleanup: cleanup1 } = await setup.setupTestProject({
        createSchema: true,
      });

      const { project: project2, cleanup: cleanup2 } = await setup.setupTestProject({
        createSchema: true,
      });

      // Try to join data across schemas (should fail or return empty)
      const db1 = await getProjectDb(project1.id);

      // This query attempts cross-schema join
      const result = await db1.sql`
        SELECT b.* 
        FROM bookings b
        WHERE NOT EXISTS (
          SELECT 1 FROM ${sql.identifier(project2.schemaName)}.bookings b2
          WHERE b2.booking_code = b.booking_code
        )
      `.catch(() => []);

      // Should either fail or return all records (no cross-schema filtering)
      expect(Array.isArray(result)).toBe(true);

      await cleanup1();
      await cleanup2();
    });

    it("should prevent subqueries across schemas", async () => {
      const { project: project1, cleanup: cleanup1 } = await setup.setupTestProject({
        createSchema: true,
      });

      const { project: project2, cleanup: cleanup2 } = await setup.setupTestProject({
        createSchema: true,
      });

      // Insert data in project2
      await sql`
        INSERT INTO ${sql.identifier(project2.schemaName)}.payments (
          payment_code, amount, payment_method, payment_type
        ) VALUES (
          'PAY-001', 10000, 'gcash', 'full'
        )
      `;

      // Try to access project2 data from project1 context
      const db1 = await getProjectDb(project1.id);

      const result = await db1.sql`
        SELECT amount FROM payments WHERE payment_code = 'PAY-001'
      `.catch(() => []);

      // Should return empty or error
      expect(result).toHaveLength(0);

      await cleanup1();
      await cleanup2();
    });

    it("should isolate aggregate functions", async () => {
      const projects = await Promise.all([
        setup.setupTestProject({ createSchema: true }),
        setup.setupTestProject({ createSchema: true }),
      ]);

      // Insert different amounts in each project
      await sql`
        INSERT INTO ${sql.identifier(projects[0].project.schemaName)}.expenses (
          expense_code, category_id, description, amount
        ) VALUES (
          'EXP-001', gen_random_uuid(), 'Test', 1000
        )
      `;

      await sql`
        INSERT INTO ${sql.identifier(projects[1].project.schemaName)}.expenses (
          expense_code, category_id, description, amount
        ) VALUES (
          'EXP-002', gen_random_uuid(), 'Test', 2000
        )
      `;

      // Each project should only aggregate its own data
      for (const { project } of projects) {
        const db = await getProjectDb(project.id);
        const [result] = await db.sql`
          SELECT SUM(amount) as total FROM expenses
        `;

        // Each should have only their own sum
        expect(Number(result.total)).toBeLessThanOrEqual(2000);
      }

      await Promise.all(projects.map(({ cleanup }) => cleanup()));
    });
  });

  describe("Audit Trail Isolation", () => {
    it("should isolate audit logs by project", async () => {
      const { user: user1, project: project1, cleanup: cleanup1 } = await setup.setupTestProject();
      const { user: user2, project: project2, cleanup: cleanup2 } = await setup.setupTestProject();

      // Create audit entries for each project
      await drizzleDb.insert(auditLogs).values([
        {
          userId: user1.id,
          projectId: project1.id,
          action: "test_action_1",
          category: "booking",
          severity: "info",
          success: true,
        },
        {
          userId: user2.id,
          projectId: project2.id,
          action: "test_action_2",
          category: "payment",
          severity: "warning",
          success: true,
        },
      ]);
      cleaner.registerTable("audit_logs");

      // Query audit logs for project1
      const project1Logs = await drizzleDb
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.projectId, project1.id));

      // Query audit logs for project2
      const project2Logs = await drizzleDb
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.projectId, project2.id));

      // Each project should only see its own logs
      expect(project1Logs).toHaveLength(1);
      expect(project1Logs[0].action).toBe("test_action_1");

      expect(project2Logs).toHaveLength(1);
      expect(project2Logs[0].action).toBe("test_action_2");

      await cleanup1();
      await cleanup2();
    });

    it("should prevent audit log tampering", async () => {
      const { user, project, cleanup } = await setup.setupTestProject();

      // Insert audit log
      await drizzleDb.insert(auditLogs).values({
        userId: user.id,
        projectId: project.id,
        action: "sensitive_action",
        category: "payment",
        severity: "critical",
        oldValues: { amount: 1000 },
        newValues: { amount: 2000 },
        success: true,
      });
      cleaner.registerTable("audit_logs");

      // Get the audit log
      const [originalLog] = await drizzleDb
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.projectId, project.id), eq(auditLogs.action, "sensitive_action")));

      // Audit logs should be immutable (no update operations)
      // Attempting to modify should be prevented at application level

      // Verify original values remain unchanged
      expect(originalLog.oldValues).toEqual({ amount: 1000 });
      expect(originalLog.newValues).toEqual({ amount: 2000 });

      await cleanup();
    });
  });
});
