/**
 * Commission Management Type Definitions
 *
 * Handles OTA commissions, payment gateway fees, travel agency commissions,
 * and referral programs with tiered structures and settlement batches.
 */

import { Decimal } from "decimal.js";

/**
 * Online Travel Agency (OTA) platforms
 */
export enum OTAPlatform {
  BOOKING_COM = "BOOKING_COM",
  AGODA = "AGODA",
  AIRBNB = "AIRBNB",
  EXPEDIA = "EXPEDIA",
  HOTELS_COM = "HOTELS_COM",
  TRIP_COM = "TRIP_COM",
  TRAVELOKA = "TRAVELOKA",
  KLOOK = "KLOOK",
  DIRECT = "DIRECT",
  OTHER = "OTHER",
}

/**
 * Payment gateway providers
 */
export enum PaymentGateway {
  PAYMAYA = "PAYMAYA",
  GCASH = "GCASH",
  PAYPAL = "PAYPAL",
  STRIPE = "STRIPE",
  DRAGONPAY = "DRAGONPAY",
  XENDIT = "XENDIT",
  PAYMONGO = "PAYMONGO",
  BANK_TRANSFER = "BANK_TRANSFER",
  CASH = "CASH",
}

/**
 * Commission types
 */
export enum CommissionType {
  OTA_COMMISSION = "OTA_COMMISSION",
  PAYMENT_GATEWAY_FEE = "PAYMENT_GATEWAY_FEE",
  TRAVEL_AGENCY = "TRAVEL_AGENCY",
  REFERRAL = "REFERRAL",
  AFFILIATE = "AFFILIATE",
  CORPORATE = "CORPORATE",
  GROUP_BOOKING = "GROUP_BOOKING",
  LOYALTY_PROGRAM = "LOYALTY_PROGRAM",
}

/**
 * Commission calculation method
 */
export enum CommissionMethod {
  PERCENTAGE = "PERCENTAGE",
  FIXED_AMOUNT = "FIXED_AMOUNT",
  TIERED = "TIERED",
  VOLUME_BASED = "VOLUME_BASED",
  HYBRID = "HYBRID",
}

/**
 * Settlement status for commission batches
 */
export enum SettlementStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SETTLED = "SETTLED",
  PARTIALLY_SETTLED = "PARTIALLY_SETTLED",
  DISPUTED = "DISPUTED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

/**
 * Reconciliation status
 */
export enum ReconciliationStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  MATCHED = "MATCHED",
  MISMATCHED = "MISMATCHED",
  DISPUTED = "DISPUTED",
  RESOLVED = "RESOLVED",
  ESCALATED = "ESCALATED",
}

/**
 * OTA commission structure
 */
export interface OTACommissionStructure {
  platform: OTAPlatform;
  baseCommissionRate: Decimal; // Base percentage (e.g., 15% = 0.15)
  hostFeeRate?: Decimal; // Additional host fee (e.g., Airbnb 3% = 0.03)
  guestFeeRate?: Decimal; // Guest service fee if applicable
  minimumCommission?: Decimal; // Minimum commission amount in PHP
  maximumCommission?: Decimal; // Maximum commission cap if any
  effectiveFrom: Date;
  effectiveTo?: Date;
  specialRates?: TieredCommissionRate[]; // Volume-based or promotional rates
  notes?: string;
}

/**
 * Payment gateway fee structure
 */
export interface PaymentGatewayFeeStructure {
  gateway: PaymentGateway;
  domesticCardRate: Decimal; // Percentage for domestic cards
  internationalCardRate: Decimal; // Percentage for international cards
  ewalletRate: Decimal; // Rate for e-wallet transactions
  bankTransferRate: Decimal; // Rate for bank transfers
  fixedFee: Decimal; // Fixed transaction fee in PHP
  minimumFee?: Decimal; // Minimum fee per transaction
  maximumFee?: Decimal; // Maximum fee cap
  settlementPeriodDays: number; // Days to settlement
  chargebackFee: Decimal; // Fee for chargebacks
  refundFee: Decimal; // Fee for processing refunds
  monthlyFee?: Decimal; // Monthly service fee if any
  effectiveFrom: Date;
  effectiveTo?: Date;
}

/**
 * Tiered commission rate structure
 */
export interface TieredCommissionRate {
  tier: number;
  minAmount?: Decimal; // Minimum booking amount for this tier
  maxAmount?: Decimal; // Maximum booking amount for this tier
  minVolume?: number; // Minimum number of bookings
  maxVolume?: number; // Maximum number of bookings
  rate: Decimal; // Commission rate for this tier
  fixedAmount?: Decimal; // Fixed amount component if hybrid
  description?: string;
}

/**
 * Travel agency commission agreement
 */
export interface TravelAgencyCommission {
  agencyId: string;
  agencyName: string;
  agencyType: "RETAIL" | "WHOLESALE" | "ONLINE" | "CORPORATE";
  commissionType: CommissionMethod;
  baseRate: Decimal; // Base commission percentage
  tieredRates?: TieredCommissionRate[];
  contractStartDate: Date;
  contractEndDate?: Date;
  paymentTermsDays: number; // Net payment terms
  minimumBookingValue?: Decimal;
  exclusions?: string[]; // Excluded room types or packages
  specialConditions?: string;
  isActive: boolean;
}

/**
 * Referral fee structure
 */
export interface ReferralFeeStructure {
  referrerId: string;
  referrerType: "INDIVIDUAL" | "COMPANY" | "INFLUENCER" | "PARTNER";
  referrerName: string;
  commissionType: CommissionMethod;
  rate: Decimal; // Percentage or fixed amount
  tieredRates?: TieredCommissionRate[];
  lifetimeValue?: boolean; // Commission on repeat bookings
  cookieDurationDays?: number; // Attribution window
  minimumBookingValue?: Decimal;
  maximumCommissionPerPeriod?: Decimal;
  paymentSchedule: "IMMEDIATE" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
  effectiveFrom: Date;
  effectiveTo?: Date;
  termsAndConditions?: string;
}

/**
 * Commission calculation result
 */
export interface CommissionCalculation {
  bookingId: string;
  grossAmount: Decimal; // Total booking amount
  commissionType: CommissionType;
  commissionRate: Decimal; // Applied rate
  commissionAmount: Decimal; // Calculated commission
  netAmount: Decimal; // Amount after commission
  platformFees?: Decimal; // Additional platform fees
  paymentGatewayFees?: Decimal; // Payment processing fees
  taxes?: Decimal; // Taxes on commission if applicable
  currency: string;
  exchangeRate?: Decimal; // If foreign currency
  calculatedAt: Date;
  notes?: string;
}

/**
 * Commission settlement batch
 */
export interface CommissionSettlementBatch {
  batchId: string;
  batchNumber: string; // Sequential batch number
  settlementDate: Date;
  platform?: OTAPlatform;
  gateway?: PaymentGateway;
  agencyId?: string;
  referrerId?: string;
  totalBookings: number;
  grossRevenue: Decimal;
  totalCommission: Decimal;
  totalFees: Decimal;
  netAmount: Decimal;
  status: SettlementStatus;
  processedAt?: Date;
  settledAt?: Date;
  paymentReference?: string;
  bankAccountId?: string;
  reconciliationStatus?: ReconciliationStatus;
  discrepancies?: CommissionDiscrepancy[];
  attachments?: SettlementAttachment[];
  notes?: string;
}

/**
 * Commission discrepancy during reconciliation
 */
export interface CommissionDiscrepancy {
  discrepancyId: string;
  batchId: string;
  bookingId: string;
  expectedAmount: Decimal;
  actualAmount: Decimal;
  variance: Decimal;
  reason?: string;
  status: "PENDING" | "INVESTIGATING" | "RESOLVED" | "DISPUTED" | "WRITTEN_OFF";
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

/**
 * Settlement attachment documents
 */
export interface SettlementAttachment {
  attachmentId: string;
  batchId: string;
  fileName: string;
  fileType: "STATEMENT" | "INVOICE" | "RECEIPT" | "REPORT" | "OTHER";
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: string;
}

/**
 * Commission reconciliation record
 */
export interface CommissionReconciliation {
  reconciliationId: string;
  batchId: string;
  platform?: OTAPlatform;
  gateway?: PaymentGateway;
  periodStart: Date;
  periodEnd: Date;
  status: ReconciliationStatus;
  platformReportedRevenue: Decimal;
  systemCalculatedRevenue: Decimal;
  platformReportedCommission: Decimal;
  systemCalculatedCommission: Decimal;
  revenueVariance: Decimal;
  commissionVariance: Decimal;
  matchedTransactions: number;
  unmatchedTransactions: number;
  disputedTransactions: number;
  reconciledAt?: Date;
  reconciledBy?: string;
  notes?: string;
  supportingDocuments?: SettlementAttachment[];
}

/**
 * Commission summary for reporting
 */
export interface CommissionSummary {
  periodStart: Date;
  periodEnd: Date;
  totalBookings: number;
  grossRevenue: Decimal;
  commissionsByType: {
    type: CommissionType;
    count: number;
    amount: Decimal;
    percentage: Decimal;
  }[];
  commissionsByPlatform?: {
    platform: OTAPlatform;
    count: number;
    revenue: Decimal;
    commission: Decimal;
    netRevenue: Decimal;
  }[];
  paymentGatewayFees?: {
    gateway: PaymentGateway;
    transactionCount: number;
    totalFees: Decimal;
  }[];
  totalCommissions: Decimal;
  totalFees: Decimal;
  netRevenue: Decimal;
  averageCommissionRate: Decimal;
  topReferrers?: {
    referrerId: string;
    referrerName: string;
    bookings: number;
    revenue: Decimal;
    commission: Decimal;
  }[];
}

/**
 * Commission payout record
 */
export interface CommissionPayout {
  payoutId: string;
  payoutDate: Date;
  recipientId: string;
  recipientType: "AGENCY" | "REFERRER" | "AFFILIATE" | "PARTNER";
  recipientName: string;
  periodStart: Date;
  periodEnd: Date;
  totalBookings: number;
  grossRevenue: Decimal;
  commissionAmount: Decimal;
  deductions?: Decimal; // Any deductions or adjustments
  netPayoutAmount: Decimal;
  paymentMethod: "BANK_TRANSFER" | "CHECK" | "EWALLET" | "CREDIT_NOTE";
  paymentReference?: string;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
  };
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  processedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  attachments?: SettlementAttachment[];
}

/**
 * Commission adjustment record
 */
export interface CommissionAdjustment {
  adjustmentId: string;
  bookingId: string;
  originalCommission: Decimal;
  adjustmentAmount: Decimal;
  adjustedCommission: Decimal;
  reason: string;
  adjustmentType: "CORRECTION" | "WAIVER" | "PENALTY" | "BONUS" | "REFUND";
  approvedBy?: string;
  approvedAt?: Date;
  effectiveDate: Date;
  notes?: string;
}
