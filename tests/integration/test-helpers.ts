/**
 * Integration Test Helpers
 * @since Phase 1.7 - Integration & E2E Validation
 *
 * Provides utilities for API integration testing including
 * database setup, authentication, and data cleanup
 */

import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

// Test database connection
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://test@localhost/test";
const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";

export const sql = neon(DATABASE_URL);

/**
 * Test user data structure
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "owner" | "admin" | "staff" | "viewer";
  projectId?: string;
  token?: string;
}

/**
 * Test project data structure
 */
export interface TestProject {
  id: string;
  name: string;
  businessType: "resort" | "hotel" | "rental";
  ownerId: string;
  schemaName: string;
}

/**
 * Create a test database and schema
 */
export async function setupTestDatabase(): Promise<{ projectId: string; token: string }> {
  try {
    // Create test user
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash("TestPassword123!", 10);

    await sql`
      INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
      VALUES (${userId}, 'test@okaeri.ph', ${hashedPassword}, 'Test', 'User', 'owner', true)
      ON CONFLICT (email) DO UPDATE SET id = ${userId}
    `;

    // Create test project
    const projectId = uuidv4();
    const schemaName = `project_${projectId.replace(/-/g, "_")}`;

    await sql`
      INSERT INTO projects (id, name, business_type, owner_id, schema_name)
      VALUES (${projectId}, 'Test Resort', 'resort', ${userId}, ${schemaName})
      ON CONFLICT (id) DO NOTHING
    `;

    // Create project schema
    await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schemaName)}`;

    // Create project tables
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(`${schemaName}.bookings`)} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        guest_name VARCHAR(255) NOT NULL,
        guest_email VARCHAR(255),
        checkin_date DATE NOT NULL,
        checkout_date DATE NOT NULL,
        guest_count INTEGER NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        source VARCHAR(50),
        status VARCHAR(50) DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ${sql(`${schemaName}.expenses`)} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        description TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        expense_date DATE NOT NULL,
        receipt_url TEXT,
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Generate JWT token
    const token = jwt.sign(
      {
        userId,
        email: "test@okaeri.ph",
        role: "owner",
        projectId,
        schemaName,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return { projectId, token };
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
}

/**
 * Tear down test database
 */
export async function teardownTestDatabase(projectId?: string): Promise<void> {
  try {
    if (projectId) {
      const schemaName = `project_${projectId.replace(/-/g, "_")}`;

      // Drop schema cascade
      await sql`DROP SCHEMA IF EXISTS ${sql(schemaName)} CASCADE`;

      // Delete project
      await sql`DELETE FROM projects WHERE id = ${projectId}`;
    }

    // Clean up test user
    await sql`DELETE FROM users WHERE email = 'test@okaeri.ph'`;
  } catch (error) {
    console.error("Error tearing down test database:", error);
  }
}

/**
 * Create a test user with specific role
 */
export async function createTestUser(role: TestUser["role"] = "owner"): Promise<TestUser> {
  const userId = uuidv4();
  const email = `test-${userId}@okaeri.ph`;
  const password = "TestPassword123!";
  const hashedPassword = await bcrypt.hash(password, 10);

  await sql`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified)
    VALUES (${userId}, ${email}, ${hashedPassword}, 'Test', ${role}, ${role}, true)
  `;

  const token = jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: "1h" });

  return {
    id: userId,
    email,
    password,
    firstName: "Test",
    lastName: role,
    role,
    token,
  };
}

/**
 * Create test booking data
 */
export async function createTestBooking(projectId: string, data?: Partial<any>) {
  const schemaName = `project_${projectId.replace(/-/g, "_")}`;

  const defaultData = {
    guestName: "Test Guest",
    guestEmail: "guest@test.com",
    checkinDate: new Date().toISOString().split("T")[0],
    checkoutDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    guestCount: 2,
    totalAmount: 5000,
    source: "direct",
    status: "confirmed",
  };

  const bookingData = { ...defaultData, ...data };

  const result = await sql`
    INSERT INTO ${sql(`${schemaName}.bookings`)} (
      guest_name, guest_email, checkin_date, checkout_date,
      guest_count, total_amount, source, status
    ) VALUES (
      ${bookingData.guestName}, ${bookingData.guestEmail},
      ${bookingData.checkinDate}, ${bookingData.checkoutDate},
      ${bookingData.guestCount}, ${bookingData.totalAmount},
      ${bookingData.source}, ${bookingData.status}
    ) RETURNING id
  `;

  return result[0].id;
}

/**
 * Create test expense data
 */
export async function createTestExpense(projectId: string, userId: string, data?: Partial<any>) {
  const schemaName = `project_${projectId.replace(/-/g, "_")}`;

  const defaultData = {
    description: "Test Expense",
    amount: 1500,
    category: "supplies",
    expenseDate: new Date().toISOString().split("T")[0],
    receiptUrl: null,
    createdBy: userId,
  };

  const expenseData = { ...defaultData, ...data };

  const result = await sql`
    INSERT INTO ${sql(`${schemaName}.expenses`)} (
      description, amount, category, expense_date, receipt_url, created_by
    ) VALUES (
      ${expenseData.description}, ${expenseData.amount},
      ${expenseData.category}, ${expenseData.expenseDate},
      ${expenseData.receiptUrl}, ${expenseData.createdBy}
    ) RETURNING id
  `;

  return result[0].id;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
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
 * Make an API request with authentication
 */
export async function apiRequest(
  path: string,
  method: string = "GET",
  token?: string,
  body?: any
): Promise<Response> {
  const baseUrl = process.env.API_URL || "http://localhost:3000/api";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  return fetch(`${baseUrl}${path}`, options);
}

/**
 * Generate random Philippine phone number
 */
export function generatePhPhoneNumber(): string {
  const prefixes = ["917", "918", "919", "920", "921", "922"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, "0");
  return `+63${prefix}${suffix}`;
}

/**
 * Generate random business data for testing
 */
export function generateBusinessData() {
  const businesses = [
    { name: "Okaeri Beach Resort", type: "resort", location: "Batangas" },
    { name: "Sunset Inn", type: "hotel", location: "Boracay" },
    { name: "Mountain View Lodge", type: "rental", location: "Baguio" },
    { name: "Island Paradise Resort", type: "resort", location: "Palawan" },
    { name: "City Central Hotel", type: "hotel", location: "Manila" },
  ];

  return businesses[Math.floor(Math.random() * businesses.length)];
}

/**
 * Clean up all test data
 */
export async function cleanupAllTestData(): Promise<void> {
  try {
    // Delete all test users
    await sql`DELETE FROM users WHERE email LIKE 'test%@okaeri.ph'`;

    // Delete all test projects
    const projects = await sql`
      SELECT id, schema_name FROM projects 
      WHERE name LIKE 'Test%' OR owner_id IN (
        SELECT id FROM users WHERE email LIKE 'test%@okaeri.ph'
      )
    `;

    for (const project of projects) {
      await sql`DROP SCHEMA IF EXISTS ${sql(project.schema_name)} CASCADE`;
      await sql`DELETE FROM projects WHERE id = ${project.id}`;
    }
  } catch (error) {
    console.error("Error cleaning up test data:", error);
  }
}

/**
 * Verify database connection
 */
export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 as connected`;
    return result[0].connected === 1;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

/**
 * Mock file upload for testing
 */
export function createMockFile(filename: string, size: number = 1024): File {
  const blob = new Blob(["x".repeat(size)], { type: "image/jpeg" });
  return new File([blob], filename, { type: "image/jpeg" });
}

/**
 * Performance timing helper
 */
export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  measure(name: string, startMark?: string): number {
    const endTime = Date.now();
    const startTime = startMark ? this.marks.get(startMark) : this.startTime;

    if (!startTime) {
      throw new Error(`Mark "${startMark}" not found`);
    }

    return endTime - startTime;
  }

  getReport(): Record<string, number> {
    const report: Record<string, number> = {};

    for (const [name, time] of this.marks) {
      report[name] = time - this.startTime;
    }

    return report;
  }
}
