/**
 * Payment Processing Type Definitions
 * Phase 4.2: Income Management Testing (RED Phase)
 *
 * Comprehensive payment types for Philippine resort operations
 * including multiple payment methods, gateways, and reconciliation.
 */

import { Decimal } from "decimal.js";

// ============================================================================
// Payment Method Types
// ============================================================================

/**
 * Supported payment methods in the Philippines
 */
export enum PaymentMethod {
  CASH = "CASH",
  GCASH = "GCASH",
  PAYMAYA = "PAYMAYA",
  BANK_TRANSFER = "BANK_TRANSFER",
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
  PAYMONGO = "PAYMONGO",
  PAYPAL = "PAYPAL",
  DRAGONPAY = "DRAGONPAY",
  CHECK = "CHECK",
  CRYPTO_COINS_PH = "CRYPTO_COINS_PH",
  GRABPAY = "GRABPAY",
  INSTALLMENT = "INSTALLMENT",
  VOUCHER = "VOUCHER",
  WIRE_TRANSFER = "WIRE_TRANSFER",
}

/**
 * Philippine banks for transfers
 */
export enum BankName {
  BDO = "BDO",
  BPI = "BPI",
  METROBANK = "METROBANK",
  UNIONBANK = "UNIONBANK",
  LANDBANK = "LANDBANK",
  PNB = "PNB",
  SECURITY_BANK = "SECURITY_BANK",
  RCBC = "RCBC",
  CHINABANK = "CHINABANK",
  EWB = "EWB", // EastWest Bank
  AUB = "AUB", // Asia United Bank
  PSB = "PSB", // Philippine Savings Bank
  OTHER = "OTHER",
}

/**
 * Payment status tracking
 */
export enum PaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  EXPIRED = "EXPIRED",
  ON_HOLD = "ON_HOLD",
  DISPUTED = "DISPUTED",
}

/**
 * Payment gateway providers
 */
export enum PaymentGateway {
  PAYMONGO = "PAYMONGO",
  PAYPAL = "PAYPAL",
  DRAGONPAY = "DRAGONPAY",
  XENDIT = "XENDIT",
  PAYNAMICS = "PAYNAMICS",
  PESOPAY = "PESOPAY",
  COINS_PH = "COINS_PH",
  MANUAL = "MANUAL", // For cash, check, bank transfers
}

/**
 * Bank transfer types in Philippines
 */
export enum TransferType {
  INSTAPAY = "INSTAPAY", // Real-time, up to PHP 50,000
  PESONET = "PESONET", // Batch processing, no limit
  RTGS = "RTGS", // Real-time gross settlement
  MANUAL = "MANUAL", // Manual/over-the-counter
  ONLINE = "ONLINE", // Online banking transfer
}

/**
 * Core payment transaction interface
 */
export interface PaymentTransaction {
  id: string;
  projectId: string;
  paymentCode: string;

  // Related income
  incomeTransactionId?: string;
  bookingId?: string;

  // Payment details
  paymentMethod: PaymentMethod;
  amount: Decimal;
  currency: string; // ISO 4217

  // Gateway details
  gatewayProvider?: PaymentGateway;
  gatewayTransactionId?: string;
  gatewayStatus?: string;
  gatewayResponse?: Record<string, any>;
  gatewayFee?: Decimal;

  // Method-specific fields
  referenceNumber?: string; // GCash, bank reference
  accountNumber?: string;
  accountName?: string;
  bankName?: BankName;
  transferType?: TransferType;

  // Status tracking
  status: PaymentStatus;
  processedAt?: Date;
  failureReason?: string;

  // Audit
  receivedBy?: string; // Staff who received payment
  createdAt: Date;
  updatedAt: Date;

  // Metadata
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Cash payment details
 */
export interface CashPayment {
  paymentId: string;

  // Denominations received
  denominations: {
    PHP1000?: number;
    PHP500?: number;
    PHP200?: number;
    PHP100?: number;
    PHP50?: number;
    PHP20?: number;
    PHP10?: number;
    PHP5?: number;
    PHP1?: number;
    CENTS?: Decimal;
  };

  totalReceived: Decimal;
  amountDue: Decimal;
  changeGiven: Decimal;

  // Change denominations
  changeDenominations?: {
    PHP1000?: number;
    PHP500?: number;
    PHP200?: number;
    PHP100?: number;
    PHP50?: number;
    PHP20?: number;
    PHP10?: number;
    PHP5?: number;
    PHP1?: number;
    CENTS?: Decimal;
  };

  cashierDrawer?: string;
  shiftId?: string;
}

/**
 * GCash payment details
 */
export interface GCashPayment {
  paymentId: string;

  referenceNumber: string; // 13-digit reference
  senderNumber: string;
  senderName: string;

  amount: Decimal;

  verificationStatus: "PENDING" | "VERIFIED" | "FAILED";
  verifiedAt?: Date;
  verifiedBy?: string;

  screenshot?: string; // Receipt screenshot path
}

/**
 * Bank transfer payment details
 */
export interface BankTransferPayment {
  paymentId: string;

  bankName: BankName;
  accountNumber: string;
  accountName: string;

  transferType: TransferType;
  referenceNumber: string;

  amount: Decimal;

  depositSlip?: string; // Deposit slip image path

  clearanceStatus: "PENDING" | "CLEARING" | "CLEARED" | "FAILED";
  clearanceDays: number;
  expectedClearanceDate: Date;
  actualClearanceDate?: Date;

  verifiedBy?: string;
  verifiedAt?: Date;
}

/**
 * Credit/Debit card payment details
 */
export interface CardPayment {
  paymentId: string;

  cardType: "VISA" | "MASTERCARD" | "AMEX" | "JCB" | "DISCOVER" | "UNIONPAY";
  lastFourDigits: string;
  cardholderName?: string;

  authorizationCode?: string;
  transactionId: string;

  amount: Decimal;

  // Fees
  mdrRate: Decimal; // Merchant discount rate
  mdrFee: Decimal;
  netAmount: Decimal;

  // Settlement
  settlementDays: number;
  expectedSettlementDate: Date;
  actualSettlementDate?: Date;

  // 3D Secure
  is3DSecure?: boolean;
  threeDSecureStatus?: string;
}

/**
 * PayMongo specific payment details
 */
export interface PayMongoPayment {
  paymentId: string;

  paymentIntentId: string;
  paymentMethodId?: string;

  amount: Decimal; // In PHP

  paymentMethodType: "card" | "gcash" | "grab_pay" | "paymaya";

  // Fees
  percentageFee: Decimal; // 2.75%
  fixedFee: Decimal; // PHP 15
  totalFees: Decimal;
  netAmount: Decimal;

  // Webhook
  webhookStatus?: string;
  webhookReceivedAt?: Date;

  // 3D Secure for cards
  is3DSecure?: boolean;
  authenticationStatus?: string;
}

/**
 * Check payment details
 */
export interface CheckPayment {
  paymentId: string;

  checkNumber: string;
  bankName: BankName;
  accountName: string;

  amount: Decimal;

  checkDate: Date;
  isPostDated: boolean;

  clearingStatus: "PENDING" | "DEPOSITED" | "CLEARING" | "CLEARED" | "BOUNCED";
  clearingDays: number;
  depositDate?: Date;
  expectedClearanceDate: Date;
  actualClearanceDate?: Date;

  bouncedReason?: string;
  bouncedAt?: Date;
}

/**
 * Cryptocurrency payment via Coins.ph
 */
export interface CryptoPayment {
  paymentId: string;

  coinsPhTransactionId: string;
  walletAddress: string;

  cryptoCurrency: "BTC" | "ETH" | "USDT" | "USDC" | "XRP";
  cryptoAmount: Decimal;

  phpAmount: Decimal;
  exchangeRate: Decimal;

  // KYC
  kycStatus: "PENDING" | "VERIFIED" | "FAILED";
  kycDocuments?: string[];

  confirmations: number;
  requiredConfirmations: number;

  transactionHash?: string;
  confirmedAt?: Date;
}

/**
 * Payment installment plan
 */
export interface InstallmentPlan {
  id: string;
  paymentId: string;

  totalAmount: Decimal;
  downPayment: Decimal;

  numberOfInstallments: number;
  installmentAmount: Decimal;

  installments: InstallmentSchedule[];

  status: "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual installment schedule
 */
export interface InstallmentSchedule {
  installmentNumber: number;
  amount: Decimal;
  dueDate: Date;

  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

  paidAmount?: Decimal;
  paidAt?: Date;
  paymentReference?: string;

  lateFee?: Decimal;
  reminderSent?: boolean;
  reminderSentAt?: Date;
}

/**
 * Refund transaction
 */
export interface RefundTransaction {
  id: string;
  originalPaymentId: string;

  refundAmount: Decimal;
  refundReason: string;
  refundMethod: PaymentMethod;

  // For partial refunds
  isPartial: boolean;
  originalAmount: Decimal;
  previousRefunds?: Decimal;
  remainingAmount: Decimal;

  // Fees
  cancellationFee?: Decimal;
  processingFee?: Decimal;
  netRefundAmount: Decimal;

  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

  refundReference?: string;
  processedAt?: Date;
  estimatedCompletionDays?: number;

  approvedBy: string;
  approvedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment reconciliation
 */
export interface PaymentReconciliation {
  id: string;
  projectId: string;

  reconciliationDate: Date;
  reconciliationType: "DAILY" | "WEEKLY" | "MONTHLY";

  // Cash drawer
  cashDrawer?: {
    openingBalance: Decimal;
    cashSales: Decimal;
    cashPayouts: Decimal;
    expectedClosing: Decimal;
    actualCount: Decimal;
    variance: Decimal;
    varianceStatus: "OVER" | "SHORT" | "BALANCED";
  };

  // Bank deposits
  bankDeposits?: {
    expectedAmount: Decimal;
    actualDeposits: Decimal;
    pendingDeposits: Decimal;
    variance: Decimal;
  };

  // Digital wallets
  digitalWallets?: {
    [wallet: string]: {
      expectedAmount: Decimal;
      settledAmount: Decimal;
      pendingAmount: Decimal;
      fees: Decimal;
      netAmount: Decimal;
    };
  };

  // Overall status
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DISCREPANCY";
  discrepancies?: string[];

  reconciledBy: string;
  reconciledAt: Date;

  notes?: string;
  attachments?: string[];

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment gateway configuration
 */
export interface PaymentGatewayConfig {
  id: string;
  projectId: string;

  provider: PaymentGateway;
  isActive: boolean;
  isPrimary: boolean;

  // Credentials (encrypted)
  apiKey?: string;
  apiSecret?: string;
  merchantId?: string;
  webhookSecret?: string;

  // Configuration
  settings: {
    testMode: boolean;
    autoCapture: boolean;
    defaultCurrency: string;
    supportedCurrencies: string[];
    supportedMethods: PaymentMethod[];
  };

  // Fee structure
  fees: {
    fixedFee?: Decimal;
    percentageFee?: Decimal;
    internationalFee?: Decimal;
    conversionFee?: Decimal;
  };

  // Limits
  limits?: {
    minAmount?: Decimal;
    maxAmount?: Decimal;
    dailyLimit?: Decimal;
    monthlyLimit?: Decimal;
  };

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment security context
 */
export interface PaymentSecurityContext {
  // Encryption
  encryptionEnabled: boolean;
  encryptionAlgorithm: "AES-256-GCM" | "RSA-2048";

  // Tokenization
  tokenizationEnabled: boolean;
  tokenProvider: "PAYMONGO" | "INTERNAL";

  // Webhook validation
  webhookValidation: {
    enabled: boolean;
    signatureHeader: string;
    algorithm: "HMAC-SHA256" | "RSA-SHA256";
  };

  // Rate limiting
  rateLimiting: {
    enabled: boolean;
    maxAttemptsPerMinute: number;
    maxAttemptsPerHour: number;
    maxAmountPerDay: Decimal;
  };

  // Fraud detection
  fraudDetection: {
    enabled: boolean;
    velocityChecks: boolean;
    duplicateChecks: boolean;
    blacklistChecks: boolean;
  };

  // PCI compliance
  pciCompliant: boolean;
  pciLevel: 1 | 2 | 3 | 4;
  lastAuditDate?: Date;
}

/**
 * Payment idempotency for duplicate prevention
 */
export interface PaymentIdempotency {
  idempotencyKey: string;
  paymentId: string;

  requestHash: string;

  createdAt: Date;
  expiresAt: Date;
}

/**
 * Payment webhook event
 */
export interface PaymentWebhookEvent {
  id: string;
  provider: PaymentGateway;

  eventType: string;
  eventData: Record<string, any>;

  signature?: string;
  isValid: boolean;

  processedAt?: Date;
  processingStatus: "PENDING" | "PROCESSED" | "FAILED" | "IGNORED";

  retryCount: number;
  lastRetryAt?: Date;

  createdAt: Date;
}
