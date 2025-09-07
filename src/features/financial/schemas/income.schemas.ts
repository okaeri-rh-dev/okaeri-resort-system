/**
 * Income Management Validation Schemas
 * Phase 4.2: Income Management Testing (RED Phase)
 *
 * Zod validation schemas for income management in Philippine resort operations
 */

import { z } from "zod";
import { Decimal } from "decimal.js";
import {
  IncomeType,
  IncomeCategory,
  IncomeSource,
  IncomeStatus,
  SeasonType,
  RevenueRecognitionMethod,
} from "../types/income.types";

// ============================================================================
// Helper Schemas
// ============================================================================

/**
 * Decimal validation schema
 */
export const decimalSchema = z
  .string()
  .refine(
    (val) => {
      try {
        new Decimal(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid decimal value" }
  )
  .transform((val) => new Decimal(val));

/**
 * Philippine peso amount schema (2 decimal places)
 */
export const pesoAmountSchema = decimalSchema
  .refine((val) => val.decimalPlaces() <= 2, {
    message: "Peso amount must have at most 2 decimal places",
  })
  .refine((val) => val.gte(0), {
    message: "Amount must be non-negative",
  });

/**
 * Currency code validation (ISO 4217)
 */
export const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Currency code must be 3 uppercase letters");

/**
 * Philippine mobile number validation
 */
export const philippineMobileSchema = z
  .string()
  .regex(/^(09|\+639)\d{9}$/, "Invalid Philippine mobile number");

/**
 * Email validation
 */
export const emailSchema = z.string().email("Invalid email address");

// ============================================================================
// Income Transaction Schemas
// ============================================================================

/**
 * Create income transaction schema
 */
export const createIncomeTransactionSchema = z.object({
  // Classification
  incomeType: z.nativeEnum(IncomeType),
  category: z.nativeEnum(IncomeCategory),
  subcategory: z.string().optional(),

  // Source tracking
  sourceType: z.nativeEnum(IncomeSource),
  sourceReference: z.string().optional(),

  // Financial details
  grossAmount: pesoAmountSchema,
  taxAmount: pesoAmountSchema.optional(),
  serviceCharge: pesoAmountSchema.optional(),
  discountAmount: pesoAmountSchema.optional(),

  // Currency (optional, defaults to PHP)
  currency: currencyCodeSchema.default("PHP"),
  exchangeRate: decimalSchema.optional(),
  originalAmount: decimalSchema.optional(),

  // Guest information
  guestName: z.string().min(2).max(255),
  guestCount: z.number().int().positive().optional(),
  guestEmail: emailSchema.optional(),
  guestPhone: philippineMobileSchema.optional(),

  // Period tracking
  transactionDate: z.date(),
  serviceStartDate: z.date().optional(),
  serviceEndDate: z.date().optional(),

  // Notes
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Update income transaction schema
 */
export const updateIncomeTransactionSchema = createIncomeTransactionSchema.partial().extend({
  status: z.nativeEnum(IncomeStatus).optional(),
});

/**
 * Room booking schema
 */
export const roomBookingSchema = z
  .object({
    confirmationCode: z.string().min(1).max(50),

    checkInDate: z.date(),
    checkOutDate: z.date(),

    roomType: z.string().min(1).max(50),
    roomNumber: z.string().optional(),

    roomRate: pesoAmountSchema,

    guestName: z.string().min(2).max(255),
    guestEmail: emailSchema.optional(),
    guestPhone: philippineMobileSchema.optional(),
    guestCount: z.number().int().min(1).max(10),

    specialRequests: z.string().max(500).optional(),
    arrivalTime: z.string().optional(),

    bookingSource: z.nativeEnum(IncomeSource),
    otaConfirmation: z.string().optional(),

    isDayUse: z.boolean().default(false),
    dayUseHours: z.number().int().min(1).max(12).optional(),
  })
  .refine(
    (data) => {
      return data.checkOutDate > data.checkInDate;
    },
    {
      message: "Check-out date must be after check-in date",
    }
  );

/**
 * Package deal component schema
 */
export const packageComponentSchema = z.object({
  category: z.nativeEnum(IncomeCategory),
  description: z.string().min(1).max(255),
  allocationPercentage: decimalSchema.refine((val) => val.gte(0) && val.lte(100), {
    message: "Allocation percentage must be between 0 and 100",
  }),
  fixedAmount: pesoAmountSchema.optional(),
  isMandatory: z.boolean().default(true),
  quantity: z.number().int().positive().optional(),
});

/**
 * Package deal schema
 */
export const packageDealSchema = z
  .object({
    packageName: z.string().min(1).max(100),
    packageCode: z.string().min(1).max(20),

    totalPrice: pesoAmountSchema,

    validFrom: z.date(),
    validTo: z.date(),

    components: z.array(packageComponentSchema).min(1),

    isActive: z.boolean().default(true),
    maxGuests: z.number().int().positive().optional(),
    minNights: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      // Validate that allocation percentages sum to 100
      const totalPercentage = data.components.reduce(
        (sum, comp) => sum.plus(comp.allocationPercentage),
        new Decimal(0)
      );
      return totalPercentage.equals(100);
    },
    {
      message: "Component allocation percentages must sum to 100%",
    }
  );

/**
 * All-inclusive rate schema
 */
export const allInclusiveRateSchema = z
  .object({
    rateName: z.string().min(1).max(100),
    ratePerPersonPerNight: pesoAmountSchema,

    inclusions: z.array(z.string()).min(1),
    exclusions: z.array(z.string()).optional(),

    minGuests: z.number().int().positive(),
    maxGuests: z.number().int().positive(),
    minNights: z.number().int().positive(),

    validFrom: z.date(),
    validTo: z.date(),

    seasonType: z.nativeEnum(SeasonType),

    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      return data.maxGuests >= data.minGuests;
    },
    {
      message: "Maximum guests must be greater than or equal to minimum guests",
    }
  );

/**
 * Seasonal pricing schema
 */
export const seasonalPricingSchema = z
  .object({
    seasonName: z.string().min(1).max(50),
    seasonType: z.nativeEnum(SeasonType),

    startDate: z.date(),
    endDate: z.date(),

    baseRateMultiplier: decimalSchema.refine((val) => val.gt(0), {
      message: "Rate multiplier must be positive",
    }),

    roomTypes: z.record(
      z.string(),
      z.object({
        baseRate: pesoAmountSchema,
        adjustedRate: pesoAmountSchema,
      })
    ),

    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      return data.endDate > data.startDate;
    },
    {
      message: "End date must be after start date",
    }
  );

/**
 * Service charge configuration schema
 */
export const serviceChargeConfigSchema = z.object({
  category: z.nativeEnum(IncomeCategory),
  chargePercentage: decimalSchema.refine((val) => val.gte(0) && val.lte(100), {
    message: "Service charge percentage must be between 0 and 100",
  }),

  isVatable: z.boolean().default(true),
  isAutoApplied: z.boolean().default(true),

  minimumAmount: pesoAmountSchema.optional(),
  maximumAmount: pesoAmountSchema.optional(),

  effectiveDate: z.date(),
  expiryDate: z.date().optional(),
});

/**
 * Revenue recognition schedule entry schema
 */
export const revenueRecognitionEntrySchema = z.object({
  date: z.date(),
  amount: pesoAmountSchema,
  isRecognized: z.boolean().default(false),
  recognizedAt: z.date().optional(),
});

/**
 * Revenue recognition schedule schema
 */
export const revenueRecognitionScheduleSchema = z
  .object({
    incomeTransactionId: z.string().uuid(),
    method: z.nativeEnum(RevenueRecognitionMethod),

    scheduleEntries: z.array(revenueRecognitionEntrySchema).min(1),

    totalAmount: pesoAmountSchema,
    recognizedAmount: pesoAmountSchema.default(new Decimal(0)),
    remainingAmount: pesoAmountSchema,
  })
  .refine(
    (data) => {
      // Validate that schedule entries sum to total amount
      const entriesTotal = data.scheduleEntries.reduce(
        (sum, entry) => sum.plus(entry.amount),
        new Decimal(0)
      );
      return entriesTotal.equals(data.totalAmount);
    },
    {
      message: "Schedule entries must sum to total amount",
    }
  );

// ============================================================================
// Query and Filter Schemas
// ============================================================================

/**
 * Income query filter schema
 */
export const incomeQueryFilterSchema = z.object({
  // Date range
  startDate: z.date().optional(),
  endDate: z.date().optional(),

  // Classification filters
  incomeType: z.nativeEnum(IncomeType).optional(),
  category: z.nativeEnum(IncomeCategory).optional(),
  sourceType: z.nativeEnum(IncomeSource).optional(),

  // Status filter
  status: z.nativeEnum(IncomeStatus).optional(),

  // Amount range
  minAmount: pesoAmountSchema.optional(),
  maxAmount: pesoAmountSchema.optional(),

  // Guest filter
  guestName: z.string().optional(),

  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),

  // Sorting
  sortBy: z.enum(["date", "amount", "status", "guest"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Income summary request schema
 */
export const incomeSummaryRequestSchema = z.object({
  projectId: z.string().uuid(),
  periodStart: z.date(),
  periodEnd: z.date(),

  groupBy: z
    .array(z.enum(["category", "source", "paymentMethod", "day", "week", "month"]))
    .optional(),

  includeDetails: z.boolean().default(false),
});

/**
 * Daily revenue query schema
 */
export const dailyRevenueQuerySchema = z.object({
  projectId: z.string().uuid(),
  date: z.date(),

  includeOccupancy: z.boolean().default(true),
  includeBreakdown: z.boolean().default(true),
});

// ============================================================================
// Validation Helper Functions (RED Phase - To be implemented in GREEN)
// ============================================================================

// Helper functions will be implemented in Phase 4.3 (GREEN phase)
// - validateBookingDates: Date validation logic
// - validateSeasonalPricingOverlap: Pricing overlap checking
// - calculateNetAmount: Financial calculation logic
