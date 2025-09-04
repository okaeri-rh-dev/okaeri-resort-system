/**
 * Security Headers Validation and Configuration
 * Phase 1.4 implementation - basic security headers validation
 * Validates that essential security headers are properly configured
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  xContentTypeOptions: string;
  xFrameOptions: string;
  xXSSProtection: string;
  strictTransportSecurity?: string;
  referrerPolicy?: string;
}

export interface SecurityHeadersValidation {
  configured: boolean;
  missing: string[];
  recommendations: string[];
  score: number; // 0-100
}

/**
 * Basic security headers configuration for Phase 1.4
 * Production-ready but simple configuration
 */
export const BASIC_SECURITY_HEADERS: SecurityHeadersConfig = {
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Permissive for development
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
  ].join("; "),

  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  xXSSProtection: "1; mode=block",
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  referrerPolicy: "strict-origin-when-cross-origin",
};

/**
 * Production-optimized security headers with stricter CSP
 */
export const PRODUCTION_SECURITY_HEADERS: SecurityHeadersConfig = {
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self'", // No unsafe-inline in production
    "style-src 'self' 'unsafe-inline'", // CSS-in-JS requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.okaeri-resort.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),

  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  xXSSProtection: "1; mode=block",
  strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  referrerPolicy: "strict-origin-when-cross-origin",
};

/**
 * Security Headers Validator
 * Validates current security headers configuration
 */
export class SecurityHeadersValidator {
  /**
   * Validate security headers from HTTP response
   * @param headers - Response headers (Headers object or plain object)
   */
  validateHeaders(headers: Headers | Record<string, string>): SecurityHeadersValidation {
    const headerMap = this.normalizeHeaders(headers);
    const missing: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check Content Security Policy
    const csp = headerMap["content-security-policy"];
    if (!csp) {
      missing.push("Content-Security-Policy");
      recommendations.push("Add CSP header to prevent XSS attacks");
      score -= 25;
    } else if (csp.includes("unsafe-eval") || csp.includes("*")) {
      recommendations.push("Tighten CSP policy - avoid unsafe-eval and wildcards");
      score -= 5;
    }

    // Check X-Content-Type-Options
    const noSniff = headerMap["x-content-type-options"];
    if (!noSniff || !noSniff.includes("nosniff")) {
      missing.push("X-Content-Type-Options: nosniff");
      recommendations.push("Add X-Content-Type-Options: nosniff to prevent MIME sniffing");
      score -= 15;
    }

    // Check X-Frame-Options
    const frameOptions = headerMap["x-frame-options"];
    if (!frameOptions) {
      missing.push("X-Frame-Options");
      recommendations.push("Add X-Frame-Options to prevent clickjacking");
      score -= 20;
    } else if (!frameOptions.includes("DENY") && !frameOptions.includes("SAMEORIGIN")) {
      recommendations.push("Use X-Frame-Options: DENY or SAMEORIGIN");
      score -= 5;
    }

    // Check X-XSS-Protection (optional but recommended)
    const xssProtection = headerMap["x-xss-protection"];
    if (!xssProtection) {
      recommendations.push("Consider adding X-XSS-Protection header");
      score -= 5;
    }

    // Check Strict-Transport-Security (HTTPS only)
    const hsts = headerMap["strict-transport-security"];
    if (!hsts && this.isHttpsEnvironment()) {
      missing.push("Strict-Transport-Security");
      recommendations.push("Add HSTS header for HTTPS enforcement");
      score -= 15;
    }

    // Check Referrer-Policy
    const referrerPolicy = headerMap["referrer-policy"];
    if (!referrerPolicy) {
      recommendations.push("Consider adding Referrer-Policy header");
      score -= 5;
    }

    return {
      configured: missing.length === 0,
      missing,
      recommendations,
      score: Math.max(0, score),
    };
  }

  /**
   * Generate security headers for Vercel configuration
   */
  generateVercelHeaders(environment: "development" | "production" = "production"): Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }> {
    const config =
      environment === "production" ? PRODUCTION_SECURITY_HEADERS : BASIC_SECURITY_HEADERS;

    const headers = [
      { key: "Content-Security-Policy", value: config.contentSecurityPolicy },
      { key: "X-Content-Type-Options", value: config.xContentTypeOptions },
      { key: "X-Frame-Options", value: config.xFrameOptions },
      { key: "X-XSS-Protection", value: config.xXSSProtection },
    ];

    if (config.strictTransportSecurity) {
      headers.push({ key: "Strict-Transport-Security", value: config.strictTransportSecurity });
    }

    if (config.referrerPolicy) {
      headers.push({ key: "Referrer-Policy", value: config.referrerPolicy });
    }

    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  }

  /**
   * Validate current page security headers (client-side)
   */
  validateCurrentPage(): Promise<SecurityHeadersValidation> {
    return new Promise((resolve) => {
      if (typeof window === "undefined") {
        resolve({
          configured: false,
          missing: ["Cannot validate headers on server-side"],
          recommendations: ["Use server-side validation"],
          score: 0,
        });
        return;
      }

      // For client-side validation, we can only check meta tags and make a test request
      // This is limited but better than nothing for Phase 1.4
      const metaHeaders: Record<string, string> = {};

      // Check CSP meta tag
      const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (cspMeta) {
        metaHeaders["content-security-policy"] = cspMeta.getAttribute("content") || "";
      }

      // Check if fetch is available (not in test environment)
      if (typeof fetch !== "undefined") {
        // Make a test request to get actual headers (limited by CORS)
        fetch(window.location.href, { method: "HEAD" })
          .then((response) => {
            const headers: Record<string, string> = {};
            response.headers.forEach((value, key) => {
              headers[key.toLowerCase()] = value;
            });

            // Merge meta tags and response headers
            const allHeaders = { ...headers, ...metaHeaders };
            resolve(this.validateHeaders(allHeaders));
          })
          .catch(() => {
            // Fallback to meta tag validation only
            resolve(this.validateHeaders(metaHeaders));
          });
      } else {
        // Test environment - just validate meta tags
        resolve(this.validateHeaders(metaHeaders));
      }
    });
  }

  /**
   * Generate security headers report
   */
  generateHeadersReport(validation: SecurityHeadersValidation): string {
    let report = `# Security Headers Assessment\n\n`;
    report += `**Score:** ${validation.score}/100 ${validation.configured ? "✅" : "❌"}\n\n`;

    if (validation.missing.length > 0) {
      report += `## Missing Headers\n\n`;
      validation.missing.forEach((header, index) => {
        report += `${index + 1}. ${header}\n`;
      });
      report += `\n`;
    }

    if (validation.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      validation.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += `\n`;
    }

    report += `## Expected Headers for Phase 1.4\n\n`;
    report += `- **Content-Security-Policy**: Prevent XSS attacks\n`;
    report += `- **X-Content-Type-Options**: nosniff to prevent MIME sniffing\n`;
    report += `- **X-Frame-Options**: DENY to prevent clickjacking\n`;
    report += `- **X-XSS-Protection**: Browser XSS filtering\n`;
    report += `- **Strict-Transport-Security**: HTTPS enforcement\n`;
    report += `- **Referrer-Policy**: Control referrer information\n\n`;

    return report;
  }

  /**
   * Normalize headers to lowercase keys
   */
  private normalizeHeaders(headers: Headers | Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        normalized[key.toLowerCase()] = value;
      });
    } else {
      Object.entries(headers).forEach(([key, value]) => {
        normalized[key.toLowerCase()] = value;
      });
    }

    return normalized;
  }

  /**
   * Check if running in HTTPS environment
   */
  private isHttpsEnvironment(): boolean {
    if (typeof window === "undefined") {
      // Server-side: assume production is HTTPS
      return process.env.NODE_ENV === "production";
    }

    return window.location.protocol === "https:";
  }
}

/**
 * Middleware to add security headers to API responses
 * Usage in Vercel API routes
 */
export function addSecurityHeaders(
  response: Response | any,
  environment: "development" | "production" = "production"
): Response {
  const config =
    environment === "production" ? PRODUCTION_SECURITY_HEADERS : BASIC_SECURITY_HEADERS;

  // If it's a Response object, we need to create a new one with headers
  if (response instanceof Response) {
    const newHeaders = new Headers(response.headers);

    newHeaders.set("Content-Security-Policy", config.contentSecurityPolicy);
    newHeaders.set("X-Content-Type-Options", config.xContentTypeOptions);
    newHeaders.set("X-Frame-Options", config.xFrameOptions);
    newHeaders.set("X-XSS-Protection", config.xXSSProtection);

    if (config.strictTransportSecurity) {
      newHeaders.set("Strict-Transport-Security", config.strictTransportSecurity);
    }

    if (config.referrerPolicy) {
      newHeaders.set("Referrer-Policy", config.referrerPolicy);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  // For other response objects (like NextResponse), set headers directly
  if (response && typeof response.headers?.set === "function") {
    response.headers.set("Content-Security-Policy", config.contentSecurityPolicy);
    response.headers.set("X-Content-Type-Options", config.xContentTypeOptions);
    response.headers.set("X-Frame-Options", config.xFrameOptions);
    response.headers.set("X-XSS-Protection", config.xXSSProtection);

    if (config.strictTransportSecurity) {
      response.headers.set("Strict-Transport-Security", config.strictTransportSecurity);
    }

    if (config.referrerPolicy) {
      response.headers.set("Referrer-Policy", config.referrerPolicy);
    }
  }

  return response;
}

// Export singleton instance
export const securityHeadersValidator = new SecurityHeadersValidator();
