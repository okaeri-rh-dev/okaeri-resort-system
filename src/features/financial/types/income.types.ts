/**
 * Income Management Type Definitions
 * Phase 4.2: Income Management Testing (RED Phase)
 *
 * Comprehensive type definitions for Philippine resort income management
 * including room bookings, service revenue, payments, and compliance.
 */

import { Decimal } from "decimal.js";

// ============================================================================
// Core Income Types
// ============================================================================

/**
 * Income transaction types for resort operations
 */
export enum IncomeType {
  ROOM_BOOKING = "ROOM_BOOKING",
  SERVICE = "SERVICE",
  FOOD_BEVERAGE = "FOOD_BEVERAGE",
  PACKAGE = "PACKAGE",
  DAY_USE = "DAY_USE",
  EQUIPMENT_RENTAL = "EQUIPMENT_RENTAL",
  EVENT_VENUE = "EVENT_VENUE",
  TRANSPORT = "TRANSPORT",
  LAUNDRY = "LAUNDRY",
  MINIBAR = "MINIBAR",
  SPA = "SPA",
  TOUR = "TOUR",
  OTHER = "OTHER",
}

/**
 * Income categories for detailed classification
 */
export enum IncomeCategory {
  ACCOMMODATION = "ACCOMMODATION",
  FB_RESTAURANT = "FB_RESTAURANT",
  FB_ROOM_SERVICE = "FB_ROOM_SERVICE",
  FB_BAR = "FB_BAR",
  FB_CATERING = "FB_CATERING",
  ACTIVITIES_WATER = "ACTIVITIES_WATER",
  ACTIVITIES_LAND = "ACTIVITIES_LAND",
  ACTIVITIES_TOURS = "ACTIVITIES_TOURS",
  WELLNESS_SPA = "WELLNESS_SPA",
  WELLNESS_MASSAGE = "WELLNESS_MASSAGE",
  RENTALS_EQUIPMENT = "RENTALS_EQUIPMENT",
  RENTALS_VENUE = "RENTALS_VENUE",
  TRANSPORT_AIRPORT = "TRANSPORT_AIRPORT",
  TRANSPORT_LOCAL = "TRANSPORT_LOCAL",
  OTHER_LAUNDRY = "OTHER_LAUNDRY",
  OTHER_MINIBAR = "OTHER_MINIBAR",
  OTHER_DAMAGE = "OTHER_DAMAGE",
  OTHER_PENALTY = "OTHER_PENALTY",
}

/**
 * Source of income transactions
 */
export enum IncomeSource {
  DIRECT = "DIRECT", // Walk-in or direct booking
  OTA_BOOKING = "OTA_BOOKING", // Booking.com
  OTA_AGODA = "OTA_AGODA", // Agoda
  OTA_AIRBNB = "OTA_AIRBNB", // Airbnb
  OTA_EXPEDIA = "OTA_EXPEDIA", // Expedia
  OTA_HOTELS = "OTA_HOTELS", // Hotels.com
  OTA_TRAVELOKA = "OTA_TRAVELOKA", // Traveloka
  OTA_TRIP = "OTA_TRIP", // Trip.com
  CORPORATE = "CORPORATE", // Corporate booking
  GROUP = "GROUP", // Group booking
  TRAVEL_AGENCY = "TRAVEL_AGENCY", // Travel agency
  WALK_IN = "WALK_IN", // Walk-in guest
  PHONE = "PHONE", // Phone reservation
  EMAIL = "EMAIL", // Email reservation
  SOCIAL_MEDIA = "SOCIAL_MEDIA", // Facebook, Instagram
  REFERRAL = "REFERRAL", // Referral
}

/**
 * Income transaction status
 */
export enum IncomeStatus {
  PENDING = "PENDING", // Not yet confirmed
  CONFIRMED = "CONFIRMED", // Confirmed but not paid
  PARTIAL_PAID = "PARTIAL_PAID", // Partially paid
  FULLY_PAID = "FULLY_PAID", // Fully paid
  RECOGNIZED = "RECOGNIZED", // Revenue recognized
  CANCELLED = "CANCELLED", // Cancelled
  REFUNDED = "REFUNDED", // Refunded
  DISPUTED = "DISPUTED", // Under dispute
}

/**
 * Season types for pricing
 */
export enum SeasonType {
  PEAK = "PEAK", // Peak season (Dec-May)
  OFF_PEAK = "OFF_PEAK", // Off-peak (Jun-Nov)
  SUPER_PEAK = "SUPER_PEAK", // Holiday periods
  SPECIAL_EVENT = "SPECIAL_EVENT", // Local events
}

/**
 * Core income transaction interface
 */
export interface IncomeTransaction {
  id: string;
  projectId: string;
  transactionCode: string;

  // Classification
  incomeType: IncomeType;
  category: IncomeCategory;
  subcategory?: string;

  // Source tracking
  sourceType: IncomeSource;
  sourceReference?: string; // Booking ID, OTA confirmation

  // Financial details
  grossAmount: Decimal;
  netAmount: Decimal;
  taxAmount: Decimal;
  serviceCharge?: Decimal;
  discountAmount?: Decimal;
  commissionAmount?: Decimal;

  // Currency
  currency: string; // ISO 4217 code
  exchangeRate?: Decimal;
  originalAmount?: Decimal;

  // Booking linkage
  bookingId?: string;
  guestName: string;
  guestCount?: number;

  // Period tracking
  transactionDate: Date;
  recognitionDate?: Date; // For accrual accounting
  serviceStartDate?: Date;
  serviceEndDate?: Date;

  // Status
  status: IncomeStatus;

  // Audit
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;

  // Metadata
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Income allocation for package deals
 */
export interface IncomeAllocation {
  id: string;
  projectId: string;
  incomeTransactionId: string;

  componentType: "ACCOMMODATION" | "MEAL" | "AMENITY" | "SERVICE";
  componentDescription: string;
  allocatedAmount: Decimal;
  allocationPercentage: Decimal;

  createdAt: Date;
}

/**
 * Package deal with multiple components
 */
export interface PackageDeal {
  id: string;
  projectId: string;
  packageName: string;
  packageCode: string;

  totalPrice: Decimal;
  validFrom: Date;
  validTo: Date;

  components: PackageComponent[];

  isActive: boolean;
  maxGuests?: number;
  minNights?: number;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Package component definition
 */
export interface PackageComponent {
  category: IncomeCategory;
  description: string;
  allocationPercentage: Decimal;
  fixedAmount?: Decimal;

  isMandatory: boolean;
  quantity?: number;
}

/**
 * All-inclusive rate configuration
 */
export interface AllInclusiveRate {
  id: string;
  projectId: string;

  rateName: string;
  ratePerPersonPerNight: Decimal;

  inclusions: string[];
  exclusions?: string[];

  minGuests: number;
  maxGuests: number;
  minNights: number;

  validFrom: Date;
  validTo: Date;

  seasonType: SeasonType;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Seasonal pricing configuration
 */
export interface SeasonalPricing {
  id: string;
  projectId: string;

  seasonName: string;
  seasonType: SeasonType;

  startDate: Date;
  endDate: Date;

  baseRateMultiplier: Decimal; // 1.5 for 50% increase

  roomTypes: {
    [roomType: string]: {
      baseRate: Decimal;
      adjustedRate: Decimal;
    };
  };

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Room booking specific details
 */
export interface RoomBooking {
  bookingId: string;
  confirmationCode: string;

  checkInDate: Date;
  checkOutDate: Date;
  numberOfNights: number;

  roomType: string;
  roomNumber?: string;

  roomRate: Decimal;
  totalRoomCharges: Decimal;

  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCount: number;

  specialRequests?: string;
  arrivalTime?: string;

  bookingSource: IncomeSource;
  otaConfirmation?: string;

  isDayUse?: boolean;
  dayUseHours?: number;
}

/**
 * Service charge configuration
 */
export interface ServiceChargeConfig {
  id: string;
  projectId: string;

  category: IncomeCategory;
  chargePercentage: Decimal; // 10% = 0.10

  isVatable: boolean;
  isAutoApplied: boolean;

  minimumAmount?: Decimal;
  maximumAmount?: Decimal;

  effectiveDate: Date;
  expiryDate?: Date;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Income summary for reporting
 */
export interface IncomeSummary {
  projectId: string;
  periodStart: Date;
  periodEnd: Date;

  totalGrossIncome: Decimal;
  totalNetIncome: Decimal;
  totalTaxCollected: Decimal;
  totalServiceCharges: Decimal;
  totalDiscounts: Decimal;
  totalCommissions: Decimal;

  byCategory: {
    [key in IncomeCategory]?: {
      grossAmount: Decimal;
      netAmount: Decimal;
      transactionCount: number;
    };
  };

  bySource: {
    [key in IncomeSource]?: {
      grossAmount: Decimal;
      netAmount: Decimal;
      commissionAmount: Decimal;
      transactionCount: number;
    };
  };

  byPaymentMethod?: {
    [method: string]: {
      amount: Decimal;
      transactionCount: number;
    };
  };

  generatedAt: Date;
}

/**
 * Daily revenue tracking
 */
export interface DailyRevenue {
  projectId: string;
  date: Date;

  roomRevenue: Decimal;
  fbRevenue: Decimal;
  otherRevenue: Decimal;
  totalRevenue: Decimal;

  occupancyRate: Decimal;
  averageDailyRate: Decimal;
  revPAR: Decimal; // Revenue per available room

  guestCount: number;
  roomsSold: number;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Revenue recognition method
 */
export enum RevenueRecognitionMethod {
  IMMEDIATE = "IMMEDIATE", // Recognize immediately
  CHECK_IN_DATE = "CHECK_IN_DATE", // Recognize on check-in
  DAILY_ACCRUAL = "DAILY_ACCRUAL", // Accrue daily during stay
  SERVICE_DATE = "SERVICE_DATE", // Recognize on service date
  CUSTOM = "CUSTOM", // Custom recognition schedule
}

/**
 * Revenue recognition schedule
 */
export interface RevenueRecognitionSchedule {
  id: string;
  incomeTransactionId: string;

  method: RevenueRecognitionMethod;

  scheduleEntries: {
    date: Date;
    amount: Decimal;
    isRecognized: boolean;
    recognizedAt?: Date;
  }[];

  totalAmount: Decimal;
  recognizedAmount: Decimal;
  remainingAmount: Decimal;

  createdAt: Date;
  updatedAt: Date;
}
