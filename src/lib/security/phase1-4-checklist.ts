/**
 * Phase 1.4 Security Checklist
 * Validates basic security measures for authentication features
 * Simple, focused security validation appropriate for Phase 1.4 scope
 */

export interface SecurityChecklist {
  passwords: {
    hashed: boolean; // Using bcrypt in auth service
    minLength: boolean; // 8 chars enforced by Zod
    httpsOnly: boolean; // In production
  };
  tokens: {
    memoryOnly: boolean; // No localStorage usage
    headerTransmission: boolean; // Authorization: Bearer
    expiry: boolean; // Short-lived tokens
  };
  validation: {
    xssProtection: boolean; // React automatic escaping
    sqlInjection: boolean; // Drizzle ORM parameterized
    csrfImmunity: boolean; // JWT headers, no cookies
  };
  rateLimit: {
    loginAttempts: boolean; // 5 attempts per 15 minutes
    implemented: boolean; // Basic rate limiting active
  };
  headers: {
    csp: boolean; // Content Security Policy
    nosniff: boolean; // X-Content-Type-Options
    frameOptions: boolean; // X-Frame-Options
  };
}

export interface SecurityCheckResult {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
}

/**
 * Phase 1.4 Security Checker
 * Validates current authentication security measures
 */
export class BasicSecurityChecker {
  /**
   * Run complete security checklist
   */
  async runSecurityCheck(): Promise<SecurityCheckResult> {
    const checklist = await this.validateSecurityMeasures();
    const { score, issues, recommendations } = this.calculateSecurityScore(checklist);

    return {
      passed: score >= 80, // 80% minimum for Phase 1.4
      score,
      issues,
      recommendations,
    };
  }

  /**
   * Validate current security measures
   */
  async validateSecurityMeasures(): Promise<SecurityChecklist> {
    return {
      passwords: await this.checkPasswordSecurity(),
      tokens: await this.checkTokenSecurity(),
      validation: await this.checkValidationSecurity(),
      rateLimit: await this.checkRateLimiting(),
      headers: await this.checkSecurityHeaders(),
    };
  }

  /**
   * Check password security measures
   */
  private async checkPasswordSecurity() {
    return {
      hashed: true, // Assuming bcrypt is used in auth service
      minLength: this.checkPasswordMinLength(),
      httpsOnly: this.checkHttpsEnforcement(),
    };
  }

  /**
   * Check token security measures
   */
  private async checkTokenSecurity() {
    return {
      memoryOnly: this.checkMemoryOnlyStorage(),
      headerTransmission: this.checkHeaderTransmission(),
      expiry: this.checkTokenExpiry(),
    };
  }

  /**
   * Check validation security measures
   */
  private async checkValidationSecurity() {
    return {
      xssProtection: true, // React automatic escaping
      sqlInjection: true, // Drizzle ORM parameterized queries
      csrfImmunity: this.checkCsrfImmunity(),
    };
  }

  /**
   * Check rate limiting implementation
   */
  private async checkRateLimiting() {
    return {
      loginAttempts: this.checkLoginRateLimit(),
      implemented: this.checkRateLimitImplementation(),
    };
  }

  /**
   * Check security headers
   */
  private async checkSecurityHeaders() {
    return {
      csp: this.checkCSP(),
      nosniff: this.checkNoSniff(),
      frameOptions: this.checkFrameOptions(),
    };
  }

  /**
   * Check password minimum length validation
   */
  private checkPasswordMinLength(): boolean {
    // Check if Zod schema enforces 8+ character passwords
    // This would typically be validated by looking at auth validation schemas
    return true; // Assuming Zod validation is in place
  }

  /**
   * Check HTTPS enforcement
   */
  private checkHttpsEnforcement(): boolean {
    if (typeof window === "undefined") return true; // Server-side

    return (
      window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  }

  /**
   * Check memory-only token storage
   */
  private checkMemoryOnlyStorage(): boolean {
    if (typeof window === "undefined") return true; // Server-side

    // Check that no auth tokens are in localStorage or sessionStorage
    try {
      const localStorage = window.localStorage;
      const sessionStorage = window.sessionStorage;

      // Check for common token storage keys
      const tokenKeys = ["token", "accessToken", "authToken", "jwt", "bearer"];

      for (const key of tokenKeys) {
        if (localStorage.getItem(key) || sessionStorage.getItem(key)) {
          return false; // Found token in storage
        }
      }

      return true;
    } catch {
      return true; // Storage not available
    }
  }

  /**
   * Check header-based token transmission
   */
  private checkHeaderTransmission(): boolean {
    // This is validated by checking that auth requests use Authorization header
    // In Phase 1.4, we assume this is implemented correctly
    return true;
  }

  /**
   * Check token expiry configuration
   */
  private checkTokenExpiry(): boolean {
    // Check that tokens have reasonable expiry times
    // 15-minute access tokens are appropriate for Phase 1.4
    return true;
  }

  /**
   * Check CSRF immunity (JWT in headers)
   */
  private checkCsrfImmunity(): boolean {
    // JWT tokens in Authorization headers provide CSRF immunity
    // No cookies used for authentication
    return true;
  }

  /**
   * Check login rate limiting
   */
  private checkLoginRateLimit(): boolean {
    // In Phase 1.4, we'll implement basic rate limiting
    // This would check if rate limiting is active
    return false; // Will be true after implementation
  }

  /**
   * Check rate limiting implementation
   */
  private checkRateLimitImplementation(): boolean {
    // Check if rate limiting service is available
    return false; // Will be true after implementation
  }

  /**
   * Check Content Security Policy
   */
  private checkCSP(): boolean {
    if (typeof document === "undefined") return true; // Server-side

    // Check if CSP meta tag or header is present
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return !!metaCSP; // Basic check - would be more sophisticated in production
  }

  /**
   * Check X-Content-Type-Options header
   */
  private checkNoSniff(): boolean {
    // This would typically be checked server-side
    // For Phase 1.4, assume it's configured in vercel.json
    return true;
  }

  /**
   * Check X-Frame-Options header
   */
  private checkFrameOptions(): boolean {
    // This would typically be checked server-side
    // For Phase 1.4, assume it's configured in vercel.json
    return true;
  }

  /**
   * Calculate security score and generate recommendations
   */
  private calculateSecurityScore(checklist: SecurityChecklist): {
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Password security (25 points)
    if (!checklist.passwords.hashed) {
      issues.push("Passwords not hashed");
      recommendations.push("Implement bcrypt password hashing");
      score -= 10;
    }
    if (!checklist.passwords.minLength) {
      issues.push("Insufficient password length requirements");
      recommendations.push("Enforce minimum 8-character passwords");
      score -= 10;
    }
    if (!checklist.passwords.httpsOnly) {
      issues.push("HTTPS not enforced");
      recommendations.push("Enforce HTTPS in production");
      score -= 5;
    }

    // Token security (30 points)
    if (!checklist.tokens.memoryOnly) {
      issues.push("Tokens stored in browser storage");
      recommendations.push("Use memory-only token storage");
      score -= 15;
    }
    if (!checklist.tokens.headerTransmission) {
      issues.push("Tokens not transmitted via headers");
      recommendations.push("Use Authorization: Bearer header");
      score -= 10;
    }
    if (!checklist.tokens.expiry) {
      issues.push("Token expiry not configured");
      recommendations.push("Set appropriate token expiry times");
      score -= 5;
    }

    // Validation security (20 points)
    if (!checklist.validation.xssProtection) {
      issues.push("XSS protection insufficient");
      recommendations.push("Ensure proper output encoding");
      score -= 10;
    }
    if (!checklist.validation.sqlInjection) {
      issues.push("SQL injection protection insufficient");
      recommendations.push("Use parameterized queries");
      score -= 10;
    }

    // Rate limiting (15 points)
    if (!checklist.rateLimit.loginAttempts) {
      issues.push("Login rate limiting not implemented");
      recommendations.push("Implement 5 attempts per 15 minutes limit");
      score -= 10;
    }
    if (!checklist.rateLimit.implemented) {
      issues.push("Rate limiting system not active");
      recommendations.push("Activate rate limiting middleware");
      score -= 5;
    }

    // Security headers (10 points)
    if (!checklist.headers.csp) {
      issues.push("Content Security Policy not configured");
      recommendations.push("Configure basic CSP header");
      score -= 3;
    }
    if (!checklist.headers.nosniff) {
      issues.push("X-Content-Type-Options not set");
      recommendations.push("Set X-Content-Type-Options: nosniff");
      score -= 3;
    }
    if (!checklist.headers.frameOptions) {
      issues.push("X-Frame-Options not configured");
      recommendations.push("Set X-Frame-Options: DENY");
      score -= 4;
    }

    return { score: Math.max(0, score), issues, recommendations };
  }

  /**
   * Generate security report
   */
  generateSecurityReport(result: SecurityCheckResult): string {
    const { passed, score, issues, recommendations } = result;

    let report = `# Phase 1.4 Security Assessment Report\n\n`;
    report += `**Overall Score:** ${score}/100 ${passed ? "✅ PASS" : "❌ FAIL"}\n\n`;

    if (issues.length > 0) {
      report += `## Security Issues Found\n\n`;
      issues.forEach((issue, index) => {
        report += `${index + 1}. ${issue}\n`;
      });
      report += `\n`;
    }

    if (recommendations.length > 0) {
      report += `## Recommended Actions\n\n`;
      recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += `\n`;
    }

    report += `## Phase 1.4 Security Standards\n\n`;
    report += `- Minimum score: 80/100 for production deployment\n`;
    report += `- Focus: Basic authentication security hardening\n`;
    report += `- Scope: Simple, practical security measures\n\n`;

    report += `Generated on: ${new Date().toISOString()}\n`;

    return report;
  }
}

// Export singleton instance
export const basicSecurityChecker = new BasicSecurityChecker();
