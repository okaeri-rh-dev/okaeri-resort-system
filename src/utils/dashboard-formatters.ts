/**
 * Dashboard Formatters for Philippine Business Context
 * Phase 4.4 Week 1.2 - Professional Enterprise Dashboard Components
 *
 * Provides standardized formatting functions for financial data display
 * with proper Philippine peso formatting and business-grade precision
 */

import { Money } from "@/lib/money";

export interface PhilippineBusinessFormatOptions {
  compact?: boolean;
  showCurrency?: boolean;
  precision?: number;
  monospace?: boolean;
}

/**
 * Format Philippine Peso currency with business-grade standards
 */
export function formatPhilippinePeso(
  amount: Money | number,
  options: PhilippineBusinessFormatOptions = {}
): string {
  const { compact = false, showCurrency = true, precision = 2, monospace = false } = options;

  let value: number;
  if (amount instanceof Money) {
    value = amount.toNumber();
  } else {
    value = amount;
  }

  // Handle compact formatting (K/M notation)
  if (compact) {
    if (Math.abs(value) >= 1000000) {
      const millions = value / 1000000;
      return `${showCurrency ? "₱" : ""}${millions.toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      const thousands = value / 1000;
      return `${showCurrency ? "₱" : ""}${thousands.toFixed(1)}K`;
    }
  }

  // Standard formatting with Philippine locale
  const formatted = new Intl.NumberFormat("en-PH", {
    style: showCurrency ? "currency" : "decimal",
    currency: "PHP",
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);

  // For non-currency format, add peso symbol manually
  if (!showCurrency && formatted) {
    return formatted;
  }

  // Replace PHP with ₱ for cleaner display
  return formatted.replace("PHP", "₱").replace("₱ ", "₱");
}

/**
 * Format business percentages with proper precision
 */
export function formatPercentage(value: number, precision: number = 1): string {
  return `${value.toFixed(precision)}%`;
}

/**
 * Format business dates in compact format
 */
export function formatBusinessDate(
  date: Date | string,
  format: "compact" | "full" = "compact"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (format === "compact") {
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
    }).format(dateObj);
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateObj);
}

/**
 * Format booking/transaction reference numbers
 */
export function formatBusinessId(id: string, prefix?: string): string {
  if (prefix) {
    return `${prefix}-${id}`;
  }
  return id;
}

/**
 * Format occupancy rate with professional display
 */
export function formatOccupancyRate(
  occupied: number,
  total: number,
  showDetails: boolean = false
): string {
  if (total === 0) return "0%";

  const percentage = (occupied / total) * 100;
  const formatted = formatPercentage(percentage);

  if (showDetails) {
    return `${formatted} (${occupied}/${total})`;
  }

  return formatted;
}

/**
 * Format RevPAR (Revenue per Available Room) with ADR context
 */
export function formatRevPAR(
  revenue: Money | number,
  availableRooms: number,
  adr?: Money | number
): string {
  const totalRevenue = revenue instanceof Money ? revenue.toNumber() : revenue;
  const revpar = availableRooms > 0 ? totalRevenue / availableRooms : 0;

  return formatPhilippinePeso(revpar, { precision: 0 });
}

/**
 * Format tax amounts with BIR compliance context
 */
export function formatTaxAmount(
  amount: Money | number,
  taxType: "VAT" | "EWT" | "OT",
  rate?: number
): string {
  const formatted = formatPhilippinePeso(amount);

  if (rate && taxType === "VAT") {
    return `${formatted} (${rate}%)`;
  }

  return formatted;
}

/**
 * Format payment method displays for Philippine context
 */
export function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    cash: "Cash",
    gcash: "GCash",
    maya: "Maya",
    paymaya: "Maya",
    bank_transfer: "Bank Transfer",
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    check: "Check",
    online_banking: "Online Banking",
  };

  return methods[method.toLowerCase()] || method;
}

/**
 * Format trend indicators with proper visual cues
 */
export function formatTrendIndicator(
  currentValue: number,
  previousValue: number,
  options: { showPercentage?: boolean; showArrow?: boolean } = {}
): {
  percentage: number;
  direction: "up" | "down" | "neutral";
  display: string;
  className: string;
} {
  const { showPercentage = true, showArrow = true } = options;

  if (previousValue === 0) {
    return {
      percentage: 0,
      direction: "neutral",
      display: "N/A",
      className: "text-gray-500",
    };
  }

  const change = currentValue - previousValue;
  const percentage = (change / Math.abs(previousValue)) * 100;

  let direction: "up" | "down" | "neutral" = "neutral";
  let className = "text-gray-500";
  let arrow = "";

  if (change > 0) {
    direction = "up";
    className = "text-green-600";
    arrow = showArrow ? "↗ " : "";
  } else if (change < 0) {
    direction = "down";
    className = "text-red-600";
    arrow = showArrow ? "↘ " : "";
  } else {
    arrow = showArrow ? "→ " : "";
  }

  const percentageText = showPercentage ? `${Math.abs(percentage).toFixed(1)}%` : "";
  const display = `${arrow}${percentageText}`;

  return {
    percentage: Math.abs(percentage),
    direction,
    display,
    className,
  };
}

/**
 * Format large numbers for dashboard displays
 */
export function formatLargeNumber(
  value: number,
  options: { precision?: number; unit?: string } = {}
): string {
  const { precision = 1, unit } = options;

  if (Math.abs(value) >= 1000000000) {
    return `${(value / 1000000000).toFixed(precision)}B${unit || ""}`;
  }
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(precision)}M${unit || ""}`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(precision)}K${unit || ""}`;
  }

  return `${value.toFixed(precision)}${unit || ""}`;
}

/**
 * Get status color classes for enterprise design system
 */
export function getStatusColor(status: "success" | "warning" | "error" | "info" | "neutral"): {
  text: string;
  bg: string;
  border: string;
} {
  const colors = {
    success: {
      text: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    warning: {
      text: "text-yellow-700",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
    },
    error: {
      text: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    info: {
      text: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
    },
    neutral: {
      text: "text-gray-700",
      bg: "bg-gray-50",
      border: "border-gray-200",
    },
  };

  return colors[status];
}

/**
 * Format duration for business operations
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Format file sizes for export operations
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

export default {
  formatPhilippinePeso,
  formatPercentage,
  formatBusinessDate,
  formatBusinessId,
  formatOccupancyRate,
  formatRevPAR,
  formatTaxAmount,
  formatPaymentMethod,
  formatTrendIndicator,
  formatLargeNumber,
  getStatusColor,
  formatDuration,
  formatFileSize,
};
