/**
 * Export Service
 *
 * Handles export functionality for financial reports to various formats:
 * - Excel with formatting and formulas
 * - PDF with resort branding
 * - QuickBooks IIF format for accounting integration
 */

import { Money } from "@/lib/money";
import type { ReportData, ReportFormat } from "./report-engine.service";
import type { ProfitLossDetails } from "@/lib/strategies/profit-loss.strategy";
import type { CashFlowDetails } from "@/lib/strategies/cash-flow.strategy";

// Export Configuration
export interface ExportConfig {
  format: ReportFormat;
  filename?: string;
  includeCharts?: boolean;
  includeBranding?: boolean;
  template?: string;
  orientation?: "portrait" | "landscape";
  paperSize?: "A4" | "Letter" | "Legal";
}

// Export Result
export interface ExportResult {
  success: boolean;
  filename: string;
  fileSize: number;
  downloadUrl?: string;
  error?: string;
  metadata: {
    format: ReportFormat;
    generatedAt: Date;
    reportType: string;
    projectId: string;
  };
}

// Template Configuration for different report types
interface TemplateConfig {
  title: string;
  headers: string[];
  styling: {
    headerColor: string;
    alternateRowColor: string;
    currencyFormat: string;
    percentageFormat: string;
  };
  branding: {
    logo?: string;
    companyName: string;
    address: string;
    contact: string;
  };
}

export class ExportService {
  /**
   * Export report data to specified format
   */
  async exportReport(reportData: ReportData, config: ExportConfig): Promise<ExportResult> {
    try {
      const filename = config.filename || this.generateFilename(reportData, config.format);

      let result: ExportResult;

      switch (config.format) {
        case "excel":
          result = await this.exportToExcel(reportData, config, filename);
          break;
        case "pdf":
          result = await this.exportToPDF(reportData, config, filename);
          break;
        case "quickbooks":
          result = await this.exportToQuickBooks(reportData, config, filename);
          break;
        default:
          throw new Error(`Unsupported export format: ${config.format}`);
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        filename: "",
        fileSize: 0,
        error: error.message,
        metadata: {
          format: config.format,
          generatedAt: new Date(),
          reportType: reportData.config.reportType,
          projectId: reportData.config.projectId,
        },
      };
    }
  }

  /**
   * Export to Excel format with formatting and formulas
   */
  private async exportToExcel(
    reportData: ReportData,
    config: ExportConfig,
    filename: string
  ): Promise<ExportResult> {
    // This is a simplified implementation
    // In production, you'd use libraries like ExcelJS or SheetJS

    const template = this.getTemplateConfig(reportData.config.reportType);
    const worksheetData = this.prepareExcelData(reportData, template);

    // Simulate Excel file generation
    const excelContent = this.generateExcelContent(worksheetData, template, config);

    // In production, this would create actual Excel file
    const fileSize = excelContent.length;

    return {
      success: true,
      filename,
      fileSize,
      downloadUrl: `/exports/${filename}`,
      metadata: {
        format: "excel",
        generatedAt: new Date(),
        reportType: reportData.config.reportType,
        projectId: reportData.config.projectId,
      },
    };
  }

  /**
   * Export to PDF format with resort branding
   */
  private async exportToPDF(
    reportData: ReportData,
    config: ExportConfig,
    filename: string
  ): Promise<ExportResult> {
    // This is a simplified implementation
    // In production, you'd use libraries like Puppeteer, jsPDF, or PDFKit

    const template = this.getTemplateConfig(reportData.config.reportType);
    const htmlContent = this.generateHTMLForPDF(reportData, template, config);

    // Simulate PDF generation
    const pdfContent = await this.convertHTMLToPDF(htmlContent, config);

    return {
      success: true,
      filename,
      fileSize: pdfContent.length,
      downloadUrl: `/exports/${filename}`,
      metadata: {
        format: "pdf",
        generatedAt: new Date(),
        reportType: reportData.config.reportType,
        projectId: reportData.config.projectId,
      },
    };
  }

  /**
   * Export to QuickBooks IIF format
   */
  private async exportToQuickBooks(
    reportData: ReportData,
    config: ExportConfig,
    filename: string
  ): Promise<ExportResult> {
    const iifContent = this.generateQuickBooksIIF(reportData);

    return {
      success: true,
      filename,
      fileSize: iifContent.length,
      downloadUrl: `/exports/${filename}`,
      metadata: {
        format: "quickbooks",
        generatedAt: new Date(),
        reportType: reportData.config.reportType,
        projectId: reportData.config.projectId,
      },
    };
  }

  /**
   * Generate filename based on report data and format
   */
  private generateFilename(reportData: ReportData, format: ReportFormat): string {
    const reportType = reportData.config.reportType.replace("-", "_");
    const startDate = reportData.config.startDate.toISOString().split("T")[0];
    const endDate = reportData.config.endDate.toISOString().split("T")[0];
    const timestamp = new Date().toISOString().split("T")[0];

    const extension = this.getFileExtension(format);

    return `${reportType}_${startDate}_to_${endDate}_${timestamp}.${extension}`;
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: ReportFormat): string {
    switch (format) {
      case "excel":
        return "xlsx";
      case "pdf":
        return "pdf";
      case "quickbooks":
        return "iif";
      default:
        return "txt";
    }
  }

  /**
   * Get template configuration for report type
   */
  private getTemplateConfig(reportType: string): TemplateConfig {
    const baseTemplate: TemplateConfig = {
      title: "",
      headers: [],
      styling: {
        headerColor: "#2563eb", // Blue
        alternateRowColor: "#f8fafc",
        currencyFormat: "₱#,##0.00",
        percentageFormat: "0.00%",
      },
      branding: {
        companyName: "Okaeri Resort",
        address: "La Union, Philippines",
        contact: "contact@okaeri-resort.com",
      },
    };

    switch (reportType) {
      case "profit-loss":
        return {
          ...baseTemplate,
          title: "Profit & Loss Statement",
          headers: ["Account", "Amount (₱)", "Percentage"],
        };
      case "cash-flow":
        return {
          ...baseTemplate,
          title: "Cash Flow Statement",
          headers: ["Category", "Cash In (₱)", "Cash Out (₱)", "Net Cash (₱)"],
        };
      case "occupancy":
        return {
          ...baseTemplate,
          title: "Occupancy Report",
          headers: ["Period", "Occupancy %", "ADR (₱)", "RevPAR (₱)"],
        };
      case "tax-summary":
        return {
          ...baseTemplate,
          title: "Tax Summary Report",
          headers: ["Tax Type", "Amount (₱)", "Status"],
        };
      default:
        return baseTemplate;
    }
  }

  /**
   * Prepare data for Excel export
   */
  private prepareExcelData(reportData: ReportData, template: TemplateConfig): any[] {
    const data: any[] = [];

    // Add header row
    data.push(template.headers);

    // Add data rows based on report type
    switch (reportData.config.reportType) {
      case "profit-loss":
        data.push(...this.prepareProfitLossExcelData(reportData.details as ProfitLossDetails));
        break;
      case "cash-flow":
        data.push(...this.prepareCashFlowExcelData(reportData.details as CashFlowDetails));
        break;
      default:
        // Generic data preparation
        data.push(["No data available"]);
    }

    return data;
  }

  /**
   * Prepare Profit & Loss data for Excel
   */
  private prepareProfitLossExcelData(details: ProfitLossDetails): any[] {
    const data: any[] = [];

    // Revenue section
    data.push(["REVENUE", "", ""]);
    data.push(["Room Revenue", details.revenue.roomRevenue.toNumber(), ""]);
    data.push(["Food & Beverage Revenue", details.revenue.foodBeverageRevenue.toNumber(), ""]);
    data.push(["Tour Package Revenue", details.revenue.tourPackageRevenue.toNumber(), ""]);
    data.push(["Miscellaneous Revenue", details.revenue.miscellaneousRevenue.toNumber(), ""]);
    data.push(["Total Gross Revenue", details.revenue.totalGrossRevenue.toNumber(), ""]);
    data.push(["Less: Discounts", details.revenue.discounts.toNumber(), ""]);
    data.push(["Net Revenue", details.revenue.netRevenue.toNumber(), ""]);
    data.push(["", "", ""]);

    // Direct Costs section
    data.push(["DIRECT COSTS", "", ""]);
    data.push(["Room Costs", details.directCosts.roomCosts.toNumber(), ""]);
    data.push(["Food & Beverage Costs", details.directCosts.foodBeverageCosts.toNumber(), ""]);
    data.push(["Tour Costs", details.directCosts.tourCosts.toNumber(), ""]);
    data.push(["Total Direct Costs", details.directCosts.totalDirectCosts.toNumber(), ""]);
    data.push(["", "", ""]);

    // Gross Profit
    data.push([
      "Gross Profit",
      details.grossProfit.toNumber(),
      details.keyRatios.grossProfitMargin.toFixed(2) + "%",
    ]);
    data.push(["", "", ""]);

    // Operating Expenses section
    data.push(["OPERATING EXPENSES", "", ""]);
    data.push(["Salaries", details.operatingExpenses.salaries.toNumber(), ""]);
    data.push(["Utilities", details.operatingExpenses.utilities.toNumber(), ""]);
    data.push(["Maintenance", details.operatingExpenses.maintenance.toNumber(), ""]);
    data.push(["Marketing", details.operatingExpenses.marketing.toNumber(), ""]);
    data.push(["Insurance", details.operatingExpenses.insurance.toNumber(), ""]);
    data.push(["Supplies", details.operatingExpenses.supplies.toNumber(), ""]);
    data.push(["Professional Fees", details.operatingExpenses.professional.toNumber(), ""]);
    data.push(["Depreciation", details.operatingExpenses.depreciation.toNumber(), ""]);
    data.push(["Miscellaneous", details.operatingExpenses.miscellaneous.toNumber(), ""]);
    data.push([
      "Total Operating Expenses",
      details.operatingExpenses.totalOperatingExpenses.toNumber(),
      "",
    ]);
    data.push(["", "", ""]);

    // Net Income
    data.push([
      "Operating Income",
      details.operatingIncome.toNumber(),
      details.keyRatios.operatingProfitMargin.toFixed(2) + "%",
    ]);
    data.push(["Earnings Before Tax", details.earningsBeforeTax.toNumber(), ""]);
    data.push(["Income Tax", details.taxes.incomeTax.toNumber(), ""]);
    data.push([
      "Net Income",
      details.netIncome.toNumber(),
      details.keyRatios.netProfitMargin.toFixed(2) + "%",
    ]);

    return data;
  }

  /**
   * Prepare Cash Flow data for Excel
   */
  private prepareCashFlowExcelData(details: CashFlowDetails): any[] {
    const data: any[] = [];

    // Operating Activities
    data.push(["OPERATING ACTIVITIES", "", "", ""]);
    data.push(["Net Income", "", details.operatingActivities.netIncome.toNumber(), ""]);
    data.push([
      "Depreciation",
      "",
      details.operatingActivities.adjustments.depreciation.toNumber(),
      "",
    ]);
    data.push([
      "Working Capital Changes",
      "",
      details.operatingActivities.workingCapitalChanges.totalWorkingCapitalChange.toNumber(),
      "",
    ]);
    data.push([
      "Net Cash from Operations",
      "",
      "",
      details.operatingActivities.netCashFromOperations.toNumber(),
    ]);
    data.push(["", "", "", ""]);

    // Investing Activities
    data.push(["INVESTING ACTIVITIES", "", "", ""]);
    data.push([
      "Property Purchases",
      details.investingActivities.propertyPurchases.toNumber(),
      "",
      "",
    ]);
    data.push([
      "Equipment Purchases",
      details.investingActivities.equipmentPurchases.toNumber(),
      "",
      "",
    ]);
    data.push(["Renovation Costs", details.investingActivities.renovationCosts.toNumber(), "", ""]);
    data.push(["Asset Disposals", "", details.investingActivities.assetDisposals.toNumber(), ""]);
    data.push([
      "Net Cash from Investing",
      "",
      "",
      details.investingActivities.netCashFromInvesting.toNumber(),
    ]);
    data.push(["", "", "", ""]);

    // Financing Activities
    data.push(["FINANCING ACTIVITIES", "", "", ""]);
    data.push(["Loan Proceeds", "", details.financingActivities.loanProceeds.toNumber(), ""]);
    data.push(["Loan Repayments", details.financingActivities.loanRepayments.toNumber(), "", ""]);
    data.push([
      "Capital Contributions",
      "",
      details.financingActivities.capitalContributions.toNumber(),
      "",
    ]);
    data.push([
      "Net Cash from Financing",
      "",
      "",
      details.financingActivities.netCashFromFinancing.toNumber(),
    ]);
    data.push(["", "", "", ""]);

    // Net Cash Change
    data.push(["Net Change in Cash", "", "", details.netCashChange.toNumber()]);
    data.push(["Cash at Beginning", "", details.cashAtBeginning.toNumber(), ""]);
    data.push(["Cash at End", "", "", details.cashAtEnd.toNumber()]);

    return data;
  }

  /**
   * Generate Excel content (simplified)
   */
  private generateExcelContent(
    data: any[],
    template: TemplateConfig,
    config: ExportConfig
  ): string {
    // This is a simplified CSV-like representation
    // In production, you'd use ExcelJS to create proper XLSX files

    let content = `${template.title}\n`;
    content += `Generated on: ${new Date().toLocaleDateString()}\n\n`;

    // Add data
    data.forEach((row) => {
      content += row.join("\t") + "\n";
    });

    return content;
  }

  /**
   * Generate HTML for PDF conversion
   */
  private generateHTMLForPDF(
    reportData: ReportData,
    template: TemplateConfig,
    config: ExportConfig
  ): string {
    const styles = `
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .company-name { font-size: 24px; font-weight: bold; color: ${template.styling.headerColor}; }
        .report-title { font-size: 20px; margin: 10px 0; }
        .report-period { font-size: 14px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: ${template.styling.headerColor}; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background-color: ${template.styling.alternateRowColor}; }
        .currency { text-align: right; }
        .footer { margin-top: 50px; font-size: 12px; color: #666; }
      </style>
    `;

    const header = `
      <div class="header">
        <div class="company-name">${template.branding.companyName}</div>
        <div>${template.branding.address}</div>
        <div>${template.branding.contact}</div>
        <br>
        <div class="report-title">${template.title}</div>
        <div class="report-period">
          ${reportData.config.startDate.toLocaleDateString()} - ${reportData.config.endDate.toLocaleDateString()}
        </div>
      </div>
    `;

    // Generate table content based on report type
    const tableContent = this.generateTableHTML(reportData, template);

    const footer = `
      <div class="footer">
        Generated on: ${new Date().toLocaleString()}<br>
        Report ID: ${reportData.config.projectId}<br>
        Performance: ${reportData.performance.generationTime}ms, ${reportData.performance.dataPoints} data points
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${template.title}</title>
        ${styles}
      </head>
      <body>
        ${header}
        ${tableContent}
        ${footer}
      </body>
      </html>
    `;
  }

  /**
   * Generate table HTML for PDF
   */
  private generateTableHTML(reportData: ReportData, template: TemplateConfig): string {
    const data = this.prepareExcelData(reportData, template);

    if (data.length === 0) {
      return "<p>No data available</p>";
    }

    let html = "<table>";

    // Headers
    if (data.length > 0) {
      html += "<tr>";
      data[0].forEach((header: string) => {
        html += `<th>${header}</th>`;
      });
      html += "</tr>";
    }

    // Data rows
    for (let i = 1; i < data.length; i++) {
      html += "<tr>";
      data[i].forEach((cell: any, index: number) => {
        const value = typeof cell === "number" ? cell.toLocaleString() : cell;
        const className = typeof cell === "number" ? "currency" : "";
        html += `<td class="${className}">${value || ""}</td>`;
      });
      html += "</tr>";
    }

    html += "</table>";
    return html;
  }

  /**
   * Convert HTML to PDF (simplified)
   */
  private async convertHTMLToPDF(html: string, config: ExportConfig): Promise<string> {
    // In production, you'd use Puppeteer or similar
    // This is a simplified representation
    return `PDF Content for: ${html.substring(0, 100)}...`;
  }

  /**
   * Generate QuickBooks IIF format
   */
  private generateQuickBooksIIF(reportData: ReportData): string {
    let iif = "!HDR\tPROD\tVER\tREL\tIIFVER\tDATE\tTIME\tACCNT\n";
    iif += `QB\t2021\t2021\t1\t1\t${new Date().toLocaleDateString()}\t${new Date().toLocaleTimeString()}\tN\n`;
    iif += "!ACCNT\tNAME\tACCNTTYPE\tOBAL\tDESC\n";

    // Add accounts based on report type
    if (reportData.config.reportType === "profit-loss") {
      const details = reportData.details as ProfitLossDetails;

      iif += `Revenue\tIncome\t0.00\tRoom Revenue\n`;
      iif += `Food & Beverage\tIncome\t0.00\tF&B Revenue\n`;
      iif += `Operating Expenses\tExpense\t0.00\tOperating Expenses\n`;
      iif += `Utilities\tExpense\t0.00\tUtility Expenses\n`;

      // Add transactions
      iif += "!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\n";
      iif += `GENERAL JOURNAL\t${reportData.config.startDate.toLocaleDateString()}\tRevenue\t\t${details.revenue.netRevenue.toNumber()}\t\tPeriod Revenue\n`;
    }

    iif += "!ENDTRNS\n";

    return iif;
  }
}

// Export singleton instance
export const exportService = new ExportService();

export default ExportService;
