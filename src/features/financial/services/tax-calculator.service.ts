/**
 * Tax Calculator Service
 *
 * Comprehensive Philippine tax calculation service for BIR compliance
 * including VAT, withholding tax, percentage tax, and special discounts.
 */

import { Money } from "@/lib/money";
import { db } from "@/lib/db";
import {
  taxComplianceAudit,
  documentGenerationAudit,
} from "@/lib/db/schema/financial-audit.schema";
import { withholdingTaxCertificates } from "@/lib/db/schema/expense.schema";
import { auditTaxCalculation } from "@/lib/audit";
import { generateCode } from "@/lib/utils";

// Philippine tax rates
const TAX_RATES = {
  // Value Added Tax
  VAT: 0.12, // 12% standard VAT rate
  VAT_THRESHOLD: 3000000, // ₱3M annual threshold for VAT registration

  // Expanded Withholding Tax (EWT) rates
  EWT: {
    // Professional services
    PROFESSIONAL_INDIVIDUAL: 0.1, // 10% for individual professionals
    PROFESSIONAL_CORPORATION: 0.15, // 15% for corporate professional services

    // Rental/Lease
    RENTAL_INDIVIDUAL: 0.05, // 5% for individual lessors
    RENTAL_CORPORATION: 0.05, // 5% for corporate lessors

    // Contractor services
    CONTRACTOR_SERVICES: 0.02, // 2% for services
    CONTRACTOR_GOODS: 0.01, // 1% for sale of goods

    // Others
    COMMISSION: 0.1, // 10% for commission
    BROKER: 0.1, // 10% for brokers
    TALENT_FEE: 0.1, // 10% for talent fees
  },

  // Final Withholding Tax (FWT) rates
  FWT: {
    INTEREST_INDIVIDUAL: 0.2, // 20% on interest income
    DIVIDEND: 0.1, // 10% on cash dividends
    ROYALTY: 0.1, // 10% on royalties
  },

  // Percentage Tax (for non-VAT registered)
  PERCENTAGE_TAX: 0.03, // 3% on gross sales/receipts

  // Special discounts
  SENIOR_DISCOUNT: 0.2, // 20% discount for senior citizens
  PWD_DISCOUNT: 0.2, // 20% discount for persons with disabilities

  // Service charge
  SERVICE_CHARGE: 0.1, // 10% service charge (common in hospitality)
} as const;

// ATC (Alphanumeric Tax Code) mapping for BIR
const ATC_CODES = {
  // Income payments subject to EWT
  WI010: "Professional fees (individuals)",
  WC010: "Professional fees (corporations)",
  WI050: "Rental (real property)",
  WC140: "Purchase of goods",
  WC160: "Purchase of services",
  WI011: "Commission (individuals)",
  WC011: "Commission (corporations)",

  // VAT
  VT010: "VAT on sales",
  VT011: "VAT on services",

  // Others
  PT010: "Percentage tax",
} as const;

interface VATCalculation {
  grossAmount: Money;
  vatableSales: Money;
  vatExemptSales: Money;
  zeroRatedSales: Money;
  vatAmount: Money;
  totalAmount: Money;
  isVATInclusive: boolean;
}

interface WithholdingTaxCalculation {
  grossAmount: Money;
  taxType: "EWT" | "FWT";
  taxRate: number;
  taxAmount: Money;
  netAmount: Money;
  atcCode: string;
  formType: string; // BIR Form 2307, 2306, etc.
}

interface DiscountCalculation {
  originalAmount: Money;
  discountType: "senior" | "pwd" | "promotional";
  discountRate: number;
  discountAmount: Money;
  vatExemptAmount: Money;
  netAmount: Money;
  compliance: string; // RA 9994, RA 10754, etc.
}

interface ComprehensiveTaxCalculation {
  grossAmount: Money;
  discounts: DiscountCalculation | null;
  vat: VATCalculation | null;
  withholdingTax: WithholdingTaxCalculation | null;
  serviceCharge: Money | null;
  percentageTax: Money | null;
  netPayable: Money;
  netReceivable: Money;
  totalTaxes: Money;
}

export class TaxCalculatorService {
  /**
   * Calculate VAT (Value Added Tax)
   */
  calculateVAT(
    amount: number | string | Money,
    options: {
      isInclusive?: boolean;
      isExempt?: boolean;
      isZeroRated?: boolean;
    } = {}
  ): VATCalculation {
    const grossAmount = amount instanceof Money ? amount : new Money(amount);

    // Handle VAT-exempt sales
    if (options.isExempt) {
      return {
        grossAmount,
        vatableSales: new Money(0),
        vatExemptSales: grossAmount,
        zeroRatedSales: new Money(0),
        vatAmount: new Money(0),
        totalAmount: grossAmount,
        isVATInclusive: false,
      };
    }

    // Handle zero-rated sales (exports, etc.)
    if (options.isZeroRated) {
      return {
        grossAmount,
        vatableSales: grossAmount,
        vatExemptSales: new Money(0),
        zeroRatedSales: grossAmount,
        vatAmount: new Money(0),
        totalAmount: grossAmount,
        isVATInclusive: false,
      };
    }

    // Regular VAT calculation
    if (options.isInclusive) {
      // Amount already includes VAT
      const vatableSales = grossAmount.divide(1 + TAX_RATES.VAT);
      const vatAmount = grossAmount.subtract(vatableSales);

      return {
        grossAmount,
        vatableSales,
        vatExemptSales: new Money(0),
        zeroRatedSales: new Money(0),
        vatAmount,
        totalAmount: grossAmount,
        isVATInclusive: true,
      };
    } else {
      // Amount excludes VAT
      const vatAmount = grossAmount.multiply(TAX_RATES.VAT);
      const totalAmount = grossAmount.add(vatAmount);

      return {
        grossAmount,
        vatableSales: grossAmount,
        vatExemptSales: new Money(0),
        zeroRatedSales: new Money(0),
        vatAmount,
        totalAmount,
        isVATInclusive: false,
      };
    }
  }

  /**
   * Calculate Expanded Withholding Tax (EWT)
   */
  calculateWithholdingTax(
    amount: number | string | Money,
    options: {
      payeeType: "individual" | "corporation";
      incomeType: keyof typeof TAX_RATES.EWT;
      isVATInclusive?: boolean;
    }
  ): WithholdingTaxCalculation {
    const grossAmount = amount instanceof Money ? amount : new Money(amount);

    // Get applicable tax rate
    const taxRate = TAX_RATES.EWT[options.incomeType];
    if (!taxRate) {
      throw new Error(`Invalid income type for withholding tax: ${options.incomeType}`);
    }

    // For VAT-inclusive amounts, calculate on VAT-exclusive amount
    let taxableAmount = grossAmount;
    if (options.isVATInclusive) {
      taxableAmount = grossAmount.divide(1 + TAX_RATES.VAT);
    }

    // Calculate withholding tax
    const taxAmount = taxableAmount.multiply(taxRate);
    const netAmount = grossAmount.subtract(taxAmount);

    // Determine ATC code
    const atcCode = this.getATCCode(options.incomeType, options.payeeType);

    return {
      grossAmount,
      taxType: "EWT",
      taxRate,
      taxAmount,
      netAmount,
      atcCode,
      formType: "2307", // BIR Form 2307 for EWT
    };
  }

  /**
   * Calculate Senior Citizen discount (RA 9994)
   */
  calculateSeniorDiscount(
    amount: number | string | Money,
    options: {
      idNumber: string;
      customerName: string;
      includesVAT?: boolean;
    }
  ): DiscountCalculation {
    const originalAmount = amount instanceof Money ? amount : new Money(amount);

    // Senior citizens get 20% discount and are VAT exempt
    const discountRate = TAX_RATES.SENIOR_DISCOUNT;

    // If amount includes VAT, remove it first
    let baseAmount = originalAmount;
    let vatExemptAmount = new Money(0);

    if (options.includesVAT) {
      baseAmount = originalAmount.divide(1 + TAX_RATES.VAT);
      vatExemptAmount = originalAmount.subtract(baseAmount);
    }

    // Apply 20% discount on base amount
    const discountAmount = baseAmount.multiply(discountRate);
    const netAmount = baseAmount.subtract(discountAmount);

    return {
      originalAmount,
      discountType: "senior",
      discountRate,
      discountAmount,
      vatExemptAmount,
      netAmount,
      compliance: "RA 9994 (Expanded Senior Citizens Act)",
    };
  }

  /**
   * Calculate PWD discount (RA 10754)
   */
  calculatePWDDiscount(
    amount: number | string | Money,
    options: {
      idNumber: string;
      customerName: string;
      includesVAT?: boolean;
    }
  ): DiscountCalculation {
    const originalAmount = amount instanceof Money ? amount : new Money(amount);

    // PWDs get 20% discount and are VAT exempt
    const discountRate = TAX_RATES.PWD_DISCOUNT;

    // If amount includes VAT, remove it first
    let baseAmount = originalAmount;
    let vatExemptAmount = new Money(0);

    if (options.includesVAT) {
      baseAmount = originalAmount.divide(1 + TAX_RATES.VAT);
      vatExemptAmount = originalAmount.subtract(baseAmount);
    }

    // Apply 20% discount on base amount
    const discountAmount = baseAmount.multiply(discountRate);
    const netAmount = baseAmount.subtract(discountAmount);

    return {
      originalAmount,
      discountType: "pwd",
      discountRate,
      discountAmount,
      vatExemptAmount,
      netAmount,
      compliance: "RA 10754 (PWD Benefits Act)",
    };
  }

  /**
   * Calculate Percentage Tax (for non-VAT registered businesses)
   */
  calculatePercentageTax(grossSales: number | string | Money): Money {
    const amount = grossSales instanceof Money ? grossSales : new Money(grossSales);

    // 3% on gross sales/receipts for non-VAT registered
    return amount.multiply(TAX_RATES.PERCENTAGE_TAX);
  }

  /**
   * Calculate service charge (common in hospitality)
   */
  calculateServiceCharge(
    amount: number | string | Money,
    rate: number = TAX_RATES.SERVICE_CHARGE
  ): Money {
    const baseAmount = amount instanceof Money ? amount : new Money(amount);

    return baseAmount.multiply(rate);
  }

  /**
   * Comprehensive tax calculation for a transaction
   */
  calculateComprehensiveTax(
    amount: number | string | Money,
    options: {
      // Discounts
      seniorDiscount?: boolean;
      pwdDiscount?: boolean;
      seniorPwdId?: string;
      customerName?: string;

      // VAT
      isVATRegistered?: boolean;
      isVATInclusive?: boolean;
      isVATExempt?: boolean;

      // Withholding tax
      hasWithholding?: boolean;
      withholdingType?: keyof typeof TAX_RATES.EWT;
      payeeType?: "individual" | "corporation";

      // Service charge
      hasServiceCharge?: boolean;
      serviceChargeRate?: number;

      // User context for audit
      userId?: string;
      transactionId?: string;
    } = {}
  ): ComprehensiveTaxCalculation {
    const grossAmount = amount instanceof Money ? amount : new Money(amount);

    let workingAmount = grossAmount;
    let discounts: DiscountCalculation | null = null;
    let vat: VATCalculation | null = null;
    let withholdingTax: WithholdingTaxCalculation | null = null;
    let serviceCharge: Money | null = null;
    let percentageTax: Money | null = null;

    // Step 1: Apply senior/PWD discount if applicable
    if (options.seniorDiscount && options.seniorPwdId) {
      discounts = this.calculateSeniorDiscount(workingAmount, {
        idNumber: options.seniorPwdId,
        customerName: options.customerName || "",
        includesVAT: options.isVATInclusive,
      });
      workingAmount = discounts.netAmount;
    } else if (options.pwdDiscount && options.seniorPwdId) {
      discounts = this.calculatePWDDiscount(workingAmount, {
        idNumber: options.seniorPwdId,
        customerName: options.customerName || "",
        includesVAT: options.isVATInclusive,
      });
      workingAmount = discounts.netAmount;
    }

    // Step 2: Calculate VAT or Percentage Tax
    if (options.isVATRegistered && !discounts) {
      // No VAT if senior/PWD discount
      vat = this.calculateVAT(workingAmount, {
        isInclusive: options.isVATInclusive,
        isExempt: options.isVATExempt,
      });
    } else if (!options.isVATRegistered) {
      // Non-VAT registered pay 3% percentage tax
      percentageTax = this.calculatePercentageTax(workingAmount);
    }

    // Step 3: Calculate withholding tax if applicable
    if (options.hasWithholding && options.withholdingType && options.payeeType) {
      withholdingTax = this.calculateWithholdingTax(workingAmount, {
        incomeType: options.withholdingType,
        payeeType: options.payeeType,
        isVATInclusive: false, // Already handled VAT above
      });
    }

    // Step 4: Calculate service charge if applicable
    if (options.hasServiceCharge) {
      serviceCharge = this.calculateServiceCharge(workingAmount, options.serviceChargeRate);
    }

    // Calculate totals
    const totalDiscounts = discounts?.discountAmount || new Money(0);
    const totalVAT = vat?.vatAmount || new Money(0);
    const totalWithholding = withholdingTax?.taxAmount || new Money(0);
    const totalPercentageTax = percentageTax || new Money(0);
    const totalServiceCharge = serviceCharge || new Money(0);

    const totalTaxes = totalVAT.add(totalWithholding).add(totalPercentageTax);

    // Net payable (amount to pay after all deductions)
    const netPayable = grossAmount
      .subtract(totalDiscounts)
      .add(totalVAT)
      .add(totalServiceCharge)
      .subtract(totalWithholding); // Withholding reduces payment

    // Net receivable (amount to receive after taxes)
    const netReceivable = grossAmount
      .subtract(totalDiscounts)
      .subtract(totalTaxes)
      .add(totalServiceCharge);

    // Audit the calculation if user context provided
    if (options.userId && options.transactionId) {
      this.auditTaxCalculation({
        userId: options.userId,
        transactionId: options.transactionId,
        grossAmount: grossAmount.toNumber(),
        calculations: {
          discounts: totalDiscounts.toNumber(),
          vat: totalVAT.toNumber(),
          withholding: totalWithholding.toNumber(),
          percentageTax: totalPercentageTax.toNumber(),
          serviceCharge: totalServiceCharge.toNumber(),
          totalTaxes: totalTaxes.toNumber(),
          netPayable: netPayable.toNumber(),
        },
      });
    }

    return {
      grossAmount,
      discounts,
      vat,
      withholdingTax,
      serviceCharge,
      percentageTax,
      netPayable,
      netReceivable,
      totalTaxes,
    };
  }

  /**
   * Generate BIR Form 2307 (Certificate of Creditable Tax Withheld at Source)
   */
  async generateForm2307(
    projectId: string,
    data: {
      payeeName: string;
      payeeTin: string;
      payeeAddress: string;
      incomePayments: Array<{
        date: Date;
        particulars: string;
        atcCode: string;
        incomeAmount: Money;
        taxRate: number;
        taxWithheld: Money;
      }>;
      period: { from: Date; to: Date };
      userId: string;
    }
  ): Promise<string> {
    // Calculate totals
    const totalIncome = data.incomePayments.reduce(
      (sum, payment) => sum.add(payment.incomeAmount),
      new Money(0)
    );

    const totalTaxWithheld = data.incomePayments.reduce(
      (sum, payment) => sum.add(payment.taxWithheld),
      new Money(0)
    );

    // Generate certificate number
    const certificateNumber = await this.generateCertificateNumber(projectId);

    // Create withholding tax certificate record
    const [certificate] = await db
      .insert(withholdingTaxCertificates)
      .values({
        projectId,
        certificateNumber,
        formType: "2307",
        periodCovered: `${data.period.from.getFullYear()}-Q${Math.ceil((data.period.from.getMonth() + 1) / 3)}`,
        payeeName: data.payeeName,
        payeeTin: data.payeeTin,
        payeeAddress: data.payeeAddress,
        incomePayment: totalIncome.toNumber().toString(),
        taxRate: totalTaxWithheld.divide(totalIncome).multiply(100).toNumber().toString(),
        taxWithheld: totalTaxWithheld.toNumber().toString(),
        atcCode: data.incomePayments[0]?.atcCode || "WI999",
        status: "issued",
        createdBy: data.userId,
      })
      .returning();

    // Generate document audit
    await db.insert(documentGenerationAudit).values({
      projectId,
      documentType: "BIR_FORM_2307",
      documentNumber: certificateNumber,
      documentDate: new Date(),
      entityType: "withholding_certificate",
      entityId: certificate.id,
      generatedBy: data.userId,
      generationMethod: "automatic",
      contentHash: this.generateDocumentHash(certificate),
      deliveryMethod: "download",
      birCompliant: true,
      metadata: {
        payeeTin: data.payeeTin,
        totalIncome: totalIncome.toNumber(),
        totalTaxWithheld: totalTaxWithheld.toNumber(),
      },
    });

    // Audit log
    await auditTaxCalculation({
      userId: data.userId,
      calculationType: "withholding",
      entityId: certificate.id,
      grossAmount: totalIncome.toNumber(),
      taxAmount: totalTaxWithheld.toNumber(),
      taxRate: parseFloat(certificate.taxRate),
    });

    return certificate.id;
  }

  /**
   * Generate monthly VAT return data (BIR Form 2550M)
   */
  async generateMonthlyVATReturn(
    projectId: string,
    month: Date,
    userId: string
  ): Promise<{
    taxableBase: Money;
    outputVAT: Money;
    inputVAT: Money;
    netVATPayable: Money;
    excessInputVAT: Money;
  }> {
    // This would fetch actual transaction data
    // For now, returning calculated example
    const taxableBase = new Money(100000);
    const outputVAT = taxableBase.multiply(TAX_RATES.VAT);
    const inputVAT = new Money(5000); // From purchases
    const netVAT = outputVAT.subtract(inputVAT);

    const result = {
      taxableBase,
      outputVAT,
      inputVAT,
      netVATPayable: netVAT.isPositive() ? netVAT : new Money(0),
      excessInputVAT: netVAT.isNegative() ? netVAT.multiply(-1) : new Money(0),
    };

    // Create tax compliance audit
    await db.insert(taxComplianceAudit).values({
      projectId,
      periodType: "monthly",
      periodStart: new Date(month.getFullYear(), month.getMonth(), 1),
      periodEnd: new Date(month.getFullYear(), month.getMonth() + 1, 0),
      vatSales: taxableBase.toNumber().toString(),
      outputVat: outputVAT.toNumber().toString(),
      inputVat: inputVAT.toNumber().toString(),
      netVatPayable: result.netVATPayable.toNumber().toString(),
      formType: "2550M",
      isCompliant: true,
      preparedBy: userId,
    });

    return result;
  }

  /**
   * Check if business should be VAT registered
   */
  async checkVATRegistrationRequirement(
    projectId: string,
    annualGrossReceipts: number | string | Money
  ): Promise<{
    required: boolean;
    threshold: Money;
    currentReceipts: Money;
    percentageOfThreshold: number;
  }> {
    const receipts =
      annualGrossReceipts instanceof Money ? annualGrossReceipts : new Money(annualGrossReceipts);

    const threshold = new Money(TAX_RATES.VAT_THRESHOLD);
    const required = receipts.greaterThan(threshold);
    const percentage = receipts.divide(threshold).multiply(100).toNumber();

    return {
      required,
      threshold,
      currentReceipts: receipts,
      percentageOfThreshold: percentage,
    };
  }

  // Private helper methods

  private getATCCode(incomeType: string, payeeType: "individual" | "corporation"): string {
    const codeMap = {
      PROFESSIONAL_INDIVIDUAL: "WI010",
      PROFESSIONAL_CORPORATION: "WC010",
      RENTAL_INDIVIDUAL: "WI050",
      RENTAL_CORPORATION: "WI050",
      CONTRACTOR_SERVICES: "WC160",
      CONTRACTOR_GOODS: "WC140",
      COMMISSION: payeeType === "individual" ? "WI011" : "WC011",
    };

    const key =
      incomeType.includes("INDIVIDUAL") || incomeType.includes("CORPORATION")
        ? incomeType
        : `${incomeType}_${payeeType.toUpperCase()}`;

    return codeMap[key] || "WI999";
  }

  private async generateCertificateNumber(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `2307-${year}`;

    // This would check against existing certificates
    const sequence = Math.floor(Math.random() * 999999) + 1;
    return generateCode(prefix, sequence, 6);
  }

  private generateDocumentHash(data: any): string {
    const crypto = require("crypto");
    const jsonString = JSON.stringify(data);
    return crypto.createHash("sha256").update(jsonString).digest("hex");
  }

  private async auditTaxCalculation(data: {
    userId: string;
    transactionId: string;
    grossAmount: number;
    calculations: Record<string, number>;
  }) {
    await auditTaxCalculation({
      userId: data.userId,
      calculationType: "vat",
      entityId: data.transactionId,
      grossAmount: data.grossAmount,
      taxAmount: data.calculations.totalTaxes,
      taxRate: TAX_RATES.VAT,
    });
  }
}
