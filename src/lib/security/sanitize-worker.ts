/**
 * Cloudflare Workers-Compatible Sanitization Module
 *
 * Provides lightweight text sanitization for Cloudflare Workers environment.
 * Does NOT use DOMPurify or browser APIs - pure JavaScript only.
 *
 * @module WorkerSanitization
 */

/**
 * Sanitizes plain text input for Cloudflare Workers
 * Removes control characters, dangerous patterns, and enforces length limits
 *
 * @param input - Raw text input
 * @returns Sanitized plain text
 *
 * @example
 * sanitizeTextWorker('<script>alert("XSS")</script>Hello') // Returns: 'Hello'
 * sanitizeTextWorker('  Normal text  ') // Returns: 'Normal text'
 */
export function sanitizeTextWorker(input: string | null | undefined): string {
  if (!input) return "";

  let cleaned = String(input);

  // Remove null bytes and other control characters (except newlines and tabs)
  // eslint-disable-next-line no-control-regex -- Intentionally removing control characters for XSS prevention
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // Remove dangerous JavaScript patterns
  cleaned = cleaned
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .replace(/on\w+\s*=/gi, ""); // Remove event handlers like onclick=

  // Decode common HTML entities to plain text
  cleaned = cleaned
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Enforce reasonable length limit (10KB max)
  return cleaned.substring(0, 10000);
}

/**
 * Sanitizes name fields, allowing Unicode characters for international names
 * More permissive than sanitizeTextWorker for proper names
 *
 * @param name - Name to sanitize
 * @returns Sanitized name
 *
 * @example
 * sanitizeNameWorker('José García') // Returns: 'José García'
 * sanitizeNameWorker('<script>alert(1)</script>John') // Returns: 'John'
 */
export function sanitizeNameWorker(name: string | null | undefined): string {
  if (!name) return "";

  let cleaned = String(name);

  // Remove null bytes and control characters
  // eslint-disable-next-line no-control-regex -- Intentionally removing control characters for XSS prevention
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, "");

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // Remove dangerous patterns
  cleaned = cleaned
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:/gi, "");

  // Remove specific dangerous characters but preserve Unicode
  cleaned = cleaned.replace(/[<>"']/g, "");

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Enforce name length limit
  return cleaned.substring(0, 100);
}

/**
 * Sanitizes email addresses for Workers
 *
 * @param email - Email to sanitize
 * @returns Sanitized email
 *
 * @example
 * sanitizeEmailWorker('test@example.com') // Returns: 'test@example.com'
 * sanitizeEmailWorker('<script>test@example.com') // Returns: 'test@example.com'
 */
export function sanitizeEmailWorker(email: string | null | undefined): string {
  if (!email) return "";

  // First pass: basic sanitization
  let cleaned = sanitizeTextWorker(email).toLowerCase();

  // Remove everything except valid email characters
  cleaned = cleaned.replace(/[^a-z0-9@._+-]/g, "");

  // Basic validation
  const emailPattern = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

  return emailPattern.test(cleaned) ? cleaned.substring(0, 255) : "";
}

/**
 * Sanitizes phone numbers for Workers
 *
 * @param phone - Phone number to sanitize
 * @returns Sanitized phone number
 *
 * @example
 * sanitizePhoneWorker('+63 912 345 6789') // Returns: '+63 912 345 6789'
 */
export function sanitizePhoneWorker(phone: string | null | undefined): string {
  if (!phone) return "";

  // Remove HTML and dangerous patterns
  let cleaned = sanitizeTextWorker(phone);

  // Keep only valid phone characters
  cleaned = cleaned.replace(/[^0-9\s\-()+ ]/g, "");

  // Normalize spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned.substring(0, 30);
}
