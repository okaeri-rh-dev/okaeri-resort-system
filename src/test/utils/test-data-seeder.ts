/**
 * Test Data Seeder
 * Idempotent seeding strategy for unit/integration/e2e tests
 * Ensures consistent and deterministic test data across all test levels
 */

import { faker } from "@faker-js/faker";
import { testDataFactory, resetAllFactoryCounters } from "../factories";
import type { BookingInput, ExpenseInput, PaymentInput, UserInput } from "@/types/schemas";

export interface SeedingOptions {
  level: "unit" | "integration" | "e2e";
  scenario: "minimal" | "standard" | "comprehensive" | "stress";
  deterministic: boolean;
  seed?: string;
  clearExisting?: boolean;
}

export interface SeededData {
  users: UserInput[];
  bookings: BookingInput[];
  expenses: ExpenseInput[];
  payments: PaymentInput[];
  categories: Array<{ id: string; name: string; slug: string }>;
  metadata: {
    seedId: string;
    timestamp: string;
    options: SeedingOptions;
    counts: {
      users: number;
      bookings: number;
      expenses: number;
      payments: number;
    };
  };
}

export class TestDataSeeder {
  private seedCache = new Map<string, SeededData>();
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.initialized) return;

    // Set up faker for consistent seeding
    faker.seed(12345);
    this.initialized = true;
  }

  /**
   * Main seeding method - idempotent and deterministic
   */
  async seed(options: SeedingOptions): Promise<SeededData> {
    const cacheKey = this.generateCacheKey(options);

    // Return cached data if available and deterministic mode is enabled
    if (options.deterministic && this.seedCache.has(cacheKey)) {
      return this.seedCache.get(cacheKey)!;
    }

    // Clear existing data if requested
    if (options.clearExisting) {
      await this.clearTestData();
    }

    // Reset factory counters for deterministic generation
    if (options.deterministic) {
      resetAllFactoryCounters();
      if (options.seed) {
        faker.seed(this.stringToSeed(options.seed));
      }
    }

    // Generate data based on level and scenario
    const seededData = await this.generateSeededData(options);

    // Cache the result for future use
    if (options.deterministic) {
      this.seedCache.set(cacheKey, seededData);
    }

    return seededData;
  }

  /**
   * Generate seeded data based on configuration
   */
  private async generateSeededData(options: SeedingOptions): Promise<SeededData> {
    const { level, scenario, seed } = options;
    const baseSeed = seed || `${level}-${scenario}`;

    // Determine data counts based on level and scenario
    const counts = this.getDataCounts(level, scenario);

    // Import factories
    const { createUsers, createAdminUser, createManagerUser } = await import(
      "../factories/user.factory"
    );
    const { createBookings, createExpenseCategories } = await import(
      "../factories/booking.factory"
    );
    const { createExpenses } = await import("../factories/expense.factory");
    const { createPaymentsForBooking } = await import("../factories/payment.factory");

    // Create users
    const admin = createAdminUser({ seed: `${baseSeed}-admin` });
    const manager = createManagerUser({ seed: `${baseSeed}-manager` });
    const staff = createUsers(counts.users, { seed: `${baseSeed}-staff` });
    const users = [admin, manager, ...staff];

    // Create categories
    const categories = createExpenseCategories();

    // Create bookings
    const bookings = createBookings(counts.bookings, { seed: `${baseSeed}-bookings` });

    // Create expenses
    const expenses = createExpenses(counts.expenses, { seed: `${baseSeed}-expenses` });

    // Create payments for bookings (70% of bookings get payments)
    const paymentsPerBooking = Math.ceil(counts.bookings * 0.7);
    const payments: PaymentInput[] = [];

    for (let i = 0; i < paymentsPerBooking; i++) {
      const booking = bookings[i];
      if (booking) {
        const totalAmount = parseFloat(booking.totalAmount);
        const paymentPlan = i % 3 === 0 ? "full" : i % 3 === 1 ? "deposit" : "installments";
        const bookingPayments = createPaymentsForBooking(booking.id, totalAmount, paymentPlan, {
          seed: `${baseSeed}-payment-${booking.id}`,
        });
        payments.push(...bookingPayments);
      }
    }

    const seededData: SeededData = {
      users,
      bookings,
      expenses,
      payments,
      categories,
      metadata: {
        seedId: this.generateSeedId(options),
        timestamp: new Date().toISOString(),
        options,
        counts: {
          users: users.length,
          bookings: bookings.length,
          expenses: expenses.length,
          payments: payments.length,
        },
      },
    };

    return seededData;
  }

  /**
   * Determine data counts based on test level and scenario
   */
  private getDataCounts(
    level: string,
    scenario: string
  ): {
    users: number;
    bookings: number;
    expenses: number;
  } {
    const baseConfig = {
      unit: {
        minimal: { users: 1, bookings: 1, expenses: 1 },
        standard: { users: 2, bookings: 3, expenses: 5 },
        comprehensive: { users: 3, bookings: 5, expenses: 8 },
        stress: { users: 5, bookings: 10, expenses: 15 },
      },
      integration: {
        minimal: { users: 2, bookings: 5, expenses: 8 },
        standard: { users: 5, bookings: 15, expenses: 25 },
        comprehensive: { users: 8, bookings: 30, expenses: 50 },
        stress: { users: 15, bookings: 100, expenses: 200 },
      },
      e2e: {
        minimal: { users: 5, bookings: 10, expenses: 15 },
        standard: { users: 10, bookings: 50, expenses: 80 },
        comprehensive: { users: 20, bookings: 100, expenses: 150 },
        stress: { users: 50, bookings: 500, expenses: 1000 },
      },
    };

    return (
      baseConfig[level as keyof typeof baseConfig]?.[scenario as keyof typeof baseConfig.unit] || {
        users: 2,
        bookings: 5,
        expenses: 8,
      }
    );
  }

  /**
   * Quick seed methods for common scenarios
   */
  async seedMinimalData(): Promise<SeededData> {
    return this.seed({
      level: "unit",
      scenario: "minimal",
      deterministic: true,
      seed: "minimal-stable",
    });
  }

  async seedStandardData(): Promise<SeededData> {
    return this.seed({
      level: "integration",
      scenario: "standard",
      deterministic: true,
      seed: "standard-stable",
    });
  }

  async seedComprehensiveData(): Promise<SeededData> {
    return this.seed({
      level: "e2e",
      scenario: "comprehensive",
      deterministic: true,
      seed: "comprehensive-stable",
    });
  }

  async seedStableData(): Promise<SeededData> {
    return this.seed({
      level: "unit",
      scenario: "minimal",
      deterministic: true,
      seed: "stable-zero-errors",
    });
  }

  async seedRealisticData(): Promise<SeededData> {
    return this.seed({
      level: "e2e",
      scenario: "standard",
      deterministic: true,
      seed: "realistic-test-data",
    });
  }

  async seedStressData(): Promise<SeededData> {
    return this.seed({
      level: "e2e",
      scenario: "stress",
      deterministic: true,
      seed: "stress-test-data",
      clearExisting: true,
    });
  }

  /**
   * Seed specific financial scenarios for testing
   */
  async seedFinancialScenario(months: number = 3): Promise<SeededData & { financialSummary: any }> {
    const baseData = await this.seed({
      level: "integration",
      scenario: "standard",
      deterministic: true,
      seed: `financial-${months}m`,
    });

    // Generate financial summary
    const financialData = await testDataFactory.createFinancialScenario(months);

    return {
      ...baseData,
      expenses: [...baseData.expenses, ...financialData.expenses],
      payments: [...baseData.payments, ...financialData.payments],
      financialSummary: financialData.monthlyTotals,
    };
  }

  /**
   * Seed error scenarios for error handling tests
   */
  async seedErrorScenarios(): Promise<SeededData & { errorData: any }> {
    const baseData = await this.seed({
      level: "unit",
      scenario: "minimal",
      deterministic: true,
      seed: "error-scenarios",
    });

    const errorData = await testDataFactory.createErrorScenarios();

    return {
      ...baseData,
      errorData,
    };
  }

  /**
   * Clear all test data
   */
  async clearTestData(): Promise<void> {
    // Clear localStorage if in browser environment
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }

    // Clear sessionStorage if in browser environment
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.clear();
    }

    // Clear cache
    this.seedCache.clear();

    // Reset factory counters
    resetAllFactoryCounters();
  }

  /**
   * Reset seeder to initial state
   */
  async reset(): Promise<void> {
    await this.clearTestData();
    faker.seed(12345); // Reset to default seed
    this.initialized = false;
    this.initialize();
  }

  /**
   * Get seeded data from cache
   */
  getCachedData(options: SeedingOptions): SeededData | null {
    const cacheKey = this.generateCacheKey(options);
    return this.seedCache.get(cacheKey) || null;
  }

  /**
   * Check if data exists in cache
   */
  hasCachedData(options: SeedingOptions): boolean {
    const cacheKey = this.generateCacheKey(options);
    return this.seedCache.has(cacheKey);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    totalDataPoints: number;
  } {
    const keys = Array.from(this.seedCache.keys());
    const totalDataPoints = Array.from(this.seedCache.values()).reduce((total, data) => {
      return (
        total +
        data.users.length +
        data.bookings.length +
        data.expenses.length +
        data.payments.length
      );
    }, 0);

    return {
      size: this.seedCache.size,
      keys,
      totalDataPoints,
    };
  }

  /**
   * Generate cache key from options
   */
  private generateCacheKey(options: SeedingOptions): string {
    return `${options.level}-${options.scenario}-${options.seed || "default"}-${options.deterministic}`;
  }

  /**
   * Generate unique seed ID
   */
  private generateSeedId(options: SeedingOptions): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${options.level}-${options.scenario}-${timestamp}-${random}`;
  }

  /**
   * Convert string to numeric seed
   */
  private stringToSeed(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Seeding strategies for different test types
 */
export const seedingStrategies = {
  /**
   * Unit test seeding - minimal, fast, deterministic
   */
  unit: {
    options: {
      level: "unit" as const,
      scenario: "minimal" as const,
      deterministic: true,
      seed: "unit-test-seed",
    },
  },

  /**
   * Integration test seeding - moderate data, realistic scenarios
   */
  integration: {
    options: {
      level: "integration" as const,
      scenario: "standard" as const,
      deterministic: true,
      seed: "integration-test-seed",
    },
  },

  /**
   * E2E test seeding - comprehensive data, realistic volumes
   */
  e2e: {
    options: {
      level: "e2e" as const,
      scenario: "comprehensive" as const,
      deterministic: true,
      seed: "e2e-test-seed",
    },
  },

  /**
   * Performance test seeding - large datasets
   */
  performance: {
    options: {
      level: "e2e" as const,
      scenario: "stress" as const,
      deterministic: true,
      seed: "performance-test-seed",
      clearExisting: true,
    },
  },
};

/**
 * Default seeder instance
 */
export const testDataSeeder = new TestDataSeeder();

/**
 * Convenience functions for common seeding patterns
 */
export const seedTestData = {
  /**
   * Seed for unit tests
   */
  async forUnitTests(): Promise<SeededData> {
    return testDataSeeder.seed(seedingStrategies.unit.options);
  },

  /**
   * Seed for integration tests
   */
  async forIntegrationTests(): Promise<SeededData> {
    return testDataSeeder.seed(seedingStrategies.integration.options);
  },

  /**
   * Seed for E2E tests
   */
  async forE2ETests(): Promise<SeededData> {
    return testDataSeeder.seed(seedingStrategies.e2e.options);
  },

  /**
   * Seed for performance tests
   */
  async forPerformanceTests(): Promise<SeededData> {
    return testDataSeeder.seed(seedingStrategies.performance.options);
  },

  /**
   * Custom seeding with options
   */
  async custom(options: Partial<SeedingOptions>): Promise<SeededData> {
    const defaultOptions: SeedingOptions = {
      level: "integration",
      scenario: "standard",
      deterministic: true,
      seed: "custom-seed",
    };

    return testDataSeeder.seed({ ...defaultOptions, ...options });
  },
};
