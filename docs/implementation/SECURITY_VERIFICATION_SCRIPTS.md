# Security Verification Scripts Requirements

## Overview

This document specifies the security verification scripts required to enforce
JWT-only authentication and prevent security regressions. It ensures the
codebase maintains strict security standards throughout the TDD process.

**Owner**: security-compliance-auditor  
**Status**: Required for Phase 1 Security Gates  
**Last Updated**: August 31, 2025

## Critical Security Scripts

### 1. JWT Verification Scripts

Add these scripts to package.json:

```json
{
  "scripts": {
    // Primary JWT verification
    "verify:jwt": "vitest run src/__tests__/security/jwt.security.test.ts && npm run audit:jwt:cookies",

    // Audit for JWT cookie usage (should find none)
    "audit:jwt:cookies": "! grep -r 'document.cookie' src/ | grep -i 'token\\|jwt\\|auth' || (echo '✅ No JWT cookie usage detected' && exit 0)",

    // Verify localStorage-only token storage
    "audit:jwt:storage": "grep -r 'localStorage.*token\\|sessionStorage.*token' src/ || (echo '⚠️ No token storage found - verify implementation' && exit 1)",

    // Check for Authorization header usage
    "audit:jwt:headers": "grep -r 'Authorization.*Bearer' src/ || (echo '⚠️ No Authorization header usage found' && exit 1)",

    // Complete JWT security audit
    "security:jwt:full": "npm run verify:jwt && npm run audit:jwt:storage && npm run audit:jwt:headers"
  }
}
```

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

### Required Test File

Create `src/__tests__/security/jwt.security.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { secureTokenManager } from "@/lib/security/secure-token-manager";

describe("JWT Security Verification", () => {
  beforeEach(() => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "";
  });

  describe("Token Storage Security", () => {
    it("should NEVER store JWT in cookies", () => {
      // Attempt to set token
      secureTokenManager.setToken("test-token");

      // Verify no cookies were set
      expect(document.cookie).toBe("");
      expect(document.cookie).not.toContain("token");
      expect(document.cookie).not.toContain("jwt");
      expect(document.cookie).not.toContain("auth");
    });

    it("should store JWT only in localStorage", () => {
      const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

      secureTokenManager.setToken(testToken);

      // Should be in localStorage
      expect(localStorage.getItem("auth_token")).toBeTruthy();
      // Should NOT be in sessionStorage
      expect(sessionStorage.getItem("auth_token")).toBeNull();
      // Should NOT be in cookies
      expect(document.cookie).toBe("");
    });

    it("should clear token from all storage on logout", () => {
      // Set token
      secureTokenManager.setToken("test-token");

      // Clear token
      secureTokenManager.clearToken();

      // Verify cleared from all possible locations
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(sessionStorage.getItem("auth_token")).toBeNull();
      expect(document.cookie).toBe("");
    });
  });

  describe("Authorization Header Security", () => {
    it("should use Authorization header for API calls", async () => {
      const mockFetch = vi.spyOn(global, "fetch");
      const testToken = "test-jwt-token";

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

      secureTokenManager.setToken("test-token");

      // Make API call
      await fetch("/api/test", {
        headers: secureTokenManager.getAuthHeaders(),
      });

      // Verify no Cookie header
      const calls = mockFetch.mock.calls;
      calls.forEach((call) => {
        const headers = call[1]?.headers;
        expect(headers).not.toHaveProperty("Cookie");
        expect(headers).not.toHaveProperty("cookie");
      });
    });
  });

  describe("CSRF Protection", () => {
    it("should not require CSRF tokens (JWT-only auth)", () => {
      // Verify no CSRF token functions exist
      expect(window).not.toHaveProperty("getCSRFToken");
      expect(document.querySelector('meta[name="csrf-token"]')).toBeNull();
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
        "",
        null,
        undefined,
      ];

      expect(secureTokenManager.isValidToken(validToken)).toBe(true);

      invalidTokens.forEach((token) => {
        expect(secureTokenManager.isValidToken(token as any)).toBe(false);
      });
    });

    it("should handle expired tokens gracefully", () => {
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDk0NTkyMDB9.test"; // Expired 2021

      secureTokenManager.setToken(expiredToken);

      expect(secureTokenManager.isTokenExpired()).toBe(true);
      expect(secureTokenManager.getToken()).toBeNull(); // Should auto-clear
    });
  });
});
```

## Cookie Audit Implementation

### Shell Script Version

Create `scripts/audit-jwt-cookies.sh`:

```bash
#!/bin/bash

echo "🔒 JWT Cookie Security Audit"
echo "=============================="

# Check for cookie usage with JWT/token/auth
COOKIE_VIOLATIONS=$(grep -r "document.cookie" src/ api/ | grep -iE "jwt|token|auth" || true)

if [ -n "$COOKIE_VIOLATIONS" ]; then
  echo "❌ SECURITY VIOLATION: JWT/token storage in cookies detected!"
  echo ""
  echo "Found in:"
  echo "$COOKIE_VIOLATIONS"
  echo ""
  echo "JWT tokens must ONLY be stored in localStorage and sent via Authorization headers."
  echo "See: docs/security/JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md"
  exit 1
else
  echo "✅ No JWT cookie usage detected"
fi

# Check for Set-Cookie headers in API
SET_COOKIE_VIOLATIONS=$(grep -r "Set-Cookie" api/ | grep -iE "jwt|token|auth" || true)

if [ -n "$SET_COOKIE_VIOLATIONS" ]; then
  echo "❌ SECURITY VIOLATION: API setting JWT/token cookies!"
  echo ""
  echo "Found in:"
  echo "$SET_COOKIE_VIOLATIONS"
  exit 1
else
  echo "✅ No Set-Cookie headers for JWT/tokens"
fi

# Verify localStorage usage
LOCALSTORAGE_USAGE=$(grep -r "localStorage" src/lib/security/ | grep -iE "token|jwt" || true)

if [ -z "$LOCALSTORAGE_USAGE" ]; then
  echo "⚠️ WARNING: No localStorage token usage found in security lib"
  echo "Verify token storage implementation"
else
  echo "✅ localStorage token storage detected"
fi

# Verify Authorization header usage
AUTH_HEADER_USAGE=$(grep -r "Authorization.*Bearer" src/ api/ || true)

if [ -z "$AUTH_HEADER_USAGE" ]; then
  echo "⚠️ WARNING: No Authorization Bearer header usage found"
  echo "Verify API authentication implementation"
else
  echo "✅ Authorization Bearer header pattern detected"
fi

echo ""
echo "Audit complete!"
```

Make executable:

```bash
chmod +x scripts/audit-jwt-cookies.sh
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

## CI/CD Integration

### GitHub Actions Security Job

```yaml
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

    - name: Run JWT security tests
      run: npm run verify:jwt

    - name: Audit JWT cookie usage
      run: npm run audit:jwt:cookies

    - name: Audit token storage
      run: npm run audit:jwt:storage

    - name: Audit Authorization headers
      run: npm run audit:jwt:headers

    - name: Run XSS audit
      run: npm run audit:xss

    - name: Run secrets audit
      run: npm run audit:secrets

    - name: Validate security headers
      run: npm run security:headers
```

## Pre-commit Security Hooks

Add to `.husky/pre-commit`:

```bash
# Security audits
echo "🔒 Running security audits..."

# Quick JWT cookie check
npm run audit:jwt:cookies || {
  echo "❌ Security violation: JWT cookie usage detected"
  echo "JWT must only be stored in localStorage"
  exit 1
}

# Quick secrets check
npm run audit:secrets || {
  echo "❌ Security violation: Hardcoded secrets detected"
  exit 1
}

echo "✅ Security audits passed"
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

### Violation: JWT in Cookie

```javascript
// ❌ WRONG
document.cookie = `token=${jwt}; path=/`;

// ✅ CORRECT
localStorage.setItem("auth_token", jwt);
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
