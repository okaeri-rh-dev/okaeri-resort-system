/**
 * Password hashing and verification utilities using bcrypt
 * Implements secure password handling for the authentication system
 */

import bcrypt from "bcryptjs";

// Security constants
const SALT_ROUNDS = 12; // Cost factor for bcrypt (recommended: 10-12)
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// Password complexity regex patterns
const PASSWORD_PATTERNS = {
  // At least one uppercase letter
  uppercase: /[A-Z]/,
  // At least one lowercase letter
  lowercase: /[a-z]/,
  // At least one digit
  digit: /\d/,
  // At least one special character
  special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
} as const;

/**
 * Password validation result
 */
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength: "weak" | "medium" | "strong" | "very-strong";
  score: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required and must be a string");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Failed to hash password");
  }
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

/**
 * Validate password strength and complexity
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  let score = 0;

  // Check minimum length
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  } else {
    score += 1;
  }

  // Check maximum length
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters`);
  }

  // Check for uppercase letters
  if (!PASSWORD_PATTERNS.uppercase.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  } else {
    score += 1;
  }

  // Check for lowercase letters
  if (!PASSWORD_PATTERNS.lowercase.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  } else {
    score += 1;
  }

  // Check for digits
  if (!PASSWORD_PATTERNS.digit.test(password)) {
    errors.push("Password must contain at least one number");
  } else {
    score += 1;
  }

  // Check for special characters
  if (!PASSWORD_PATTERNS.special.test(password)) {
    errors.push("Password must contain at least one special character");
  } else {
    score += 1;
  }

  // Additional score for length
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Determine strength
  let strength: PasswordValidation["strength"];
  if (score <= 2) {
    strength = "weak";
  } else if (score <= 4) {
    strength = "medium";
  } else if (score <= 6) {
    strength = "strong";
  } else {
    strength = "very-strong";
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    score,
  };
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  if (length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password length must be at least ${MIN_PASSWORD_LENGTH}`);
  }

  if (length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password length must not exceed ${MAX_PASSWORD_LENGTH}`);
  }

  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = uppercase + lowercase + digits + special;

  let password = "";

  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Check if password has been compromised (using Have I Been Pwned API)
 * Note: This sends a partial hash to the API, not the actual password
 */
export async function checkPasswordCompromised(password: string): Promise<boolean> {
  try {
    // Create SHA-1 hash of the password
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Send first 5 characters to HIBP API
    const prefix = hashHex.substring(0, 5).toUpperCase();
    const suffix = hashHex.substring(5).toUpperCase();

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        "User-Agent": "Okaeri-Resort-System",
      },
    });

    if (!response.ok) {
      console.error("Failed to check password compromise status");
      return false; // Fail open - don't block if service is down
    }

    const text = await response.text();
    const lines = text.split("\n");

    // Check if our suffix appears in the response
    for (const line of lines) {
      const [hashSuffix] = line.split(":");
      if (hashSuffix === suffix) {
        return true; // Password has been compromised
      }
    }

    return false; // Password is safe
  } catch (error) {
    console.error("Error checking password compromise status:", error);
    return false; // Fail open
  }
}

/**
 * Compare two passwords for equality (timing-safe)
 */
export function comparePasswords(password1: string, password2: string): boolean {
  if (password1.length !== password2.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < password1.length; i++) {
    result |= password1.charCodeAt(i) ^ password2.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Check common weak passwords
 */
export function isWeakPassword(password: string): boolean {
  const weakPasswords = [
    "password",
    "123456",
    "12345678",
    "qwerty",
    "abc123",
    "monkey",
    "1234567",
    "letmein",
    "trustno1",
    "dragon",
    "baseball",
    "111111",
    "iloveyou",
    "master",
    "sunshine",
    "ashley",
    "bailey",
    "passw0rd",
    "shadow",
    "123123",
    "654321",
    "superman",
    "qazwsx",
    "welcome",
    "password1",
    "password123",
    "admin",
    "root",
  ];

  const lowerPassword = password.toLowerCase();
  return weakPasswords.includes(lowerPassword);
}
