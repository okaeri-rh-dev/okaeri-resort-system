/**
 * Payment Test Data Factory
 * Type-safe payment data generation using Zod schemas for consistent testing
 */

import { faker } from "@faker-js/faker";
import {
  CreatePaymentSchema,
  PaymentSchema,
  type CreatePaymentInput,
  type PaymentInput,
} from "@/types/schemas";
import { PAYMENT_STATUS, PAYMENT_METHODS } from "@/types/database";

export interface PaymentFactoryOptions {
  id?: string;
  bookingId?: string;
  amount?: string;
  paymentMethod?: keyof typeof PAYMENT_METHODS;
  paymentType?: "deposit" | "partial" | "full" | "refund";
  status?: keyof typeof PAYMENT_STATUS;
  transactionId?: string;
  referenceNumber?: string;
  gcashReferenceNumber?: string;
  gcashAccountName?: string;
  gcashAccountNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  receiptUrl?: string;
  notes?: string;
  seed?: string;
}

let paymentIdCounter = 1;

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
 * Generate payment code in format PAY-YYYYMM-NNNN
 */
function generatePaymentCode(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const sequence = String(paymentIdCounter++).padStart(4, "0");
  return `PAY-${year}${month}-${sequence}`;
}

/**
 * Generate realistic GCash reference numbers
 */
function generateGCashReference(): string {
  return faker.number.bigInt({ min: 1000000000000, max: 9999999999999 }).toString();
}

/**
 * Generate realistic transaction IDs based on payment method
 */
function generateTransactionId(method: string, seededFaker: typeof faker): string {
  switch (method) {
    case PAYMENT_METHODS.GCASH:
      return `GCASH${seededFaker.string.numeric(12)}`;
    case PAYMENT_METHODS.BANK_TRANSFER:
      return `BT${seededFaker.string.alphanumeric(10).toUpperCase()}`;
    case PAYMENT_METHODS.CREDIT_CARD:
      return `CC${seededFaker.string.alphanumeric(16).toUpperCase()}`;
    default:
      return seededFaker.string.alphanumeric(12).toUpperCase();
  }
}

/**
 * Philippine bank names for realistic data
 */
const PHILIPPINE_BANKS = [
  "BPI (Bank of the Philippine Islands)",
  "Metrobank",
  "BDO Unibank",
  "PNB (Philippine National Bank)",
  "Land Bank of the Philippines",
  "UnionBank of the Philippines",
  "Security Bank",
  "RCBC (Rizal Commercial Banking Corporation)",
  "Chinabank",
  "EastWest Bank",
];

/**
 * Generate realistic bank account numbers
 */
function generateBankAccountNumber(seededFaker: typeof faker): string {
  // Philippine bank account numbers are typically 10-16 digits
  return seededFaker.string.numeric(faker.number.int({ min: 10, max: 16 }));
}

/**
 * Create a test payment with Zod validation
 */
export function createPayment(overrides?: PaymentFactoryOptions): PaymentInput {
  const seededFaker = createSeededFaker(overrides?.seed);

  const paymentMethod =
    overrides?.paymentMethod ||
    seededFaker.helpers.arrayElement([
      PAYMENT_METHODS.CASH,
      PAYMENT_METHODS.GCASH,
      PAYMENT_METHODS.BANK_TRANSFER,
      PAYMENT_METHODS.CREDIT_CARD,
    ]);

  // Generate method-specific fields
  const gcashData =
    paymentMethod === PAYMENT_METHODS.GCASH
      ? {
          gcashReferenceNumber: overrides?.gcashReferenceNumber || generateGCashReference(),
          gcashAccountName: overrides?.gcashAccountName || seededFaker.person.fullName(),
          gcashAccountNumber:
            overrides?.gcashAccountNumber || "+63" + seededFaker.string.numeric(10),
        }
      : {
          gcashReferenceNumber: null,
          gcashAccountName: null,
          gcashAccountNumber: null,
        };

  const bankData =
    paymentMethod === PAYMENT_METHODS.BANK_TRANSFER
      ? {
          bankName: overrides?.bankName || seededFaker.helpers.arrayElement(PHILIPPINE_BANKS),
          bankAccountNumber: overrides?.bankAccountNumber || generateBankAccountNumber(seededFaker),
          bankAccountName: overrides?.bankAccountName || seededFaker.person.fullName(),
        }
      : {
          bankName: null,
          bankAccountNumber: null,
          bankAccountName: null,
        };

  const paymentData: PaymentInput = {
    id: overrides?.id || `payment-test-${paymentIdCounter++}`,
    bookingId:
      overrides?.bookingId || `booking-test-${seededFaker.number.int({ min: 1, max: 100 })}`,
    paymentCode: generatePaymentCode(),
    amount:
      overrides?.amount ||
      seededFaker.number.float({ min: 1000, max: 50000, fractionDigits: 2 }).toString(),
    paymentMethod,
    paymentType:
      overrides?.paymentType || seededFaker.helpers.arrayElement(["deposit", "partial", "full"]),
    transactionId: overrides?.transactionId || generateTransactionId(paymentMethod, seededFaker),
    referenceNumber:
      overrides?.referenceNumber || seededFaker.string.alphanumeric(12).toUpperCase(),
    ...gcashData,
    ...bankData,
    status: overrides?.status || PAYMENT_STATUS.VERIFIED,
    verifiedAt: seededFaker.date.recent().toISOString(),
    verifiedBy: "user-test-admin",
    receiptNumber: `RCP-${seededFaker.string.alphanumeric(8).toUpperCase()}`,
    receiptUrl:
      overrides?.receiptUrl ||
      `https://storage.example.com/receipts/${seededFaker.string.uuid()}.pdf`,
    notes: overrides?.notes || seededFaker.lorem.sentence(),
    failureReason: null,
    metadata: {
      generatedBy: "test-factory",
      seed: overrides?.seed || "default",
      paymentMethod,
    },
    processedBy: "user-test-processor",
    createdAt: seededFaker.date.recent().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Validate with Zod schema
  const validated = PaymentSchema.parse(paymentData);
  return validated;
}

/**
 * Create payment data for creation (subset of full payment)
 */
export function createPaymentData(overrides?: PaymentFactoryOptions): CreatePaymentInput {
  const fullPayment = createPayment(overrides);

  const createData: CreatePaymentInput = {
    bookingId: fullPayment.bookingId,
    amount: fullPayment.amount,
    paymentMethod: fullPayment.paymentMethod,
    paymentType: fullPayment.paymentType,
    transactionId: fullPayment.transactionId,
    referenceNumber: fullPayment.referenceNumber,
    gcashReferenceNumber: fullPayment.gcashReferenceNumber,
    gcashAccountName: fullPayment.gcashAccountName,
    gcashAccountNumber: fullPayment.gcashAccountNumber,
    bankName: fullPayment.bankName,
    bankAccountNumber: fullPayment.bankAccountNumber,
    bankAccountName: fullPayment.bankAccountName,
    receiptNumber: fullPayment.receiptNumber,
    receiptUrl: fullPayment.receiptUrl,
    notes: fullPayment.notes,
  };

  // Validate with creation schema
  const validated = CreatePaymentSchema.parse(createData);
  return validated;
}

/**
 * Create multiple payments for a booking
 */
export function createPaymentsForBooking(
  bookingId: string,
  totalAmount: number,
  paymentPlan: "full" | "deposit" | "installments",
  overrides?: PaymentFactoryOptions
): PaymentInput[] {
  const payments: PaymentInput[] = [];

  switch (paymentPlan) {
    case "full":
      payments.push(
        createPayment({
          ...overrides,
          bookingId,
          amount: totalAmount.toFixed(2),
          paymentType: "full",
          seed: `${bookingId}-full`,
        })
      );
      break;

    case "deposit":
      const depositAmount = totalAmount * 0.3; // 30% deposit
      const balanceAmount = totalAmount - depositAmount;

      payments.push(
        createPayment({
          ...overrides,
          bookingId,
          amount: depositAmount.toFixed(2),
          paymentType: "deposit",
          seed: `${bookingId}-deposit`,
        })
      );

      // Optionally add balance payment
      if (faker.datatype.boolean({ probability: 0.7 })) {
        payments.push(
          createPayment({
            ...overrides,
            bookingId,
            amount: balanceAmount.toFixed(2),
            paymentType: "partial",
            seed: `${bookingId}-balance`,
          })
        );
      }
      break;

    case "installments":
      const installmentCount = faker.number.int({ min: 2, max: 4 });
      const installmentAmount = totalAmount / installmentCount;

      for (let i = 0; i < installmentCount; i++) {
        const isLast = i === installmentCount - 1;
        const amount = isLast
          ? (totalAmount - installmentAmount * i).toFixed(2) // Adjust last payment for rounding
          : installmentAmount.toFixed(2);

        payments.push(
          createPayment({
            ...overrides,
            bookingId,
            amount,
            paymentType: i === 0 ? "deposit" : "partial",
            seed: `${bookingId}-installment-${i}`,
          })
        );
      }
      break;
  }

  return payments;
}

/**
 * Create specific payment scenarios for testing
 */
export const paymentScenarios = {
  // GCash payment
  gcashPayment: (overrides?: PaymentFactoryOptions): PaymentInput =>
    createPayment({
      ...overrides,
      paymentMethod: PAYMENT_METHODS.GCASH,
      gcashReferenceNumber: generateGCashReference(),
      gcashAccountName: "Juan Dela Cruz",
      gcashAccountNumber: "+639171234567",
    }),

  // Bank transfer payment
  bankTransfer: (overrides?: PaymentFactoryOptions): PaymentInput =>
    createPayment({
      ...overrides,
      paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
      bankName: "BPI (Bank of the Philippine Islands)",
      bankAccountNumber: "1234567890",
      bankAccountName: "Maria Santos",
    }),

  // Cash payment
  cashPayment: (overrides?: PaymentFactoryOptions): PaymentInput =>
    createPayment({
      ...overrides,
      paymentMethod: PAYMENT_METHODS.CASH,
      transactionId: null,
      referenceNumber: null,
    }),

  // Failed payment
  failedPayment: (overrides?: PaymentFactoryOptions): PaymentInput =>
    createPayment({
      ...overrides,
      status: PAYMENT_STATUS.FAILED,
      failureReason: "Insufficient funds",
      verifiedAt: null,
      verifiedBy: null,
    }),

  // Pending payment
  pendingPayment: (overrides?: PaymentFactoryOptions): PaymentInput =>
    createPayment({
      ...overrides,
      status: PAYMENT_STATUS.PENDING,
      verifiedAt: null,
      verifiedBy: null,
    }),

  // Refund payment
  refundPayment: (overrides?: PaymentFactoryOptions): PaymentInput =>
    createPayment({
      ...overrides,
      paymentType: "refund",
      status: PAYMENT_STATUS.VERIFIED,
      notes: "Booking cancellation refund",
    }),

  // High-value payment
  highValuePayment: (overrides?: PaymentFactoryOptions): PaymentInput =>
    createPayment({
      ...overrides,
      amount: faker.number.float({ min: 100000, max: 500000, fractionDigits: 2 }).toString(),
      paymentType: "full",
      paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
    }),

  // Partial payment
  partialPayment: (overrides?: PaymentFactoryOptions): PaymentInput =>
    createPayment({
      ...overrides,
      paymentType: "partial",
      amount: faker.number.float({ min: 5000, max: 20000, fractionDigits: 2 }).toString(),
    }),
};

/**
 * Create payments for a specific date range
 */
export function createPaymentsInRange(
  startDate: string,
  endDate: string,
  count: number,
  overrides?: PaymentFactoryOptions
): PaymentInput[] {
  const payments: PaymentInput[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let i = 0; i < count; i++) {
    const randomDate = faker.date.between({ from: start, to: end });

    const payment = createPayment({
      ...overrides,
      seed: `range-${i}`,
      // Override createdAt in the returned object
      ...{ createdAt: randomDate.toISOString() },
    });

    // Update createdAt after creation
    payment.createdAt = randomDate.toISOString();

    payments.push(payment);
  }

  return payments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * Reset payment ID counter for consistent testing
 */
export function resetPaymentIdCounter(): void {
  paymentIdCounter = 1;
  faker.seed(789); // Reset faker seed
}

/**
 * Calculate total payments for a given array
 */
export function calculateTotalPayments(payments: PaymentInput[]): number {
  return payments
    .filter((p) => p.status === PAYMENT_STATUS.VERIFIED)
    .reduce((total, payment) => total + parseFloat(payment.amount), 0);
}

/**
 * Group payments by method for analytics
 */
export function groupPaymentsByMethod(payments: PaymentInput[]): Record<string, PaymentInput[]> {
  return payments.reduce(
    (groups, payment) => {
      const method = payment.paymentMethod;
      if (!groups[method]) {
        groups[method] = [];
      }
      groups[method].push(payment);
      return groups;
    },
    {} as Record<string, PaymentInput[]>
  );
}

/**
 * Calculate payment success rate
 */
export function calculatePaymentSuccessRate(payments: PaymentInput[]): number {
  if (payments.length === 0) return 0;

  const successfulPayments = payments.filter((p) => p.status === PAYMENT_STATUS.VERIFIED);
  return (successfulPayments.length / payments.length) * 100;
}

/**
 * Create reconciliation data for testing payment matching
 */
export function createReconciliationData(payments: PaymentInput[]): Array<{
  referenceNumber: string;
  amount: string;
  date: string;
  method: string;
  matched: boolean;
}> {
  return payments.map((payment) => ({
    referenceNumber: payment.referenceNumber || "",
    amount: payment.amount,
    date: payment.createdAt.split("T")[0],
    method: payment.paymentMethod,
    matched: faker.datatype.boolean({ probability: 0.9 }), // 90% match rate
  }));
}
