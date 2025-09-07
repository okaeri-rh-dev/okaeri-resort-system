/**
 * BIR Form 2550M Generator - Monthly VAT Return
 *
 * Generates Philippine Monthly VAT Return (BIR Form 2550M) with comprehensive
 * calculation support for VAT-registered businesses. Handles vatable sales,
 * exempt transactions, zero-rated sales, input VAT, and adjustments.
 *
 * Key Features:
 * - Accurate VAT calculations (12% standard rate)
 * - Input/Output VAT reconciliation
 * - Prior period adjustments
 * - Excess credit handling
 * - Data validation and completeness checks
 */

import { Money } from "@/lib/money";
import { TaxCalculatorService } from "@/features/financial/services/tax-calculator.service";
import { db } from "@/lib/db";
import {
  Form2550M,
  BIRTaxpayerInfo,
  TaxPeriod,
  VATSalesBreakdown,
  VATInputTax,
} from "@/lib/bir/types";

/**
 * VAT transaction data from database
 */
interface VATTransactionData {
  // Sales transactions
  vatableSales: {
    amount: Money;
    transactionCount: number;
    averageTransactionValue: Money;
  };
  vatExemptSales: {
    amount: Money;
    transactionCount: number;
    exemptionReasons: string[];
  };
  zeroRatedSales: {
    amount: Money;
    transactionCount: number;
    zeroRatedTypes: string[];
  };

  // Purchase transactions
  inputVATPurchases: {
    domesticPurchases: Money;
    importations: Money;
    services: Money;
    capitalGoods: Money;
  };

  // Adjustments
  adjustments: {
    priorPeriodCorrections: Money;
    badDebtRecoveries: Money;
    returnsAllowances: Money;
  };

  // Period information
  periodStart: Date;
  periodEnd: Date;
  dataQuality: {
    completenessScore: number;
    accuracyScore: number;
    consistencyScore: number;
  };
}

/**
 * VAT computation result
 */
interface VATComputationResult {
  outputVAT: Money;
  inputVAT: Money;
  netVATPayable: Money;
  excessInputVAT: Money;
  adjustmentAmount: Money;
  finalAmountDue: Money;

  // Supporting calculations
  computationDetails: {
    effectiveVATRate: number;
    inputVATRatio: number;
    complianceScore: number;
  };
}

export class Form2550MGenerator {
  private taxCalculator: TaxCalculatorService;

  constructor() {
    this.taxCalculator = new TaxCalculatorService();
  }

  /**
   * Generate complete BIR Form 2550M for a given tax period
   */
  async generate(
    projectId: string,
    taxPeriod: TaxPeriod,
    taxpayerInfo: BIRTaxpayerInfo,
    userId: string
  ): Promise<Form2550M> {
    // Validate inputs
    this.validateInputs(projectId, taxPeriod, taxpayerInfo);

    // Fetch VAT transaction data
    const transactionData = await this.fetchVATTransactionData(projectId, taxPeriod);

    // Perform VAT calculations
    const computationResult = await this.computeVAT(transactionData);

    // Prepare sales breakdown
    const salesBreakdown = this.prepareSalesBreakdown(transactionData, computationResult);

    // Prepare input tax breakdown
    const inputTax = this.prepareInputTaxBreakdown(transactionData);

    // Handle excess credits from previous period
    const excessCreditsFromPrevious = await this.getExcessCreditsFromPreviousPeriod(
      projectId,
      taxPeriod
    );

    // Calculate final amounts with adjustments
    const finalAmounts = this.calculateFinalAmounts(
      computationResult,
      excessCreditsFromPrevious,
      transactionData.adjustments
    );

    // Generate the form
    const form2550M: Form2550M = {
      formType: "2550M",
      taxPeriod: `${taxPeriod.month!.toString().padStart(2, "0")}/${taxPeriod.year}`,
      dateOfFiling: new Date(),
      amendedReturn: false,
      sequenceNumber: await this.generateSequenceNumber(projectId, taxPeriod),
      taxpayerInfo,

      // Part I - VAT on Sales
      salesBreakdown,

      // Part II - VAT on Purchases/Input VAT
      inputTax,

      // Part III - Computation of VAT Payable/Refundable
      totalOutputVAT: computationResult.outputVAT,
      totalInputVAT: computationResult.inputVAT,
      vatPayable: computationResult.netVATPayable.isPositive()
        ? computationResult.netVATPayable
        : new Money(0),
      vatRefundable: computationResult.netVATPayable.isNegative()
        ? computationResult.netVATPayable.abs()
        : new Money(0),
      excessCreditsFromPreviousPeriod: excessCreditsFromPrevious,

      // Part IV - Adjustments
      adjustments: {
        priorPeriodErrors: transactionData.adjustments.priorPeriodCorrections,
        succeededByCapitalGainsTax: new Money(0), // Typically not applicable for resorts
        others: transactionData.adjustments.badDebtRecoveries.add(
          transactionData.adjustments.returnsAllowances
        ),
      },

      // Final computation
      netAmountPayable: finalAmounts.netAmountPayable,
      penalties: finalAmounts.penalties,
      totalAmountPayable: finalAmounts.totalAmountPayable,

      // Generated metadata
      generatedDate: new Date(),
      generatedBy: userId,
    };

    // Validate the generated form
    await this.validateGeneratedForm(form2550M);

    // Log the generation for audit purposes
    await this.auditFormGeneration(projectId, form2550M, transactionData, userId);

    return form2550M;
  }

  /**
   * Preview VAT computation without generating the full form
   */
  async previewVATComputation(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<VATComputationResult> {
    const transactionData = await this.fetchVATTransactionData(projectId, taxPeriod);
    return await this.computeVAT(transactionData);
  }

  /**
   * Calculate VAT liability for a specific period
   */
  async calculateVATLiability(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<{
    vatDue: Money;
    dueDate: Date;
    penaltyRate: number;
    lateFilingPenalty: Money;
  }> {
    const transactionData = await this.fetchVATTransactionData(projectId, taxPeriod);
    const computation = await this.computeVAT(transactionData);

    // Calculate due date (20th of the following month)
    const dueDate = new Date(taxPeriod.year, taxPeriod.month!, 20);

    // Calculate penalties if filing late
    const today = new Date();
    const isLate = today > dueDate;
    const penaltyRate = 0.25; // 25% surcharge for late filing
    const lateFilingPenalty = isLate
      ? computation.netVATPayable.multiply(penaltyRate)
      : new Money(0);

    return {
      vatDue: computation.netVATPayable.isPositive() ? computation.netVATPayable : new Money(0),
      dueDate,
      penaltyRate,
      lateFilingPenalty,
    };
  }

  // Private implementation methods

  private validateInputs(
    projectId: string,
    taxPeriod: TaxPeriod,
    taxpayerInfo: BIRTaxpayerInfo
  ): void {
    if (!projectId) throw new Error("Project ID is required");
    if (!taxPeriod.month || taxPeriod.month < 1 || taxPeriod.month > 12) {
      throw new Error("Valid month (1-12) is required for monthly VAT return");
    }
    if (!taxpayerInfo.isVATRegistered) {
      throw new Error("Business must be VAT registered to file Form 2550M");
    }
    if (!this.isValidTIN(taxpayerInfo.tin)) {
      throw new Error("Invalid TIN format");
    }
  }

  private async fetchVATTransactionData(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<VATTransactionData> {
    const periodStart = new Date(taxPeriod.year, taxPeriod.month! - 1, 1);
    const periodEnd = new Date(taxPeriod.year, taxPeriod.month!, 0, 23, 59, 59);

    // In a real implementation, this would query the actual database
    // For now, returning mock data with realistic values for a resort
    return {
      vatableSales: {
        amount: new Money(250000), // ₱250,000 in vatable room sales
        transactionCount: 45,
        averageTransactionValue: new Money(5556),
      },
      vatExemptSales: {
        amount: new Money(15000), // Senior/PWD discounts
        transactionCount: 8,
        exemptionReasons: ["Senior Citizen Discount (RA 9994)", "PWD Discount (RA 10754)"],
      },
      zeroRatedSales: {
        amount: new Money(0), // Typically no zero-rated sales for resorts
        transactionCount: 0,
        zeroRatedTypes: [],
      },
      inputVATPurchases: {
        domesticPurchases: new Money(80000), // Supplies, utilities, services
        importations: new Money(0),
        services: new Money(20000), // Professional services, repairs
        capitalGoods: new Money(50000), // Equipment purchases
      },
      adjustments: {
        priorPeriodCorrections: new Money(0),
        badDebtRecoveries: new Money(0),
        returnsAllowances: new Money(2000), // Guest refunds
      },
      periodStart,
      periodEnd,
      dataQuality: {
        completenessScore: 95,
        accuracyScore: 98,
        consistencyScore: 92,
      },
    };
  }

  private async computeVAT(data: VATTransactionData): Promise<VATComputationResult> {
    // Calculate output VAT (12% of vatable sales)
    const outputVAT = data.vatableSales.amount.multiply(0.12);

    // Calculate total input VAT
    const totalInputVAT = data.inputVATPurchases.domesticPurchases
      .add(data.inputVATPurchases.services)
      .add(data.inputVATPurchases.capitalGoods)
      .multiply(0.12) // 12% input VAT
      .add(data.inputVATPurchases.importations.multiply(0.12)); // VAT on imports

    // Net VAT computation
    const netVATPayable = outputVAT.subtract(totalInputVAT);

    // Handle excess input VAT
    const excessInputVAT = netVATPayable.isNegative() ? netVATPayable.abs() : new Money(0);

    // Apply adjustments
    const adjustmentAmount = data.adjustments.priorPeriodCorrections.subtract(
      data.adjustments.returnsAllowances
    );

    const finalAmountDue = netVATPayable.add(adjustmentAmount);

    // Calculate performance metrics
    const totalSales = data.vatableSales.amount
      .add(data.vatExemptSales.amount)
      .add(data.zeroRatedSales.amount);

    const effectiveVATRate = totalSales.isZero()
      ? 0
      : outputVAT.divide(totalSales).multiply(100).toNumber();

    const inputVATRatio = outputVAT.isZero()
      ? 0
      : totalInputVAT.divide(outputVAT).multiply(100).toNumber();

    const complianceScore = Math.min(
      data.dataQuality.completenessScore,
      data.dataQuality.accuracyScore,
      data.dataQuality.consistencyScore
    );

    return {
      outputVAT,
      inputVAT: totalInputVAT,
      netVATPayable: netVATPayable.isPositive() ? netVATPayable : new Money(0),
      excessInputVAT,
      adjustmentAmount,
      finalAmountDue,
      computationDetails: {
        effectiveVATRate,
        inputVATRatio,
        complianceScore,
      },
    };
  }

  private prepareSalesBreakdown(
    data: VATTransactionData,
    computation: VATComputationResult
  ): VATSalesBreakdown {
    return {
      vatableSales: data.vatableSales.amount,
      vatZeroRated: data.zeroRatedSales.amount,
      vatExempt: data.vatExemptSales.amount,
      outputVAT: computation.outputVAT,
      totalSales: data.vatableSales.amount
        .add(data.vatExemptSales.amount)
        .add(data.zeroRatedSales.amount),
    };
  }

  private prepareInputTaxBreakdown(data: VATTransactionData): VATInputTax {
    const domesticInputVAT = data.inputVATPurchases.domesticPurchases
      .add(data.inputVATPurchases.services)
      .multiply(0.12);

    const importInputVAT = data.inputVATPurchases.importations.multiply(0.12);
    const capitalGoodsInputVAT = data.inputVATPurchases.capitalGoods.multiply(0.12);

    return {
      domesticPurchases: domesticInputVAT,
      importations: importInputVAT,
      transitionalInputTax: new Money(0), // Rare for resorts
      presumptiveInputTax: new Money(0), // Not applicable for most resorts
      totalInputVAT: domesticInputVAT.add(importInputVAT).add(capitalGoodsInputVAT),
      inputVATFromPreviousPeriod: new Money(0), // Would come from previous period
    };
  }

  private async getExcessCreditsFromPreviousPeriod(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<Money> {
    // This would query the previous period's return for excess credits
    // For now, returning zero
    return new Money(0);
  }

  private calculateFinalAmounts(
    computation: VATComputationResult,
    excessCredits: Money,
    adjustments: {
      priorPeriodCorrections: Money;
      badDebtRecoveries: Money;
      returnsAllowances: Money;
    }
  ) {
    const netBeforeCredits = computation.netVATPayable
      .add(adjustments.priorPeriodCorrections)
      .subtract(adjustments.returnsAllowances);

    const netAmountPayable = netBeforeCredits.subtract(excessCredits);
    const penalties = new Money(0); // Would calculate based on filing date
    const totalAmountPayable = netAmountPayable.add(penalties);

    return {
      netAmountPayable: netAmountPayable.isPositive() ? netAmountPayable : new Money(0),
      penalties,
      totalAmountPayable: totalAmountPayable.isPositive() ? totalAmountPayable : new Money(0),
    };
  }

  private async generateSequenceNumber(projectId: string, taxPeriod: TaxPeriod): Promise<number> {
    // Generate sequence number for the filing
    // This would typically be based on the number of filings for the period
    return 1;
  }

  private async validateGeneratedForm(form: Form2550M): Promise<void> {
    const errors: string[] = [];

    // Validate TIN format
    if (!this.isValidTIN(form.taxpayerInfo.tin)) {
      errors.push("Invalid TIN format");
    }

    // Validate amounts
    if (form.salesBreakdown.outputVAT.isNegative()) {
      errors.push("Output VAT cannot be negative");
    }

    if (form.inputTax.totalInputVAT.isNegative()) {
      errors.push("Input VAT cannot be negative");
    }

    // Validate computation consistency
    const expectedOutputVAT = form.salesBreakdown.vatableSales.multiply(0.12);
    if (!form.salesBreakdown.outputVAT.equals(expectedOutputVAT)) {
      errors.push("Output VAT calculation inconsistent with vatable sales");
    }

    if (errors.length > 0) {
      throw new Error(`Form validation failed: ${errors.join(", ")}`);
    }
  }

  private async auditFormGeneration(
    projectId: string,
    form: Form2550M,
    transactionData: VATTransactionData,
    userId: string
  ): Promise<void> {
    // Log form generation for audit trail
    const auditData = {
      projectId,
      formType: form.formType,
      taxPeriod: form.taxPeriod,
      generatedBy: userId,
      generatedAt: form.generatedDate,
      dataSource: {
        transactionCount:
          transactionData.vatableSales.transactionCount +
          transactionData.vatExemptSales.transactionCount,
        dateRange: {
          from: transactionData.periodStart,
          to: transactionData.periodEnd,
        },
        qualityScore: Math.min(
          transactionData.dataQuality.completenessScore,
          transactionData.dataQuality.accuracyScore
        ),
      },
      computedAmounts: {
        outputVAT: form.salesBreakdown.outputVAT.toNumber(),
        inputVAT: form.inputTax.totalInputVAT.toNumber(),
        netPayable: form.netAmountPayable.toNumber(),
      },
    };

    // In real implementation, this would be saved to audit log
    console.log("Form 2550M generation audit:", auditData);
  }

  private isValidTIN(tin: string): boolean {
    // Philippine TIN format: XXX-XXX-XXX-000
    const tinRegex = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
    return tinRegex.test(tin);
  }
}
