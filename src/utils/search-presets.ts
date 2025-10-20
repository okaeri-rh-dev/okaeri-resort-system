/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
/**
 * Search Preset Management and Export Utilities - PHASE 3-4
 *
 * Provides comprehensive preset management and data export:
 * - Default search presets for common scenarios
 * Note: Advanced features deferred to Phase 3-4
 * - Custom preset creation and management
 * - Export functionality for various formats
 * - Import/export preset configurations
 * - Batch operations and reporting
 */

import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";

import type {
  AdvancedFilter,
  SearchPreset,
  SearchQuery,
  SearchResult,
} from "@/stores/useSearchStore";
import type { Booking, Guest, Unit } from "@/types";
import {
  DateRangeFilterBuilder,
  FilterPresets,
  FinancialFilterBuilder,
  GuestFilterBuilder,
  StatusFilterBuilder,
  UnitFilterBuilder,
  WorkflowStateFilterBuilder,
} from "@/utils/filter-builder";

// ============================================
// DEFAULT SEARCH PRESETS
// ============================================

export const DEFAULT_SEARCH_PRESETS: SearchPreset[] = [
  {
    id: "preset-today-checkins",
    name: "Today's Check-ins",
    description: "All bookings checking in today",
    filters: [
      DateRangeFilterBuilder.today("check_in").build(),
      new StatusFilterBuilder({ bookingStatus: ["Confirmed"] }).build(),
    ],
    sortBy: "check_in",
    sortOrder: "asc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-today-checkouts",
    name: "Today's Check-outs",
    description: "All bookings checking out today",
    filters: [
      DateRangeFilterBuilder.today("check_out").build(),
      new StatusFilterBuilder({ bookingStatus: ["CheckedIn"] }).build(),
    ],
    sortBy: "check_out",
    sortOrder: "asc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-upcoming-arrivals",
    name: "Upcoming Arrivals (7 days)",
    description: "Bookings arriving in the next 7 days",
    filters: [
      DateRangeFilterBuilder.upcomingDays(7, "check_in").build(),
      StatusFilterBuilder.active().build(),
    ],
    sortBy: "check_in",
    sortOrder: "asc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-unpaid-bookings",
    name: "Unpaid Bookings",
    description: "Active bookings with pending payments",
    filters: [FinancialFilterBuilder.unpaid().build(), StatusFilterBuilder.active().build()],
    sortBy: "check_in",
    sortOrder: "asc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-overdue-payments",
    name: "Overdue Payments",
    description: "Bookings with overdue payment status",
    filters: [FinancialFilterBuilder.overdue().build()],
    sortBy: "check_in",
    sortOrder: "asc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-needs-attention",
    name: "Needs Attention",
    description: "Bookings requiring immediate action",
    filters: [WorkflowStateFilterBuilder.needsAttention().build()],
    sortBy: "check_in",
    sortOrder: "asc",
    isDefault: true,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-vip-guests",
    name: "VIP Guests",
    description: "Bookings from VIP or high-value guests",
    filters: [GuestFilterBuilder.vipGuests().build(), StatusFilterBuilder.active().build()],
    sortBy: "check_in",
    sortOrder: "asc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-this-month",
    name: "This Month's Bookings",
    description: "All bookings for the current month",
    filters: [DateRangeFilterBuilder.thisMonth().build()],
    sortBy: "check_in",
    sortOrder: "asc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-cancelled-recent",
    name: "Recent Cancellations",
    description: "Bookings cancelled in the last 7 days",
    filters: [
      StatusFilterBuilder.cancelled().build(),
      DateRangeFilterBuilder.pastDays(7, "updated_at").build(),
    ],
    sortBy: "updated_at",
    sortOrder: "desc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: "preset-high-value",
    name: "High Value Bookings",
    description: "Bookings over ₱5,000",
    filters: [FinancialFilterBuilder.highValue(5000).build(), StatusFilterBuilder.active().build()],
    sortBy: "total_amount",
    sortOrder: "desc",
    isDefault: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
];

// ============================================
// PRESET CATEGORIES
// ============================================

export interface PresetCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  presets: SearchPreset[];
}

export function categorizePresets(presets: SearchPreset[]): PresetCategory[] {
  const categories: PresetCategory[] = [
    {
      id: "daily-operations",
      name: "Daily Operations",
      description: "Common daily tasks and checks",
      presets: [],
    },
    {
      id: "financial",
      name: "Financial",
      description: "Payment and revenue related searches",
      presets: [],
    },
    {
      id: "guest-management",
      name: "Guest Management",
      description: "Guest-focused searches",
      presets: [],
    },
    {
      id: "workflow",
      name: "Workflow & Automation",
      description: "Workflow states and automated actions",
      presets: [],
    },
    {
      id: "reporting",
      name: "Reporting",
      description: "Data analysis and reporting queries",
      presets: [],
    },
    {
      id: "custom",
      name: "Custom Presets",
      description: "User-created custom presets",
      presets: [],
    },
  ];

  for (const preset of presets) {
    // Categorize based on preset name and filters
    if (preset.name.toLowerCase().includes("check") || preset.name.includes("Today")) {
      categories[0].presets.push(preset);
    } else if (
      preset.name.toLowerCase().includes("payment") ||
      preset.name.toLowerCase().includes("unpaid") ||
      preset.name.toLowerCase().includes("value")
    ) {
      categories[1].presets.push(preset);
    } else if (
      preset.name.toLowerCase().includes("guest") ||
      preset.name.toLowerCase().includes("vip")
    ) {
      categories[2].presets.push(preset);
    } else if (
      preset.name.toLowerCase().includes("attention") ||
      preset.name.toLowerCase().includes("workflow")
    ) {
      categories[3].presets.push(preset);
    } else if (
      preset.name.toLowerCase().includes("month") ||
      preset.name.toLowerCase().includes("report")
    ) {
      categories[4].presets.push(preset);
    } else {
      categories[5].presets.push(preset);
    }
  }

  return categories.filter((cat) => cat.presets.length > 0);
}

// ============================================
// PRESET VALIDATION
// ============================================

export function validatePreset(preset: Partial<SearchPreset>): string[] {
  const errors: string[] = [];

  if (!preset.name || preset.name.trim().length === 0) {
    errors.push("Preset name is required");
  }

  if (preset.name && preset.name.length > 50) {
    errors.push("Preset name must be 50 characters or less");
  }

  if (preset.description && preset.description.length > 200) {
    errors.push("Description must be 200 characters or less");
  }

  if (preset.filters && !Array.isArray(preset.filters)) {
    errors.push("Filters must be an array");
  }

  if (preset.sortOrder && !["asc", "desc"].includes(preset.sortOrder)) {
    errors.push("Sort order must be 'asc' or 'desc'");
  }

  return errors;
}

// ============================================
// EXPORT UTILITIES
// ============================================

export interface ExportOptions {
  format: "csv" | "json" | "excel" | "pdf";
  fields?: string[];
  includeMetadata?: boolean;
  includeRelations?: boolean;
  dateFormat?: string;
  numberFormat?: string;
  filename?: string;
}

/**
 * Export search results to various formats
 */
export async function exportSearchResults<T>(
  results: SearchResult<T>[],
  options: ExportOptions
): Promise<{ blob: Blob; filename: string }> {
  const {
    format,
    fields = getDefaultFields(results[0]?.item),
    includeMetadata = false,
    includeRelations = false,
    dateFormat = "yyyy-MM-dd",
    filename,
  } = options;

  let content: string | ArrayBuffer;
  let mimeType: string;
  let finalFilename: string;

  switch (format) {
    case "csv":
      content = exportToCSV(results, fields, { includeMetadata, dateFormat });
      mimeType = "text/csv";
      finalFilename = filename || `search-export-${Date.now()}.csv`;
      break;

    case "json":
      content = exportToJSON(results, { includeMetadata, includeRelations });
      mimeType = "application/json";
      finalFilename = filename || `search-export-${Date.now()}.json`;
      break;

    case "excel":
      content = await exportToExcel(results, fields, { includeMetadata, dateFormat });
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      finalFilename = filename || `search-export-${Date.now()}.xlsx`;
      break;

    case "pdf":
      content = await exportToPDF(results, fields, { includeMetadata, dateFormat });
      mimeType = "application/pdf";
      finalFilename = filename || `search-export-${Date.now()}.pdf`;
      break;

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  const blob = new Blob([content], { type: mimeType });
  return { blob, filename: finalFilename };
}

/**
 * Export to CSV format
 */
function exportToCSV<T>(
  results: SearchResult<T>[],
  fields: string[],
  options: { includeMetadata?: boolean; dateFormat?: string }
): string {
  const rows: string[] = [];

  // Header row
  const headers = [...fields];
  if (options.includeMetadata) {
    headers.push("Search Score", "Matched Fields");
  }
  rows.push(headers.map(escapeCSV).join(","));

  // Data rows
  for (const result of results) {
    const values: string[] = [];

    for (const field of fields) {
      const value = getNestedValue(result.item, field);
      values.push(formatCSVValue(value, options.dateFormat));
    }

    if (options.includeMetadata) {
      values.push(result.score.toFixed(3));
      values.push(result.matchedFields.join("; "));
    }

    rows.push(values.map(escapeCSV).join(","));
  }

  return rows.join("\n");
}

/**
 * Export to JSON format
 */
function exportToJSON<T>(
  results: SearchResult<T>[],
  options: { includeMetadata?: boolean; includeRelations?: boolean }
): string {
  const data = results.map((result) => {
    if (options.includeMetadata) {
      return {
        ...result.item,
        _metadata: {
          score: result.score,
          matchedFields: result.matchedFields,
          highlights: result.highlights,
          type: result.type,
        },
      };
    }
    return result.item;
  });

  return JSON.stringify(data, null, 2);
}

/**
 * Export to Excel format (simplified - would need a library like xlsx)
 */
async function exportToExcel<T>(
  results: SearchResult<T>[],
  fields: string[],
  options: { includeMetadata?: boolean; dateFormat?: string }
): Promise<ArrayBuffer> {
  // This is a placeholder - in production, use a library like xlsx
  console.warn("Excel export requires additional library implementation");

  // For now, return CSV data that Excel can open
  const csvContent = exportToCSV(results, fields, options);
  return new TextEncoder().encode(csvContent);
}

/**
 * Export to PDF format (simplified - would need a library like jsPDF)
 */
async function exportToPDF<T>(
  results: SearchResult<T>[],
  fields: string[],
  options: { includeMetadata?: boolean; dateFormat?: string }
): Promise<ArrayBuffer> {
  // This is a placeholder - in production, use a library like jsPDF
  console.warn("PDF export requires additional library implementation");

  // For now, return a simple text representation
  const textContent = exportToText(results, fields, options);
  return new TextEncoder().encode(textContent);
}

/**
 * Export to plain text format
 */
function exportToText<T>(
  results: SearchResult<T>[],
  fields: string[],
  options: { includeMetadata?: boolean; dateFormat?: string }
): string {
  const lines: string[] = [];

  lines.push("Search Results Export");
  lines.push("=".repeat(50));
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Results: ${results.length}`);
  lines.push("");

  for (const [index, result] of results.entries()) {
    lines.push(`--- Result ${index + 1} ---`);

    for (const field of fields) {
      const value = getNestedValue(result.item, field);
      lines.push(`${field}: ${formatTextValue(value, options.dateFormat)}`);
    }

    if (options.includeMetadata) {
      lines.push(`Score: ${result.score.toFixed(3)}`);
      lines.push(`Matched Fields: ${result.matchedFields.join(", ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ============================================
// IMPORT/EXPORT PRESETS
// ============================================

/**
 * Export presets configuration
 */
export function exportPresets(presets: SearchPreset[]): string {
  return JSON.stringify(
    {
      version: "1.0",
      exported: new Date().toISOString(),
      presets: presets.map((preset) => ({
        ...preset,
        id: undefined, // Remove IDs for import
        createdAt: undefined,
        lastUsed: undefined,
        usageCount: 0,
      })),
    },
    null,
    2
  );
}

/**
 * Import presets configuration
 */
export function importPresets(jsonString: string): SearchPreset[] {
  try {
    const data = JSON.parse(jsonString);

    if (!data.version || !data.presets) {
      throw new Error("Invalid preset configuration format");
    }

    return data.presets.map((preset: any) => ({
      ...preset,
      id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    }));
  } catch (error) {
    throw new Error(`Failed to import presets: ${error}`);
  }
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Apply preset to multiple bookings
 */
export async function applyPresetToBatch(
  preset: SearchPreset,
  bookingIds: string[],
  operation: "update" | "export" | "workflow"
): Promise<{
  success: boolean;
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;

  for (const bookingId of bookingIds) {
    try {
      switch (operation) {
        case "update":
          // Apply preset filters as tags or metadata
          // Implementation depends on your backend
          break;

        case "export":
          // Export booking data using preset configuration
          break;

        case "workflow":
          // Trigger workflow action based on preset
          break;
      }

      processed++;
    } catch (error) {
      errors.push(`Failed to process booking ${bookingId}: ${error}`);
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors,
  };
}

// ============================================
// REPORTING UTILITIES
// ============================================

/**
 * Generate search analytics report
 */
export function generateSearchReport(
  presets: SearchPreset[],
  period: { from: Date; to: Date }
): {
  mostUsed: SearchPreset[];
  recentlyUsed: SearchPreset[];
  recommendations: string[];
} {
  // Sort by usage
  const mostUsed = [...presets].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);

  // Sort by last used
  const recentlyUsed = [...presets]
    .filter((p) => p.lastUsed)
    .sort((a, b) => {
      const aDate = new Date(a.lastUsed!).getTime();
      const bDate = new Date(b.lastUsed!).getTime();
      return bDate - aDate;
    })
    .slice(0, 5);

  // Generate recommendations
  const recommendations: string[] = [];

  if (!presets.some((p) => p.name.includes("Today"))) {
    recommendations.push("Consider adding daily operation presets for efficiency");
  }

  if (!presets.some((p) => p.name.includes("Payment"))) {
    recommendations.push("Add payment-focused presets to track financials");
  }

  if (presets.length < 5) {
    recommendations.push("Create more presets to streamline common searches");
  }

  return {
    mostUsed,
    recentlyUsed,
    recommendations,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDefaultFields(item: any): string[] {
  if (!item) return [];

  const fields: string[] = [];
  for (const key in item) {
    if (typeof item[key] !== "object" || item[key] === null) {
      fields.push(key);
    }
  }

  return fields;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCSVValue(value: any, dateFormat?: string): string {
  if (value == null) return "";

  if (value instanceof Date) {
    return format(value, dateFormat || "yyyy-MM-dd");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatTextValue(value: any, dateFormat?: string): string {
  if (value == null) return "N/A";

  if (value instanceof Date) {
    return format(value, dateFormat || "yyyy-MM-dd HH:mm");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Download blob as file
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
