/**
 * Reports API endpoints
 *
 * Client-side API wrapper for report generation
 * All report generation happens server-side through these endpoints
 */

import { apiClient } from "@/api/client";
import type {
  ReportConfig,
  ReportData,
  ReportType,
  ReportPeriod,
  ReportFormat,
} from "@/lib/services/report-engine.service";

export interface GenerateReportPayload {
  projectId: string;
  reportType: ReportType;
  period: ReportPeriod;
  startDate: Date | string;
  endDate: Date | string;
  currency?: string;
  includeComparisons?: boolean;
  includeCharts?: boolean;
  format?: ReportFormat;
}

export interface ReportListFilters {
  projectId?: string;
  reportType?: ReportType;
  period?: ReportPeriod;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ReportResponse {
  success: boolean;
  data?: ReportData;
  error?: string;
  generationTime?: number;
}

export interface ReportListResponse {
  reports: ReportData[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Reports API client
 */
export const reportsApi = {
  /**
   * Generate a new report
   * This replaces direct usage of reportEngine.generateReport()
   */
  async generateReport(config: GenerateReportPayload): Promise<ReportData> {
    // For now, create mock data until the server endpoint is ready
    // This prevents the app from crashing while we set up the server

    const mockReportData: ReportData = {
      config: {
        projectId: config.projectId,
        reportType: config.reportType,
        period: config.period,
        startDate: new Date(config.startDate),
        endDate: new Date(config.endDate),
        currency: config.currency || "PHP",
        includeComparisons: config.includeComparisons ?? true,
        includeCharts: config.includeCharts ?? true,
      },
      metrics: {
        totalRevenue: { amount: 250000, currency: "PHP", toNumber: () => 250000 } as any,
        totalExpenses: { amount: 180000, currency: "PHP", toNumber: () => 180000 } as any,
        netIncome: { amount: 70000, currency: "PHP", toNumber: () => 70000 } as any,
        grossMargin: 28,
        taxLiability: { amount: 15000, currency: "PHP", toNumber: () => 15000 } as any,
        vatCollected: { amount: 30000, currency: "PHP", toNumber: () => 30000 } as any,
        withholdingTaxPaid: { amount: 5000, currency: "PHP", toNumber: () => 5000 } as any,
      },
      details: {
        // Mock details based on report type
        revenue: [],
        expenses: [],
        summary: "Mock report data for development",
      },
      generatedAt: new Date(),
      generatedBy: "system",
      performance: {
        generationTime: 150,
        cacheHit: false,
        dataPoints: 100,
      },
    };

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return mockReportData;

    // When server endpoint is ready, replace with:
    // const response = await apiClient.post<ReportResponse>("/api/reports/generate", config);
    // if (!response.success || !response.data) {
    //   throw new Error(response.error || "Failed to generate report");
    // }
    // return response.data;
  },

  /**
   * Get a list of previously generated reports
   */
  async listReports(filters: ReportListFilters): Promise<ReportListResponse> {
    // Mock implementation
    return {
      reports: [],
      total: 0,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };

    // When server endpoint is ready:
    // return apiClient.get<ReportListResponse>("/api/reports", filters);
  },

  /**
   * Get a specific report by ID
   */
  async getReport(reportId: string): Promise<ReportData> {
    // Mock implementation
    throw new Error("Not implemented - report retrieval requires server endpoint");

    // When server endpoint is ready:
    // const response = await apiClient.get<ReportResponse>(`/api/reports/${reportId}`);
    // if (!response.success || !response.data) {
    //   throw new Error(response.error || "Report not found");
    // }
    // return response.data;
  },

  /**
   * Export a report in different formats
   */
  async exportReport(reportId: string, format: ReportFormat): Promise<Blob> {
    // Mock implementation
    throw new Error("Not implemented - report export requires server endpoint");

    // When server endpoint is ready:
    // return apiClient.download(`/api/reports/${reportId}/export`, { format });
  },

  /**
   * Delete a cached report
   */
  async deleteReport(reportId: string): Promise<void> {
    // Mock implementation
    throw new Error("Not implemented - report deletion requires server endpoint");

    // When server endpoint is ready:
    // await apiClient.delete(`/api/reports/${reportId}`);
  },
};

export default reportsApi;
