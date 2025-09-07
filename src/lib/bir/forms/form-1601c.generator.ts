/**
 * BIR Form 1601C Generator - Monthly Expanded Withholding Tax Return
 *
 * Generates Philippine Monthly Expanded Withholding Tax Return (BIR Form 1601C)
 * for monthly reporting of withholding tax payments by ATC codes.
 *
 * Key Features:
 * - Monthly withholding tax summary by ATC codes
 * - Professional services withholding tracking
 * - Contractor and rental withholding calculations
 * - Commission and talent fee withholding
 * - Monthly filing compliance for timely tax remittance
 */

import { Money } from "@/lib/money";
import { Form1601C, BIRTaxpayerInfo, TaxPeriod, WithholdingTaxTransaction } from "@/lib/bir/types";
import { generateCode } from "@/lib/utils";

/**
 * Monthly withholding data structure
 */
interface MonthlyWithholdingData {
  month: number; // 1-12
  periodStart: Date;
  periodEnd: Date;

  // Withholding transactions grouped by ATC code
  transactionsByATC: {
    [atcCode: string]: {
      description: string;
      transactions: WithholdingTaxTransaction[];
      totalIncomePayments: Money;
      totalTaxWithheld: Money;
      taxRate: number;
      payeeCount: number;
    };
  };

  // Monthly totals
  totalIncomePayments: Money;
  totalTaxWithheld: Money;
  totalPayees: number;
  totalTransactions: number;

  // Prior remittances
  previousRemittances: Money;
  excessCredits: Money;

  // Compliance metrics
  compliance: {
    filingDeadline: Date;
    isOnTime: boolean;
    penaltyRate: number;
    estimatedPenalty: Money;
  };

  // Data quality indicators
  dataQuality: {
    completenessScore: number;
    accuracyScore: number;
    validationWarnings: string[];
  };
}

/**
 * ATC code summary for reporting
 */
interface ATCCodeSummary {
  atcCode: string;
  description: string;
  incomePayments: Money;
  taxWithheld: Money;
  taxRate: number;
  payeeCount: number;
  transactionCount: number;
  averageTransactionSize: Money;
}

export class Form1601CGenerator {
  /**
   * Generate complete BIR Form 1601C for a given month
   */
  async generate(
    projectId: string,
    taxPeriod: TaxPeriod,
    taxpayerInfo: BIRTaxpayerInfo,
    userId: string
  ): Promise<Form1601C> {
    // Validate inputs
    this.validateInputs(projectId, taxPeriod, taxpayerInfo);

    // Fetch monthly withholding data
    const withholdingData = await this.fetchMonthlyWithholdingData(projectId, taxPeriod);

    // Calculate penalties and interests
    const penaltyCalculation = this.calculatePenaltiesAndInterest(withholdingData);

    // Prepare withholding summary by ATC codes
    const withholdingByATC = this.prepareWithholdingByATC(withholdingData);

    // Generate the form
    const form1601C: Form1601C = {
      formType: "1601C",
      taxPeriod: `${taxPeriod.month!.toString().padStart(2, "0")}/${taxPeriod.year}`,
      dateOfFiling: new Date(),
      amendedReturn: false,
      sequenceNumber: await this.generateSequenceNumber(projectId, taxPeriod),
      taxpayerInfo,
      month: taxPeriod.month!,

      // Summary by ATC codes
      withholdingByATC,

      // Monthly totals
      totalIncomePayments: withholdingData.totalIncomePayments,
      totalTaxWithheld: withholdingData.totalTaxWithheld,
      taxRemittedInReturn: withholdingData.totalTaxWithheld,

      // Penalties and interests
      surcharge: penaltyCalculation.surcharge,
      interest: penaltyCalculation.interest,
      totalPenalties: penaltyCalculation.totalPenalties,

      // Final amount payable
      totalAmountPayable: withholdingData.totalTaxWithheld
        .add(penaltyCalculation.totalPenalties)
        .subtract(withholdingData.excessCredits),

      // Generated metadata
      generatedDate: new Date(),
      generatedBy: userId,
    };

    // Validate the generated form
    await this.validateGeneratedForm(form1601C, withholdingData);

    // Audit the generation
    await this.auditFormGeneration(projectId, form1601C, withholdingData, userId);

    return form1601C;
  }

  /**
   * Preview monthly withholding computation
   */
  async previewMonthlyWithholding(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<{
    totalIncomePayments: Money;
    totalTaxWithheld: Money;
    atcCodeBreakdown: ATCCodeSummary[];
    filingDeadline: Date;
    estimatedPenalty: Money;
    complianceScore: number;
  }> {
    const withholdingData = await this.fetchMonthlyWithholdingData(projectId, taxPeriod);

    // Prepare ATC code breakdown
    const atcCodeBreakdown: ATCCodeSummary[] = Object.entries(withholdingData.transactionsByATC)
      .map(([atcCode, data]) => ({
        atcCode,
        description: data.description,
        incomePayments: data.totalIncomePayments,
        taxWithheld: data.totalTaxWithheld,
        taxRate: data.taxRate,
        payeeCount: data.payeeCount,
        transactionCount: data.transactions.length,
        averageTransactionSize: data.totalIncomePayments.divide(data.transactions.length || 1),
      }))
      .sort((a, b) => b.taxWithheld.toNumber() - a.taxWithheld.toNumber());

    return {
      totalIncomePayments: withholdingData.totalIncomePayments,
      totalTaxWithheld: withholdingData.totalTaxWithheld,
      atcCodeBreakdown,
      filingDeadline: withholdingData.compliance.filingDeadline,
      estimatedPenalty: withholdingData.compliance.estimatedPenalty,
      complianceScore: Math.min(
        withholdingData.dataQuality.completenessScore,
        withholdingData.dataQuality.accuracyScore
      ),
    };
  }

  /**
   * Get withholding tax liability for specific month
   */
  async getMonthlyWithholdingLiability(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<{
    taxDue: Money;
    dueDate: Date;
    penaltyIfLate: Money;
    paymentInstructions: string[];
  }> {
    const withholdingData = await this.fetchMonthlyWithholdingData(projectId, taxPeriod);

    // Due date is 15th of following month
    const dueDate = new Date(taxPeriod.year, taxPeriod.month!, 15);

    // Calculate penalty for late payment (25% surcharge + 20% annual interest)
    const today = new Date();
    const isLate = today > dueDate;
    const penaltyIfLate = isLate
      ? withholdingData.totalTaxWithheld.multiply(0.25) // 25% surcharge
      : new Money(0);

    return {
      taxDue: withholdingData.totalTaxWithheld,
      dueDate,
      penaltyIfLate,
      paymentInstructions: [
        "Payment should be made to authorized agent banks (AAB)",
        "Use BIR Form 0605 for payment",
        "File return within 15 days after the end of the month",
        "Keep all supporting documents for audit purposes",
      ],
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
      throw new Error("Valid month (1-12) is required for monthly withholding return");
    }
    if (!this.isValidTIN(taxpayerInfo.tin)) {
      throw new Error("Invalid TIN format");
    }
  }

  private async fetchMonthlyWithholdingData(
    projectId: string,
    taxPeriod: TaxPeriod
  ): Promise<MonthlyWithholdingData> {
    const periodStart = new Date(taxPeriod.year, taxPeriod.month! - 1, 1);
    const periodEnd = new Date(taxPeriod.year, taxPeriod.month!, 0, 23, 59, 59);
    const filingDeadline = new Date(taxPeriod.year, taxPeriod.month!, 15);

    // Mock data representing typical resort monthly withholding transactions
    const allTransactions: WithholdingTaxTransaction[] = [
      // Professional services
      {
        payeeName: "ABC Legal Services",
        payeeTin: "123-456-789-001",
        payeeAddress: "San Fernando, La Union",
        atcCode: "WI010",
        taxBase: new Money(15000),
        taxRate: 0.1,
        taxWithheld: new Money(1500),
        month: taxPeriod.month!,
        particulars: "Legal consultation services",
      },
      // Contractor services
      {
        payeeName: "XYZ Construction Corp",
        payeeTin: "987-654-321-001",
        payeeAddress: "Bauang, La Union",
        atcCode: "WC160",
        taxBase: new Money(25000),
        taxRate: 0.02,
        taxWithheld: new Money(500),
        month: taxPeriod.month!,
        particulars: "Maintenance and repair services",
      },
      // Equipment rental
      {
        payeeName: "DEF Equipment Rental",
        payeeTin: "456-789-123-001",
        payeeAddress: "Agoo, La Union",
        atcCode: "WI050",
        taxBase: new Money(12000),
        taxRate: 0.05,
        taxWithheld: new Money(600),
        month: taxPeriod.month!,
        particulars: "Equipment rental - generators",
      },
      // Commission payments
      {
        payeeName: "GHI Marketing Agency",
        payeeTin: "321-654-987-001",
        payeeAddress: "La Union",
        atcCode: "WI011",
        taxBase: new Money(8000),
        taxRate: 0.1,
        taxWithheld: new Money(800),
        month: taxPeriod.month!,
        particulars: "Marketing commission",
      },
    ];

    // Group transactions by ATC code
    const transactionsByATC: { [atcCode: string]: any } = {};

    for (const transaction of allTransactions) {
      const atc = transaction.atcCode;
      if (!transactionsByATC[atc]) {
        transactionsByATC[atc] = {
          description: this.getATCDescription(atc),
          transactions: [],
          totalIncomePayments: new Money(0),
          totalTaxWithheld: new Money(0),
          taxRate: transaction.taxRate,
          payeeCount: 0,
          payees: new Set<string>(),
        };
      }

      transactionsByATC[atc].transactions.push(transaction);
      transactionsByATC[atc].totalIncomePayments = transactionsByATC[atc].totalIncomePayments.add(
        transaction.taxBase
      );
      transactionsByATC[atc].totalTaxWithheld = transactionsByATC[atc].totalTaxWithheld.add(
        transaction.taxWithheld
      );
      transactionsByATC[atc].payees.add(transaction.payeeTin);
    }

    // Convert payee sets to counts
    Object.values(transactionsByATC).forEach((atcData: any) => {
      atcData.payeeCount = atcData.payees.size;
      delete atcData.payees;
    });

    // Calculate totals
    const totalIncomePayments = allTransactions.reduce(
      (sum, t) => sum.add(t.taxBase),
      new Money(0)
    );

    const totalTaxWithheld = allTransactions.reduce(
      (sum, t) => sum.add(t.taxWithheld),
      new Money(0)
    );

    const totalPayees = new Set(allTransactions.map((t) => t.payeeTin)).size;

    // Compliance calculation
    const today = new Date();
    const isOnTime = today <= filingDeadline;
    const daysLate = isOnTime
      ? 0
      : Math.ceil((today.getTime() - filingDeadline.getTime()) / (1000 * 60 * 60 * 24));
    const estimatedPenalty = isOnTime ? new Money(0) : totalTaxWithheld.multiply(0.25); // 25% surcharge

    return {
      month: taxPeriod.month!,
      periodStart,
      periodEnd,
      transactionsByATC,
      totalIncomePayments,
      totalTaxWithheld,
      totalPayees,
      totalTransactions: allTransactions.length,
      previousRemittances: new Money(0),
      excessCredits: new Money(0),
      compliance: {
        filingDeadline,
        isOnTime,
        penaltyRate: isOnTime ? 0 : 0.25,
        estimatedPenalty,
      },
      dataQuality: {
        completenessScore: 98,
        accuracyScore: 96,
        validationWarnings: [],
      },
    };
  }

  private calculatePenaltiesAndInterest(withholdingData: MonthlyWithholdingData) {
    const isLate = !withholdingData.compliance.isOnTime;

    // BIR penalty structure for withholding tax
    const surchargeRate = 0.25; // 25% surcharge
    const interestRate = 0.2; // 20% annual interest

    const surcharge = isLate
      ? withholdingData.totalTaxWithheld.multiply(surchargeRate)
      : new Money(0);

    // Interest calculation for days late
    const today = new Date();
    const daysLate = isLate
      ? Math.ceil(
          (today.getTime() - withholdingData.compliance.filingDeadline.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    const dailyInterestRate = interestRate / 365;
    const interest = isLate
      ? withholdingData.totalTaxWithheld.multiply(dailyInterestRate * daysLate)
      : new Money(0);

    const totalPenalties = surcharge.add(interest);

    return {
      surcharge,
      interest,
      totalPenalties,
      daysLate,
    };
  }

  private prepareWithholdingByATC(withholdingData: MonthlyWithholdingData) {
    const withholdingByATC: { [atcCode: string]: any } = {};

    for (const [atcCode, atcData] of Object.entries(withholdingData.transactionsByATC)) {
      withholdingByATC[atcCode] = {
        incomePayments: atcData.totalIncomePayments,
        taxWithheld: atcData.totalTaxWithheld,
        taxRate: atcData.taxRate,
      };
    }

    return withholdingByATC;
  }

  private async generateSequenceNumber(projectId: string, taxPeriod: TaxPeriod): Promise<number> {
    // Generate sequence number for monthly filing
    return 1;
  }

  private async validateGeneratedForm(
    form: Form1601C,
    withholdingData: MonthlyWithholdingData
  ): Promise<void> {
    const errors: string[] = [];

    // Validate TIN format
    if (!this.isValidTIN(form.taxpayerInfo.tin)) {
      errors.push("Invalid TIN format");
    }

    // Validate month
    if (form.month < 1 || form.month > 12) {
      errors.push("Invalid month");
    }

    // Validate amounts
    if (form.totalIncomePayments.isNegative()) {
      errors.push("Total income payments cannot be negative");
    }

    if (form.totalTaxWithheld.isNegative()) {
      errors.push("Total tax withheld cannot be negative");
    }

    // Validate ATC code totals
    const atcTotal = Object.values(form.withholdingByATC).reduce(
      (sum, atc) => sum.add(atc.taxWithheld),
      new Money(0)
    );

    if (!form.totalTaxWithheld.equals(atcTotal)) {
      errors.push("Total tax withheld does not match ATC code breakdown");
    }

    // Validate consistency with source data
    if (!form.totalIncomePayments.equals(withholdingData.totalIncomePayments)) {
      errors.push("Total income payments inconsistent with source data");
    }

    // Add data quality warnings as errors if critical
    if (withholdingData.dataQuality.completenessScore < 90) {
      errors.push("Data completeness below acceptable threshold (90%)");
    }

    if (errors.length > 0) {
      throw new Error(`Form validation failed: ${errors.join(", ")}`);
    }
  }

  private async auditFormGeneration(
    projectId: string,
    form: Form1601C,
    withholdingData: MonthlyWithholdingData,
    userId: string
  ): Promise<void> {
    const auditData = {
      projectId,
      formType: form.formType,
      taxPeriod: form.taxPeriod,
      month: form.month,
      generatedBy: userId,
      generatedAt: form.generatedDate,
      dataSource: {
        transactionCount: withholdingData.totalTransactions,
        payeeCount: withholdingData.totalPayees,
        atcCodeCount: Object.keys(withholdingData.transactionsByATC).length,
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
      compliance: {
        filingDeadline: withholdingData.compliance.filingDeadline,
        isOnTime: withholdingData.compliance.isOnTime,
        penaltyRate: withholdingData.compliance.penaltyRate,
      },
      atcBreakdown: Object.entries(form.withholdingByATC).map(([atc, data]) => ({
        atcCode: atc,
        incomePayments: data.incomePayments.toNumber(),
        taxWithheld: data.taxWithheld.toNumber(),
        taxRate: data.taxRate,
      })),
    };

    // In real implementation, this would be saved to audit log
    console.log("Form 1601C generation audit:", auditData);
  }

  private isValidTIN(tin: string): boolean {
    // Philippine TIN format: XXX-XXX-XXX-000
    const tinRegex = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
    return tinRegex.test(tin);
  }

  private getATCDescription(atcCode: string): string {
    const descriptions: { [key: string]: string } = {
      WI010: "Professional fees paid to individuals",
      WC010: "Professional fees paid to corporations/partnerships",
      WI050: "Rental of real property - individual lessor",
      WC050: "Rental of real property - corporate lessor",
      WI055: "Rental of personal property - individual lessor",
      WC055: "Rental of personal property - corporate lessor",
      WC140: "Purchase of goods from suppliers",
      WC160: "Purchase of services",
      WI011: "Commission paid to individuals",
      WC011: "Commission paid to corporations",
      WI012: "Talent fees paid to individuals",
      WI013: "Director's fees",
      WC020: "Interest on bank deposits",
    };

    return descriptions[atcCode] || `ATC Code: ${atcCode}`;
  }
}
