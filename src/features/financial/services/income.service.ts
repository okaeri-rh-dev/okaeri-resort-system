/**
 * Income Service
 *
 * Core service for managing income with platform fee calculations,
 * revenue recognition, and Philippine tax compliance.
 */

import { Money } from "@/lib/money";
import { db } from "@/lib/db";
import {
  incomeTransactions,
  incomeAllocations,
  seasonalPricing,
  packageDeals,
  type IncomeTransaction,
  type NewIncomeTransaction,
} from "@/lib/db/schema/income.schema";
import { discountLogs, type NewDiscountLog } from "@/lib/db/schema/discount.schema";
import { eq, and, gte, lte, desc, sql, or, isNull } from "drizzle-orm";
import { generateCode } from "@/lib/utils";
import { auditLog, auditFinancialTransaction } from "@/lib/audit";

// Platform fee rates (2024-2025 rates)
const PLATFORM_FEES = {
  AIRBNB: { hostFee: 0.03, guestFee: 0.14 }, // 3% host fee, 14% guest fee
  BOOKING_COM: { commission: 0.15 }, // 15% commission (negotiable to 12%)
  AGODA: { commission: 0.15 }, // 15-18% depending on visibility package
  EXPEDIA: { commission: 0.15 }, // 15-20% depending on agreement
  TRAVELOKA: { commission: 0.12 }, // 12-15%
  DIRECT: { commission: 0 }, // No fees for direct bookings
} as const;

interface RecordIncomeInput {
  projectId: string;
  transactionDate: Date;
  transactionType: "booking" | "addon" | "package" | "other";
  grossAmount: number | string | Money;
  incomeCategory: string;
  incomeSubcategory?: string;
  description?: string;

  // Related entities
  bookingId?: string;
  roomId?: string;
  customerId?: string;

  // Payment information
  paymentMethod: string;
  paymentReference?: string;

  // Discounts
  discountAmount?: number | string | Money;
  seniorPwdDiscount?: {
    type: "senior" | "pwd";
    idNumber: string;
    customerName: string;
  };

  // Tax information
  isVatable?: boolean;
  serviceChargeRate?: number;

  // User context
  userId: string;
}

interface PlatformBookingInput {
  projectId: string;
  platform: keyof typeof PLATFORM_FEES;
  confirmationCode: string;
  checkInDate: Date;
  checkOutDate: Date;
  grossRevenue: number | string | Money;
  guestName: string;
  roomType?: string;
  numberOfGuests?: number;
  payoutDate?: Date;
  userId: string;
}

interface PackageRevenueInput {
  projectId: string;
  packageName: string;
  packagePrice: number | string | Money;
  components: {
    category: string;
    description: string;
    allocation: number; // Percentage of package price
  }[];
  bookingId?: string;
  userId: string;
}

interface SeasonalPricingInput {
  projectId: string;
  seasonName: string;
  seasonType: "peak" | "high" | "regular" | "off_peak";
  startDate: Date;
  endDate: Date;
  multiplier: number; // 1.5 for 50% surcharge, 0.8 for 20% discount
  roomTypes?: string[];
  userId: string;
}

export class IncomeService {
  /**
   * Record income transaction with automatic tax calculations
   */
  async recordIncome(input: RecordIncomeInput): Promise<IncomeTransaction> {
    // Convert amounts to Money instances
    const grossAmount =
      input.grossAmount instanceof Money ? input.grossAmount : new Money(input.grossAmount);

    const discountAmount = input.discountAmount
      ? input.discountAmount instanceof Money
        ? input.discountAmount
        : new Money(input.discountAmount)
      : new Money(0);

    // Validate amounts
    if (!grossAmount.isPositive()) {
      throw new Error("Income amount must be positive");
    }

    // Apply Senior/PWD discount if applicable (20% discount, VAT exempt)
    let finalGrossAmount = grossAmount;
    let vatAmount = new Money(0);
    let serviceChargeAmount = new Money(0);

    if (input.seniorPwdDiscount) {
      // Senior/PWD get 20% discount and are VAT exempt
      const discountRate = 0.2;
      discountAmount.add(grossAmount.multiply(discountRate));
      finalGrossAmount = grossAmount.subtract(discountAmount);

      // Log discount for BIR compliance
      await this.logSeniorPwdDiscount({
        projectId: input.projectId,
        transactionType: "income",
        transactionId: "", // Will update after creating income record
        discountType: input.seniorPwdDiscount.type,
        idNumber: input.seniorPwdDiscount.idNumber,
        customerName: input.seniorPwdDiscount.customerName,
        originalAmount: grossAmount,
        discountAmount,
        userId: input.userId,
      });
    } else if (input.isVatable) {
      // Regular VAT calculation (12%)
      const preVat = finalGrossAmount.removeVAT();
      vatAmount = finalGrossAmount.getVATAmount();
      finalGrossAmount = preVat; // Net amount before VAT
    }

    // Apply service charge if specified (typically 10%)
    if (input.serviceChargeRate) {
      serviceChargeAmount = finalGrossAmount.multiply(input.serviceChargeRate);
    }

    // Calculate net amount
    const netAmount = finalGrossAmount.subtract(vatAmount);

    // Generate transaction code
    const transactionCode = await this.generateTransactionCode(input.projectId);

    // Create income transaction
    const [income] = await db
      .insert(incomeTransactions)
      .values({
        projectId: input.projectId,
        transactionCode,
        transactionDate: input.transactionDate,
        transactionType: input.transactionType,
        grossAmount: grossAmount.toString(),
        discountAmount: discountAmount.toString(),
        taxAmount: vatAmount.toString(),
        serviceChargeAmount: serviceChargeAmount.toString(),
        netAmount: netAmount.toString(),
        bookingId: input.bookingId,
        roomId: input.roomId,
        customerId: input.customerId,
        incomeCategory: input.incomeCategory,
        incomeSubcategory: input.incomeSubcategory,
        paymentMethod: input.paymentMethod,
        paymentStatus: "completed",
        paymentReference: input.paymentReference,
        description: input.description,
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();

    // Update discount log with transaction ID if senior/pwd discount was applied
    if (input.seniorPwdDiscount) {
      await db
        .update(discountLogs)
        .set({ transactionId: income.id })
        .where(
          and(
            eq(discountLogs.projectId, input.projectId),
            eq(discountLogs.transactionType, "income"),
            isNull(discountLogs.transactionId)
          )
        );
    }

    // Audit log
    await auditFinancialTransaction({
      userId: input.userId,
      transactionType: "income",
      transactionId: income.id,
      amount: grossAmount.toNumber(),
      description: input.description || `${input.incomeCategory} income recorded`,
      metadata: {
        projectId: input.projectId,
        paymentMethod: input.paymentMethod,
        vatAmount: vatAmount.toNumber(),
        discountAmount: discountAmount.toNumber(),
      },
    });

    return income;
  }

  /**
   * Record platform booking with automatic fee calculation
   * TODO: Implement platform bookings table in future phase
   */
  async recordPlatformBooking(input: PlatformBookingInput) {
    const grossRevenue =
      input.grossRevenue instanceof Money ? input.grossRevenue : new Money(input.grossRevenue);

    // Calculate platform fees
    const feeStructure = PLATFORM_FEES[input.platform];
    let platformFee = new Money(0);
    let netRevenue = grossRevenue;

    if (input.platform === "AIRBNB") {
      // Airbnb charges host fee from payout
      platformFee = grossRevenue.multiply(feeStructure.hostFee);
      netRevenue = grossRevenue.subtract(platformFee);
    } else if (feeStructure.commission) {
      // Other platforms charge commission
      platformFee = grossRevenue.multiply(feeStructure.commission);
      netRevenue = grossRevenue.subtract(platformFee);
    }

    // For now, just create the income transaction
    // Platform bookings table will be implemented in a future phase
    const income = await this.recordIncome({
      projectId: input.projectId,
      transactionDate: input.checkInDate,
      transactionType: "booking",
      grossAmount: netRevenue, // Record net amount as income
      incomeCategory: "accommodation",
      incomeSubcategory: input.platform.toLowerCase(),
      description: `${input.platform} booking - ${input.confirmationCode}`,
      paymentMethod: "platform",
      paymentReference: input.confirmationCode,
      userId: input.userId,
    });

    // Audit log
    await auditLog({
      userId: input.userId,
      action: "platform_booking.recorded",
      entityType: "income",
      entityId: income.id,
      amount: grossRevenue.toNumber(),
      metadata: {
        platform: input.platform,
        confirmationCode: input.confirmationCode,
        platformFee: platformFee.toNumber(),
        netRevenue: netRevenue.toNumber(),
        feePercentage: feeStructure.commission || feeStructure.hostFee,
      },
    });

    return { income, platformFee: platformFee.toNumber(), netRevenue: netRevenue.toNumber() };
  }

  /**
   * Allocate package revenue across components
   */
  async allocatePackageRevenue(input: PackageRevenueInput) {
    const packagePrice =
      input.packagePrice instanceof Money ? input.packagePrice : new Money(input.packagePrice);

    // Validate allocations sum to 100%
    const totalAllocation = input.components.reduce((sum, c) => sum + c.allocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error("Component allocations must sum to 100%");
    }

    // Create package deal record
    const [packageDeal] = await db
      .insert(packageDeals)
      .values({
        projectId: input.projectId,
        packageCode: await this.generatePackageCode(input.projectId),
        packageName: input.packageName,
        totalPrice: packagePrice.toNumber().toString(),
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
        isActive: true,
        createdBy: input.userId,
      })
      .returning();

    // Allocate revenue to components
    const allocations = [];
    for (const component of input.components) {
      const componentAmount = packagePrice.multiply(component.allocation / 100);

      // Create allocation record
      const [allocation] = await db
        .insert(incomeAllocations)
        .values({
          incomeTransactionId: "", // Will be updated when income is recorded
          allocationCategory: component.category,
          allocationAmount: componentAmount.toNumber().toString(),
          allocationPercentage: component.allocation.toString(),
          description: component.description,
        })
        .returning();

      allocations.push(allocation);

      // Record income for each component
      await this.recordIncome({
        projectId: input.projectId,
        transactionDate: new Date(),
        transactionType: "package",
        grossAmount: componentAmount,
        incomeCategory: component.category,
        description: `${input.packageName} - ${component.description}`,
        bookingId: input.bookingId,
        paymentMethod: "package",
        userId: input.userId,
      });
    }

    // Audit log
    await auditLog({
      userId: input.userId,
      action: "package_revenue.allocated",
      entityType: "package_deal",
      entityId: packageDeal.id,
      amount: packagePrice.toNumber(),
      metadata: {
        packageName: input.packageName,
        components: input.components,
        allocations: allocations.map((a) => ({
          category: a.allocationCategory,
          amount: a.allocationAmount,
          percentage: a.allocationPercentage,
        })),
      },
    });

    return {
      packageDeal,
      allocations,
    };
  }

  /**
   * Configure seasonal pricing
   */
  async configureSeasonalPricing(input: SeasonalPricingInput) {
    // Validate dates
    if (input.startDate >= input.endDate) {
      throw new Error("Start date must be before end date");
    }

    // Check for overlapping seasons
    const overlapping = await db
      .select()
      .from(seasonalPricing)
      .where(
        and(
          eq(seasonalPricing.projectId, input.projectId),
          or(
            and(
              lte(seasonalPricing.startDate, input.startDate.toISOString().split("T")[0]),
              gte(seasonalPricing.endDate, input.startDate.toISOString().split("T")[0])
            ),
            and(
              lte(seasonalPricing.startDate, input.endDate.toISOString().split("T")[0]),
              gte(seasonalPricing.endDate, input.endDate.toISOString().split("T")[0])
            )
          ),
          eq(seasonalPricing.isActive, true)
        )
      );

    if (overlapping.length > 0) {
      throw new Error("Seasonal pricing periods cannot overlap");
    }

    // Create seasonal pricing record
    const [pricing] = await db
      .insert(seasonalPricing)
      .values({
        projectId: input.projectId,
        seasonName: input.seasonName,
        seasonType: input.seasonType,
        startDate: input.startDate.toISOString().split("T")[0],
        endDate: input.endDate.toISOString().split("T")[0],
        pricingMultiplier: input.multiplier.toString(),
        applicableRooms: input.roomTypes || [],
        isActive: true,
        createdBy: input.userId,
      })
      .returning();

    // Audit log
    await auditLog({
      userId: input.userId,
      action: "seasonal_pricing.configured",
      entityType: "seasonal_pricing",
      entityId: pricing.id,
      metadata: {
        seasonName: input.seasonName,
        seasonType: input.seasonType,
        multiplier: input.multiplier,
        period: `${input.startDate.toISOString()} to ${input.endDate.toISOString()}`,
      },
    });

    return pricing;
  }

  /**
   * Calculate revenue for a given period
   */
  async calculateRevenue(
    projectId: string,
    startDate: Date,
    endDate: Date,
    groupBy: "day" | "week" | "month" = "month"
  ) {
    const dateFormat = {
      day: "YYYY-MM-DD",
      week: "YYYY-WW",
      month: "YYYY-MM",
    }[groupBy];

    const result = await db
      .select({
        period: sql<string>`TO_CHAR(${incomeTransactions.transactionDate}, ${dateFormat})`,
        category: incomeTransactions.incomeCategory,
        grossRevenue: sql<string>`SUM(${incomeTransactions.grossAmount})`,
        discounts: sql<string>`SUM(${incomeTransactions.discountAmount})`,
        taxes: sql<string>`SUM(${incomeTransactions.taxAmount})`,
        netRevenue: sql<string>`SUM(${incomeTransactions.netAmount})`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.projectId, projectId),
          gte(incomeTransactions.transactionDate, startDate),
          lte(incomeTransactions.transactionDate, endDate),
          eq(incomeTransactions.paymentStatus, "completed")
        )
      )
      .groupBy(
        sql`TO_CHAR(${incomeTransactions.transactionDate}, ${dateFormat})`,
        incomeTransactions.incomeCategory
      )
      .orderBy(sql`TO_CHAR(${incomeTransactions.transactionDate}, ${dateFormat})`);

    return result.map((row) => ({
      period: row.period,
      category: row.category,
      grossRevenue: new Money(row.grossRevenue),
      discounts: new Money(row.discounts),
      taxes: new Money(row.taxes),
      netRevenue: new Money(row.netRevenue),
      transactionCount: row.transactionCount,
    }));
  }

  /**
   * Get platform booking summary
   * TODO: Implement proper platform bookings table query in future phase
   */
  async getPlatformSummary(projectId: string, startDate: Date, endDate: Date) {
    // For now, aggregate from income transactions by platform subcategory
    const result = await db
      .select({
        platform: incomeTransactions.incomeSubcategory,
        bookingCount: sql<number>`COUNT(*)`,
        grossRevenue: sql<string>`SUM(${incomeTransactions.grossAmount})`,
        netRevenue: sql<string>`SUM(${incomeTransactions.netAmount})`,
        avgBookingValue: sql<string>`AVG(${incomeTransactions.grossAmount})`,
      })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.projectId, projectId),
          eq(incomeTransactions.incomeCategory, "accommodation"),
          eq(incomeTransactions.paymentMethod, "platform"),
          gte(incomeTransactions.transactionDate, startDate),
          lte(incomeTransactions.transactionDate, endDate)
        )
      )
      .groupBy(incomeTransactions.incomeSubcategory);

    return result.map((row) => ({
      platform: row.platform || "unknown",
      bookingCount: row.bookingCount,
      grossRevenue: new Money(row.grossRevenue),
      platformFees: new Money(0), // Will be calculated from metadata in future
      netRevenue: new Money(row.netRevenue),
      avgBookingValue: new Money(row.avgBookingValue),
      effectiveFeeRate: 0, // Will be calculated from metadata in future
    }));
  }

  /**
   * Process multi-currency payment
   */
  async processMultiCurrencyPayment(
    incomeId: string,
    originalCurrency: string,
    originalAmount: number,
    exchangeRate: number,
    userId: string
  ) {
    const phpAmount = new Money(originalAmount * exchangeRate);

    // Update income transaction with forex details
    await db
      .update(incomeTransactions)
      .set({
        metadata: sql`
          COALESCE(metadata, '{}'::jsonb) || 
          ${JSON.stringify({
            originalCurrency,
            originalAmount,
            exchangeRate,
            conversionDate: new Date().toISOString(),
          })}::jsonb
        `,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(incomeTransactions.id, incomeId));

    // Audit log
    await auditLog({
      userId,
      action: "income.forex_conversion",
      entityType: "income",
      entityId: incomeId,
      amount: phpAmount.toNumber(),
      metadata: {
        originalCurrency,
        originalAmount,
        exchangeRate,
        phpAmount: phpAmount.toNumber(),
      },
    });

    return {
      originalAmount,
      originalCurrency,
      exchangeRate,
      phpAmount: phpAmount.toNumber(),
      conversionDate: new Date(),
    };
  }

  // Private helper methods

  private async generateTransactionCode(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const prefix = `INC-${year}${month}`;

    const [lastTransaction] = await db
      .select({ transactionCode: incomeTransactions.transactionCode })
      .from(incomeTransactions)
      .where(
        and(
          eq(incomeTransactions.projectId, projectId),
          sql`${incomeTransactions.transactionCode} LIKE ${prefix + "%"}`
        )
      )
      .orderBy(desc(incomeTransactions.transactionCode))
      .limit(1);

    let sequence = 1;
    if (lastTransaction) {
      const lastSequence = parseInt(lastTransaction.transactionCode.split("-")[2] || "0");
      sequence = lastSequence + 1;
    }

    return generateCode(`INC-${year}${month}`, sequence, 5);
  }

  private async generatePackageCode(projectId: string): Promise<string> {
    const prefix = "PKG";

    const [lastPackage] = await db
      .select({ packageCode: packageDeals.packageCode })
      .from(packageDeals)
      .where(
        and(
          eq(packageDeals.projectId, projectId),
          sql`${packageDeals.packageCode} LIKE ${prefix + "%"}`
        )
      )
      .orderBy(desc(packageDeals.packageCode))
      .limit(1);

    let sequence = 1;
    if (lastPackage) {
      const lastSequence = parseInt(lastPackage.packageCode.split("-")[1] || "0");
      sequence = lastSequence + 1;
    }

    return generateCode(prefix, sequence, 4);
  }

  private async logSeniorPwdDiscount(params: {
    projectId: string;
    transactionType: string;
    transactionId: string;
    discountType: "senior" | "pwd";
    idNumber: string;
    customerName: string;
    originalAmount: Money;
    discountAmount: Money;
    userId: string;
  }) {
    const discountCode = await this.generateDiscountCode(params.projectId);

    await db.insert(discountLogs).values({
      projectId: params.projectId,
      discountCode,
      discountDate: new Date(),
      discountType: params.discountType,
      transactionType: params.transactionType,
      transactionId: params.transactionId,
      transactionCode: "",
      customerName: params.customerName,
      idType: params.discountType === "senior" ? "senior_citizen" : "pwd",
      idNumber: params.idNumber,
      originalAmount: params.originalAmount.toNumber().toString(),
      discountPercentage: "20.00",
      discountAmount: params.discountAmount.toNumber().toString(),
      discountedAmount: params.originalAmount.subtract(params.discountAmount).toNumber().toString(),
      isVatExempt: true,
      vatExemptedAmount: params.originalAmount.getVATAmount().toNumber().toString(),
      complianceType: params.discountType === "senior" ? "RA 9994" : "RA 10754",
      birCompliant: true,
      status: "active",
      createdBy: params.userId,
    });
  }

  private async generateDiscountCode(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DSC-${year}`;

    const [lastDiscount] = await db
      .select({ discountCode: discountLogs.discountCode })
      .from(discountLogs)
      .where(
        and(
          eq(discountLogs.projectId, projectId),
          sql`${discountLogs.discountCode} LIKE ${prefix + "%"}`
        )
      )
      .orderBy(desc(discountLogs.discountCode))
      .limit(1);

    let sequence = 1;
    if (lastDiscount) {
      const lastSequence = parseInt(lastDiscount.discountCode.split("-")[2] || "0");
      sequence = lastSequence + 1;
    }

    return generateCode(prefix, sequence, 6);
  }
}
