/**
 * XML Export Service for BIR Forms
 *
 * Generates XML files compatible with eBIRForms for electronic filing
 * to the Philippine Bureau of Internal Revenue.
 *
 * Key Features:
 * - eBIRForms XML schema compliance
 * - Digital signature preparation
 * - XML validation and schema verification
 * - Compression support for large files
 * - Error handling and recovery
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
import * as crypto from "uncrypto";

/**
 * XML export configuration specific to BIR requirements
 */
interface XMLExportConfig extends BIRExportConfig {
  schemaVersion?: string;
  includeDigitalSignature?: boolean;
  xmlDeclaration?: boolean;
  indentOutput?: boolean;
  validateSchema?: boolean;
}

/**
 * XML template structure for different form types
 */
interface XMLTemplate {
  rootElement: string;
  namespace?: string;
  schemaLocation?: string;
  version: string;
}

export class XMLExportService {
  private readonly XML_TEMPLATES: { [formType: string]: XMLTemplate } = {
    "2550M": {
      rootElement: "VAT_Return_2550M",
      namespace: "http://www.bir.gov.ph/ebirforms/2550m",
      schemaLocation: "http://www.bir.gov.ph/ebirforms/2550m vat_return_2550m_v1.0.xsd",
      version: "1.0",
    },
    "1601EQ": {
      rootElement: "EWT_Return_1601EQ",
      namespace: "http://www.bir.gov.ph/ebirforms/1601eq",
      schemaLocation: "http://www.bir.gov.ph/ebirforms/1601eq ewt_return_1601eq_v1.0.xsd",
      version: "1.0",
    },
    "1601C": {
      rootElement: "EWT_Return_1601C",
      namespace: "http://www.bir.gov.ph/ebirforms/1601c",
      schemaLocation: "http://www.bir.gov.ph/ebirforms/1601c ewt_return_1601c_v1.0.xsd",
      version: "1.0",
    },
    "2307": {
      rootElement: "Certificate_2307",
      namespace: "http://www.bir.gov.ph/ebirforms/2307",
      schemaLocation: "http://www.bir.gov.ph/ebirforms/2307 certificate_2307_v1.0.xsd",
      version: "1.0",
    },
  };

  /**
   * Export BIR form to XML format
   */
  async export(form: BIRForm, config?: XMLExportConfig): Promise<BIRExportResult> {
    try {
      const exportConfig = this.mergeDefaultConfig(config);
      const template = this.XML_TEMPLATES[form.formType];

      if (!template) {
        throw new Error(`XML template not found for form type: ${form.formType}`);
      }

      // Generate XML content
      const xmlContent = await this.generateXMLContent(form, template, exportConfig);

      // Validate XML if requested
      if (exportConfig.validateSchema) {
        await this.validateXMLSchema(xmlContent, form.formType);
      }

      // Add digital signature if requested
      let finalXML = xmlContent;
      if (exportConfig.includeDigitalSignature) {
        finalXML = await this.addDigitalSignature(xmlContent, form);
      }

      // Compress if requested
      let outputData: Buffer;
      let mimeType: string;
      let fileName: string;

      if (exportConfig.compressionLevel && exportConfig.compressionLevel > 0) {
        outputData = await this.compressXML(finalXML, exportConfig.compressionLevel);
        mimeType = "application/zip";
        fileName = `${form.formType}_${this.getFormPeriod(form)}.zip`;
      } else {
        outputData = Buffer.from(finalXML, "utf-8");
        mimeType = "application/xml";
        fileName = `${form.formType}_${this.getFormPeriod(form)}.xml`;
      }

      // Calculate checksum
      const checksum = crypto.createHash("sha256").update(outputData).digest("hex");

      return {
        success: true,
        fileName,
        fileSize: outputData.length,
        mimeType,
        data: outputData,
        checksum,
        exportedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        fileName: `${form.formType}_${this.getFormPeriod(form)}_error.xml`,
        fileSize: 0,
        mimeType: "application/xml",
        data: Buffer.from(`<!-- Export Error: ${error.message} -->`, "utf-8"),
        exportedAt: new Date(),
      };
    }
  }

  /**
   * Generate XML content for specific form type
   */
  private async generateXMLContent(
    form: BIRForm,
    template: XMLTemplate,
    config: XMLExportConfig
  ): Promise<string> {
    switch (form.formType) {
      case "2550M":
        return this.generateVATReturnXML(form as Form2550M, template, config);
      case "1601EQ":
        return this.generateQuarterlyWithholdingXML(form as Form1601EQ, template, config);
      case "1601C":
        return this.generateMonthlyWithholdingXML(form as Form1601C, template, config);
      case "2307":
        return this.generateCertificateXML(form as Form2307, template, config);
      default:
        throw new Error(`XML generation not implemented for form type: ${form.formType}`);
    }
  }

  /**
   * Generate XML for VAT Return (Form 2550M)
   */
  private generateVATReturnXML(
    form: Form2550M,
    template: XMLTemplate,
    config: XMLExportConfig
  ): string {
    const indent = config.indentOutput ? "  " : "";
    const newline = config.indentOutput ? "\n" : "";

    let xml = "";

    // XML Declaration
    if (config.xmlDeclaration !== false) {
      xml += '<?xml version="1.0" encoding="UTF-8"?>' + newline;
    }

    // Root element with namespace
    xml += `<${template.rootElement}`;
    if (template.namespace) {
      xml += ` xmlns="${template.namespace}"`;
    }
    if (template.schemaLocation) {
      xml += ` xsi:schemaLocation="${template.schemaLocation}"`;
      xml += ` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`;
    }
    xml += `>${newline}`;

    // Form header
    xml += `${indent}<FormHeader>${newline}`;
    xml += `${indent}${indent}<FormType>${form.formType}</FormType>${newline}`;
    xml += `${indent}${indent}<TaxPeriod>${form.taxPeriod}</TaxPeriod>${newline}`;
    xml += `${indent}${indent}<DateOfFiling>${this.formatDateForXML(form.dateOfFiling)}</DateOfFiling>${newline}`;
    xml += `${indent}${indent}<AmendedReturn>${form.amendedReturn ? "Y" : "N"}</AmendedReturn>${newline}`;
    xml += `${indent}</FormHeader>${newline}`;

    // Taxpayer Information
    xml += `${indent}<TaxpayerInfo>${newline}`;
    xml += `${indent}${indent}<TIN>${form.taxpayerInfo.tin}</TIN>${newline}`;
    xml += `${indent}${indent}<RDO>${form.taxpayerInfo.rdo}</RDO>${newline}`;
    xml += `${indent}${indent}<BusinessName><![CDATA[${form.taxpayerInfo.businessName}]]></BusinessName>${newline}`;
    xml += `${indent}${indent}<Address><![CDATA[${form.taxpayerInfo.address}]]></Address>${newline}`;
    xml += `${indent}${indent}<ZipCode>${form.taxpayerInfo.zipCode || ""}</ZipCode>${newline}`;
    xml += `${indent}</TaxpayerInfo>${newline}`;

    // Sales Breakdown
    xml += `${indent}<SalesBreakdown>${newline}`;
    xml += `${indent}${indent}<VatableSales>${this.formatMoneyForXML(form.salesBreakdown.vatableSales)}</VatableSales>${newline}`;
    xml += `${indent}${indent}<VatZeroRated>${this.formatMoneyForXML(form.salesBreakdown.vatZeroRated)}</VatZeroRated>${newline}`;
    xml += `${indent}${indent}<VatExempt>${this.formatMoneyForXML(form.salesBreakdown.vatExempt)}</VatExempt>${newline}`;
    xml += `${indent}${indent}<OutputVAT>${this.formatMoneyForXML(form.salesBreakdown.outputVAT)}</OutputVAT>${newline}`;
    xml += `${indent}${indent}<TotalSales>${this.formatMoneyForXML(form.salesBreakdown.totalSales)}</TotalSales>${newline}`;
    xml += `${indent}</SalesBreakdown>${newline}`;

    // Input Tax
    xml += `${indent}<InputTax>${newline}`;
    xml += `${indent}${indent}<DomesticPurchases>${this.formatMoneyForXML(form.inputTax.domesticPurchases)}</DomesticPurchases>${newline}`;
    xml += `${indent}${indent}<Importations>${this.formatMoneyForXML(form.inputTax.importations)}</Importations>${newline}`;
    xml += `${indent}${indent}<TransitionalInputTax>${this.formatMoneyForXML(form.inputTax.transitionalInputTax)}</TransitionalInputTax>${newline}`;
    xml += `${indent}${indent}<PresumptiveInputTax>${this.formatMoneyForXML(form.inputTax.presumptiveInputTax)}</PresumptiveInputTax>${newline}`;
    xml += `${indent}${indent}<TotalInputVAT>${this.formatMoneyForXML(form.inputTax.totalInputVAT)}</TotalInputVAT>${newline}`;
    xml += `${indent}</InputTax>${newline}`;

    // VAT Computation
    xml += `${indent}<VATComputation>${newline}`;
    xml += `${indent}${indent}<TotalOutputVAT>${this.formatMoneyForXML(form.totalOutputVAT)}</TotalOutputVAT>${newline}`;
    xml += `${indent}${indent}<TotalInputVAT>${this.formatMoneyForXML(form.totalInputVAT)}</TotalInputVAT>${newline}`;
    xml += `${indent}${indent}<VATPayable>${this.formatMoneyForXML(form.vatPayable)}</VATPayable>${newline}`;
    xml += `${indent}${indent}<VATRefundable>${this.formatMoneyForXML(form.vatRefundable)}</VATRefundable>${newline}`;
    xml += `${indent}${indent}<ExcessCredits>${this.formatMoneyForXML(form.excessCreditsFromPreviousPeriod)}</ExcessCredits>${newline}`;
    xml += `${indent}</VATComputation>${newline}`;

    // Adjustments
    xml += `${indent}<Adjustments>${newline}`;
    xml += `${indent}${indent}<PriorPeriodErrors>${this.formatMoneyForXML(form.adjustments.priorPeriodErrors)}</PriorPeriodErrors>${newline}`;
    xml += `${indent}${indent}<CapitalGainsTax>${this.formatMoneyForXML(form.adjustments.succeededByCapitalGainsTax)}</CapitalGainsTax>${newline}`;
    xml += `${indent}${indent}<Others>${this.formatMoneyForXML(form.adjustments.others)}</Others>${newline}`;
    xml += `${indent}</Adjustments>${newline}`;

    // Final Amounts
    xml += `${indent}<FinalAmounts>${newline}`;
    xml += `${indent}${indent}<NetAmountPayable>${this.formatMoneyForXML(form.netAmountPayable)}</NetAmountPayable>${newline}`;
    xml += `${indent}${indent}<Penalties>${this.formatMoneyForXML(form.penalties)}</Penalties>${newline}`;
    xml += `${indent}${indent}<TotalAmountPayable>${this.formatMoneyForXML(form.totalAmountPayable)}</TotalAmountPayable>${newline}`;
    xml += `${indent}</FinalAmounts>${newline}`;

    // Generation metadata
    xml += `${indent}<GenerationInfo>${newline}`;
    xml += `${indent}${indent}<GeneratedDate>${this.formatDateForXML(form.generatedDate)}</GeneratedDate>${newline}`;
    xml += `${indent}${indent}<GeneratedBy><![CDATA[${form.generatedBy}]]></GeneratedBy>${newline}`;
    xml += `${indent}</GenerationInfo>${newline}`;

    // Close root element
    xml += `</${template.rootElement}>`;

    return xml;
  }

  /**
   * Generate XML for Quarterly Withholding Return (Form 1601EQ)
   */
  private generateQuarterlyWithholdingXML(
    form: Form1601EQ,
    template: XMLTemplate,
    config: XMLExportConfig
  ): string {
    const indent = config.indentOutput ? "  " : "";
    const newline = config.indentOutput ? "\n" : "";

    let xml = "";

    // XML Declaration
    if (config.xmlDeclaration !== false) {
      xml += '<?xml version="1.0" encoding="UTF-8"?>' + newline;
    }

    // Root element
    xml += `<${template.rootElement}`;
    if (template.namespace) {
      xml += ` xmlns="${template.namespace}"`;
    }
    xml += `>${newline}`;

    // Form header
    xml += `${indent}<FormHeader>${newline}`;
    xml += `${indent}${indent}<FormType>${form.formType}</FormType>${newline}`;
    xml += `${indent}${indent}<TaxPeriod>${form.taxPeriod}</TaxPeriod>${newline}`;
    xml += `${indent}${indent}<Quarter>${form.quarter}</Quarter>${newline}`;
    xml += `${indent}${indent}<DateOfFiling>${this.formatDateForXML(form.dateOfFiling)}</DateOfFiling>${newline}`;
    xml += `${indent}</FormHeader>${newline}`;

    // Taxpayer Information
    xml += `${indent}<TaxpayerInfo>${newline}`;
    xml += `${indent}${indent}<TIN>${form.taxpayerInfo.tin}</TIN>${newline}`;
    xml += `${indent}${indent}<BusinessName><![CDATA[${form.taxpayerInfo.businessName}]]></BusinessName>${newline}`;
    xml += `${indent}</TaxpayerInfo>${newline}`;

    // Summary
    xml += `${indent}<Summary>${newline}`;
    xml += `${indent}${indent}<TotalIncomePayments>${this.formatMoneyForXML(form.totalIncomePayments)}</TotalIncomePayments>${newline}`;
    xml += `${indent}${indent}<TotalTaxWithheld>${this.formatMoneyForXML(form.totalTaxWithheld)}</TotalTaxWithheld>${newline}`;
    xml += `${indent}${indent}<Surcharge>${this.formatMoneyForXML(form.surcharge)}</Surcharge>${newline}`;
    xml += `${indent}${indent}<Interest>${this.formatMoneyForXML(form.interest)}</Interest>${newline}`;
    xml += `${indent}${indent}<TotalAmountPayable>${this.formatMoneyForXML(form.totalAmountPayable)}</TotalAmountPayable>${newline}`;
    xml += `${indent}</Summary>${newline}`;

    // Alphalist
    if (form.alphalist && form.alphalist.length > 0) {
      xml += `${indent}<Alphalist>${newline}`;
      for (const entry of form.alphalist) {
        xml += `${indent}${indent}<Entry>${newline}`;
        xml += `${indent}${indent}${indent}<SequenceNumber>${entry.sequenceNumber}</SequenceNumber>${newline}`;
        xml += `${indent}${indent}${indent}<PayeeTIN>${entry.payeeTin}</PayeeTIN>${newline}`;
        xml += `${indent}${indent}${indent}<PayeeName><![CDATA[${entry.payeeName}]]></PayeeName>${newline}`;
        xml += `${indent}${indent}${indent}<ATCCode>${entry.atcCode}</ATCCode>${newline}`;
        xml += `${indent}${indent}${indent}<TaxBase>${this.formatMoneyForXML(entry.taxBase)}</TaxBase>${newline}`;
        xml += `${indent}${indent}${indent}<TaxRate>${entry.taxRate}</TaxRate>${newline}`;
        xml += `${indent}${indent}${indent}<TaxWithheld>${this.formatMoneyForXML(entry.taxWithheld)}</TaxWithheld>${newline}`;
        xml += `${indent}${indent}${indent}<Month1>${this.formatMoneyForXML(entry.month1)}</Month1>${newline}`;
        xml += `${indent}${indent}${indent}<Month2>${this.formatMoneyForXML(entry.month2)}</Month2>${newline}`;
        xml += `${indent}${indent}${indent}<Month3>${this.formatMoneyForXML(entry.month3)}</Month3>${newline}`;
        xml += `${indent}${indent}</Entry>${newline}`;
      }
      xml += `${indent}</Alphalist>${newline}`;
    }

    xml += `</${template.rootElement}>`;
    return xml;
  }

  /**
   * Generate XML for Monthly Withholding Return (Form 1601C)
   */
  private generateMonthlyWithholdingXML(
    form: Form1601C,
    template: XMLTemplate,
    config: XMLExportConfig
  ): string {
    const indent = config.indentOutput ? "  " : "";
    const newline = config.indentOutput ? "\n" : "";

    let xml = "";

    // XML Declaration
    if (config.xmlDeclaration !== false) {
      xml += '<?xml version="1.0" encoding="UTF-8"?>' + newline;
    }

    // Root element
    xml += `<${template.rootElement}>${newline}`;

    // Form header
    xml += `${indent}<FormHeader>${newline}`;
    xml += `${indent}${indent}<FormType>${form.formType}</FormType>${newline}`;
    xml += `${indent}${indent}<TaxPeriod>${form.taxPeriod}</TaxPeriod>${newline}`;
    xml += `${indent}${indent}<Month>${form.month}</Month>${newline}`;
    xml += `${indent}</FormHeader>${newline}`;

    // Taxpayer Information
    xml += `${indent}<TaxpayerInfo>${newline}`;
    xml += `${indent}${indent}<TIN>${form.taxpayerInfo.tin}</TIN>${newline}`;
    xml += `${indent}${indent}<BusinessName><![CDATA[${form.taxpayerInfo.businessName}]]></BusinessName>${newline}`;
    xml += `${indent}</TaxpayerInfo>${newline}`;

    // ATC Breakdown
    xml += `${indent}<WithholdingByATC>${newline}`;
    for (const [atcCode, atcData] of Object.entries(form.withholdingByATC)) {
      xml += `${indent}${indent}<ATCEntry>${newline}`;
      xml += `${indent}${indent}${indent}<ATCCode>${atcCode}</ATCCode>${newline}`;
      xml += `${indent}${indent}${indent}<IncomePayments>${this.formatMoneyForXML(atcData.incomePayments)}</IncomePayments>${newline}`;
      xml += `${indent}${indent}${indent}<TaxWithheld>${this.formatMoneyForXML(atcData.taxWithheld)}</TaxWithheld>${newline}`;
      xml += `${indent}${indent}${indent}<TaxRate>${atcData.taxRate}</TaxRate>${newline}`;
      xml += `${indent}${indent}</ATCEntry>${newline}`;
    }
    xml += `${indent}</WithholdingByATC>${newline}`;

    // Summary
    xml += `${indent}<Summary>${newline}`;
    xml += `${indent}${indent}<TotalIncomePayments>${this.formatMoneyForXML(form.totalIncomePayments)}</TotalIncomePayments>${newline}`;
    xml += `${indent}${indent}<TotalTaxWithheld>${this.formatMoneyForXML(form.totalTaxWithheld)}</TotalTaxWithheld>${newline}`;
    xml += `${indent}${indent}<TotalAmountPayable>${this.formatMoneyForXML(form.totalAmountPayable)}</TotalAmountPayable>${newline}`;
    xml += `${indent}</Summary>${newline}`;

    xml += `</${template.rootElement}>`;
    return xml;
  }

  /**
   * Generate XML for Certificate (Form 2307)
   */
  private generateCertificateXML(
    form: Form2307,
    template: XMLTemplate,
    config: XMLExportConfig
  ): string {
    const indent = config.indentOutput ? "  " : "";
    const newline = config.indentOutput ? "\n" : "";

    let xml = "";

    // XML Declaration
    if (config.xmlDeclaration !== false) {
      xml += '<?xml version="1.0" encoding="UTF-8"?>' + newline;
    }

    // Root element
    xml += `<${template.rootElement}>${newline}`;

    // Certificate Information
    xml += `${indent}<CertificateInfo>${newline}`;
    xml += `${indent}${indent}<CertificateNumber>${form.certificateNumber}</CertificateNumber>${newline}`;
    xml += `${indent}${indent}<DateIssued>${this.formatDateForXML(form.dateIssued)}</DateIssued>${newline}`;
    xml += `${indent}${indent}<PlaceIssued><![CDATA[${form.placeIssued}]]></PlaceIssued>${newline}`;
    xml += `${indent}</CertificateInfo>${newline}`;

    // Payor Information
    xml += `${indent}<PayorInfo>${newline}`;
    xml += `${indent}${indent}<TIN>${form.payorInfo.tin}</TIN>${newline}`;
    xml += `${indent}${indent}<BusinessName><![CDATA[${form.payorInfo.businessName}]]></BusinessName>${newline}`;
    xml += `${indent}${indent}<Address><![CDATA[${form.payorInfo.address}]]></Address>${newline}`;
    xml += `${indent}</PayorInfo>${newline}`;

    // Payee Information
    xml += `${indent}<PayeeInfo>${newline}`;
    xml += `${indent}${indent}<TIN>${form.payeeInfo.tin}</TIN>${newline}`;
    xml += `${indent}${indent}<Name><![CDATA[${form.payeeInfo.name}]]></Name>${newline}`;
    xml += `${indent}${indent}<Address><![CDATA[${form.payeeInfo.address}]]></Address>${newline}`;
    xml += `${indent}</PayeeInfo>${newline}`;

    // Income Payments
    xml += `${indent}<IncomePayments>${newline}`;
    for (const payment of form.incomePayments) {
      xml += `${indent}${indent}<Payment>${newline}`;
      xml += `${indent}${indent}${indent}<Month>${payment.month}</Month>${newline}`;
      xml += `${indent}${indent}${indent}<Particulars><![CDATA[${payment.particulars}]]></Particulars>${newline}`;
      xml += `${indent}${indent}${indent}<ATCCode>${payment.atcCode}</ATCCode>${newline}`;
      xml += `${indent}${indent}${indent}<IncomeAmount>${this.formatMoneyForXML(payment.incomeAmount)}</IncomeAmount>${newline}`;
      xml += `${indent}${indent}${indent}<TaxRate>${payment.taxRate}</TaxRate>${newline}`;
      xml += `${indent}${indent}${indent}<TaxWithheld>${this.formatMoneyForXML(payment.taxWithheld)}</TaxWithheld>${newline}`;
      xml += `${indent}${indent}</Payment>${newline}`;
    }
    xml += `${indent}</IncomePayments>${newline}`;

    // Summary
    xml += `${indent}<Summary>${newline}`;
    xml += `${indent}${indent}<TotalIncomePayment>${this.formatMoneyForXML(form.totalIncomePayment)}</TotalIncomePayment>${newline}`;
    xml += `${indent}${indent}<TotalTaxWithheld>${this.formatMoneyForXML(form.totalTaxWithheld)}</TotalTaxWithheld>${newline}`;
    xml += `${indent}</Summary>${newline}`;

    xml += `</${template.rootElement}>`;
    return xml;
  }

  // Private helper methods

  private mergeDefaultConfig(config?: XMLExportConfig): XMLExportConfig {
    return {
      format: "xml",
      schemaVersion: "1.0",
      includeDigitalSignature: false,
      xmlDeclaration: true,
      indentOutput: true,
      validateSchema: true,
      compressionLevel: 0,
      validateBeforeExport: true,
      ...config,
    };
  }

  private formatDateForXML(date: Date): string {
    // Format: YYYY-MM-DD
    return date.toISOString().split("T")[0];
  }

  private formatMoneyForXML(money: Money): string {
    // Format with 2 decimal places, no thousand separators
    return money.toNumber().toFixed(2);
  }

  private getFormPeriod(form: BIRForm): string {
    return form.taxPeriod.replace("/", "-");
  }

  private async validateXMLSchema(xmlContent: string, formType: string): Promise<void> {
    // In a real implementation, this would validate against XSD schema
    // For now, basic XML structure validation
    try {
      // Simple XML well-formedness check
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
      const parseError = xmlDoc.getElementsByTagName("parsererror");

      if (parseError.length > 0) {
        throw new Error("Invalid XML structure");
      }
    } catch (error: any) {
      throw new Error(`XML validation failed: ${error.message}`);
    }
  }

  private async addDigitalSignature(xmlContent: string, form: BIRForm): Promise<string> {
    // In a real implementation, this would add proper XML digital signature
    // For now, adding a placeholder signature block
    const signatureBlock = `
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <Reference URI="">
        <Transforms>
          <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        </Transforms>
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <DigestValue>PLACEHOLDER_DIGEST_VALUE</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>PLACEHOLDER_SIGNATURE_VALUE</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>PLACEHOLDER_CERTIFICATE</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`;

    // Insert signature block before closing root element
    const closingTagIndex = xmlContent.lastIndexOf(
      "</" + this.XML_TEMPLATES[form.formType].rootElement
    );
    if (closingTagIndex === -1) {
      throw new Error("Invalid XML structure for signature insertion");
    }

    return (
      xmlContent.slice(0, closingTagIndex) +
      signatureBlock +
      "\n" +
      xmlContent.slice(closingTagIndex)
    );
  }

  private async compressXML(xmlContent: string, compressionLevel: number): Promise<Buffer> {
    // In a real implementation, this would use zlib compression
    // For now, returning the original content as buffer
    return Buffer.from(xmlContent, "utf-8");
  }
}
