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
  if (!phone) return "";
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Format Philippine mobile numbers
  if (cleaned.length === 11 && cleaned.startsWith("09")) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  // Return original if not standard format
  return phone;
};
