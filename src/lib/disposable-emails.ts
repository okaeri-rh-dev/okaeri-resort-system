/**
 * Disposable email domain detection
 * Prevents registration with temporary email services
 */

// Common disposable email domains (subset for performance)
// Full list can be loaded from external source in production
const DISPOSABLE_DOMAINS = new Set([
  // Most common disposable email services
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "temp-mail.org",
  "throwaway.email",
  "yopmail.com",
  "tempmail.com",
  "trashmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "mailnesia.com",
  "getairmail.com",
  "33mail.com",
  "tmpmail.org",
  "tmpmail.net",

  // Additional common providers
  "dispostable.com",
  "mailcatch.com",
  "mailnull.com",
  "mytemp.email",
  "nospam.today",
  "sofimail.com",
  "spambox.us",
  "spamgourmet.com",
  "tempemail.net",
  "tempr.email",
  "throwemail.com",
  "tmail.com",
  "tnkmail.com",
  "tormail.org",
  "trash-mail.com",
  "trashmail.net",
  "tutanota.com",

  // Known variations
  "10minutemail.net",
  "10minutemail.org",
  "guerrillamail.biz",
  "guerrillamail.net",
  "guerrillamail.org",
  "mailinator.net",
  "mailinator.org",
  "temp-mail.net",
  "tempmail.net",
  "yopmail.net",
  "yopmail.fr",
]);

// Patterns for dynamic disposable email services
const DISPOSABLE_PATTERNS = [
  /^.*\d{10,}@.*/i, // Emails with long number sequences (common in temp emails)
  /^(temp|tmp|disposable|throwaway|trash|fake|dummy)\d*@/i,
  /@(temp|tmp|disposable|throwaway|trash|fake|dummy)/i,
  /^[a-f0-9]{32}@/i, // MD5-like hashes as email prefix
];

// Cache for external API responses (if using external service)

/**
 * Check if an email domain is disposable
 * @param email - The email address to check
 * @returns Whether the email is from a disposable domain
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1];

  if (!domain) {
    return false;
  }

  // Check static list first (fastest)
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return true;
  }

  // Check patterns
  for (const pattern of DISPOSABLE_PATTERNS) {
    if (pattern.test(email)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate email with disposable check
 * Combines format validation with disposable detection
 */
export function validateEmailWithDisposableCheck(email: string): {
  valid: boolean;
  reason?: string;
} {
  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: "Invalid email format" };
  }

  // Check for + signs (often used for email aliasing)
  if (email.includes("+")) {
    return { valid: false, reason: "Email addresses with + are not allowed" };
  }

  // Check for disposable
  if (isDisposableEmail(email)) {
    return { valid: false, reason: "Disposable email addresses are not allowed" };
  }

  return { valid: true };
}
