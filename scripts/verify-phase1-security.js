#!/usr/bin/env node

/**
 * Phase 1.2 Security Verification Script
 * Verifies basic security features are properly implemented
 *
 * Key Security Principles Verified:
 * - JWT tokens stored in memory only (no localStorage/sessionStorage persistence)
 * - Bearer token authentication via Authorization headers
 * - Brief localStorage usage allowed ONLY for cross-tab event signaling (non-sensitive)
 * - Input validation with Zod schemas
 * - Rate limiting and session monitoring
 * - CSRF protection via header-only authentication
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

// Security event constants (matching src/lib/security/events.ts)
const SECURITY_EVENTS = {
  LOGOUT: "okaeri_logout_event",
  TOKEN_UPDATE: "okaeri_token_update",
};

class SecurityVerifier {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
  }

  log(message, type = "info") {
    const colors = {
      success: GREEN,
      error: RED,
      warning: YELLOW,
      info: BLUE,
    };
    console.log(`${colors[type] || ""}${message}${RESET}`);
  }

  header(title) {
    console.log("\n" + "=".repeat(60));
    console.log(`${BOLD}${title}${RESET}`);
    console.log("=".repeat(60));
  }

  /**
   * Verify JWT token storage security
   */
  verifyJWTStorage() {
    this.header("JWT Token Storage Security");

    const tokenManagerPath = path.join(__dirname, "../src/lib/security/secure-token-manager.ts");
    const content = fs.readFileSync(tokenManagerPath, "utf8");

    // Check for memory-only storage
    if (content.includes("private accessToken: string | null = null")) {
      this.log("✓ JWT tokens stored in memory only", "success");
      this.results.passed.push("JWT memory-only storage");
    } else {
      this.log("✗ JWT tokens not properly stored in memory", "error");
      this.results.failed.push("JWT memory-only storage");
    }

    // Check for no localStorage usage for tokens (ignoring event broadcasts)
    // NOTE: Brief localStorage usage is allowed ONLY for cross-tab event signaling.
    // These events are non-sensitive and are immediately removed after 100ms.
    // They do not store actual JWT tokens or authentication data.
    const setItemCalls = content.match(/\.(localStorage|sessionStorage)\.setItem\([^)]*\)/g) || [];
    const tokenRelatedStorage = setItemCalls.filter((call) => {
      // Ignore known, non-sensitive broadcast events whether referenced by identifier or literal strings
      const ignores = [
        "SECURITY_EVENTS.LOGOUT",
        "SECURITY_EVENTS.TOKEN_UPDATE",
        `'${SECURITY_EVENTS.LOGOUT}'`,
        `"${SECURITY_EVENTS.LOGOUT}"`,
        `'${SECURITY_EVENTS.TOKEN_UPDATE}'`,
        `"${SECURITY_EVENTS.TOKEN_UPDATE}"`,
      ];
      return !ignores.some((key) => call.includes(key));
    });

    // Defensive: Only consider setItem calls as violations
    const storageViolations = tokenRelatedStorage.filter((call) => call.includes(".setItem("));
    if (storageViolations.length === 0) {
      this.log("✓ No browser storage used for JWT tokens", "success");
      this.results.passed.push("No browser storage for JWT");
    } else {
      this.log("✗ Browser storage detected for JWT tokens", "error");
      this.results.failed.push("No browser storage for JWT");
    }

    // Check for Authorization header usage
    if (content.includes("Bearer")) {
      this.log("✓ Bearer token pattern implemented", "success");
      this.results.passed.push("Bearer token pattern");
    } else {
      this.log("✗ Bearer token pattern not found", "error");
      this.results.failed.push("Bearer token pattern");
    }
  }

  /**
   * Verify input validation and XSS prevention
   */
  verifyInputValidation() {
    this.header("Input Validation & XSS Prevention");

    const validationPath = path.join(__dirname, "../src/lib/validations/auth.ts");
    const content = fs.readFileSync(validationPath, "utf8");

    // Check for Zod schemas
    if (content.includes('import { z } from "zod"')) {
      this.log("✓ Zod validation schemas present", "success");
      this.results.passed.push("Zod validation");
    } else {
      this.log("✗ Zod validation not found", "error");
      this.results.failed.push("Zod validation");
    }

    // Check for email validation
    if (content.includes(".email(") && content.includes(".toLowerCase()")) {
      this.log("✓ Email validation and normalization", "success");
      this.results.passed.push("Email validation");
    } else {
      this.log("✗ Email validation incomplete", "error");
      this.results.failed.push("Email validation");
    }

    // Check for password strength requirements
    if (content.includes("PASSWORD_REGEX")) {
      this.log("✓ Password strength validation", "success");
      this.results.passed.push("Password strength");
    } else {
      this.log("✗ Password strength validation missing", "error");
      this.results.failed.push("Password strength");
    }

    // Check for input sanitization
    if (content.includes(".trim()") && content.includes(".transform(")) {
      this.log("✓ Input sanitization present", "success");
      this.results.passed.push("Input sanitization");
    } else {
      this.log("⚠ Input sanitization may be incomplete", "warning");
      this.results.warnings.push("Input sanitization");
    }
  }

  /**
   * Verify Bearer token implementation
   */
  verifyBearerTokenUsage() {
    this.header("Bearer Token Authentication");

    // Check API client for Bearer token implementation
    const apiClientPath = path.join(__dirname, "../src/lib/api-client.ts");
    if (fs.existsSync(apiClientPath)) {
      const content = fs.readFileSync(apiClientPath, "utf8");

      // Check for Authorization header with Bearer token
      if (
        content.includes("Authorization") &&
        (content.includes("Bearer ${") || content.includes("Bearer `"))
      ) {
        this.log("✓ Bearer token in Authorization headers", "success");
        this.results.passed.push("Bearer token headers");
      } else {
        this.log("✗ Bearer token not properly implemented in headers", "error");
        this.results.failed.push("Bearer token headers");
      }

      // Check for request interceptor setting auth header
      if (content.includes("request.headers") && content.includes("getAccessToken")) {
        this.log("✓ Request interceptor sets Bearer token", "success");
        this.results.passed.push("Bearer token interceptor");
      } else {
        this.log("⚠ Bearer token interceptor may be incomplete", "warning");
        this.results.warnings.push("Bearer token interceptor");
      }
    } else {
      this.log("⚠ API client file not found", "warning");
      this.results.warnings.push("API client verification");
    }

    // Check secure token manager for Bearer token handling
    const tokenManagerPath = path.join(__dirname, "../src/lib/security/secure-token-manager.ts");
    if (fs.existsSync(tokenManagerPath)) {
      const content = fs.readFileSync(tokenManagerPath, "utf8");

      // Verify no cookie storage for JWT
      const cookieUsagePattern = /document\.cookie\s*=/; // assignment implies usage
      if (!cookieUsagePattern.test(content)) {
        this.log("✓ No JWT cookie storage detected", "success");
        this.results.passed.push("No JWT cookies");
      } else {
        this.log("✗ JWT cookie storage detected - should use headers only", "error");
        this.results.failed.push("No JWT cookies");
      }

      // Check for memory-only token storage
      const hasPrivateAccessToken = content.includes("private accessToken: string | null = null");
      const usesLocalOrSessionStorageForTokens =
        /(localStorage|sessionStorage)\.setItem\s*\(\s*["']accessToken["']/.test(content) ||
        /(localStorage|sessionStorage)\.setItem\s*\(\s*["']refreshToken["']/.test(content);

      if (hasPrivateAccessToken && !usesLocalOrSessionStorageForTokens) {
        this.log("✓ Memory-only token storage confirmed", "success");
        this.results.passed.push("Memory token storage");
      } else {
        this.log("⚠ Token storage implementation needs review", "warning");
        this.results.warnings.push("Memory token storage");
      }
    }

    // Check auth store for Bearer token usage
    const authStorePath = path.join(__dirname, "../src/stores/authStore.ts");
    if (fs.existsSync(authStorePath)) {
      const content = fs.readFileSync(authStorePath, "utf8");

      // Check that login sets Bearer token
      if (
        content.includes("tokenManager.storeTokens") ||
        content.includes("SecureTokenManager.setTokens")
      ) {
        this.log("✓ Auth store uses secure token manager", "success");
        this.results.passed.push("Auth store token management");
      } else {
        this.log("✗ Auth store token management incomplete", "error");
        this.results.failed.push("Auth store token management");
      }
    }
  }

  /**
   * Verify authentication flow security
   */
  verifyAuthFlow() {
    this.header("Authentication Flow Security");

    const authStorePath = path.join(__dirname, "../src/stores/authStore.ts");
    const content = fs.readFileSync(authStorePath, "utf8");

    // Check for rate limiting
    if (content.includes("rateLimiter.check")) {
      this.log("✓ Rate limiting implemented", "success");
      this.results.passed.push("Rate limiting");
    } else {
      this.log("✗ Rate limiting not found", "error");
      this.results.failed.push("Rate limiting");
    }

    // Check for audit logging
    if (content.includes("auditLogger.log")) {
      this.log("✓ Audit logging implemented", "success");
      this.results.passed.push("Audit logging");
    } else {
      this.log("✗ Audit logging not found", "error");
      this.results.failed.push("Audit logging");
    }

    // Check for session monitoring
    if (content.includes("sessionMonitor.start")) {
      this.log("✓ Session monitoring implemented", "success");
      this.results.passed.push("Session monitoring");
    } else {
      this.log("✗ Session monitoring not found", "error");
      this.results.failed.push("Session monitoring");
    }

    // Check for token refresh
    if (content.includes("refreshTokens")) {
      this.log("✓ Token refresh mechanism present", "success");
      this.results.passed.push("Token refresh");
    } else {
      this.log("✗ Token refresh not implemented", "error");
      this.results.failed.push("Token refresh");
    }
  }

  /**
   * Verify form component security
   */
  verifyFormSecurity() {
    this.header("Form Component Security");

    const loginFormPath = path.join(__dirname, "../src/features/auth/components/LoginForm.tsx");

    if (fs.existsSync(loginFormPath)) {
      const content = fs.readFileSync(loginFormPath, "utf8");

      // Check for password input type (supports both literal and dynamic toggle)
      if (
        content.includes('type="password"') ||
        content.match(/type=\{\s*showPassword\s*\?\s*['"]text['"]\s*:\s*['"]password['"]\s*\}/)
      ) {
        this.log("✓ Password field properly typed", "success");
        this.results.passed.push("Password field type");
      } else {
        this.log("✗ Password field not properly typed", "error");
        this.results.failed.push("Password field type");
      }

      // Check for autocomplete attributes
      if (content.includes('autoComplete="current-password"')) {
        this.log("✓ Proper autocomplete attributes", "success");
        this.results.passed.push("Autocomplete attributes");
      } else {
        this.log("⚠ Autocomplete attributes may be missing", "warning");
        this.results.warnings.push("Autocomplete attributes");
      }

      // Check for noValidate to prevent browser validation
      if (content.includes("noValidate")) {
        this.log("✓ Custom validation enforced", "success");
        this.results.passed.push("Custom validation");
      } else {
        this.log("⚠ Browser validation not disabled", "warning");
        this.results.warnings.push("Custom validation");
      }
    } else {
      this.log("✗ LoginForm component not found", "error");
      this.results.failed.push("LoginForm component");
    }
  }

  /**
   * Verify route protection
   */
  verifyRouteProtection() {
    this.header("Route Protection");

    const routerGuardsPath = path.join(__dirname, "../src/lib/router-guards.ts");
    const content = fs.readFileSync(routerGuardsPath, "utf8");

    // Check for authentication guards
    if (content.includes("requireAuth")) {
      this.log("✓ Authentication guards implemented", "success");
      this.results.passed.push("Auth guards");
    } else {
      this.log("✗ Authentication guards not found", "error");
      this.results.failed.push("Auth guards");
    }

    // Check for role-based access control
    if (content.includes("requireRole")) {
      this.log("✓ Role-based access control", "success");
      this.results.passed.push("RBAC");
    } else {
      this.log("✗ Role-based access control missing", "error");
      this.results.failed.push("RBAC");
    }

    // Check for redirect logic
    if (content.includes("redirect") && content.includes("preserveRedirect")) {
      this.log("✓ Secure redirect logic", "success");
      this.results.passed.push("Redirect logic");
    } else {
      this.log("✗ Redirect logic incomplete", "error");
      this.results.failed.push("Redirect logic");
    }
  }

  /**
   * Run test suites to verify security
   */
  async runSecurityTests() {
    this.header("Running Security Tests");

    try {
      // Run all security tests using glob pattern
      this.log("Running comprehensive security test suite...", "info");
      // Use npm script for better CI reliability
      execSync(
        'npm run vitest:run -- "src/features/auth/__tests__/security/*.test.tsx" --reporter=dot',
        {
          stdio: "pipe",
          cwd: path.join(__dirname, ".."),
        }
      );
      this.log("✓ All security tests passed (auth, rate-limiting, session)", "success");
      this.results.passed.push("Comprehensive security tests");
    } catch (error) {
      // If glob pattern fails, try individual test files
      this.log("⚠ Glob pattern failed, running individual test files...", "warning");

      let allTestsPassed = true;

      const testFiles = [
        {
          name: "Auth security tests",
          path: "src/features/auth/__tests__/security/auth-security.test.tsx",
        },
        {
          name: "Rate limiting tests",
          path: "src/features/auth/__tests__/security/rate-limiting.test.tsx",
        },
        {
          name: "Session security tests",
          path: "src/features/auth/__tests__/security/session-security.test.tsx",
        },
      ];

      for (const test of testFiles) {
        const fullPath = path.join(__dirname, "..", test.path);

        // Check if test file exists before trying to run it
        if (!fs.existsSync(fullPath)) {
          this.log(`⚠ Test file not found, skipping: ${test.path}`, "warning");
          this.results.warnings.push(`${test.name} file not found`);
          continue;
        }

        // Run the test
        try {
          this.log(`Running ${test.name.toLowerCase()}...`, "info");
          execSync(`npm run vitest:run -- ${test.path} --reporter=dot`, {
            stdio: "pipe",
            cwd: path.join(__dirname, ".."),
          });
          this.log(`✓ ${test.name} passed`, "success");
          this.results.passed.push(test.name);
        } catch (error) {
          this.log(`✗ ${test.name} failed`, "error");
          this.results.failed.push(test.name);
          allTestsPassed = false;
        }
      }

      if (!allTestsPassed) {
        this.log("✗ Some security tests failed", "error");
      }
    }

    try {
      // Run form component tests
      this.log("Running form component tests...", "info");
      execSync(
        "npm run vitest:run -- src/features/auth/__tests__/LoginForm.test.tsx --reporter=dot",
        {
          stdio: "pipe",
          cwd: path.join(__dirname, ".."),
        }
      );
      this.log("✓ Form component tests passed", "success");
      this.results.passed.push("Form component tests");
    } catch (error) {
      this.log("✗ Form component tests failed", "error");
      this.results.failed.push("Form component tests");
    }
  }

  /**
   * Scan entire project for token storage patterns
   */
  scanProjectForTokenStorage() {
    this.header("Project-wide Token Storage Scan");

    const srcDir = path.join(__dirname, "../src");
    const violations = [];

    // Helper function to recursively find all TS/TSX files
    const getAllFiles = (dirPath, arrayOfFiles = []) => {
      const files = fs.readdirSync(dirPath);

      files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
          // Skip node_modules and other irrelevant directories
          if (!file.includes("node_modules") && !file.startsWith(".")) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
          }
        } else if (/\.(ts|tsx)$/.test(file)) {
          arrayOfFiles.push(fullPath);
        }
      });

      return arrayOfFiles;
    };

    const files = getAllFiles(srcDir);
    const tokenKeyPattern = /(token|jwt|auth|access|refresh)/i;

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf8");
      const storagePattern = /(localStorage|sessionStorage)\.setItem\([^)]+\)/g;
      const matches = content.match(storagePattern) || [];

      matches.forEach((match) => {
        // Check if this is a token-related storage call
        // Exclude our security event keys (both the constant names and their values)
        const isSecurityEvent =
          match.includes("SECURITY_EVENTS.LOGOUT") ||
          match.includes("SECURITY_EVENTS.TOKEN_UPDATE") ||
          match.includes(`'${SECURITY_EVENTS.LOGOUT}'`) ||
          match.includes(`"${SECURITY_EVENTS.LOGOUT}"`) ||
          match.includes(`'${SECURITY_EVENTS.TOKEN_UPDATE}'`) ||
          match.includes(`"${SECURITY_EVENTS.TOKEN_UPDATE}"`);

        if (tokenKeyPattern.test(match) && !isSecurityEvent) {
          const relativePath = path.relative(path.join(__dirname, ".."), file);
          violations.push({ file: relativePath, match });
        }
      });
    });

    if (violations.length === 0) {
      this.log("✓ No token-related storage found across entire codebase", "success");
      this.results.passed.push("Project-wide token storage scan");
    } else {
      violations.forEach((v) => {
        this.log(`✗ Token storage detected in ${v.file}`, "error");
        this.log(`  ${v.match}`, "error");
      });
      this.results.failed.push("Project-wide token storage scan");
    }
  }

  /**
   * Generate summary report
   */
  generateReport() {
    this.header("Security Verification Summary");

    const total = this.results.passed.length + this.results.failed.length;
    const passRate = ((this.results.passed.length / total) * 100).toFixed(1);

    console.log(`\n${BOLD}Results:${RESET}`);
    console.log(`${GREEN}Passed: ${this.results.passed.length}${RESET}`);
    console.log(`${RED}Failed: ${this.results.failed.length}${RESET}`);
    console.log(`${YELLOW}Warnings: ${this.results.warnings.length}${RESET}`);
    console.log(`\n${BOLD}Pass Rate: ${passRate}%${RESET}`);

    if (this.results.failed.length > 0) {
      console.log(`\n${RED}${BOLD}Failed Checks:${RESET}`);
      this.results.failed.forEach((item) => {
        console.log(`  ${RED}✗ ${item}${RESET}`);
      });
    }

    if (this.results.warnings.length > 0) {
      console.log(`\n${YELLOW}${BOLD}Warnings:${RESET}`);
      this.results.warnings.forEach((item) => {
        console.log(`  ${YELLOW}⚠ ${item}${RESET}`);
      });
    }

    if (this.results.passed.length > 0) {
      console.log(`\n${GREEN}${BOLD}Passed Checks:${RESET}`);
      this.results.passed.forEach((item) => {
        console.log(`  ${GREEN}✓ ${item}${RESET}`);
      });
    }

    // Phase 1.2 specific conclusion
    console.log("\n" + "=".repeat(60));
    if (passRate >= 85) {
      console.log(`${GREEN}${BOLD}✓ Phase 1.2 Security Verification: PASSED${RESET}`);
      console.log(`${GREEN}Basic security features are properly implemented.${RESET}`);
    } else if (passRate >= 70) {
      console.log(`${YELLOW}${BOLD}⚠ Phase 1.2 Security Verification: PARTIAL${RESET}`);
      console.log(`${YELLOW}Most security features are implemented but some gaps remain.${RESET}`);
    } else {
      console.log(`${RED}${BOLD}✗ Phase 1.2 Security Verification: FAILED${RESET}`);
      console.log(`${RED}Critical security features are missing or incomplete.${RESET}`);
    }
    console.log("=".repeat(60));

    return passRate >= 85 ? 0 : 1;
  }

  async run() {
    console.log(`${BOLD}${BLUE}Phase 1.2 Security Verification${RESET}`);
    console.log("Verifying basic security implementation...\n");

    this.verifyJWTStorage();
    this.scanProjectForTokenStorage();
    this.verifyBearerTokenUsage();
    this.verifyInputValidation();
    this.verifyAuthFlow();
    this.verifyFormSecurity();
    this.verifyRouteProtection();
    await this.runSecurityTests();

    const exitCode = this.generateReport();
    process.exit(exitCode);
  }
}

// Run verification
const verifier = new SecurityVerifier();
verifier.run().catch((error) => {
  console.error(`${RED}Verification failed:${RESET}`, error);
  process.exit(1);
});
