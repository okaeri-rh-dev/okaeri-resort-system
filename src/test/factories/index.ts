/**
 * Test Data Factory Index
 * Central export point for all test factories with type-safe data generation
 */

// Re-export all factories
export * from "./user.factory";
export * from "./booking.factory";
export * from "./expense.factory";
export * from "./payment.factory";

// Re-export factory types for convenience
export type { UserFactoryOptions, AuthenticatedUser } from "./user.factory";

export type { BookingFactoryOptions } from "./booking.factory";

export type { ExpenseFactoryOptions } from "./expense.factory";

export type { PaymentFactoryOptions } from "./payment.factory";

/**
 * Factory reset utilities - call before test suites to ensure deterministic data
 */
import { resetUserIdCounter } from "./user.factory";
import { resetBookingIdCounter } from "./booking.factory";
import { resetExpenseIdCounter } from "./expense.factory";
import { resetPaymentIdCounter } from "./payment.factory";

/**
 * Reset all factory counters for consistent test data generation
 */
export function resetAllFactoryCounters(): void {
  resetUserIdCounter();
  resetBookingIdCounter();
  resetExpenseIdCounter();
  resetPaymentIdCounter();
}

/**
 * Comprehensive test data factory class
 * Provides orchestrated data creation for complex test scenarios
 */
export class TestDataFactory {
  private seed: string;

  constructor(seed: string = "test-factory") {
    this.seed = seed;
  }

  /**
   * Create a complete resort scenario with related data
   */
  async createResortScenario(): Promise<{
    users: any[];
    bookings: any[];
    expenses: any[];
    payments: any[];
  }> {
    // Import factories dynamically to avoid circular dependencies
    const { createUsers, createAdminUser, createManagerUser } = await import("./user.factory");
    const { createBookings } = await import("./booking.factory");
    const { createExpenses } = await import("./expense.factory");
    const { createPaymentsForBooking } = await import("./payment.factory");

    // Create users
    const admin = createAdminUser({ seed: `${this.seed}-admin` });
    const manager = createManagerUser({ seed: `${this.seed}-manager` });
    const staff = createUsers(3, { seed: `${this.seed}-staff` });
    const users = [admin, manager, ...staff];

    // Create bookings
    const bookings = createBookings(10, { seed: `${this.seed}-bookings` });

    // Create expenses
    const expenses = createExpenses(15, { seed: `${this.seed}-expenses` });

    // Create payments for bookings
    const payments = bookings.flatMap((booking, index) => {
      const totalAmount = parseFloat(booking.totalAmount);
      const paymentPlan = index % 3 === 0 ? "full" : index % 3 === 1 ? "deposit" : "installments";
      return createPaymentsForBooking(booking.id, totalAmount, paymentPlan, {
        seed: `${this.seed}-payment-${booking.id}`,
      });
    });

    return { users, bookings, expenses, payments };
  }

  /**
   * Create minimal test data for fast unit tests
   */
  async createMinimalData(): Promise<{
    user: any;
    booking: any;
    expense: any;
    payment: any;
  }> {
    const { createUser } = await import("./user.factory");
    const { createBooking } = await import("./booking.factory");
    const { createExpense } = await import("./expense.factory");
    const { createPayment } = await import("./payment.factory");

    return {
      user: createUser({ seed: `${this.seed}-user` }),
      booking: createBooking({ seed: `${this.seed}-booking` }),
      expense: createExpense({ seed: `${this.seed}-expense` }),
      payment: createPayment({ seed: `${this.seed}-payment` }),
    };
  }

  /**
   * Create financial scenario data for testing reports and analytics
   */
  async createFinancialScenario(months: number = 3): Promise<{
    expenses: any[];
    payments: any[];
    monthlyTotals: Array<{ month: string; expenses: number; payments: number; profit: number }>;
  }> {
    const { createMonthlyExpenses, calculateTotalExpenses } = await import("./expense.factory");
    const { createPaymentsInRange, calculateTotalPayments } = await import("./payment.factory");

    const expenses: any[] = [];
    const payments: any[] = [];
    const monthlyTotals: Array<{
      month: string;
      expenses: number;
      payments: number;
      profit: number;
    }> = [];

    const currentDate = new Date();

    for (let i = 0; i < months; i++) {
      const month = currentDate.getMonth() - i;
      const year = month < 0 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();
      const adjustedMonth = month < 0 ? month + 12 : month;

      // Create monthly expenses
      const monthlyExpenses = createMonthlyExpenses(year, adjustedMonth + 1, 20, {
        seed: `${this.seed}-expense-${year}-${adjustedMonth}`,
      });

      // Create date range for payments
      const startDate = new Date(year, adjustedMonth, 1).toISOString().split("T")[0];
      const endDate = new Date(year, adjustedMonth + 1, 0).toISOString().split("T")[0];
      const monthlyPayments = createPaymentsInRange(startDate, endDate, 15, {
        seed: `${this.seed}-payment-${year}-${adjustedMonth}`,
      });

      expenses.push(...monthlyExpenses);
      payments.push(...monthlyPayments);

      // Calculate totals
      const expenseTotal = calculateTotalExpenses(monthlyExpenses);
      const paymentTotal = calculateTotalPayments(monthlyPayments);

      monthlyTotals.push({
        month: `${year}-${String(adjustedMonth + 1).padStart(2, "0")}`,
        expenses: expenseTotal,
        payments: paymentTotal,
        profit: paymentTotal - expenseTotal,
      });
    }

    return { expenses, payments, monthlyTotals };
  }

  /**
   * Create error scenario data for testing error handling
   */
  async createErrorScenarios(): Promise<{
    invalidBooking: any;
    invalidExpense: any;
    invalidPayment: any;
    conflictingBookings: any[];
  }> {
    const { createBooking, createBookings } = await import("./booking.factory");
    const { createExpense } = await import("./expense.factory");
    const { createPayment } = await import("./payment.factory");

    // Create invalid data that should fail validation
    const baseBooking = createBooking({ seed: `${this.seed}-error` });
    const baseExpense = createExpense({ seed: `${this.seed}-error` });
    const basePayment = createPayment({ seed: `${this.seed}-error` });

    // Invalid booking (check-out before check-in)
    const invalidBooking = {
      ...baseBooking,
      checkInDate: "2024-12-25",
      checkOutDate: "2024-12-20", // Invalid: check-out before check-in
    };

    // Invalid expense (negative amount)
    const invalidExpense = {
      ...baseExpense,
      amount: "-1000.00", // Invalid: negative amount
    };

    // Invalid payment (missing required GCash fields)
    const invalidPayment = {
      ...basePayment,
      paymentMethod: "gcash",
      gcashReferenceNumber: null, // Invalid: missing required field
      gcashAccountNumber: null,
    };

    // Conflicting bookings (same property, overlapping dates)
    const conflictingBookings = [
      createBooking({
        checkInDate: "2024-12-20",
        checkOutDate: "2024-12-25",
        roomNumber: "V1",
        seed: `${this.seed}-conflict-1`,
      }),
      createBooking({
        checkInDate: "2024-12-23",
        checkOutDate: "2024-12-28",
        roomNumber: "V1", // Same room, overlapping dates
        seed: `${this.seed}-conflict-2`,
      }),
    ];

    return {
      invalidBooking,
      invalidExpense,
      invalidPayment,
      conflictingBookings,
    };
  }

  /**
   * Set seed for deterministic data generation
   */
  setSeed(seed: string): void {
    this.seed = seed;
  }

  /**
   * Get current seed
   */
  getSeed(): string {
    return this.seed;
  }
}

/**
 * Default factory instance for convenient usage
 */
export const testDataFactory = new TestDataFactory();

/**
 * Quick access functions for common test data creation patterns
 */
export const quickCreate = {
  /**
   * Create authenticated user with token
   */
  async authenticatedUser(overrides?: any) {
    const { createAuthenticatedUser } = await import("./user.factory");
    return createAuthenticatedUser(overrides);
  },

  /**
   * Create confirmed booking with payment
   */
  async confirmedBooking(overrides?: any) {
    const { bookingScenarios } = await import("./booking.factory");
    return bookingScenarios.confirmedPaid(overrides);
  },

  /**
   * Create monthly expense report data
   */
  async monthlyExpenses(year: number, month: number, count: number = 10) {
    const { createMonthlyExpenses } = await import("./expense.factory");
    return createMonthlyExpenses(year, month, count);
  },

  /**
   * Create GCash payment
   */
  async gcashPayment(overrides?: any) {
    const { paymentScenarios } = await import("./payment.factory");
    return paymentScenarios.gcashPayment(overrides);
  },
};

/**
 * Type-safe data validation helpers
 */
export const validateTestData = {
  /**
   * Validate that generated data matches Zod schemas
   */
  async validateBooking(booking: any): Promise<boolean> {
    try {
      const { BookingSchema } = await import("@/types/schemas");
      BookingSchema.parse(booking);
      return true;
    } catch {
      return false;
    }
  },

  async validateExpense(expense: any): Promise<boolean> {
    try {
      const { ExpenseSchema } = await import("@/types/schemas");
      ExpenseSchema.parse(expense);
      return true;
    } catch {
      return false;
    }
  },

  async validatePayment(payment: any): Promise<boolean> {
    try {
      const { PaymentSchema } = await import("@/types/schemas");
      PaymentSchema.parse(payment);
      return true;
    } catch {
      return false;
    }
  },
};
