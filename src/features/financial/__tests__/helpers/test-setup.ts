/**
 * Test Setup Utilities
 * Centralized mocking and test helpers for financial module tests
 */

import { vi } from "vitest";
import { Money } from "@/lib/money";

/**
 * Create a chainable mock for Drizzle ORM queries
 */
export function createDbMock() {
  const mockResult: any[] = [];

  const chainableMock = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ne: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    between: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(mockResult),
    then: vi.fn((resolve) => resolve(mockResult)),
    catch: vi.fn(),
    finally: vi.fn(),
  };

  // Make each method return the chainable object
  Object.keys(chainableMock).forEach((key) => {
    if (key !== "execute" && key !== "then" && key !== "catch" && key !== "finally") {
      (chainableMock as any)[key].mockReturnValue(chainableMock);
    }
  });

  const dbMock = {
    select: vi.fn(() => chainableMock),
    insert: vi.fn(() => chainableMock),
    update: vi.fn(() => chainableMock),
    delete: vi.fn(() => chainableMock),
    from: vi.fn(() => chainableMock),
    where: vi.fn(() => chainableMock),
    transaction: vi.fn(async (fn) => fn(dbMock)),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([]),
    setMockResult: (result: any) => {
      mockResult.length = 0;
      mockResult.push(...(Array.isArray(result) ? result : [result]));
    },
  };

  return dbMock;
}

/**
 * Mock the ExpenseService dependencies
 */
export function mockExpenseService() {
  const dbMock = createDbMock();

  vi.mock("@/lib/db", () => ({
    db: dbMock,
    drizzleDb: dbMock,
  }));

  vi.mock("@/lib/audit", () => ({
    logFinancialActivity: vi.fn().mockResolvedValue(undefined),
  }));

  vi.mock("@/lib/utils", () => ({
    generateCode: vi.fn(
      (prefix: string, seq: number) => `${prefix}-${seq.toString().padStart(6, "0")}`
    ),
  }));

  return { dbMock };
}

/**
 * Mock the IncomeService dependencies
 */
export function mockIncomeService() {
  const dbMock = createDbMock();

  vi.mock("@/lib/db", () => ({
    db: dbMock,
    drizzleDb: dbMock,
  }));

  vi.mock("@/lib/audit", () => ({
    logFinancialActivity: vi.fn().mockResolvedValue(undefined),
  }));

  return { dbMock };
}

/**
 * Mock the PaymentService dependencies
 */
export function mockPaymentService() {
  const dbMock = createDbMock();

  vi.mock("@/lib/db", () => ({
    db: dbMock,
    drizzleDb: dbMock,
  }));

  vi.mock("@/lib/audit", () => ({
    logFinancialActivity: vi.fn().mockResolvedValue(undefined),
  }));

  // Mock payment gateways
  vi.mock("@/lib/payment-gateways", () => ({
    processGCashPayment: vi.fn().mockResolvedValue({
      success: true,
      transactionId: "GCASH-123456",
      fee: new Money(10),
    }),
    processPayMongoPayment: vi.fn().mockResolvedValue({
      success: true,
      transactionId: "PM-123456",
      fee: new Money(25),
    }),
  }));

  return { dbMock };
}

/**
 * Create a mock expense with proper Money instances
 */
export function createMockExpense(overrides: any = {}) {
  return {
    id: "EXP-000001",
    projectId: "proj-123",
    description: "Test expense",
    amount: new Money(1000),
    category: "SUPPLIES_OFFICE",
    status: "DRAFT",
    approvalLevel: "AUTO",
    createdBy: "user-123",
    createdAt: new Date(),
    vatAmount: new Money(120),
    netAmount: new Money(880),
    isVatable: true,
    ...overrides,
  };
}

/**
 * Create a mock income with proper Money instances
 */
export function createMockIncome(overrides: any = {}) {
  return {
    id: "INC-000001",
    projectId: "proj-123",
    bookingId: "book-123",
    platform: "DIRECT",
    grossAmount: new Money(5000),
    netAmount: new Money(4400),
    platformFees: new Money(0),
    vatAmount: new Money(600),
    bookingDate: new Date(),
    recordedBy: "user-123",
    recordedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock payment with proper Money instances
 */
export function createMockPayment(overrides: any = {}) {
  return {
    id: "PAY-000001",
    projectId: "proj-123",
    bookingId: "book-123",
    amount: new Money(5000),
    method: "GCASH",
    status: "COMPLETED",
    transactionId: "TXN-123456",
    processingFee: new Money(50),
    netAmount: new Money(4950),
    processedBy: "user-123",
    processedAt: new Date(),
    ...overrides,
  };
}

/**
 * Assert Money values are equal
 */
export function assertMoneyEqual(actual: Money | undefined, expected: number, message?: string) {
  if (!actual) {
    throw new Error(`${message || "Money value"} is undefined`);
  }
  expect(actual.toNumber()).toBeCloseTo(expected, 2);
}

/**
 * Setup common test environment
 */
export function setupTestEnvironment() {
  // Set timezone to Asia/Manila for Philippine business logic
  process.env.TZ = "Asia/Manila";

  // Mock date for consistent testing
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-07T10:00:00+08:00"));

  return {
    cleanup: () => {
      vi.useRealTimers();
      vi.clearAllMocks();
    },
  };
}
