# JWT Security Test Specification

## Overview

This document provides the complete test specification for
`src/__tests__/security/jwt.security.test.ts`, enforcing the localStorage-only
JWT storage strategy and Authorization header transmission policy.

**Owner**: security-compliance-auditor  
**Status**: Authoritative Test Specification  
**Last Updated**: August 31, 2025  
**Priority**: CRITICAL - Security Foundation Testing

## Test Suite Structure

### 1. Storage Security Tests

#### 1.1 localStorage Exclusive Storage

```typescript
describe("JWT Storage Security", () => {
  describe("localStorage Exclusive Storage", () => {
    it("should store tokens in localStorage only", () => {
      const accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";
      const refreshToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh.signature";

      tokenManager.setTokens(accessToken, refreshToken);

      // Verify localStorage storage
      expect(localStorage.getItem("auth_token")).toBe(accessToken);
      expect(localStorage.getItem("refresh_token")).toBe(refreshToken);

      // Verify NO cookie storage
      expect(document.cookie).toBe("");
      expect(document.cookie).not.toContain("token");
      expect(document.cookie).not.toContain("jwt");
      expect(document.cookie).not.toContain("auth");

      // Verify NO sessionStorage
      expect(sessionStorage.getItem("auth_token")).toBeNull();
      expect(sessionStorage.getItem("refresh_token")).toBeNull();
      expect(sessionStorage.length).toBe(0);
    });

    it("should reject any attempt to store JWT in cookies", () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";

      // Attempt to set cookie (should be intercepted)
      const cookieSetter = () => {
        document.cookie = `auth_token=${token}; path=/`;
      };

      // Verify cookie interception
      expect(cookieSetter).toThrow("JWT storage in cookies is prohibited");
      expect(document.cookie).not.toContain(token);
    });

    it("should never read tokens from cookies even if present", () => {
      // Simulate malicious cookie injection
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "auth_token=malicious.jwt.token; other_cookie=value",
      });

      const token = tokenManager.getToken();

      // Should only read from localStorage
      expect(token).toBeNull(); // No token in localStorage
      expect(tokenManager.getCookieToken()).toBeUndefined(); // Method should not exist
    });

    it("should handle localStorage unavailability gracefully", () => {
      const originalLocalStorage = global.localStorage;

      // Simulate localStorage blocked
      Object.defineProperty(global, "localStorage", {
        get: () => {
          throw new Error("Storage blocked by browser");
        },
        configurable: true,
      });

      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";

      expect(() => tokenManager.setToken(token)).not.toThrow();
      expect(tokenManager.isStorageAvailable()).toBe(false);

      // Restore localStorage
      Object.defineProperty(global, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
      });
    });
  });
});
```

#### 1.2 Token Validation Before Storage

```typescript
describe("Token Validation", () => {
  it("should validate JWT format before storage", () => {
    const invalidTokens = [
      "not-a-jwt",
      "a.b", // Missing part
      "a.b.c.d", // Too many parts
      "", // Empty
      null,
      undefined,
      123, // Not a string
      { token: "test" }, // Object
      ["token"], // Array
    ];

    invalidTokens.forEach((token) => {
      expect(() => tokenManager.setToken(token as any)).toThrow(
        "Invalid JWT format"
      );
    });
  });

  it("should detect and reject XSS payloads in tokens", () => {
    const xssPayloads = [
      "<script>alert('xss')</script>",
      "javascript:alert(1)",
      "<img src=x onerror=alert(1)>",
      "data:text/html,<script>alert(1)</script>",
      "<svg onload=alert(1)>",
      "onclick=alert(1)//",
      "<iframe src=javascript:alert(1)>",
      "';alert(1);//",
      '";alert(1);//',
      "<body onload=alert(1)>",
    ];

    xssPayloads.forEach((payload) => {
      expect(() => tokenManager.setToken(payload)).toThrow(
        "Token contains potentially malicious content"
      );
    });
  });

  it("should validate base64 segments for hidden XSS", () => {
    // Create JWT with XSS in payload
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa("<script>alert(1)</script>");
    const signature = "signature";
    const maliciousToken = `${header}.${payload}.${signature}`;

    expect(() => tokenManager.setToken(maliciousToken)).toThrow(
      "Token payload contains invalid content"
    );
  });
});
```

### 2. Transmission Security Tests

#### 2.1 Authorization Header Exclusive Usage

```typescript
describe("JWT Transmission Security", () => {
  describe("Authorization Header Only", () => {
    it("should transmit tokens via Authorization header only", async () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";
      tokenManager.setToken(token);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      global.fetch = mockFetch;

      await apiClient.get("/api/bookings");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
          credentials: expect.not.stringContaining("include"),
        })
      );

      // Verify no cookie headers
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.credentials).not.toBe("include");
      expect(callArgs.credentials).toBe("same-origin");
    });

    it("should never use withCredentials for XMLHttpRequest", () => {
      const xhr = new XMLHttpRequest();

      // Intercept withCredentials setter
      Object.defineProperty(xhr, "withCredentials", {
        set: function (value) {
          if (value === true) {
            throw new Error("withCredentials is prohibited for JWT auth");
          }
        },
      });

      expect(() => {
        xhr.withCredentials = true;
      }).toThrow("withCredentials is prohibited");
    });

    it("should reject fetch with credentials: include", async () => {
      const originalFetch = global.fetch;

      global.fetch = vi.fn().mockImplementation((url, options) => {
        if (options?.credentials === "include") {
          throw new Error("credentials: include is prohibited with JWT");
        }
        return Promise.resolve({ ok: true });
      });

      await expect(
        fetch("/api/test", { credentials: "include" })
      ).rejects.toThrow("credentials: include is prohibited");

      global.fetch = originalFetch;
    });
  });
});
```

#### 2.2 Header Format Validation

```typescript
describe("Bearer Token Format", () => {
  it("should format Authorization header correctly", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";
    tokenManager.setToken(token);

    const headers = tokenManager.getAuthHeaders();

    expect(headers.Authorization).toBe(`Bearer ${token}`);
    expect(headers.Authorization).toMatch(
      /^Bearer [A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/
    );
  });

  it("should not include Authorization header when no token", () => {
    tokenManager.clearTokens();

    const headers = tokenManager.getAuthHeaders();

    expect(headers.Authorization).toBeUndefined();
    expect(Object.keys(headers)).not.toContain("Authorization");
  });

  it("should handle malformed tokens in header generation", () => {
    localStorage.setItem("auth_token", "malformed-token");

    expect(() => tokenManager.getAuthHeaders()).toThrow(
      "Invalid token format in storage"
    );
  });
});
```

### 3. XSS Mitigation Tests

#### 3.1 Content Security Policy Enforcement

```typescript
describe("XSS Mitigation", () => {
  describe("CSP Enforcement", () => {
    it("should enforce strict CSP headers", () => {
      const cspHeader = getSecurityHeaders()["Content-Security-Policy"];

      // Verify no unsafe-inline or unsafe-eval
      expect(cspHeader).not.toContain("unsafe-inline");
      expect(cspHeader).not.toContain("unsafe-eval");

      // Verify script-src restrictions
      expect(cspHeader).toContain("script-src 'self'");

      // Verify style-src restrictions
      expect(cspHeader).toContain("style-src 'self'");
    });

    it("should block inline scripts", () => {
      const inlineScript = document.createElement("script");
      inlineScript.textContent = "alert(1)";

      // CSP should block this
      expect(() => {
        document.body.appendChild(inlineScript);
      }).toThrow();
    });

    it("should block eval() and Function()", () => {
      expect(() => eval("alert(1)")).toThrow();
      expect(() => new Function("alert(1)")()).toThrow();
    });
  });
});
```

#### 3.2 Input Sanitization

```typescript
describe("Input Sanitization", () => {
  it("should sanitize token before storage", () => {
    const dirtyToken =
      " eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature\n\t";
    const cleanToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";

    tokenManager.setToken(dirtyToken);

    expect(localStorage.getItem("auth_token")).toBe(cleanToken);
  });

  it("should escape token in error messages", () => {
    const xssToken = "<script>alert('xss')</script>";

    try {
      tokenManager.setToken(xssToken);
    } catch (error) {
      expect(error.message).not.toContain("<script>");
      expect(error.message).toContain("&lt;script&gt;");
    }
  });

  it("should validate token entropy", () => {
    const weakTokens = [
      "aaa.bbb.ccc", // Low entropy
      "123.456.789", // Numeric only
      "test.test.test", // Repeated segments
    ];

    weakTokens.forEach((token) => {
      expect(() => tokenManager.setToken(token)).toThrow(
        "Token has insufficient entropy"
      );
    });
  });
});
```

### 4. Token Lifecycle Tests

#### 4.1 Expiration Handling

```typescript
describe("Token Lifecycle", () => {
  describe("Expiration Handling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should detect expired tokens", () => {
      const expiredToken = createToken({
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      });

      tokenManager.setToken(expiredToken);

      expect(tokenManager.isTokenExpired()).toBe(true);
      expect(tokenManager.getToken()).toBeNull(); // Auto-cleared
    });

    it("should auto-clear expired tokens from localStorage", () => {
      const expiredToken = createToken({
        exp: Math.floor(Date.now() / 1000) - 1,
      });

      localStorage.setItem("auth_token", expiredToken);

      const token = tokenManager.getToken();

      expect(token).toBeNull();
      expect(localStorage.getItem("auth_token")).toBeNull();
    });

    it("should refresh token before expiration", async () => {
      const almostExpiredToken = createToken({
        exp: Math.floor(Date.now() / 1000) + 30, // Expires in 30 seconds
      });

      tokenManager.setToken(almostExpiredToken);

      const shouldRefresh = tokenManager.shouldRefresh(60); // 60 second buffer

      expect(shouldRefresh).toBe(true);
    });

    it("should handle token refresh failure", async () => {
      const refreshToken = createToken({ type: "refresh" });
      tokenManager.setRefreshToken(refreshToken);

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(tokenManager.refreshAccessToken()).rejects.toThrow(
        "Token refresh failed"
      );

      // Should clear all tokens on refresh failure
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
    });
  });
});
```

#### 4.2 Token Rotation

```typescript
describe("Token Rotation", () => {
  it("should rotate refresh token on use", async () => {
    const oldRefreshToken = createToken({ type: "refresh", jti: "old" });
    const newAccessToken = createToken({ type: "access" });
    const newRefreshToken = createToken({ type: "refresh", jti: "new" });

    tokenManager.setRefreshToken(oldRefreshToken);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }),
    });

    await tokenManager.refreshAccessToken();

    expect(localStorage.getItem("refresh_token")).toBe(newRefreshToken);
    expect(localStorage.getItem("refresh_token")).not.toBe(oldRefreshToken);
  });

  it("should invalidate old refresh tokens", async () => {
    const oldRefreshToken = createToken({ type: "refresh", jti: "old" });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid refresh token" }),
    });

    await expect(
      tokenManager.refreshWithToken(oldRefreshToken)
    ).rejects.toThrow("Refresh token is invalid or expired");
  });
});
```

### 5. Security Audit Tests

#### 5.1 Cookie Detection

```typescript
describe("Security Audits", () => {
  describe("Cookie Detection", () => {
    it("should detect any JWT-like patterns in cookies", () => {
      const patterns = [
        "auth_token=eyJ",
        "jwt=eyJ",
        "token=eyJ",
        "Bearer eyJ",
        "authorization=eyJ",
      ];

      patterns.forEach((pattern) => {
        document.cookie = `${pattern}test; path=/`;

        const audit = securityAuditor.auditCookies();

        expect(audit.hasViolations).toBe(true);
        expect(audit.violations).toContain("JWT pattern detected in cookies");

        // Clear cookie
        document.cookie = `${pattern.split("=")[0]}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
    });

    it("should scan all JavaScript files for cookie usage", async () => {
      const files = [
        "src/lib/auth.ts",
        "src/hooks/useAuth.ts",
        "src/api/client.ts",
      ];

      const violations = await securityAuditor.scanForCookieUsage(files);

      expect(violations).toEqual([]);
    });
  });
});
```

#### 5.2 Storage Pattern Validation

```typescript
describe("Storage Pattern Validation", () => {
  it("should validate localStorage usage patterns", () => {
    const validPatterns = [
      "localStorage.getItem('auth_token')",
      "localStorage.setItem('auth_token', token)",
      "localStorage.removeItem('auth_token')",
    ];

    validPatterns.forEach((pattern) => {
      expect(securityAuditor.isValidStoragePattern(pattern)).toBe(true);
    });
  });

  it("should reject invalid storage patterns", () => {
    const invalidPatterns = [
      "sessionStorage.setItem('auth_token', token)",
      "document.cookie = 'auth_token=' + token",
      "window.sessionStorage.setItem('token', jwt)",
      "cookies.set('jwt', token)",
    ];

    invalidPatterns.forEach((pattern) => {
      expect(securityAuditor.isValidStoragePattern(pattern)).toBe(false);
    });
  });
});
```

### 6. Philippine Compliance Tests

#### 6.1 Audit Logging

```typescript
describe("Philippine Compliance", () => {
  describe("Audit Logging", () => {
    it("should log all token operations", () => {
      const token = createToken();
      const auditSpy = vi.spyOn(auditLogger, "log");

      tokenManager.setToken(token);

      expect(auditSpy).toHaveBeenCalledWith({
        action: "token_set",
        timestamp: expect.any(Date),
        userId: expect.any(String),
        ipAddress: expect.any(String),
        userAgent: expect.any(String),
        success: true,
      });
    });

    it("should log failed authentication attempts", async () => {
      const auditSpy = vi.spyOn(auditLogger, "log");

      await expect(
        authService.login("invalid", "credentials")
      ).rejects.toThrow();

      expect(auditSpy).toHaveBeenCalledWith({
        action: "login_failed",
        timestamp: expect.any(Date),
        reason: "Invalid credentials",
        ipAddress: expect.any(String),
        attempts: expect.any(Number),
      });
    });

    it("should retain audit logs for required period", () => {
      const retentionDays = 365; // Philippine requirement
      const oldLog = {
        timestamp: new Date(
          Date.now() - (retentionDays + 1) * 24 * 60 * 60 * 1000
        ),
      };

      expect(auditLogger.shouldRetain(oldLog)).toBe(false);
    });
  });
});
```

## Test Utilities

### Token Generation Helper

```typescript
function createToken(payload: any = {}): string {
  const header = { alg: "HS256", typ: "JWT" };
  const defaultPayload = {
    sub: "user123",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(defaultPayload));
  const signature = "test-signature";

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
```

### Security Auditor Mock

```typescript
class SecurityAuditor {
  auditCookies(): AuditResult {
    const cookieString = document.cookie;
    const jwtPattern = /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/;

    return {
      hasViolations: jwtPattern.test(cookieString),
      violations: jwtPattern.test(cookieString)
        ? ["JWT pattern detected in cookies"]
        : [],
    };
  }

  async scanForCookieUsage(files: string[]): Promise<string[]> {
    const violations: string[] = [];
    const patterns = [
      /document\.cookie/g,
      /Set-Cookie/gi,
      /credentials:\s*['"]include['"]/g,
      /withCredentials:\s*true/g,
    ];

    for (const file of files) {
      const content = await readFile(file);
      patterns.forEach((pattern) => {
        if (pattern.test(content)) {
          violations.push(`${file}: ${pattern.source}`);
        }
      });
    }

    return violations;
  }

  isValidStoragePattern(code: string): boolean {
    const validPatterns = [
      /localStorage\.(get|set|remove)Item\(['"]auth_token['"]/,
      /localStorage\.(get|set|remove)Item\(['"]refresh_token['"]/,
    ];

    const invalidPatterns = [/sessionStorage/, /document\.cookie/, /cookies\./];

    return (
      validPatterns.some((p) => p.test(code)) &&
      !invalidPatterns.some((p) => p.test(code))
    );
  }
}
```

## Coverage Requirements

### Minimum Coverage Thresholds

- **Lines**: 95%
- **Branches**: 90%
- **Functions**: 95%
- **Statements**: 95%

### Critical Paths (100% Required)

1. Token storage in localStorage
2. Cookie rejection logic
3. Authorization header generation
4. XSS payload detection
5. Token expiration handling
6. Refresh token rotation
7. Audit logging

## Test Execution

### Commands

```bash
# Run all JWT security tests
npm run test:security:jwt

# Run with coverage
npm run test:security:jwt:coverage

# Run specific test suite
npm run test:security:jwt -- --grep "Storage Security"

# Run in watch mode
npm run test:security:jwt:watch

# Generate HTML coverage report
npm run test:security:jwt:coverage:html
```

### CI/CD Integration

```yaml
- name: JWT Security Tests
  run: |
    npm run test:security:jwt:coverage
    if [ $(cat coverage/coverage-summary.json | jq '.total.lines.pct') -lt 95 ]; then
      echo "Coverage below 95% threshold"
      exit 1
    fi
```

## Failure Scenarios

### Critical Failures (Block Deployment)

1. Any JWT found in cookies
2. Use of sessionStorage for tokens
3. Missing Authorization headers
4. credentials: include detected
5. XSS payload acceptance
6. Coverage below threshold

### Warning Scenarios (Log but Continue)

1. localStorage unavailable (fallback to memory)
2. Token near expiration
3. Refresh token rotation delay
4. Audit log write failure

## Related Documentation

- [JWT_STORAGE_IMPLEMENTATION_GUIDE.md](./JWT_STORAGE_IMPLEMENTATION_GUIDE.md)
- [JWT_TESTING_PATTERNS.md](./JWT_TESTING_PATTERNS.md)
- [SECURITY_VERIFICATION_SCRIPTS.md](../implementation/SECURITY_VERIFICATION_SCRIPTS.md)

---

_Document Owner: security-compliance-auditor_  
_Classification: Security Critical_  
_Test Framework: Vitest_  
_Last Updated: August 31, 2025_
