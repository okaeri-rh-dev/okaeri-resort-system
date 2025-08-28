/**
 * Test Fixtures and Helper Functions
 * Provides reusable test data and utilities for database tests
 */

import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";
import { setupTestDatabase, TEST_DB_CONFIG } from "./test-connection";

// Import database functions conditionally based on test mode
let sql: any;
let drizzleDb: any;
let executeWithRetry: any;
let generateCode: any;
let sanitizeIdentifier: any;

// Initialize database imports
if (TEST_DB_CONFIG.isMockMode) {
  // Use mocked versions
  sql = async (strings: TemplateStringsArray | string, ...values: any[]) => [];
  drizzleDb = { insert: () => ({ values: () => Promise.resolve() }) };
  executeWithRetry = async (fn: () => Promise<any>) => fn();
  generateCode = (prefix: string, length: number) =>
    `${prefix}${Math.random().toString(36).substring(2, length)}`;
  sanitizeIdentifier = (str: string) => str.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
} else {
  // Import real implementations
  const connectionModule = await import("@/lib/db/connection");
  const utilsModule = await import("@/lib/db/utils");
  sql = connectionModule.sql;
  drizzleDb = connectionModule.drizzleDb;
  executeWithRetry = connectionModule.executeWithRetry;
  generateCode = utilsModule.generateCode;
  sanitizeIdentifier = utilsModule.sanitizeIdentifier;
}

// Import types
type NewUser = any;
type NewProject = any;
type NewUserProjectPermission = any;

// Test database configuration
export const TEST_DB_PREFIX = "test_";
export const TEST_TIMEOUT = 30000; // 30 seconds for database operations

/**
 * Generate a unique test schema name
 */
export function generateTestSchemaName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return sanitizeIdentifier(`${TEST_DB_PREFIX}${timestamp}_${random}`);
}

/**
 * User Test Data Factory
 */
export const userFactory = {
  create: (overrides?: Partial<NewUser>): NewUser => ({
    id: uuidv4(),
    email: faker.internet.email().toLowerCase(),
    passwordHash: "$2a$10$test.hash.for.testing.only",
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    phone: faker.helpers.fromRegExp("+639[0-9]{9}"),
    isActive: true,
    isEmailVerified: true,
    preferences: {
      language: "en",
      timezone: "Asia/Manila",
      notifications: {
        email: true,
        sms: false,
        push: true,
      },
    },
    ...overrides,
  }),

  createMany: (count: number, overrides?: Partial<NewUser>): NewUser[] => {
    return Array.from({ length: count }, () => userFactory.create(overrides));
  },
};

/**
 * Project Test Data Factory
 */
export const projectFactory = {
  create: (overrides?: Partial<NewProject>): NewProject => {
    const name = faker.company.name();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .substring(0, 50);
    return {
      id: uuidv4(),
      name,
      slug: `${slug}_${Date.now()}`,
      schemaName: generateTestSchemaName(),
      ownerId: uuidv4(),
      businessType: "resort",
      description: faker.lorem.paragraph(),
      businessName: `${name} Resort`,
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      province: "Batangas",
      postalCode: faker.location.zipCode(),
      country: "PH",
      contactEmail: faker.internet.email(),
      contactPhone: faker.helpers.fromRegExp("+639[0-9]{9}"),
      currency: "PHP",
      timezone: "Asia/Manila",
      settings: {
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
      },
      isActive: true,
      isPaid: false,
      ...overrides,
    };
  },

  createMany: (count: number, overrides?: Partial<NewProject>): NewProject[] => {
    return Array.from({ length: count }, () => projectFactory.create(overrides));
  },
};

/**
 * Permission Test Data Factory
 */
export const permissionFactory = {
  create: (overrides?: Partial<NewUserProjectPermission>): NewUserProjectPermission => ({
    userId: uuidv4(),
    projectId: uuidv4(),
    role: "staff",
    permissions: {
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
      expenses: {
        view: false,
        create: false,
        update: false,
        delete: false,
      },
      reports: {
        view: false,
        export: false,
      },
      settings: {
        view: false,
        update: false,
      },
      users: {
        view: false,
        invite: false,
        remove: false,
        updateRoles: false,
      },
    },
    isActive: true,
    ...overrides,
  }),

  createOwnerPermission: (userId: string, projectId: string): NewUserProjectPermission => ({
    userId,
    projectId,
    role: "owner",
    permissions: {},
    isActive: true,
  }),

  createAdminPermission: (userId: string, projectId: string): NewUserProjectPermission => ({
    userId,
    projectId,
    role: "admin",
    permissions: {
      bookings: { view: true, create: true, update: true, delete: true },
      payments: { view: true, create: true, update: true, delete: true },
      expenses: { view: true, create: true, update: true, delete: true },
      reports: { view: true, export: true },
      settings: { view: true, update: true },
      users: { view: true, invite: true, remove: true, updateRoles: true },
    },
    isActive: true,
  }),
};

/**
 * Booking Test Data Factory
 */
export const bookingFactory = {
  create: (overrides?: any): any => ({
    id: uuidv4(),
    bookingCode: generateCode("BK", 8),
    guestName: faker.person.fullName(),
    guestEmail: faker.internet.email(),
    guestPhone: faker.helpers.fromRegExp("+639[0-9]{9}"),
    guestAddress: faker.location.streetAddress(),
    numberOfGuests: faker.number.int({ min: 1, max: 10 }),
    numberOfChildren: faker.number.int({ min: 0, max: 4 }),
    checkInDate: faker.date.future().toISOString().split("T")[0],
    checkOutDate: faker.date.future().toISOString().split("T")[0],
    roomType: faker.helpers.arrayElement(["Standard", "Deluxe", "Suite", "Villa"]),
    roomNumber: faker.number.int({ min: 101, max: 999 }).toString(),
    basePrice: faker.number.float({ min: 2000, max: 20000, multipleOf: 100 }),
    additionalCharges: faker.number.float({ min: 0, max: 2000, multipleOf: 100 }),
    discountAmount: faker.number.float({ min: 0, max: 1000, multipleOf: 100 }),
    taxAmount: faker.number.float({ min: 100, max: 2000, multipleOf: 10 }),
    totalAmount: faker.number.float({ min: 2000, max: 25000, multipleOf: 100 }),
    depositAmount: faker.number.float({ min: 500, max: 5000, multipleOf: 100 }),
    paidAmount: faker.number.float({ min: 0, max: 25000, multipleOf: 100 }),
    balanceAmount: faker.number.float({ min: 0, max: 20000, multipleOf: 100 }),
    status: faker.helpers.arrayElement([
      "pending",
      "confirmed",
      "checked_in",
      "checked_out",
      "cancelled",
    ]),
    paymentStatus: faker.helpers.arrayElement(["pending", "partial", "paid", "refunded"]),
    specialRequests: faker.lorem.sentence(),
    source: faker.helpers.arrayElement(["direct", "website", "phone", "walk_in"]),
    ...overrides,
  }),

  createMany: (count: number, overrides?: any): any[] => {
    return Array.from({ length: count }, () => bookingFactory.create(overrides));
  },
};

/**
 * Payment Test Data Factory
 */
export const paymentFactory = {
  create: (overrides?: any): any => ({
    id: uuidv4(),
    paymentCode: generateCode("PAY", 8),
    amount: faker.number.float({ min: 500, max: 25000, multipleOf: 100 }),
    paymentMethod: faker.helpers.arrayElement(["cash", "gcash", "bank_transfer", "credit_card"]),
    paymentType: faker.helpers.arrayElement(["deposit", "partial", "full", "refund"]),
    status: faker.helpers.arrayElement([
      "pending",
      "processing",
      "completed",
      "failed",
      "cancelled",
    ]),
    transactionId: faker.string.alphanumeric(20).toUpperCase(),
    referenceNumber: faker.string.alphanumeric(16).toUpperCase(),
    notes: faker.lorem.sentence(),
    ...overrides,
  }),

  createGcashPayment: (amount: number, bookingId?: string): any => ({
    id: uuidv4(),
    bookingId,
    paymentCode: generateCode("PAY", 8),
    amount,
    paymentMethod: "gcash",
    paymentType: "deposit",
    gcashReferenceNumber: faker.string.numeric(13),
    gcashAccountName: faker.person.fullName(),
    gcashAccountNumber: faker.helpers.fromRegExp("09[0-9]{9}"),
    status: "completed",
    verifiedAt: new Date().toISOString(),
  }),
};

/**
 * Expense Test Data Factory
 */
export const expenseFactory = {
  create: (categoryId: string, overrides?: any): any => ({
    id: uuidv4(),
    expenseCode: generateCode("EXP", 8),
    categoryId,
    description: faker.commerce.productDescription(),
    amount: faker.number.float({ min: 100, max: 10000, multipleOf: 50 }),
    quantity: faker.number.int({ min: 1, max: 10 }),
    paymentMethod: faker.helpers.arrayElement(["cash", "gcash", "bank_transfer"]),
    paymentStatus: "paid",
    paidAt: faker.date.recent().toISOString(),
    vendorName: faker.company.name(),
    vendorContact: faker.helpers.fromRegExp("+639[0-9]{9}"),
    status: "approved",
    notes: faker.lorem.sentence(),
    ...overrides,
  }),

  createRecurringExpense: (categoryId: string, overrides?: any): any => ({
    ...expenseFactory.create(categoryId),
    isRecurring: true,
    recurringFrequency: faker.helpers.arrayElement(["monthly", "quarterly", "yearly"]),
    nextRecurringDate: faker.date.future().toISOString().split("T")[0],
    ...overrides,
  }),
};

/**
 * Database Cleanup Utilities
 */
export class DatabaseCleaner {
  private schemasToClean: string[] = [];
  private tablesToClean: string[] = [];

  /**
   * Register a schema for cleanup
   */
  registerSchema(schemaName: string): void {
    this.schemasToClean.push(schemaName);
  }

  /**
   * Register a table for cleanup
   */
  registerTable(tableName: string, schemaName: string = "public"): void {
    this.tablesToClean.push(`${schemaName}.${tableName}`);
  }

  /**
   * Clean all registered schemas and tables
   */
  async cleanup(): Promise<void> {
    try {
      // Clean tables first
      for (const table of this.tablesToClean) {
        await executeWithRetry(async () => {
          await sql`TRUNCATE TABLE ${sql(table)} CASCADE`;
        });
      }

      // Drop test schemas
      for (const schema of this.schemasToClean) {
        await executeWithRetry(async () => {
          await sql`DROP SCHEMA IF EXISTS ${sql.identifier(schema)} CASCADE`;
        });
      }

      // Clear arrays
      this.schemasToClean = [];
      this.tablesToClean = [];
    } catch (error) {
      console.error("Database cleanup failed:", error);
      // Don't throw - cleanup errors shouldn't fail tests
    }
  }

  /**
   * Clean all test schemas (emergency cleanup)
   */
  async cleanAllTestSchemas(): Promise<void> {
    try {
      const result = await sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE ${`${TEST_DB_PREFIX}%`}
      `;

      for (const row of result) {
        await executeWithRetry(async () => {
          await sql`DROP SCHEMA IF EXISTS ${sql.identifier(row.schema_name)} CASCADE`;
        });
      }
    } catch (error) {
      console.error("Emergency cleanup failed:", error);
    }
  }
}

/**
 * Test Database Setup Helper
 */
export class TestDatabaseSetup {
  private cleaner: DatabaseCleaner;

  constructor() {
    this.cleaner = new DatabaseCleaner();
  }

  /**
   * Setup a test project with schema
   */
  async setupTestProject(options?: {
    createSchema?: boolean;
    userData?: Partial<NewUser>;
    projectData?: Partial<NewProject>;
  }): Promise<{
    user: any;
    project: any;
    schemaName: string;
    cleanup: () => Promise<void>;
  }> {
    const user = userFactory.create(options?.userData);
    const project = projectFactory.create({
      ...options?.projectData,
      ownerId: user.id,
    });

    // Insert user
    await drizzleDb.insert(users).values(user);

    // Insert project
    await drizzleDb.insert(projects).values(project);

    // Create schema if requested
    if (options?.createSchema) {
      const { setupProjectSchema } = await import("@/lib/db/utils");
      await setupProjectSchema(project.id, project.schemaName);
      this.cleaner.registerSchema(project.schemaName);
    }

    // Register for cleanup
    this.cleaner.registerTable("user_project_permissions", "public");
    this.cleaner.registerTable("audit_logs", "public");
    this.cleaner.registerTable("projects", "public");
    this.cleaner.registerTable("users", "public");

    return {
      user,
      project,
      schemaName: project.schemaName,
      cleanup: () => this.cleaner.cleanup(),
    };
  }

  /**
   * Get the cleaner instance
   */
  getCleaner(): DatabaseCleaner {
    return this.cleaner;
  }
}

/**
 * Performance Measurement Utilities
 */
export class PerformanceTracker {
  private measurements: Map<string, number[]> = new Map();

  /**
   * Start a measurement
   */
  start(name: string): () => void {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);
    };
  }

  /**
   * Get statistics for a measurement
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
  } | null {
    const values = this.measurements.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const avg = values.reduce((a, b) => a + b, 0) / count;
    const median = sorted[Math.floor(count / 2)];
    const p95Index = Math.floor(count * 0.95);
    const p95 = sorted[p95Index] || max;

    return { count, min, max, avg, median, p95 };
  }

  /**
   * Reset all measurements
   */
  reset(): void {
    this.measurements.clear();
  }

  /**
   * Get all measurements
   */
  getAllStats(): Map<string, ReturnType<typeof this.getStats>> {
    const stats = new Map();
    for (const [name] of this.measurements) {
      stats.set(name, this.getStats(name));
    }
    return stats;
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a temporary test database
 */
export async function createTestDatabase(): Promise<{
  connectionString: string;
  cleanup: () => Promise<void>;
}> {
  const dbName = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Note: This would need actual database creation logic
  // For now, we'll use the existing database with test schemas

  return {
    connectionString: process.env.DATABASE_URL!,
    cleanup: async () => {
      // Cleanup would drop the test database
      // For now, we rely on schema cleanup
    },
  };
}

// Mock schema tables for testing
const users = { name: "users" };
const projects = { name: "projects" };

// Export commonly used test utilities
export { faker } from "@faker-js/faker";
export { v4 as uuidv4 } from "uuid";
