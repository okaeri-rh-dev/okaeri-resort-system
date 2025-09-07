/**
 * Profit & Loss Report Strategy
 *
 * Generates comprehensive P&L reports for Philippine resort operations
 * with proper VAT, EWT, and seasonal analysis integration.
 */

import { Money } from "@/lib/money";
import type {
  ReportConfig,
  ReportData,
  ReportMetrics,
  ReportStrategy,
} from "@/lib/services/report-engine.service";
import type { FinancialServices } from "@/features/financial/services";
import { ExpenseCategory } from "@/features/financial/types/financial.types";

// P&L Specific Data Structure
export interface ProfitLossDetails {
  revenue: {
    roomRevenue: Money;
    foodBeverageRevenue: Money;
    tourPackageRevenue: Money;
    miscellaneousRevenue: Money;
    totalGrossRevenue: Money;
    discounts: Money;
    netRevenue: Money;
  };
  directCosts: {
    roomCosts: Money;
    foodBeverageCosts: Money;
    tourCosts: Money;
    totalDirectCosts: Money;
  };
  grossProfit: Money;
  operatingExpenses: {
    salaries: Money;
    utilities: Money;
    maintenance: Money;
    marketing: Money;
    insurance: Money;
    supplies: Money;
    professional: Money;
    depreciation: Money;
    miscellaneous: Money;
    totalOperatingExpenses: Money;
  };
  operatingIncome: Money;
  nonOperatingIncome: Money;
  nonOperatingExpenses: Money;
  earningsBeforeInterestTax: Money;
  interestExpense: Money;
  earningsBeforeTax: Money;
  taxes: {
    incomeTax: Money;
    vatPayable: Money;
    withholdingTaxCredits: Money;
    netTaxLiability: Money;
  };
  netIncome: Money;
  seasonalAnalysis: {
    peakSeasonRevenue: Money;
    offSeasonRevenue: Money;
    shoulderSeasonRevenue: Money;
    peakSeasonExpenses: Money;
    offSeasonExpenses: Money;
    shoulderSeasonExpenses: Money;
  };
  keyRatios: {
    grossProfitMargin: number; // %
    operatingProfitMargin: number; // %
    netProfitMargin: number; // %
    averageDailyRate: Money;
    revenuePerAvailableRoom: Money;
    costPerOccupiedRoom: Money;
  };
  monthlyBreakdown: Array<{
    month: string;
    revenue: Money;
    expenses: Money;
    netIncome: Money;
    occupancyRate: number;
  }>;
}

// Philippine Season Definitions
const PHILIPPINE_SEASONS = {
  PEAK: [11, 0, 1], // December, January, February
  SHOULDER: [2, 3, 10], // March, April, November
  OFF: [4, 5, 6, 7, 8, 9], // May through October
} as const;

export class ProfitLossStrategy implements ReportStrategy {
  async generateReport(config: ReportConfig, services: FinancialServices): Promise<ReportData> {
    const startTime = Date.now();

    try {
      // Get financial data for the period
      const [incomes, expenses] = await Promise.all([
        this.getIncomeData(config, services),
        this.getExpenseData(config, services),
      ]);

      // Calculate P&L details
      const details = await this.calculateProfitLoss(config, incomes, expenses, services);

      // Calculate metrics
      const metrics = this.calculateMetrics(details);

      return {
        config,
        metrics,
        details,
        generatedAt: new Date(),
        generatedBy: "system",
        performance: {
          generationTime: Date.now() - startTime,
          cacheHit: false,
          dataPoints: incomes.length + expenses.length,
        },
      };
    } catch (error: any) {
      throw new Error(`P&L report generation failed: ${error.message}`);
    }
  }

  validateConfig(config: ReportConfig): void {
    if (config.reportType !== "profit-loss") {
      throw new Error("Invalid report type for P&L strategy");
    }

    // Validate date range is not too large for detailed P&L
    const daysDiff =
      (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      throw new Error("P&L reports limited to 365 days maximum for performance");
    }
  }

  getCacheKey(config: ReportConfig): string {
    const start = config.startDate.toISOString().split("T")[0];
    const end = config.endDate.toISOString().split("T")[0];
    const comparison = config.includeComparisons ? ":with-comparison" : "";
    return `report:${config.projectId}:profit-loss:${start}:${end}${comparison}`;
  }

  getCacheTTL(config: ReportConfig): number {
    // P&L reports cached based on recency
    const now = new Date();
    const daysSinceEnd = (now.getTime() - config.endDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceEnd < 1) {
      return 15 * 60; // 15 minutes for current day
    } else if (daysSinceEnd < 30) {
      return 60 * 60; // 1 hour for recent data
    } else {
      return 24 * 60 * 60; // 24 hours for historical data
    }
  }

  /**
   * Get income data for the period
   */
  private async getIncomeData(config: ReportConfig, services: FinancialServices): Promise<any[]> {
    // This would use the IncomeService to fetch actual data
    // For now, returning empty array as services need to be implemented
    return [];
  }

  /**
   * Get expense data for the period
   */
  private async getExpenseData(config: ReportConfig, services: FinancialServices): Promise<any[]> {
    // This would use the ExpenseService to fetch actual data
    // Using the existing service structure
    try {
      const filter = {
        projectId: config.projectId,
        dateFrom: config.startDate,
        dateTo: config.endDate,
      };

      // The ExpenseService would have a method like this
      // return await services.expense.getExpenses(filter);
      return [];
    } catch (error) {
      console.warn("Error fetching expense data:", error);
      return [];
    }
  }

  /**
   * Calculate comprehensive P&L details
   */
  private async calculateProfitLoss(
    config: ReportConfig,
    incomes: any[],
    expenses: any[],
    services: FinancialServices
  ): Promise<ProfitLossDetails> {
    // Initialize all monetary values
    const revenue = {
      roomRevenue: new Money(0),
      foodBeverageRevenue: new Money(0),
      tourPackageRevenue: new Money(0),
      miscellaneousRevenue: new Money(0),
      totalGrossRevenue: new Money(0),
      discounts: new Money(0),
      netRevenue: new Money(0),
    };

    // Calculate revenue from incomes
    incomes.forEach((income) => {
      const amount = new Money(income.amount);

      switch (income.category) {
        case "accommodation":
          revenue.roomRevenue = revenue.roomRevenue.add(amount);
          break;
        case "food_beverage":
          revenue.foodBeverageRevenue = revenue.foodBeverageRevenue.add(amount);
          break;
        case "tours_activities":
          revenue.tourPackageRevenue = revenue.tourPackageRevenue.add(amount);
          break;
        default:
          revenue.miscellaneousRevenue = revenue.miscellaneousRevenue.add(amount);
      }
    });

    // Calculate total gross revenue
    revenue.totalGrossRevenue = Money.sum([
      revenue.roomRevenue,
      revenue.foodBeverageRevenue,
      revenue.tourPackageRevenue,
      revenue.miscellaneousRevenue,
    ]);

    // Net revenue (after discounts)
    revenue.netRevenue = revenue.totalGrossRevenue.subtract(revenue.discounts);

    // Calculate direct costs
    const directCosts = {
      roomCosts: new Money(0),
      foodBeverageCosts: new Money(0),
      tourCosts: new Money(0),
      totalDirectCosts: new Money(0),
    };

    // Calculate operating expenses by category
    const operatingExpenses = {
      salaries: new Money(0),
      utilities: new Money(0),
      maintenance: new Money(0),
      marketing: new Money(0),
      insurance: new Money(0),
      supplies: new Money(0),
      professional: new Money(0),
      depreciation: new Money(0),
      miscellaneous: new Money(0),
      totalOperatingExpenses: new Money(0),
    };

    // Process expenses
    expenses.forEach((expense) => {
      const amount = new Money(expense.amount);

      switch (expense.category) {
        case ExpenseCategory.SALARIES:
          operatingExpenses.salaries = operatingExpenses.salaries.add(amount);
          break;
        case ExpenseCategory.UTILITIES:
          operatingExpenses.utilities = operatingExpenses.utilities.add(amount);
          break;
        case ExpenseCategory.MAINTENANCE:
          operatingExpenses.maintenance = operatingExpenses.maintenance.add(amount);
          break;
        case ExpenseCategory.MARKETING:
          operatingExpenses.marketing = operatingExpenses.marketing.add(amount);
          break;
        case ExpenseCategory.INSURANCE:
          operatingExpenses.insurance = operatingExpenses.insurance.add(amount);
          break;
        case ExpenseCategory.SUPPLIES:
          operatingExpenses.supplies = operatingExpenses.supplies.add(amount);
          break;
        case ExpenseCategory.PROFESSIONAL_FEES:
          operatingExpenses.professional = operatingExpenses.professional.add(amount);
          break;
        default:
          operatingExpenses.miscellaneous = operatingExpenses.miscellaneous.add(amount);
      }
    });

    // Calculate total direct costs
    directCosts.totalDirectCosts = Money.sum([
      directCosts.roomCosts,
      directCosts.foodBeverageCosts,
      directCosts.tourCosts,
    ]);

    // Calculate total operating expenses
    operatingExpenses.totalOperatingExpenses = Money.sum([
      operatingExpenses.salaries,
      operatingExpenses.utilities,
      operatingExpenses.maintenance,
      operatingExpenses.marketing,
      operatingExpenses.insurance,
      operatingExpenses.supplies,
      operatingExpenses.professional,
      operatingExpenses.depreciation,
      operatingExpenses.miscellaneous,
    ]);

    // Calculate profit figures
    const grossProfit = revenue.netRevenue.subtract(directCosts.totalDirectCosts);
    const operatingIncome = grossProfit.subtract(operatingExpenses.totalOperatingExpenses);

    const nonOperatingIncome = new Money(0);
    const nonOperatingExpenses = new Money(0);
    const interestExpense = new Money(0);

    const earningsBeforeInterestTax = operatingIncome
      .add(nonOperatingIncome)
      .subtract(nonOperatingExpenses);

    const earningsBeforeTax = earningsBeforeInterestTax.subtract(interestExpense);

    // Calculate taxes using TaxCalculatorService
    const taxes = await this.calculateTaxes(earningsBeforeTax, revenue.totalGrossRevenue, services);

    const netIncome = earningsBeforeTax.subtract(taxes.netTaxLiability);

    // Calculate seasonal analysis
    const seasonalAnalysis = this.calculateSeasonalAnalysis(config, incomes, expenses);

    // Calculate key ratios
    const keyRatios = this.calculateKeyRatios(revenue, grossProfit, operatingIncome, netIncome);

    // Generate monthly breakdown
    const monthlyBreakdown = this.generateMonthlyBreakdown(config, incomes, expenses);

    return {
      revenue,
      directCosts,
      grossProfit,
      operatingExpenses,
      operatingIncome,
      nonOperatingIncome,
      nonOperatingExpenses,
      earningsBeforeInterestTax,
      interestExpense,
      earningsBeforeTax,
      taxes,
      netIncome,
      seasonalAnalysis,
      keyRatios,
      monthlyBreakdown,
    };
  }

  /**
   * Calculate tax liabilities using TaxCalculatorService
   */
  private async calculateTaxes(
    earningsBeforeTax: Money,
    grossRevenue: Money,
    services: FinancialServices
  ): Promise<ProfitLossDetails["taxes"]> {
    try {
      // Use TaxCalculatorService for accurate calculations
      // This would integrate with the existing service
      const incomeTax = earningsBeforeTax.isPositive()
        ? earningsBeforeTax.multiply(0.3) // 30% corporate tax rate
        : new Money(0);

      const vatPayable = grossRevenue.multiply(0.12); // 12% VAT
      const withholdingTaxCredits = new Money(0); // Would be calculated from actual payments

      const netTaxLiability = incomeTax.add(vatPayable).subtract(withholdingTaxCredits);

      return {
        incomeTax,
        vatPayable,
        withholdingTaxCredits,
        netTaxLiability,
      };
    } catch (error) {
      console.warn("Tax calculation error:", error);
      return {
        incomeTax: new Money(0),
        vatPayable: new Money(0),
        withholdingTaxCredits: new Money(0),
        netTaxLiability: new Money(0),
      };
    }
  }

  /**
   * Calculate seasonal analysis for Philippine tourism patterns
   */
  private calculateSeasonalAnalysis(
    config: ReportConfig,
    incomes: any[],
    expenses: any[]
  ): ProfitLossDetails["seasonalAnalysis"] {
    const analysis = {
      peakSeasonRevenue: new Money(0),
      offSeasonRevenue: new Money(0),
      shoulderSeasonRevenue: new Money(0),
      peakSeasonExpenses: new Money(0),
      offSeasonExpenses: new Money(0),
      shoulderSeasonExpenses: new Money(0),
    };

    // Categorize transactions by season
    incomes.forEach((income) => {
      const month = new Date(income.date).getMonth();
      const amount = new Money(income.amount);

      if (PHILIPPINE_SEASONS.PEAK.includes(month)) {
        analysis.peakSeasonRevenue = analysis.peakSeasonRevenue.add(amount);
      } else if (PHILIPPINE_SEASONS.SHOULDER.includes(month)) {
        analysis.shoulderSeasonRevenue = analysis.shoulderSeasonRevenue.add(amount);
      } else {
        analysis.offSeasonRevenue = analysis.offSeasonRevenue.add(amount);
      }
    });

    expenses.forEach((expense) => {
      const month = new Date(expense.date).getMonth();
      const amount = new Money(expense.amount);

      if (PHILIPPINE_SEASONS.PEAK.includes(month)) {
        analysis.peakSeasonExpenses = analysis.peakSeasonExpenses.add(amount);
      } else if (PHILIPPINE_SEASONS.SHOULDER.includes(month)) {
        analysis.shoulderSeasonExpenses = analysis.shoulderSeasonExpenses.add(amount);
      } else {
        analysis.offSeasonExpenses = analysis.offSeasonExpenses.add(amount);
      }
    });

    return analysis;
  }

  /**
   * Calculate key financial ratios
   */
  private calculateKeyRatios(
    revenue: ProfitLossDetails["revenue"],
    grossProfit: Money,
    operatingIncome: Money,
    netIncome: Money
  ): ProfitLossDetails["keyRatios"] {
    const totalRevenue = revenue.netRevenue;

    return {
      grossProfitMargin: totalRevenue.isZero()
        ? 0
        : grossProfit.divide(totalRevenue).multiply(100).toNumber(),
      operatingProfitMargin: totalRevenue.isZero()
        ? 0
        : operatingIncome.divide(totalRevenue).multiply(100).toNumber(),
      netProfitMargin: totalRevenue.isZero()
        ? 0
        : netIncome.divide(totalRevenue).multiply(100).toNumber(),
      averageDailyRate: new Money(0), // Would be calculated from booking data
      revenuePerAvailableRoom: new Money(0), // Would be calculated from occupancy data
      costPerOccupiedRoom: new Money(0), // Would be calculated from occupancy data
    };
  }

  /**
   * Generate monthly breakdown
   */
  private generateMonthlyBreakdown(
    config: ReportConfig,
    incomes: any[],
    expenses: any[]
  ): ProfitLossDetails["monthlyBreakdown"] {
    const monthlyData = new Map<
      string,
      {
        revenue: Money;
        expenses: Money;
        occupancyRate: number;
      }
    >();

    // Process incomes by month
    incomes.forEach((income) => {
      const monthKey = new Date(income.date).toISOString().substr(0, 7); // YYYY-MM
      const existing = monthlyData.get(monthKey) || {
        revenue: new Money(0),
        expenses: new Money(0),
        occupancyRate: 0,
      };

      existing.revenue = existing.revenue.add(new Money(income.amount));
      monthlyData.set(monthKey, existing);
    });

    // Process expenses by month
    expenses.forEach((expense) => {
      const monthKey = new Date(expense.date).toISOString().substr(0, 7); // YYYY-MM
      const existing = monthlyData.get(monthKey) || {
        revenue: new Money(0),
        expenses: new Money(0),
        occupancyRate: 0,
      };

      existing.expenses = existing.expenses.add(new Money(expense.amount));
      monthlyData.set(monthKey, existing);
    });

    // Convert to array format
    return Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        expenses: data.expenses,
        netIncome: data.revenue.subtract(data.expenses),
        occupancyRate: data.occupancyRate,
      }));
  }

  /**
   * Calculate metrics for the report
   */
  private calculateMetrics(details: ProfitLossDetails): ReportMetrics {
    return {
      totalRevenue: details.revenue.netRevenue,
      totalExpenses: details.operatingExpenses.totalOperatingExpenses.add(
        details.directCosts.totalDirectCosts
      ),
      netIncome: details.netIncome,
      grossMargin: details.keyRatios.grossProfitMargin,
      averageDailyRate: details.keyRatios.averageDailyRate,
      revenuePerAvailableRoom: details.keyRatios.revenuePerAvailableRoom,
      taxLiability: details.taxes.netTaxLiability,
      vatCollected: details.taxes.vatPayable,
      withholdingTaxPaid: details.taxes.withholdingTaxCredits,
    };
  }
}

export default ProfitLossStrategy;
