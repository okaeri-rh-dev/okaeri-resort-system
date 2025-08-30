/**
 * TypeScript Interfaces for Test Utilities
 * Comprehensive type definitions for all test infrastructure components
 */

import { z } from "zod";
import type { BookingInput, ExpenseInput, PaymentInput, UserInput } from "@/types/schemas";

// ====================================
// MOCK SERVICE INTERFACES
// ====================================

/**
 * Mock service configuration for deterministic testing
 */
export interface MockServiceConfig {
  deterministic: boolean;
  errorRate: number;
  networkDelay: { min: number; max: number };
  seed?: string;
  forceScenarios?: string[];
}

/**
 * Mock service base interface
 */
export interface MockServiceBase<T, CreateDTO, UpdateDTO> {
  config: MockServiceConfig;
  setDeterministicMode(enabled: boolean, errorRate?: number): void;
  forceError(scenario: string): void;
  reset(): void;

  // CRUD operations
  list(filters?: any): Promise<T[]>;
  get(id: string): Promise<T>;
  create(data: CreateDTO): Promise<T>;
  update(id: string, data: UpdateDTO): Promise<T>;
  delete(id: string): Promise<void>;

  // Batch operations
  batchCreate(data: CreateDTO[]): Promise<T[]>;
  batchUpdate(updates: { id: string; data: UpdateDTO }[]): Promise<T[]>;
  batchDelete(ids: string[]): Promise<void>;
}

/**
 * Service error simulation interface
 */
export interface ErrorSimulatorConfig {
  deterministic: boolean;
  errorRate: number;
  networkDelay: { min: number; max: number };
  seed?: string;
  forceScenarios?: string[];
}

export interface ErrorScenario {
  probability: number;
  error: Error;
}

export interface ErrorSimulator {
  config: ErrorSimulatorConfig;
  scenarios: Record<string, ErrorScenario>;

  simulate(scenario?: string): Promise<void>;
  simulateNetworkConditions(type: "slow-3g" | "fast-3g" | "4g" | "wifi"): Promise<void>;
  setScenario(scenario: string): void;
  forceError(scenario: string): void;
  reset(): void;
}

// ====================================
// TEST DATA FACTORY INTERFACES
// ====================================

/**
 * Base factory options interface
 */
export interface BaseFactoryOptions {
  id?: string;
  seed?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Factory method interface
 */
export interface FactoryMethod<T, TOptions extends BaseFactoryOptions> {
  (overrides?: TOptions): T;
}

/**
 * Batch factory method interface
 */
export interface BatchFactoryMethod<T, TOptions extends BaseFactoryOptions> {
  (count: number, overrides?: TOptions): T[];
}

/**
 * Factory scenario interface
 */
export interface FactoryScenario<T, TOptions extends BaseFactoryOptions> {
  [scenarioName: string]: FactoryMethod<T, TOptions>;
}

/**
 * Generic factory interface
 */
export interface DataFactory<T, TOptions extends BaseFactoryOptions> {
  create: FactoryMethod<T, TOptions>;
  createMany: BatchFactoryMethod<T, TOptions>;
  scenarios: FactoryScenario<T, TOptions>;
  resetCounter(): void;
}

/**
 * User factory interface
 */
export interface UserFactory
  extends DataFactory<
    UserInput,
    BaseFactoryOptions & {
      email?: string;
      name?: string;
      role?: string;
      emailVerified?: boolean;
    }
  > {
  createAdmin: FactoryMethod<UserInput, BaseFactoryOptions>;
  createManager: FactoryMethod<UserInput, BaseFactoryOptions>;
  createStaff: FactoryMethod<UserInput, BaseFactoryOptions>;
  createViewer: FactoryMethod<UserInput, BaseFactoryOptions>;
  createAuthenticated: FactoryMethod<
    {
      user: UserInput;
      token: string;
      refreshToken: string;
      expiresIn: number;
    },
    BaseFactoryOptions
  >;
}

/**
 * Booking factory interface
 */
export interface BookingFactory
  extends DataFactory<
    BookingInput,
    BaseFactoryOptions & {
      guestName?: string;
      guestEmail?: string;
      checkInDate?: string;
      checkOutDate?: string;
      totalAmount?: string;
      status?: string;
    }
  > {
  createInRange: (
    startDate: string,
    endDate: string,
    count: number,
    overrides?: any
  ) => BookingInput[];
}

/**
 * Expense factory interface
 */
export interface ExpenseFactory
  extends DataFactory<
    ExpenseInput,
    BaseFactoryOptions & {
      categoryId?: string;
      description?: string;
      amount?: string;
      vendorName?: string;
      status?: string;
    }
  > {
  createMonthly: (year: number, month: number, count: number, overrides?: any) => ExpenseInput[];
  createCategories: () => Array<{ id: string; name: string; slug: string }>;
  groupByCategory: (expenses: ExpenseInput[]) => Record<string, ExpenseInput[]>;
}

/**
 * Payment factory interface
 */
export interface PaymentFactory
  extends DataFactory<
    PaymentInput,
    BaseFactoryOptions & {
      bookingId?: string;
      amount?: string;
      paymentMethod?: string;
      status?: string;
    }
  > {
  createForBooking: (
    bookingId: string,
    totalAmount: number,
    plan: string,
    overrides?: any
  ) => PaymentInput[];
  createInRange: (
    startDate: string,
    endDate: string,
    count: number,
    overrides?: any
  ) => PaymentInput[];
  groupByMethod: (payments: PaymentInput[]) => Record<string, PaymentInput[]>;
}

// ====================================
// TEST DATA SEEDING INTERFACES
// ====================================

/**
 * Seeding configuration interface
 */
export interface SeedingConfig {
  level: "unit" | "integration" | "e2e";
  scenario: "minimal" | "standard" | "comprehensive" | "stress";
  deterministic: boolean;
  seed?: string;
  clearExisting?: boolean;
}

/**
 * Seeded data structure interface
 */
export interface SeededTestData {
  users: UserInput[];
  bookings: BookingInput[];
  expenses: ExpenseInput[];
  payments: PaymentInput[];
  categories: Array<{ id: string; name: string; slug: string }>;
  metadata: {
    seedId: string;
    timestamp: string;
    config: SeedingConfig;
    counts: {
      users: number;
      bookings: number;
      expenses: number;
      payments: number;
    };
  };
}

/**
 * Test data seeder interface
 */
export interface TestDataSeeder {
  seed(config: SeedingConfig): Promise<SeededTestData>;
  seedMinimal(): Promise<SeededTestData>;
  seedStandard(): Promise<SeededTestData>;
  seedComprehensive(): Promise<SeededTestData>;
  seedFinancial(months: number): Promise<SeededTestData & { financialSummary: any }>;
  seedErrors(): Promise<SeededTestData & { errorData: any }>;

  clearData(): Promise<void>;
  reset(): Promise<void>;

  getCached(config: SeedingConfig): SeededTestData | null;
  hasCached(config: SeedingConfig): boolean;
  getCacheStats(): { size: number; keys: string[]; totalDataPoints: number };
}

// ====================================
// CONTRACT TESTING INTERFACES
// ====================================

/**
 * Contract test case interface
 */
export interface ContractTestCase<TInput, TOutput> {
  name: string;
  description: string;
  input: TInput;
  expectedOutput?: Partial<TOutput>;
  expectedStatus: number;
  expectedErrors?: string[];
  timeout?: number;
}

/**
 * Contract test suite interface
 */
export interface ContractTestSuite<TInput, TOutput> {
  serviceName: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  mockService: any;
  realApiUrl?: string;
  testCases: ContractTestCase<TInput, TOutput>[];
  requestSchema?: z.ZodSchema<TInput>;
  responseSchema?: z.ZodSchema<TOutput>;
}

/**
 * Contract test result interface
 */
export interface ContractTestResult {
  testCase: string;
  passed: boolean;
  mockResult: any;
  realResult?: any;
  differences: string[];
  errors: string[];
  duration: number;
}

/**
 * Contract tester interface
 */
export interface ContractTester {
  runTests<TInput, TOutput>(
    suite: ContractTestSuite<TInput, TOutput>
  ): Promise<ContractTestResult[]>;
  getResults(): ContractTestResult[];
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
    averageDuration: number;
  };
  clearResults(): void;
}

// ====================================
// TEST UTILITY INTERFACES
// ====================================

/**
 * Test scenario configuration interface
 */
export interface TestScenario {
  name: string;
  description: string;
  errorSimulator: ErrorSimulator;
  networkDelay: { min: number; max: number };
  deterministic: boolean;
  seedConfig: SeedingConfig;
}

/**
 * Test environment interface
 */
export interface TestEnvironment {
  level: "unit" | "integration" | "e2e";
  deterministic: boolean;
  mockServices: Record<string, MockServiceBase<any, any, any>>;
  seeder: TestDataSeeder;
  contractTester: ContractTester;

  setup(): Promise<void>;
  teardown(): Promise<void>;
  reset(): Promise<void>;
}

/**
 * Mock database interface
 */
export interface MockDatabase {
  get<T>(collection: string): Promise<T[]>;
  set<T>(collection: string, data: T[]): Promise<void>;
  clear(collection?: string): Promise<void>;
  seed(): Promise<void>;
  reset(): Promise<void>;
}

/**
 * Mock service utilities interface
 */
export interface MockServiceUtils {
  resetMocks(): Promise<void>;
  setScenario(scenario: string): Promise<void>;
  createTestData(type: "minimal" | "standard" | "comprehensive"): Promise<void>;
  getServiceCalls(service: string, method: string): any[];
  overrideMock(service: string, method: string, response: any, scenario?: string): Promise<void>;
  forceError(scenario: string): void;
}

// ====================================
// VALIDATION INTERFACES
// ====================================

/**
 * Schema validator interface
 */
export interface SchemaValidator<T> {
  schema: z.ZodSchema<T>;
  validate(data: any): { valid: boolean; errors: string[]; data?: T };
  validateMany(data: any[]): {
    valid: boolean;
    errors: string[];
    validData: T[];
    invalidData: any[];
  };
}

/**
 * Test data validator interface
 */
export interface TestDataValidator {
  validateBooking(booking: any): Promise<boolean>;
  validateExpense(expense: any): Promise<boolean>;
  validatePayment(payment: any): Promise<boolean>;
  validateUser(user: any): Promise<boolean>;

  validateRelationships(data: SeededTestData): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
}

// ====================================
// TEST HELPER INTERFACES
// ====================================

/**
 * Test helper functions interface
 */
export interface TestHelpers {
  // Time helpers
  waitFor(condition: () => boolean | Promise<boolean>, timeout?: number): Promise<void>;
  sleep(ms: number): Promise<void>;
  withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T>;

  // Data helpers
  generateId(): string;
  generateEmail(): string;
  generatePhoneNumber(): string;
  generateAmount(min?: number, max?: number): string;

  // Mock helpers
  mockConsole(): { logs: string[]; errors: string[]; restore: () => void };
  mockDateNow(date: Date): () => void;
  mockRandom(values: number[]): () => void;

  // Assertion helpers
  expectDeepEqual<T>(actual: T, expected: T): void;
  expectArrayContains<T>(array: T[], item: T): void;
  expectValidSchema<T>(data: any, schema: z.ZodSchema<T>): void;
}

/**
 * Performance testing interface
 */
export interface PerformanceTester {
  measureExecution<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number; memory?: number }>;
  benchmarkFunction<T>(
    operation: () => Promise<T>,
    iterations: number
  ): Promise<{
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    totalDuration: number;
    memoryUsage?: number;
  }>;
  createReport(results: any[]): string;
}

// ====================================
// INTEGRATION INTERFACES
// ====================================

/**
 * Vitest integration interface
 */
export interface VitestIntegration {
  setupTestEnvironment(): Promise<void>;
  teardownTestEnvironment(): Promise<void>;
  configureGlobals(): void;
  setupMocks(): void;
}

/**
 * Playwright integration interface
 */
export interface PlaywrightIntegration {
  setupE2EData(): Promise<void>;
  cleanupE2EData(): Promise<void>;
  configureTestDatabase(): Promise<void>;
  seedE2EDatabase(): Promise<void>;
}

/**
 * Test configuration interface
 */
export interface TestConfig {
  environment: "jsdom" | "node" | "happy-dom";
  deterministic: boolean;
  defaultSeed: string;
  mockServices: boolean;
  realApiUrl?: string;
  database: {
    url: string;
    resetBetweenTests: boolean;
  };
  coverage: {
    enabled: boolean;
    threshold: number;
  };
  timeouts: {
    unit: number;
    integration: number;
    e2e: number;
  };
}

// ====================================
// ERROR HANDLING INTERFACES
// ====================================

/**
 * Test error interface
 */
export interface TestError extends Error {
  type: "validation" | "network" | "timeout" | "assertion" | "setup";
  context?: Record<string, any>;
  retryable?: boolean;
}

/**
 * Error handler interface
 */
export interface TestErrorHandler {
  handle(error: TestError): Promise<void>;
  shouldRetry(error: TestError): boolean;
  getRetryDelay(attemptNumber: number): number;
  createReport(errors: TestError[]): string;
}

// ====================================
// REPORTING INTERFACES
// ====================================

/**
 * Test report interface
 */
export interface TestReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  performance?: {
    averageTestDuration: number;
    slowestTests: Array<{ name: string; duration: number }>;
    memoryUsage: number;
  };
  errors: TestError[];
}

/**
 * Report generator interface
 */
export interface ReportGenerator {
  generateHtmlReport(report: TestReport): string;
  generateJsonReport(report: TestReport): string;
  generateMarkdownReport(report: TestReport): string;
  saveReport(report: TestReport, format: "html" | "json" | "markdown", path: string): Promise<void>;
}

// ====================================
// TYPE EXPORTS
// ====================================

/**
 * Union types for common enums
 */
export type TestLevel = "unit" | "integration" | "e2e";
export type TestScenario = "minimal" | "standard" | "comprehensive" | "stress";
export type MockServiceMethod = "GET" | "POST" | "PUT" | "DELETE";
export type ErrorType = "validation" | "network" | "timeout" | "assertion" | "setup";

/**
 * Utility types for factory options
 */
export type FactoryOptions<T> = Partial<T> & BaseFactoryOptions;

/**
 * Generic test data type
 */
export type TestData<T> = T & {
  __testMetadata: {
    factory: string;
    seed: string;
    timestamp: string;
  };
};

/**
 * Test suite configuration type
 */
export type TestSuiteConfig<TInput, TOutput> = {
  name: string;
  mockService: MockServiceBase<TOutput, TInput, Partial<TInput>>;
  testCases: ContractTestCase<TInput, TOutput>[];
  schemas?: {
    request?: z.ZodSchema<TInput>;
    response?: z.ZodSchema<TOutput>;
  };
};
