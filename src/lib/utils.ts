import { clsx, type ClassValue } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// Re-export Common Formatters
// ============================================

// Re-export formatCurrency from lib/formatters for convenience
export { formatCurrency } from "@/lib/formatters";

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

/**
 * Compact relative time for tight UI (e.g. mobile chrome).
 *
 * Uses single-letter units except months (`mo`) to disambiguate from
 * minutes. Sub-minute renders as `<1m` to match the semantic of
 * date-fns' "less than a minute."
 *
 * @example
 * formatRelativeTimeShort(new Date()) // "<1m"
 * formatRelativeTimeShort(fiveMinutesAgo) // "5m"
 * formatRelativeTimeShort(threeDaysAgo) // "3d"
 */
export function formatRelativeTimeShort(date: string | Date): string {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const seconds = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / 1000));
    if (seconds < 60) return "<1m";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (days < 30) return `${weeks}w`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    const years = Math.floor(days / 365);
    return `${years}y`;
  } catch {
    return "—";
  }
}
