/**
 * BIR Form 1601EQ Generator - Quarterly Expanded Withholding Tax Return
 *
 * Generates Philippine Quarterly Expanded Withholding Tax Return (BIR Form 1601EQ)
 * with comprehensive alphalist generation for detailed payee reporting.
 *
 * Key Features:
 * - Quarterly withholding tax summary
 * - Detailed alphalist generation by payee and ATC code
 * - Professional services withholding (10% individuals, 15% corporations)
 * - Rental withholding (5% for lessors)
 * - Contractor services withholding (1-2% depending on goods/services)
 * - Comprehensive validation and compliance checking
 */

import { Money } from "@/lib/money";
import {
  Form1601EQ,
  BIRTaxpayerInfo,
  TaxPeriod,
  WithholdingTaxTransaction,
  AlphalistEntry,
} from "@/lib/bir/types";
import { generateCode } from "@/lib/utils";

/**
 * Withholding tax data for quarterly reporting
 */
interface QuarterlyWithholdingData {
  quarter: 1 | 2 | 3 | 4;
  periodStart: Date;
  periodEnd: Date;

  // Summary by ATC codes
  withholdingByATC: {
    [atcCode: string]: {
      description: string;
      totalIncomePayments: Money;
      totalTaxWithheld: Money;
      taxRate: number;
      payeeCount: number;
      transactionCount: number;
    };
  };

  // Detailed transactions for alphalist
  transactions: WithholdingTaxTransaction[];

  // Period totals
  totalIncomePayments: Money;
  totalTaxWithheld: Money;
  totalPayees: number;

  // Prior period information
  excessCreditsFromPrevious: Money;
  taxRemittedPreviously: Money;

  // Quality metrics
  dataQuality: {
    completenessScore: number;
    accuracyScore: number;
    duplicateTransactions: number;
    missingTINs: number;
  };
}

/**
 * Alphalist generation result
 */
interface AlphalistGenerationResult {
  entries: AlphalistEntry[];
  summary: {
    totalEntries: number;
    totalIncomePayments: Money;
    totalTaxWithheld: Money;
    payeeCount: number;
    averageWithholdingRate: number;
  };
  validation: {
    errors: string[];
    warnings: string[];
    missingData: string[];
  };
}

export class Form1601EQGenerator {
  /**
   * Generate complete BIR Form 1601EQ for a given quarter
   */
  async generate(
    projectId: string,
    taxPeriod: TaxPeriod,
    taxpayerInfo: BIRTaxpayerInfo,
    userId: string
  ): Promise<Form1601EQ> {
    // Validate inputs
    this.validateInputs(projectId, taxPeriod, taxpayerInfo);

    // Fetch quarterly withholding data
    const withholdingData = await this.fetchQuarterlyWithholdingData(projectId, taxPeriod);

    // Generate alphalist entries
    const alphalistResult = await this.generateAlphalist(withholdingData.transactions);

    // Calculate penalties and interests
    const penaltyCalculation = await this.calculatePenaltiesAndInterest(withholdingData, taxPeriod);

    // Generate the form
    const form1601EQ: Form1601EQ = {
      formType: "1601EQ",
      taxPeriod: `Q${taxPeriod.quarter}/${taxPeriod.year}`,
      dateOfFiling: new Date(),
      amendedReturn: false,
      sequenceNumber: await this.generateSequenceNumber(projectId, taxPeriod),
      taxpayerInfo,
      quarter: taxPeriod.quarter!,

      // Summary of withholding tax
      totalIncomePayments: withholdingData.totalIncomePayments,
      totalTaxWithheld: withholdingData.totalTaxWithheld,
      taxRemittedInReturn: withholdingData.totalTaxWithheld,
      excessCreditsFromPreviousPeriod: withholdingData.excessCreditsFromPrevious,

      // Penalties and interests
      surcharge: penaltyCalculation.surcharge,
      interest: penaltyCalculation.interest,
      compromise: penaltyCalculation.compromise,
      totalPenalties: penaltyCalculation.totalPenalties,

      // Final amounts
      totalAmountPayable: withholdingData.totalTaxWithheld
        .add(penaltyCalculation.totalPenalties)
        .subtract(withholdingData.excessCreditsFromPrevious),

      // Detailed alphalist
      alphalist: withholdingData.transactions,

      // Generated metadata
      generatedDate: new Date(),
      generatedBy: userId,
    };

    // Validate the generated form
    await this.validateGeneratedForm(form1601EQ, withholdingData, alphalistResult);

    // Audit the generation
    await this.auditFormGeneration(projectId, form1601EQ, withholdingData, userId);

    return form1601EQ;
  }

  /**
   * Generate alphalist entries for detailed payee reporting
   */
  async generateAlphalist(
    transactions: WithholdingTaxTransaction[]
  ): Promise<AlphalistGenerationResult> {
    const entries: AlphalistEntry[] = [];
    const payeeMap = new Map<string, Map<string, AlphalistEntry>>();
    let sequenceNumber = 1;

    // Group transactions by payee TIN and ATC code
    for (const transaction of transactions) {
      const payeeTIN = transaction.payeeTin;
      const atcCode = transaction.atcCode;
      const key = `${payeeTIN}-${atcCode}`;

      if (!payeeMap.has(payeeTIN)) {
        payeeMap.set(payeeTIN, new Map());
      }

      const payeeEntries = payeeMap.get(payeeTIN)!;

      if (!payeeEntries.has(atcCode)) {
        payeeEntries.set(atcCode, {
          sequenceNumber: sequenceNumber++,
          payeeTin: transaction.payeeTin,
          payeeName: transaction.payeeName,
          atcCode: transaction.atcCode,
          taxBase: new Money(0),
          taxRate: transaction.taxRate,
          taxWithheld: new Money(0),
          month1: new Money(0),
          month2: new Money(0),
          month3: new Money(0),
        });
      }

      const entry = payeeEntries.get(atcCode)!;
      entry.taxBase = entry.taxBase.add(transaction.taxBase);
      entry.taxWithheld = entry.taxWithheld.add(transaction.taxWithheld);

      // Distribute to appropriate month within quarter
      if (
        transaction.month === 1 ||
        transaction.month === 4 ||
        transaction.month === 7 ||
        transaction.month === 10
      ) {
        entry.month1 = entry.month1.add(transaction.taxWithheld);
      } else if (
        transaction.month === 2 ||
        transaction.month === 5 ||
        transaction.month === 8 ||
        transaction.month === 11
      ) {
        entry.month2 = entry.month2.add(transaction.taxWithheld);
      } else {
        entry.month3 = entry.month3.add(transaction.taxWithheld);
      }
    }

    // Flatten the map structure into entries array
    for (const payeeEntries of payeeMap.values()) {
      for (const entry of payeeEntries.values()) {
        entries.push(entry);
      }
    }

    // Sort entries by sequence number
    entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Calculate summary
    const totalIncomePayments = entries.reduce(
      (sum, entry) => sum.add(entry.taxBase),
      new Money(0)
    );

    const totalTaxWithheld = entries.reduce(
      (sum, entry) => sum.add(entry.taxWithheld),
      new Money(0)
    );

    const payeeCount = new Set(entries.map((e) => e.payeeTin)).size;
    const averageWithholdingRate = totalIncomePayments.isZero()
      ? 0
      : totalTaxWithheld.divide(totalIncomePayments).multiply(100).toNumber();

    // Validate alphalist
    const validation = this.validateAlphalist(entries);

    return {
      entries,
      summary: {
        totalEntries: entries.length,
        totalIncomePayments,
        totalTaxWithheld,
        payeeCount,
        averageWithholdingRate,
      },
      validation,
    };
  }

  /**
   * Preview quarterly withholding computation
   */
  async previewQuarterlyWithholding(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<{
    totalIncomePayments: Money;
    totalTaxWithheld: Money;
    payeeBreakdown: {
      [atcCode: string]: {
        description: string;
        incomePayments: Money;
        taxWithheld: Money;
        payeeCount: number;
      };
    };
    dueDate: Date;
    estimatedPenalty: Money;
  }> {
    const withholdingData = await this.fetchQuarterlyWithholdingData(projectId, taxPeriod);

    // Calculate due date (15th of month after quarter)
    const quarterEndMonth = taxPeriod.quarter! * 3;
    const dueDate = new Date(taxPeriod.year, quarterEndMonth, 15);

    // Estimate penalty for late filing
    const today = new Date();
    const isLate = today > dueDate;
    const estimatedPenalty = isLate
      ? withholdingData.totalTaxWithheld.multiply(0.25) // 25% surcharge
      : new Money(0);

    return {
      totalIncomePayments: withholdingData.totalIncomePayments,
      totalTaxWithheld: withholdingData.totalTaxWithheld,
      payeeBreakdown: Object.fromEntries(
        Object.entries(withholdingData.withholdingByATC).map(([atc, data]) => [
          atc,
          {
            description: data.description,
            incomePayments: data.totalIncomePayments,
            taxWithheld: data.totalTaxWithheld,
            payeeCount: data.payeeCount,
          },
        ])
      ),
      dueDate,
      estimatedPenalty,
    };
  }

  // Private implementation methods

  private validateInputs(
    projectId: string,
    taxPeriod: TaxPeriod,
    taxpayerInfo: BIRTaxpayerInfo
  ): void {
    if (!projectId) throw new Error("Project ID is required");
    if (!taxPeriod.quarter || taxPeriod.quarter < 1 || taxPeriod.quarter > 4) {
      throw new Error("Valid quarter (1-4) is required for quarterly withholding return");
    }
    if (!this.isValidTIN(taxpayerInfo.tin)) {
      throw new Error("Invalid TIN format");
    }
  }

  private async fetchQuarterlyWithholdingData(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<QuarterlyWithholdingData> {
    const quarter = taxPeriod.quarter!;
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;

    const periodStart = new Date(taxPeriod.year, startMonth - 1, 1);
    const periodEnd = new Date(taxPeriod.year, endMonth, 0, 23, 59, 59);

    // Mock data for a resort's typical quarterly withholding transactions
    const transactions: WithholdingTaxTransaction[] = [
      {
        payeeName: "Juan dela Cruz Construction Services",
        payeeTin: "123-456-789-001",
        payeeAddress: "Bauang, La Union",
        atcCode: "WC160",
        taxBase: new Money(50000),
        taxRate: 0.02,
        taxWithheld: new Money(1000),
        month: startMonth,
        particulars: "Renovation services",
      },
      {
        payeeName: "Maria Santos Professional Services",
        payeeTin: "987-654-321-001",
        payeeAddress: "San Fernando, La Union",
        atcCode: "WI010",
        taxBase: new Money(25000),
        taxRate: 0.1,
        taxWithheld: new Money(2500),
        month: startMonth + 1,
        particulars: "Legal consultancy",
      },
      {
        payeeName: "ABC Equipment Rental Corp",
        payeeTin: "456-789-123-001",
        payeeAddress: "Agoo, La Union",
        atcCode: "WI050",
        taxBase: new Money(30000),
        taxRate: 0.05,
        taxWithheld: new Money(1500),
        month: startMonth + 2,
        particulars: "Equipment rental",
      },
    ];

    // Calculate totals
    const totalIncomePayments = transactions.reduce((sum, t) => sum.add(t.taxBase), new Money(0));

    const totalTaxWithheld = transactions.reduce((sum, t) => sum.add(t.taxWithheld), new Money(0));

    // Group by ATC codes
    const withholdingByATC: { [atcCode: string]: any } = {};

    for (const transaction of transactions) {
      const atc = transaction.atcCode;
      if (!withholdingByATC[atc]) {
        withholdingByATC[atc] = {
          description: this.getATCDescription(atc),
          totalIncomePayments: new Money(0),
          totalTaxWithheld: new Money(0),
          taxRate: transaction.taxRate,
          payeeCount: 0,
          transactionCount: 0,
          payees: new Set(),
        };
      }

      withholdingByATC[atc].totalIncomePayments = withholdingByATC[atc].totalIncomePayments.add(
        transaction.taxBase
      );
      withholdingByATC[atc].totalTaxWithheld = withholdingByATC[atc].totalTaxWithheld.add(
        transaction.taxWithheld
      );
      withholdingByATC[atc].payees.add(transaction.payeeTin);
      withholdingByATC[atc].transactionCount++;
    }

    // Convert Sets to counts
    Object.values(withholdingByATC).forEach((atcData: any) => {
      atcData.payeeCount = atcData.payees.size;
      delete atcData.payees;
    });

    return {
      quarter,
      periodStart,
      periodEnd,
      withholdingByATC,
      transactions,
      totalIncomePayments,
      totalTaxWithheld,
      totalPayees: new Set(transactions.map((t) => t.payeeTin)).size,
      excessCreditsFromPrevious: new Money(0),
      taxRemittedPreviously: new Money(0),
      dataQuality: {
        completenessScore: 98,
        accuracyScore: 96,
        duplicateTransactions: 0,
        missingTINs: 0,
      },
    };
  }

  private async calculatePenaltiesAndInterest(
    withholdingData: QuarterlyWithholdingData,
    taxPeriod: TaxPeriod
  ) {
    // Calculate due date for quarterly return (15th of month after quarter end)
    const quarterEndMonth = taxPeriod.quarter! * 3;
    const dueDate = new Date(taxPeriod.year, quarterEndMonth, 15);
    const today = new Date();

    const isLate = today > dueDate;
    const daysLate = isLate
      ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // BIR penalty rates
    const surchargeRate = 0.25; // 25% surcharge for late filing
    const interestRate = 0.2; // 20% annual interest rate
    const dailyInterestRate = interestRate / 365;

    const surcharge = isLate
      ? withholdingData.totalTaxWithheld.multiply(surchargeRate)
      : new Money(0);

    const interest = isLate
      ? withholdingData.totalTaxWithheld.multiply(dailyInterestRate * daysLate)
      : new Money(0);

    const compromise = new Money(0); // Compromise penalties typically negotiated separately
    const totalPenalties = surcharge.add(interest).add(compromise);

    return {
      surcharge,
      interest,
      compromise,
      totalPenalties,
      daysLate,
    };
  }

  private async generateSequenceNumber(projectId: string, taxPeriod: TaxPeriod): Promise<number> {
    // Generate sequence number for the quarterly filing
    return 1;
  }

  private async validateGeneratedForm(
    form: Form1601EQ,
    withholdingData: QuarterlyWithholdingData,
    alphalistResult: AlphalistGenerationResult
  ): Promise<void> {
    const errors: string[] = [];

    // Validate TIN format
    if (!this.isValidTIN(form.taxpayerInfo.tin)) {
      errors.push("Invalid TIN format");
    }

    // Validate quarter
    if (form.quarter < 1 || form.quarter > 4) {
      errors.push("Invalid quarter");
    }

    // Validate amounts
    if (form.totalIncomePayments.isNegative()) {
      errors.push("Total income payments cannot be negative");
    }

    if (form.totalTaxWithheld.isNegative()) {
      errors.push("Total tax withheld cannot be negative");
    }

    // Validate alphalist consistency
    if (form.alphalist.length !== alphalistResult.entries.length) {
      errors.push("Alphalist entries count mismatch");
    }

    // Validate computation consistency
    const alphalistTotal = alphalistResult.summary.totalTaxWithheld;
    if (!form.totalTaxWithheld.equals(alphalistTotal)) {
      errors.push("Total tax withheld does not match alphalist sum");
    }

    // Add alphalist validation errors
    errors.push(...alphalistResult.validation.errors);

    if (errors.length > 0) {
      throw new Error(`Form validation failed: ${errors.join(", ")}`);
    }
  }

  private validateAlphalist(entries: AlphalistEntry[]): {
    errors: string[];
    warnings: string[];
    missingData: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingData: string[] = [];

    for (const entry of entries) {
      // Validate TIN format
      if (!this.isValidTIN(entry.payeeTin)) {
        errors.push(`Invalid TIN format for ${entry.payeeName}: ${entry.payeeTin}`);
      }

      // Validate tax computation
      const expectedTaxWithheld = entry.taxBase.multiply(entry.taxRate);
      if (!entry.taxWithheld.equals(expectedTaxWithheld)) {
        warnings.push(`Tax computation mismatch for ${entry.payeeName}`);
      }

      // Check for missing data
      if (!entry.payeeName.trim()) {
        missingData.push(`Missing payee name for TIN ${entry.payeeTin}`);
      }

      if (!entry.atcCode) {
        missingData.push(`Missing ATC code for ${entry.payeeName}`);
      }
    }

    return { errors, warnings, missingData };
  }

  private async auditFormGeneration(
    projectId: string,
    form: Form1601EQ,
    withholdingData: QuarterlyWithholdingData,
    userId: string
  ): Promise<void> {
    const auditData = {
      projectId,
      formType: form.formType,
      taxPeriod: form.taxPeriod,
      quarter: form.quarter,
      generatedBy: userId,
      generatedAt: form.generatedDate,
      dataSource: {
        transactionCount: withholdingData.transactions.length,
        payeeCount: withholdingData.totalPayees,
        dateRange: {
          from: withholdingData.periodStart,
          to: withholdingData.periodEnd,
        },
        qualityScore: Math.min(
          withholdingData.dataQuality.completenessScore,
          withholdingData.dataQuality.accuracyScore
        ),
      },
      computedAmounts: {
        totalIncomePayments: form.totalIncomePayments.toNumber(),
        totalTaxWithheld: form.totalTaxWithheld.toNumber(),
        totalPenalties: form.totalPenalties.toNumber(),
        netPayable: form.totalAmountPayable.toNumber(),
      },
      alphalistSummary: {
        entriesCount: form.alphalist.length,
        uniquePayees: new Set(form.alphalist.map((a) => a.payeeTin)).size,
      },
    };

    // In real implementation, this would be saved to audit log
    console.log("Form 1601EQ generation audit:", auditData);
  }

  private isValidTIN(tin: string): boolean {
    // Philippine TIN format: XXX-XXX-XXX-000
    const tinRegex = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
    return tinRegex.test(tin);
  }

  private getATCDescription(atcCode: string): string {
    const descriptions: { [key: string]: string } = {
      WI010: "Professional fees - Individual",
      WC010: "Professional fees - Corporation",
      WI050: "Rental of real property - Individual",
      WC050: "Rental of real property - Corporation",
      WC140: "Purchase of goods from suppliers",
      WC160: "Purchase of services",
      WI011: "Commission - Individual",
      WC011: "Commission - Corporation",
    };

    return descriptions[atcCode] || `Unknown ATC Code: ${atcCode}`;
  }
}
