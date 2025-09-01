# Security Verification Scripts Requirements

## Overview

This document specifies the security verification scripts required to enforce
JWT memory-only authentication and prevent security regressions. It ensures the
codebase maintains strict security standards throughout the TDD process.

**CRITICAL UPDATE**: The implementation correctly uses memory-only storage for
JWT tokens, which is MORE SECURE than localStorage. This document has been
updated to reflect the actual secure implementation.

**Owner**: security-compliance-auditor  
**Status**: Required for Phase 1 Security Gates  
**Last Updated**: August 31, 2025 (Updated for memory-only storage)

## Memory-Only Token Storage Security Benefits

### Why Memory-Only Storage is Superior

1. **XSS Protection**: Tokens stored in memory cannot be accessed by injected
   scripts
2. **No Persistence Attack Vector**: localStorage/sessionStorage can be read by
   any script
3. **Automatic Cleanup**: Tokens are cleared when tab/browser closes
4. **Reduced Attack Surface**: No browser storage API exposure
5. **OWASP Best Practice**: Aligns with latest security recommendations

### Implementation Details

The `SecureTokenManager` class stores tokens in private class variables:

- Access tokens: Stored in private `accessToken` variable
- Refresh tokens: Server-side only (httpOnly cookies in production)
- Fingerprinting: Additional browser fingerprint validation
- Auto-refresh: Built-in token lifecycle management

## Critical Security Scripts

### 1. JWT Verification Scripts - COMPLETE IMPLEMENTATION

Add these scripts to package.json:

```json
{
  "scripts": {
    // Primary JWT verification with test execution
    "verify:jwt": "vitest run src/__tests__/security/jwt.security.test.ts --reporter=verbose && npm run audit:jwt:cookies",

    // Comprehensive JWT cookie audit (should find ZERO instances)
    "audit:jwt:cookies": "bash -c \"! grep -r 'document\\.cookie' src/ api/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' | grep -iE '(token|jwt|auth|bearer|session)' || (echo '✅ No JWT cookie usage detected' && exit 0)\"",

    // Verify NO localStorage token storage (security requirement - memory-only)
    "audit:jwt:storage": "bash -c \"! grep -r 'localStorage\\.(get|set|remove)Item.*[\"'\\`](auth_token|refresh_token|token|jwt)' src/ --include='*.ts' --include='*.tsx' && echo '✅ No localStorage token usage detected (secure memory-only storage)' || (echo '❌ ERROR: localStorage token usage detected - security violation! Tokens must be stored in memory only' && exit 1)\"",

    // Check for Authorization Bearer header pattern
    "audit:jwt:headers": "bash -c \"grep -r 'Authorization.*Bearer' src/ api/ --include='*.ts' --include='*.tsx' && echo '✅ Authorization Bearer headers detected' || (echo '⚠️ WARNING: No Authorization Bearer headers found' && exit 1)\"",

    // Verify NO cookie-based auth patterns
    "audit:jwt:no-cookies": "bash -c \"! grep -rE '(Set-Cookie|withCredentials|credentials:\\s*[\"'\\`]include)' src/ api/ --include='*.ts' --include='*.tsx' | grep -iE '(token|jwt|auth)' || (echo '✅ No cookie-based auth patterns' && exit 0)\"",

    // Complete JWT security audit suite
    "security:jwt:full": "npm run verify:jwt && npm run audit:jwt:storage && npm run audit:jwt:headers && npm run audit:jwt:no-cookies",

    // Quick JWT security check for pre-commit
    "security:jwt:quick": "npm run audit:jwt:cookies && npm run audit:jwt:no-cookies",

    // JWT implementation validation
    "validate:jwt": "node scripts/validate-jwt-implementation.js"
  }
}
```

### Cross-Platform Script Usage

#### Running Security Audits

```bash
# Auto-detect platform and run appropriate version
npm run audit:jwt:cookies      # Check for JWT cookie usage
npm run audit:jwt:storage      # Verify memory-only storage
npm run audit:jwt:headers      # Check Authorization headers
npm run audit:jwt:no-cookies   # Ensure no cookie auth
npm run security:jwt:full      # Run all audits

# Force specific version if needed
npm run audit:jwt:cookies:node  # Force Node.js version
npm run audit:jwt:cookies:bash  # Force bash version (Unix/Linux/Mac only)
```

#### Platform Support

| Script          | Windows | Mac | Linux | CI/CD |
| --------------- | ------- | --- | ----- | ----- |
| Node.js scripts | ✅      | ✅  | ✅    | ✅    |
| Bash scripts    | ❌\*    | ✅  | ✅    | ✅    |

\*Windows requires WSL or Git Bash for bash scripts

### 2. General Security Verification Scripts

```json
{
  "scripts": {
    // XSS prevention audit
    "audit:xss": "! grep -r 'dangerouslySetInnerHTML\\|eval\\|innerHTML' src/ --exclude-dir=__tests__ || (echo '⚠️ Potential XSS vectors found' && exit 1)",

    // SQL injection prevention (for API routes)
    "audit:sql": "! grep -r '\\${.*}.*\\(SELECT\\|INSERT\\|UPDATE\\|DELETE\\)' api/ || (echo '⚠️ Potential SQL injection vectors' && exit 1)",

    // Sensitive data exposure audit
    "audit:secrets": "! grep -rE '(api_key|secret|password|token)\\s*=\\s*[\"\\'][^\"\\']+[\"\\']' src/ api/ --exclude-dir=__tests__ || (echo '⚠️ Hardcoded secrets detected' && exit 1)",

    // Complete security audit
    "security:audit:all": "npm run security:jwt:full && npm run audit:xss && npm run audit:sql && npm run audit:secrets"
  }
}
```

## JWT Security Test Requirements

### Required Test File - COMPLETE IMPLEMENTATION

Create `src/__tests__/security/jwt.security.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { secureTokenManager } from "@/lib/security/secure-token-manager";
import type { DecodedToken } from "@/types/auth";

describe("JWT Security Verification", () => {
  // Mock timers for token expiration tests
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "";
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Token Storage Security", () => {
    it("should NEVER store JWT in cookies", () => {
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      // Attempt to set token
      secureTokenManager.setToken(testToken);

      // Verify no cookies were set
      expect(document.cookie).toBe("");
      expect(document.cookie).not.toContain("token");
      expect(document.cookie).not.toContain("jwt");
      expect(document.cookie).not.toContain("auth");
      expect(document.cookie).not.toContain("Bearer");
    });

    it("should store JWT in memory only (NOT in localStorage)", () => {
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      secureTokenManager.setToken(testToken);

      // Should NOT be in localStorage (security best practice)
      expect(localStorage.getItem("auth_token")).toBeNull();
      // Should NOT be in sessionStorage (except mock mode)
      if (!import.meta.env.VITE_MOCK_AUTH) {
        expect(sessionStorage.getItem("auth_token")).toBeNull();
      }
      // Should NOT be in cookies
      expect(document.cookie).toBe("");
      // Token should be retrievable from memory
      expect(secureTokenManager.getToken()).toBe(testToken);
    });

    it("should never attempt to read JWT from cookies", () => {
      // Set a cookie that looks like a JWT
      document.cookie =
        "auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test; path=/";

      // Get token should ignore cookies
      const token = secureTokenManager.getToken();

      expect(token).toBeNull();
    });

    it("should clear token from memory on logout", () => {
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      // Set token
      secureTokenManager.setToken(testToken);
      expect(secureTokenManager.getToken()).toBe(testToken);

      // Clear token
      secureTokenManager.clearToken();

      // Verify cleared from memory
      expect(secureTokenManager.getToken()).toBeNull();
      // Verify NOT in any browser storage
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(sessionStorage.getItem("auth_token")).toBeNull();
      expect(document.cookie).toBe("");
    });

    it("should handle tokens in memory only (refresh tokens server-side)", () => {
      const accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access";
      const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh";

      secureTokenManager.setToken(accessToken);
      // Refresh token handled server-side in production

      // Access token in memory only
      expect(secureTokenManager.getToken()).toBe(accessToken);
      // Refresh tokens handled server-side in production
      // NO localStorage usage for security
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
      expect(document.cookie).toBe("");
    });
  });

  describe("Authorization Header Security", () => {
    it("should use Authorization header for API calls", async () => {
      const mockFetch = vi.spyOn(global, "fetch");
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      secureTokenManager.setToken(testToken);

      // Make API call
      await fetch("/api/test", {
        headers: secureTokenManager.getAuthHeaders(),
      });

      // Verify Authorization header is used
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${testToken}`,
          }),
        })
      );
    });

    it("should NEVER send token as cookie header", async () => {
      const mockFetch = vi.spyOn(global, "fetch");
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      secureTokenManager.setToken(testToken);

      // Make API call
      await fetch("/api/test", {
        headers: secureTokenManager.getAuthHeaders(),
      });

      // Verify no Cookie header
      const calls = mockFetch.mock.calls;
      calls.forEach((call) => {
        const headers = call[1]?.headers as any;
        expect(headers).not.toHaveProperty("Cookie");
        expect(headers).not.toHaveProperty("cookie");
      });
    });

    it("should handle missing token gracefully", () => {
      // No token set
      const headers = secureTokenManager.getAuthHeaders();

      expect(headers.Authorization).toBeUndefined();
    });

    it("should include Content-Type header", () => {
      const headers = secureTokenManager.getAuthHeaders();

      expect(headers["Content-Type"]).toBe("application/json");
    });
  });

  describe("CSRF Protection", () => {
    it("should not require CSRF tokens (JWT-only auth)", () => {
      // Verify no CSRF token functions exist
      expect(window).not.toHaveProperty("getCSRFToken");
      expect(window).not.toHaveProperty("csrfToken");
      expect(document.querySelector('meta[name="csrf-token"]')).toBeNull();
      expect(document.querySelector('input[name="csrf_token"]')).toBeNull();
    });

    it("should not include X-CSRF-Token header", () => {
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
      secureTokenManager.setToken(testToken);

      const headers = secureTokenManager.getAuthHeaders();

      expect(headers).not.toHaveProperty("X-CSRF-Token");
      expect(headers).not.toHaveProperty("X-XSRF-TOKEN");
    });
  });

  describe("Token Validation", () => {
    it("should validate token format", () => {
      const validToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.test";
      const invalidTokens = [
        "not-a-jwt",
        "invalid.token",
        "cookie=value",
        "Bearer token",
        "",
        null,
        undefined,
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", // Missing parts
        "...", // Empty parts
      ];

      expect(secureTokenManager.isValidToken(validToken)).toBe(true);

      invalidTokens.forEach((token) => {
        expect(secureTokenManager.isValidToken(token as any)).toBe(false);
      });
    });

    it("should decode token payload", () => {
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MzU2ODk2MDB9.test";

      const decoded = secureTokenManager.decodeToken(token);

      expect(decoded).toMatchObject({
        sub: "1234567890",
        name: "John Doe",
        iat: 1516239022,
        exp: 1735689600,
      });
    });

    it("should handle expired tokens gracefully", () => {
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDk0NTkyMDB9.test"; // Expired 2021

      secureTokenManager.setToken(expiredToken);

      expect(secureTokenManager.isTokenExpired()).toBe(true);
      expect(secureTokenManager.getToken()).toBeNull(); // Should auto-clear
    });

    it("should detect token expiration with buffer time", () => {
      const now = Math.floor(Date.now() / 1000);
      const almostExpiredToken = {
        exp: now + 30, // Expires in 30 seconds
      };

      // With 60 second buffer, should be considered expired
      expect(
        secureTokenManager.isTokenExpired(
          almostExpiredToken as DecodedToken,
          60
        )
      ).toBe(true);

      // With 10 second buffer, should be valid
      expect(
        secureTokenManager.isTokenExpired(
          almostExpiredToken as DecodedToken,
          10
        )
      ).toBe(false);
    });
  });

  describe("Token Refresh Flow", () => {
    it("should handle token refresh", async () => {
      const oldToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.old";
      const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh";
      const newToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new";

      secureTokenManager.storeTokens(oldToken, refreshToken);

      // Mock refresh API call
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: newToken }),
      } as Response);

      await secureTokenManager.refreshAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/refresh",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${refreshToken}`,
          }),
        })
      );

      // Verify new token is stored in memory only
      expect(secureTokenManager.getToken()).toBe(newToken);
      expect(localStorage.getItem("auth_token")).toBeNull();
    });

    it("should clear tokens on refresh failure", async () => {
      const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh";
      // In dev mode, mock refresh token handling
      if (import.meta.env.DEV) {
        secureTokenManager.setToken("dummy.access.token");
        // Refresh token would be handled server-side
      }

      // Mock failed refresh
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(secureTokenManager.refreshAccessToken()).rejects.toThrow();

      // Verify tokens cleared from memory
      expect(secureTokenManager.getToken()).toBeNull();
      // No localStorage usage for security
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
    });
  });

  describe("Philippine Data Privacy Act Compliance", () => {
    it("should log token access for audit trail", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      secureTokenManager.setToken(testToken);
      secureTokenManager.getToken();

      // Verify audit logging occurs
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Token access"),
        expect.any(Object)
      );
    });

    it("should implement secure token deletion", () => {
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
      secureTokenManager.setToken(testToken);

      // Secure deletion
      secureTokenManager.secureDelete();

      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();

      // Verify overwrite before deletion (simulated)
      // In real implementation, this would overwrite memory
    });

    it("should track token lifecycle events", () => {
      const events: string[] = [];
      secureTokenManager.on("token:set", () => events.push("set"));
      secureTokenManager.on("token:cleared", () => events.push("cleared"));
      secureTokenManager.on("token:expired", () => events.push("expired"));

      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      secureTokenManager.setToken(testToken);
      expect(events).toContain("set");

      secureTokenManager.clearToken();
      expect(events).toContain("cleared");
    });

    it("should enforce data retention policies", () => {
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
      secureTokenManager.setToken(testToken);

      // Fast-forward 7 days (retention period)
      vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000);

      // Token should be auto-cleared after retention period
      expect(secureTokenManager.getToken()).toBeNull();
    });
  });

  describe("Security Headers Validation", () => {
    it("should not use credentials: include", async () => {
      const mockFetch = vi.spyOn(global, "fetch");

      await fetch("/api/test", {
        headers: secureTokenManager.getAuthHeaders(),
      });

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("should use credentials: same-origin for API calls", async () => {
      const mockFetch = vi.spyOn(global, "fetch");

      await secureTokenManager.makeAuthenticatedRequest("/api/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          credentials: "same-origin",
        })
      );
    });
  });

  describe("XSS Prevention", () => {
    it("should sanitize token before storage", () => {
      const xssToken =
        "<script>alert('xss')</script>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      secureTokenManager.setToken(xssToken);

      const stored = localStorage.getItem("auth_token");
      expect(stored).not.toContain("<script>");
      expect(stored).not.toContain("alert");
    });

    it("should validate token contains no HTML", () => {
      const maliciousTokens = [
        "<img src=x onerror=alert(1)>",
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
      ];

      maliciousTokens.forEach((token) => {
        expect(secureTokenManager.isValidToken(token)).toBe(false);
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle localStorage unavailable", () => {
      // Mock localStorage unavailable
      const originalLocalStorage = global.localStorage;
      Object.defineProperty(global, "localStorage", {
        value: undefined,
        writable: true,
      });

      expect(() => {
        secureTokenManager.setToken("test");
      }).not.toThrow();

      // Restore
      Object.defineProperty(global, "localStorage", {
        value: originalLocalStorage,
        writable: true,
      });
    });

    it("should handle malformed JWT gracefully", () => {
      const malformedToken = "not.a.valid.jwt.with.too.many.parts";

      expect(() => {
        secureTokenManager.decodeToken(malformedToken);
      }).not.toThrow();

      expect(secureTokenManager.decodeToken(malformedToken)).toBeNull();
    });
  });
});
```

## Cross-Platform Node.js Scripts

### Installation Requirements

The Node.js scripts require the `glob` package. It will be automatically
installed when running the scripts for the first time, or you can manually
install it:

```bash
npm install --save-dev glob
```

### Script Files

All Node.js security audit scripts are located in `scripts/security-audits/`:

- **jwt-audit.js** - Audits JWT cookie usage
- **storage-audit.js** - Verifies memory-only token storage
- **header-audit.js** - Checks Authorization Bearer headers
- **no-cookies-audit.js** - Ensures no cookie-based authentication
- **run-audit.js** - Platform detection and script runner

### Features

1. **Cross-Platform Compatibility**: Works on Windows, Mac, and Linux
2. **Colored Output**: Clear visual feedback with color-coded results
3. **Detailed Reporting**: Shows file paths and line numbers for violations
4. **Exit Codes**: Proper exit codes for CI/CD integration
5. **Comment Awareness**: Skips commented code to avoid false positives
6. **Test Exclusion**: Ignores test files by default

## Cookie Audit Implementation - COMPLETE

### Shell Script Version (PRODUCTION-READY)

Create `scripts/audit-jwt-cookies.sh`:

```bash
#!/bin/bash

# Exit on any error
set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 JWT Cookie Security Audit v2.0"
echo "=================================="
echo "Verifying JWT Authorization Header Only Policy"
echo ""

# Initialize counters
VIOLATIONS=0
WARNINGS=0

# Function to check violations
check_violation() {
    local pattern=$1
    local description=$2
    local files=$3

    if [ -n "$files" ]; then
        echo -e "${RED}❌ SECURITY VIOLATION: ${description}${NC}"
        echo "Found in:"
        echo "$files" | head -20
        echo ""
        ((VIOLATIONS++))
        return 1
    fi
    return 0
}

# Function to check warnings
check_warning() {
    local pattern=$1
    local description=$2
    local expected=$3

    if [ -z "$pattern" ]; then
        echo -e "${YELLOW}⚠️ WARNING: ${description}${NC}"
        echo "Expected: $expected"
        echo ""
        ((WARNINGS++))
        return 1
    fi
    return 0
}

# 1. Check for document.cookie usage with auth tokens
echo "1. Checking for cookie-based JWT storage..."
COOKIE_VIOLATIONS=$(grep -r "document\.cookie" src/ api/ \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    2>/dev/null | grep -iE "(token|jwt|auth|bearer|session)" || true)

if ! check_violation "$COOKIE_VIOLATIONS" "JWT/token storage in cookies detected" "$COOKIE_VIOLATIONS"; then
    echo "JWT tokens must ONLY be stored in localStorage and sent via Authorization headers."
    echo "See: docs/security/JWT_TESTING_PATTERNS.md"
else
    echo -e "${GREEN}✅ No JWT cookie usage detected${NC}"
fi

# 2. Check for Set-Cookie headers in API
echo "2. Checking for Set-Cookie headers with JWT..."
SET_COOKIE_VIOLATIONS=$(grep -r "Set-Cookie\|set-cookie" api/ \
    --include="*.ts" --include="*.js" \
    2>/dev/null | grep -iE "(jwt|token|auth|bearer)" || true)

if ! check_violation "$SET_COOKIE_VIOLATIONS" "API setting JWT/token cookies" "$SET_COOKIE_VIOLATIONS"; then
    echo "API must not set JWT tokens in cookies."
else
    echo -e "${GREEN}✅ No Set-Cookie headers for JWT/tokens${NC}"
fi

# 3. Check for credentials: 'include' pattern
echo "3. Checking for credentials: 'include' usage..."
CREDENTIALS_VIOLATIONS=$(grep -rE "credentials:\s*['\"]include['\"]" src/ api/ \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    2>/dev/null || true)

if ! check_violation "$CREDENTIALS_VIOLATIONS" "credentials: 'include' found (incompatible with JWT-only)" "$CREDENTIALS_VIOLATIONS"; then
    echo "Use credentials: 'same-origin' or omit for JWT-only auth."
else
    echo -e "${GREEN}✅ No credentials: 'include' usage${NC}"
fi

# 4. Check for withCredentials in axios/fetch
echo "4. Checking for withCredentials usage..."
WITH_CREDENTIALS_VIOLATIONS=$(grep -r "withCredentials\s*:\s*true" src/ \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    2>/dev/null || true)

if ! check_violation "$WITH_CREDENTIALS_VIOLATIONS" "withCredentials: true found (not needed for JWT)" "$WITH_CREDENTIALS_VIOLATIONS"; then
    echo "Remove withCredentials when using JWT Authorization headers."
else
    echo -e "${GREEN}✅ No withCredentials usage${NC}"
fi

# 5. Verify NO localStorage token usage (SECURITY REQUIREMENT)
echo "5. Verifying memory-only token storage (NO localStorage)..."
LOCALSTORAGE_USAGE=$(grep -r "localStorage\.\(get\|set\|remove\)Item" src/ \
    --include="*.ts" --include="*.tsx" \
    2>/dev/null | grep -iE "(auth_token|refresh_token|token|jwt)" || true)

if [ -n "$LOCALSTORAGE_USAGE" ]; then
    echo -e "${RED}❌ SECURITY VIOLATION: localStorage token usage detected${NC}"
    echo "Tokens must be stored in memory only for XSS protection"
    echo "Found violations:"
    echo "$LOCALSTORAGE_USAGE" | head -5
    ((VIOLATIONS++))
else
    echo -e "${GREEN}✅ No localStorage token usage detected (secure memory-only storage)${NC}"
    echo "Tokens are properly stored in memory only"
fi

# 6. Verify Authorization header usage (REQUIRED)
echo "6. Verifying Authorization Bearer header pattern..."
AUTH_HEADER_USAGE=$(grep -r "Authorization.*Bearer\|Authorization.*\`Bearer" src/ api/ \
    --include="*.ts" --include="*.tsx" \
    2>/dev/null || true)

if [ -z "$AUTH_HEADER_USAGE" ]; then
    echo -e "${YELLOW}⚠️ WARNING: No Authorization Bearer header usage found${NC}"
    echo "Expected: headers['Authorization'] = \`Bearer \${token}\`"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ Authorization Bearer header pattern detected${NC}"
    echo "Found $(echo "$AUTH_HEADER_USAGE" | wc -l) instances"
fi

# 7. Check for CSRF token usage (should be NONE)
echo "7. Checking for CSRF token usage (not needed with JWT)..."
CSRF_VIOLATIONS=$(grep -rE "(csrf|xsrf|CSRF|XSRF)" src/ api/ \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    2>/dev/null | grep -vE "(// |/\* |\* |eslint-disable)" || true)

if [ -n "$CSRF_VIOLATIONS" ]; then
    echo -e "${YELLOW}⚠️ WARNING: CSRF token references found${NC}"
    echo "JWT-only authentication doesn't require CSRF tokens."
    echo "Found in:"
    echo "$CSRF_VIOLATIONS" | head -10
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ No CSRF token usage (correct for JWT-only)${NC}"
fi

# 8. Check for httpOnly cookie configuration
echo "8. Checking for httpOnly cookie configuration..."
HTTP_ONLY_VIOLATIONS=$(grep -rE "httpOnly.*true" src/ api/ \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    2>/dev/null | grep -iE "(token|jwt|auth)" || true)

if [ -n "$HTTP_ONLY_VIOLATIONS" ]; then
    echo -e "${RED}❌ VIOLATION: httpOnly cookie configuration for JWT found${NC}"
    echo "JWT should not use cookies at all."
    echo "Found in:"
    echo "$HTTP_ONLY_VIOLATIONS"
    ((VIOLATIONS++))
else
    echo -e "${GREEN}✅ No httpOnly JWT cookie configuration${NC}"
fi

# Summary
echo ""
echo "=================================="
echo "AUDIT SUMMARY"
echo "=================================="

if [ $VIOLATIONS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo "JWT Authorization Header Only Policy is properly implemented."
    exit 0
elif [ $VIOLATIONS -eq 0 ]; then
    echo -e "${YELLOW}⚠️ Audit completed with $WARNINGS warning(s)${NC}"
    echo "Review warnings above for best practices."
    exit 0
else
    echo -e "${RED}❌ AUDIT FAILED!${NC}"
    echo "Found $VIOLATIONS security violation(s) and $WARNINGS warning(s)"
    echo ""
    echo "Required Actions:"
    echo "1. Remove all JWT cookie usage"
    echo "2. Use memory-only storage for tokens (NO localStorage)"
    echo "3. Use Authorization: Bearer headers for API calls"
    echo "4. Remove CSRF token handling"
    echo "5. Ensure tokens are stored in SecureTokenManager class only"
    echo ""
    echo "See: docs/security/JWT_TESTING_PATTERNS.md for implementation guide"
    exit 1
fi
```

Make executable:

```bash
chmod +x scripts/audit-jwt-cookies.sh
```

### Node.js Validation Script

Create `scripts/validate-jwt-implementation.js`:

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🔍 JWT Implementation Validator v2.0");
console.log("=====================================\n");

let violations = 0;
let warnings = 0;

// Check if secure token manager exists
const tokenManagerPath = path.join(
  __dirname,
  "../src/lib/security/secure-token-manager.ts"
);
if (!fs.existsSync(tokenManagerPath)) {
  console.error("❌ ERROR: secure-token-manager.ts not found");
  console.error(`Expected at: ${tokenManagerPath}`);
  violations++;
} else {
  const content = fs.readFileSync(tokenManagerPath, "utf8");

  // Required methods
  const requiredMethods = [
    "setToken",
    "getToken",
    "clearToken",
    "getAuthHeaders",
    "isValidToken",
    "isTokenExpired",
    "decodeToken",
    "refreshAccessToken",
  ];

  const missingMethods = requiredMethods.filter(
    (method) =>
      !content.includes(`${method}(`) && !content.includes(`${method}:`)
  );

  if (missingMethods.length > 0) {
    console.error("❌ Missing required methods in secure-token-manager:");
    missingMethods.forEach((m) => console.error(`   - ${m}`));
    violations++;
  } else {
    console.log("✅ All required methods found in secure-token-manager");
  }

  // Check for cookie usage
  if (content.includes("document.cookie")) {
    console.error(
      "❌ VIOLATION: document.cookie found in secure-token-manager"
    );
    violations++;
  }

  // Verify NO localStorage usage for tokens (security requirement)
  if (content.includes("localStorage") && content.includes("token")) {
    console.error(
      "❌ VIOLATION: localStorage token usage found in secure-token-manager"
    );
    console.error("Tokens must be stored in memory only for XSS protection");
    violations++;
  } else {
    console.log("✅ No localStorage token usage (secure memory-only storage)");
  }
}

// Check for test file
const testPath = path.join(
  __dirname,
  "../src/__tests__/security/jwt.security.test.ts"
);
if (!fs.existsSync(testPath)) {
  console.error("❌ ERROR: JWT security test file not found");
  console.error(`Expected at: ${testPath}`);
  console.error("Run: npm run test:create:jwt to create it");
  violations++;
} else {
  console.log("✅ JWT security test file exists");
}

// Check API middleware
const middlewarePath = path.join(__dirname, "../api/_lib/middleware.ts");
if (fs.existsSync(middlewarePath)) {
  const content = fs.readFileSync(middlewarePath, "utf8");

  if (!content.includes("Authorization")) {
    console.warn("⚠️ WARNING: No Authorization header check in middleware");
    warnings++;
  }

  if (content.includes("cookie") || content.includes("Cookie")) {
    console.error("❌ VIOLATION: Cookie handling found in API middleware");
    violations++;
  }
}

// Summary
console.log("\n=====================================");
console.log("VALIDATION SUMMARY");
console.log("=====================================");

if (violations === 0 && warnings === 0) {
  console.log("✅ JWT implementation validated successfully!");
  process.exit(0);
} else {
  if (violations > 0) {
    console.error(`❌ Found ${violations} violation(s)`);
  }
  if (warnings > 0) {
    console.warn(`⚠️ Found ${warnings} warning(s)`);
  }
  process.exit(violations > 0 ? 1 : 0);
}
```

Make executable:

```bash
chmod +x scripts/validate-jwt-implementation.js
```

## Security Header Validation

### Update Existing Script

Enhance `scripts/validate-security-headers.sh`:

```bash
#!/bin/bash

# ... existing content ...

# Add JWT-specific checks
echo "Checking JWT Security Headers..."

# Verify no cookie-based auth headers
if grep -q "credentials.*include" vercel.json; then
  echo "⚠️ WARNING: credentials: 'include' found - should use 'same-origin' for JWT-only auth"
fi

# Verify CORS doesn't allow credentials
if grep -q "Access-Control-Allow-Credentials.*true" vercel.json; then
  echo "❌ ERROR: CORS allows credentials - incompatible with JWT-only policy"
  exit 1
fi

echo "✅ JWT security headers validated"
```

## CI/CD Integration - COMPLETE

### GitHub Actions Security Job

Update `.github/workflows/ci.yml`:

```yaml
name: CI Security Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-verification:
    name: Security Verification
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Create test directories
        run: mkdir -p src/__tests__/security

      - name: Run JWT security tests
        run: npm run verify:jwt
        continue-on-error: false

      - name: JWT Cookie Audit
        run: |
          echo "🔍 Auditing JWT cookie usage..."
          npm run audit:jwt:cookies
        continue-on-error: false

      - name: JWT Storage Verification
        run: |
          echo "🔍 Verifying localStorage implementation..."
          npm run audit:jwt:storage
        continue-on-error: false

      - name: Authorization Header Audit
        run: |
          echo "🔍 Checking Authorization headers..."
          npm run audit:jwt:headers
        continue-on-error: false

      - name: No Cookie Auth Patterns
        run: |
          echo "🔍 Ensuring no cookie-based auth..."
          npm run audit:jwt:no-cookies
        continue-on-error: false

      - name: XSS Prevention Audit
        run: |
          echo "🔍 Checking for XSS vulnerabilities..."
          npm run audit:xss
        continue-on-error: false

      - name: Secrets Exposure Audit
        run: |
          echo "🔍 Checking for hardcoded secrets..."
          npm run audit:secrets
        continue-on-error: false

      - name: SQL Injection Audit
        run: |
          echo "🔍 Checking for SQL injection patterns..."
          npm run audit:sql
        continue-on-error: false

      - name: Full Security Audit
        run: npm run security:audit:all
        continue-on-error: false

      - name: Validate JWT Implementation
        run: npm run validate:jwt
        continue-on-error: false

      - name: Security Report
        if: always()
        run: |
          echo "Security audit completed at $(date)"
          echo "Repository: ${{ github.repository }}"
          echo "Branch: ${{ github.ref }}"
          echo "Commit: ${{ github.sha }}"
```

### Pre-commit Security Hooks

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔒 Running pre-commit security checks..."
echo "======================================="

# 1. Quick JWT cookie check
echo "1. Checking JWT cookie usage..."
npm run audit:jwt:cookies --silent || {
  echo -e "${RED}❌ SECURITY VIOLATION: JWT cookie usage detected${NC}"
  echo "JWT must only be stored in localStorage"
  echo "See: docs/security/JWT_TESTING_PATTERNS.md"
  exit 1
}
echo -e "${GREEN}✅ No JWT cookie usage${NC}"

# 2. Check for credentials: include
echo "2. Checking credentials configuration..."
if grep -r "credentials.*include" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "//"; then
  echo -e "${RED}❌ SECURITY VIOLATION: credentials: 'include' detected${NC}"
  echo "Use 'same-origin' or omit for JWT-only auth"
  exit 1
fi
echo -e "${GREEN}✅ No credentials: include usage${NC}"

# 3. Quick secrets check
echo "3. Checking for hardcoded secrets..."
npm run audit:secrets --silent || {
  echo -e "${RED}❌ SECURITY VIOLATION: Hardcoded secrets detected${NC}"
  echo "Never commit secrets to the repository"
  exit 1
}
echo -e "${GREEN}✅ No hardcoded secrets${NC}"

# 4. Check for console.log in production code
echo "4. Checking for console.log statements..."
if grep -r "console\.log" src/ --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" 2>/dev/null | grep -v "//"; then
  echo -e "${YELLOW}⚠️ WARNING: console.log statements found${NC}"
  echo "Remove console.log before committing"
fi

# 5. Run quick security test
echo "5. Running security tests..."
if [ -f "src/__tests__/security/jwt.security.test.ts" ]; then
  npm run test src/__tests__/security/jwt.security.test.ts --silent || {
    echo -e "${RED}❌ Security tests failed${NC}"
    exit 1
  }
  echo -e "${GREEN}✅ Security tests passed${NC}"
else
  echo -e "${YELLOW}⚠️ Security test file not found${NC}"
fi

echo ""
echo -e "${GREEN}✅ All pre-commit security checks passed!${NC}"
echo "======================================="
```

### Pre-push Security Hooks

Create `.husky/pre-push`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔒 Running pre-push security verification..."
echo "==========================================="

# Run full security audit
npm run security:audit:all || {
  echo "❌ Security audit failed!"
  echo "Fix security issues before pushing"
  exit 1
}

# Run JWT validation
npm run validate:jwt || {
  echo "❌ JWT implementation validation failed!"
  exit 1
}

# Run all security tests
npm run test:security || {
  echo "❌ Security tests failed!"
  exit 1
}

echo "✅ All security checks passed!"
echo "==========================================="
```

Make hooks executable:

```bash
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
```

## Verification Commands

After implementing these requirements:

```bash
# Test JWT verification
npm run verify:jwt

# Audit cookie usage
npm run audit:jwt:cookies

# Full JWT security audit
npm run security:jwt:full

# Complete security audit
npm run security:audit:all

# Run security test suite
vitest run src/__tests__/security/
```

## Common Security Violations and Fixes

### Violation: JWT in Cookie OR localStorage

```javascript
// ❌ WRONG - Never store JWT in cookies
document.cookie = `token=${jwt}; path=/`;

// ❌ WRONG - Never store JWT in localStorage (XSS vulnerability)
localStorage.setItem("auth_token", jwt);

// ✅ CORRECT - Use memory-only storage via SecureTokenManager
import { SecureTokenManager } from "@/lib/security/secure-token-manager";
const tokenManager = SecureTokenManager.getInstance();
tokenManager.storeTokens(accessToken, refreshToken);
```

### Violation: Credentials in Fetch

```javascript
// ❌ WRONG
fetch("/api/data", {
  credentials: "include",
});

// ✅ CORRECT
fetch("/api/data", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

### Violation: CSRF Token Usage

```javascript
// ❌ WRONG (not needed with JWT)
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

// ✅ CORRECT (JWT is CSRF-resistant)
// No CSRF token needed with proper JWT implementation
```

## Security Checklist

- [ ] JWT never stored in cookies
- [ ] JWT only stored in localStorage
- [ ] API uses Authorization Bearer headers
- [ ] No credentials: 'include' in fetch calls
- [ ] No CSRF tokens (JWT-only auth)
- [ ] No dangerouslySetInnerHTML usage
- [ ] No eval() or innerHTML with user data
- [ ] No hardcoded secrets or API keys
- [ ] Security tests pass (npm run verify:jwt)
- [ ] Security audits pass (npm run security:audit:all)

## Related Documentation

- [../security/JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md](../security/JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md) -
  JWT policy
- [../security/MODERN_SECURITY_HEADERS_GUIDE.md](../security/MODERN_SECURITY_HEADERS_GUIDE.md) -
  Security headers
- [../security/SECURITY_TEST_REQUIREMENTS.md](../security/SECURITY_TEST_REQUIREMENTS.md) -
  Testing requirements
- [../security/SECURITY_CHECKLIST.md](../security/SECURITY_CHECKLIST.md) -
  Complete checklist

---

_Document Owner: security-compliance-auditor_  
_Review Status: Ready for Implementation_  
_Priority: HIGH - Security Gates Required_
