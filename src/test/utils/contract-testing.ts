/**
 * Contract Testing Utilities
 * Simple approach to ensure mock/real API parity without enterprise complexity
 * Validates that mock services behave identically to real API endpoints
 */

import { z } from "zod";
import type {
  BookingInput,
  CreateBookingInput,
  ExpenseInput,
  CreateExpenseInput,
  PaymentInput,
  CreatePaymentInput,
} from "@/types/schemas";

export interface ContractTestCase<TInput, TOutput> {
  name: string;
  description: string;
  input: TInput;
  expectedOutput?: Partial<TOutput>;
  expectedStatus: number;
  expectedErrors?: string[];
  timeout?: number;
}

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

export interface ContractTestResult {
  testCase: string;
  passed: boolean;
  mockResult: any;
  realResult?: any;
  differences: string[];
  errors: string[];
  duration: number;
}

export class ContractTester {
  private results: ContractTestResult[] = [];
  private skipRealApi: boolean;

  constructor(options: { skipRealApi?: boolean } = {}) {
    this.skipRealApi = options.skipRealApi ?? true; // Skip real API by default for solo dev
  }

  /**
   * Run contract tests for a service
   */
  async runContractTests<TInput, TOutput>(
    suite: ContractTestSuite<TInput, TOutput>
  ): Promise<ContractTestResult[]> {
    console.log(`\n🔧 Running contract tests for ${suite.serviceName}`);

    const results: ContractTestResult[] = [];

    for (const testCase of suite.testCases) {
      const result = await this.runSingleContractTest(suite, testCase);
      results.push(result);
      this.results.push(result);
    }

    // Summary
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log(`\n✅ Contract tests: ${passed}/${total} passed`);

    if (passed !== total) {
      console.log("❌ Failed tests:");
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.testCase}: ${r.errors.join(", ")}`);
        });
    }

    return results;
  }

  /**
   * Run a single contract test case
   */
  private async runSingleContractTest<TInput, TOutput>(
    suite: ContractTestSuite<TInput, TOutput>,
    testCase: ContractTestCase<TInput, TOutput>
  ): Promise<ContractTestResult> {
    const startTime = Date.now();
    const result: ContractTestResult = {
      testCase: testCase.name,
      passed: false,
      mockResult: null,
      realResult: null,
      differences: [],
      errors: [],
      duration: 0,
    };

    try {
      // Test mock service
      result.mockResult = await this.callMockService(suite, testCase);

      // Test real API if not skipped
      if (!this.skipRealApi && suite.realApiUrl) {
        result.realResult = await this.callRealApi(suite, testCase);

        // Compare results
        const comparison = this.compareResults(result.mockResult, result.realResult);
        result.differences = comparison.differences;
        result.passed = comparison.identical && comparison.validMock && comparison.validReal;

        if (!comparison.identical) {
          result.errors.push("Mock and real API responses differ");
        }
      } else {
        // Only validate mock service when real API is skipped
        const mockValidation = this.validateMockResponse(suite, result.mockResult, testCase);
        result.passed = mockValidation.valid;
        result.errors = mockValidation.errors;
      }
    } catch (error) {
      result.errors.push(`Test execution failed: ${error.message}`);
      result.passed = false;
    }

    result.duration = Date.now() - startTime;

    // Log result
    const status = result.passed ? "✅" : "❌";
    console.log(`  ${status} ${testCase.name} (${result.duration}ms)`);
    if (!result.passed) {
      result.errors.forEach((error) => console.log(`    ⚠️  ${error}`));
    }

    return result;
  }

  /**
   * Call mock service
   */
  private async callMockService<TInput, TOutput>(
    suite: ContractTestSuite<TInput, TOutput>,
    testCase: ContractTestCase<TInput, TOutput>
  ): Promise<any> {
    const method = this.getServiceMethod(suite);

    try {
      const result = await suite.mockService[method](testCase.input);
      return {
        status: 200,
        data: result,
        error: null,
      };
    } catch (error) {
      return {
        status: error.status || 500,
        data: null,
        error: error.message,
      };
    }
  }

  /**
   * Call real API (placeholder for when backend is implemented)
   */
  private async callRealApi<TInput, TOutput>(
    suite: ContractTestSuite<TInput, TOutput>,
    testCase: ContractTestCase<TInput, TOutput>
  ): Promise<any> {
    if (!suite.realApiUrl) {
      throw new Error("Real API URL not configured");
    }

    const url = `${suite.realApiUrl}${suite.endpoint}`;
    const options: RequestInit = {
      method: suite.method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (suite.method !== "GET") {
      options.body = JSON.stringify(testCase.input);
    }

    try {
      const response = await fetch(url, options);
      const data = response.ok ? await response.json() : null;

      return {
        status: response.status,
        data,
        error: response.ok ? null : await response.text(),
      };
    } catch (error) {
      return {
        status: 0,
        data: null,
        error: error.message,
      };
    }
  }

  /**
   * Compare mock and real API results
   */
  private compareResults(
    mockResult: any,
    realResult: any
  ): {
    identical: boolean;
    validMock: boolean;
    validReal: boolean;
    differences: string[];
  } {
    const differences: string[] = [];

    // Compare status codes
    if (mockResult.status !== realResult.status) {
      differences.push(`Status mismatch: mock=${mockResult.status}, real=${realResult.status}`);
    }

    // Compare data structure (deep comparison)
    if (mockResult.data && realResult.data) {
      const dataDiffs = this.deepCompare(mockResult.data, realResult.data, "data");
      differences.push(...dataDiffs);
    } else if (mockResult.data !== realResult.data) {
      differences.push("Data presence mismatch");
    }

    // Compare error presence
    if (Boolean(mockResult.error) !== Boolean(realResult.error)) {
      differences.push("Error presence mismatch");
    }

    return {
      identical: differences.length === 0,
      validMock: this.isValidResponse(mockResult),
      validReal: this.isValidResponse(realResult),
      differences,
    };
  }

  /**
   * Validate mock response against expected behavior
   */
  private validateMockResponse<TInput, TOutput>(
    suite: ContractTestSuite<TInput, TOutput>,
    mockResult: any,
    testCase: ContractTestCase<TInput, TOutput>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check expected status
    if (mockResult.status !== testCase.expectedStatus) {
      errors.push(`Expected status ${testCase.expectedStatus}, got ${mockResult.status}`);
    }

    // Validate response schema
    if (suite.responseSchema && mockResult.data) {
      try {
        suite.responseSchema.parse(mockResult.data);
      } catch (error) {
        errors.push(`Response schema validation failed: ${error.message}`);
      }
    }

    // Check expected output fields
    if (testCase.expectedOutput && mockResult.data) {
      for (const [key, expectedValue] of Object.entries(testCase.expectedOutput)) {
        const actualValue = mockResult.data[key];
        if (actualValue !== expectedValue) {
          errors.push(`Expected ${key}=${expectedValue}, got ${actualValue}`);
        }
      }
    }

    // Check expected errors
    if (testCase.expectedErrors && testCase.expectedErrors.length > 0) {
      const hasExpectedError = testCase.expectedErrors.some(
        (expectedError) => mockResult.error && mockResult.error.includes(expectedError)
      );
      if (!hasExpectedError) {
        errors.push(`Expected error containing: ${testCase.expectedErrors.join(" or ")}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Deep compare two objects and return differences
   */
  private deepCompare(obj1: any, obj2: any, path: string = ""): string[] {
    const differences: string[] = [];

    if (typeof obj1 !== typeof obj2) {
      differences.push(`${path}: type mismatch (${typeof obj1} vs ${typeof obj2})`);
      return differences;
    }

    if (obj1 === null || obj2 === null) {
      if (obj1 !== obj2) {
        differences.push(`${path}: null mismatch`);
      }
      return differences;
    }

    if (typeof obj1 === "object" && !Array.isArray(obj1)) {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);

      // Check for missing keys
      keys1.forEach((key) => {
        if (!(key in obj2)) {
          differences.push(`${path}.${key}: missing in real API`);
        }
      });

      keys2.forEach((key) => {
        if (!(key in obj1)) {
          differences.push(`${path}.${key}: missing in mock`);
        }
      });

      // Compare common keys
      keys1.forEach((key) => {
        if (key in obj2) {
          const subDiffs = this.deepCompare(obj1[key], obj2[key], `${path}.${key}`);
          differences.push(...subDiffs);
        }
      });
    } else if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) {
        differences.push(`${path}: array length mismatch (${obj1.length} vs ${obj2.length})`);
      }

      const minLength = Math.min(obj1.length, obj2.length);
      for (let i = 0; i < minLength; i++) {
        const subDiffs = this.deepCompare(obj1[i], obj2[i], `${path}[${i}]`);
        differences.push(...subDiffs);
      }
    } else if (obj1 !== obj2) {
      differences.push(`${path}: value mismatch (${obj1} vs ${obj2})`);
    }

    return differences;
  }

  /**
   * Get service method name from suite configuration
   */
  private getServiceMethod<TInput, TOutput>(suite: ContractTestSuite<TInput, TOutput>): string {
    switch (suite.method) {
      case "GET":
        return suite.endpoint.includes(":id") ? "get" : "list";
      case "POST":
        return "create";
      case "PUT":
        return "update";
      case "DELETE":
        return "delete";
      default:
        throw new Error(`Unsupported method: ${suite.method}`);
    }
  }

  /**
   * Check if response is valid
   */
  private isValidResponse(result: any): boolean {
    return result && typeof result.status === "number";
  }

  /**
   * Get all test results
   */
  getResults(): ContractTestResult[] {
    return [...this.results];
  }

  /**
   * Get test summary
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
    averageDuration: number;
  } {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = total - passed;
    const averageDuration =
      total > 0 ? this.results.reduce((sum, r) => sum + r.duration, 0) / total : 0;

    return {
      total,
      passed,
      failed,
      successRate: total > 0 ? (passed / total) * 100 : 0,
      averageDuration: Math.round(averageDuration),
    };
  }

  /**
   * Clear all test results
   */
  clearResults(): void {
    this.results = [];
  }
}

/**
 * Contract test builder for easier test creation
 */
export class ContractTestBuilder<TInput, TOutput> {
  private suite: Partial<ContractTestSuite<TInput, TOutput>> = {
    testCases: [],
  };

  service(name: string): this {
    this.suite.serviceName = name;
    return this;
  }

  endpoint(path: string): this {
    this.suite.endpoint = path;
    return this;
  }

  method(verb: "GET" | "POST" | "PUT" | "DELETE"): this {
    this.suite.method = verb;
    return this;
  }

  mockService(service: any): this {
    this.suite.mockService = service;
    return this;
  }

  realApiUrl(url: string): this {
    this.suite.realApiUrl = url;
    return this;
  }

  requestSchema(schema: z.ZodSchema<TInput>): this {
    this.suite.requestSchema = schema;
    return this;
  }

  responseSchema(schema: z.ZodSchema<TOutput>): this {
    this.suite.responseSchema = schema;
    return this;
  }

  testCase(testCase: ContractTestCase<TInput, TOutput>): this {
    this.suite.testCases!.push(testCase);
    return this;
  }

  build(): ContractTestSuite<TInput, TOutput> {
    if (
      !this.suite.serviceName ||
      !this.suite.endpoint ||
      !this.suite.method ||
      !this.suite.mockService
    ) {
      throw new Error("Missing required suite configuration");
    }

    return this.suite as ContractTestSuite<TInput, TOutput>;
  }
}

/**
 * Helper function to create contract tests
 */
export function createContractTest<TInput, TOutput>(): ContractTestBuilder<TInput, TOutput> {
  return new ContractTestBuilder<TInput, TOutput>();
}

/**
 * Default contract tester instance
 */
export const contractTester = new ContractTester({ skipRealApi: true });

/**
 * Quick contract test runners for common scenarios
 */
export const runContractTests = {
  /**
   * Test booking service contracts
   */
  async bookings(mockService: any): Promise<ContractTestResult[]> {
    const { BookingSchema, CreateBookingSchema } = await import("@/types/schemas");
    const { createBookingData, createBooking } = await import("../factories/booking.factory");

    const validBookingData = createBookingData({ seed: "contract-booking" });
    const validBooking = createBooking({ seed: "contract-booking" });

    const suite = createContractTest<CreateBookingInput, BookingInput>()
      .service("BookingService")
      .endpoint("/bookings")
      .method("POST")
      .mockService(mockService)
      .requestSchema(CreateBookingSchema)
      .responseSchema(BookingSchema)
      .testCase({
        name: "Create valid booking",
        description: "Should create booking with valid data",
        input: validBookingData,
        expectedStatus: 200,
        expectedOutput: {
          guestName: validBookingData.guestName,
          totalAmount: validBookingData.totalAmount,
        },
      })
      .testCase({
        name: "Reject invalid booking",
        description: "Should reject booking with invalid data",
        input: {
          ...validBookingData,
          checkOutDate: "2024-01-01", // Before check-in
          checkInDate: "2024-01-05",
        } as any,
        expectedStatus: 400,
        expectedErrors: ["Check-out date must be after check-in date"],
      })
      .build();

    return contractTester.runContractTests(suite);
  },

  /**
   * Test expense service contracts
   */
  async expenses(mockService: any): Promise<ContractTestResult[]> {
    const { ExpenseSchema, CreateExpenseSchema } = await import("@/types/schemas");
    const { createExpenseData } = await import("../factories/expense.factory");

    const validExpenseData = createExpenseData({ seed: "contract-expense" });

    const suite = createContractTest<CreateExpenseInput, ExpenseInput>()
      .service("ExpenseService")
      .endpoint("/expenses")
      .method("POST")
      .mockService(mockService)
      .requestSchema(CreateExpenseSchema)
      .responseSchema(ExpenseSchema)
      .testCase({
        name: "Create valid expense",
        description: "Should create expense with valid data",
        input: validExpenseData,
        expectedStatus: 200,
        expectedOutput: {
          description: validExpenseData.description,
          amount: validExpenseData.amount,
        },
      })
      .testCase({
        name: "Reject invalid expense",
        description: "Should reject expense with negative amount",
        input: {
          ...validExpenseData,
          amount: "-100.00",
        } as any,
        expectedStatus: 400,
        expectedErrors: ["Amount must be greater than 0"],
      })
      .build();

    return contractTester.runContractTests(suite);
  },

  /**
   * Run all contract tests
   */
  async all(services: { booking?: any; expense?: any; payment?: any }): Promise<{
    booking: ContractTestResult[];
    expense: ContractTestResult[];
    summary: any;
  }> {
    const results = {
      booking: [] as ContractTestResult[],
      expense: [] as ContractTestResult[],
      summary: null as any,
    };

    if (services.booking) {
      results.booking = await this.bookings(services.booking);
    }

    if (services.expense) {
      results.expense = await this.expenses(services.expense);
    }

    results.summary = contractTester.getSummary();
    return results;
  },
};
