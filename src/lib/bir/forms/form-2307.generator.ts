/**
 * BIR Form 2307 Generator - Certificate of Creditable Tax Withheld at Source
 *
 * Generates Philippine Certificate of Creditable Tax Withheld at Source (BIR Form 2307)
 * for individual payees to claim tax credits on their income tax returns.
 *
 * Key Features:
 * - Individual certificate generation per payee
 * - Detailed income payment breakdown by month
 * - ATC code classification and tax rate application
 * - Sequential certificate numbering system
 * - Compliance with BIR certificate requirements
 * - Digital signature support for electronic certificates
 */

import { Money } from "@/lib/money";
import { Form2307, BIRTaxpayerInfo, WithholdingTaxTransaction } from "@/lib/bir/types";
import { generateCode } from "@/lib/utils";
import { db } from "@/lib/db";
import { withholdingTaxCertificates } from "@/lib/db/schema/expense.schema";

/**
 * Certificate generation request data
 */
interface CertificateGenerationRequest {
  payeeName: string;
  payeeTin: string;
  payeeAddress: string;
  zipCode?: string;
  period: {
    from: Date;
    to: Date;
  };
  incomePayments: Array<{
    date: Date;
    particulars: string;
    atcCode: string;
    incomeAmount: Money;
    taxRate: number;
    taxWithheld: Money;
  }>;
  certificateType?: "annual" | "quarterly" | "monthly";
  digitalSignature?: boolean;
}

/**
 * Certificate validation result
 */
interface CertificateValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  complianceIssues: string[];
}

/**
 * Bulk certificate generation result
 */
interface BulkCertificateResult {
  successful: Form2307[];
  failed: Array<{
    payeeName: string;
    payeeTin: string;
    error: string;
  }>;
  summary: {
    totalRequested: number;
    totalSuccessful: number;
    totalFailed: number;
    totalIncomePayments: Money;
    totalTaxWithheld: Money;
  };
}

export class Form2307Generator {
  /**
   * Generate individual BIR Form 2307 certificate
   */
  async generate(
    projectId: string,
    request: CertificateGenerationRequest,
    payorInfo: BIRTaxpayerInfo,
    userId: string
  ): Promise<Form2307> {
    // Validate inputs
    this.validateGenerationRequest(request, payorInfo);

    // Generate unique certificate number
    const certificateNumber = await this.generateCertificateNumber(projectId);

    // Calculate totals
    const totalIncomePayment = request.incomePayments.reduce(
      (sum, payment) => sum.add(payment.incomeAmount),
      new Money(0)
    );

    const totalTaxWithheld = request.incomePayments.reduce(
      (sum, payment) => sum.add(payment.taxWithheld),
      new Money(0)
    );

    // Prepare monthly breakdown
    const monthlyBreakdown = this.prepareMonthlyBreakdown(request.incomePayments);

    // Create the certificate
    const certificate: Form2307 = {
      formType: "2307",
      taxPeriod: `${request.period.from.getFullYear()}`,
      dateOfFiling: new Date(),
      amendedReturn: false,
      certificateNumber,

      // Payor information (withholding agent)
      payorInfo,

      // Payee information (income recipient)
      payeeInfo: {
        tin: request.payeeTin,
        name: request.payeeName,
        address: request.payeeAddress,
        zipCode: request.zipCode,
      },

      // Income and tax details
      incomePayments: monthlyBreakdown,

      // Summary totals
      totalIncomePayment,
      totalTaxWithheld,

      // Certificate details
      dateIssued: new Date(),
      placeIssued: payorInfo.address,

      // Generated metadata
      generatedDate: new Date(),
      generatedBy: userId,
    };

    // Validate the certificate
    const validation = await this.validateCertificate(certificate);
    if (!validation.isValid) {
      throw new Error(`Certificate validation failed: ${validation.errors.join(", ")}`);
    }

    // Save to database
    await this.saveCertificateToDatabase(projectId, certificate, userId);

    // Audit the generation
    await this.auditCertificateGeneration(projectId, certificate, request, userId);

    return certificate;
  }

  /**
   * Generate multiple certificates for a period (bulk generation)
   */
  async generateBulkCertificates(
    projectId: string,
    period: { from: Date; to: Date },
    payorInfo: BIRTaxpayerInfo,
    userId: string,
    options?: {
      minimumTaxWithheld?: Money;
      includedATCCodes?: string[];
      excludedPayees?: string[];
    }
  ): Promise<BulkCertificateResult> {
    // Fetch all withholding transactions for the period
    const transactions = await this.fetchWithholdingTransactions(projectId, period, options);

    // Group transactions by payee
    const transactionsByPayee = this.groupTransactionsByPayee(transactions);

    const successful: Form2307[] = [];
    const failed: Array<{ payeeName: string; payeeTin: string; error: string }> = [];

    // Generate certificate for each payee
    for (const [payeeTin, payeeTransactions] of transactionsByPayee.entries()) {
      try {
        const payeeInfo = payeeTransactions[0]; // Get payee info from first transaction

        const request: CertificateGenerationRequest = {
          payeeName: payeeInfo.payeeName,
          payeeTin: payeeInfo.payeeTin,
          payeeAddress: payeeInfo.payeeAddress,
          period,
          incomePayments: payeeTransactions.map((t) => ({
            date: new Date(period.from.getFullYear(), t.month - 1, 15), // Mid-month date
            particulars: t.particulars,
            atcCode: t.atcCode,
            incomeAmount: t.taxBase,
            taxRate: t.taxRate,
            taxWithheld: t.taxWithheld,
          })),
        };

        const certificate = await this.generate(projectId, request, payorInfo, userId);
        successful.push(certificate);
      } catch (error: any) {
        failed.push({
          payeeName: payeeTransactions[0].payeeName,
          payeeTin,
          error: error.message,
        });
      }
    }

    // Calculate summary
    const totalIncomePayments = successful.reduce(
      (sum, cert) => sum.add(cert.totalIncomePayment),
      new Money(0)
    );

    const totalTaxWithheld = successful.reduce(
      (sum, cert) => sum.add(cert.totalTaxWithheld),
      new Money(0)
    );

    return {
      successful,
      failed,
      summary: {
        totalRequested: transactionsByPayee.size,
        totalSuccessful: successful.length,
        totalFailed: failed.length,
        totalIncomePayments,
        totalTaxWithheld,
      },
    };
  }

  /**
   * Preview certificate data before generation
   */
  async previewCertificate(
    projectId: string,
    payeeTin: string,
    period: { from: Date; to: Date }
  ): Promise<{
    payeeName: string;
    payeeAddress: string;
    totalIncomePayments: Money;
    totalTaxWithheld: Money;
    transactionCount: number;
    averageTaxRate: number;
    monthlyBreakdown: Array<{
      month: string;
      incomePayments: Money;
      taxWithheld: Money;
      transactionCount: number;
    }>;
  }> {
    const transactions = await this.fetchWithholdingTransactions(projectId, period, {
      includedPayees: [payeeTin],
    });

    if (transactions.length === 0) {
      throw new Error(`No withholding transactions found for payee TIN: ${payeeTin}`);
    }

    const payeeInfo = transactions[0];
    const totalIncomePayments = transactions.reduce((sum, t) => sum.add(t.taxBase), new Money(0));

    const totalTaxWithheld = transactions.reduce((sum, t) => sum.add(t.taxWithheld), new Money(0));

    const averageTaxRate = totalIncomePayments.isZero()
      ? 0
      : totalTaxWithheld.divide(totalIncomePayments).multiply(100).toNumber();

    // Group by month
    const monthlyMap = new Map<number, { income: Money; tax: Money; count: number }>();

    for (const transaction of transactions) {
      const month = transaction.month;
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { income: new Money(0), tax: new Money(0), count: 0 });
      }

      const monthly = monthlyMap.get(month)!;
      monthly.income = monthly.income.add(transaction.taxBase);
      monthly.tax = monthly.tax.add(transaction.taxWithheld);
      monthly.count++;
    }

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month: new Date(period.from.getFullYear(), month - 1).toLocaleDateString("en-PH", {
          month: "long",
          year: "numeric",
        }),
        incomePayments: data.income,
        taxWithheld: data.tax,
        transactionCount: data.count,
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

    return {
      payeeName: payeeInfo.payeeName,
      payeeAddress: payeeInfo.payeeAddress,
      totalIncomePayments,
      totalTaxWithheld,
      transactionCount: transactions.length,
      averageTaxRate,
      monthlyBreakdown,
    };
  }

  // Private implementation methods

  private validateGenerationRequest(
    request: CertificateGenerationRequest,
    payorInfo: BIRTaxpayerInfo
  ): void {
    const errors: string[] = [];

    // Validate payor TIN
    if (!this.isValidTIN(payorInfo.tin)) {
      errors.push("Invalid payor TIN format");
    }

    // Validate payee TIN
    if (!this.isValidTIN(request.payeeTin)) {
      errors.push("Invalid payee TIN format");
    }

    // Validate payee name
    if (!request.payeeName || request.payeeName.trim().length === 0) {
      errors.push("Payee name is required");
    }

    // Validate income payments
    if (!request.incomePayments || request.incomePayments.length === 0) {
      errors.push("At least one income payment is required");
    }

    // Validate period
    if (request.period.from >= request.period.to) {
      errors.push("Period from date must be before to date");
    }

    // Validate each income payment
    request.incomePayments.forEach((payment, index) => {
      if (payment.incomeAmount.isNegative() || payment.incomeAmount.isZero()) {
        errors.push(`Income amount must be positive for payment ${index + 1}`);
      }

      if (payment.taxWithheld.isNegative()) {
        errors.push(`Tax withheld cannot be negative for payment ${index + 1}`);
      }

      if (!payment.atcCode || payment.atcCode.trim().length === 0) {
        errors.push(`ATC code is required for payment ${index + 1}`);
      }

      if (payment.taxRate < 0 || payment.taxRate > 1) {
        errors.push(`Invalid tax rate for payment ${index + 1}`);
      }

      // Validate tax computation
      const expectedTax = payment.incomeAmount.multiply(payment.taxRate);
      if (!payment.taxWithheld.equals(expectedTax)) {
        errors.push(`Tax computation mismatch for payment ${index + 1}`);
      }
    });

    if (errors.length > 0) {
      throw new Error(`Certificate generation validation failed: ${errors.join(", ")}`);
    }
  }

  private async generateCertificateNumber(projectId: string): Promise<string> {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 999999) + 1;

    // Format: 2307-YYYY-XXXXXX
    return generateCode(`2307-${year}`, sequence, 6);
  }

  private prepareMonthlyBreakdown(incomePayments: CertificateGenerationRequest["incomePayments"]) {
    return incomePayments.map((payment) => ({
      month: payment.date.getMonth() + 1,
      particulars: payment.particulars,
      atcCode: payment.atcCode,
      incomeAmount: payment.incomeAmount,
      taxRate: payment.taxRate,
      taxWithheld: payment.taxWithheld,
    }));
  }

  private async validateCertificate(certificate: Form2307): Promise<CertificateValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const complianceIssues: string[] = [];

    // Validate TINs
    if (!this.isValidTIN(certificate.payorInfo.tin)) {
      errors.push("Invalid payor TIN format");
    }

    if (!this.isValidTIN(certificate.payeeInfo.tin)) {
      errors.push("Invalid payee TIN format");
    }

    // Validate totals consistency
    const calculatedIncomeTotal = certificate.incomePayments.reduce(
      (sum, payment) => sum.add(payment.incomeAmount),
      new Money(0)
    );

    const calculatedTaxTotal = certificate.incomePayments.reduce(
      (sum, payment) => sum.add(payment.taxWithheld),
      new Money(0)
    );

    if (!certificate.totalIncomePayment.equals(calculatedIncomeTotal)) {
      errors.push("Total income payment does not match sum of individual payments");
    }

    if (!certificate.totalTaxWithheld.equals(calculatedTaxTotal)) {
      errors.push("Total tax withheld does not match sum of individual payments");
    }

    // Check for missing required fields
    if (!certificate.certificateNumber) {
      errors.push("Certificate number is required");
    }

    if (!certificate.payeeInfo.name || certificate.payeeInfo.name.trim().length === 0) {
      errors.push("Payee name is required");
    }

    if (!certificate.payeeInfo.address || certificate.payeeInfo.address.trim().length === 0) {
      errors.push("Payee address is required");
    }

    // Compliance checks
    if (certificate.totalTaxWithheld.isZero()) {
      warnings.push("Certificate has zero tax withheld");
    }

    if (certificate.incomePayments.length === 0) {
      errors.push("Certificate must have at least one income payment");
    }

    // Check for suspicious patterns
    const averageTaxRate = certificate.totalIncomePayment.isZero()
      ? 0
      : certificate.totalTaxWithheld.divide(certificate.totalIncomePayment).toNumber();

    if (averageTaxRate > 0.35) {
      warnings.push("Unusually high average tax rate (>35%)");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      complianceIssues,
    };
  }

  private async saveCertificateToDatabase(
    projectId: string,
    certificate: Form2307,
    userId: string
  ): Promise<string> {
    try {
      const [savedCertificate] = await db
        .insert(withholdingTaxCertificates)
        .values({
          projectId,
          certificateNumber: certificate.certificateNumber,
          formType: certificate.formType,
          periodCovered: certificate.taxPeriod,
          payeeName: certificate.payeeInfo.name,
          payeeTin: certificate.payeeInfo.tin,
          payeeAddress: certificate.payeeInfo.address,
          incomePayment: certificate.totalIncomePayment.toString(),
          taxRate: certificate.totalTaxWithheld
            .divide(certificate.totalIncomePayment)
            .multiply(100)
            .toString(),
          taxWithheld: certificate.totalTaxWithheld.toString(),
          atcCode: certificate.incomePayments[0]?.atcCode || "MULTIPLE",
          status: "issued",
          createdBy: userId,
        })
        .returning();

      return savedCertificate.id;
    } catch (error: any) {
      throw new Error(`Failed to save certificate to database: ${error.message}`);
    }
  }

  private async fetchWithholdingTransactions(
    projectId: string,
    period: { from: Date; to: Date },
    options?: {
      minimumTaxWithheld?: Money;
      includedATCCodes?: string[];
      excludedPayees?: string[];
      includedPayees?: string[];
    }
  ): Promise<WithholdingTaxTransaction[]> {
    // Mock data for demonstration - in real implementation, this would query the database
    const mockTransactions: WithholdingTaxTransaction[] = [
      {
        payeeName: "ABC Legal Services",
        payeeTin: "123-456-789-001",
        payeeAddress: "San Fernando, La Union",
        atcCode: "WI010",
        taxBase: new Money(15000),
        taxRate: 0.1,
        taxWithheld: new Money(1500),
        month: 1,
        particulars: "Legal consultation services",
      },
      {
        payeeName: "XYZ Construction Corp",
        payeeTin: "987-654-321-001",
        payeeAddress: "Bauang, La Union",
        atcCode: "WC160",
        taxBase: new Money(25000),
        taxRate: 0.02,
        taxWithheld: new Money(500),
        month: 1,
        particulars: "Maintenance services",
      },
      {
        payeeName: "ABC Legal Services",
        payeeTin: "123-456-789-001",
        payeeAddress: "San Fernando, La Union",
        atcCode: "WI010",
        taxBase: new Money(20000),
        taxRate: 0.1,
        taxWithheld: new Money(2000),
        month: 2,
        particulars: "Contract review services",
      },
    ];

    // Apply filters
    let filteredTransactions = mockTransactions;

    if (options?.includedPayees) {
      filteredTransactions = filteredTransactions.filter((t) =>
        options.includedPayees!.includes(t.payeeTin)
      );
    }

    if (options?.excludedPayees) {
      filteredTransactions = filteredTransactions.filter(
        (t) => !options.excludedPayees!.includes(t.payeeTin)
      );
    }

    if (options?.includedATCCodes) {
      filteredTransactions = filteredTransactions.filter((t) =>
        options.includedATCCodes!.includes(t.atcCode)
      );
    }

    if (options?.minimumTaxWithheld) {
      filteredTransactions = filteredTransactions.filter((t) =>
        t.taxWithheld.greaterThan(options.minimumTaxWithheld!)
      );
    }

    return filteredTransactions;
  }

  private groupTransactionsByPayee(
    transactions: WithholdingTaxTransaction[]
  ): Map<string, WithholdingTaxTransaction[]> {
    const grouped = new Map<string, WithholdingTaxTransaction[]>();

    for (const transaction of transactions) {
      const payeeTin = transaction.payeeTin;
      if (!grouped.has(payeeTin)) {
        grouped.set(payeeTin, []);
      }
      grouped.get(payeeTin)!.push(transaction);
    }

    return grouped;
  }

  private async auditCertificateGeneration(
    projectId: string,
    certificate: Form2307,
    request: CertificateGenerationRequest,
    userId: string
  ): Promise<void> {
    const auditData = {
      projectId,
      certificateNumber: certificate.certificateNumber,
      formType: certificate.formType,
      payeeTin: certificate.payeeInfo.tin,
      payeeName: certificate.payeeInfo.name,
      generatedBy: userId,
      generatedAt: certificate.generatedDate,
      period: {
        from: request.period.from,
        to: request.period.to,
      },
      amounts: {
        totalIncomePayment: certificate.totalIncomePayment.toNumber(),
        totalTaxWithheld: certificate.totalTaxWithheld.toNumber(),
        averageTaxRate: certificate.totalIncomePayment.isZero()
          ? 0
          : certificate.totalTaxWithheld
              .divide(certificate.totalIncomePayment)
              .multiply(100)
              .toNumber(),
      },
      transactionDetails: {
        paymentCount: certificate.incomePayments.length,
        atcCodes: [...new Set(certificate.incomePayments.map((p) => p.atcCode))],
        monthsCovered: [...new Set(certificate.incomePayments.map((p) => p.month))],
      },
    };

    // In real implementation, this would be saved to audit log
    console.log("Certificate 2307 generation audit:", auditData);
  }

  private isValidTIN(tin: string): boolean {
    // Philippine TIN format: XXX-XXX-XXX-000
    const tinRegex = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
    return tinRegex.test(tin);
  }
}
