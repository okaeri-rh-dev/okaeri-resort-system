/**
 * Database Utility Function Tests
 * Tests utility functions including schema creation, access validation, audit logging, and code generation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { sql, drizzleDb } from "@/lib/db/connection";
import {
  createProjectSchema,
  dropProjectSchema,
  getProjectDb,
  checkProjectAccess,
  generateCode,
  logAudit,
  sanitizeIdentifier,
} from "@/lib/db/utils";
import { users, projects, userProjectPermissions, auditLogs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  TEST_TIMEOUT,
  DatabaseCleaner,
  TestDatabaseSetup,
  userFactory,
  projectFactory,
  permissionFactory,
} from "./fixtures";
import { v4 as uuidv4 } from "crypto";

describe("Database Utilities", () => {
  let cleaner: DatabaseCleaner;
  let setup: TestDatabaseSetup;

  beforeAll(() => {
    cleaner = new DatabaseCleaner();
    setup = new TestDatabaseSetup();
  });

  afterAll(async () => {
    await cleaner.cleanup();
  });

  describe("createProjectSchema", () => {
    it(
      "should create a new project schema successfully",
      async () => {
        const projectId = uuidv4();
        const schemaName = `test_schema_${Date.now()}`;

        const result = await createProjectSchema(projectId, schemaName);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();

        // Verify schema exists
        const schemas = await sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = ${sanitizeIdentifier(schemaName)}
      `;

        expect(schemas).toHaveLength(1);

        // Cleanup
        cleaner.registerSchema(sanitizeIdentifier(schemaName));
      },
      TEST_TIMEOUT
    );

    it("should sanitize schema names to prevent SQL injection", async () => {
      const projectId = uuidv4();
      const maliciousName = "test'; DROP TABLE users; --";

      const result = await createProjectSchema(projectId, maliciousName);

      expect(result.success).toBe(true);

      // Check that users table still exists
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      `;

      expect(tables).toHaveLength(1);

      // Check sanitized schema was created
      const sanitized = sanitizeIdentifier(maliciousName);
      const schemas = await sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = ${sanitized}
      `;

      expect(schemas).toHaveLength(1);

      cleaner.registerSchema(sanitized);
    });

    it("should create all required tables in the schema", async () => {
      const projectId = uuidv4();
      const schemaName = `test_complete_${Date.now()}`;

      await createProjectSchema(projectId, schemaName);

      const sanitized = sanitizeIdentifier(schemaName);
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ${sanitized}
        ORDER BY table_name
      `;

      const tableNames = tables.map((t) => t.table_name);

      // Verify all expected tables
      expect(tableNames).toContain("bookings");
      expect(tableNames).toContain("payments");
      expect(tableNames).toContain("expenses");
      expect(tableNames).toContain("expense_categories");
      expect(tableNames).toContain("income");
      expect(tableNames).toContain("booking_timeline");
      expect(tableNames).toContain("project_settings");

      cleaner.registerSchema(sanitized);
    });

    it("should create default expense categories", async () => {
      const projectId = uuidv4();
      const schemaName = `test_categories_${Date.now()}`;

      await createProjectSchema(projectId, schemaName);

      const sanitized = sanitizeIdentifier(schemaName);
      const categories = await sql`
        SELECT name, slug 
        FROM ${sql.identifier(sanitized)}.expense_categories
        ORDER BY sort_order
      `;

      expect(categories.length).toBeGreaterThan(0);

      const slugs = categories.map((c) => c.slug);
      expect(slugs).toContain("utilities");
      expect(slugs).toContain("maintenance");
      expect(slugs).toContain("staff");

      cleaner.registerSchema(sanitized);
    });

    it("should log audit entry for schema creation", async () => {
      const projectId = uuidv4();
      const schemaName = `test_audit_${Date.now()}`;

      await createProjectSchema(projectId, schemaName);

      // Check audit log
      const [auditEntry] = await drizzleDb
        .select()
        .from(auditLogs)
        .where(
          and(eq(auditLogs.projectId, projectId), eq(auditLogs.action, "create_project_schema"))
        )
        .limit(1);

      expect(auditEntry).toBeDefined();
      expect(auditEntry.success).toBe(true);
      expect(auditEntry.category).toBe("settings");
      expect(auditEntry.severity).toBe("info");

      cleaner.registerSchema(sanitizeIdentifier(schemaName));
      cleaner.registerTable("audit_logs");
    });

    it("should handle schema creation errors gracefully", async () => {
      const projectId = uuidv4();
      // Invalid schema name (too long)
      const schemaName = "x".repeat(100);

      const result = await createProjectSchema(projectId, schemaName);

      // Should handle the error
      if (!result.success) {
        expect(result.error).toBeDefined();

        // Should log error in audit
        const [auditEntry] = await drizzleDb
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.projectId, projectId),
              eq(auditLogs.action, "create_project_schema"),
              eq(auditLogs.success, false)
            )
          )
          .limit(1);

        expect(auditEntry).toBeDefined();
        expect(auditEntry.severity).toBe("error");
      }

      cleaner.registerTable("audit_logs");
    });
  });

  describe("dropProjectSchema", () => {
    it("should drop schema and all its contents", async () => {
      const projectId = uuidv4();
      const schemaName = `test_drop_${Date.now()}`;

      // Create schema first
      await createProjectSchema(projectId, schemaName);
      const sanitized = sanitizeIdentifier(schemaName);

      // Add some data
      await sql`
        INSERT INTO ${sql.identifier(sanitized)}.bookings (
          booking_code, guest_name, guest_phone,
          check_in_date, check_out_date,
          base_price, total_amount, balance_amount
        ) VALUES (
          'TEST-001', 'Test Guest', '09171234567',
          '2024-12-01', '2024-12-03',
          5000, 5000, 5000
        )
      `;

      // Drop the schema
      const result = await dropProjectSchema(projectId, sanitized);

      expect(result.success).toBe(true);

      // Verify schema no longer exists
      const schemas = await sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = ${sanitized}
      `;

      expect(schemas).toHaveLength(0);

      cleaner.registerTable("audit_logs");
    });

    it("should log audit entry for schema deletion", async () => {
      const projectId = uuidv4();
      const schemaName = `test_drop_audit_${Date.now()}`;

      await createProjectSchema(projectId, schemaName);
      const sanitized = sanitizeIdentifier(schemaName);

      await dropProjectSchema(projectId, sanitized);

      // Check audit log
      const [auditEntry] = await drizzleDb
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.projectId, projectId), eq(auditLogs.action, "drop_project_schema")))
        .limit(1);

      expect(auditEntry).toBeDefined();
      expect(auditEntry.success).toBe(true);
      expect(auditEntry.category).toBe("settings");
      expect(auditEntry.severity).toBe("warning");

      cleaner.registerTable("audit_logs");
    });

    it("should handle non-existent schema gracefully", async () => {
      const projectId = uuidv4();
      const schemaName = "non_existent_schema_xyz";

      const result = await dropProjectSchema(projectId, schemaName);

      // Should succeed even if schema doesn't exist
      expect(result.success).toBe(true);

      cleaner.registerTable("audit_logs");
    });
  });

  describe("getProjectDb", () => {
    it("should return schema-specific database connection", async () => {
      const { user, project, cleanup } = await setup.setupTestProject({
        createSchema: true,
      });

      const projectDb = await getProjectDb(project.id);

      expect(projectDb).toBeDefined();
      expect(projectDb.sql).toBeDefined();
      expect(projectDb.schemaName).toBe(project.schemaName);
      expect(projectDb.project).toEqual(project);

      // Test that queries work in correct schema
      await projectDb.sql`
        INSERT INTO bookings (
          booking_code, guest_name, guest_phone,
          check_in_date, check_out_date,
          base_price, total_amount, balance_amount
        ) VALUES (
          'TEST-DB-001', 'Test Guest', '09171234567',
          '2024-12-01', '2024-12-03',
          5000, 5000, 5000
        )
      `;

      const [booking] = await projectDb.sql`
        SELECT * FROM bookings WHERE booking_code = 'TEST-DB-001'
      `;

      expect(booking.guest_name).toBe("Test Guest");

      await cleanup();
    });

    it("should throw error for non-existent project", async () => {
      const fakeProjectId = uuidv4();

      await expect(getProjectDb(fakeProjectId)).rejects.toThrow("Project not found");
    });

    it("should set search path correctly", async () => {
      const { project, cleanup } = await setup.setupTestProject({
        createSchema: true,
      });

      const projectDb = await getProjectDb(project.id);

      // Execute query and check search path
      await projectDb.sql`SELECT current_schema()`;

      // The query should execute in the project's schema context
      const [result] = await projectDb.sql`
        SELECT current_schemas(false) as schemas
      `;

      expect(result.schemas).toContain(project.schemaName);

      await cleanup();
    });
  });

  describe("checkProjectAccess", () => {
    it("should grant full access to project owner", async () => {
      const { user, project, cleanup } = await setup.setupTestProject();

      const access = await checkProjectAccess(user.id, project.id);

      expect(access.hasAccess).toBe(true);
      expect(access.permission?.role).toBe("owner");
      expect(access.project).toEqual(project);

      await cleanup();
    });

    it("should check specific permission for non-owners", async () => {
      const { project, cleanup } = await setup.setupTestProject();

      const staffUser = userFactory.create();
      await drizzleDb.insert(users).values(staffUser);

      // Grant limited permissions
      await drizzleDb.insert(userProjectPermissions).values({
        userId: staffUser.id,
        projectId: project.id,
        role: "staff",
        permissions: {
          bookings: {
            view: true,
            create: true,
            update: false,
            delete: false,
          },
        },
        isActive: true,
      });

      // Check allowed permission
      const canCreate = await checkProjectAccess(staffUser.id, project.id, "bookings.create");
      expect(canCreate.hasAccess).toBe(true);

      // Check denied permission
      const canDelete = await checkProjectAccess(staffUser.id, project.id, "bookings.delete");
      expect(canDelete.hasAccess).toBe(false);

      await cleanup();
    });

    it("should deny access for inactive projects", async () => {
      const { user, project, cleanup } = await setup.setupTestProject();

      // Deactivate project
      await drizzleDb.update(projects).set({ isActive: false }).where(eq(projects.id, project.id));

      const access = await checkProjectAccess(user.id, project.id);

      expect(access.hasAccess).toBe(false);
      expect(access.project).toBe(null);

      await cleanup();
    });

    it("should deny access for inactive permissions", async () => {
      const { project, cleanup } = await setup.setupTestProject();

      const user = userFactory.create();
      await drizzleDb.insert(users).values(user);

      // Grant inactive permission
      await drizzleDb.insert(userProjectPermissions).values({
        userId: user.id,
        projectId: project.id,
        role: "admin",
        permissions: {},
        isActive: false,
      });

      const access = await checkProjectAccess(user.id, project.id);

      expect(access.hasAccess).toBe(false);
      expect(access.permission).toBe(null);

      await cleanup();
    });

    it("should handle nested permission paths", async () => {
      const { project, cleanup } = await setup.setupTestProject();

      const user = userFactory.create();
      await drizzleDb.insert(users).values(user);

      await drizzleDb.insert(userProjectPermissions).values({
        userId: user.id,
        projectId: project.id,
        role: "manager",
        permissions: {
          reports: {
            financial: {
              view: true,
              export: false,
            },
          },
        },
        isActive: true,
      });

      // Check nested permission
      const canView = await checkProjectAccess(user.id, project.id, "reports.financial.view");
      expect(canView.hasAccess).toBe(true);

      const canExport = await checkProjectAccess(user.id, project.id, "reports.financial.export");
      expect(canExport.hasAccess).toBe(false);

      await cleanup();
    });

    it("should handle missing permission gracefully", async () => {
      const { project, cleanup } = await setup.setupTestProject();

      const user = userFactory.create();
      await drizzleDb.insert(users).values(user);

      await drizzleDb.insert(userProjectPermissions).values({
        userId: user.id,
        projectId: project.id,
        role: "viewer",
        permissions: {
          bookings: {
            view: true,
          },
        },
        isActive: true,
      });

      // Check undefined permission path
      const access = await checkProjectAccess(user.id, project.id, "settings.advanced.modify");

      expect(access.hasAccess).toBe(false);

      await cleanup();
    });
  });

  describe("generateCode", () => {
    it("should generate unique codes with prefix", () => {
      const code1 = generateCode("BK", 8);
      const code2 = generateCode("BK", 8);

      expect(code1).toMatch(/^BK-[A-Z0-9]{8}$/);
      expect(code2).toMatch(/^BK-[A-Z0-9]{8}$/);
      expect(code1).not.toBe(code2);
    });

    it("should respect specified length", () => {
      const shortCode = generateCode("PAY", 6);
      const longCode = generateCode("PAY", 12);

      expect(shortCode).toMatch(/^PAY-[A-Z0-9]{6}$/);
      expect(longCode).toMatch(/^PAY-[A-Z0-9]{12}$/);
    });

    it("should handle different prefixes", () => {
      const bookingCode = generateCode("BK");
      const paymentCode = generateCode("PAY");
      const expenseCode = generateCode("EXP");

      expect(bookingCode).toMatch(/^BK-/);
      expect(paymentCode).toMatch(/^PAY-/);
      expect(expenseCode).toMatch(/^EXP-/);
    });

    it("should generate codes suitable for database storage", () => {
      const codes = Array.from({ length: 100 }, () => generateCode("TEST", 10));

      // All codes should be unique
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(100);

      // All codes should match pattern
      codes.forEach((code) => {
        expect(code).toMatch(/^TEST-[A-Z0-9]{10}$/);
        expect(code.length).toBeLessThanOrEqual(15); // PREFIX + dash + length
      });
    });
  });

  describe("logAudit", () => {
    beforeEach(() => {
      cleaner.registerTable("audit_logs");
    });

    it("should log audit entries successfully", async () => {
      const userId = uuidv4();
      const projectId = uuidv4();

      await logAudit({
        userId,
        projectId,
        action: "test_action",
        category: "booking",
        severity: "info",
        entityType: "booking",
        entityId: uuidv4(),
        success: true,
        metadata: { test: true },
      });

      // Verify audit entry was created
      const [entry] = await drizzleDb
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.userId, userId), eq(auditLogs.action, "test_action")))
        .limit(1);

      expect(entry).toBeDefined();
      expect(entry.category).toBe("booking");
      expect(entry.severity).toBe("info");
      expect(entry.success).toBe(true);
    });

    it("should handle audit logging errors without throwing", async () => {
      // Mock console.error to verify it's called
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Try to log with invalid data (e.g., null for required field)
      await expect(
        logAudit({
          userId: null,
          projectId: null,
          action: null as any, // Invalid: required field
          category: "booking",
          severity: "info",
          success: true,
        })
      ).resolves.toBeUndefined(); // Should not throw

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log with complete request context", async () => {
      const requestId = uuidv4();

      await logAudit({
        userId: uuidv4(),
        projectId: uuidv4(),
        action: "api_request",
        category: "auth",
        severity: "info",
        ipAddress: "192.168.1.1",
        userAgent: "Test Agent",
        requestMethod: "POST",
        requestPath: "/api/bookings",
        requestId,
        success: true,
      });

      const [entry] = await drizzleDb
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.requestId, requestId))
        .limit(1);

      expect(entry.ipAddress).toBe("192.168.1.1");
      expect(entry.userAgent).toBe("Test Agent");
      expect(entry.requestMethod).toBe("POST");
      expect(entry.requestPath).toBe("/api/bookings");
    });

    it("should log error details for failed operations", async () => {
      await logAudit({
        userId: uuidv4(),
        projectId: uuidv4(),
        action: "failed_operation",
        category: "payment",
        severity: "error",
        success: false,
        errorMessage: "Payment processing failed",
        errorStack: "Error: Payment processing failed\n    at processPayment...",
      });

      const [entry] = await drizzleDb
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "failed_operation"))
        .limit(1);

      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe("Payment processing failed");
      expect(entry.errorStack).toContain("Error: Payment processing failed");
    });

    it("should track value changes", async () => {
      const entityId = uuidv4();

      await logAudit({
        userId: uuidv4(),
        projectId: uuidv4(),
        action: "update_booking",
        category: "booking",
        severity: "info",
        entityType: "booking",
        entityId,
        oldValues: {
          status: "pending",
          paymentStatus: "unpaid",
        },
        newValues: {
          status: "confirmed",
          paymentStatus: "paid",
        },
        success: true,
      });

      const [entry] = await drizzleDb
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, entityId))
        .limit(1);

      expect(entry.oldValues).toEqual({
        status: "pending",
        paymentStatus: "unpaid",
      });
      expect(entry.newValues).toEqual({
        status: "confirmed",
        paymentStatus: "paid",
      });
    });
  });

  describe("sanitizeIdentifier", () => {
    it("should convert to lowercase", () => {
      expect(sanitizeIdentifier("TestSchema")).toBe("testschema");
      expect(sanitizeIdentifier("UPPERCASE")).toBe("uppercase");
    });

    it("should replace invalid characters with underscores", () => {
      expect(sanitizeIdentifier("test-schema")).toBe("test_schema");
      expect(sanitizeIdentifier("test.schema")).toBe("test_schema");
      expect(sanitizeIdentifier("test schema")).toBe("test_schema");
      expect(sanitizeIdentifier("test@schema#123")).toBe("test_schema_123");
    });

    it("should remove leading and trailing underscores", () => {
      expect(sanitizeIdentifier("_test_")).toBe("test");
      expect(sanitizeIdentifier("___test___")).toBe("test");
    });

    it("should respect PostgreSQL identifier length limit", () => {
      const longName = "a".repeat(100);
      const sanitized = sanitizeIdentifier(longName);

      expect(sanitized.length).toBeLessThanOrEqual(63);
    });

    it("should prevent SQL injection attempts", () => {
      const malicious = "'; DROP TABLE users; --";
      const sanitized = sanitizeIdentifier(malicious);

      expect(sanitized).toBe("drop_table_users");
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(";");
      expect(sanitized).not.toContain("--");
    });

    it("should handle Unicode characters", () => {
      expect(sanitizeIdentifier("test_schema_🚀")).toBe("test_schema");
      expect(sanitizeIdentifier("schéma_français")).toBe("sch_ma_fran_ais");
    });

    it("should handle empty strings", () => {
      expect(sanitizeIdentifier("")).toBe("");
      expect(sanitizeIdentifier("   ")).toBe("");
    });

    it("should preserve valid identifiers", () => {
      expect(sanitizeIdentifier("valid_schema_123")).toBe("valid_schema_123");
      expect(sanitizeIdentifier("test_db")).toBe("test_db");
    });
  });

  describe("Error Handling", () => {
    it("should handle database connection errors gracefully", async () => {
      // Mock a connection error
      const originalSql = sql;
      const mockSql = vi.fn().mockRejectedValue(new Error("Connection refused"));

      // Temporarily replace sql
      (global as any).sql = mockSql;

      // Functions should handle errors gracefully
      const projectId = uuidv4();
      const result = await createProjectSchema(projectId, "test_schema");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");

      // Restore original
      (global as any).sql = originalSql;
    });

    it("should handle concurrent operations safely", async () => {
      const operations = [];

      // Create multiple schemas concurrently
      for (let i = 0; i < 5; i++) {
        operations.push(createProjectSchema(uuidv4(), `concurrent_${i}_${Date.now()}`));
      }

      const results = await Promise.all(operations);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Cleanup
      for (let i = 0; i < 5; i++) {
        cleaner.registerSchema(sanitizeIdentifier(`concurrent_${i}_${Date.now()}`));
      }
    });
  });
});
