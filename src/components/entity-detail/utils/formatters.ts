// src/components/entity-detail/utils/formatters.ts

/**
 * Data formatting utilities for entity detail pages
 *
 * Re-exports the formatters in @/lib/formatters to avoid duplication:
 * - formatCurrency: Philippine peso formatting
 * - formatTableDate: Compact date for tables
 * - formatFullDate: Full date with year
 * - formatDateTime: Date with time
 * - formatPhoneNumber: Philippine mobile number formatting
 * - formatPercentage: Percentage with decimals
 *
 * Adds missing utility:
 * - truncate: Truncate long text with ellipsis
 */

// Re-export the shared formatters
export {
  formatCurrency,
  formatTableDate,
  formatFullDate,
  formatDateTime,
  formatPhoneNumber,
  formatPercentage,
} from "@/lib/formatters";

/**
 * Truncate text with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis or original if within limit
 *
 * @example
 * ```typescript
 * truncate('This is a very long description', 20)
 * // Returns: 'This is a very long...'
 *
 * truncate('Short text', 20)
 * // Returns: 'Short text'
 * ```
 */
export function truncate(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
