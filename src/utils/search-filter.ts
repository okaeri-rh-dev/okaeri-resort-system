/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
/**
 * Advanced Search and Filter Utilities - PHASE 3-4
 *
 * Provides comprehensive search functionality with:
 * - Fuzzy matching and typo tolerance
 * - Multi-field weighted search
 * - Complex filter compositions
 * - Performance-optimized search algorithms
 * - Result highlighting and scoring
 *
 * Note: Advanced features deferred to Phase 3-4
 */

import type {
  AdvancedFilter,
  SearchField,
  SearchResult,
  WorkflowFilter,
} from "@/stores/useSearchStore";
import type { Booking, Guest, PaymentStatus, Unit } from "@/types";

// ============================================
// FUZZY MATCHING & TYPO TOLERANCE
// ============================================

/**
 * Calculate Levenshtein distance between two strings
 * Used for typo tolerance and fuzzy matching
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
export function stringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Fuzzy match with configurable threshold
 */
export function fuzzyMatch(query: string, text: string, threshold: number = 0.6): boolean {
  if (!query || !text) return false;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match
  if (textLower.includes(queryLower)) return true;

  // Check each word in the text
  const words = textLower.split(/\s+/);
  for (const word of words) {
    if (stringSimilarity(queryLower, word) >= threshold) {
      return true;
    }
  }

  // Check if query matches beginning of any word
  for (const word of words) {
    if (word.startsWith(queryLower.slice(0, Math.min(3, queryLower.length)))) {
      return true;
    }
  }

  return false;
}

/**
 * Advanced fuzzy search with multiple fields and weights
 */
export function fuzzySearchScore(
  query: string,
  item: any,
  fields: SearchField[],
  typoTolerance: number = 0.3
): number {
  if (!query) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  for (const field of fields) {
    const value = getNestedValue(item, field.name);
    if (value == null) continue;

    const stringValue = String(value);
    let fieldScore = 0;

    // Calculate field-specific score
    switch (field.type) {
      case "email":
        fieldScore = emailMatchScore(query, stringValue);
        break;
      case "reference":
        fieldScore = referenceMatchScore(query, stringValue);
        break;
      case "numeric":
        fieldScore = numericMatchScore(query, stringValue);
        break;
      default:
        fieldScore = textMatchScore(query, stringValue, typoTolerance);
    }

    totalScore += fieldScore * field.weight;
    totalWeight += field.weight;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Email-specific matching
 */
function emailMatchScore(query: string, email: string): number {
  const emailLower = email.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match
  if (emailLower === queryLower) return 1;

  // Username match
  const username = emailLower.split("@")[0];
  if (username === queryLower) return 0.9;
  if (username.includes(queryLower)) return 0.7;

  // Fuzzy match on username
  return stringSimilarity(queryLower, username) * 0.5;
}

/**
 * Reference number matching (e.g., booking references)
 */
function referenceMatchScore(query: string, reference: string): number {
  const refLower = reference.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match
  if (refLower === queryLower) return 1;

  // Starts with query
  if (refLower.startsWith(queryLower)) return 0.8;

  // Contains query
  if (refLower.includes(queryLower)) return 0.6;

  // No fuzzy matching for references
  return 0;
}

/**
 * Numeric matching
 */
function numericMatchScore(query: string, value: string): number {
  // Remove non-numeric characters for comparison
  const cleanQuery = query.replace(/\D/g, "");
  const cleanValue = value.replace(/\D/g, "");

  if (!cleanQuery || !cleanValue) return 0;

  // Exact match
  if (cleanValue === cleanQuery) return 1;

  // Starts with query
  if (cleanValue.startsWith(cleanQuery)) return 0.7;

  // Contains query
  if (cleanValue.includes(cleanQuery)) return 0.5;

  return 0;
}

/**
 * General text matching with typo tolerance
 */
function textMatchScore(query: string, text: string, typoTolerance: number): number {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match
  if (textLower === queryLower) return 1;

  // Contains exact query
  if (textLower.includes(queryLower)) return 0.8;

  // Word-by-word matching
  const queryWords = queryLower.split(/\s+/);
  const textWords = textLower.split(/\s+/);

  let matchedWords = 0;
  for (const queryWord of queryWords) {
    for (const textWord of textWords) {
      const similarity = stringSimilarity(queryWord, textWord);
      if (similarity >= 1 - typoTolerance) {
        matchedWords++;
        break;
      }
    }
  }

  if (matchedWords > 0) {
    return 0.6 * (matchedWords / queryWords.length);
  }

  // Overall similarity
  return stringSimilarity(queryLower, textLower) * 0.4;
}

// ============================================
// ADVANCED FILTERING
// ============================================

/**
 * Apply complex filters to bookings
 */
export function applyBookingFilters(
  bookings: Booking[],
  filters: AdvancedFilter[],
  dateRangeFilter?: {
    field: string;
    from: Date | null;
    to: Date | null;
  },
  workflowFilter?: WorkflowFilter,
  financialFilter?: {
    minAmount?: number;
    maxAmount?: number;
    paymentStatus?: PaymentStatus[];
    paymentMethods?: string[];
    hasOverdue: boolean;
  }
): Booking[] {
  return bookings.filter((booking) => {
    // Date range filter
    if (dateRangeFilter?.from || dateRangeFilter?.to) {
      const dateField = getNestedValue(booking, dateRangeFilter.field);
      if (dateField) {
        const date = new Date(dateField);
        if (dateRangeFilter.from && date < dateRangeFilter.from) return false;
        if (dateRangeFilter.to && date > dateRangeFilter.to) return false;
      }
    }

    // Financial filter
    if (financialFilter) {
      if (financialFilter.minAmount != null && booking.total_amount < financialFilter.minAmount) {
        return false;
      }
      if (financialFilter.maxAmount != null && booking.total_amount > financialFilter.maxAmount) {
        return false;
      }
      if (
        financialFilter.paymentStatus?.length &&
        !financialFilter.paymentStatus.includes(booking.payment_status)
      ) {
        return false;
      }
      if (
        financialFilter.paymentMethods?.length &&
        (!booking.payment_method ||
          !financialFilter.paymentMethods.includes(booking.payment_method))
      ) {
        return false;
      }
      if (financialFilter.hasOverdue) {
        const checkIn = new Date(booking.check_in);
        const now = new Date();
        if (booking.payment_status !== "Completed" && checkIn <= now) {
          // This booking is overdue, include it
        } else {
          return false;
        }
      }
    }

    // Workflow filter
    if (workflowFilter) {
      // This would integrate with the workflow state
      // For now, apply basic status filtering
      if (workflowFilter.overdueActions) {
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        const now = new Date();

        if (booking.booking_status === "Confirmed" && checkIn < now) {
          // Overdue check-in
        } else if (booking.booking_status === "CheckedIn" && checkOut < now) {
          // Overdue check-out
        } else {
          return false;
        }
      }
    }

    // Apply custom filters
    for (const filter of filters) {
      if (!filter.isActive) continue;

      const fieldValue = getNestedValue(booking, filter.name);
      if (!evaluateFilter(fieldValue, filter.operator, filter.value)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Evaluate a single filter condition
 */
function evaluateFilter(fieldValue: any, operator: string, filterValue: any): boolean {
  switch (operator) {
    case "equals":
      return fieldValue === filterValue;
    case "contains":
      return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
    case "between":
      return fieldValue >= filterValue[0] && fieldValue <= filterValue[1];
    case "in":
      return Array.isArray(filterValue) && filterValue.includes(fieldValue);
    case "not_in":
      return Array.isArray(filterValue) && !filterValue.includes(fieldValue);
    case "greater_than":
      return fieldValue > filterValue;
    case "less_than":
      return fieldValue < filterValue;
    default:
      return true;
  }
}

// ============================================
// SEARCH RESULT PROCESSING
// ============================================

/**
 * Highlight matching text in search results
 */
export function highlightMatches(text: string, query: string): string {
  if (!query || !text) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

/**
 * Extract snippets around matched text
 */
export function extractSnippets(text: string, query: string, contextLength: number = 50): string[] {
  if (!query || !text) return [];

  const snippets: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let index = 0;
  while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + query.length + contextLength);
    const snippet = text.substring(start, end);

    snippets.push((start > 0 ? "..." : "") + snippet + (end < text.length ? "..." : ""));

    index += query.length;
  }

  return snippets;
}

/**
 * Process search results with scoring and highlighting
 */
export function processSearchResults<T>(
  items: T[],
  query: string,
  fields: SearchField[],
  options: {
    fuzzyMatch?: boolean;
    typoTolerance?: number;
    highlightResults?: boolean;
    maxResults?: number;
    minScore?: number;
  } = {}
): SearchResult<T>[] {
  const {
    fuzzyMatch = true,
    typoTolerance = 0.3,
    highlightResults = true,
    maxResults = 100,
    minScore = 0.1,
  } = options;

  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const score = fuzzyMatch
      ? fuzzySearchScore(query, item, fields, typoTolerance)
      : exactSearchScore(query, item, fields);

    if (score >= minScore) {
      const result: SearchResult<T> = {
        item,
        score,
        matchedFields: getMatchedFields(query, item, fields),
        type: detectItemType(item),
      };

      if (highlightResults) {
        result.highlights = getHighlights(query, item, fields);
      }

      results.push(result);
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Limit results
  return results.slice(0, maxResults);
}

/**
 * Exact search scoring (no fuzzy matching)
 */
function exactSearchScore(query: string, item: any, fields: SearchField[]): number {
  if (!query) return 0;

  const queryLower = query.toLowerCase();
  let totalScore = 0;
  let totalWeight = 0;

  for (const field of fields) {
    const value = getNestedValue(item, field.name);
    if (value == null) continue;

    const stringValue = String(value).toLowerCase();
    let fieldScore = 0;

    if (stringValue === queryLower) {
      fieldScore = 1;
    } else if (stringValue.includes(queryLower)) {
      fieldScore = 0.7;
    }

    totalScore += fieldScore * field.weight;
    totalWeight += field.weight;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Get list of fields that matched the query
 */
function getMatchedFields(query: string, item: any, fields: SearchField[]): string[] {
  const matched: string[] = [];
  const queryLower = query.toLowerCase();

  for (const field of fields) {
    const value = getNestedValue(item, field.name);
    if (value != null) {
      const stringValue = String(value).toLowerCase();
      if (stringValue.includes(queryLower) || fuzzyMatch(query, stringValue)) {
        matched.push(field.name);
      }
    }
  }

  return matched;
}

/**
 * Get highlighted snippets for each matched field
 */
function getHighlights(query: string, item: any, fields: SearchField[]): Record<string, string[]> {
  const highlights: Record<string, string[]> = {};

  for (const field of fields) {
    const value = getNestedValue(item, field.name);
    if (value != null) {
      const stringValue = String(value);
      const snippets = extractSnippets(stringValue, query);
      if (snippets.length > 0) {
        highlights[field.name] = snippets;
      }
    }
  }

  return highlights;
}

/**
 * Detect item type based on properties
 */
function detectItemType(item: any): "booking" | "guest" | "unit" {
  if ("booking_id" in item && "booking_reference" in item) {
    return "booking";
  } else if ("guest_id" in item && "total_bookings" in item) {
    return "guest";
  } else if ("unit_id" in item && "unit_type" in item) {
    return "unit";
  }
  return "booking"; // Default
}

// ============================================
// COMPOSITE SEARCH QUERIES
// ============================================

/**
 * Build a composite search query for complex searches
 */
export interface CompositeQuery {
  text?: string;
  filters: AdvancedFilter[];
  dateRanges: Array<{
    field: string;
    from?: Date;
    to?: Date;
  }>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Execute composite search across multiple data types
 */
// @ts-expect-error Advanced search functionality - Phase 3
export async function executeCompositeSearch(
  query: CompositeQuery,
  options: {
    searchBookings?: boolean;
    searchGuests?: boolean;
    searchUnits?: boolean;
  } = { searchBookings: true, searchGuests: true, searchUnits: true }
): Promise<{
  bookings: SearchResult<Booking>[];
  guests: SearchResult<Guest>[];
  units: SearchResult<Unit>[];
}> {
  // This would integrate with your actual data fetching
  // For now, return empty results
  return {
    bookings: [],
    guests: [],
    units: [],
  };
}

// ============================================
// SEARCH SUGGESTIONS & AUTOCOMPLETE
// ============================================

/**
 * Generate search suggestions based on partial input
 */
export function generateSuggestions(
  partial: string,
  history: string[],
  popularSearches: Map<string, number>,
  maxSuggestions: number = 10
): string[] {
  const suggestions: Array<{ text: string; score: number }> = [];
  const partialLower = partial.toLowerCase();

  // Add matches from history
  for (const search of history) {
    if (search.toLowerCase().startsWith(partialLower)) {
      suggestions.push({
        text: search,
        score: 0.8,
      });
    } else if (fuzzyMatch(partial, search, 0.7)) {
      suggestions.push({
        text: search,
        score: 0.5,
      });
    }
  }

  // Add popular searches
  popularSearches.forEach((count, search) => {
    if (search.toLowerCase().startsWith(partialLower)) {
      suggestions.push({
        text: search,
        score: 0.7 + Math.min(count / 100, 0.3), // Boost by popularity
      });
    }
  });

  // Remove duplicates and sort by score
  const uniqueSuggestions = Array.from(new Map(suggestions.map((s) => [s.text, s])).values());

  uniqueSuggestions.sort((a, b) => b.score - a.score);

  return uniqueSuggestions.slice(0, maxSuggestions).map((s) => s.text);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get nested value from object using dot notation
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * Throttle function for scroll-based search
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Export search results to CSV
 */
export function exportSearchResultsToCSV<T>(results: SearchResult<T>[], fields: string[]): string {
  const headers = fields.join(",");
  const rows = results.map((result) => {
    return fields
      .map((field) => {
        const value = getNestedValue(result.item, field);
        // Escape CSV values
        const stringValue = String(value ?? "");
        return stringValue.includes(",") || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      })
      .join(",");
  });

  return [headers, ...rows].join("\n");
}

/**
 * Export search results to JSON
 */
export function exportSearchResultsToJSON<T>(
  results: SearchResult<T>[],
  includeMetadata: boolean = false
): string {
  const data = includeMetadata ? results : results.map((r) => r.item);

  return JSON.stringify(data, null, 2);
}

/**
 * Generate search analytics report
 */
export function generateSearchAnalytics(
  metrics: {
    totalSearches: number;
    averageResponseTime: number;
    cacheHitRate: number;
    popularSearches: Map<string, number>;
    searchErrors: number;
  },
  period: { from: Date; to: Date }
): {
  summary: string;
  topSearches: Array<{ query: string; count: number }>;
  performance: {
    avgResponseTime: string;
    cacheEfficiency: string;
    errorRate: string;
  };
} {
  const topSearches = Array.from(metrics.popularSearches.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  return {
    summary: `Search Analytics Report (${period.from.toLocaleDateString()} - ${period.to.toLocaleDateString()})`,
    topSearches,
    performance: {
      avgResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
      cacheEfficiency: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
      errorRate: `${((metrics.searchErrors / metrics.totalSearches) * 100).toFixed(2)}%`,
    },
  };
}
