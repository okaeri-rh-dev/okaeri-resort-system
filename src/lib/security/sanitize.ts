/**
 * XSS Prevention and Data Sanitization Module
 *
 * Provides comprehensive input sanitization using DOMPurify
 * to prevent Cross-Site Scripting (XSS) attacks.
 *
 * @module SecuritySanitization
 */

import DOMPurify from "dompurify";
import { useCallback, useState } from "react";
import type { BookingFormData, Guest } from "@/types";

// ============================================
// CONFIGURATION
// ============================================

/**
 * DOMPurify configuration for strict plain text sanitization
 * Removes ALL HTML tags and attributes
 */
const STRICT_TEXT_CONFIG = {
  ALLOWED_TAGS: [] as string[],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * DOMPurify configuration for rich text content
 * Allows basic formatting tags only with enhanced security
 */
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote"],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
  FORBID_TAGS: ["script", "object", "embed", "form", "input", "button"],
  FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "onmouseout", "onfocus", "onblur"],
};

/**
 * DOMPurify configuration for display names
 * Allows no HTML but preserves special characters in names
 */
const NAME_CONFIG = {
  ALLOWED_TAGS: [] as string[],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
  ALLOWED_URI_REGEXP: /^$/, // No URIs allowed in names
};

// ============================================
// CORE SANITIZATION FUNCTIONS
// ============================================

/**
 * Decodes various encoding schemes that might hide XSS payloads
 */
function decodeEncodedAttacks(input: string): string {
  let decoded = input;

  // HTML entity decoding (&#60; = <, &#62; = >)
  decoded = decoded.replace(/&#(\d+);/g, (_match, dec) => {
    return String.fromCharCode(dec);
  });

  // Hex HTML entities (&#x3C; = <, &#x3E; = >)
  decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // URL encoding (%3C = <, %3E = >)
  try {
    decoded = decodeURIComponent(decoded);
  } catch (e) {
    // If decoding fails, continue with original
  }

  // Unicode escapes (\u003C = <)
  decoded = decoded.replace(/\\u([0-9A-Fa-f]{4})/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Double URL encoding
  try {
    const doubleDecoded = decodeURIComponent(decodeURIComponent(decoded));
    if (doubleDecoded !== decoded) {
      decoded = doubleDecoded;
    }
  } catch (e) {
    // If double decoding fails, continue
  }

  return decoded;
}

/**
 * Sanitizes plain text input by removing all HTML tags and scripts
 * Enhanced to handle encoded XSS attacks
 *
 * @param input - Raw text input
 * @returns Sanitized plain text
 *
 * @example
 * sanitizeText('<script>alert("XSS")</script>Hello') // Returns: 'Hello'
 * sanitizeText('&#60;script&#62;alert(1)&#60;/script&#62;') // Returns: ''
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return "";

  // First: Decode any encoded attacks to reveal hidden payloads
  const decodedInput = decodeEncodedAttacks(String(input));

  // Second: Remove dangerous content INCLUDING text inside script/style tags
  // This is more aggressive than DOMPurify's KEEP_CONTENT approach
  let preCleaned = decodedInput
    .replace(/<script[^>]*>.*?<\/script>/gis, "") // Remove script tags AND content
    .replace(/<style[^>]*>.*?<\/style>/gis, "") // Remove style tags AND content
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, "") // Remove iframe tags AND content
    .replace(/<object[^>]*>.*?<\/object>/gis, "") // Remove object tags AND content
    .replace(/<embed[^>]*>.*?<\/embed>/gis, ""); // Remove embed tags AND content

  // Third: Check if remaining input has HTML
  const hasHtml = /<|>/.test(preCleaned);
  let cleaned: string;

  if (hasHtml) {
    // Has HTML - use DOMPurify to strip remaining tags
    cleaned = DOMPurify.sanitize(preCleaned, STRICT_TEXT_CONFIG);
  } else {
    // Plain text - no HTML to sanitize
    cleaned = preCleaned;
  }

  // Fourth: Decode HTML entities that DOMPurify may have created
  // DOMPurify converts <script> to &lt;script&gt; to prevent execution
  // We want plain text, so manually decode common entities
  // (More reliable than innerHTML + textContent across environments)
  const decoded = cleaned
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&"); // Must be last to avoid double-decoding

  // Fifth: Additional cleanup for extra safety
  // Remove any remaining HTML tags and dangerous protocols
  const result = decoded
    .replace(/<[^>]*>/g, "") // Remove any remaining HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/vbscript:/gi, "") // Remove vbscript: protocol
    .replace(/data:text\/html/gi, "") // Remove data:text/html protocol
    .trim() // Remove leading/trailing whitespace
    .substring(0, 10000); // Limit length to prevent DoS

  return result;
}

/**
 * Sanitizes rich text content, allowing only safe formatting tags
 * Enhanced to handle encoded XSS attacks
 *
 * @param input - HTML content with formatting
 * @returns Sanitized HTML with only allowed tags
 *
 * @example
 * sanitizeRichText('<p>Hello <script>alert("XSS")</script></p>')
 * // Returns: '<p>Hello </p>'
 */
export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";

  // First: Decode any encoded attacks to reveal hidden payloads
  const decodedInput = decodeEncodedAttacks(String(input));

  // Second: More aggressive pre-cleaning to remove dangerous elements
  const preCleaned = decodedInput
    .replace(/<script[^>]*>.*?<\/script>/gis, "") // Remove script tags and content
    .replace(/<iframe[^>]*>.*?<\/iframe>/gis, "") // Remove iframe tags
    .replace(/<object[^>]*>.*?<\/object>/gis, "") // Remove object tags
    .replace(/<embed[^>]*>/gis, "") // Remove embed tags
    .replace(/<form[^>]*>.*?<\/form>/gis, "") // Remove form tags
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "") // Remove all event handlers
    .replace(/on\w+\s*=\s*[^"'\s>]+/gi, ""); // Remove unquoted event handlers

  // Third: Sanitize with DOMPurify
  let result = DOMPurify.sanitize(preCleaned, RICH_TEXT_CONFIG);

  // Fourth: Final cleanup
  result = result
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/vbscript:/gi, "") // Remove vbscript: protocol
    .replace(/data:/gi, "") // Remove data: protocol
    .replace(/expression\s*\(/gi, "") // Remove CSS expression
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/(<[^>]+)\s+>/g, "$1>") // Remove trailing spaces in tags
    .trim()
    .substring(0, 50000); // Limit rich text to 50k chars

  return result;
}

/**
 * Sanitizes and validates URLs to prevent javascript: and data: protocols
 *
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 *
 * @example
 * sanitizeUrl('javascript:alert("XSS")') // Returns: ''
 * sanitizeUrl('https://example.com') // Returns: 'https://example.com'
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return "";

  // Remove all HTML first
  const cleaned = String(DOMPurify.sanitize(url, STRICT_TEXT_CONFIG)).trim();

  // Validate URL protocol
  try {
    const urlObj = new URL(cleaned, window.location.origin);

    // Only allow http(s) and relative URLs
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return "";
    }

    // Additional validation for suspicious patterns
    const suspicious = [
      "javascript:",
      "data:",
      "vbscript:",
      "file:",
      "about:",
      "<script",
      "onclick",
      "onerror",
      "onload",
    ];

    const lowerUrl = urlObj.toString().toLowerCase();
    if (suspicious.some((pattern) => lowerUrl.includes(pattern))) {
      return "";
    }

    return urlObj.toString();
  } catch {
    // If not a valid absolute URL, check if it's a safe relative path
    if (cleaned.startsWith("/") && !cleaned.includes("//")) {
      // Remove any query params that might contain XSS
      const pathOnly = cleaned.split("?")[0].split("#")[0];
      return sanitizeText(pathOnly);
    }
    return "";
  }
}

/**
 * Sanitizes email addresses
 *
 * @param email - Email to sanitize
 * @returns Sanitized email
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email) return "";

  const cleaned = sanitizeText(email).toLowerCase().trim();

  // Basic email validation pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailPattern.test(cleaned) ? cleaned : "";
}

/**
 * Sanitizes phone numbers, preserving only digits and basic formatting
 *
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone number
 */
export function sanitizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";

  // Remove all HTML first
  const cleaned = sanitizeText(phone);

  // Keep only digits, spaces, hyphens, parentheses, and plus sign
  return cleaned.replace(/[^0-9\s\-()+ ]/g, "").substring(0, 30);
}

/**
 * Sanitizes names, allowing Unicode characters for international names
 *
 * @param name - Name to sanitize
 * @returns Sanitized name
 */
export function sanitizeName(name: string | null | undefined): string {
  if (!name) return "";

  // Use special config for names to preserve special characters
  const cleaned = String(DOMPurify.sanitize(name, NAME_CONFIG)).trim();

  // Remove any remaining suspicious patterns
  return cleaned.replace(/[<>\"]/g, "").substring(0, 100); // Reasonable name length limit
}

// ============================================
// FORM DATA SANITIZATION
// ============================================

/**
 * Sanitizes an entire form data object based on field types
 *
 * @param data - Form data object
 * @param config - Configuration for special field handling
 * @returns Sanitized form data
 */
export function sanitizeFormData<T extends Record<string, any>>(
  data: T,
  config: {
    richTextFields?: string[];
    urlFields?: string[];
    emailFields?: string[];
    phoneFields?: string[];
    nameFields?: string[];
    skipFields?: string[];
  } = {}
): T {
  const {
    richTextFields = [],
    urlFields = [],
    emailFields = [],
    phoneFields = [],
    nameFields = [],
    skipFields = [],
  } = config;

  const sanitized: Record<string, any> = {};

  Object.entries(data).forEach(([key, value]) => {
    // Skip specified fields
    if (skipFields.includes(key)) {
      sanitized[key] = value;
      return;
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      sanitized[key] = value;
      return;
    }

    // Handle strings
    if (typeof value === "string") {
      // Determine sanitization type based on field name or config
      if (richTextFields.includes(key)) {
        sanitized[key] = sanitizeRichText(value);
      } else if (urlFields.includes(key) || key.toLowerCase().includes("url")) {
        sanitized[key] = sanitizeUrl(value);
      } else if (emailFields.includes(key) || key.toLowerCase().includes("email")) {
        sanitized[key] = sanitizeEmail(value);
      } else if (
        phoneFields.includes(key) ||
        key.toLowerCase().includes("phone") ||
        key.toLowerCase().includes("contact")
      ) {
        sanitized[key] = sanitizePhoneNumber(value);
      } else if (nameFields.includes(key) || key.toLowerCase().includes("name")) {
        sanitized[key] = sanitizeName(value);
      } else {
        // Default to strict text sanitization
        sanitized[key] = sanitizeText(value);
      }
    }
    // Handle nested objects recursively
    else if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeFormData(value, config);
    }
    // Handle arrays of strings
    else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => {
        if (typeof item === "string") {
          return sanitizeText(item);
        }
        return item;
      });
    }
    // Pass through other types unchanged
    else {
      sanitized[key] = value;
    }
  });

  return sanitized as T;
}

// ============================================
// REACT HOOKS
// ============================================

/**
 * React hook for sanitized input handling
 *
 * @param initialValue - Initial input value
 * @param sanitizer - Sanitization function to use
 * @returns Tuple of [value, setValue, sanitizedValue]
 *
 * @example
 * const [email, setEmail, sanitizedEmail] = useSanitizedInput('', sanitizeEmail);
 */
export function useSanitizedInput(
  initialValue = "",
  sanitizer: (value: string) => string = sanitizeText
): [string, (value: string) => void, string] {
  const [value, setValue] = useState(initialValue);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue); // Store raw value for display
  }, []);

  const sanitizedValue = sanitizer(value);

  return [value, handleChange, sanitizedValue];
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Checks if input contains potentially dangerous content
 *
 * @param input - Input to check
 * @returns True if input appears to contain XSS attempts
 */
export function containsSuspiciousContent(input: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /<iframe/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /<embed/i,
    /<object/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Sanitizes and validates a complete booking form submission
 *
 * @param formData - Raw booking form data
 * @returns Sanitized booking form data
 */
export function sanitizeBookingFormData(formData: Partial<BookingFormData>) {
  return sanitizeFormData(formData, {
    richTextFields: ["special_requests", "notes"],
    emailFields: ["email", "guest_email"],
    phoneFields: ["phone_number", "contact_number"],
    nameFields: ["guest_name", "first_name", "last_name"],
    skipFields: ["check_in", "check_out", "total_amount", "num_guests", "unit_id"],
  });
}

// ============================================
// EXPORT VALIDATION WRAPPERS
// ============================================

/**
 * Validates and sanitizes guest information
 * Extends existing validation with XSS protection
 */
export function sanitizeGuestData(guestData: Partial<Guest>) {
  return sanitizeFormData(guestData, {
    emailFields: ["email"],
    phoneFields: ["phone_number"],
    nameFields: ["guest_name"],
  });
}

/**
 * Test suite for XSS prevention
 * Use in development to verify sanitization
 */
export const XSS_TEST_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  '<svg onload=alert("XSS")>',
  '"><script>alert("XSS")</script>',
  '<iframe src=javascript:alert("XSS")>',
  '<body onload=alert("XSS")>',
  '<<SCRIPT>alert("XSS");//<</SCRIPT>',
  '<IMG """><SCRIPT>alert("XSS")</SCRIPT>">',
  '<INPUT TYPE="IMAGE" SRC="javascript:alert(\'XSS\');">',
];
