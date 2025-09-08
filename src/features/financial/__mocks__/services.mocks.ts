import { vi } from "vitest";
import { Money } from "@/lib/money";

/**
 * Service Mocks for Financial Module
 *
 * These mocks provide test doubles for external services used in financial operations,
 * including payment processors, banking services, and third-party integrations.
 */

// Payment Service Mock
export const mockPaymentService = {
  processPayment: vi.fn().mockResolvedValue({
    id: "payment-123",
    status: "completed",
    amount: new Money(5000),
    currency: "PHP",
    reference: "PAY-2025-001",
    processedAt: new Date(),
  }),

  validatePayment: vi.fn().mockResolvedValue({
    isValid: true,
    errors: [],
  }),

  refundPayment: vi.fn().mockResolvedValue({
    id: "refund-123",
    status: "completed",
    amount: new Money(5000),
    reference: "REF-2025-001",
    processedAt: new Date(),
  }),

  getPaymentStatus: vi.fn().mockResolvedValue({
    status: "completed",
    lastUpdated: new Date(),
  }),

  processGCashPayment: vi.fn().mockResolvedValue({
    id: "gcash-123",
    status: "completed",
    amount: new Money(5000),
    reference: "GC-2025-001",
    gcashReference: "1234567890123",
    processedAt: new Date(),
  }),

  processCreditCardPayment: vi.fn().mockResolvedValue({
    id: "card-123",
    status: "completed",
    amount: new Money(5000),
    reference: "CC-2025-001",
    cardLast4: "1234",
    cardType: "Visa",
    processedAt: new Date(),
  }),

  processBankTransfer: vi.fn().mockResolvedValue({
    id: "bank-123",
    status: "completed",
    amount: new Money(5000),
    reference: "BT-2025-001",
    bankReference: "TRF123456789",
    processedAt: new Date(),
  }),
};

// Banking Service Mock
export const mockBankingService = {
  validateBankAccount: vi.fn().mockResolvedValue({
    isValid: true,
    accountName: "Okaeri Resort",
    bankName: "BDO Unibank",
  }),

  processInstaPay: vi.fn().mockResolvedValue({
    id: "instapay-123",
    status: "completed",
    amount: new Money(15000),
    reference: "IP-2025-001",
    senderBank: "BDO",
    receiverBank: "BPI",
    processedAt: new Date(),
  }),

  processPESONet: vi.fn().mockResolvedValue({
    id: "pesonet-123",
    status: "pending",
    amount: new Money(125000),
    reference: "PN-2025-001",
    batchId: "BATCH-2025-001",
    expectedSettlement: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 day
  }),

  processWireTransfer: vi.fn().mockResolvedValue({
    id: "wire-123",
    status: "completed",
    amount: new Money(250000),
    reference: "WIRE-2025-001",
    swiftCode: "BOPIPHMM",
    processedAt: new Date(),
  }),

  getBankStatement: vi.fn().mockResolvedValue([
    {
      date: new Date(),
      description: "Deposit - Room Payment",
      amount: new Money(5000),
      balance: new Money(125000),
      reference: "DEP-2025-001",
    },
  ]),

  reconcileTransactions: vi.fn().mockResolvedValue({
    matched: 15,
    unmatched: 0,
    discrepancies: [],
    totalAmount: new Money(145000),
  }),
};

// Payment Gateway Mocks
export const mockPayMongoService = {
  createPaymentIntent: vi.fn().mockResolvedValue({
    id: "pi_123",
    status: "requires_payment_method",
    amount: new Money(6750),
    currency: "PHP",
    clientSecret: "pi_123_secret",
  }),

  confirmPayment: vi.fn().mockResolvedValue({
    id: "pi_123",
    status: "succeeded",
    amount: new Money(6750),
    paymentMethod: {
      type: "card",
      last4: "1234",
      brand: "visa",
    },
  }),

  processRefund: vi.fn().mockResolvedValue({
    id: "re_123",
    status: "succeeded",
    amount: new Money(6750),
    refundId: "re_123",
  }),
};

export const mockDragonPayService = {
  createPaymentRequest: vi.fn().mockResolvedValue({
    referenceNumber: "DP123456789",
    paymentUrl: "https://test.dragonpay.ph/Pay.aspx?tokenid=TEST123",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 day
  }),

  checkPaymentStatus: vi.fn().mockResolvedValue({
    status: "S", // Success
    amount: new Money(7500),
    processedAt: new Date(),
  }),

  processRefund: vi.fn().mockResolvedValue({
    refundId: "DP_REF_123",
    status: "processing",
    amount: new Money(7500),
  }),
};

export const mockPayPalService = {
  createOrder: vi.fn().mockResolvedValue({
    id: "ORDER_123",
    status: "CREATED",
    amount: { value: "150.00", currency_code: "USD" },
    links: [
      {
        href: "https://sandbox.paypal.com/checkoutnow?token=ORDER_123",
        rel: "approve",
      },
    ],
  }),

  captureOrder: vi.fn().mockResolvedValue({
    id: "ORDER_123",
    status: "COMPLETED",
    purchase_units: [
      {
        payments: {
          captures: [
            {
              id: "CAPTURE_123",
              status: "COMPLETED",
              amount: { value: "150.00", currency_code: "USD" },
            },
          ],
        },
      },
    ],
  }),

  refundPayment: vi.fn().mockResolvedValue({
    id: "REFUND_123",
    status: "COMPLETED",
    amount: { value: "50.00", currency_code: "USD" },
  }),
};

// Check Processing Mock
export const mockCheckService = {
  validateCheck: vi.fn().mockResolvedValue({
    isValid: true,
    checkNumber: "123456",
    bankName: "BDO Unibank",
    accountNumber: "123456789",
    amount: new Money(12500),
  }),

  processCheck: vi.fn().mockResolvedValue({
    id: "check-123",
    status: "pending_clearance",
    checkNumber: "123456",
    amount: new Money(12500),
    expectedClearance: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 days
  }),

  checkClearanceStatus: vi.fn().mockResolvedValue({
    status: "cleared",
    clearedAt: new Date(),
    bankReference: "CLR123456789",
  }),

  handleBouncedCheck: vi.fn().mockResolvedValue({
    status: "bounced",
    reason: "Insufficient Funds",
    penaltyAmount: new Money(200),
    returnFee: new Money(100),
  }),
};

// Currency Service Mock
export const mockCurrencyService = {
  getExchangeRate: vi.fn().mockResolvedValue({
    from: "USD",
    to: "PHP",
    rate: 55.75,
    timestamp: new Date(),
  }),

  convertCurrency: vi
    .fn()
    .mockImplementation((amount: Money, fromCurrency: string, toCurrency: string, rate: number) => {
      return amount.multiply(rate);
    }),

  getSupportedCurrencies: vi.fn().mockResolvedValue([
    { code: "PHP", name: "Philippine Peso", symbol: "₱" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  ]),
};

// Reconciliation Service Mock
export const mockReconciliationService = {
  reconcileDaily: vi.fn().mockResolvedValue({
    date: new Date(),
    totalRevenue: new Money(162000),
    paymentBreakdown: {
      cash: new Money(45000),
      creditCard: new Money(85000),
      digital: new Money(32000),
    },
    discrepancies: [],
    isBalanced: true,
  }),

  generateDailyReport: vi.fn().mockResolvedValue({
    reportId: "DAILY-2025-001",
    date: new Date(),
    transactions: 150,
    totalAmount: new Money(162000),
    reportUrl: "/reports/daily/2025-001.pdf",
  }),

  identifyDiscrepancies: vi.fn().mockResolvedValue([
    {
      type: "amount_mismatch",
      expected: new Money(1000),
      actual: new Money(950),
      difference: new Money(-50),
      reference: "TXN-2025-001",
    },
  ]),
};

/**
 * Reset all mocks to initial state
 */
export const resetAllServiceMocks = () => {
  Object.values(mockPaymentService).forEach((mock) => mock.mockReset?.());
  Object.values(mockBankingService).forEach((mock) => mock.mockReset?.());
  Object.values(mockPayMongoService).forEach((mock) => mock.mockReset?.());
  Object.values(mockDragonPayService).forEach((mock) => mock.mockReset?.());
  Object.values(mockPayPalService).forEach((mock) => mock.mockReset?.());
  Object.values(mockCheckService).forEach((mock) => mock.mockReset?.());
  Object.values(mockCurrencyService).forEach((mock) => mock.mockReset?.());
  Object.values(mockReconciliationService).forEach((mock) => mock.mockReset?.());
};

/**
 * Set up default mock implementations for common scenarios
 */
export const setupDefaultMocks = () => {
  // Setup successful payment scenarios by default
  mockPaymentService.processPayment.mockResolvedValue({
    id: "payment-success",
    status: "completed",
    amount: new Money(5000),
    currency: "PHP",
    reference: "PAY-SUCCESS",
    processedAt: new Date(),
  });

  // Setup successful banking operations
  mockBankingService.validateBankAccount.mockResolvedValue({
    isValid: true,
    accountName: "Test Account",
    bankName: "Test Bank",
  });

  // Setup successful currency conversion
  mockCurrencyService.getExchangeRate.mockResolvedValue({
    from: "USD",
    to: "PHP",
    rate: 55.5,
    timestamp: new Date(),
  });
};

/**
 * Set up mock error scenarios for testing failure cases
 */
export const setupErrorMocks = () => {
  mockPaymentService.processPayment.mockRejectedValue(new Error("Payment processing failed"));

  mockBankingService.processInstaPay.mockRejectedValue(new Error("InstaPay service unavailable"));

  mockPayMongoService.confirmPayment.mockResolvedValue({
    id: "pi_failed",
    status: "failed",
    amount: new Money(0),
    error: "Card was declined",
  });
};
