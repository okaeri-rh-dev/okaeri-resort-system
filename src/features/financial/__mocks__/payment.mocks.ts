import { Money } from "@/lib/money";

/**
 * Payment Mock Data
 *
 * This file provides mock data generators for payment processing tests,
 * covering various payment scenarios for the Philippine market.
 */

export interface MockPaymentData {
  id: string;
  amount: Money;
  currency: string;
  method: string;
  reference: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  createdAt: Date;
  processedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface MockTransactionData {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: Money;
  description: string;
  category: string;
  subcategory?: string;
  paymentData: MockPaymentData;
  createdAt: Date;
  projectId: string;
}

/**
 * Create mock payment data with Philippine payment methods
 */
export const createMockPaymentData = (overrides?: Partial<MockPaymentData>): MockPaymentData => {
  const baseData: MockPaymentData = {
    id: `payment-${Date.now()}`,
    amount: new Money(5000),
    currency: "PHP",
    method: "bank_transfer",
    reference: `PAY-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
    status: "completed",
    createdAt: new Date(),
    processedAt: new Date(),
    metadata: {
      processingFee: new Money(50),
      exchangeRate: 1.0,
    },
  };

  return { ...baseData, ...overrides };
};

/**
 * Create mock transaction data for income recording
 */
export const createMockTransactionData = (
  overrides?: Partial<MockTransactionData>
): MockTransactionData => {
  const paymentData = createMockPaymentData();

  const baseData: MockTransactionData = {
    id: `transaction-${Date.now()}`,
    type: "income",
    amount: new Money(7000),
    description: "Room booking payment",
    category: "accommodation",
    subcategory: "standard_room",
    paymentData,
    createdAt: new Date(),
    projectId: `proj-${Date.now()}`,
  };

  return { ...baseData, ...overrides };
};

/**
 * Philippine-specific payment method generators
 */
export const createGCashPayment = (amount: number = 5000): MockPaymentData => {
  return createMockPaymentData({
    method: "gcash",
    reference: `GC-${Date.now()}`,
    metadata: {
      gcashReference: String(Math.floor(Math.random() * 10000000000000)).padStart(13, "0"), // 13-digit GCash reference
      mobileNumber: "+639171234567",
      senderName: "Juan Dela Cruz",
    },
  });
};

export const createBDOPayment = (amount: number = 15000): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(amount),
    method: "instapay",
    reference: `IP-${Date.now()}`,
    metadata: {
      senderBank: "BDO",
      receiverBank: "BPI",
      bankReference: `BDO${Date.now()}`,
    },
  });
};

export const createPESONetPayment = (amount: number = 125000): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(amount),
    method: "pesonet",
    reference: `PN-${Date.now()}`,
    status: "pending", // PESONet typically takes 1-2 business days
    metadata: {
      batchId: `BATCH-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
      expectedSettlement: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 day
    },
  });
};

export const createCreditCardPayment = (amount: number = 6750): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(amount),
    method: "credit_card",
    reference: `CC-${Date.now()}`,
    metadata: {
      cardLast4: "1234",
      cardType: "Visa",
      authCode: `AUTH${Math.floor(Math.random() * 1000000)}`,
      processingFee: new Money(Math.floor(amount * 0.035)), // 3.5% processing fee
    },
  });
};

export const createPayPalPayment = (usdAmount: number = 150): MockPaymentData => {
  const exchangeRate = 55.5; // USD to PHP
  const phpAmount = usdAmount * exchangeRate;

  return createMockPaymentData({
    amount: new Money(phpAmount),
    method: "paypal",
    reference: `PP-${Date.now()}`,
    metadata: {
      originalAmount: usdAmount,
      originalCurrency: "USD",
      exchangeRate,
      paypalTransactionId: `PAY-${Math.random().toString(36).toUpperCase()}`,
    },
  });
};

export const createDragonPayPayment = (amount: number = 7500): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(amount),
    method: "dragonpay",
    reference: `DP-${Date.now()}`,
    metadata: {
      channel: "OTC", // Over-the-counter
      outlet: "7-Eleven",
      referenceNumber: `DP${String(Math.floor(Math.random() * 1000000000)).padStart(9, "0")}`,
    },
  });
};

export const createCashPayment = (amount: number = 3500): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(amount),
    method: "cash",
    reference: `CASH-${Date.now()}`,
    metadata: {
      cashTendered: new Money(amount + 500), // Customer gave extra
      change: new Money(500),
      denominations: {
        "1000": 3,
        "500": 1,
        "100": 0,
        "50": 0,
        "20": 0,
      },
    },
  });
};

export const createCheckPayment = (amount: number = 12500): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(amount),
    method: "check",
    reference: `CHK-${Date.now()}`,
    status: "pending", // Checks need to clear
    processedAt: undefined,
    metadata: {
      checkNumber: String(Math.floor(Math.random() * 1000000)),
      bankName: "BDO Unibank",
      accountNumber: "****-****-123",
      isPostDated: false,
      expectedClearance: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 days
    },
  });
};

/**
 * Special scenario payment generators
 */
export const createPartialPayment = (totalAmount: number, paidAmount: number): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(paidAmount),
    reference: `PARTIAL-${Date.now()}`,
    metadata: {
      totalAmount: new Money(totalAmount),
      remainingBalance: new Money(totalAmount - paidAmount),
      paymentType: "partial",
    },
  });
};

export const createRefundPayment = (
  originalAmount: number,
  refundAmount: number
): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(-refundAmount), // Negative for refund
    reference: `REF-${Date.now()}`,
    metadata: {
      originalAmount: new Money(originalAmount),
      refundReason: "Customer cancellation",
      originalPaymentId: `payment-${Date.now() - 86400000}`, // Yesterday
    },
  });
};

export const createMultiCurrencyPayment = (
  usdAmount: number,
  exchangeRate: number = 55.5
): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(usdAmount * exchangeRate),
    currency: "PHP",
    reference: `FX-${Date.now()}`,
    metadata: {
      originalAmount: usdAmount,
      originalCurrency: "USD",
      exchangeRate,
      fxProvider: "BSP",
      conversionDate: new Date(),
    },
  });
};

/**
 * Mock payment failure scenarios
 */
export const createFailedPayment = (
  amount: number = 5000,
  reason: string = "Insufficient funds"
): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(amount),
    status: "failed",
    processedAt: undefined,
    metadata: {
      failureReason: reason,
      errorCode: "INSUFFICIENT_FUNDS",
      retryCount: 1,
    },
  });
};

export const createTimeoutPayment = (amount: number = 5000): MockPaymentData => {
  return createMockPaymentData({
    amount: new Money(amount),
    status: "pending",
    processedAt: undefined,
    metadata: {
      timeoutReason: "Gateway timeout",
      retryAfter: new Date(Date.now() + 5 * 60 * 1000), // +5 minutes
    },
  });
};

/**
 * Batch payment generators for testing reconciliation
 */
export const createDailyPaymentBatch = (date: Date = new Date()): MockPaymentData[] => {
  const payments: MockPaymentData[] = [];

  // Morning payments
  payments.push(createCashPayment(3500));
  payments.push(createGCashPayment(4200));
  payments.push(createCreditCardPayment(6750));

  // Afternoon payments
  payments.push(createBDOPayment(15000));
  payments.push(createPayPalPayment(120));
  payments.push(createCashPayment(8000));

  // Evening payments
  payments.push(createCreditCardPayment(12500));
  payments.push(createGCashPayment(2800));
  payments.push(createDragonPayPayment(5500));

  // Set all payments to the same date
  payments.forEach((payment, index) => {
    const paymentDate = new Date(date);
    paymentDate.setHours(8 + index * 2, Math.floor(Math.random() * 60)); // Spread throughout day
    payment.createdAt = paymentDate;
    payment.processedAt = paymentDate;
  });

  return payments;
};

/**
 * Generate test data for specific scenarios
 */
export const generateTestScenarios = () => {
  return {
    // Peak season payments with premium rates
    peakSeason: {
      christmasBooking: createCreditCardPayment(9000), // 50% premium
      newYearBooking: createBDOPayment(10500), // 75% premium
      holyWeekBooking: createGCashPayment(8400), // 40% premium
    },

    // Low season with discounts
    lowSeason: {
      rainySeasonBooking: createCashPayment(4500), // 25% discount
      weekdayBooking: createCreditCardPayment(4800), // 20% discount
      earlyBirdBooking: createBDOPayment(5100), // 15% discount
    },

    // Group bookings
    groupBookings: {
      corporateGroup: createCheckPayment(85000), // 25 rooms
      weddingGroup: createBDOPayment(150000), // Wedding package
      tourGroup: createCreditCardPayment(48000), // 15 rooms
    },

    // Special payments
    specialCases: {
      vipComplimentary: createCashPayment(0), // Comp room
      loyaltyPoints: createPartialPayment(8000, 5000), // Points + cash
      serviceFee: createRefundPayment(10000, 1500), // Cancellation fee
    },
  };
};
