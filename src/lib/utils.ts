import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// Re-export Common Formatters
// ============================================

// Re-export formatCurrency from tables/formatters for convenience
export { formatCurrency } from "@/components/tables/formatters";

// Re-export formatDate from utils/date-helpers
export { formatDate } from "@/utils/date-helpers";

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 *
 * @param date - Date string or Date object
 * @returns Human-readable relative time
 *
 * @example
 * formatRelativeTime('2025-10-28T10:00:00Z')
 * // Returns: "2 hours ago"
 */
export function formatRelativeTime(date: string | Date): string {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return "Invalid date";
  }
}
