/**
 * TDD-Specific Test Utilities for Okaeri Resort Management System
 *
 * This module provides comprehensive test utilities specifically designed for
 * Test-Driven Development (TDD) workflows, including:
 * - Test data builders for domain entities
 * - Custom matchers for resort-specific validations
 * - Quick setup functions for common test scenarios
 * - Philippine-specific test data generators
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @since Phase 1.7 - TDD Integration
 */

import { faker } from "@faker-js/faker";
import { expect } from "vitest";
import type {
  Booking,
  Payment,
  Expense,
  User,
  CreateBookingInput,
  CreatePaymentInput,
  CreateExpenseInput,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  ExpenseStatus,
  PhpAmount,
  EntityId,
} from "@/types/database";
import {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  EXPENSE_STATUS,
  PHILIPPINE_CONSTANTS,
} from "@/types/database";

// ====================================
// PHILIPPINE-SPECIFIC TEST DATA GENERATORS
// ====================================

/**
 * Generates valid Philippine mobile phone numbers
 * Supports various formats: +63, 0, and 63 prefixes
 */
export const PhilippineDataGenerator = {
  /**
   * Generate a valid Philippine mobile number
   * @param format - The format to generate ('international' | 'local' | 'raw')
   * @returns A valid Philippine mobile number
   */
  mobileNumber: (format: "international" | "local" | "raw" = "international"): string => {
    const networks = [
      "917",
      "918",
      "919",
      "920",
      "928",
      "929",
      "939",
      "946",
      "947",
      "948",
      "949",
      "950",
    ];
    const network = faker.helpers.arrayElement(networks);
    const number = faker.string.numeric(7);

    switch (format) {
      case "international":
        return `+63${network}${number}`;
      case "local":
        return `0${network}${number}`;
      case "raw":
        return `63${network}${number}`;
      default:
        return `+63${network}${number}`;
    }
  },

  /**
   * Generate a valid Philippine landline number
   * @param area - Specific area code (optional)
   */
  landlineNumber: (area?: string): string => {
    const areaCodes = [
      "02",
      "032",
      "033",
      "034",
      "035",
      "036",
      "038",
      "042",
      "043",
      "044",
      "045",
      "046",
      "047",
      "048",
      "049",
      "053",
      "054",
      "055",
      "056",
      "062",
      "063",
      "064",
      "065",
      "068",
      "072",
      "074",
      "075",
      "077",
      "078",
      "082",
      "083",
      "084",
      "085",
      "086",
      "087",
      "088",
    ];
    const areaCode = area || faker.helpers.arrayElement(areaCodes);
    const number = faker.string.numeric(7);
    return `+63${areaCode}${number}`;
  },

  /**
   * Generate a Philippine address
   */
  address: (): string => {
    const provinces = [
      "Batangas",
      "Boracay",
      "Bohol",
      "Palawan",
      "Cebu",
      "Davao",
      "Ilocos Norte",
      "Zambales",
      "Bataan",
      "La Union",
      "Pangasinan",
    ];
    const cities = [
      "Manila",
      "Cebu City",
      "Davao City",
      "Quezon City",
      "Makati",
      "Taguig",
      "Iloilo City",
      "Bacolod",
      "Cagayan de Oro",
      "Puerto Princesa",
    ];

    const streetNumber = faker.number.int({ min: 1, max: 999 });
    const streetName = faker.location.street();
    const city = faker.helpers.arrayElement(cities);
    const province = faker.helpers.arrayElement(provinces);
    const zipCode = faker.string.numeric(4);

    return `${streetNumber} ${streetName}, ${city}, ${province} ${zipCode}`;
  },

  /**
   * Generate a Filipino name with proper formatting
   */
  fullName: (): string => {
    const firstNames = [
      "Juan",
      "Maria",
      "Jose",
      "Ana",
      "Antonio",
      "Carmen",
      "Francisco",
      "Luz",
      "Pedro",
      "Rosario",
      "Manuel",
      "Elena",
      "Ricardo",
      "Sofia",
      "Miguel",
      "Isabel",
      "Carlos",
      "Teresa",
      "Luis",
      "Rosa",
      "Angel",
      "Patricia",
      "Roberto",
      "Dolores",
    ];
    const lastNames = [
      "Dela Cruz",
      "Santos",
      "Reyes",
      "Garcia",
      "Gonzales",
      "Rodriguez",
      "Hernandez",
      "Martinez",
      "Lopez",
      "Perez",
      "Ramos",
      "Flores",
      "Rivera",
      "Mendoza",
      "Torres",
      "Aquino",
      "Villanueva",
      "Castro",
    ];

    const firstName = faker.helpers.arrayElement(firstNames);
    const lastName = faker.helpers.arrayElement(lastNames);
    const suffix = faker.datatype.boolean(0.1)
      ? faker.helpers.arrayElement(["Jr.", "Sr.", "II", "III"])
      : "";

    return `${firstName} ${lastName}${suffix ? ` ${suffix}` : ""}`;
  },

  /**
   * Generate a Philippine peso amount as string
   * @param min - Minimum amount
   * @param max - Maximum amount
   * @returns Amount formatted as PHP decimal string
   */
  phpAmount: (min: number = 0, max: number = 100000): PhpAmount => {
    const amount = faker.number.float({ min, max, fractionDigits: 2 });
    return amount.toFixed(2);
  },

  /**
   * Generate a BIR (Bureau of Internal Revenue) TIN
   */
  tin: (): string => {
    return `${faker.string.numeric(9)}-${faker.string.numeric(3)}`;
  },

  /**
   * Generate a resort/property name
   */
  resortName: (): string => {
    const prefixes = [
      "Paradise",
      "Tropical",
      "Sunset",
      "Ocean",
      "Island",
      "Beach",
      "Bay",
      "Crystal",
      "Golden",
      "Azure",
    ];
    const types = [
      "Resort",
      "Beach Resort",
      "Island Resort",
      "Villa",
      "Bay Resort",
      "Retreat",
      "Lodge",
      "Paradise",
    ];
    const locations = [
      "Boracay",
      "Palawan",
      "Bohol",
      "Batangas",
      "La Union",
      "Siargao",
      "Camiguin",
    ];

    const prefix = faker.helpers.arrayElement(prefixes);
    const type = faker.helpers.arrayElement(types);
    const location = faker.datatype.boolean(0.3)
      ? ` - ${faker.helpers.arrayElement(locations)}`
      : "";

    return `${prefix} ${type}${location}`;
  },

  /**
   * Generate tax calculations for Philippine context
   */
  taxCalculation: (baseAmount: number) => {
    const vatRate = 0.12; // 12% VAT in Philippines
    const vatAmount = baseAmount * vatRate;
    const totalAmount = baseAmount + vatAmount;

    return {
      baseAmount: baseAmount.toFixed(2),
      vatRate: "12.00",
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    };
  },
};

// ====================================
// TEST DATA BUILDERS
// ====================================

/**
 * Builder pattern for creating test booking data
 * Follows the Builder pattern for flexible test data creation
 */
export class BookingTestBuilder {
  private booking: Partial<CreateBookingInput> = {};

  static create(): BookingTestBuilder {
    return new BookingTestBuilder();
  }

  withDefaults(): BookingTestBuilder {
    this.booking = {
      guestName: PhilippineDataGenerator.fullName(),
      guestEmail: faker.internet.email().toLowerCase(),
      guestPhone: PhilippineDataGenerator.mobileNumber(),
      guestAddress: PhilippineDataGenerator.address(),
      checkIn: faker.date.future({ days: 30 }).toISOString(),
      checkOut: faker.date.future({ days: 35 }).toISOString(),
      guests: faker.number.int({ min: 1, max: 8 }),
      totalAmount: parseFloat(PhilippineDataGenerator.phpAmount(5000, 50000)),
      depositAmount: parseFloat(PhilippineDataGenerator.phpAmount(1000, 10000)),
      status: BOOKING_STATUS.CONFIRMED,
      specialRequests: faker.lorem.sentence(),
      notes: faker.lorem.paragraph(),
      createdBy: faker.string.uuid(),
      propertyId: faker.string.uuid(),
    };
    return this;
  }

  withGuestName(name: string): BookingTestBuilder {
    this.booking.guestName = name;
    return this;
  }

  withEmail(email: string): BookingTestBuilder {
    this.booking.guestEmail = email;
    return this;
  }

  withPhone(phone: string): BookingTestBuilder {
    this.booking.guestPhone = phone;
    return this;
  }

  withDates(checkIn: string, checkOut: string): BookingTestBuilder {
    this.booking.checkIn = checkIn;
    this.booking.checkOut = checkOut;
    return this;
  }

  withGuests(count: number): BookingTestBuilder {
    this.booking.guests = count;
    return this;
  }

  withAmount(total: PhpAmount, deposit?: PhpAmount): BookingTestBuilder {
    this.booking.totalAmount = parseFloat(total);
    if (deposit) {
      this.booking.depositAmount = parseFloat(deposit);
    }
    return this;
  }

  withStatus(status: BookingStatus): BookingTestBuilder {
    this.booking.status = status;
    return this;
  }

  withSpecialRequests(requests: string): BookingTestBuilder {
    this.booking.specialRequests = requests;
    return this;
  }

  withCreatedBy(userId: EntityId): BookingTestBuilder {
    this.booking.createdBy = userId;
    return this;
  }

  build(): CreateBookingInput {
    if (!this.booking.guestName) {
      this.withDefaults();
    }
    return this.booking as CreateBookingInput;
  }

  /**
   * Build multiple bookings with variations
   */
  buildMany(count: number): CreateBookingInput[] {
    return Array.from({ length: count }, () => new BookingTestBuilder().withDefaults().build());
  }
}

/**
 * Builder pattern for creating test payment data
 */
export class PaymentTestBuilder {
  private payment: Partial<CreatePaymentInput> = {};

  static create(): PaymentTestBuilder {
    return new PaymentTestBuilder();
  }

  withDefaults(): PaymentTestBuilder {
    this.payment = {
      bookingId: faker.string.uuid(),
      amount: PhilippineDataGenerator.phpAmount(1000, 25000),
      method: faker.helpers.arrayElement(Object.values(PAYMENT_METHODS)),
      status: PAYMENT_STATUS.COMPLETED,
      referenceNumber: faker.string.alphanumeric(12).toUpperCase(),
      paidBy: PhilippineDataGenerator.fullName(),
      notes: faker.lorem.sentence(),
      paymentDate: faker.date.recent({ days: 7 }).toISOString(),
      recordedBy: faker.string.uuid(),
    };
    return this;
  }

  withBookingId(bookingId: EntityId): PaymentTestBuilder {
    this.payment.bookingId = bookingId;
    return this;
  }

  withAmount(amount: PhpAmount): PaymentTestBuilder {
    this.payment.amount = amount;
    return this;
  }

  withMethod(method: PaymentMethod): PaymentTestBuilder {
    this.payment.method = method;
    return this;
  }

  withStatus(status: PaymentStatus): PaymentTestBuilder {
    this.payment.status = status;
    return this;
  }

  withReference(reference: string): PaymentTestBuilder {
    this.payment.referenceNumber = reference;
    return this;
  }

  withGCashDetails(): PaymentTestBuilder {
    this.payment.method = PAYMENT_METHODS.GCASH;
    this.payment.referenceNumber = `GC${faker.string.numeric(12)}`;
    this.payment.notes = `GCash payment from ${PhilippineDataGenerator.mobileNumber()}`;
    return this;
  }

  withBankTransferDetails(): PaymentTestBuilder {
    this.payment.method = PAYMENT_METHODS.BANK_TRANSFER;
    this.payment.referenceNumber = `BT${faker.string.numeric(10)}`;
    this.payment.notes = `Bank transfer - ${faker.helpers.arrayElement(["BPI", "BDO", "Metrobank", "Security Bank"])}`;
    return this;
  }

  withRecordedBy(userId: EntityId): PaymentTestBuilder {
    this.payment.recordedBy = userId;
    return this;
  }

  build(): CreatePaymentInput {
    if (!this.payment.bookingId) {
      this.withDefaults();
    }
    return this.payment as CreatePaymentInput;
  }

  buildMany(count: number): CreatePaymentInput[] {
    return Array.from({ length: count }, () => new PaymentTestBuilder().withDefaults().build());
  }
}

/**
 * Builder pattern for creating test expense data
 */
export class ExpenseTestBuilder {
  private expense: Partial<CreateExpenseInput> = {};

  static create(): ExpenseTestBuilder {
    return new ExpenseTestBuilder();
  }

  withDefaults(): ExpenseTestBuilder {
    const categories = [
      "Utilities",
      "Maintenance",
      "Food & Beverage",
      "Marketing",
      "Staff",
      "Supplies",
      "Repairs",
    ];
    this.expense = {
      categoryId: faker.string.uuid(),
      description: faker.lorem.sentence(),
      amount: PhilippineDataGenerator.phpAmount(500, 15000),
      expenseDate: faker.date.recent({ days: 30 }).toISOString(),
      vendor: faker.company.name(),
      receiptNumber: faker.string.alphanumeric(8).toUpperCase(),
      status: EXPENSE_STATUS.APPROVED,
      notes: faker.lorem.paragraph(),
      createdBy: faker.string.uuid(),
    };
    return this;
  }

  withCategory(categoryId: EntityId): ExpenseTestBuilder {
    this.expense.categoryId = categoryId;
    return this;
  }

  withDescription(description: string): ExpenseTestBuilder {
    this.expense.description = description;
    return this;
  }

  withAmount(amount: PhpAmount): ExpenseTestBuilder {
    this.expense.amount = amount;
    return this;
  }

  withVendor(vendor: string): ExpenseTestBuilder {
    this.expense.vendor = vendor;
    return this;
  }

  withReceipt(receiptNumber: string): ExpenseTestBuilder {
    this.expense.receiptNumber = receiptNumber;
    return this;
  }

  withStatus(status: ExpenseStatus): ExpenseTestBuilder {
    this.expense.status = status;
    return this;
  }

  withUtilityExpense(): ExpenseTestBuilder {
    const utilities = ["Electricity", "Water", "Internet", "Gas"];
    const utility = faker.helpers.arrayElement(utilities);
    this.expense.description = `${utility} bill - ${faker.date.recent({ days: 7 }).toLocaleDateString()}`;
    this.expense.vendor = `${utility} Company`;
    this.expense.amount = PhilippineDataGenerator.phpAmount(2000, 15000);
    return this;
  }

  withMaintenanceExpense(): ExpenseTestBuilder {
    const maintenance = ["Pool cleaning", "Room maintenance", "Garden upkeep", "Equipment repair"];
    this.expense.description = faker.helpers.arrayElement(maintenance);
    this.expense.vendor = "Maintenance Services Inc.";
    this.expense.amount = PhilippineDataGenerator.phpAmount(1000, 10000);
    return this;
  }

  withCreatedBy(userId: EntityId): ExpenseTestBuilder {
    this.expense.createdBy = userId;
    return this;
  }

  build(): CreateExpenseInput {
    if (!this.expense.categoryId) {
      this.withDefaults();
    }
    return this.expense as CreateExpenseInput;
  }

  buildMany(count: number): CreateExpenseInput[] {
    return Array.from({ length: count }, () => new ExpenseTestBuilder().withDefaults().build());
  }
}

// ====================================
// QUICK SETUP FUNCTIONS FOR COMMON SCENARIOS
// ====================================

/**
 * Quick setup functions for common test scenarios
 * These functions provide pre-configured test data for typical use cases
 */
export const QuickScenarios = {
  /**
   * Create a complete booking scenario with payments
   */
  completeBooking: (overrides?: Partial<CreateBookingInput>) => {
    const booking = BookingTestBuilder.create().withDefaults().build();

    const payments = [
      PaymentTestBuilder.create()
        .withBookingId(faker.string.uuid())
        .withAmount(booking.depositAmount || "5000.00")
        .withStatus(PAYMENT_STATUS.COMPLETED)
        .build(),
    ];

    return {
      booking: { ...booking, ...overrides },
      payments,
    };
  },

  /**
   * Create a booking with multiple payment installments
   */
  installmentBooking: () => {
    const booking = BookingTestBuilder.create()
      .withDefaults()
      .withAmount("25000.00", "10000.00")
      .build();

    const bookingId = faker.string.uuid();
    const payments = [
      PaymentTestBuilder.create()
        .withBookingId(bookingId)
        .withAmount("10000.00")
        .withStatus(PAYMENT_STATUS.COMPLETED)
        .withMethod(PAYMENT_METHODS.GCASH)
        .build(),
      PaymentTestBuilder.create()
        .withBookingId(bookingId)
        .withAmount("15000.00")
        .withStatus(PAYMENT_STATUS.PENDING)
        .withMethod(PAYMENT_METHODS.BANK_TRANSFER)
        .build(),
    ];

    return { booking, payments };
  },

  /**
   * Create a monthly expense report scenario
   */
  monthlyExpenses: (month: number = new Date().getMonth()) => {
    const expenses = [
      ExpenseTestBuilder.create().withUtilityExpense().build(),
      ExpenseTestBuilder.create().withMaintenanceExpense().build(),
      ExpenseTestBuilder.create()
        .withDescription("Food supplies for restaurant")
        .withAmount("8500.00")
        .withVendor("Metro Wholesale")
        .build(),
      ExpenseTestBuilder.create()
        .withDescription("Staff salaries")
        .withAmount("45000.00")
        .withVendor("HR Department")
        .build(),
    ];

    const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);

    return {
      expenses,
      summary: {
        totalAmount: totalAmount.toFixed(2),
        count: expenses.length,
        month,
      },
    };
  },

  /**
   * Create high-season booking surge scenario
   */
  highSeasonSurge: () => {
    const bookings = Array.from({ length: 15 }, (_, i) =>
      BookingTestBuilder.create()
        .withDefaults()
        .withDates(
          new Date(2024, 11, i + 15).toISOString(), // December dates
          new Date(2024, 11, i + 18).toISOString()
        )
        .withAmount(
          PhilippineDataGenerator.phpAmount(15000, 35000), // Higher rates
          PhilippineDataGenerator.phpAmount(5000, 12000)
        )
        .build()
    );

    return { bookings };
  },
};

// ====================================
// CUSTOM MATCHERS FOR RESORT-SPECIFIC VALIDATIONS
// ====================================

/**
 * Custom Jest/Vitest matchers for resort business logic validation
 */
declare module "vitest" {
  interface AsymmetricMatchersContaining {
    toBeValidPhilippinePhone(): any;
    toBeValidBookingDates(): any;
    toBeValidPhpAmount(): any;
    toHaveValidBookingStatus(): any;
    toHaveValidPaymentMethod(): any;
    toBeWithinSeasonRates(season: "peak" | "regular" | "low"): any;
    toHaveValidGuestCount(): any;
    toBeValidEmailFormat(): any;
    toHaveValidTaxCalculation(): any;
  }
}

/**
 * Add custom matchers to expect
 */
expect.extend({
  /**
   * Validates Philippine phone number format
   */
  toBeValidPhilippinePhone(received: string) {
    const phoneRegex = /^(\+63|0|63)?[0-9]{10}$/;
    const validNetworks = [
      "917",
      "918",
      "919",
      "920",
      "928",
      "929",
      "939",
      "946",
      "947",
      "948",
      "949",
      "950",
    ];

    if (typeof received !== "string") {
      return {
        message: () => `Expected ${received} to be a string`,
        pass: false,
      };
    }

    const normalizedNumber = received.replace(/^\+63|^63|^0/, "");
    const networkCode = normalizedNumber.substring(0, 3);

    const isValidLength = normalizedNumber.length === 10;
    const isValidNetwork = validNetworks.includes(networkCode);

    return {
      message: () =>
        isValidLength && isValidNetwork
          ? `Expected ${received} not to be a valid Philippine phone number`
          : `Expected ${received} to be a valid Philippine phone number. Got invalid ${!isValidLength ? "length" : "network code"}`,
      pass: isValidLength && isValidNetwork,
    };
  },

  /**
   * Validates booking date logic (check-in before check-out, future dates, etc.)
   */
  toBeValidBookingDates(received: { checkIn: string; checkOut: string }) {
    const checkIn = new Date(received.checkIn);
    const checkOut = new Date(received.checkOut);
    const now = new Date();

    const isCheckInFuture = checkIn >= now;
    const isCheckOutAfterCheckIn = checkOut > checkIn;
    const isReasonableStay = checkOut.getTime() - checkIn.getTime() <= 30 * 24 * 60 * 60 * 1000; // Max 30 days

    const isValid = isCheckInFuture && isCheckOutAfterCheckIn && isReasonableStay;

    let message = "";
    if (!isCheckInFuture) message = "Check-in date must be in the future";
    else if (!isCheckOutAfterCheckIn) message = "Check-out date must be after check-in date";
    else if (!isReasonableStay) message = "Stay duration cannot exceed 30 days";

    return {
      message: () =>
        isValid
          ? `Expected booking dates to be invalid`
          : `Expected valid booking dates. ${message}`,
      pass: isValid,
    };
  },

  /**
   * Validates Philippine peso amount format
   */
  toBeValidPhpAmount(received: string | number) {
    const amount = typeof received === "string" ? received : received.toString();
    const regex = /^\d+(\.\d{1,2})?$/;
    const numValue = parseFloat(amount);

    const isValidFormat = regex.test(amount);
    const isPositive = numValue >= 0;
    const isRealistic = numValue <= 1000000; // Max 1M PHP

    const isValid = isValidFormat && isPositive && isRealistic;

    return {
      message: () =>
        isValid
          ? `Expected ${amount} not to be a valid PHP amount`
          : `Expected ${amount} to be a valid PHP amount (positive number with max 2 decimal places)`,
      pass: isValid,
    };
  },

  /**
   * Validates booking status transitions
   */
  toHaveValidBookingStatus(received: BookingStatus) {
    const validStatuses = Object.values(BOOKING_STATUS);
    const isValid = validStatuses.includes(received);

    return {
      message: () =>
        isValid
          ? `Expected ${received} not to be a valid booking status`
          : `Expected ${received} to be a valid booking status. Valid options: ${validStatuses.join(", ")}`,
      pass: isValid,
    };
  },

  /**
   * Validates payment method availability in Philippines
   */
  toHaveValidPaymentMethod(received: PaymentMethod) {
    const validMethods = Object.values(PAYMENT_METHODS);
    const isValid = validMethods.includes(received);

    return {
      message: () =>
        isValid
          ? `Expected ${received} not to be a valid payment method`
          : `Expected ${received} to be a valid payment method. Valid options: ${validMethods.join(", ")}`,
      pass: isValid,
    };
  },

  /**
   * Validates pricing within seasonal rate ranges
   */
  toBeWithinSeasonRates(received: number | string, season: "peak" | "regular" | "low") {
    const amount = typeof received === "string" ? parseFloat(received) : received;

    const rates = {
      peak: { min: 8000, max: 50000 },
      regular: { min: 5000, max: 30000 },
      low: { min: 3000, max: 20000 },
    };

    const { min, max } = rates[season];
    const isValid = amount >= min && amount <= max;

    return {
      message: () =>
        isValid
          ? `Expected ${amount} not to be within ${season} season rates (₱${min} - ₱${max})`
          : `Expected ${amount} to be within ${season} season rates (₱${min} - ₱${max})`,
      pass: isValid,
    };
  },

  /**
   * Validates guest count for resort capacity
   */
  toHaveValidGuestCount(received: number) {
    const isValid = Number.isInteger(received) && received >= 1 && received <= 20;

    return {
      message: () =>
        isValid
          ? `Expected ${received} not to be a valid guest count`
          : `Expected ${received} to be a valid guest count (1-20 guests)`,
      pass: isValid,
    };
  },

  /**
   * Validates email format with common Philippine domains
   */
  toBeValidEmailFormat(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(received);
    const isLowerCase = received === received.toLowerCase();

    const isValid = isValidFormat && isLowerCase;

    return {
      message: () =>
        isValid
          ? `Expected ${received} not to be a valid email format`
          : `Expected ${received} to be a valid email format (lowercase, valid structure)`,
      pass: isValid,
    };
  },

  /**
   * Validates tax calculation for Philippine VAT (12%)
   */
  toHaveValidTaxCalculation(received: { base: number; vat: number; total: number }) {
    const expectedVat = received.base * 0.12;
    const expectedTotal = received.base + expectedVat;

    const vatValid = Math.abs(received.vat - expectedVat) < 0.01;
    const totalValid = Math.abs(received.total - expectedTotal) < 0.01;

    const isValid = vatValid && totalValid;

    return {
      message: () =>
        isValid
          ? `Expected tax calculation to be invalid`
          : `Expected valid tax calculation. VAT should be 12% of base (${expectedVat.toFixed(2)}), total should be ${expectedTotal.toFixed(2)}`,
      pass: isValid,
    };
  },
});

// ====================================
// TDD WORKFLOW HELPERS
// ====================================

/**
 * TDD Workflow utilities for Red-Green-Refactor cycle
 */
export const TDDWorkflow = {
  /**
   * RED: Create a failing test case
   * Use this to structure the "Red" phase of TDD
   */
  createFailingTest: (description: string, testFn: () => void | Promise<void>) => {
    return {
      description: `🔴 RED: ${description}`,
      test: testFn,
      phase: "red" as const,
    };
  },

  /**
   * GREEN: Make the test pass with minimal implementation
   * Use this to structure the "Green" phase of TDD
   */
  makeTestPass: (description: string, implementation: () => void | Promise<void>) => {
    return {
      description: `🟢 GREEN: ${description}`,
      implementation,
      phase: "green" as const,
    };
  },

  /**
   * REFACTOR: Improve the code while keeping tests green
   * Use this to structure the "Refactor" phase of TDD
   */
  refactorCode: (description: string, refactorFn: () => void | Promise<void>) => {
    return {
      description: `🔄 REFACTOR: ${description}`,
      refactor: refactorFn,
      phase: "refactor" as const,
    };
  },

  /**
   * Create a complete TDD cycle for a feature
   */
  createTDDCycle: (feature: string) => ({
    feature,
    red: (description: string, testFn: () => void | Promise<void>) =>
      TDDWorkflow.createFailingTest(`${feature}: ${description}`, testFn),
    green: (description: string, implementation: () => void | Promise<void>) =>
      TDDWorkflow.makeTestPass(`${feature}: ${description}`, implementation),
    refactor: (description: string, refactorFn: () => void | Promise<void>) =>
      TDDWorkflow.refactorCode(`${feature}: ${description}`, refactorFn),
  }),
};

/**
 * Export all builders and utilities for easy importing
 */
export {
  BookingTestBuilder,
  PaymentTestBuilder,
  ExpenseTestBuilder,
  QuickScenarios,
  PhilippineDataGenerator,
  TDDWorkflow,
};

/**
 * Common test constants for consistent testing
 */
export const TDD_CONSTANTS = {
  TIMEOUTS: {
    FAST: 1000,
    MEDIUM: 5000,
    SLOW: 10000,
  },
  SEASONS: {
    PEAK: "peak" as const,
    REGULAR: "regular" as const,
    LOW: "low" as const,
  },
  CURRENCIES: {
    PHP: PHILIPPINE_CONSTANTS.CURRENCY,
  },
  DATE_FORMATS: {
    ISO: "YYYY-MM-DDTHH:mm:ss.SSSZ",
    DISPLAY: "MMM DD, YYYY",
    SHORT: "MM/DD/YYYY",
  },
} as const;
