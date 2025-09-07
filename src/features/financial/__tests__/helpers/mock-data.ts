/**
 * Mock Data Generator for Philippine Financial Testing
 * Provides realistic test data following Philippine business standards
 */

import { Decimal } from "decimal.js";
import {
  ExpenseCategory,
  ExpenseStatus,
  PaymentMethod,
  VendorType,
  ApprovalLevel,
  ApprovalStatus,
  type Expense,
  type Vendor,
  type PettyCashFund,
  type Receipt,
} from "../../types/financial.types";

// ============================================================================
// PHILIPPINE-SPECIFIC DATA
// ============================================================================

/**
 * Valid Philippine TIN samples for testing
 */
export const SAMPLE_TINS = {
  individual: [
    "123-456-789-000",
    "234-567-890-000",
    "345-678-901-000",
    "456-789-012-000",
    "567-890-123-000",
  ],
  corporation: ["123-456-789", "234-567-890", "345-678-901", "456-789-012", "567-890-123"],
  withBranch: ["123-456-789-001", "123-456-789-002", "123-456-789-003"],
};

/**
 * Valid Philippine phone numbers for testing
 */
export const SAMPLE_PHONES = [
  "09171234567", // Globe
  "09181234567", // Smart
  "09221234567", // Sun
  "09991234567", // DITO
  "028-123-4567", // Landline Manila
  "032-123-4567", // Landline Cebu
  "+639171234567", // International format
];

/**
 * Sample Philippine business addresses
 */
export const SAMPLE_ADDRESSES = [
  "123 Ayala Avenue, Makati City, Metro Manila 1226",
  "456 Session Road, Baguio City, Benguet 2600",
  "789 Rizal Street, Brgy. San Roque, La Union 2514",
  "Unit 10B, SM City North EDSA, Quezon City 1105",
  "321 Colon Street, Cebu City, Cebu 6000",
];

/**
 * Sample Philippine vendor names
 */
export const SAMPLE_VENDOR_NAMES = [
  "Manila Electric Company (Meralco)",
  "La Union Water District",
  "PLDT Inc.",
  "Globe Telecom",
  "SM Supermarket",
  "Mercury Drug Corporation",
  "Jollibee Foods Corporation",
  "Philippine Seven Corporation",
  "Petron Corporation",
  "BDO Unibank Inc.",
];

/**
 * Sample receipt number series
 */
export const SAMPLE_RECEIPT_SERIES = ["2025-0001", "2025-0002", "2024-0001", "2024-0999"];

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

/**
 * Generate a valid Philippine TIN
 */
export function generateTIN(type: "individual" | "corporation" = "corporation"): string {
  const tins = type === "individual" ? SAMPLE_TINS.individual : SAMPLE_TINS.corporation;
  return tins[Math.floor(Math.random() * tins.length)];
}

/**
 * Generate a valid receipt number
 */
export function generateReceiptNumber(
  year: number = 2025,
  series: string = "0001",
  sequence: number = 1
): string {
  const paddedSequence = sequence.toString().padStart(8, "0");
  return `${year}-${series}-${paddedSequence}`;
}

/**
 * Generate a random peso amount
 */
export function generateAmount(min: number = 100, max: number = 10000): Decimal {
  const amount = Math.random() * (max - min) + min;
  return new Decimal(amount).toDecimalPlaces(2);
}

/**
 * Calculate VAT from gross amount (12%)
 */
export function calculateVAT(grossAmount: Decimal): {
  netAmount: Decimal;
  vatAmount: Decimal;
  grossAmount: Decimal;
} {
  const vatDivisor = new Decimal(1.12);
  const netAmount = grossAmount.dividedBy(vatDivisor).toDecimalPlaces(2);
  const vatAmount = grossAmount.minus(netAmount).toDecimalPlaces(2);

  return {
    netAmount,
    vatAmount,
    grossAmount,
  };
}

/**
 * Calculate EWT from gross amount
 */
export function calculateEWT(
  grossAmount: Decimal,
  vendorType: VendorType,
  serviceType: "professional" | "rental" | "services" = "services"
): Decimal {
  let rate = 0;

  if (vendorType === VendorType.INDIVIDUAL) {
    rate = serviceType === "professional" ? 0.1 : 0.05;
  } else if (vendorType === VendorType.CORPORATION) {
    rate = serviceType === "services" ? 0.02 : 0.05;
  }

  return grossAmount.times(rate).toDecimalPlaces(2);
}

/**
 * Generate a mock expense
 */
export function generateMockExpense(overrides?: Partial<Expense>): Expense {
  const amount = generateAmount(500, 5000);
  const vatBreakdown = calculateVAT(amount);

  return {
    id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId: "proj-123",
    transactionDate: new Date(),
    category: ExpenseCategory.SUPPLIES_OFFICE,
    amount,
    description: "Office supplies for resort operations",

    isVatable: true,
    vatAmount: vatBreakdown.vatAmount,
    netAmount: vatBreakdown.netAmount,

    status: ExpenseStatus.DRAFT,
    approvalLevel: ApprovalLevel.AUTO,

    createdBy: "user-123",
    createdAt: new Date(),

    ...overrides,
  };
}

/**
 * Generate a mock vendor
 */
export function generateMockVendor(overrides?: Partial<Vendor>): Vendor {
  const vendorType = VendorType.CORPORATION;
  const isVatRegistered = Math.random() > 0.3;

  return {
    id: `vendor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId: "proj-123",

    vendorName: SAMPLE_VENDOR_NAMES[Math.floor(Math.random() * SAMPLE_VENDOR_NAMES.length)],
    tin: generateTIN(vendorType === VendorType.INDIVIDUAL ? "individual" : "corporation"),
    businessAddress: SAMPLE_ADDRESSES[Math.floor(Math.random() * SAMPLE_ADDRESSES.length)],
    contactPerson: "Juan Dela Cruz",
    contactNumber: SAMPLE_PHONES[Math.floor(Math.random() * SAMPLE_PHONES.length)],
    email: "vendor@example.com",

    vendorType,
    vatRegistered: isVatRegistered,
    vatNumber: isVatRegistered ? "123-456-789-0001" : undefined,
    withholdingTaxApplicable: vendorType !== VendorType.GOVERNMENT,
    withholdingTaxRate: vendorType === VendorType.INDIVIDUAL ? 0.1 : 0.02,

    birForm2307Required: true,
    requiresOR: true,
    paymentTerms: 30,

    serviceCategories: [ExpenseCategory.SUPPLIES_OFFICE, ExpenseCategory.SUPPLIES_HOUSEKEEPING],

    isActive: true,
    blacklisted: false,

    createdBy: "user-123",
    createdAt: new Date(),

    ...overrides,
  };
}

/**
 * Generate a mock petty cash fund
 */
export function generateMockPettyCashFund(overrides?: Partial<PettyCashFund>): PettyCashFund {
  const fundLimit = new Decimal(10000);
  const currentBalance = new Decimal(Math.random() * 10000).toDecimalPlaces(2);

  return {
    id: `fund-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId: "proj-123",
    fundName: "Main Office Petty Cash",
    fundLimit,
    currentBalance,
    custodian: "Maria Santos",
    alternateCustodian: "Jose Reyes",
    location: "Front Desk Drawer",
    lastReplenishmentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    lastReconciliationDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
    isActive: true,

    ...overrides,
  };
}

/**
 * Generate a mock receipt
 */
export function generateMockReceipt(overrides?: Partial<Receipt>): Receipt {
  const amount = generateAmount(1000, 10000);
  const vatBreakdown = calculateVAT(amount);

  return {
    id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId: "proj-123",
    receiptNumber: generateReceiptNumber(2025, "0001", Math.floor(Math.random() * 1000)),
    receiptDate: new Date(),

    transactionType: "expense",
    transactionId: "exp-123",
    amount,

    payorName: "ABC Corporation",
    payorTin: generateTIN("corporation"),
    payorAddress: SAMPLE_ADDRESSES[0],

    vatableSales: vatBreakdown.netAmount,
    vatAmount: vatBreakdown.vatAmount,
    totalAmount: amount,

    paymentMethod: PaymentMethod.BANK_TRANSFER,
    paymentReference: "REF-2025-001",

    birPermitNumber: "PTR-123456789",
    isOfficial: true,
    isCancelled: false,

    issuedBy: "user-123",
    issuedAt: new Date(),

    ...overrides,
  };
}

// ============================================================================
// BATCH GENERATORS
// ============================================================================

/**
 * Generate multiple mock expenses
 */
export function generateMockExpenses(count: number = 10): Expense[] {
  const expenses: Expense[] = [];
  const categories = Object.values(ExpenseCategory);
  const statuses = Object.values(ExpenseStatus);

  for (let i = 0; i < count; i++) {
    expenses.push(
      generateMockExpense({
        category: categories[Math.floor(Math.random() * categories.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        transactionDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within 30 days
      })
    );
  }

  return expenses;
}

/**
 * Generate multiple mock vendors
 */
export function generateMockVendors(count: number = 5): Vendor[] {
  const vendors: Vendor[] = [];
  const types = Object.values(VendorType);

  for (let i = 0; i < count; i++) {
    vendors.push(
      generateMockVendor({
        vendorType: types[Math.floor(Math.random() * types.length)],
        vendorName: SAMPLE_VENDOR_NAMES[i % SAMPLE_VENDOR_NAMES.length],
      })
    );
  }

  return vendors;
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

/**
 * Generate expense approval scenario
 */
export function generateApprovalScenario() {
  return {
    autoApprove: generateMockExpense({
      amount: new Decimal(500),
      status: ExpenseStatus.PENDING_APPROVAL,
      approvalLevel: ApprovalLevel.AUTO,
    }),
    managerApproval: generateMockExpense({
      amount: new Decimal(5000),
      status: ExpenseStatus.PENDING_APPROVAL,
      approvalLevel: ApprovalLevel.MANAGER,
    }),
    ownerApproval: generateMockExpense({
      amount: new Decimal(15000),
      status: ExpenseStatus.PENDING_APPROVAL,
      approvalLevel: ApprovalLevel.OWNER,
    }),
    dualApproval: generateMockExpense({
      amount: new Decimal(75000),
      status: ExpenseStatus.PENDING_APPROVAL,
      approvalLevel: ApprovalLevel.DUAL,
    }),
  };
}

/**
 * Generate tax calculation scenarios
 */
export function generateTaxScenarios() {
  return {
    vatOnly: {
      grossAmount: new Decimal(1120),
      expectedNet: new Decimal(1000),
      expectedVat: new Decimal(120),
    },
    withEwtIndividual: {
      grossAmount: new Decimal(10000),
      vendorType: VendorType.INDIVIDUAL,
      expectedEwt: new Decimal(1000), // 10% for professionals
    },
    withEwtCorporation: {
      grossAmount: new Decimal(10000),
      vendorType: VendorType.CORPORATION,
      expectedEwt: new Decimal(200), // 2% for services
    },
    percentageTax: {
      grossSales: new Decimal(100000),
      expectedTax: new Decimal(3000), // 3% percentage tax
    },
  };
}

/**
 * Generate petty cash scenario
 */
export function generatePettyCashScenario() {
  const fund = generateMockPettyCashFund({
    fundLimit: new Decimal(10000),
    currentBalance: new Decimal(2000), // 20% remaining, should trigger replenishment
  });

  return {
    fund,
    lowBalance: new Decimal(2000),
    replenishmentAmount: new Decimal(8000),
    maxDisbursement: new Decimal(2000),
    approvalThreshold: new Decimal(500),
  };
}

// ============================================================================
// VALIDATION TEST DATA
// ============================================================================

/**
 * Invalid test data for validation testing
 */
export const INVALID_TEST_DATA = {
  tins: [
    "123456789", // Missing dashes
    "12-34-56", // Too short
    "123-456-789-ABCD", // Letters in TIN
    "123-456-789-00000", // Too many digits
    "", // Empty
  ],
  phones: [
    "1234567", // Too short
    "0912345678901", // Too long
    "ABCD1234567", // Letters
    "123-456-7890", // US format
    "", // Empty
  ],
  amounts: [
    -100, // Negative
    0, // Zero
    1000000000, // Exceeds max
    "1,234.56", // With comma
    "ABC", // Non-numeric
  ],
  receiptNumbers: [
    "2025-01-00000001", // Wrong series format
    "25-0001-00000001", // Wrong year format
    "2025-0001-1234567", // Wrong sequence length
    "2025-0001", // Missing sequence
    "", // Empty
  ],
};

/**
 * Edge case test data
 */
export const EDGE_CASES = {
  amounts: {
    minimum: new Decimal(0.01),
    maximum: new Decimal(999999999.99),
    withManyDecimals: new Decimal(123.456789),
    largeWithCentavos: new Decimal(999999.99),
  },
  dates: {
    today: new Date(),
    yesterday: new Date(Date.now() - 24 * 60 * 60 * 1000),
    startOfYear: new Date(new Date().getFullYear(), 0, 1),
    endOfYear: new Date(new Date().getFullYear(), 11, 31),
    fiveYearsAgo: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
  },
  strings: {
    veryLong: "A".repeat(1000),
    withSpecialChars: "Test & Co., Inc. #123",
    withUnicode: "José María Ñoño",
    withEmoji: "Test 😀 Company",
    sqlInjection: "'; DROP TABLE expenses; --",
    xss: '<script>alert("XSS")</script>',
  },
};
