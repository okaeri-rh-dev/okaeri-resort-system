/**
 * Services Export
 *
 * Central export point for all lib services including report engine, export functionality,
 * and compliance monitoring services.
 */

// Services are server-side only - do not export instances for client use
export { ReportEngineService } from "./report-engine.service";
export { ExportService, exportService } from "./export.service";
export { ComplianceMonitorService, complianceMonitor } from "./compliance-monitor.service";
export { BIRIntegrationService } from "./bir-integration.service";

export type {
  ReportType,
  ReportPeriod,
  ReportFormat,
  ReportConfig,
  ReportMetrics,
  ReportData,
  ReportStrategy,
  ReportJob,
} from "./report-engine.service";

export type { ExportConfig, ExportResult } from "./export.service";

// Compliance monitoring types
export type {
  ComplianceCheckResult,
  ComplianceDeadlineAlert,
  ComplianceMonitoringConfig,
  ComplianceMonitoringStats,
  SequenceIntegrityResult,
  DocumentComplianceCheck,
  AuditReadinessScore,
} from "../compliance/types";

// Factory function for creating services - server-side only
// These should only be instantiated in API routes, not in client code
export function createReportServices() {
  return {
    reportEngine: new ReportEngineService(),
    exportService: exportService,
  };
}

// Factory function for creating compliance services
export function createComplianceServices() {
  return {
    complianceMonitor: complianceMonitor,
  };
}

// Factory function for creating BIR services
export function createBIRServices() {
  return {
    birIntegration: new BIRIntegrationService(),
  };
}

// Type for the report services
export type ReportServices = ReturnType<typeof createReportServices>;

// Type for the compliance services
export type ComplianceServices = ReturnType<typeof createComplianceServices>;

// Type for the BIR services
export type BIRServices = ReturnType<typeof createBIRServices>;
