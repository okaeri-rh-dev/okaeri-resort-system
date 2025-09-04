/**
 * Password Breach Checker
 * Integrates with HaveIBeenPwned API to check for compromised passwords
 *
 * Implements k-Anonymity model to protect password privacy
 * Required for Philippine Data Privacy Act compliance
 */

import crypto from "crypto";
import { dpaAuditLogger, DPAEventCategory } from "./dpa-audit-logger";

// HaveIBeenPwned API configuration
const HIBP_API_BASE = "https://api.pwnedpasswords.com";
const HIBP_API_TIMEOUT = 5000; // 5 seconds
const CACHE_TTL = 86400000; // 24 hours

// Breach severity levels
export enum BreachSeverity {
  CRITICAL = "critical", // Found in major breaches
  HIGH = "high", // Found in multiple breaches
  MEDIUM = "medium", // Found in some breaches
  LOW = "low", // Found in minor breaches
  NONE = "none", // Not found in breaches
}

// Common password patterns to block
const COMMON_PATTERNS = [
  /^(password|admin|123456|qwerty)/i,
  /^(letmein|welcome|monkey|dragon)/i,
  /^(master|superman|batman|trustno1)/i,
  /^(iloveyou|sunshine|princess|football)/i,
  /(\d)\1{3,}/, // Repeated digits (1111, 2222, etc.)
  /^([a-z])\1{3,}/i, // Repeated letters (aaaa, bbbb, etc.)
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, // Month names
];

// Philippine-specific weak passwords
const PH_WEAK_PASSWORDS = [
  "philippines",
  "manila",
  "mahal",
  "mabuhay",
  "pinoy",
  "pinay",
  "katipunan",
  "bayani",
  "mahalkita",
  "mahalko",
  "asawa",
  "jollibee",
  "sm",
  "ayala",
  "makati",
  "bgc",
  "cebu",
  "davao",
];

export interface BreachCheckResult {
  isBreached: boolean;
  breachCount: number;
  severity: BreachSeverity;
  recommendations: string[];
  checkedAt: Date;
  cached: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0-100
  strength: "very_weak" | "weak" | "fair" | "good" | "strong" | "very_strong";
  hasCommonPattern: boolean;
  hasLocalPattern: boolean;
  suggestions: string[];
  estimatedCrackTime: string;
}

export class PasswordBreachChecker {
  private static instance: PasswordBreachChecker;
  private cache: Map<string, { result: BreachCheckResult; expires: number }> = new Map();
  private requestQueue: Array<{ hash: string; resolve: Function; reject: Function }> = [];
  private isProcessing = false;
  private readonly MAX_CONCURRENT_REQUESTS = 3;

  private constructor() {
    this.startCacheCleanup();
  }

  static getInstance(): PasswordBreachChecker {
    if (!PasswordBreachChecker.instance) {
      PasswordBreachChecker.instance = new PasswordBreachChecker();
    }
    return PasswordBreachChecker.instance;
  }

  /**
   * Check if a password has been breached
   */
  async checkPasswordBreach(
    password: string,
    userId?: string,
    skipCache: boolean = false
  ): Promise<BreachCheckResult> {
    try {
      // Generate SHA-1 hash (required by HIBP API)
      const hash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();

      // Check cache first
      if (!skipCache) {
        const cached = this.getFromCache(hash);
        if (cached) {
          return { ...cached, cached: true };
        }
      }

      // Use k-Anonymity model (send only first 5 chars of hash)
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      // Query HIBP API
      const breachData = await this.queryHIBP(prefix);

      // Check if our hash suffix appears in the results
      const breachInfo = this.findHashInResults(suffix, breachData);

      // Generate result
      const result: BreachCheckResult = {
        isBreached: breachInfo.found,
        breachCount: breachInfo.count,
        severity: this.calculateSeverity(breachInfo.count),
        recommendations: this.generateRecommendations(breachInfo.count, password),
        checkedAt: new Date(),
        cached: false,
      };

      // Cache result
      this.cacheResult(hash, result);

      // Log breach check
      await this.logBreachCheck(userId, result.isBreached, result.severity);

      return result;
    } catch (error) {
      console.error("[Password Breach] Check failed:", error);

      // Return safe default on error
      return {
        isBreached: false,
        breachCount: 0,
        severity: BreachSeverity.NONE,
        recommendations: [
          "Unable to verify password breach status. Please ensure your password is strong.",
        ],
        checkedAt: new Date(),
        cached: false,
      };
    }
  }

  /**
   * Check password strength
   */
  checkPasswordStrength(password: string): PasswordStrengthResult {
    let score = 0;
    const suggestions: string[] = [];

    // Length scoring
    if (password.length >= 20) score += 30;
    else if (password.length >= 16) score += 25;
    else if (password.length >= 12) score += 20;
    else if (password.length >= 10) score += 15;
    else if (password.length >= 8) score += 10;
    else {
      score += 5;
      suggestions.push("Use at least 12 characters for better security");
    }

    // Character diversity
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (hasLower) score += 10;
    else suggestions.push("Include lowercase letters");

    if (hasUpper) score += 10;
    else suggestions.push("Include uppercase letters");

    if (hasDigit) score += 10;
    else suggestions.push("Include numbers");

    if (hasSpecial) score += 15;
    else suggestions.push("Include special characters (!@#$%^&*)");

    // Extra points for mixed characters
    const charTypes = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    if (charTypes === 4) score += 15;
    else if (charTypes === 3) score += 10;

    // Check for common patterns
    const hasCommonPattern = this.hasCommonPattern(password);
    if (hasCommonPattern) {
      score = Math.max(0, score - 30);
      suggestions.push("Avoid common password patterns");
    }

    // Check for local/Philippine patterns
    const hasLocalPattern = this.hasLocalPattern(password);
    if (hasLocalPattern) {
      score = Math.max(0, score - 20);
      suggestions.push("Avoid using common Filipino words or places");
    }

    // Check for sequential characters
    if (this.hasSequentialChars(password)) {
      score = Math.max(0, score - 15);
      suggestions.push("Avoid sequential characters (abc, 123)");
    }

    // Check for repeated characters
    if (this.hasRepeatedChars(password)) {
      score = Math.max(0, score - 10);
      suggestions.push("Avoid repeated characters");
    }

    // Calculate strength level
    let strength: PasswordStrengthResult["strength"];
    if (score >= 90) strength = "very_strong";
    else if (score >= 75) strength = "strong";
    else if (score >= 60) strength = "good";
    else if (score >= 45) strength = "fair";
    else if (score >= 30) strength = "weak";
    else strength = "very_weak";

    // Estimate crack time
    const estimatedCrackTime = this.estimateCrackTime(password, score);

    // Add context-specific suggestions
    if (strength === "weak" || strength === "very_weak") {
      suggestions.unshift("This password is too weak for protecting guest data");
    }

    return {
      score: Math.min(100, score),
      strength,
      hasCommonPattern,
      hasLocalPattern,
      suggestions: suggestions.length > 0 ? suggestions : ["Password meets security requirements"],
      estimatedCrackTime,
    };
  }

  /**
   * Validate password against policy
   */
  async validatePassword(
    password: string,
    userId?: string,
    options: {
      checkBreach?: boolean;
      minStrength?: PasswordStrengthResult["strength"];
      customRules?: Array<(password: string) => boolean | string>;
    } = {}
  ): Promise<{
    isValid: boolean;
    errors: string[];
    strength: PasswordStrengthResult;
    breach?: BreachCheckResult;
  }> {
    const errors: string[] = [];

    // Check basic requirements
    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (password.length > 128) {
      errors.push("Password must not exceed 128 characters");
    }

    // Check password strength
    const strength = this.checkPasswordStrength(password);

    // Check minimum strength requirement
    const minStrength = options.minStrength || "fair";
    const strengthLevels = ["very_weak", "weak", "fair", "good", "strong", "very_strong"];
    const currentLevel = strengthLevels.indexOf(strength.strength);
    const requiredLevel = strengthLevels.indexOf(minStrength);

    if (currentLevel < requiredLevel) {
      errors.push(
        `Password strength must be at least "${minStrength}" (current: "${strength.strength}")`
      );
    }

    // Check for breach if enabled
    let breach: BreachCheckResult | undefined;
    if (options.checkBreach !== false) {
      breach = await this.checkPasswordBreach(password, userId);

      if (breach.isBreached && breach.severity !== BreachSeverity.LOW) {
        errors.push(`This password has been found in ${breach.breachCount} data breaches`);
      }
    }

    // Apply custom rules
    if (options.customRules) {
      for (const rule of options.customRules) {
        const result = rule(password);
        if (typeof result === "string") {
          errors.push(result);
        } else if (result === false) {
          errors.push("Password does not meet custom requirements");
        }
      }
    }

    // Log validation attempt
    await this.logPasswordValidation(userId, errors.length === 0, errors);

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      breach,
    };
  }

  /**
   * Generate secure password
   */
  generateSecurePassword(
    options: {
      length?: number;
      includeSymbols?: boolean;
      includeNumbers?: boolean;
      excludeAmbiguous?: boolean;
      memorable?: boolean;
    } = {}
  ): string {
    const length = options.length || 16;
    const includeSymbols = options.includeSymbols !== false;
    const includeNumbers = options.includeNumbers !== false;
    const excludeAmbiguous = options.excludeAmbiguous !== false;

    let charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    if (includeNumbers) {
      charset += excludeAmbiguous ? "23456789" : "0123456789";
    }

    if (includeSymbols) {
      charset += excludeAmbiguous ? "!@#$%^&*-_+=" : "!@#$%^&*()_+-=[]{}|;:,.<>?";
    }

    if (excludeAmbiguous) {
      // Remove ambiguous characters
      charset = charset.replace(/[0O1lI]/g, "");
    }

    let password = "";

    if (options.memorable) {
      // Generate memorable password (word-based)
      password = this.generateMemorablePassword(length);
    } else {
      // Generate random password
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);

      for (let i = 0; i < length; i++) {
        password += charset[array[i] % charset.length];
      }
    }

    // Ensure password meets requirements
    const strength = this.checkPasswordStrength(password);
    if (strength.strength === "very_weak" || strength.strength === "weak") {
      // Regenerate if too weak
      return this.generateSecurePassword(options);
    }

    return password;
  }

  /**
   * Private helper methods
   */

  private async queryHIBP(hashPrefix: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.requestQueue.push({
        hash: hashPrefix,
        resolve,
        reject,
      });

      // Process queue
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Process up to MAX_CONCURRENT_REQUESTS at once
    const batch = this.requestQueue.splice(0, this.MAX_CONCURRENT_REQUESTS);

    await Promise.all(
      batch.map(async ({ hash, resolve, reject }) => {
        try {
          const response = await fetch(`${HIBP_API_BASE}/range/${hash}`, {
            method: "GET",
            headers: {
              "User-Agent": "Okaeri-Resort-System/1.0",
            },
            signal: AbortSignal.timeout(HIBP_API_TIMEOUT),
          });

          if (!response.ok) {
            throw new Error(`HIBP API error: ${response.status}`);
          }

          const data = await response.text();
          resolve(data);
        } catch (error) {
          reject(error);
        }
      })
    );

    this.isProcessing = false;

    // Process remaining queue
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private findHashInResults(suffix: string, data: string): { found: boolean; count: number } {
    const lines = data.split("\n");

    for (const line of lines) {
      const [hashSuffix, count] = line.split(":");
      if (hashSuffix === suffix) {
        return {
          found: true,
          count: parseInt(count, 10),
        };
      }
    }

    return { found: false, count: 0 };
  }

  private calculateSeverity(breachCount: number): BreachSeverity {
    if (breachCount === 0) return BreachSeverity.NONE;
    if (breachCount >= 10000) return BreachSeverity.CRITICAL;
    if (breachCount >= 1000) return BreachSeverity.HIGH;
    if (breachCount >= 100) return BreachSeverity.MEDIUM;
    return BreachSeverity.LOW;
  }

  private generateRecommendations(breachCount: number, password: string): string[] {
    const recommendations: string[] = [];

    if (breachCount > 0) {
      recommendations.push(`This password has been exposed in ${breachCount} data breaches`);
      recommendations.push("Choose a unique password that has never been used before");
    }

    const strength = this.checkPasswordStrength(password);
    recommendations.push(...strength.suggestions);

    if (breachCount > 1000) {
      recommendations.push(
        "Consider using a password manager to generate and store unique passwords"
      );
      recommendations.push("Enable two-factor authentication for additional security");
    }

    return recommendations;
  }

  private hasCommonPattern(password: string): boolean {
    const lowerPassword = password.toLowerCase();

    // Check against common patterns
    for (const pattern of COMMON_PATTERNS) {
      if (pattern.test(lowerPassword)) {
        return true;
      }
    }

    // Check for keyboard walks
    const keyboardWalks = ["qwerty", "asdf", "zxcv", "1234", "4321"];
    for (const walk of keyboardWalks) {
      if (lowerPassword.includes(walk)) {
        return true;
      }
    }

    return false;
  }

  private hasLocalPattern(password: string): boolean {
    const lowerPassword = password.toLowerCase();

    // Check against Philippine-specific weak passwords
    for (const weak of PH_WEAK_PASSWORDS) {
      if (lowerPassword.includes(weak)) {
        return true;
      }
    }

    // Check for common Filipino names
    const commonNames = ["juan", "maria", "jose", "ana", "pedro", "rosa"];
    for (const name of commonNames) {
      if (lowerPassword.includes(name)) {
        return true;
      }
    }

    return false;
  }

  private hasSequentialChars(password: string): boolean {
    for (let i = 0; i < password.length - 2; i++) {
      const code1 = password.charCodeAt(i);
      const code2 = password.charCodeAt(i + 1);
      const code3 = password.charCodeAt(i + 2);

      if (code2 === code1 + 1 && code3 === code2 + 1) {
        return true;
      }
      if (code2 === code1 - 1 && code3 === code2 - 1) {
        return true;
      }
    }

    return false;
  }

  private hasRepeatedChars(password: string): boolean {
    return /(.)\1{2,}/.test(password);
  }

  private estimateCrackTime(password: string, score: number): string {
    // Simple estimation based on score
    if (score >= 90) return "Centuries";
    if (score >= 75) return "Decades";
    if (score >= 60) return "Years";
    if (score >= 45) return "Months";
    if (score >= 30) return "Days";
    return "Hours or less";
  }

  private generateMemorablePassword(length: number): string {
    // Simple memorable password generator
    const adjectives = ["swift", "brave", "sunny", "quiet", "happy", "clever"];
    const nouns = ["tiger", "ocean", "mountain", "river", "forest", "eagle"];
    const symbols = ["!", "@", "#", "$", "%", "^", "&", "*"];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 9999);
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    let password = `${adjective}${noun}${number}${symbol}`;

    // Capitalize random letter
    const pos = Math.floor(Math.random() * password.length);
    password =
      password.substring(0, pos) + password.charAt(pos).toUpperCase() + password.substring(pos + 1);

    return password;
  }

  private getFromCache(hash: string): BreachCheckResult | null {
    const cached = this.cache.get(hash);

    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }

    if (cached) {
      this.cache.delete(hash);
    }

    return null;
  }

  private cacheResult(hash: string, result: BreachCheckResult): void {
    this.cache.set(hash, {
      result,
      expires: Date.now() + CACHE_TTL,
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [hash, value] of this.cache.entries()) {
        if (value.expires < now) {
          this.cache.delete(hash);
        }
      }
    }, 3600000); // Clean every hour
  }

  private async logBreachCheck(
    userId: string | undefined,
    isBreached: boolean,
    severity: BreachSeverity
  ): Promise<void> {
    await dpaAuditLogger.logDPAEvent({
      category: DPAEventCategory.COMPLIANCE_CHECK,
      action: "password_breach_check",
      description: `Password breach check performed`,
      userId,
      complianceLevel:
        isBreached && severity !== BreachSeverity.LOW ? ("high" as any) : ("info" as any),
      success: true,
      metadata: {
        isBreached,
        severity,
      },
    });
  }

  private async logPasswordValidation(
    userId: string | undefined,
    isValid: boolean,
    errors: string[]
  ): Promise<void> {
    if (!isValid) {
      await dpaAuditLogger.logDPAEvent({
        category: DPAEventCategory.COMPLIANCE_CHECK,
        action: "password_validation",
        description: "Password validation failed",
        userId,
        complianceLevel: "medium" as any,
        success: false,
        metadata: { errors },
      });
    }
  }
}

// Export singleton instance
export const passwordBreachChecker = PasswordBreachChecker.getInstance();

// Export convenience functions
export const checkPasswordBreach = (password: string, userId?: string) =>
  passwordBreachChecker.checkPasswordBreach(password, userId);

export const checkPasswordStrength = (password: string) =>
  passwordBreachChecker.checkPasswordStrength(password);

export const validatePassword = (
  password: string,
  userId?: string,
  options?: Parameters<typeof passwordBreachChecker.validatePassword>[2]
) => passwordBreachChecker.validatePassword(password, userId, options);

export const generateSecurePassword = (
  options?: Parameters<typeof passwordBreachChecker.generateSecurePassword>[0]
) => passwordBreachChecker.generateSecurePassword(options);
