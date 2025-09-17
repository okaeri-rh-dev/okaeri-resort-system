/**
 * Cash Flow Report Strategy
 *
 * Generates cash flow statements for Philippine resort operations
 * with working capital management for internal tracking.
 */

import { Money } from "@/lib/money";
import type {
  ReportConfig,
  ReportData,
  ReportMetrics,
  ReportStrategy,
} from "@/lib/services/report-engine.service";
import type { FinancialServices } from "@/features/financial/services";

// Cash Flow Specific Data Structure
export interface CashFlowDetails {
  operatingActivities: {
    netIncome: Money;
    adjustments: {
      depreciation: Money;
      badDebtExpense: Money;
      otherNonCashItems: Money;
      totalAdjustments: Money;
    };
    workingCapitalChanges: {
      accountsReceivableChange: Money;
      inventoryChange: Money;
      prepaidExpensesChange: Money;
      accountsPayableChange: Money;
      accruedLiabilitiesChange: Money;
      totalWorkingCapitalChange: Money;
    };
    netCashFromOperations: Money;
  };
  investingActivities: {
    propertyPurchases: Money;
    equipmentPurchases: Money;
    renovationCosts: Money;
    assetDisposals: Money;
    netCashFromInvesting: Money;
  };
  financingActivities: {
    loanProceeds: Money;
    loanRepayments: Money;
    capitalContributions: Money;
    dividendPayments: Money;
    netCashFromFinancing: Money;
  };
  netCashChange: Money;
  cashAtBeginning: Money;
  cashAtEnd: Money;
  // Payment analysis removed - internal admin dashboard only
  receivablesAnalysis: {
    totalReceivables: Money;
    currentReceivables: Money;
    pastDue30Days: Money;
    pastDue60Days: Money;
    pastDue90Plus: Money;
    collectionEfficiency: number;
  };
  liquidityMetrics: {
    operatingCashFlowRatio: number;
    cashConversionCycle: number; // days
    daysInReceivables: number;
    daysInPayables: number;
    freeCashFlow: Money;
    cashBurnRate: Money; // monthly
  };
}

export class CashFlowStrategy implements ReportStrategy {
  async generateReport(config: ReportConfig, services: FinancialServices): Promise<ReportData> {
    const startTime = Date.now();

    try {
      // Get cash flow data for the period
      const [receipts, investments, financing] = await Promise.all([
        this.getReceiptData(config, services),
        this.getInvestmentData(config, services),
        this.getFinancingData(config, services),
      ]);

      // Calculate cash flow details
      const details = await this.calculateCashFlow(
        config,
        receipts,
        investments,
        financing,
        services
      );

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
          dataPoints: receipts.length + investments.length + financing.length,
        },
      };
    } catch (error: any) {
      throw new Error(`Cash flow report generation failed: ${error.message}`);
    }
  }

  validateConfig(config: ReportConfig): void {
    if (config.reportType !== "cash-flow") {
      throw new Error("Invalid report type for Cash Flow strategy");
    }
  }

  getCacheKey(config: ReportConfig): string {
    const start = config.startDate.toISOString().split("T")[0];
    const end = config.endDate.toISOString().split("T")[0];
    return `report:${config.projectId}:cash-flow:${start}:${end}`;
  }

  getCacheTTL(config: ReportConfig): number {
    // Cash flow reports cached for reasonable periods
    return 60 * 60; // 1 hour
  }

  /**
   * Get receipt/income data
   */
  private async getReceiptData(config: ReportConfig, services: FinancialServices): Promise<any[]> {
    try {
      const filter = {
        projectId: config.projectId,
        dateFrom: config.startDate,
        dateTo: config.endDate,
      };

      // return await services.income.getIncomes(filter);
      return [];
    } catch (error) {
      console.warn("Error fetching receipt data:", error);
      return [];
    }
  }

  /**
   * Get investment activity data
   */
  private async getInvestmentData(
    config: ReportConfig,
    services: FinancialServices
  ): Promise<any[]> {
    try {
      const filter = {
        projectId: config.projectId,
        dateFrom: config.startDate,
        dateTo: config.endDate,
        categories: ["CAPITAL_EXPENDITURE", "EQUIPMENT", "RENOVATION"],
      };

      // return await services.expense.getExpensesByCategories(filter);
      return [];
    } catch (error) {
      console.warn("Error fetching investment data:", error);
      return [];
    }
  }

  /**
   * Get financing activity data
   */
  private async getFinancingData(
    config: ReportConfig,
    services: FinancialServices
  ): Promise<any[]> {
    try {
      // This would include loans, capital contributions, etc.
      // For now, return empty array
      return [];
    } catch (error) {
      console.warn("Error fetching financing data:", error);
      return [];
    }
  }

  /**
   * Calculate comprehensive cash flow details
   */
  private async calculateCashFlow(
    config: ReportConfig,
    receipts: any[],
    investments: any[],
    financing: any[],
    services: FinancialServices
  ): Promise<CashFlowDetails> {
    // Calculate operating activities
    const operatingActivities = {
      netIncome: new Money(0), // Would come from P&L calculation
      adjustments: {
        depreciation: new Money(0),
        badDebtExpense: new Money(0),
        otherNonCashItems: new Money(0),
        totalAdjustments: new Money(0),
      },
      workingCapitalChanges: {
        accountsReceivableChange: new Money(0),
        inventoryChange: new Money(0),
        prepaidExpensesChange: new Money(0),
        accountsPayableChange: new Money(0),
        accruedLiabilitiesChange: new Money(0),
        totalWorkingCapitalChange: new Money(0),
      },
      netCashFromOperations: new Money(0),
    };

    // Calculate total adjustments
    operatingActivities.adjustments.totalAdjustments = Money.sum([
      operatingActivities.adjustments.depreciation,
      operatingActivities.adjustments.badDebtExpense,
      operatingActivities.adjustments.otherNonCashItems,
    ]);

    // Calculate total working capital changes
    operatingActivities.workingCapitalChanges.totalWorkingCapitalChange = Money.sum([
      operatingActivities.workingCapitalChanges.accountsReceivableChange,
      operatingActivities.workingCapitalChanges.inventoryChange,
      operatingActivities.workingCapitalChanges.prepaidExpensesChange,
      operatingActivities.workingCapitalChanges.accountsPayableChange,
      operatingActivities.workingCapitalChanges.accruedLiabilitiesChange,
    ]);

    // Net cash from operations
    operatingActivities.netCashFromOperations = operatingActivities.netIncome
      .add(operatingActivities.adjustments.totalAdjustments)
      .add(operatingActivities.workingCapitalChanges.totalWorkingCapitalChange);

    // Calculate investing activities
    const investingActivities = {
      propertyPurchases: new Money(0),
      equipmentPurchases: new Money(0),
      renovationCosts: new Money(0),
      assetDisposals: new Money(0),
      netCashFromInvesting: new Money(0),
    };

    // Process investment transactions
    investments.forEach((investment) => {
      const amount = new Money(investment.amount);

      switch (investment.category) {
        case "PROPERTY":
          investingActivities.propertyPurchases = investingActivities.propertyPurchases.add(amount);
          break;
        case "EQUIPMENT":
          investingActivities.equipmentPurchases =
            investingActivities.equipmentPurchases.add(amount);
          break;
        case "RENOVATION":
          investingActivities.renovationCosts = investingActivities.renovationCosts.add(amount);
          break;
      }
    });

    investingActivities.netCashFromInvesting = investingActivities.assetDisposals
      .subtract(investingActivities.propertyPurchases)
      .subtract(investingActivities.equipmentPurchases)
      .subtract(investingActivities.renovationCosts);

    // Calculate financing activities
    const financingActivities = {
      loanProceeds: new Money(0),
      loanRepayments: new Money(0),
      capitalContributions: new Money(0),
      dividendPayments: new Money(0),
      netCashFromFinancing: new Money(0),
    };

    // Process financing transactions
    financing.forEach((transaction) => {
      const amount = new Money(transaction.amount);

      switch (transaction.type) {
        case "LOAN_PROCEEDS":
          financingActivities.loanProceeds = financingActivities.loanProceeds.add(amount);
          break;
        case "LOAN_REPAYMENT":
          financingActivities.loanRepayments = financingActivities.loanRepayments.add(amount);
          break;
        case "CAPITAL_CONTRIBUTION":
          financingActivities.capitalContributions =
            financingActivities.capitalContributions.add(amount);
          break;
        case "DIVIDEND":
          financingActivities.dividendPayments = financingActivities.dividendPayments.add(amount);
          break;
      }
    });

    financingActivities.netCashFromFinancing = financingActivities.loanProceeds
      .add(financingActivities.capitalContributions)
      .subtract(financingActivities.loanRepayments)
      .subtract(financingActivities.dividendPayments);

    // Calculate net cash change
    const netCashChange = operatingActivities.netCashFromOperations
      .add(investingActivities.netCashFromInvesting)
      .add(financingActivities.netCashFromFinancing);

    // Calculate cash positions (these would come from actual cash balances)
    const cashAtBeginning = new Money(0); // Would be calculated from opening balance
    const cashAtEnd = cashAtBeginning.add(netCashChange);

    // Payment method analysis removed - internal admin only

    // Calculate receivables analysis
    const receivablesAnalysis = this.analyzeReceivables(receipts, config);

    // Calculate liquidity metrics
    const liquidityMetrics = this.calculateLiquidityMetrics(
      operatingActivities.netCashFromOperations,
      cashAtEnd,
      receivablesAnalysis
    );

    return {
      operatingActivities,
      investingActivities,
      financingActivities,
      netCashChange,
      cashAtBeginning,
      cashAtEnd,
      receivablesAnalysis,
      liquidityMetrics,
    };
  }

  /**
   * Analyze receivables aging
   */
  private analyzeReceivables(
    receipts: any[],
    config: ReportConfig
  ): CashFlowDetails["receivablesAnalysis"] {
    // This would analyze outstanding receivables by aging buckets
    // For now, return placeholder values
    const totalReceivables = new Money(0);

    return {
      totalReceivables,
      currentReceivables: new Money(0),
      pastDue30Days: new Money(0),
      pastDue60Days: new Money(0),
      pastDue90Plus: new Money(0),
      collectionEfficiency: 0, // Percentage of receivables collected on time
    };
  }

  /**
   * Calculate liquidity metrics
   */
  private calculateLiquidityMetrics(
    operatingCashFlow: Money,
    cashBalance: Money,
    receivables: CashFlowDetails["receivablesAnalysis"]
  ): CashFlowDetails["liquidityMetrics"] {
    // These calculations would use actual financial data
    const freeCashFlow = operatingCashFlow; // Simplified - would subtract capital expenditures

    return {
      operatingCashFlowRatio: 0, // Operating cash flow / Current liabilities
      cashConversionCycle: 0, // Days to convert investments to cash
      daysInReceivables: 0, // Average collection period
      daysInPayables: 0, // Average payment period
      freeCashFlow,
      cashBurnRate: new Money(0), // Monthly cash consumption
    };
  }

  /**
   * Calculate metrics for the report
   */
  private calculateMetrics(details: CashFlowDetails): ReportMetrics {
    return {
      totalRevenue: details.operatingActivities.netCashFromOperations,
      totalExpenses: new Money(0), // Would calculate from expense outflows
      netIncome: details.netCashChange,
      grossMargin: 0,
      taxLiability: new Money(0),
      vatCollected: new Money(0),
      withholdingTaxPaid: new Money(0),
    };
  }
}

export default CashFlowStrategy;
