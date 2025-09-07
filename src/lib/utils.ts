import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to combine class names with clsx and tailwind-merge
 * This is the standard utility function used throughout shadcn/ui components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Philippine Peso
 * @param amount - The amount to format
 * @param options - Additional Intl.NumberFormat options
 * @returns Formatted currency string
 *
 * @example
 * formatPHP(1234.56) // "₱1,234.56"
 * formatPHP(1000, { minimumFractionDigits: 0 }) // "₱1,000"
 */
export function formatPHP(amount: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    ...options,
  }).format(amount);
}

/**
 * Format date for Philippine locale
 * @param date - The date to format
 * @param options - Additional Intl.DateTimeFormat options
 * @returns Formatted date string
 *
 * @example
 * formatDatePH(new Date()) // "Jan 15, 2024"
 * formatDatePH(new Date(), { dateStyle: 'full' }) // "Monday, January 15, 2024"
 */
export function formatDatePH(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PH", options).format(dateObj);
}

/**
 * Generate a unique code with prefix and sequence
 * @param prefix - The prefix for the code
 * @param sequence - The sequence number
 * @param padLength - The length to pad the sequence number
 * @returns Generated code string
 *
 * @example
 * generateCode("INV", 1, 6) // "INV-000001"
 * generateCode("EXP-2024", 123, 4) // "EXP-2024-0123"
 */
export function generateCode(prefix: string, sequence: number, padLength: number = 6): string {
  return `${prefix}-${sequence.toString().padStart(padLength, "0")}`;
}

/**
 * Format date and time for Philippine locale
 * @param date - The date to format
 * @param options - Additional Intl.DateTimeFormat options
 * @returns Formatted date and time string
 *
 * @example
 * formatDateTimePH(new Date()) // "Jan 15, 2024, 2:30 PM"
 */
export function formatDateTimePH(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  }
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PH", options).format(dateObj);
}

/**
 * Debounce function to limit the rate of function execution
 * Useful for search inputs, API calls, etc.
 * @param func - The function to debounce
 * @param wait - The delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit the rate of function execution
 * @param func - The function to throttle
 * @param limit - The time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate a random ID string
 * @param length - The length of the ID (default: 8)
 * @returns Random ID string
 */
export function generateId(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Capitalize the first letter of a string
 * @param str - The string to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param value - The value to check
 * @returns True if the value is empty
 */
export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Sleep/delay function for async operations
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a safe URL slug from a string
 * @param str - The string to convert to a slug
 * @returns URL-safe slug
 *
 * @example
 * slugify("Hello World!") // "hello-world"
 * slugify("Resort & Spa") // "resort-spa"
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Clamp a number between min and max values
 * @param num - The number to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped number
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Calculate percentage between two numbers
 * @param value - Current value
 * @param total - Total value
 * @returns Percentage (0-100)
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "absolute";
    textArea.style.left = "-999999px";
    document.body.prepend(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
    } finally {
      textArea.remove();
    }
  }
}

/**
 * Check if we're in a mobile environment
 * @returns True if mobile
 */
export function isMobile(): boolean {
  return window.innerWidth < 768;
}

/**
 * Check if we're in a touch device
 * @returns True if touch device
 */
export function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/**
 * Format file size in human readable format
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 *
 * @example
 * formatFileSize(1024) // "1.00 KB"
 * formatFileSize(1048576, 1) // "1.0 MB"
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
