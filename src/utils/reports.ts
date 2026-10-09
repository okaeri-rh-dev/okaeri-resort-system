/**
 * Basic reporting utilities for Phase 2
 * Provides occupancy and revenue reports with CSV export functionality
 */

import { format } from "date-fns";

// ============================================
// CSV EXPORT - ENHANCED FOR PHILIPPINE BUSINESS
// ============================================

export interface CSVExportOptions {
  filename?: string;
  includeTimestamp?: boolean;
  customHeaders?: string[];
  philippineFormat?: boolean;
  businessName?: string;
  includeMetadata?: boolean;
  maxRows?: number;
  onStart?: () => void;
  onSuccess?: (filename: string) => void;
  onError?: (error: string) => void;
}

export interface CSVExportResult {
  success: boolean;
  filename: string;
  rowsExported: number;
  error?: string;
}

/**
 * Enhanced CSV export function with Philippine business formatting
 * Provides comprehensive security, error handling, and mobile-friendly UX
 */
export async function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  customHeaders?: string[],
  options: CSVExportOptions = {}
): Promise<CSVExportResult> {
  const {
    includeTimestamp = true,
    philippineFormat = true,
    maxRows = 10000,
    onStart,
    onSuccess,
    onError,
  } = options;

  try {
    // Trigger start callback
    onStart?.();

    // Validate input
    if (!data || data.length === 0) {
      const error = "No data to export";
      onError?.(error);
      return { success: false, filename: "", rowsExported: 0, error };
    }

    // Limit rows for performance
    const exportData = data.slice(0, maxRows);
    if (data.length > maxRows) {
      console.warn(`Export limited to ${maxRows} rows for performance`);
    }

    // Security: Sanitize filename to prevent path traversal
    const safeFilename = sanitizeFilename(filename, includeTimestamp);

    // Get headers from first object or use custom headers
    const headers = customHeaders || Object.keys(exportData[0]);

    // Generate CSV content with Philippine formatting
    const csvContent = [
      headers.join(","),
      ...exportData.map((row) =>
        headers
          .map((header) => {
            const key = customHeaders ? header.toLowerCase().replace(/\s+/g, "_") : header;
            const value = row[key];
            return formatCSVCell(value, philippineFormat);
          })
          .join(",")
      ),
    ].join("\n");

    // Add BOM for proper UTF-8 encoding in Excel
    const BOM = "\uFEFF";
    const csvWithBOM = BOM + csvContent;

    // Create and download file
    await downloadCSVFile(csvWithBOM, safeFilename);

    // Trigger success callback
    onSuccess?.(safeFilename);

    return {
      success: true,
      filename: safeFilename,
      rowsExported: exportData.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown export error";
    onError?.(errorMessage);
    return {
      success: false,
      filename: "",
      rowsExported: 0,
      error: errorMessage,
    };
  }
}

/**
 * Format individual CSV cell with Philippine business standards
 */
function formatCSVCell(value: unknown, philippineFormat: boolean = true): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return "";
  }

  let cellValue = value;

  // Philippine formatting
  if (philippineFormat) {
    // Format currency values
    if (typeof value === "number" && value > 0) {
      // Check if this looks like a currency value (based on context)
      if (value >= 100 && value <= 1000000) {
        cellValue = `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }

    // Format dates
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        cellValue = date.toLocaleDateString("en-PH", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        });
      } catch {
        // Keep original value if date parsing fails
      }
    }

    // Format Philippine phone numbers
    if (typeof value === "string" && /^(09|\+639)\d{9}$/.test(value.replace(/\s/g, ""))) {
      const cleaned = value.replace(/\D/g, "");
      if (cleaned.length === 11 && cleaned.startsWith("09")) {
        cellValue = `+63${cleaned.substring(1)}`;
      } else if (cleaned.length === 12 && cleaned.startsWith("639")) {
        cellValue = `+${cleaned}`;
      }
    }
  }

  // Convert to string for processing
  let stringValue = String(cellValue);

  // Security: Prevent formula injection attacks
  // Check if string starts with =, +, -, @, tab, or carriage return
  if (/^[=+\-@\t\r]/.test(stringValue)) {
    stringValue = "'" + stringValue; // Prefix with single quote to escape formula
  }

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Sanitize filename for security and compatibility
 */
function sanitizeFilename(filename: string, includeTimestamp: boolean = true): string {
  // Remove file extension if present
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  // Replace invalid characters
  let safeName = nameWithoutExt.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Add timestamp if requested
  if (includeTimestamp) {
    const timestamp = format(new Date(), "yyyy-MM-dd_HHmm");
    safeName = `${safeName}_${timestamp}`;
  }

  // Ensure filename is not too long
  if (safeName.length > 100) {
    safeName = safeName.substring(0, 100);
  }

  return `${safeName}.csv`;
}

/**
 * Download CSV file with proper browser compatibility
 */
async function downloadCSVFile(csvContent: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create blob with proper MIME type
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      // Modern browsers
      if (navigator.userAgent.includes("Chrome") || navigator.userAgent.includes("Firefox")) {
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up object URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 100);
        resolve();
      }
      // Fallback for other browsers
      else {
        const url = URL.createObjectURL(blob);
        const newWindow = window.open(url, "_blank");

        if (!newWindow) {
          throw new Error("Popup blocked - please allow popups and try again");
        }

        setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve();
        }, 1000);
      }
    } catch (error) {
      reject(error);
    }
  });
}
