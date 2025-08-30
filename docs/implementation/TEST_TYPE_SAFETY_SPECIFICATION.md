# Test Type Safety Specification

## Overview

This document specifies comprehensive TypeScript patterns for testing
infrastructure, ensuring complete type safety across all test utilities,
factories, mocks, and integration patterns.

## Core Type Safety Principles

### Testing Type Safety Goals

1. **Complete type inference** in all test utilities
2. **Generic patterns** for reusable test functions
3. **Strict typing** for mock data and services
4. **Type-safe assertions** and expectations
5. **Contract testing** with schema validation
6. **Zero `any` types** in test code

## Generic Factory Type Patterns

### Base Factory Interface

**Purpose**: Provide type-safe factory patterns for all data entities.

```typescript
/**
 * Base options for all factory functions
 */
export interface BaseFactoryOptions {
  /** Optional ID override */
  id?: string;
  /** Seed for deterministic generation */
  seed?: string;
  /** Creation timestamp override */
  createdAt?: string;
  /** Update timestamp override */
  updatedAt?: string;
}

/**
 * Generic factory function type
 */
export type FactoryFunction<
  T,
  TOptions extends BaseFactoryOptions = BaseFactoryOptions,
> = (overrides?: TOptions) => T;

/**
 * Batch factory function type
 */
export type BatchFactoryFunction<
  T,
  TOptions extends BaseFactoryOptions = BaseFactoryOptions,
> = (count: number, overrides?: TOptions) => T[];

/**
 * Factory scenario type for predefined data scenarios
 */
export type FactoryScenario<
  T,
  TOptions extends BaseFactoryOptions = BaseFactoryOptions,
> = {
  readonly [scenarioName: string]: FactoryFunction<T, TOptions>;
};

/**
 * Complete factory interface
 */
export interface DataFactory<
  T,
  TOptions extends BaseFactoryOptions = BaseFactoryOptions,
> {
  /** Create single entity */
  readonly create: FactoryFunction<T, TOptions>;
  /** Create multiple entities */
  readonly createMany: BatchFactoryFunction<T, TOptions>;
  /** Predefined scenarios */
  readonly scenarios: FactoryScenario<T, TOptions>;
  /** Reset internal counters */
  resetCounter(): void;
}
```

### Typed Factory Implementation

**Pattern**: Implementation with complete type safety.

```typescript
import type { User, UserRole } from "@/types/common";
import { z } from "zod";

/**
 * User factory options with strict typing
 */
export interface UserFactoryOptions extends BaseFactoryOptions {
  readonly email?: string;
  readonly name?: string;
  readonly role?: UserRole;
  readonly emailVerified?: boolean;
  readonly avatar?: string;
}

/**
 * User factory with complete type safety
 */
class UserFactoryImpl implements DataFactory<User, UserFactoryOptions> {
  private static idCounter = 1;

  readonly create: FactoryFunction<User, UserFactoryOptions> = (
    overrides = {}
  ) => {
    const id = overrides.id ?? `user-test-${UserFactoryImpl.idCounter++}`;
    const email =
      overrides.email ?? `test${UserFactoryImpl.idCounter}@example.com`;
    const createdAt =
      overrides.createdAt ?? new Date("2024-01-01").toISOString();
    const updatedAt =
      overrides.updatedAt ?? new Date("2024-01-01").toISOString();

    const user: User = {
      id,
      email,
      name: overrides.name ?? `Test User ${UserFactoryImpl.idCounter}`,
      role: overrides.role ?? "VIEWER",
      avatar:
        overrides.avatar ??
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
      createdAt,
      updatedAt,
    };

    // Validate generated data against schema
    return UserSchema.parse(user);
  };

  readonly createMany: BatchFactoryFunction<User, UserFactoryOptions> = (
    count,
    overrides = {}
  ) => {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        ...overrides,
        email: overrides.email ?? `test${index + 1}@example.com`,
        name: overrides.name ?? `Test User ${index + 1}`,
      })
    );
  };

  readonly scenarios: FactoryScenario<User, UserFactoryOptions> = {
    admin: (overrides = {}) =>
      this.create({
        ...overrides,
        role: "ADMIN",
        email: overrides.email ?? "admin@okaeri.ph",
        name: overrides.name ?? "Admin User",
        emailVerified: true,
      }),

    manager: (overrides = {}) =>
      this.create({
        ...overrides,
        role: "MANAGER",
        email: overrides.email ?? "manager@okaeri.ph",
        name: overrides.name ?? "Manager User",
        emailVerified: true,
      }),

    staff: (overrides = {}) =>
      this.create({
        ...overrides,
        role: "STAFF",
        email: overrides.email ?? "staff@okaeri.ph",
        name: overrides.name ?? "Staff User",
        emailVerified: true,
      }),

    viewer: (overrides = {}) =>
      this.create({
        ...overrides,
        role: "VIEWER",
        email: overrides.email ?? "viewer@okaeri.ph",
        name: overrides.name ?? "Viewer User",
        emailVerified: true,
      }),

    unverified: (overrides = {}) =>
      this.create({
        ...overrides,
        emailVerified: false,
        email: overrides.email ?? "unverified@example.com",
        name: overrides.name ?? "Unverified User",
      }),
  } as const;

  resetCounter(): void {
    UserFactoryImpl.idCounter = 1;
  }
}

// Export singleton instance with full type inference
export const userFactory = new UserFactoryImpl();

// Export convenience functions with proper typing
export const createUser = userFactory.create;
export const createUsers = userFactory.createMany;
export const userScenarios = userFactory.scenarios;
export const resetUserIdCounter = userFactory.resetCounter;
```

## Mock Service Type Patterns

### Generic Mock Service Interface

```typescript
/**
 * Service error types for type-safe error handling
 */
export interface ServiceError {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Mock service configuration with strict typing
 */
export interface MockServiceConfig {
  readonly deterministic: boolean;
  readonly errorRate: number;
  readonly networkDelay: { readonly min: number; readonly max: number };
  readonly seed?: string;
  readonly forceScenarios?: readonly string[];
}

/**
 * Generic mock service interface with complete type safety
 */
export interface MockService<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TListFilters = Record<string, unknown>,
> {
  readonly config: MockServiceConfig;

  // Configuration methods
  setDeterministicMode(enabled: boolean, errorRate?: number): void;
  forceError(scenario: string): void;
  reset(): void;
  updateConfig(config: Partial<MockServiceConfig>): void;

  // CRUD operations with full type safety
  list(filters?: TListFilters): Promise<readonly TEntity[]>;
  get(id: string): Promise<TEntity>;
  create(data: TCreateInput): Promise<TEntity>;
  update(id: string, data: TUpdateInput): Promise<TEntity>;
  delete(id: string): Promise<void>;

  // Batch operations
  batchCreate(data: readonly TCreateInput[]): Promise<readonly TEntity[]>;
  batchUpdate(
    updates: readonly { readonly id: string; readonly data: TUpdateInput }[]
  ): Promise<readonly TEntity[]>;
  batchDelete(ids: readonly string[]): Promise<void>;

  // Search and filtering
  search(query: string, filters?: TListFilters): Promise<readonly TEntity[]>;

  // Statistics and metadata
  count(filters?: TListFilters): Promise<number>;
  exists(id: string): Promise<boolean>;
}
```

### Typed Mock Service Implementation

```typescript
import type {
  BookingInput,
  CreateBookingInput,
  UpdateBookingInput,
  BookingListFilters,
} from "@/types/schemas";
import { BookingSchema, CreateBookingSchema } from "@/lib/validations/booking";

/**
 * Type-safe booking mock service
 */
export class MockBookingService
  implements
    MockService<
      BookingInput,
      CreateBookingInput,
      UpdateBookingInput,
      BookingListFilters
    >
{
  private readonly mockData = new Map<string, BookingInput>();
  private readonly utils: MockServiceUtils;

  constructor(public readonly config: MockServiceConfig = DEFAULT_MOCK_CONFIG) {
    this.utils = new MockServiceUtils(config);
  }

  async list(filters?: BookingListFilters): Promise<readonly BookingInput[]> {
    return this.utils.executeWithSimulation(async () => {
      let bookings = Array.from(this.mockData.values());

      // Apply filters with type safety
      if (filters?.status) {
        bookings = bookings.filter(
          (booking) => booking.status === filters.status
        );
      }
      if (filters?.guestName) {
        bookings = bookings.filter((booking) =>
          booking.guestName
            .toLowerCase()
            .includes(filters.guestName!.toLowerCase())
        );
      }
      if (filters?.checkInDate) {
        bookings = bookings.filter(
          (booking) => booking.checkInDate >= filters.checkInDate!
        );
      }

      return bookings.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ) as readonly BookingInput[];
    });
  }

  async get(id: string): Promise<BookingInput> {
    return this.utils.executeWithSimulation(async () => {
      const booking = this.mockData.get(id);
      if (!booking) {
        throw new ServiceError(404, `Booking with ID ${id} not found`);
      }
      return booking;
    });
  }

  async create(data: CreateBookingInput): Promise<BookingInput> {
    return this.utils.executeWithSimulation(async () => {
      // Validate input data
      const validatedInput = CreateBookingSchema.parse(data);

      // Generate complete booking from create input
      const booking: BookingInput = {
        ...validatedInput,
        id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        bookingCode: this.generateBookingCode(),
        status: "PENDING",
        paymentStatus:
          parseFloat(validatedInput.paidAmount || "0") === 0
            ? "PENDING"
            : "PARTIAL",
        balanceAmount: (
          parseFloat(validatedInput.totalAmount) -
          parseFloat(validatedInput.paidAmount || "0")
        ).toFixed(2),
        createdBy: null,
        updatedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cancellationReason: null,
        cancelledAt: null,
        cancelledBy: null,
        metadata: {
          source: "test-factory",
          version: "1.0",
        },
      };

      // Validate complete booking
      const validatedBooking = BookingSchema.parse(booking);

      // Store in mock database
      this.mockData.set(validatedBooking.id, validatedBooking);

      return validatedBooking;
    });
  }

  async update(id: string, data: UpdateBookingInput): Promise<BookingInput> {
    return this.utils.executeWithSimulation(async () => {
      const existingBooking = await this.get(id);

      const updatedBooking: BookingInput = {
        ...existingBooking,
        ...data,
        id: existingBooking.id, // Prevent ID changes
        updatedAt: new Date().toISOString(),
      };

      // Validate updated booking
      const validatedBooking = BookingSchema.parse(updatedBooking);
      this.mockData.set(id, validatedBooking);

      return validatedBooking;
    });
  }

  async delete(id: string): Promise<void> {
    return this.utils.executeWithSimulation(async () => {
      if (!this.mockData.has(id)) {
        throw new ServiceError(404, `Booking with ID ${id} not found`);
      }
      this.mockData.delete(id);
    });
  }

  // Implementation of other interface methods...
  async batchCreate(
    data: readonly CreateBookingInput[]
  ): Promise<readonly BookingInput[]> {
    const results: BookingInput[] = [];
    for (const item of data) {
      results.push(await this.create(item));
    }
    return results as readonly BookingInput[];
  }

  // Additional type-safe methods...
  private generateBookingCode(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const sequence = String(Math.floor(Math.random() * 9999)).padStart(4, "0");
    return `OKR${year}${month}${sequence}`;
  }

  // Mock service interface implementations...
  setDeterministicMode(enabled: boolean, errorRate = 0.1): void {
    this.utils.updateConfig({ deterministic: enabled, errorRate });
  }

  forceError(scenario: string): void {
    this.utils.forceError(scenario);
  }

  reset(): void {
    this.mockData.clear();
    this.utils.reset();
  }

  updateConfig(config: Partial<MockServiceConfig>): void {
    Object.assign(this.config as any, config);
    this.utils.updateConfig(config);
  }

  // Other required methods implementation...
}
```

## Test Utility Type Patterns

### Generic Test Utilities

```typescript
/**
 * Generic render options for any component
 */
export interface TestRenderOptions<TProps = Record<string, unknown>> extends Omit<RenderOptions, 'wrapper'> {
  /** Props to pass to the component */
  readonly props?: TProps;
  /** Initial route for routing tests */
  readonly initialRoute?: string;
  /** Mock user for authentication */
  readonly user?: User | null;
  /** Custom query client */
  readonly queryClient?: QueryClient;
  /** Mock store states */
  readonly mockStoreStates?: Record<string, unknown>;
  /** Additional providers */
  readonly additionalProviders?: React.ComponentType<{ children: React.ReactNode }>;
}

/**
 * Type-safe component renderer
 */
export function renderComponent<TProps extends Record<string, unknown>>(
  Component: React.ComponentType<TProps>,
  options: TestRenderOptions<TProps> = {}
): RenderResult & {
  /** Rerender with new props */
  rerender(newProps: Partial<TProps>): void;
  /** Get component props */
  getProps(): TProps;
} {
  const {
    props = {} as TProps,
    initialRoute = '/',
    user = null,
    queryClient = createTestQueryClient(),
    mockStoreStates = {},
    additionalProviders,
    ...renderOptions
  } = options;

  let currentProps = props;

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <AllProviders
        initialRoute={initialRoute}
        user={user}
        queryClient={queryClient}
        mockStoreStates={mockStoreStates}
        additionalProviders={additionalProviders}
      >
        {children}
      </AllProviders>
    );
  };

  const result = rtlRender(
    <Component {...currentProps} />,
    { wrapper: Wrapper, ...renderOptions }
  );

  return {
    ...result,
    rerender: (newProps: Partial<TProps>) => {
      currentProps = { ...currentProps, ...newProps };
      result.rerender(<Component {...currentProps} />);
    },
    getProps: () => currentProps,
  };
}
```

### Type-Safe Form Testing

```typescript
/**
 * Form field value types
 */
export type FormFieldValue = string | number | boolean | string[] | File;

/**
 * Form data type from schema
 */
export type FormDataFromSchema<T extends z.ZodSchema> = z.infer<T>;

/**
 * Type-safe form field interaction
 */
export interface FormTestHelpers<T extends Record<string, FormFieldValue>> {
  /** Fill form fields with type-safe data */
  fillForm(data: Partial<T>): Promise<void>;
  /** Submit the form */
  submitForm(): Promise<void>;
  /** Get current form data */
  getFormData(): T;
  /** Check for field errors */
  expectFieldErrors(errors: Partial<Record<keyof T, string>>): void;
  /** Wait for form validation */
  waitForValidation(): Promise<void>;
  /** Clear form data */
  clearForm(): Promise<void>;
}

/**
 * Create type-safe form test helpers
 */
export function createFormTestHelpers<T extends Record<string, FormFieldValue>>(
  container: HTMLElement,
  schema: z.ZodSchema<T>
): FormTestHelpers<T> {
  return {
    async fillForm(data: Partial<T>): Promise<void> {
      const user = userEvent.setup();

      for (const [fieldName, value] of Object.entries(data)) {
        if (value === undefined) continue;

        const field = screen.getByLabelText(
          new RegExp(fieldName.replace(/([A-Z])/g, " $1").toLowerCase(), "i")
        );

        if (field.getAttribute("type") === "checkbox") {
          if (typeof value === "boolean") {
            if (value !== (field as HTMLInputElement).checked) {
              await user.click(field);
            }
          }
        } else if (field.tagName === "SELECT") {
          await user.selectOptions(field, value as string);
        } else {
          await user.clear(field);
          await user.type(field, String(value));
        }
      }
    },

    async submitForm(): Promise<void> {
      const user = userEvent.setup();
      const submitButton = screen.getByRole("button", {
        name: /submit|save|create|update/i,
      });
      await user.click(submitButton);
    },

    getFormData(): T {
      const form = container.querySelector("form")!;
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      // Validate and parse form data
      return schema.parse(data) as T;
    },

    expectFieldErrors(errors: Partial<Record<keyof T, string>>): void {
      Object.entries(errors).forEach(([fieldName, errorMessage]) => {
        const errorElement = screen.getByText(errorMessage as string);
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveAttribute("role", "alert");
      });
    },

    async waitForValidation(): Promise<void> {
      await waitFor(() => {
        const loadingIndicators =
          screen.queryAllByTestId(/validating|loading/i);
        expect(loadingIndicators).toHaveLength(0);
      });
    },

    async clearForm(): Promise<void> {
      const user = userEvent.setup();
      const form = container.querySelector("form")!;
      const inputs = form.querySelectorAll("input, textarea, select");

      for (const input of Array.from(inputs)) {
        if (input.getAttribute("type") === "checkbox") {
          if ((input as HTMLInputElement).checked) {
            await user.click(input);
          }
        } else {
          await user.clear(input);
        }
      }
    },
  };
}

/**
 * Usage example with complete type safety
 */
export function testLoginForm() {
  describe("LoginForm", () => {
    it("should handle form submission with type safety", async () => {
      const mockOnSubmit = vi.fn<[LoginFormData], Promise<void>>();
      const { container } = renderComponent(LoginForm, {
        props: { onSubmit: mockOnSubmit },
      });

      const formHelpers = createFormTestHelpers(container, loginSchema);

      await formHelpers.fillForm({
        email: "test@example.com",
        password: "Test123!",
        rememberMe: true,
      });

      await formHelpers.submitForm();
      await formHelpers.waitForValidation();

      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "Test123!",
        rememberMe: true,
      });
    });
  });
}
```

## Contract Testing Types

### API Contract Testing

```typescript
/**
 * Contract test case with complete type safety
 */
export interface TypedContractTestCase<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly input: TInput;
  readonly expectedOutput?: Partial<TOutput>;
  readonly expectedStatus: number;
  readonly expectedErrors?: readonly string[];
  readonly timeout?: number;
  readonly headers?: Record<string, string>;
}

/**
 * Contract test result with type information
 */
export interface TypedContractTestResult<TInput, TOutput> {
  readonly testCase: TypedContractTestCase<TInput, TOutput>;
  readonly passed: boolean;
  readonly mockResult: TOutput | null;
  readonly realResult?: TOutput | null;
  readonly differences: readonly string[];
  readonly errors: readonly string[];
  readonly duration: number;
  readonly inputValidation: {
    readonly valid: boolean;
    readonly errors: readonly string[];
  };
  readonly outputValidation: {
    readonly valid: boolean;
    readonly errors: readonly string[];
  };
}

/**
 * Type-safe contract tester
 */
export class TypedContractTester<TInput, TOutput> {
  constructor(
    private readonly inputSchema: z.ZodSchema<TInput>,
    private readonly outputSchema: z.ZodSchema<TOutput>,
    private readonly mockService: MockService<TOutput, TInput, Partial<TInput>>,
    private readonly realApiUrl?: string
  ) {}

  async runTests(
    testCases: readonly TypedContractTestCase<TInput, TOutput>[]
  ): Promise<readonly TypedContractTestResult<TInput, TOutput>[]> {
    const results: TypedContractTestResult<TInput, TOutput>[] = [];

    for (const testCase of testCases) {
      const startTime = performance.now();
      let mockResult: TOutput | null = null;
      let realResult: TOutput | null = null;
      const differences: string[] = [];
      const errors: string[] = [];

      // Validate input
      const inputValidation = this.validateInput(testCase.input);

      try {
        // Test mock service
        mockResult = await this.testMockService(testCase);

        // Test real API if URL provided
        if (this.realApiUrl) {
          realResult = await this.testRealApi(testCase);
          differences.push(...this.comparResults(mockResult, realResult));
        }
      } catch (error) {
        errors.push((error as Error).message);
      }

      // Validate output
      const outputValidation = this.validateOutput(mockResult);

      const duration = performance.now() - startTime;
      const passed =
        errors.length === 0 &&
        differences.length === 0 &&
        inputValidation.valid &&
        outputValidation.valid;

      results.push({
        testCase,
        passed,
        mockResult,
        realResult,
        differences,
        errors,
        duration,
        inputValidation,
        outputValidation,
      });
    }

    return results as readonly TypedContractTestResult<TInput, TOutput>[];
  }

  private validateInput(input: TInput): {
    valid: boolean;
    errors: readonly string[];
  } {
    try {
      this.inputSchema.parse(input);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => e.message),
        };
      }
      return { valid: false, errors: [String(error)] };
    }
  }

  private validateOutput(output: TOutput | null): {
    valid: boolean;
    errors: readonly string[];
  } {
    if (!output) return { valid: false, errors: ["No output received"] };

    try {
      this.outputSchema.parse(output);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => e.message),
        };
      }
      return { valid: false, errors: [String(error)] };
    }
  }

  private async testMockService(
    testCase: TypedContractTestCase<TInput, TOutput>
  ): Promise<TOutput> {
    // Implementation depends on the service method being tested
    if (testCase.name.includes("create")) {
      return this.mockService.create(testCase.input);
    }
    // Add other method mappings
    throw new Error(`Unknown test case method: ${testCase.name}`);
  }

  private async testRealApi(
    testCase: TypedContractTestCase<TInput, TOutput>
  ): Promise<TOutput> {
    const response = await fetch(`${this.realApiUrl}/endpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...testCase.headers,
      },
      body: JSON.stringify(testCase.input),
    });

    if (!response.ok) {
      throw new Error(`API call failed with status ${response.status}`);
    }

    return response.json();
  }

  private comparResults(
    mockResult: TOutput | null,
    realResult: TOutput | null
  ): string[] {
    const differences: string[] = [];

    if (!mockResult || !realResult) {
      if (mockResult !== realResult) {
        differences.push("One result is null while the other is not");
      }
      return differences;
    }

    // Deep comparison logic here
    // This would be implemented based on specific comparison needs

    return differences;
  }
}
```

## Type Assertion Patterns

### Custom Assertion Types

```typescript
/**
 * Type-safe assertion helpers
 */
export interface TypedAssertions {
  /** Assert that value matches expected type */
  expectType<T>(actual: unknown): asserts actual is T;
  /** Assert that value matches schema */
  expectValidSchema<T>(
    actual: unknown,
    schema: z.ZodSchema<T>
  ): asserts actual is T;
  /** Assert that array contains item of specific type */
  expectArrayContains<T>(array: unknown[], item: T): void;
  /** Assert that object has specific shape */
  expectObjectShape<T extends Record<string, unknown>>(
    actual: unknown,
    shape: { [K in keyof T]: (value: unknown) => value is T[K] }
  ): asserts actual is T;
}

/**
 * Implementation of typed assertions
 */
export const typedAssert: TypedAssertions = {
  expectType<T>(actual: unknown): asserts actual is T {
    // This is mainly for documentation and type narrowing
    // Runtime type checking would need additional logic
  },

  expectValidSchema<T>(
    actual: unknown,
    schema: z.ZodSchema<T>
  ): asserts actual is T {
    try {
      schema.parse(actual);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Schema validation failed: ${error.message}`);
      }
      throw error;
    }
  },

  expectArrayContains<T>(array: unknown[], item: T): void {
    expect(array).toContain(item);
  },

  expectObjectShape<T extends Record<string, unknown>>(
    actual: unknown,
    shape: { [K in keyof T]: (value: unknown) => value is T[K] }
  ): asserts actual is T {
    expect(actual).toBeTypeOf("object");
    expect(actual).not.toBeNull();

    const obj = actual as Record<string, unknown>;

    for (const [key, validator] of Object.entries(shape)) {
      if (!validator(obj[key])) {
        throw new Error(`Property ${key} failed type validation`);
      }
    }
  },
};

/**
 * Usage examples with complete type safety
 */
export function demonstrateTypedAssertions() {
  describe("Typed Assertions", () => {
    it("should validate user data with type safety", () => {
      const userData: unknown = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: "ADMIN",
      };

      // Type-safe schema validation
      typedAssert.expectValidSchema(userData, UserSchema);

      // After assertion, userData is typed as User
      expect(userData.email).toBe("test@example.com");
      expect(userData.role).toBe("ADMIN");
    });

    it("should validate array contents", () => {
      const users = createUsers(3);
      const specificUser = createUser({ email: "specific@example.com" });

      users.push(specificUser);

      typedAssert.expectArrayContains(users, specificUser);
    });

    it("should validate object shapes", () => {
      const apiResponse: unknown = {
        data: { id: "1", name: "Test" },
        status: 200,
        message: "Success",
      };

      typedAssert.expectObjectShape(apiResponse, {
        data: (value): value is Record<string, unknown> =>
          typeof value === "object" && value !== null,
        status: (value): value is number => typeof value === "number",
        message: (value): value is string => typeof value === "string",
      });

      // After assertion, apiResponse has the correct type
      expect(apiResponse.status).toBe(200);
    });
  });
}
```

## Performance Testing Types

### Type-Safe Performance Measurement

```typescript
/**
 * Performance measurement result
 */
export interface PerformanceResult<T> {
  readonly result: T;
  readonly duration: number;
  readonly memoryUsage?: {
    readonly before: number;
    readonly after: number;
    readonly delta: number;
  };
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  readonly iterations: number;
  readonly averageDuration: number;
  readonly minDuration: number;
  readonly maxDuration: number;
  readonly standardDeviation: number;
  readonly totalDuration: number;
}

/**
 * Type-safe performance tester
 */
export class TypedPerformanceTester {
  async measureExecution<T>(
    operation: () => Promise<T>,
    options: {
      readonly measureMemory?: boolean;
      readonly timeout?: number;
    } = {}
  ): Promise<PerformanceResult<T>> {
    const { measureMemory = false, timeout = 10000 } = options;

    const memoryBefore = measureMemory ? this.getMemoryUsage() : undefined;
    const startTime = performance.now();

    const result = await Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Operation timeout")), timeout)
      ),
    ]);

    const duration = performance.now() - startTime;
    const memoryAfter = measureMemory ? this.getMemoryUsage() : undefined;

    const memoryUsage =
      memoryBefore && memoryAfter
        ? {
            before: memoryBefore,
            after: memoryAfter,
            delta: memoryAfter - memoryBefore,
          }
        : undefined;

    return {
      result,
      duration,
      memoryUsage,
    };
  }

  async benchmark<T>(
    operation: () => Promise<T>,
    iterations: number,
    options: {
      readonly warmupIterations?: number;
      readonly measureMemory?: boolean;
    } = {}
  ): Promise<BenchmarkResult> {
    const { warmupIterations = Math.min(5, Math.floor(iterations * 0.1)) } =
      options;

    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await operation();
    }

    // Benchmark
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { duration } = await this.measureExecution(operation, options);
      durations.push(duration);
    }

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / iterations;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    const variance =
      durations.reduce((sum, d) => sum + Math.pow(d - averageDuration, 2), 0) /
      iterations;
    const standardDeviation = Math.sqrt(variance);

    return {
      iterations,
      averageDuration,
      minDuration,
      maxDuration,
      standardDeviation,
      totalDuration,
    };
  }

  private getMemoryUsage(): number {
    if (typeof window !== "undefined" && "memory" in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }
}

/**
 * Usage with complete type safety
 */
export function demonstratePerformanceTesting() {
  const performanceTester = new TypedPerformanceTester();

  describe("Performance Testing", () => {
    it("should measure component render performance", async () => {
      const { result, duration } = await performanceTester.measureExecution(
        async () => {
          return renderComponent(ComplexComponent, {
            props: { data: createLargeDataset(1000) },
          });
        },
        { measureMemory: true }
      );

      expect(duration).toBeLessThan(100); // Should render in under 100ms
      expect(result.getByTestId("complex-component")).toBeInTheDocument();
    });

    it("should benchmark data processing", async () => {
      const benchmarkResult = await performanceTester.benchmark(
        async () => {
          const bookings = createBookings(1000);
          return processBookingData(bookings);
        },
        10,
        { warmupIterations: 2 }
      );

      expect(benchmarkResult.averageDuration).toBeLessThan(50);
      expect(benchmarkResult.standardDeviation).toBeLessThan(10);
    });
  });
}
```

This comprehensive type safety specification ensures that all testing
infrastructure maintains strict TypeScript compliance while providing powerful,
reusable patterns for testing complex React applications.
