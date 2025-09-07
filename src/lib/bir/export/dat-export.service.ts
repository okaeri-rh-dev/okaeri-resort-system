/**
 * DAT Export Service for BIR Forms
 *
 * Generates DAT (Data Text) files for direct electronic filing with the
 * Philippine Bureau of Internal Revenue eBIRForms system.
 *
 * Key Features:
 * - Fixed-width formatted text files per BIR specifications
 * - Electronic filing compatibility with eBIRForms
 * - Proper field padding and alignment
 * - Data validation and format compliance
 * - Batch file generation for multiple forms
 */

import {
  BIRForm,
  Form2550M,
  Form1601EQ,
  Form1601C,
  Form2307,
  BIRExportConfig,
  BIRExportResult,
} from "@/lib/bir/types";
import { Money } from "@/lib/money";
import * as crypto from "crypto";

/**
 * DAT export configuration specific to BIR requirements
 */
interface DATExportConfig extends BIRExportConfig {
  includeHeader?: boolean;
  includeFooter?: boolean;
  recordSeparator?: string;
  fieldSeparator?: string;
  paddingCharacter?: string;
  encoding?: "ascii" | "utf8";
}

/**
 * DAT field specification
 */
interface DATFieldSpec {
  name: string;
  position: number;
  length: number;
  type: "text" | "numeric" | "date" | "amount";
  alignment: "left" | "right";
  paddingChar: string;
  required: boolean;
  format?: string; // Date format, decimal places, etc.
}

/**
 * DAT record layout for each form type
 */
interface DATRecordLayout {
  recordType: string;
  totalLength: number;
  fields: DATFieldSpec[];
}

export class DATExportService {
  private readonly DAT_LAYOUTS: { [formType: string]: DATRecordLayout[] } = {
    "2550M": [
      {
        recordType: "H", // Header record
        totalLength: 200,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "formType",
            position: 2,
            length: 6,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "taxPeriod",
            position: 8,
            length: 7,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "tin",
            position: 15,
            length: 15,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "rdo",
            position: 30,
            length: 3,
            type: "text",
            alignment: "right",
            paddingChar: "0",
            required: true,
          },
          {
            name: "filler",
            position: 33,
            length: 168,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
      {
        recordType: "D", // Detail record
        totalLength: 500,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "businessName",
            position: 2,
            length: 100,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "address",
            position: 102,
            length: 150,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "vatableSales",
            position: 252,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "vatZeroRated",
            position: 267,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "vatExempt",
            position: 282,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "outputVAT",
            position: 297,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "domesticPurchases",
            position: 312,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "importations",
            position: 327,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "totalInputVAT",
            position: 342,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "vatPayable",
            position: 357,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "vatRefundable",
            position: 372,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "totalAmountPayable",
            position: 387,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "filler",
            position: 402,
            length: 99,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
    ],

    "1601EQ": [
      {
        recordType: "H",
        totalLength: 200,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "formType",
            position: 2,
            length: 6,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "taxPeriod",
            position: 8,
            length: 7,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "tin",
            position: 15,
            length: 15,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "quarter",
            position: 30,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "filler",
            position: 31,
            length: 170,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
      {
        recordType: "D",
        totalLength: 300,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "businessName",
            position: 2,
            length: 100,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "totalIncomePayments",
            position: 102,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "totalTaxWithheld",
            position: 117,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "surcharge",
            position: 132,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "interest",
            position: 147,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "totalAmountPayable",
            position: 162,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "filler",
            position: 177,
            length: 124,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
      {
        recordType: "A", // Alphalist record
        totalLength: 250,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "sequenceNumber",
            position: 2,
            length: 5,
            type: "numeric",
            alignment: "right",
            paddingChar: "0",
            required: true,
          },
          {
            name: "payeeTin",
            position: 7,
            length: 15,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "payeeName",
            position: 22,
            length: 100,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "atcCode",
            position: 122,
            length: 5,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "taxBase",
            position: 127,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "taxWithheld",
            position: 142,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "month1",
            position: 157,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "month2",
            position: 172,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "month3",
            position: 187,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "filler",
            position: 202,
            length: 49,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
    ],

    "1601C": [
      {
        recordType: "H",
        totalLength: 200,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "formType",
            position: 2,
            length: 6,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "taxPeriod",
            position: 8,
            length: 7,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "tin",
            position: 15,
            length: 15,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "month",
            position: 30,
            length: 2,
            type: "text",
            alignment: "right",
            paddingChar: "0",
            required: true,
          },
          {
            name: "filler",
            position: 32,
            length: 169,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
      {
        recordType: "D",
        totalLength: 400,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "businessName",
            position: 2,
            length: 100,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "totalIncomePayments",
            position: 102,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "totalTaxWithheld",
            position: 117,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "totalAmountPayable",
            position: 132,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "filler",
            position: 147,
            length: 254,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
      {
        recordType: "T", // ATC breakdown record
        totalLength: 100,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "atcCode",
            position: 2,
            length: 5,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "incomePayments",
            position: 7,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "taxWithheld",
            position: 22,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "taxRate",
            position: 37,
            length: 6,
            type: "numeric",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "4",
          },
          {
            name: "filler",
            position: 43,
            length: 58,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
    ],

    "2307": [
      {
        recordType: "H",
        totalLength: 200,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "formType",
            position: 2,
            length: 4,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "certificateNumber",
            position: 6,
            length: 20,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "payorTin",
            position: 26,
            length: 15,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "payeeTin",
            position: 41,
            length: 15,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "filler",
            position: 56,
            length: 145,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
      {
        recordType: "D",
        totalLength: 400,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "payorName",
            position: 2,
            length: 100,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "payorAddress",
            position: 102,
            length: 150,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "payeeName",
            position: 252,
            length: 100,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "payeeAddress",
            position: 352,
            length: 150,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
          {
            name: "filler",
            position: 502,
            length: -102,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
      {
        recordType: "P", // Payment record
        totalLength: 150,
        fields: [
          {
            name: "recordType",
            position: 1,
            length: 1,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "month",
            position: 2,
            length: 2,
            type: "text",
            alignment: "right",
            paddingChar: "0",
            required: true,
          },
          {
            name: "atcCode",
            position: 4,
            length: 5,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: true,
          },
          {
            name: "incomeAmount",
            position: 9,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "taxWithheld",
            position: 24,
            length: 15,
            type: "amount",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "2",
          },
          {
            name: "taxRate",
            position: 39,
            length: 6,
            type: "numeric",
            alignment: "right",
            paddingChar: "0",
            required: true,
            format: "4",
          },
          {
            name: "particulars",
            position: 45,
            length: 100,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
          {
            name: "filler",
            position: 145,
            length: 6,
            type: "text",
            alignment: "left",
            paddingChar: " ",
            required: false,
          },
        ],
      },
    ],
  };

  /**
   * Export BIR form to DAT format
   */
  async export(form: BIRForm, config?: DATExportConfig): Promise<BIRExportResult> {
    try {
      const exportConfig = this.mergeDefaultConfig(config);
      const layouts = this.DAT_LAYOUTS[form.formType];

      if (!layouts) {
        throw new Error(`DAT layout not found for form type: ${form.formType}`);
      }

      // Generate DAT content
      const datContent = await this.generateDATContent(form, layouts, exportConfig);

      // Convert to buffer
      const outputData = Buffer.from(datContent, exportConfig.encoding || "ascii");
      const fileName = `${form.formType}_${this.getFormPeriod(form)}.dat`;
      const checksum = crypto.createHash("sha256").update(outputData).digest("hex");

      return {
        success: true,
        fileName,
        fileSize: outputData.length,
        mimeType: "text/plain",
        data: outputData,
        checksum,
        exportedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        fileName: `${form.formType}_${this.getFormPeriod(form)}_error.dat`,
        fileSize: 0,
        mimeType: "text/plain",
        data: Buffer.from(`DAT Generation Error: ${error.message}`, "utf-8"),
        exportedAt: new Date(),
      };
    }
  }

  /**
   * Generate DAT content for the form
   */
  private async generateDATContent(
    form: BIRForm,
    layouts: DATRecordLayout[],
    config: DATExportConfig
  ): Promise<string> {
    let content = "";
    const recordSeparator = config.recordSeparator || "\r\n";

    // Generate records based on form type
    switch (form.formType) {
      case "2550M":
        content = this.generateVATReturnDAT(form as Form2550M, layouts, config);
        break;
      case "1601EQ":
        content = this.generateQuarterlyWithholdingDAT(form as Form1601EQ, layouts, config);
        break;
      case "1601C":
        content = this.generateMonthlyWithholdingDAT(form as Form1601C, layouts, config);
        break;
      case "2307":
        content = this.generateCertificateDAT(form as Form2307, layouts, config);
        break;
    }

    return content;
  }

  /**
   * Generate DAT content for VAT Return (Form 2550M)
   */
  private generateVATReturnDAT(
    form: Form2550M,
    layouts: DATRecordLayout[],
    config: DATExportConfig
  ): string {
    let content = "";
    const recordSeparator = config.recordSeparator || "\r\n";

    // Header record (H)
    const headerLayout = layouts.find((l) => l.recordType === "H")!;
    const headerData = {
      recordType: "H",
      formType: "2550M",
      taxPeriod: form.taxPeriod,
      tin: form.taxpayerInfo.tin.replace(/-/g, ""),
      rdo: form.taxpayerInfo.rdo,
    };
    content += this.formatDATRecord(headerData, headerLayout) + recordSeparator;

    // Detail record (D)
    const detailLayout = layouts.find((l) => l.recordType === "D")!;
    const detailData = {
      recordType: "D",
      businessName: form.taxpayerInfo.businessName,
      address: form.taxpayerInfo.address,
      vatableSales: form.salesBreakdown.vatableSales,
      vatZeroRated: form.salesBreakdown.vatZeroRated,
      vatExempt: form.salesBreakdown.vatExempt,
      outputVAT: form.salesBreakdown.outputVAT,
      domesticPurchases: form.inputTax.domesticPurchases,
      importations: form.inputTax.importations,
      totalInputVAT: form.inputTax.totalInputVAT,
      vatPayable: form.vatPayable,
      vatRefundable: form.vatRefundable,
      totalAmountPayable: form.totalAmountPayable,
    };
    content += this.formatDATRecord(detailData, detailLayout) + recordSeparator;

    return content;
  }

  /**
   * Generate DAT content for Quarterly Withholding Return (Form 1601EQ)
   */
  private generateQuarterlyWithholdingDAT(
    form: Form1601EQ,
    layouts: DATRecordLayout[],
    config: DATExportConfig
  ): string {
    let content = "";
    const recordSeparator = config.recordSeparator || "\r\n";

    // Header record (H)
    const headerLayout = layouts.find((l) => l.recordType === "H")!;
    const headerData = {
      recordType: "H",
      formType: "1601EQ",
      taxPeriod: form.taxPeriod,
      tin: form.taxpayerInfo.tin.replace(/-/g, ""),
      quarter: form.quarter.toString(),
    };
    content += this.formatDATRecord(headerData, headerLayout) + recordSeparator;

    // Detail record (D)
    const detailLayout = layouts.find((l) => l.recordType === "D")!;
    const detailData = {
      recordType: "D",
      businessName: form.taxpayerInfo.businessName,
      totalIncomePayments: form.totalIncomePayments,
      totalTaxWithheld: form.totalTaxWithheld,
      surcharge: form.surcharge,
      interest: form.interest,
      totalAmountPayable: form.totalAmountPayable,
    };
    content += this.formatDATRecord(detailData, detailLayout) + recordSeparator;

    // Alphalist records (A)
    const alphalistLayout = layouts.find((l) => l.recordType === "A")!;
    if (form.alphalist && form.alphalist.length > 0) {
      for (const entry of form.alphalist) {
        const alphalistData = {
          recordType: "A",
          sequenceNumber: entry.sequenceNumber,
          payeeTin: entry.payeeTin.replace(/-/g, ""),
          payeeName: entry.payeeName,
          atcCode: entry.atcCode,
          taxBase: entry.taxBase,
          taxWithheld: entry.taxWithheld,
          month1: entry.month1,
          month2: entry.month2,
          month3: entry.month3,
        };
        content += this.formatDATRecord(alphalistData, alphalistLayout) + recordSeparator;
      }
    }

    return content;
  }

  /**
   * Generate DAT content for Monthly Withholding Return (Form 1601C)
   */
  private generateMonthlyWithholdingDAT(
    form: Form1601C,
    layouts: DATRecordLayout[],
    config: DATExportConfig
  ): string {
    let content = "";
    const recordSeparator = config.recordSeparator || "\r\n";

    // Header record (H)
    const headerLayout = layouts.find((l) => l.recordType === "H")!;
    const headerData = {
      recordType: "H",
      formType: "1601C",
      taxPeriod: form.taxPeriod,
      tin: form.taxpayerInfo.tin.replace(/-/g, ""),
      month: form.month.toString().padStart(2, "0"),
    };
    content += this.formatDATRecord(headerData, headerLayout) + recordSeparator;

    // Detail record (D)
    const detailLayout = layouts.find((l) => l.recordType === "D")!;
    const detailData = {
      recordType: "D",
      businessName: form.taxpayerInfo.businessName,
      totalIncomePayments: form.totalIncomePayments,
      totalTaxWithheld: form.totalTaxWithheld,
      totalAmountPayable: form.totalAmountPayable,
    };
    content += this.formatDATRecord(detailData, detailLayout) + recordSeparator;

    // ATC breakdown records (T)
    const atcLayout = layouts.find((l) => l.recordType === "T")!;
    for (const [atcCode, atcData] of Object.entries(form.withholdingByATC)) {
      const atcRecordData = {
        recordType: "T",
        atcCode: atcCode,
        incomePayments: atcData.incomePayments,
        taxWithheld: atcData.taxWithheld,
        taxRate: atcData.taxRate,
      };
      content += this.formatDATRecord(atcRecordData, atcLayout) + recordSeparator;
    }

    return content;
  }

  /**
   * Generate DAT content for Certificate (Form 2307)
   */
  private generateCertificateDAT(
    form: Form2307,
    layouts: DATRecordLayout[],
    config: DATExportConfig
  ): string {
    let content = "";
    const recordSeparator = config.recordSeparator || "\r\n";

    // Header record (H)
    const headerLayout = layouts.find((l) => l.recordType === "H")!;
    const headerData = {
      recordType: "H",
      formType: "2307",
      certificateNumber: form.certificateNumber,
      payorTin: form.payorInfo.tin.replace(/-/g, ""),
      payeeTin: form.payeeInfo.tin.replace(/-/g, ""),
    };
    content += this.formatDATRecord(headerData, headerLayout) + recordSeparator;

    // Detail record (D)
    const detailLayout = layouts.find((l) => l.recordType === "D")!;
    const detailData = {
      recordType: "D",
      payorName: form.payorInfo.businessName,
      payorAddress: form.payorInfo.address,
      payeeName: form.payeeInfo.name,
      payeeAddress: form.payeeInfo.address,
    };
    content += this.formatDATRecord(detailData, detailLayout) + recordSeparator;

    // Payment records (P)
    const paymentLayout = layouts.find((l) => l.recordType === "P")!;
    for (const payment of form.incomePayments) {
      const paymentData = {
        recordType: "P",
        month: payment.month.toString().padStart(2, "0"),
        atcCode: payment.atcCode,
        incomeAmount: payment.incomeAmount,
        taxWithheld: payment.taxWithheld,
        taxRate: payment.taxRate,
        particulars: payment.particulars,
      };
      content += this.formatDATRecord(paymentData, paymentLayout) + recordSeparator;
    }

    return content;
  }

  /**
   * Format a single DAT record according to field specifications
   */
  private formatDATRecord(data: any, layout: DATRecordLayout): string {
    let record = "";

    for (const field of layout.fields) {
      let value = data[field.name] || "";

      // Format value based on field type
      switch (field.type) {
        case "amount":
          if (value instanceof Money) {
            const decimalPlaces = parseInt(field.format || "2");
            const multiplier = Math.pow(10, decimalPlaces);
            value = Math.round(value.toNumber() * multiplier).toString();
          } else if (typeof value === "number") {
            const decimalPlaces = parseInt(field.format || "2");
            const multiplier = Math.pow(10, decimalPlaces);
            value = Math.round(value * multiplier).toString();
          } else {
            value = "0";
          }
          break;

        case "numeric":
          if (typeof value === "number") {
            const decimalPlaces = parseInt(field.format || "0");
            const multiplier = Math.pow(10, decimalPlaces);
            value = Math.round(value * multiplier).toString();
          } else {
            value = "0";
          }
          break;

        case "date":
          if (value instanceof Date) {
            value = value.toISOString().substring(0, 10).replace(/-/g, "");
          } else {
            value = "";
          }
          break;

        case "text":
        default:
          value = value.toString();
          break;
      }

      // Apply field formatting
      value = this.applyFieldFormatting(value, field);
      record += value;
    }

    // Ensure record is exactly the specified length
    if (record.length < layout.totalLength) {
      record = record.padEnd(layout.totalLength, " ");
    } else if (record.length > layout.totalLength) {
      record = record.substring(0, layout.totalLength);
    }

    return record;
  }

  /**
   * Apply field-specific formatting (padding, alignment, etc.)
   */
  private applyFieldFormatting(value: string, field: DATFieldSpec): string {
    // Truncate if too long
    if (value.length > field.length) {
      value = value.substring(0, field.length);
    }

    // Apply padding and alignment
    if (field.alignment === "right") {
      return value.padStart(field.length, field.paddingChar);
    } else {
      return value.padEnd(field.length, field.paddingChar);
    }
  }

  // Private helper methods

  private mergeDefaultConfig(config?: DATExportConfig): DATExportConfig {
    return {
      format: "dat",
      includeHeader: true,
      includeFooter: false,
      recordSeparator: "\r\n",
      fieldSeparator: "",
      paddingCharacter: " ",
      encoding: "ascii",
      validateBeforeExport: true,
      ...config,
    };
  }

  private getFormPeriod(form: BIRForm): string {
    return form.taxPeriod.replace("/", "-");
  }
}
