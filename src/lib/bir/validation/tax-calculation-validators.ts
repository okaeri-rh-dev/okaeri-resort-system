/**
 * Tax Calculation Validators
 *
 * Validates accuracy and compliance of tax calculations in BIR forms
 * according to Philippine tax laws and BIR regulations.
 *
 * Key Features:
 * - VAT calculation accuracy (12% standard rate)
 * - Withholding tax rate validation by ATC codes
 * - Cross-form calculation consistency
 * - Tax base and rate compliance checking
 * - Philippine tax law compliance verification
 */

import { Money } from "@/lib/money";
import {
  BIRForm,
  Form2550M,
  Form1601EQ,
  Form1601C,
  Form2307,
  BIRFormValidation,
} from "@/lib/bir/types";

/**
 * Philippine tax rates and thresholds
 */
const PHILIPPINE_TAX_RATES = {
  VAT: {
    STANDARD: 0.12, // 12% VAT
    ZERO_RATE: 0.0, // Zero-rated exports
  },

  WITHHOLDING_TAX: {
    // Professional services
    WI010: { rate: 0.1, description: "Professional fees - Individual" },
    WC010: { rate: 0.15, description: "Professional fees - Corporation" },

    // Rental income
    WI050: { rate: 0.05, description: "Rental - Individual" },
    WC050: { rate: 0.05, description: "Rental - Corporation" },

    // Contractor services
    WC140: { rate: 0.01, description: "Purchase of goods" },
    WC160: { rate: 0.02, description: "Purchase of services" },

    // Commission
    WI011: { rate: 0.1, description: "Commission - Individual" },
    WC011: { rate: 0.1, description: "Commission - Corporation" },

    // Others
    WI012: { rate: 0.1, description: "Talent fees" },
    WI013: { rate: 0.1, description: "Director fees" },
  },

  THRESHOLDS: {
    VAT_REGISTRATION: 3000000, // ₱3M annual threshold
    MINIMUM_TAX_WITHHELD: 1000, // ₱1,000 minimum for certificate generation
  },
} as const;

/**
 * Tax calculation validation result
 */
interface TaxCalculationValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  fieldIssues: { field: string; issue: string; severity: "error" | "warning" }[];
  complianceIssues: string[];
}

export class TaxCalculationValidators {
  /**
   * Main tax calculation validation entry point
   */
  async validate(form: BIRForm): Promise<BIRFormValidation> {
    let result: TaxCalculationValidationResult;

    switch (form.formType) {
      case "2550M":
        result = await this.validateVATCalculations(form as Form2550M);
        break;
      case "1601EQ":
        result = await this.validateQuarterlyWithholdingCalculations(form as Form1601EQ);
        break;
      case "1601C":
        result = await this.validateMonthlyWithholdingCalculations(form as Form1601C);
        break;
      case "2307":
        result = await this.validateCertificateCalculations(form as Form2307);
        break;
      default:
        result = {
          passed: false,
          errors: [
            `Tax calculation validation not implemented for form type: ${(form as any).formType}`,
          ],
          warnings: [],
          fieldIssues: [],
          complianceIssues: [],
        };
    }

    return {
      isValid: result.passed,
      errors: result.errors,
      warnings: result.warnings,
      missingFields: result.fieldIssues
        .filter((issue) => issue.severity === "error")
        .map((issue) => issue.field),
    };
  }

  /**
   * Validate VAT calculations in Form 2550M
   */
  private async validateVATCalculations(form: Form2550M): Promise<TaxCalculationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" }[] = [];
    const complianceIssues: string[] = [];

    // Validate output VAT calculation (12% of vatable sales)
    const expectedOutputVAT = form.salesBreakdown.vatableSales.multiply(
      PHILIPPINE_TAX_RATES.VAT.STANDARD
    );
    if (!this.isAmountEqual(form.salesBreakdown.outputVAT, expectedOutputVAT)) {
      errors.push(
        `Output VAT calculation incorrect. Expected: ${expectedOutputVAT.format()}, ` +
          `Actual: ${form.salesBreakdown.outputVAT.format()}`
      );
      fieldIssues.push({
        field: "salesBreakdown.outputVAT",
        issue: "Output VAT should be 12% of vatable sales",
        severity: "error",
      });
    }

    // Validate total sales computation
    const expectedTotalSales = form.salesBreakdown.vatableSales
      .add(form.salesBreakdown.vatExempt)
      .add(form.salesBreakdown.vatZeroRated);

    if (!this.isAmountEqual(form.salesBreakdown.totalSales, expectedTotalSales)) {
      errors.push("Total sales does not equal sum of vatable, exempt, and zero-rated sales");
      fieldIssues.push({
        field: "salesBreakdown.totalSales",
        issue: "Total sales computation incorrect",
        severity: "error",
      });
    }

    // Validate net VAT computation
    const expectedNetVAT = form.totalOutputVAT
      .subtract(form.totalInputVAT)
      .subtract(form.excessCreditsFromPreviousPeriod);

    if (expectedNetVAT.isPositive()) {
      if (!this.isAmountEqual(form.vatPayable, expectedNetVAT)) {
        errors.push(
          `VAT payable calculation incorrect. Expected: ${expectedNetVAT.format()}, ` +
            `Actual: ${form.vatPayable.format()}`
        );
      }

      if (!form.vatRefundable.isZero()) {
        warnings.push("VAT refundable should be zero when VAT is payable");
      }
    } else {
      if (!this.isAmountEqual(form.vatRefundable, expectedNetVAT.abs())) {
        errors.push(
          `VAT refundable calculation incorrect. Expected: ${expectedNetVAT.abs().format()}, ` +
            `Actual: ${form.vatRefundable.format()}`
        );
      }

      if (!form.vatPayable.isZero()) {
        warnings.push("VAT payable should be zero when VAT is refundable");
      }
    }

    // Validate input VAT breakdown
    const expectedTotalInputVAT = form.inputTax.domesticPurchases
      .add(form.inputTax.importations)
      .add(form.inputTax.transitionalInputTax)
      .add(form.inputTax.presumptiveInputTax)
      .add(form.inputTax.inputVATFromPreviousPeriod);

    if (!this.isAmountEqual(form.inputTax.totalInputVAT, expectedTotalInputVAT)) {
      errors.push("Total input VAT does not match sum of input VAT components");
      fieldIssues.push({
        field: "inputTax.totalInputVAT",
        issue: "Total input VAT computation incorrect",
        severity: "error",
      });
    }

    // Validate final amount payable
    const expectedFinalAmount = form.vatPayable
      .add(form.adjustments.priorPeriodErrors)
      .add(form.adjustments.others)
      .add(form.penalties);

    if (!this.isAmountEqual(form.totalAmountPayable, expectedFinalAmount)) {
      errors.push("Total amount payable calculation incorrect");
      fieldIssues.push({
        field: "totalAmountPayable",
        issue: "Final amount payable computation incorrect",
        severity: "error",
      });
    }

    // Compliance checks
    if (
      form.salesBreakdown.vatableSales.greaterThan(
        new Money(PHILIPPINE_TAX_RATES.THRESHOLDS.VAT_REGISTRATION / 12)
      )
    ) {
      // Monthly sales suggest annual sales > ₱3M threshold
      if (!form.taxpayerInfo.isVATRegistered) {
        complianceIssues.push("Business may need VAT registration based on sales volume");
      }
    }

    // Check for unusual patterns
    if (form.inputTax.totalInputVAT.greaterThan(form.totalOutputVAT.multiply(0.8))) {
      warnings.push("Input VAT is unusually high compared to output VAT (>80%)");
    }

    if (form.salesBreakdown.vatExempt.greaterThan(form.salesBreakdown.vatableSales.multiply(0.2))) {
      warnings.push("VAT exempt sales are unusually high (>20% of vatable sales)");
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      fieldIssues,
      complianceIssues,
    };
  }

  /**
   * Validate withholding tax calculations in Form 1601EQ
   */
  private async validateQuarterlyWithholdingCalculations(
    form: Form1601EQ
  ): Promise<TaxCalculationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" }[] = [];
    const complianceIssues: string[] = [];

    // Validate alphalist total against form total
    if (form.alphalist && form.alphalist.length > 0) {
      const alphalistIncomeTotal = form.alphalist.reduce(
        (sum, entry) => sum.add(entry.taxBase),
        new Money(0)
      );

      const alphalistTaxTotal = form.alphalist.reduce(
        (sum, entry) => sum.add(entry.taxWithheld),
        new Money(0)
      );

      if (!this.isAmountEqual(form.totalIncomePayments, alphalistIncomeTotal)) {
        errors.push("Total income payments does not match alphalist sum");
        fieldIssues.push({
          field: "totalIncomePayments",
          issue: "Inconsistent with alphalist total",
          severity: "error",
        });
      }

      if (!this.isAmountEqual(form.totalTaxWithheld, alphalistTaxTotal)) {
        errors.push("Total tax withheld does not match alphalist sum");
        fieldIssues.push({
          field: "totalTaxWithheld",
          issue: "Inconsistent with alphalist total",
          severity: "error",
        });
      }

      // Validate individual alphalist entries
      for (let i = 0; i < form.alphalist.length; i++) {
        const entry = form.alphalist[i];
        const atcInfo = PHILIPPINE_TAX_RATES.WITHHOLDING_TAX[entry.atcCode];

        if (atcInfo) {
          const expectedTax = entry.taxBase.multiply(atcInfo.rate);
          if (!this.isAmountEqual(entry.taxWithheld, expectedTax)) {
            errors.push(
              `Incorrect withholding tax calculation for ${entry.payeeName} ` +
                `(ATC: ${entry.atcCode}). Expected: ${expectedTax.format()}, ` +
                `Actual: ${entry.taxWithheld.format()}`
            );
          }

          // Validate tax rate
          if (Math.abs(entry.taxRate - atcInfo.rate) > 0.001) {
            errors.push(
              `Incorrect tax rate for ATC ${entry.atcCode}. ` +
                `Expected: ${(atcInfo.rate * 100).toFixed(1)}%, ` +
                `Actual: ${(entry.taxRate * 100).toFixed(1)}%`
            );
          }
        } else {
          warnings.push(`Unknown ATC code in alphalist: ${entry.atcCode}`);
        }

        // Validate monthly breakdown totals
        const monthlyTotal = entry.month1.add(entry.month2).add(entry.month3);
        if (!this.isAmountEqual(entry.taxWithheld, monthlyTotal)) {
          errors.push(
            `Monthly breakdown does not match total for ${entry.payeeName}. ` +
              `Total: ${entry.taxWithheld.format()}, Monthly sum: ${monthlyTotal.format()}`
          );
        }
      }
    }

    // Validate total amount payable
    const expectedAmountPayable = form.totalTaxWithheld
      .add(form.surcharge)
      .add(form.interest)
      .add(form.compromise)
      .subtract(form.excessCreditsFromPreviousPeriod);

    if (!this.isAmountEqual(form.totalAmountPayable, expectedAmountPayable)) {
      errors.push("Total amount payable calculation incorrect");
      fieldIssues.push({
        field: "totalAmountPayable",
        issue: "Final amount payable computation incorrect",
        severity: "error",
      });
    }

    // Compliance checks
    const averageWithholdingRate = form.totalIncomePayments.isZero()
      ? 0
      : form.totalTaxWithheld.divide(form.totalIncomePayments).toNumber();

    if (averageWithholdingRate > 0.2) {
      warnings.push("Average withholding rate is unusually high (>20%)");
    }

    if (averageWithholdingRate < 0.01) {
      warnings.push("Average withholding rate is unusually low (<1%)");
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      fieldIssues,
      complianceIssues,
    };
  }

  /**
   * Validate withholding tax calculations in Form 1601C
   */
  private async validateMonthlyWithholdingCalculations(
    form: Form1601C
  ): Promise<TaxCalculationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" }[] = [];
    const complianceIssues: string[] = [];

    // Validate ATC code breakdown totals
    if (form.withholdingByATC && Object.keys(form.withholdingByATC).length > 0) {
      const atcIncomeTotal = Object.values(form.withholdingByATC).reduce(
        (sum, atc) => sum.add(atc.incomePayments),
        new Money(0)
      );

      const atcTaxTotal = Object.values(form.withholdingByATC).reduce(
        (sum, atc) => sum.add(atc.taxWithheld),
        new Money(0)
      );

      if (!this.isAmountEqual(form.totalIncomePayments, atcIncomeTotal)) {
        errors.push("Total income payments does not match ATC breakdown sum");
        fieldIssues.push({
          field: "totalIncomePayments",
          issue: "Inconsistent with ATC breakdown total",
          severity: "error",
        });
      }

      if (!this.isAmountEqual(form.totalTaxWithheld, atcTaxTotal)) {
        errors.push("Total tax withheld does not match ATC breakdown sum");
        fieldIssues.push({
          field: "totalTaxWithheld",
          issue: "Inconsistent with ATC breakdown total",
          severity: "error",
        });
      }

      // Validate individual ATC entries
      for (const [atcCode, atcData] of Object.entries(form.withholdingByATC)) {
        const atcInfo = PHILIPPINE_TAX_RATES.WITHHOLDING_TAX[atcCode];

        if (atcInfo) {
          const expectedTax = atcData.incomePayments.multiply(atcInfo.rate);
          if (!this.isAmountEqual(atcData.taxWithheld, expectedTax)) {
            errors.push(
              `Incorrect withholding tax calculation for ATC ${atcCode}. ` +
                `Expected: ${expectedTax.format()}, Actual: ${atcData.taxWithheld.format()}`
            );
          }

          // Validate tax rate
          if (Math.abs(atcData.taxRate - atcInfo.rate) > 0.001) {
            errors.push(
              `Incorrect tax rate for ATC ${atcCode}. ` +
                `Expected: ${(atcInfo.rate * 100).toFixed(1)}%, ` +
                `Actual: ${(atcData.taxRate * 100).toFixed(1)}%`
            );
          }
        } else {
          warnings.push(`Unknown ATC code: ${atcCode}`);
        }
      }
    }

    // Validate total amount payable
    const expectedAmountPayable = form.totalTaxWithheld.add(form.surcharge).add(form.interest);

    if (!this.isAmountEqual(form.totalAmountPayable, expectedAmountPayable)) {
      errors.push("Total amount payable calculation incorrect");
      fieldIssues.push({
        field: "totalAmountPayable",
        issue: "Final amount payable computation incorrect",
        severity: "error",
      });
    }

    // Validate tax remitted equals tax withheld (for normal cases)
    if (!this.isAmountEqual(form.taxRemittedInReturn, form.totalTaxWithheld)) {
      warnings.push("Tax remitted in return does not equal total tax withheld");
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      fieldIssues,
      complianceIssues,
    };
  }

  /**
   * Validate tax calculations in Form 2307 certificates
   */
  private async validateCertificateCalculations(
    form: Form2307
  ): Promise<TaxCalculationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" }[] = [];
    const complianceIssues: string[] = [];

    // Validate total computations
    const calculatedIncomeTotal = form.incomePayments.reduce(
      (sum, payment) => sum.add(payment.incomeAmount),
      new Money(0)
    );

    const calculatedTaxTotal = form.incomePayments.reduce(
      (sum, payment) => sum.add(payment.taxWithheld),
      new Money(0)
    );

    if (!this.isAmountEqual(form.totalIncomePayment, calculatedIncomeTotal)) {
      errors.push("Total income payment does not match sum of individual payments");
      fieldIssues.push({
        field: "totalIncomePayment",
        issue: "Total income computation incorrect",
        severity: "error",
      });
    }

    if (!this.isAmountEqual(form.totalTaxWithheld, calculatedTaxTotal)) {
      errors.push("Total tax withheld does not match sum of individual payments");
      fieldIssues.push({
        field: "totalTaxWithheld",
        issue: "Total tax withheld computation incorrect",
        severity: "error",
      });
    }

    // Validate individual payment calculations
    for (let i = 0; i < form.incomePayments.length; i++) {
      const payment = form.incomePayments[i];
      const atcInfo = PHILIPPINE_TAX_RATES.WITHHOLDING_TAX[payment.atcCode];

      if (atcInfo) {
        const expectedTax = payment.incomeAmount.multiply(atcInfo.rate);
        if (!this.isAmountEqual(payment.taxWithheld, expectedTax)) {
          errors.push(
            `Incorrect tax calculation for payment ${i + 1} (ATC: ${payment.atcCode}). ` +
              `Expected: ${expectedTax.format()}, Actual: ${payment.taxWithheld.format()}`
          );
        }

        // Validate tax rate matches ATC code
        if (Math.abs(payment.taxRate - atcInfo.rate) > 0.001) {
          errors.push(
            `Incorrect tax rate for payment ${i + 1} (ATC: ${payment.atcCode}). ` +
              `Expected: ${(atcInfo.rate * 100).toFixed(1)}%, ` +
              `Actual: ${(payment.taxRate * 100).toFixed(1)}%`
          );
        }
      } else {
        warnings.push(`Unknown ATC code in payment ${i + 1}: ${payment.atcCode}`);
      }

      // Check for minimum thresholds
      if (
        payment.taxWithheld.lessThan(
          new Money(PHILIPPINE_TAX_RATES.THRESHOLDS.MINIMUM_TAX_WITHHELD)
        )
      ) {
        warnings.push(
          `Tax withheld in payment ${i + 1} is below typical minimum threshold ` +
            `(₱${PHILIPPINE_TAX_RATES.THRESHOLDS.MINIMUM_TAX_WITHHELD})`
        );
      }
    }

    // Validate average tax rate is reasonable
    const averageTaxRate = form.totalIncomePayment.isZero()
      ? 0
      : form.totalTaxWithheld.divide(form.totalIncomePayment).toNumber();

    if (averageTaxRate > 0.2) {
      warnings.push("Average withholding tax rate is unusually high (>20%)");
    }

    if (averageTaxRate < 0.01) {
      warnings.push("Average withholding tax rate is unusually low (<1%)");
    }

    // Check for certificate completeness
    if (form.totalTaxWithheld.lessThan(new Money(100))) {
      warnings.push("Total tax withheld is very low (< ₱100) for certificate generation");
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      fieldIssues,
      complianceIssues,
    };
  }

  /**
   * Helper method to compare Money amounts with tolerance for rounding
   */
  private isAmountEqual(amount1: Money, amount2: Money, tolerance: number = 0.01): boolean {
    const difference = amount1.subtract(amount2).abs();
    return difference.lessThan(new Money(tolerance));
  }
}
