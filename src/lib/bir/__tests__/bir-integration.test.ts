/**
 * BIR Integration Service Tests
 *
 * Tests for the BIR form generation, validation, and export functionality
 * covering Philippine tax compliance requirements.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BIRIntegrationService } from "../../services/bir-integration.service";
import { Money } from "../../money";

describe("BIR Integration Service", () => {
  let birService: BIRIntegrationService;

  beforeEach(() => {
    birService = new BIRIntegrationService();
  });

  describe("Service Initialization", () => {
    it("should create service instance", () => {
      expect(birService).toBeInstanceOf(BIRIntegrationService);
    });

    it("should have all required methods", () => {
      expect(typeof birService.generateMonthlyReturns).toBe("function");
      expect(typeof birService.generateVATReturn).toBe("function");
      expect(typeof birService.generateQuarterlyWithholdingReturn).toBe("function");
      expect(typeof birService.generateMonthlyWithholdingReturn).toBe("function");
      expect(typeof birService.generateWithholdingCertificate).toBe("function");
      expect(typeof birService.generateAlphalist).toBe("function");
      expect(typeof birService.exportToXML).toBe("function");
      expect(typeof birService.exportToPDF).toBe("function");
      expect(typeof birService.exportToDAT).toBe("function");
    });
  });

  describe("VAT Return Generation (Form 2550M)", () => {
    it("should generate VAT return with correct structure", async () => {
      const projectId = "test-project";
      const taxPeriod = { year: 2024, month: 1 };
      const userId = "test-user";

      const vatReturn = await birService.generateVATReturn(projectId, taxPeriod, userId);

      expect(vatReturn).toBeDefined();
      expect(vatReturn.formType).toBe("2550M");
      expect(vatReturn.taxPeriod).toBe("01/2024");
      expect(vatReturn.taxpayerInfo).toBeDefined();
      expect(vatReturn.salesBreakdown).toBeDefined();
      expect(vatReturn.inputTax).toBeDefined();
      expect(vatReturn.totalAmountPayable).toBeInstanceOf(Money);
    });

    it("should calculate VAT amounts correctly", async () => {
      const projectId = "test-project";
      const taxPeriod = { year: 2024, month: 1 };
      const userId = "test-user";

      const vatReturn = await birService.generateVATReturn(projectId, taxPeriod, userId);

      // Verify VAT calculation (12% of vatable sales)
      const expectedOutputVAT = vatReturn.salesBreakdown.vatableSales.multiply(0.12);
      expect(vatReturn.salesBreakdown.outputVAT.toNumber()).toBe(expectedOutputVAT.toNumber());

      // Verify net VAT computation
      const expectedNetVAT = vatReturn.totalOutputVAT.subtract(vatReturn.totalInputVAT);
      if (expectedNetVAT.isPositive()) {
        expect(vatReturn.vatPayable.toNumber()).toBe(expectedNetVAT.toNumber());
        expect(vatReturn.vatRefundable.toNumber()).toBe(0);
      } else {
        expect(vatReturn.vatRefundable.toNumber()).toBe(expectedNetVAT.abs().toNumber());
        expect(vatReturn.vatPayable.toNumber()).toBe(0);
      }
    });
  });

  describe("Monthly Withholding Return Generation (Form 1601C)", () => {
    it("should generate monthly withholding return", async () => {
      const projectId = "test-project";
      const taxPeriod = { year: 2024, month: 1 };
      const userId = "test-user";

      const withholdingReturn = await birService.generateMonthlyWithholdingReturn(
        projectId,
        taxPeriod,
        userId
      );

      expect(withholdingReturn).toBeDefined();
      expect(withholdingReturn.formType).toBe("1601C");
      expect(withholdingReturn.month).toBe(1);
      expect(withholdingReturn.withholdingByATC).toBeDefined();
      expect(withholdingReturn.totalTaxWithheld).toBeInstanceOf(Money);
    });

    it("should have consistent ATC totals", async () => {
      const projectId = "test-project";
      const taxPeriod = { year: 2024, month: 1 };
      const userId = "test-user";

      const withholdingReturn = await birService.generateMonthlyWithholdingReturn(
        projectId,
        taxPeriod,
        userId
      );

      // Sum ATC breakdown should equal total
      const atcTotal = Object.values(withholdingReturn.withholdingByATC).reduce(
        (sum, atc) => sum.add(atc.taxWithheld),
        new Money(0)
      );

      expect(withholdingReturn.totalTaxWithheld.toNumber()).toBe(atcTotal.toNumber());
    });
  });

  describe("Quarterly Withholding Return Generation (Form 1601EQ)", () => {
    it("should generate quarterly withholding return with alphalist", async () => {
      const projectId = "test-project";
      const taxPeriod = { year: 2024, quarter: 1 };
      const userId = "test-user";

      const quarterlyReturn = await birService.generateQuarterlyWithholdingReturn(
        projectId,
        taxPeriod,
        userId
      );

      expect(quarterlyReturn).toBeDefined();
      expect(quarterlyReturn.formType).toBe("1601EQ");
      expect(quarterlyReturn.quarter).toBe(1);
      expect(quarterlyReturn.alphalist).toBeDefined();
      expect(Array.isArray(quarterlyReturn.alphalist)).toBe(true);
    });
  });

  describe("Certificate Generation (Form 2307)", () => {
    it("should generate withholding certificate", async () => {
      const projectId = "test-project";
      const data = {
        payeeName: "Test Payee",
        payeeTin: "123-456-789-001",
        payeeAddress: "Test Address",
        incomePayments: [
          {
            date: new Date("2024-01-15"),
            particulars: "Professional services",
            atcCode: "WI010",
            incomeAmount: new Money(10000),
            taxRate: 0.1,
            taxWithheld: new Money(1000),
          },
        ],
        period: {
          from: new Date("2024-01-01"),
          to: new Date("2024-01-31"),
        },
      };
      const userId = "test-user";

      const certificate = await birService.generateWithholdingCertificate(projectId, data, userId);

      expect(certificate).toBeDefined();
      expect(certificate.formType).toBe("2307");
      expect(certificate.payeeInfo.name).toBe("Test Payee");
      expect(certificate.totalIncomePayment.toNumber()).toBe(10000);
      expect(certificate.totalTaxWithheld.toNumber()).toBe(1000);
      expect(certificate.certificateNumber).toMatch(/^2307-\d{4}-\d{6}$/);
    });

    it("should calculate certificate totals correctly", async () => {
      const projectId = "test-project";
      const data = {
        payeeName: "Test Payee",
        payeeTin: "123-456-789-001",
        payeeAddress: "Test Address",
        incomePayments: [
          {
            date: new Date("2024-01-15"),
            particulars: "Professional services",
            atcCode: "WI010",
            incomeAmount: new Money(5000),
            taxRate: 0.1,
            taxWithheld: new Money(500),
          },
          {
            date: new Date("2024-02-15"),
            particulars: "Consultation",
            atcCode: "WI010",
            incomeAmount: new Money(7500),
            taxRate: 0.1,
            taxWithheld: new Money(750),
          },
        ],
        period: {
          from: new Date("2024-01-01"),
          to: new Date("2024-02-29"),
        },
      };
      const userId = "test-user";

      const certificate = await birService.generateWithholdingCertificate(projectId, data, userId);

      expect(certificate.totalIncomePayment.toNumber()).toBe(12500);
      expect(certificate.totalTaxWithheld.toNumber()).toBe(1250);
      expect(certificate.incomePayments).toHaveLength(2);
    });
  });

  describe("Alphalist Generation", () => {
    it("should generate alphalist from transactions", async () => {
      const transactions = [
        {
          payeeName: "ABC Corp",
          payeeTin: "123-456-789-001",
          payeeAddress: "Manila",
          atcCode: "WI010",
          taxBase: new Money(10000),
          taxRate: 0.1,
          taxWithheld: new Money(1000),
          month: 1,
          particulars: "Professional services",
        },
        {
          payeeName: "XYZ Inc",
          payeeTin: "987-654-321-001",
          payeeAddress: "Quezon City",
          atcCode: "WC160",
          taxBase: new Money(20000),
          taxRate: 0.02,
          taxWithheld: new Money(400),
          month: 1,
          particulars: "Contractor services",
        },
      ];

      const alphalist = await birService.generateAlphalist(transactions);

      expect(alphalist).toBeDefined();
      expect(alphalist.entries).toHaveLength(2);
      expect(alphalist.summary.totalPayees).toBe(2);
      expect(alphalist.summary.totalIncomePayments.toNumber()).toBe(30000);
      expect(alphalist.summary.totalTaxWithheld.toNumber()).toBe(1400);
      expect(alphalist.validationResults.isValid).toBe(true);
    });

    it("should consolidate multiple transactions per payee", async () => {
      const transactions = [
        {
          payeeName: "ABC Corp",
          payeeTin: "123-456-789-001",
          payeeAddress: "Manila",
          atcCode: "WI010",
          taxBase: new Money(5000),
          taxRate: 0.1,
          taxWithheld: new Money(500),
          month: 1,
          particulars: "Professional services",
        },
        {
          payeeName: "ABC Corp",
          payeeTin: "123-456-789-001",
          payeeAddress: "Manila",
          atcCode: "WI010",
          taxBase: new Money(7000),
          taxRate: 0.1,
          taxWithheld: new Money(700),
          month: 2,
          particulars: "Professional services",
        },
      ];

      const alphalist = await birService.generateAlphalist(transactions);

      expect(alphalist.entries).toHaveLength(1);
      expect(alphalist.entries[0].payeeName).toBe("ABC Corp");
      expect(alphalist.entries[0].taxBase.toNumber()).toBe(12000);
      expect(alphalist.entries[0].taxWithheld.toNumber()).toBe(1200);
      expect(alphalist.summary.totalPayees).toBe(1);
    });
  });

  describe("Export Services", () => {
    it("should export form to XML format", async () => {
      const form = await birService.generateVATReturn(
        "test-project",
        { year: 2024, month: 1 },
        "test-user"
      );

      const result = await birService.exportToXML(form);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/2550M_01-2024\.xml$/);
      expect(result.mimeType).toBe("application/xml");
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.checksum).toBeDefined();
    });

    it("should export form to PDF format", async () => {
      const form = await birService.generateVATReturn(
        "test-project",
        { year: 2024, month: 1 },
        "test-user"
      );

      const result = await birService.exportToPDF(form);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/2550M_01-2024\.pdf$/);
      expect(result.mimeType).toBe("application/pdf");
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it("should export form to DAT format", async () => {
      const form = await birService.generateVATReturn(
        "test-project",
        { year: 2024, month: 1 },
        "test-user"
      );

      const result = await birService.exportToDAT(form);

      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/2550M_01-2024\.dat$/);
      expect(result.mimeType).toBe("text/plain");
      expect(result.data).toBeInstanceOf(Buffer);
    });
  });

  describe("Form Validation", () => {
    it("should validate form and return validation results", async () => {
      const form = await birService.generateVATReturn(
        "test-project",
        { year: 2024, month: 1 },
        "test-user"
      );

      const validation = await birService.validateForm(form);

      expect(validation).toBeDefined();
      expect(typeof validation.isValid).toBe("boolean");
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
      expect(Array.isArray(validation.missingFields)).toBe(true);
    });
  });
});
