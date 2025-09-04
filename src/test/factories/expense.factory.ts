/**
 * Expense Test Data Factory
 * Type-safe expense data generation using Zod schemas for consistent testing
 */

import { faker } from "@faker-js/faker";
import {
  CreateExpenseSchema,
  ExpenseSchema,
  type CreateExpenseInput,
  type ExpenseInput,
} from "@/types/schemas";
import { EXPENSE_STATUS, PAYMENT_METHODS } from "@/types/database";

export interface ExpenseFactoryOptions {
  id?: string;
  categoryId?: string;
  description?: string;
  amount?: string;
  vendorName?: string;
  paymentMethod?: keyof typeof PAYMENT_METHODS;
  status?: keyof typeof EXPENSE_STATUS;
  invoiceDate?: string;
  paidAt?: string;
  receiptUrl?: string;
  isRecurring?: boolean;
  tags?: string[];
  seed?: string;
}

let expenseIdCounter = 1;

/**
 * Create deterministic faker instance with seed
 */
function createSeededFaker(seed?: string): typeof faker {
  if (seed) {
    faker.seed(Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0));
  }
  return faker;
}

/**
 * Generate expense code in format EXP-YYYYMM-NNNN
 */
function generateExpenseCode(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const sequence = String(expenseIdCounter++).padStart(4, "0");
  return `EXP-${year}${month}-${sequence}`;
}

/**
 * Philippine business expense categories
 */
const EXPENSE_CATEGORIES = [
  "utilities",
  "maintenance",
  "supplies",
  "cleaning",
  "marketing",
  "insurance",
  "taxes",
  "salaries",
  "food-beverage",
  "transportation",
  "professional-services",
  "repairs",
];

/**
 * Philippine vendor names for realistic data
 */
const PHILIPPINE_VENDORS = [
  "Meralco",
  "Maynilad",
  "Manila Water",
  "PLDT",
  "Globe Telecom",
  "Shell Philippines",
  "Petron Corporation",
  "SM Supermalls",
  "Robinsons Retail",
  "Mercury Drug",
  "Jollibee Foods Corp",
  "BPI",
  "Metrobank",
  "Ayala Land",
  "Megaworld",
];

/**
 * Generate realistic expense descriptions based on category
 */
function generateExpenseDescription(category: string, seededFaker: typeof faker): string {
  const descriptions: Record<string, string[]> = {
    utilities: [
      "Electricity bill for main building",
      "Water utility charges",
      "Internet and telecommunications",
      "Gas supply for kitchen",
    ],
    maintenance: [
      "Pool maintenance and chemicals",
      "Air conditioning service and repair",
      "Plumbing repairs and fixtures",
      "Landscaping and garden maintenance",
    ],
    supplies: [
      "Cleaning supplies and toiletries",
      "Office supplies and stationery",
      "Kitchen supplies and utensils",
      "Laundry detergent and fabric softener",
    ],
    cleaning: [
      "Housekeeping services",
      "Laundry service charges",
      "Deep cleaning service",
      "Carpet and upholstery cleaning",
    ],
    marketing: [
      "Social media advertising",
      "Website maintenance and hosting",
      "Photography services",
      "Promotional materials printing",
    ],
    food: [
      "Guest breakfast supplies",
      "Welcome refreshments",
      "Kitchen ingredients and beverages",
      "Staff meal allowances",
    ],
  };

  const categoryDescriptions = descriptions[category] || [
    `${category} related expense`,
    `Professional ${category} services`,
    `${category} supplies and materials`,
  ];

  return seededFaker.helpers.arrayElement(categoryDescriptions);
}

/**
 * Generate realistic amounts based on expense category
 */
function generateExpenseAmount(category: string, seededFaker: typeof faker): string {
  const ranges: Record<string, { min: number; max: number }> = {
    utilities: { min: 2000, max: 15000 },
    maintenance: { min: 1500, max: 25000 },
    supplies: { min: 500, max: 5000 },
    cleaning: { min: 800, max: 8000 },
    marketing: { min: 1000, max: 20000 },
    salaries: { min: 15000, max: 50000 },
    insurance: { min: 5000, max: 30000 },
    taxes: { min: 3000, max: 100000 },
  };

  const range = ranges[category] || { min: 500, max: 10000 };
  const amount = seededFaker.number.float({ min: range.min, max: range.max, fractionDigits: 2 });
  return amount.toFixed(2);
}

/**
 * Create a test expense with Zod validation
 */
export function createExpense(overrides?: ExpenseFactoryOptions): ExpenseInput {
  const seededFaker = createSeededFaker(overrides?.seed);

  const categoryId = overrides?.categoryId || seededFaker.string.uuid();
  const category = seededFaker.helpers.arrayElement(EXPENSE_CATEGORIES);
  const amount = overrides?.amount || generateExpenseAmount(category, seededFaker);
  const quantity = seededFaker.number.float({ min: 1, max: 10, fractionDigits: 2 }).toString();
  const unitPrice = (parseFloat(amount) / parseFloat(quantity)).toFixed(2);

  const expenseData: ExpenseInput = {
    id: overrides?.id || `expense-test-${expenseIdCounter++}`,
    expenseCode: generateExpenseCode(),
    categoryId,
    description: overrides?.description || generateExpenseDescription(category, seededFaker),
    amount,
    quantity,
    unitPrice,
    paymentMethod:
      overrides?.paymentMethod ||
      seededFaker.helpers.arrayElement([
        PAYMENT_METHODS.CASH,
        PAYMENT_METHODS.GCASH,
        PAYMENT_METHODS.BANK_TRANSFER,
        PAYMENT_METHODS.CREDIT_CARD,
      ]),
    paymentStatus: "paid",
    paidAt: overrides?.paidAt || seededFaker.date.recent().toISOString(),
    vendorName: overrides?.vendorName || seededFaker.helpers.arrayElement(PHILIPPINE_VENDORS),
    vendorContact: `+63${seededFaker.string.numeric(10)}`,
    invoiceNumber: `INV-${seededFaker.string.alphanumeric(8).toUpperCase()}`,
    invoiceDate:
      overrides?.invoiceDate || seededFaker.date.recent({ days: 30 }).toISOString().split("T")[0],
    dueDate: (() => {
      const invoiceDate = new Date(overrides?.invoiceDate || seededFaker.date.recent({ days: 30 }));
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(invoiceDate.getDate() + seededFaker.number.int({ min: 7, max: 30 }));
      return dueDate.toISOString().split("T")[0];
    })(),
    status: overrides?.status || EXPENSE_STATUS.APPROVED,
    approvedBy: "user-test-admin",
    approvedAt: seededFaker.date.recent().toISOString(),
    rejectionReason: null,
    receiptUrl:
      overrides?.receiptUrl ||
      `https://storage.example.com/receipts/${seededFaker.string.uuid()}.pdf`,
    attachments: [
      {
        url: `https://storage.example.com/receipts/${seededFaker.string.uuid()}.pdf`,
        filename: `receipt-${seededFaker.string.alphanumeric(8)}.pdf`,
        size: seededFaker.number.int({ min: 50000, max: 2000000 }),
        mimeType: "application/pdf",
      },
    ],
    isRecurring: overrides?.isRecurring || seededFaker.datatype.boolean({ probability: 0.2 }),
    recurringFrequency: null,
    nextRecurringDate: null,
    notes: seededFaker.lorem.sentence(),
    tags:
      overrides?.tags ||
      seededFaker.helpers.arrayElements(
        [
          "utilities",
          "maintenance",
          "operational",
          "fixed-cost",
          "variable-cost",
          "tax-deductible",
          "monthly",
          "quarterly",
        ],
        seededFaker.number.int({ min: 1, max: 3 })
      ),
    metadata: {
      generatedBy: "test-factory",
      seed: overrides?.seed || "default",
      category,
    },
    createdBy: "user-test-manager",
    updatedBy: null,
    createdAt: seededFaker.date.past().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Set recurring fields if applicable
  if (expenseData.isRecurring) {
    expenseData.recurringFrequency = seededFaker.helpers.arrayElement([
      "monthly",
      "quarterly",
      "yearly",
    ]);
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    expenseData.nextRecurringDate = nextDate.toISOString().split("T")[0];
  }

  // Validate with Zod schema
  const validated = ExpenseSchema.parse(expenseData);
  return validated;
}

/**
 * Create expense data for creation (subset of full expense)
 */
export function createExpenseData(overrides?: ExpenseFactoryOptions): CreateExpenseInput {
  const fullExpense = createExpense(overrides);

  const createData: CreateExpenseInput = {
    categoryId: fullExpense.categoryId,
    description: fullExpense.description,
    amount: fullExpense.amount,
    quantity: fullExpense.quantity,
    unitPrice: fullExpense.unitPrice,
    paymentMethod: fullExpense.paymentMethod,
    paymentStatus: fullExpense.paymentStatus,
    paidAt: fullExpense.paidAt,
    vendorName: fullExpense.vendorName,
    vendorContact: fullExpense.vendorContact,
    invoiceNumber: fullExpense.invoiceNumber,
    invoiceDate: fullExpense.invoiceDate,
    dueDate: fullExpense.dueDate,
    receiptUrl: fullExpense.receiptUrl,
    attachments: fullExpense.attachments,
    isRecurring: fullExpense.isRecurring,
    recurringFrequency: fullExpense.recurringFrequency,
    notes: fullExpense.notes,
    tags: fullExpense.tags,
  };

  // Validate with creation schema
  const validated = CreateExpenseSchema.parse(createData);
  return validated;
}

/**
 * Create multiple expenses with realistic distribution
 */
export function createExpenses(count: number, overrides?: ExpenseFactoryOptions): ExpenseInput[] {
  const expenses: ExpenseInput[] = [];

  for (let i = 0; i < count; i++) {
    const expense = createExpense({
      ...overrides,
      seed: overrides?.seed ? `${overrides.seed}-${i}` : `expense-${i}`,
    });

    expenses.push(expense);
  }

  return expenses;
}

/**
 * Create specific expense scenarios for testing
 */
export const expenseScenarios = {
  // High-value expense requiring approval
  highValue: (overrides?: ExpenseFactoryOptions): ExpenseInput =>
    createExpense({
      ...overrides,
      amount: "50000.00",
      status: EXPENSE_STATUS.PENDING,
      description: "Major building maintenance and renovation",
      vendorName: "ABC Construction Company",
    }),

  // Recurring monthly expense
  recurringMonthly: (overrides?: ExpenseFactoryOptions): ExpenseInput =>
    createExpense({
      ...overrides,
      isRecurring: true,
      paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
      description: "Monthly electricity bill",
      vendorName: "Meralco",
    }),

  // Rejected expense
  rejected: (overrides?: ExpenseFactoryOptions): ExpenseInput =>
    createExpense({
      ...overrides,
      status: EXPENSE_STATUS.REJECTED,
      rejectionReason: "Missing proper receipt documentation",
      approvedBy: null,
      approvedAt: null,
    }),

  // Utility expense
  utility: (overrides?: ExpenseFactoryOptions): ExpenseInput =>
    createExpense({
      ...overrides,
      description: "Monthly electricity consumption",
      vendorName: "Meralco",
      amount: faker.number.float({ min: 5000, max: 15000, fractionDigits: 2 }).toString(),
      tags: ["utilities", "monthly", "operational"],
    }),

  // Food and beverage expense
  foodBeverage: (overrides?: ExpenseFactoryOptions): ExpenseInput =>
    createExpense({
      ...overrides,
      description: "Guest breakfast supplies and beverages",
      amount: faker.number.float({ min: 2000, max: 8000, fractionDigits: 2 }).toString(),
      tags: ["food-beverage", "guest-services", "operational"],
    }),

  // Marketing expense
  marketing: (overrides?: ExpenseFactoryOptions): ExpenseInput =>
    createExpense({
      ...overrides,
      description: "Social media advertising campaign",
      amount: faker.number.float({ min: 5000, max: 20000, fractionDigits: 2 }).toString(),
      tags: ["marketing", "advertising", "digital"],
    }),
};

/**
 * Generate expenses for a specific month
 */
export function createMonthlyExpenses(
  year: number,
  month: number,
  count: number,
  overrides?: ExpenseFactoryOptions
): ExpenseInput[] {
  const expenses: ExpenseInput[] = [];
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);

  for (let i = 0; i < count; i++) {
    const randomDay = faker.number.int({ min: 1, max: endOfMonth.getDate() });
    const expenseDate = new Date(year, month - 1, randomDay);

    const expense = createExpense({
      ...overrides,
      invoiceDate: expenseDate.toISOString().split("T")[0],
      paidAt: expenseDate.toISOString(),
      seed: `monthly-${year}-${month}-${i}`,
    });

    expenses.push(expense);
  }

  return expenses;
}

/**
 * Create expense categories for testing
 */
export function createExpenseCategories(): Array<{ id: string; name: string; slug: string }> {
  return EXPENSE_CATEGORIES.map((category, index) => ({
    id: `category-${index + 1}`,
    name: category.charAt(0).toUpperCase() + category.slice(1).replace("-", " "),
    slug: category,
  }));
}

/**
 * Reset expense ID counter for consistent testing
 */
export function resetExpenseIdCounter(): void {
  expenseIdCounter = 1;
  faker.seed(456); // Reset faker seed
}

/**
 * Calculate total expenses for a given array
 */
export function calculateTotalExpenses(expenses: ExpenseInput[]): number {
  return expenses.reduce((total, expense) => total + parseFloat(expense.amount), 0);
}

/**
 * Group expenses by category for analytics
 */
export function groupExpensesByCategory(expenses: ExpenseInput[]): Record<string, ExpenseInput[]> {
  return expenses.reduce(
    (groups, expense) => {
      const category = (expense.metadata?.category as string) || "other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(expense);
      return groups;
    },
    {} as Record<string, ExpenseInput[]>
  );
}
