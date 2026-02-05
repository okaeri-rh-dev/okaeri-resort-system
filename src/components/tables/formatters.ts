/**
 * Table formatting utilities
 * Separated from utils.tsx for React Fast Refresh compatibility
 */

import { format } from "date-fns";

import { utcToResortTime } from "@/utils/date-helpers";

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format Philippine peso currency with proper formatting
 * Shows 2 decimal places to preserve precision (e.g., ₱4,500.50 not ₱4,501)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format percentage with one decimal place
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Format date for dense table display
 */
export const formatTableDate = (dateString: string): string => {
  try {
    const date = utcToResortTime(dateString);
    return format(date, "MMM dd");
  } catch {
    return "Invalid Date";
  }
};

/**
 * Format full date with year
 */
export const formatFullDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, "MMM dd, yyyy");
  } catch {
    return "Invalid Date";
  }
};

/**
 * Format date and time
 */
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, "MMM dd, yyyy HH:mm");
  } catch {
    return "Invalid Date";
  }
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Format Philippine mobile numbers
  if (cleaned.length === 11 && cleaned.startsWith("09")) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  // Return original if not standard format
  return phone;
};

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Legacy export function - Use the enhanced version from @/utils/reports instead
 * This is kept for backward compatibility but should be replaced
 * @deprecated Use exportToCSV from '@/utils/reports' for production
 */
export const exportToCSV = (
  data: Record<string, unknown>[],
  filename: string,
  headers?: string[]
) => {
  // Import the secure, Philippine-compliant version
  import("@/utils/reports")
    .then(({ exportToCSV: secureExport }) => {
      secureExport(data, filename, headers, {
        philippineFormat: true,
        includeTimestamp: true,
        onError: (error) => {
          console.error("CSV Export Error:", error);
          // Fallback to basic export if enhanced version fails
          basicCSVExport(data, filename, headers);
        },
      });
    })
    .catch(() => {
      // Fallback to basic export if import fails
      basicCSVExport(data, filename, headers);
    });
};

/**
 * Basic CSV export fallback - NOT SECURE FOR PRODUCTION
 * Only use as emergency fallback
 */
const basicCSVExport = (data: Record<string, unknown>[], filename: string, headers?: string[]) => {
  const actualHeaders = headers || (data.length > 0 ? Object.keys(data[0]) : []);

  // Security warning for formula injection
  const sanitizeForCSV = (value: unknown): string => {
    if (value == null) return "";
    let str = String(value);

    // SECURITY: Prevent formula injection
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // Escape quotes and wrap in quotes if contains special characters
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    actualHeaders.map(sanitizeForCSV).join(","),
    ...data.map((row) =>
      actualHeaders
        .map((header) => {
          const key = headers ? header.toLowerCase().replace(/\s+/g, "_") : header;
          return sanitizeForCSV(row[key]);
        })
        .join(",")
    ),
  ].join("\n");

  // Add BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
