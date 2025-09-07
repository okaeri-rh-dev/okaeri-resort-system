/**
 * BIR Form Types and Interfaces
 *
 * Comprehensive TypeScript definitions for Philippine BIR forms including
 * 2550M (Monthly VAT Return), 1601EQ (Quarterly EWT), 1601C (Monthly EWT),
 * and 2307 (Certificate of Creditable Tax Withheld).
 */

import { Money } from "@/lib/money";

/**
 * Base types for all BIR forms
 */
export interface BIRTaxpayerInfo {
  tin: string; // Format: XXX-XXX-XXX-000
  rdo: string; // Revenue District Office
  businessName: string;
  tradeBusinessName?: string;
  address: string;
  zipCode: string;
  phoneNumber?: string;
  emailAddress?: string;
  isVATRegistered: boolean;
  vatRegistrationDate?: Date;
  businessType: "corporation" | "partnership" | "sole_proprietorship";
}

/**
 * Common BIR form header information
 */
export interface BIRFormHeader {
  formType: "2550M" | "1601EQ" | "1601C" | "2307";
  taxPeriod: string; // Format: MM/YYYY for monthly, QX/YYYY for quarterly
  dateOfFiling: Date;
  amendedReturn: boolean;
  sequenceNumber?: number;
}

/**
 * VAT Sales breakdown for Form 2550M
 */
export interface VATSalesBreakdown {
  vatableSales: Money;
  vatZeroRated: Money;
  vatExempt: Money;
  outputVAT: Money;
  totalSales: Money;
}

/**
 * VAT Input Tax breakdown
 */
export interface VATInputTax {
  domesticPurchases: Money;
  importations: Money;
  transitionalInputTax: Money;
  presumptiveInputTax: Money;
  totalInputVAT: Money;
  inputVATFromPreviousPeriod: Money;
}

/**
 * BIR Form 2550M - Monthly VAT Return
 */
export interface Form2550M extends BIRFormHeader {
  formType: "2550M";
  taxpayerInfo: BIRTaxpayerInfo;

  // Part I - VAT on Sales
  salesBreakdown: VATSalesBreakdown;

  // Part II - VAT on Purchases/Input VAT
  inputTax: VATInputTax;

  // Part III - Computation of VAT Payable/Refundable
  totalOutputVAT: Money;
  totalInputVAT: Money;
  vatPayable: Money;
  vatRefundable: Money;
  excessCreditsFromPreviousPeriod: Money;

  // Part IV - Adjustments
  adjustments: {
    priorPeriodErrors: Money;
    succeededByCapitalGainsTax: Money;
    others: Money;
  };

  // Final amounts
  netAmountPayable: Money;
  penalties: Money;
  totalAmountPayable: Money;

  // Generated metadata
  generatedDate: Date;
  generatedBy: string;
}

/**
 * Withholding tax transaction for alphalist
 */
export interface WithholdingTaxTransaction {
  payeeName: string;
  payeeTin: string;
  payeeAddress: string;
  atcCode: string;
  taxBase: Money;
  taxRate: number;
  taxWithheld: Money;
  month: number;
  particulars: string;
}

/**
 * BIR Form 1601EQ - Quarterly Expanded Withholding Tax Return
 */
export interface Form1601EQ extends BIRFormHeader {
  formType: "1601EQ";
  taxpayerInfo: BIRTaxpayerInfo;
  quarter: 1 | 2 | 3 | 4;

  // Summary of withholding tax
  totalIncomePayments: Money;
  totalTaxWithheld: Money;
  taxRemittedInReturn: Money;
  excessCreditsFromPreviousPeriod: Money;

  // Penalties and interests
  surcharge: Money;
  interest: Money;
  compromise: Money;
  totalPenalties: Money;

  // Final amounts
  totalAmountPayable: Money;

  // Alphalist summary (detailed transaction list)
  alphalist: WithholdingTaxTransaction[];

  // Generated metadata
  generatedDate: Date;
  generatedBy: string;
}

/**
 * BIR Form 1601C - Monthly Expanded Withholding Tax Return
 */
export interface Form1601C extends BIRFormHeader {
  formType: "1601C";
  taxpayerInfo: BIRTaxpayerInfo;
  month: number; // 1-12

  // Summary of withholding tax by ATC codes
  withholdingByATC: {
    [atcCode: string]: {
      incomePayments: Money;
      taxWithheld: Money;
      taxRate: number;
    };
  };

  // Totals
  totalIncomePayments: Money;
  totalTaxWithheld: Money;
  taxRemittedInReturn: Money;

  // Penalties
  surcharge: Money;
  interest: Money;
  totalPenalties: Money;
  totalAmountPayable: Money;

  // Generated metadata
  generatedDate: Date;
  generatedBy: string;
}

/**
 * BIR Form 2307 - Certificate of Creditable Tax Withheld at Source
 */
export interface Form2307 extends BIRFormHeader {
  formType: "2307";

  // Payor information (withholding agent)
  payorInfo: BIRTaxpayerInfo;

  // Payee information (income recipient)
  payeeInfo: {
    tin: string;
    name: string;
    address: string;
    zipCode?: string;
  };

  certificateNumber: string;

  // Income and tax details
  incomePayments: Array<{
    month: number;
    particulars: string;
    atcCode: string;
    incomeAmount: Money;
    taxRate: number;
    taxWithheld: Money;
  }>;

  // Summary totals
  totalIncomePayment: Money;
  totalTaxWithheld: Money;

  // Certificate details
  dateIssued: Date;
  placeIssued: string;

  // Generated metadata
  generatedDate: Date;
  generatedBy: string;
}

/**
 * Union type for all BIR forms
 */
export type BIRForm = Form2550M | Form1601EQ | Form1601C | Form2307;

/**
 * Validation result for BIR forms
 */
export interface BIRFormValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
}

/**
 * Export configuration for BIR forms
 */
export interface BIRExportConfig {
  format: "xml" | "pdf" | "dat" | "json";
  includeDigitalSignature?: boolean;
  compressionLevel?: number;
  validateBeforeExport?: boolean;
  customFields?: Record<string, any>;
}

/**
 * Export result
 */
export interface BIRExportResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  mimeType: string;
  data: Buffer | string;
  checksum?: string;
  validationResult?: BIRFormValidation;
  exportedAt: Date;
}

/**
 * Tax period utilities
 */
export interface TaxPeriod {
  year: number;
  month?: number; // 1-12 for monthly returns
  quarter?: 1 | 2 | 3 | 4; // for quarterly returns
}

/**
 * Alphalist entry for detailed withholding tax reporting
 */
export interface AlphalistEntry {
  sequenceNumber: number;
  payeeTin: string;
  payeeName: string;
  atcCode: string;
  taxBase: Money;
  taxRate: number;
  taxWithheld: Money;
  month1: Money; // January
  month2: Money; // February
  month3: Money; // March (for quarterly only)
}

/**
 * BIR configuration settings
 */
export interface BIRConfiguration {
  defaultRDO: string;
  companyInfo: BIRTaxpayerInfo;
  signatories: {
    preparedBy: string;
    position: string;
    tin?: string;
  }[];
  digitalCertificate?: {
    path: string;
    password: string;
    validUntil: Date;
  };
}

/**
 * Tax computation summary
 */
export interface TaxComputationSummary {
  grossSales: Money;
  taxableBase: Money;
  exemptSales: Money;
  zeroRatedSales: Money;
  outputVAT: Money;
  inputVAT: Money;
  withholdingTax: Money;
  netTaxDue: Money;
  penalties: Money;
  totalAmountDue: Money;
}

/**
 * Audit trail for BIR form generation
 */
export interface BIRAuditTrail {
  formId: string;
  formType: string;
  taxPeriod: string;
  generatedBy: string;
  generatedAt: Date;
  dataSource: {
    transactionCount: number;
    dateRange: {
      from: Date;
      to: Date;
    };
    sourceSystem: string;
  };
  computations: {
    algorithm: string;
    version: string;
    parameters: Record<string, any>;
  };
  validation: {
    validationRules: string[];
    validationDate: Date;
    validationResult: "passed" | "failed" | "warnings";
  };
  export: {
    formats: string[];
    exportedAt: Date[];
    recipients?: string[];
  };
}
