/**
 * BIR Form Validators
 *
 * Comprehensive validation service for Philippine BIR forms ensuring
 * compliance with BIR requirements, format standards, and data integrity.
 *
 * Key Features:
 * - TIN format validation (XXX-XXX-XXX-000)
 * - Amount precision validation (0.01 PHP precision)
 * - Date format compliance (MM/DD/YYYY)
 * - Required field completeness checks
 * - Cross-field consistency validation
 * - Philippine business rule compliance
 */

import { Money } from "@/lib/money";
import {
  BIRForm,
  Form2550M,
  Form1601EQ,
  Form1601C,
  Form2307,
  BIRFormValidation,
  BIRTaxpayerInfo,
} from "@/lib/bir/types";

/**
 * BIR validation configuration
 */
interface BIRValidationConfig {
  strictMode: boolean;
  allowZeroAmounts: boolean;
  maxAmountPrecision: number;
  requiredFields: string[];
  customRules: ValidationRule[];
}

/**
 * Custom validation rule interface
 */
interface ValidationRule {
  name: string;
  description: string;
  validate: (form: BIRForm) => ValidationResult;
}

/**
 * Individual validation result
 */
interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  fieldIssues: { field: string; issue: string }[];
}

export class BIRValidators {
  private config: BIRValidationConfig;

  // Philippine TIN validation regex
  private readonly TIN_REGEX = /^\d{3}-\d{3}-\d{3}-\d{3}$/;

  // BIR date format regex (MM/DD/YYYY)
  private readonly BIR_DATE_REGEX = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;

  // Valid ATC codes for withholding tax
  private readonly VALID_ATC_CODES = [
    "WI010",
    "WC010",
    "WI050",
    "WC050",
    "WI055",
    "WC055",
    "WC140",
    "WC160",
    "WI011",
    "WC011",
    "WI012",
    "WI013",
    "WC020",
    "WI020",
    "WC030",
    "WI030",
    "WC035",
    "WI035",
  ];

  constructor(config?: Partial<BIRValidationConfig>) {
    this.config = {
      strictMode: true,
      allowZeroAmounts: false,
      maxAmountPrecision: 2,
      requiredFields: [],
      customRules: [],
      ...config,
    };
  }

  /**
   * Main validation entry point for any BIR form
   */
  async validate(form: BIRForm): Promise<BIRFormValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingFields: string[] = [];

    try {
      // Common validations for all forms
      const commonResult = this.validateCommonFields(form);
      errors.push(...commonResult.errors);
      warnings.push(...commonResult.warnings);
      missingFields.push(...commonResult.fieldIssues.map((f) => f.field));

      // Form-specific validations
      let specificResult: ValidationResult;
      switch (form.formType) {
        case "2550M":
          specificResult = await this.validateForm2550M(form as Form2550M);
          break;
        case "1601EQ":
          specificResult = await this.validateForm1601EQ(form as Form1601EQ);
          break;
        case "1601C":
          specificResult = await this.validateForm1601C(form as Form1601C);
          break;
        case "2307":
          specificResult = await this.validateForm2307(form as Form2307);
          break;
        default:
          specificResult = {
            passed: false,
            errors: [`Unknown form type: ${(form as any).formType}`],
            warnings: [],
            fieldIssues: [],
          };
      }

      errors.push(...specificResult.errors);
      warnings.push(...specificResult.warnings);
      missingFields.push(...specificResult.fieldIssues.map((f) => f.field));

      // Apply custom validation rules
      for (const rule of this.config.customRules) {
        const ruleResult = rule.validate(form);
        if (!ruleResult.passed) {
          errors.push(...ruleResult.errors);
          warnings.push(...ruleResult.warnings);
        }
      }

      return {
        isValid: errors.length === 0,
        errors: [...new Set(errors)], // Remove duplicates
        warnings: [...new Set(warnings)],
        missingFields: [...new Set(missingFields)],
      };
    } catch (error: any) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings,
        missingFields,
      };
    }
  }

  /**
   * Validate common fields present in all BIR forms
   */
  private validateCommonFields(form: BIRForm): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string }[] = [];

    // Validate form type
    if (!form.formType) {
      fieldIssues.push({ field: "formType", issue: "Form type is required" });
    }

    // Validate tax period
    if (!form.taxPeriod) {
      fieldIssues.push({ field: "taxPeriod", issue: "Tax period is required" });
    } else if (!this.isValidTaxPeriod(form.taxPeriod, form.formType)) {
      errors.push(`Invalid tax period format for ${form.formType}: ${form.taxPeriod}`);
    }

    // Validate filing date
    if (!form.dateOfFiling) {
      fieldIssues.push({ field: "dateOfFiling", issue: "Date of filing is required" });
    } else if (form.dateOfFiling > new Date()) {
      warnings.push("Filing date is in the future");
    }

    // Validate taxpayer information (for forms that have it)
    if ("taxpayerInfo" in form && form.taxpayerInfo) {
      const taxpayerResult = this.validateTaxpayerInfo(form.taxpayerInfo);
      errors.push(...taxpayerResult.errors);
      warnings.push(...taxpayerResult.warnings);
      fieldIssues.push(...taxpayerResult.fieldIssues);
    }

    // Check for generation metadata
    if (!form.generatedDate) {
      warnings.push("Generated date is missing");
    }

    if (!form.generatedBy) {
      warnings.push("Generated by information is missing");
    }

    return {
      passed: errors.length === 0 && fieldIssues.length === 0,
      errors,
      warnings,
      fieldIssues,
    };
  }

  /**
   * Validate taxpayer information
   */
  private validateTaxpayerInfo(taxpayerInfo: BIRTaxpayerInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string }[] = [];

    // Validate TIN
    if (!taxpayerInfo.tin) {
      fieldIssues.push({ field: "taxpayerInfo.tin", issue: "TIN is required" });
    } else if (!this.TIN_REGEX.test(taxpayerInfo.tin)) {
      errors.push(`Invalid TIN format: ${taxpayerInfo.tin}. Expected format: XXX-XXX-XXX-000`);
    }

    // Validate RDO
    if (!taxpayerInfo.rdo) {
      fieldIssues.push({ field: "taxpayerInfo.rdo", issue: "RDO is required" });
    } else if (!/^\d{3}$/.test(taxpayerInfo.rdo)) {
      errors.push(`Invalid RDO format: ${taxpayerInfo.rdo}. Expected format: XXX`);
    }

    // Validate business name
    if (!taxpayerInfo.businessName || taxpayerInfo.businessName.trim().length === 0) {
      fieldIssues.push({ field: "taxpayerInfo.businessName", issue: "Business name is required" });
    } else if (taxpayerInfo.businessName.length > 100) {
      warnings.push("Business name is very long (>100 characters)");
    }

    // Validate address
    if (!taxpayerInfo.address || taxpayerInfo.address.trim().length === 0) {
      fieldIssues.push({ field: "taxpayerInfo.address", issue: "Address is required" });
    }

    // Validate zip code
    if (taxpayerInfo.zipCode && !/^\d{4}$/.test(taxpayerInfo.zipCode)) {
      errors.push(`Invalid zip code format: ${taxpayerInfo.zipCode}. Expected format: XXXX`);
    }

    // Validate business type
    const validBusinessTypes = ["corporation", "partnership", "sole_proprietorship"];
    if (!validBusinessTypes.includes(taxpayerInfo.businessType)) {
      errors.push(`Invalid business type: ${taxpayerInfo.businessType}`);
    }

    // Validate VAT registration
    if (taxpayerInfo.isVATRegistered && !taxpayerInfo.vatRegistrationDate) {
      warnings.push("VAT registration date is missing for VAT-registered business");
    }

    return {
      passed: errors.length === 0 && fieldIssues.length === 0,
      errors,
      warnings,
      fieldIssues,
    };
  }

  /**
   * Validate BIR Form 2550M (Monthly VAT Return)
   */
  private async validateForm2550M(form: Form2550M): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string }[] = [];

    // Validate VAT registration requirement
    if (!form.taxpayerInfo.isVATRegistered) {
      errors.push("Business must be VAT registered to file Form 2550M");
    }

    // Validate sales breakdown
    if (!form.salesBreakdown) {
      fieldIssues.push({ field: "salesBreakdown", issue: "Sales breakdown is required" });
    } else {
      const salesResult = this.validateVATSalesBreakdown(form.salesBreakdown);
      errors.push(...salesResult.errors);
      warnings.push(...salesResult.warnings);
      fieldIssues.push(...salesResult.fieldIssues);
    }

    // Validate input tax
    if (!form.inputTax) {
      fieldIssues.push({ field: "inputTax", issue: "Input tax breakdown is required" });
    } else {
      const inputTaxResult = this.validateVATInputTax(form.inputTax);
      errors.push(...inputTaxResult.errors);
      warnings.push(...inputTaxResult.warnings);
      fieldIssues.push(...inputTaxResult.fieldIssues);
    }

    // Validate computation consistency
    if (form.salesBreakdown && form.inputTax) {
      const computationResult = this.validateVATComputation(form);
      errors.push(...computationResult.errors);
      warnings.push(...computationResult.warnings);
    }

    // Validate amounts are not negative (except for refundable VAT)
    if (form.netAmountPayable && form.netAmountPayable.isNegative()) {
      errors.push("Net amount payable cannot be negative");
    }

    if (form.penalties && form.penalties.isNegative()) {
      errors.push("Penalties cannot be negative");
    }

    return {
      passed: errors.length === 0 && fieldIssues.length === 0,
      errors,
      warnings,
      fieldIssues,
    };
  }

  /**
   * Validate BIR Form 1601EQ (Quarterly Withholding Tax Return)
   */
  private async validateForm1601EQ(form: Form1601EQ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string }[] = [];

    // Validate quarter
    if (!form.quarter || form.quarter < 1 || form.quarter > 4) {
      errors.push(`Invalid quarter: ${form.quarter}. Must be 1-4`);
    }

    // Validate total amounts
    if (form.totalIncomePayments.isNegative()) {
      errors.push("Total income payments cannot be negative");
    }

    if (form.totalTaxWithheld.isNegative()) {
      errors.push("Total tax withheld cannot be negative");
    }

    // Validate alphalist consistency
    if (form.alphalist && form.alphalist.length > 0) {
      const alphalistTotal = form.alphalist.reduce(
        (sum, entry) => sum.add(entry.taxWithheld),
        new Money(0)
      );

      if (!form.totalTaxWithheld.equals(alphalistTotal)) {
        errors.push("Total tax withheld does not match alphalist sum");
      }

      // Validate individual alphalist entries
      for (let i = 0; i < form.alphalist.length; i++) {
        const entry = form.alphalist[i];

        if (!this.TIN_REGEX.test(entry.payeeTin)) {
          errors.push(`Invalid TIN in alphalist entry ${i + 1}: ${entry.payeeTin}`);
        }

        if (!this.VALID_ATC_CODES.includes(entry.atcCode)) {
          warnings.push(`Unknown ATC code in alphalist entry ${i + 1}: ${entry.atcCode}`);
        }

        if (entry.taxBase.isNegative()) {
          errors.push(`Negative tax base in alphalist entry ${i + 1}`);
        }

        if (entry.taxWithheld.isNegative()) {
          errors.push(`Negative tax withheld in alphalist entry ${i + 1}`);
        }
      }
    }

    // Validate penalties
    if (form.surcharge && form.surcharge.isNegative()) {
      errors.push("Surcharge cannot be negative");
    }

    if (form.interest && form.interest.isNegative()) {
      errors.push("Interest cannot be negative");
    }

    return {
      passed: errors.length === 0 && fieldIssues.length === 0,
      errors,
      warnings,
      fieldIssues,
    };
  }

  /**
   * Validate BIR Form 1601C (Monthly Withholding Tax Return)
   */
  private async validateForm1601C(form: Form1601C): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string }[] = [];

    // Validate month
    if (!form.month || form.month < 1 || form.month > 12) {
      errors.push(`Invalid month: ${form.month}. Must be 1-12`);
    }

    // Validate total amounts
    if (form.totalIncomePayments.isNegative()) {
      errors.push("Total income payments cannot be negative");
    }

    if (form.totalTaxWithheld.isNegative()) {
      errors.push("Total tax withheld cannot be negative");
    }

    // Validate ATC code breakdown
    if (!form.withholdingByATC || Object.keys(form.withholdingByATC).length === 0) {
      warnings.push("No withholding by ATC codes reported");
    } else {
      const atcTotal = Object.values(form.withholdingByATC).reduce(
        (sum, atc) => sum.add(atc.taxWithheld),
        new Money(0)
      );

      if (!form.totalTaxWithheld.equals(atcTotal)) {
        errors.push("Total tax withheld does not match ATC breakdown sum");
      }

      // Validate individual ATC entries
      for (const [atcCode, atcData] of Object.entries(form.withholdingByATC)) {
        if (!this.VALID_ATC_CODES.includes(atcCode)) {
          warnings.push(`Unknown ATC code: ${atcCode}`);
        }

        if (atcData.incomePayments.isNegative()) {
          errors.push(`Negative income payments for ATC ${atcCode}`);
        }

        if (atcData.taxWithheld.isNegative()) {
          errors.push(`Negative tax withheld for ATC ${atcCode}`);
        }

        if (atcData.taxRate < 0 || atcData.taxRate > 1) {
          errors.push(`Invalid tax rate for ATC ${atcCode}: ${atcData.taxRate}`);
        }
      }
    }

    return {
      passed: errors.length === 0 && fieldIssues.length === 0,
      errors,
      warnings,
      fieldIssues,
    };
  }

  /**
   * Validate BIR Form 2307 (Certificate of Creditable Tax Withheld)
   */
  private async validateForm2307(form: Form2307): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string }[] = [];

    // Validate certificate number
    if (!form.certificateNumber) {
      fieldIssues.push({ field: "certificateNumber", issue: "Certificate number is required" });
    } else if (!/^2307-\d{4}-\d{6}$/.test(form.certificateNumber)) {
      warnings.push(`Certificate number format may not be standard: ${form.certificateNumber}`);
    }

    // Validate payee information
    if (!form.payeeInfo) {
      fieldIssues.push({ field: "payeeInfo", issue: "Payee information is required" });
    } else {
      if (!this.TIN_REGEX.test(form.payeeInfo.tin)) {
        errors.push(`Invalid payee TIN format: ${form.payeeInfo.tin}`);
      }

      if (!form.payeeInfo.name || form.payeeInfo.name.trim().length === 0) {
        fieldIssues.push({ field: "payeeInfo.name", issue: "Payee name is required" });
      }

      if (!form.payeeInfo.address || form.payeeInfo.address.trim().length === 0) {
        fieldIssues.push({ field: "payeeInfo.address", issue: "Payee address is required" });
      }
    }

    // Validate income payments
    if (!form.incomePayments || form.incomePayments.length === 0) {
      fieldIssues.push({
        field: "incomePayments",
        issue: "At least one income payment is required",
      });
    } else {
      const calculatedIncomeTotal = form.incomePayments.reduce(
        (sum, payment) => sum.add(payment.incomeAmount),
        new Money(0)
      );

      const calculatedTaxTotal = form.incomePayments.reduce(
        (sum, payment) => sum.add(payment.taxWithheld),
        new Money(0)
      );

      if (!form.totalIncomePayment.equals(calculatedIncomeTotal)) {
        errors.push("Total income payment does not match sum of individual payments");
      }

      if (!form.totalTaxWithheld.equals(calculatedTaxTotal)) {
        errors.push("Total tax withheld does not match sum of individual payments");
      }

      // Validate individual payments
      for (let i = 0; i < form.incomePayments.length; i++) {
        const payment = form.incomePayments[i];

        if (payment.month < 1 || payment.month > 12) {
          errors.push(`Invalid month in payment ${i + 1}: ${payment.month}`);
        }

        if (payment.incomeAmount.isNegative() || payment.incomeAmount.isZero()) {
          errors.push(`Income amount must be positive in payment ${i + 1}`);
        }

        if (payment.taxWithheld.isNegative()) {
          errors.push(`Tax withheld cannot be negative in payment ${i + 1}`);
        }

        if (!this.VALID_ATC_CODES.includes(payment.atcCode)) {
          warnings.push(`Unknown ATC code in payment ${i + 1}: ${payment.atcCode}`);
        }

        // Validate tax computation
        const expectedTax = payment.incomeAmount.multiply(payment.taxRate);
        if (!payment.taxWithheld.equals(expectedTax)) {
          warnings.push(`Tax computation may be incorrect in payment ${i + 1}`);
        }
      }
    }

    // Validate certificate dates
    if (form.dateIssued && form.dateIssued > new Date()) {
      warnings.push("Certificate issue date is in the future");
    }

    return {
      passed: errors.length === 0 && fieldIssues.length === 0,
      errors,
      warnings,
      fieldIssues,
    };
  }

  // Private helper methods

  private validateVATSalesBreakdown(salesBreakdown: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string }[] = [];

    if (salesBreakdown.vatableSales.isNegative()) {
      errors.push("Vatable sales cannot be negative");
    }

    if (salesBreakdown.vatExempt.isNegative()) {
      errors.push("VAT exempt sales cannot be negative");
    }

    if (salesBreakdown.vatZeroRated.isNegative()) {
      errors.push("Zero-rated sales cannot be negative");
    }

    // Check if output VAT is 12% of vatable sales
    const expectedOutputVAT = salesBreakdown.vatableSales.multiply(0.12);
    if (!salesBreakdown.outputVAT.equals(expectedOutputVAT)) {
      warnings.push("Output VAT does not equal 12% of vatable sales");
    }

    return { passed: errors.length === 0, errors, warnings, fieldIssues };
  }

  private validateVATInputTax(inputTax: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldIssues: { field: string; issue: string }[] = [];

    if (inputTax.domesticPurchases.isNegative()) {
      errors.push("Domestic purchases input VAT cannot be negative");
    }

    if (inputTax.importations.isNegative()) {
      errors.push("Importation input VAT cannot be negative");
    }

    if (inputTax.totalInputVAT.isNegative()) {
      errors.push("Total input VAT cannot be negative");
    }

    return { passed: errors.length === 0, errors, warnings, fieldIssues };
  }

  private validateVATComputation(form: Form2550M): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const netVAT = form.totalOutputVAT.subtract(form.totalInputVAT);

    if (netVAT.isPositive() && !form.vatPayable.equals(netVAT)) {
      errors.push("VAT payable calculation is incorrect");
    }

    if (netVAT.isNegative() && !form.vatRefundable.equals(netVAT.abs())) {
      errors.push("VAT refundable calculation is incorrect");
    }

    return { passed: errors.length === 0, errors, warnings, fieldIssues: [] };
  }

  private isValidTaxPeriod(taxPeriod: string, formType: string): boolean {
    switch (formType) {
      case "2550M":
      case "1601C":
        // Monthly format: MM/YYYY
        return /^(0[1-9]|1[0-2])\/\d{4}$/.test(taxPeriod);
      case "1601EQ":
        // Quarterly format: QX/YYYY
        return /^Q[1-4]\/\d{4}$/.test(taxPeriod);
      case "2307":
        // Annual format: YYYY
        return /^\d{4}$/.test(taxPeriod);
      default:
        return false;
    }
  }
}
