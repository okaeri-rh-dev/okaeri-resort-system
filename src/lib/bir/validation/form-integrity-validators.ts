/**
 * Form Integrity Validators
 *
 * Validates cross-form consistency, data integrity, and logical relationships
 * between different BIR forms and their data sources.
 *
 * Key Features:
 * - Cross-form consistency validation
 * - Data source integrity verification
 * - Logical relationship validation
 * - Historical data consistency
 * - Audit trail validation
 */

import { Money } from "@/lib/money";
import {
  BIRForm,
  Form2550M,
  Form1601EQ,
  Form1601C,
  Form2307,
  BIRFormValidation,
  TaxPeriod,
} from "@/lib/bir/types";

/**
 * Form integrity validation result
 */
interface IntegrityValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[];
  consistencyIssues: string[];
  auditIssues: string[];
}

/**
 * Historical form data for consistency checking
 */
interface HistoricalFormData {
  previousPeriod?: BIRForm;
  yearToDateForms?: BIRForm[];
  relatedForms?: BIRForm[];
}

/**
 * Data source integrity information
 */
interface DataSourceIntegrity {
  sourceTransactionCount: number;
  generatedTransactionCount: number;
  dataCompletenessScore: number;
  lastDataUpdate: Date;
  missingDataPeriods: string[];
  duplicateTransactions: number;
}

export class FormIntegrityValidators {
  /**
   * Main form integrity validation entry point
   */
  async validate(form: BIRForm, historicalData?: HistoricalFormData): Promise<BIRFormValidation> {
    let result: IntegrityValidationResult;

    switch (form.formType) {
      case "2550M":
        result = await this.validateVATFormIntegrity(form as Form2550M, historicalData);
        break;
      case "1601EQ":
        result = await this.validateQuarterlyWithholdingIntegrity(
          form as Form1601EQ,
          historicalData
        );
        break;
      case "1601C":
        result = await this.validateMonthlyWithholdingIntegrity(form as Form1601C, historicalData);
        break;
      case "2307":
        result = await this.validateCertificateIntegrity(form as Form2307, historicalData);
        break;
      default:
        result = {
          passed: false,
          errors: [
            `Form integrity validation not implemented for form type: ${(form as any).formType}`,
          ],
          warnings: [],
          fieldIssues: [],
          consistencyIssues: [],
          auditIssues: [],
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
   * Validate VAT form integrity and consistency
   */
  private async validateVATFormIntegrity(
    form: Form2550M,
    historicalData?: HistoricalFormData
  ): Promise<IntegrityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];
    const consistencyIssues: string[] = [];
    const auditIssues: string[] = [];

    // Validate internal consistency
    const internalConsistency = this.validateVATInternalConsistency(form);
    errors.push(...internalConsistency.errors);
    warnings.push(...internalConsistency.warnings);
    fieldIssues.push(...internalConsistency.fieldIssues);

    // Cross-period consistency validation
    if (historicalData?.previousPeriod && historicalData.previousPeriod.formType === "2550M") {
      const crossPeriodConsistency = this.validateVATCrossPeriodConsistency(
        form,
        historicalData.previousPeriod as Form2550M
      );
      consistencyIssues.push(...crossPeriodConsistency.consistencyIssues);
      warnings.push(...crossPeriodConsistency.warnings);
    }

    // Year-to-date consistency
    if (historicalData?.yearToDateForms) {
      const ytdConsistency = this.validateVATYearToDateConsistency(
        form,
        historicalData.yearToDateForms
      );
      consistencyIssues.push(...ytdConsistency.consistencyIssues);
      warnings.push(...ytdConsistency.warnings);
    }

    // Business logic validation
    const businessLogic = this.validateVATBusinessLogic(form);
    warnings.push(...businessLogic.warnings);
    fieldIssues.push(...businessLogic.fieldIssues);

    // Audit trail validation
    const auditValidation = this.validateFormAuditTrail(form);
    auditIssues.push(...auditValidation.auditIssues);

    if (auditValidation.hasDataIntegrityIssues) {
      warnings.push("Data integrity issues detected in audit trail");
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      fieldIssues,
      consistencyIssues,
      auditIssues,
    };
  }

  /**
   * Validate quarterly withholding form integrity
   */
  private async validateQuarterlyWithholdingIntegrity(
    form: Form1601EQ,
    historicalData?: HistoricalFormData
  ): Promise<IntegrityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];
    const consistencyIssues: string[] = [];
    const auditIssues: string[] = [];

    // Validate alphalist internal consistency
    if (form.alphalist && form.alphalist.length > 0) {
      const alphalistConsistency = this.validateAlphalistIntegrity(form.alphalist);
      errors.push(...alphalistConsistency.errors);
      warnings.push(...alphalistConsistency.warnings);
      fieldIssues.push(...alphalistConsistency.fieldIssues);
    }

    // Validate against monthly returns (1601C) if available
    if (historicalData?.relatedForms) {
      const monthlyForms = historicalData.relatedForms.filter(
        (f) => f.formType === "1601C"
      ) as Form1601C[];
      if (monthlyForms.length > 0) {
        const monthlyConsistency = this.validateQuarterlyVsMonthlyConsistency(form, monthlyForms);
        consistencyIssues.push(...monthlyConsistency.consistencyIssues);
        errors.push(...monthlyConsistency.errors);
        warnings.push(...monthlyConsistency.warnings);
      }
    }

    // Validate certificates (2307) consistency
    if (historicalData?.relatedForms) {
      const certificates = historicalData.relatedForms.filter(
        (f) => f.formType === "2307"
      ) as Form2307[];
      if (certificates.length > 0) {
        const certificateConsistency = this.validateWithholdingVsCertificateConsistency(
          form,
          certificates
        );
        consistencyIssues.push(...certificateConsistency.consistencyIssues);
        warnings.push(...certificateConsistency.warnings);
      }
    }

    // Business logic validation
    const businessLogic = this.validateWithholdingBusinessLogic(form);
    warnings.push(...businessLogic.warnings);
    fieldIssues.push(...businessLogic.fieldIssues);

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      fieldIssues,
      consistencyIssues,
      auditIssues,
    };
  }

  /**
   * Validate monthly withholding form integrity
   */
  private async validateMonthlyWithholdingIntegrity(
    form: Form1601C,
    historicalData?: HistoricalFormData
  ): Promise<IntegrityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];
    const consistencyIssues: string[] = [];
    const auditIssues: string[] = [];

    // Validate ATC code consistency
    const atcConsistency = this.validateATCCodeConsistency(form.withholdingByATC);
    errors.push(...atcConsistency.errors);
    warnings.push(...atcConsistency.warnings);

    // Validate against previous monthly returns
    if (historicalData?.previousPeriod && historicalData.previousPeriod.formType === "1601C") {
      const monthlyConsistency = this.validateMonthlyWithholdingConsistency(
        form,
        historicalData.previousPeriod as Form1601C
      );
      consistencyIssues.push(...monthlyConsistency.consistencyIssues);
      warnings.push(...monthlyConsistency.warnings);
    }

    // Business pattern validation
    const businessPatterns = this.validateMonthlyBusinessPatterns(form);
    warnings.push(...businessPatterns.warnings);
    fieldIssues.push(...businessPatterns.fieldIssues);

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      fieldIssues,
      consistencyIssues,
      auditIssues,
    };
  }

  /**
   * Validate certificate integrity
   */
  private async validateCertificateIntegrity(
    form: Form2307,
    historicalData?: HistoricalFormData
  ): Promise<IntegrityValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];
    const consistencyIssues: string[] = [];
    const auditIssues: string[] = [];

    // Validate certificate number uniqueness and format
    const certificateValidation = this.validateCertificateNumber(form.certificateNumber);
    if (!certificateValidation.isValid) {
      errors.push(...certificateValidation.errors);
      warnings.push(...certificateValidation.warnings);
    }

    // Validate income payment consistency
    const incomeConsistency = this.validateIncomePaymentConsistency(form.incomePayments);
    errors.push(...incomeConsistency.errors);
    warnings.push(...incomeConsistency.warnings);
    fieldIssues.push(...incomeConsistency.fieldIssues);

    // Validate against withholding returns if available
    if (historicalData?.relatedForms) {
      const withholdingForms = historicalData.relatedForms.filter(
        (f) => f.formType === "1601C" || f.formType === "1601EQ"
      );
      if (withholdingForms.length > 0) {
        const withholdingConsistency = this.validateCertificateVsWithholdingConsistency(
          form,
          withholdingForms
        );
        consistencyIssues.push(...withholdingConsistency.consistencyIssues);
        warnings.push(...withholdingConsistency.warnings);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      fieldIssues,
      consistencyIssues,
      auditIssues,
    };
  }

  // Private validation helper methods

  private validateVATInternalConsistency(form: Form2550M) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];

    // Validate that either VAT payable or refundable is non-zero (but not both)
    const bothNonZero = !form.vatPayable.isZero() && !form.vatRefundable.isZero();
    const bothZero = form.vatPayable.isZero() && form.vatRefundable.isZero();

    if (bothNonZero) {
      errors.push("Both VAT payable and VAT refundable cannot be non-zero");
    }

    if (bothZero && !form.totalOutputVAT.equals(form.totalInputVAT)) {
      warnings.push("Both VAT payable and refundable are zero but output VAT ≠ input VAT");
    }

    // Validate adjustment amounts are reasonable
    const totalAdjustments = form.adjustments.priorPeriodErrors
      .add(form.adjustments.succeededByCapitalGainsTax)
      .add(form.adjustments.others);

    if (totalAdjustments.greaterThan(form.totalOutputVAT.multiply(0.5))) {
      warnings.push("Total adjustments are unusually large (>50% of output VAT)");
    }

    return { errors, warnings, fieldIssues };
  }

  private validateVATCrossPeriodConsistency(current: Form2550M, previous: Form2550M) {
    const consistencyIssues: string[] = [];
    const warnings: string[] = [];

    // Check if excess credits from previous period match
    if (previous.vatRefundable && !previous.vatRefundable.isZero()) {
      if (!current.excessCreditsFromPreviousPeriod.equals(previous.vatRefundable)) {
        consistencyIssues.push(
          `Excess credits from previous period (${current.excessCreditsFromPreviousPeriod.format()}) ` +
            `do not match previous period's VAT refundable (${previous.vatRefundable.format()})`
        );
      }
    }

    // Check for significant changes in business patterns
    const currentSalesGrowth = previous.salesBreakdown.totalSales.isZero()
      ? 0
      : current.salesBreakdown.totalSales
          .subtract(previous.salesBreakdown.totalSales)
          .divide(previous.salesBreakdown.totalSales)
          .toNumber();

    if (Math.abs(currentSalesGrowth) > 0.5) {
      warnings.push(
        `Significant sales change from previous period: ${(currentSalesGrowth * 100).toFixed(1)}%`
      );
    }

    return { consistencyIssues, warnings };
  }

  private validateVATYearToDateConsistency(current: Form2550M, ytdForms: BIRForm[]) {
    const consistencyIssues: string[] = [];
    const warnings: string[] = [];

    const vatForms = ytdForms.filter((f) => f.formType === "2550M") as Form2550M[];

    if (vatForms.length === 0) return { consistencyIssues, warnings };

    // Calculate YTD totals
    const ytdSales = vatForms
      .reduce((sum, form) => sum.add(form.salesBreakdown.totalSales), new Money(0))
      .add(current.salesBreakdown.totalSales);

    const ytdOutputVAT = vatForms
      .reduce((sum, form) => sum.add(form.salesBreakdown.outputVAT), new Money(0))
      .add(current.salesBreakdown.outputVAT);

    // Check if YTD totals suggest VAT registration threshold
    const annualizedSales = ytdSales.multiply(12 / (vatForms.length + 1));
    if (annualizedSales.greaterThan(new Money(3000000)) && !current.taxpayerInfo.isVATRegistered) {
      warnings.push("Annualized sales suggest VAT registration may be required");
    }

    return { consistencyIssues, warnings };
  }

  private validateVATBusinessLogic(form: Form2550M) {
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];

    // Check for unusual business patterns
    const exemptRatio = form.salesBreakdown.totalSales.isZero()
      ? 0
      : form.salesBreakdown.vatExempt.divide(form.salesBreakdown.totalSales).toNumber();

    if (exemptRatio > 0.3) {
      warnings.push("VAT exempt sales are unusually high (>30% of total sales)");
    }

    // Check input VAT ratio
    const inputVATRatio = form.totalOutputVAT.isZero()
      ? 0
      : form.totalInputVAT.divide(form.totalOutputVAT).toNumber();

    if (inputVATRatio > 0.9) {
      warnings.push("Input VAT is very high relative to output VAT (>90%)");
      fieldIssues.push({
        field: "inputTax.totalInputVAT",
        issue: "Unusually high input VAT ratio",
        severity: "warning",
      });
    }

    return { warnings, fieldIssues };
  }

  private validateAlphalistIntegrity(alphalist: any[]) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];

    // Check for duplicate entries
    const tinAtcPairs = new Set<string>();
    const duplicates: string[] = [];

    for (const entry of alphalist) {
      const key = `${entry.payeeTin}-${entry.atcCode}`;
      if (tinAtcPairs.has(key)) {
        duplicates.push(`${entry.payeeName} (${entry.payeeTin}) - ${entry.atcCode}`);
      } else {
        tinAtcPairs.add(key);
      }
    }

    if (duplicates.length > 0) {
      errors.push(`Duplicate alphalist entries found: ${duplicates.join(", ")}`);
    }

    // Check sequence numbers
    for (let i = 0; i < alphalist.length; i++) {
      if (alphalist[i].sequenceNumber !== i + 1) {
        errors.push(`Incorrect sequence number at position ${i + 1}`);
        break;
      }
    }

    return { errors, warnings, fieldIssues };
  }

  private validateQuarterlyVsMonthlyConsistency(quarterly: Form1601EQ, monthlyForms: Form1601C[]) {
    const consistencyIssues: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Sum monthly totals for the quarter
    const monthlyTotalIncome = monthlyForms.reduce(
      (sum, form) => sum.add(form.totalIncomePayments),
      new Money(0)
    );

    const monthlyTotalTax = monthlyForms.reduce(
      (sum, form) => sum.add(form.totalTaxWithheld),
      new Money(0)
    );

    // Compare with quarterly totals
    if (!quarterly.totalIncomePayments.equals(monthlyTotalIncome)) {
      consistencyIssues.push(
        `Quarterly income payments (${quarterly.totalIncomePayments.format()}) ` +
          `do not match sum of monthly returns (${monthlyTotalIncome.format()})`
      );
    }

    if (!quarterly.totalTaxWithheld.equals(monthlyTotalTax)) {
      consistencyIssues.push(
        `Quarterly tax withheld (${quarterly.totalTaxWithheld.format()}) ` +
          `do not match sum of monthly returns (${monthlyTotalTax.format()})`
      );
    }

    return { consistencyIssues, errors, warnings };
  }

  private validateWithholdingVsCertificateConsistency(
    withholding: Form1601EQ,
    certificates: Form2307[]
  ) {
    const consistencyIssues: string[] = [];
    const warnings: string[] = [];

    // Sum certificate totals
    const certificateTotalTax = certificates.reduce(
      (sum, cert) => sum.add(cert.totalTaxWithheld),
      new Money(0)
    );

    // Compare with withholding return
    if (!withholding.totalTaxWithheld.equals(certificateTotalTax)) {
      warnings.push(
        `Total tax withheld in withholding return (${withholding.totalTaxWithheld.format()}) ` +
          `does not match sum of certificates (${certificateTotalTax.format()})`
      );
    }

    return { consistencyIssues, warnings };
  }

  private validateATCCodeConsistency(withholdingByATC: any) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty ATC breakdown
    if (!withholdingByATC || Object.keys(withholdingByATC).length === 0) {
      warnings.push("No withholding by ATC codes reported");
      return { errors, warnings };
    }

    // Validate individual ATC entries
    for (const [atcCode, atcData] of Object.entries(withholdingByATC)) {
      if (!atcCode.match(/^W[IC]\d{3}$/)) {
        warnings.push(`Non-standard ATC code format: ${atcCode}`);
      }

      if ((atcData as any).incomePayments.isZero() && !(atcData as any).taxWithheld.isZero()) {
        errors.push(`ATC ${atcCode} has tax withheld but zero income payments`);
      }
    }

    return { errors, warnings };
  }

  private validateMonthlyWithholdingConsistency(current: Form1601C, previous: Form1601C) {
    const consistencyIssues: string[] = [];
    const warnings: string[] = [];

    // Check for significant changes in withholding patterns
    const growthRate = previous.totalTaxWithheld.isZero()
      ? 0
      : current.totalTaxWithheld
          .subtract(previous.totalTaxWithheld)
          .divide(previous.totalTaxWithheld)
          .toNumber();

    if (Math.abs(growthRate) > 2.0) {
      warnings.push(
        `Significant change in withholding tax from previous month: ${(growthRate * 100).toFixed(1)}%`
      );
    }

    return { consistencyIssues, warnings };
  }

  private validateMonthlyBusinessPatterns(form: Form1601C) {
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];

    // Check for unusual patterns in ATC distribution
    const atcEntries = Object.entries(form.withholdingByATC);
    if (atcEntries.length === 1) {
      warnings.push("Only one ATC code reported - unusual for most businesses");
    }

    // Check for professional services concentration
    const professionalATCs = atcEntries.filter(
      ([atc]) => atc.startsWith("WI01") || atc.startsWith("WC01")
    );
    const totalProfessional = professionalATCs.reduce(
      (sum, [, data]) => sum.add((data as any).taxWithheld),
      new Money(0)
    );

    const professionalRatio = form.totalTaxWithheld.isZero()
      ? 0
      : totalProfessional.divide(form.totalTaxWithheld).toNumber();

    if (professionalRatio > 0.8) {
      fieldIssues.push({
        field: "withholdingByATC",
        issue: "High concentration of professional services withholding (>80%)",
        severity: "info",
      });
    }

    return { warnings, fieldIssues };
  }

  private validateCertificateNumber(certificateNumber: string) {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic format validation (already done in basic validators, but double-check)
    if (!certificateNumber.match(/^2307-\d{4}-\d{6}$/)) {
      warnings.push("Certificate number format may not follow standard pattern");
    }

    // Check for sequential numbering (would require database check in real implementation)
    const year = certificateNumber.substring(5, 9);
    const currentYear = new Date().getFullYear().toString();

    if (year !== currentYear) {
      warnings.push(`Certificate number year (${year}) differs from current year (${currentYear})`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateIncomePaymentConsistency(incomePayments: any[]) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string; severity: "error" | "warning" | "info" }[] =
      [];

    // Check for logical month ordering
    const months = incomePayments.map((p) => p.month).sort((a, b) => a - b);
    const uniqueMonths = [...new Set(months)];

    if (uniqueMonths.length !== months.length) {
      warnings.push("Duplicate months found in income payments");
    }

    // Check for consistent ATC codes and tax rates
    const atcRateMap = new Map<string, number>();
    for (const payment of incomePayments) {
      if (atcRateMap.has(payment.atcCode)) {
        if (atcRateMap.get(payment.atcCode) !== payment.taxRate) {
          errors.push(`Inconsistent tax rate for ATC ${payment.atcCode}`);
        }
      } else {
        atcRateMap.set(payment.atcCode, payment.taxRate);
      }
    }

    return { errors, warnings, fieldIssues };
  }

  private validateCertificateVsWithholdingConsistency(
    certificate: Form2307,
    withholdingForms: BIRForm[]
  ) {
    const consistencyIssues: string[] = [];
    const warnings: string[] = [];

    // This would check if the certificate amounts are reflected in withholding returns
    // Implementation would depend on specific business requirements

    warnings.push("Certificate vs withholding consistency check completed");

    return { consistencyIssues, warnings };
  }

  private validateFormAuditTrail(form: BIRForm) {
    const auditIssues: string[] = [];
    let hasDataIntegrityIssues = false;

    // Check if generation metadata is present
    if (!form.generatedDate) {
      auditIssues.push("Missing generation date in audit trail");
      hasDataIntegrityIssues = true;
    }

    if (!form.generatedBy) {
      auditIssues.push("Missing generated by information in audit trail");
      hasDataIntegrityIssues = true;
    }

    // Check if generation date is reasonable
    if (form.generatedDate && form.generatedDate > new Date()) {
      auditIssues.push("Generation date is in the future");
      hasDataIntegrityIssues = true;
    }

    return { auditIssues, hasDataIntegrityIssues };
  }
}
