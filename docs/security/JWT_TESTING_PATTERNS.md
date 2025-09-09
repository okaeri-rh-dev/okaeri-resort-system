# JWT Testing Patterns and Security Guidelines

> **⚠️ LEGACY COMPLIANCE WARNING**
>
> This document has been updated to reflect the current system scope as an
> internal family business management tool. Previous government regulatory
> compliance references have been transformed to reflect internal operational
> requirements. The system handles only staff data and internal operations, not
> customer personal data or payment processing.

## Overview

This document provides comprehensive testing patterns and security guidelines
for JWT (JSON Web Token) implementation in the Okaeri Resort System. It enforces
the **JWT Authorization Header Only Policy** - a critical security architecture
decision that eliminates CSRF vulnerabilities and simplifies authentication
flow.

**Owner**: security-compliance-auditor  
**Status**: Authoritative Security Standard  
**Last Updated**: August 31, 2025  
**Priority**: CRITICAL - Security Foundation

## Table of Contents

1. [JWT Authorization Header Only Policy](#jwt-authorization-header-only-policy)
2. [Security Test Patterns](#security-test-patterns)
3. [Audit Script Rationale](#audit-script-rationale)
4. [Philippine Compliance Requirements](#philippine-compliance-requirements)
5. [Implementation Patterns](#implementation-patterns)
6. [Common Mistakes and Prevention](#common-mistakes-and-prevention)
7. [Testing Checklist](#testing-checklist)

## JWT Authorization Header Only Policy

### Core Principle

**JWTs are transmitted EXCLUSIVELY via Authorization headers. NO cookies. NO
exceptions.**

### Why NO Cookies for JWT

#### 1. CSRF Immunity

- Authorization headers are not automatically included in cross-origin requests
- Eliminates entire class of CSRF vulnerabilities
- No need for CSRF tokens, double-submit cookies, or SameSite configurations

#### 2. Simpler Architecture

- One authentication mechanism instead of two
- No cookie parsing or management code
- Cleaner separation between client and server
- Easier to reason about security boundaries

#### 3. Better for APIs

- Works identically for web, mobile, and third-party integrations
- No special handling for different client types
- Consistent authentication across all endpoints

#### 4. Explicit Security

- Developer must explicitly attach token to each request
- No implicit authentication that could be exploited
- Clear visibility into when authentication is used

### Security Benefits

```typescript
// ✅ SECURE: Explicit token attachment
const response = await fetch("/api/bookings", {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});

// ❌ VULNERABLE: Cookie-based auth (DO NOT USE)
const response = await fetch("/api/bookings", {
  credentials: "include", // Vulnerable to CSRF
});
```

### Implementation Requirements

1. **Storage**: Memory-only via SecureTokenManager class (NO
   localStorage/sessionStorage/cookies)
2. **Transmission**: Authorization: Bearer header only
3. **No Cookie Headers**: Never Set-Cookie, never document.cookie
4. **No CSRF Tokens**: Not needed with header-only approach
5. **XSS Protection**: Memory storage prevents script access, plus CSP and input
   sanitization

## Security Test Patterns

### Token Lifecycle Testing

#### Creation and Storage

```typescript
describe("Token Creation", () => {
  it("should store token in memory only (NOT in browser storage)", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

    secureTokenManager.storeTokens(token);

    // Verify memory storage
    expect(secureTokenManager.getAccessToken()).toBe(token);

    // Verify NO localStorage (security best practice)
    expect(localStorage.getItem("auth_token")).toBeNull();

    // Verify NO cookie storage
    expect(document.cookie).toBe("");
    expect(document.cookie).not.toContain("token");

    // Verify NO sessionStorage (except mock mode)
    if (!import.meta.env.VITE_MOCK_AUTH) {
      expect(sessionStorage.getItem("auth_token")).toBeNull();
    }
  });

  it("should validate token format before storage", () => {
    const invalidTokens = [
      "not-a-jwt",
      "<script>alert('xss')</script>",
      "javascript:alert(1)",
      null,
      undefined,
      "",
    ];

    invalidTokens.forEach((token) => {
      expect(() => secureTokenManager.storeTokens(token)).toThrow();
    });

    // Verify nothing stored in memory or browser storage
    expect(secureTokenManager.getAccessToken()).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});
```

#### Refresh Flow

```typescript
describe("Token Refresh", () => {
  it("should refresh token using refresh token", async () => {
    const oldAccessToken = generateToken({ exp: Date.now() / 1000 + 60 }); // 1 minute
    const refreshToken = generateToken({ exp: Date.now() / 1000 + 604800 }); // 7 days
    const newAccessToken = generateToken({ exp: Date.now() / 1000 + 900 }); // 15 minutes

    secureTokenManager.setToken(oldAccessToken);
    secureTokenManager.setRefreshToken(refreshToken);

    // Mock refresh endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: newAccessToken,
        refreshToken: refreshToken, // Same or rotated
      }),
    });

    await secureTokenManager.refreshAccessToken();

    // Verify refresh used correct header
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/refresh", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${refreshToken}`,
        "Content-Type": "application/json",
      },
    });

    // Verify new token stored
    expect(localStorage.getItem("auth_token")).toBe(newAccessToken);
  });

  it("should handle refresh failure gracefully", async () => {
    const refreshToken = "expired.refresh.token";
    secureTokenManager.setRefreshToken(refreshToken);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    await expect(secureTokenManager.refreshAccessToken()).rejects.toThrow();

    // Should clear all tokens on refresh failure
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});
```

#### Expiration Handling

```typescript
describe("Token Expiration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should detect expired tokens", () => {
    const expiredToken = generateToken({
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    });

    secureTokenManager.setToken(expiredToken);

    expect(secureTokenManager.isTokenExpired()).toBe(true);
    expect(secureTokenManager.getToken()).toBeNull(); // Auto-cleared
  });

  it("should refresh before expiration with buffer", () => {
    const almostExpiredToken = generateToken({
      exp: Math.floor(Date.now() / 1000) + 30, // Expires in 30 seconds
    });

    secureTokenManager.setToken(almostExpiredToken);

    // With 60 second buffer, should trigger refresh
    expect(secureTokenManager.shouldRefresh(60)).toBe(true);
  });

  it("should auto-refresh on API calls", async () => {
    const expiredToken = generateToken({
      exp: Math.floor(Date.now() / 1000) + 10, // Expires soon
    });

    secureTokenManager.setToken(expiredToken);

    const refreshSpy = vi.spyOn(secureTokenManager, "refreshAccessToken");

    await secureTokenManager.makeAuthenticatedRequest("/api/test");

    expect(refreshSpy).toHaveBeenCalled();
  });
});
```

### Storage Security Verification

```typescript
describe("Storage Security", () => {
  it("should never read tokens from cookies or localStorage", () => {
    // Simulate malicious cookie
    document.cookie = "auth_token=stolen.jwt.token; path=/";
    // Simulate malicious localStorage
    localStorage.setItem("auth_token", "stolen.jwt.token");

    // Token manager should only use memory storage
    const token = secureTokenManager.getAccessToken();

    expect(token).toBeNull(); // Should ignore both cookie and localStorage
  });

  it("should work perfectly when localStorage is unavailable", () => {
    const originalLocalStorage = global.localStorage;
    const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";

    // Simulate localStorage blocked
    Object.defineProperty(global, "localStorage", {
      get: () => {
        throw new Error("Blocked");
      },
    });

    // Memory-only storage should work regardless
    expect(() => secureTokenManager.storeTokens(testToken)).not.toThrow();
    expect(secureTokenManager.getAccessToken()).toBe(testToken);

    // Restore
    Object.defineProperty(global, "localStorage", {
      value: originalLocalStorage,
    });
  });

  it("should implement secure deletion", () => {
    const token = "sensitive.jwt.token";
    secureTokenManager.setToken(token);

    secureTokenManager.secureDelete();

    // Verify complete removal
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();

    // In production, would overwrite memory
  });
});
```

### XSS Prevention Testing

```typescript
describe("XSS Prevention", () => {
  it("should sanitize tokens before storage", () => {
    const xssPayloads = [
      "<script>alert('xss')</script>",
      "javascript:alert(1)",
      "<img src=x onerror=alert(1)>",
      "data:text/html,<script>alert(1)</script>",
    ];

    xssPayloads.forEach((payload) => {
      expect(() => secureTokenManager.setToken(payload)).toThrow();
    });
  });

  it("should validate token structure", () => {
    const malformedTokens = [
      "abc", // Too short
      "a.b", // Missing third part
      "a.b.c.d.e", // Too many parts
      btoa("<script>alert(1)</script>"), // Base64 XSS
    ];

    malformedTokens.forEach((token) => {
      expect(secureTokenManager.isValidToken(token)).toBe(false);
    });
  });

  it("should escape token in error messages", () => {
    const xssToken = "<script>alert('xss')</script>";

    try {
      secureTokenManager.setToken(xssToken);
    } catch (error) {
      expect(error.message).not.toContain("<script>");
      expect(error.message).toContain("&lt;script&gt;");
    }
  });
});
```

## Audit Script Rationale

### Why Automated Audits Are Critical

1. **Human Error Prevention**: Developers might accidentally use cookies during
   refactoring
2. **Regression Detection**: Catches security regressions before they reach
   production
3. **Compliance Verification**: Ensures ongoing compliance with security
   policies
4. **Fast Feedback**: Immediate detection in pre-commit hooks
5. **Documentation**: Scripts serve as executable security specifications

### What Each Audit Script Checks

#### `audit:jwt:cookies`

- **Purpose**: Ensure zero JWT storage in cookies
- **Checks**:
  - No `document.cookie` usage with auth tokens
  - No `Set-Cookie` headers for JWTs
  - No cookie parsing libraries for auth
- **Failure Action**: Block commit/deployment

#### `audit:jwt:storage`

- **Purpose**: Verify proper localStorage implementation
- **Checks**:
  - Token storage in localStorage
  - Proper key naming (auth_token, refresh_token)
  - No sessionStorage usage
- **Failure Action**: Require implementation fix

#### `audit:jwt:headers`

- **Purpose**: Confirm Authorization header usage
- **Checks**:
  - Bearer token pattern in API calls
  - Proper header formatting
  - No credentials: include
- **Failure Action**: Review API implementation

#### `audit:jwt:no-cookies`

- **Purpose**: Prevent cookie-based auth patterns
- **Checks**:
  - No withCredentials: true
  - No credentials: include
  - No httpOnly cookie configs
- **Failure Action**: Remove cookie patterns

### How to Interpret Results

#### Success Output

```bash
✅ No JWT cookie usage detected
✅ localStorage token storage verified
✅ Authorization Bearer headers detected
✅ No cookie-based auth patterns
```

#### Failure Output

```bash
❌ SECURITY VIOLATION: JWT/token storage in cookies detected!
Found in:
src/lib/auth.ts:45: document.cookie = `token=${jwt}`;

Required Actions:
1. Remove all JWT cookie usage
2. Use localStorage for token storage
3. Use Authorization: Bearer headers
```

### Integration with CI/CD Gates

```yaml
# GitHub Actions Example
- name: JWT Security Gate
  run: |
    npm run security:jwt:full || {
      echo "::error::JWT security violations detected"
      exit 1
    }
  continue-on-error: false # Fail the build
```

## Internal Data Management Requirements

### Internal Data Protection Standards

#### Authentication Requirements

1. **Audit Logging**

```typescript
interface AuthAuditLog {
  timestamp: Date;
  userId: string;
  action: "login" | "logout" | "token_refresh" | "token_expired";
  ipAddress: string;
  userAgent: string;
  success: boolean;
  reason?: string; // For failures
}

// Implementation
secureTokenManager.on("token:set", (event) => {
  auditLogger.log({
    timestamp: new Date(),
    userId: event.userId,
    action: "login",
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    success: true,
  });
});
```

2. **Data Retention**

```typescript
// Tokens must be deleted after retention period
const TOKEN_RETENTION_DAYS = 7;
const AUDIT_LOG_RETENTION_DAYS = 365; // 1 year for compliance

// Auto-cleanup implementation
setInterval(
  () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TOKEN_RETENTION_DAYS);

    cleanupExpiredTokens(cutoffDate);
    cleanupOldAuditLogs(cutoffDate);
  },
  24 * 60 * 60 * 1000
); // Daily
```

3. **User Consent Tracking**

```typescript
interface ConsentRecord {
  userId: string;
  consentType: "data_processing" | "marketing" | "analytics";
  granted: boolean;
  timestamp: Date;
  ipAddress: string;
  version: string; // Privacy policy version
}

// Must track consent before processing
const verifyConsent = async (userId: string): Promise<boolean> => {
  const consent = await getLatestConsent(userId, "data_processing");
  return consent?.granted === true;
};
```

#### Security Breach Notification

```typescript
// Required within 72 hours of discovery
interface BreachNotification {
  detectTime: Date;
  affectedUsers: string[];
  dataTypes: ("personal" | "financial" | "sensitive")[];
  measures: string[];
  notificationSent: Date;
}

const handleSecurityBreach = async (breach: SecurityBreach) => {
  // 1. Contain the breach
  await revokeAllTokens();

  // 2. Document the incident
  await logBreachDetails(breach);

  // 3. Notify internal management
  await notifyInternalManagement(breach);

  // 4. Notify affected users
  await notifyAffectedUsers(breach.affectedUserIds);
};
```

### Internal Financial Management

#### Internal Audit Requirements

```typescript
// All financial transactions must be internally auditable
interface FinancialAudit {
  transactionId: string;
  timestamp: Date;
  userId: string;
  amount: number;
  currency: "PHP";
  type: "booking" | "payment" | "refund";
  taxAmount: number;
  authToken: string; // Hash of token used for internal audit
}
```

## Implementation Patterns

### Secure Token Manager Pattern

```typescript
// src/lib/security/secure-token-manager.ts
export class SecureTokenManager {
  private static instance: SecureTokenManager;

  // Memory-only storage - not accessible via window object
  private accessToken: string | null = null;
  private tokenFingerprint: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  private static readonly TOKEN_REGEX =
    /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;

  static getInstance(): SecureTokenManager {
    if (!SecureTokenManager.instance) {
      SecureTokenManager.instance = new SecureTokenManager();
    }
    return SecureTokenManager.instance;
  }

  storeTokens(accessToken: string, refreshToken?: string): void {
    // Validate token format
    if (!this.isValidToken(accessToken)) {
      throw new Error("Invalid token format");
    }

    // Check for XSS attempts
    if (this.containsHtml(accessToken)) {
      throw new Error("Token contains invalid characters");
    }

    // Store in memory only (never localStorage)
    this.accessToken = accessToken;
    this.tokenFingerprint = this.generateFingerprint();

    // Schedule automatic refresh
    this.scheduleTokenRefresh(accessToken);

    // Emit event for monitoring
    this.emitEvent("token:set");
  }

  getAccessToken(): string | null {
    // NEVER read from cookies or localStorage
    // ONLY return from memory

    // Validate fingerprint hasn't changed (detect token theft)
    const currentFingerprint = this.generateFingerprint();
    if (this.tokenFingerprint && this.tokenFingerprint !== currentFingerprint) {
      console.error("Token fingerprint mismatch - possible token theft");
      this.clearTokens();
      return null;
    }

    if (this.accessToken && this.isTokenExpired(this.accessToken)) {
      this.clearTokens();
      return null;
    }

    return this.accessToken;
  }

  static getAuthHeaders(): Record<string, string> {
    const token = this.getToken();

    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  static async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // Auto-refresh if needed
    if (this.shouldRefresh()) {
      await this.refreshAccessToken();
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...this.getAuthHeaders(),
      },
      credentials: "same-origin", // NEVER 'include'
    });
  }

  private static isValidToken(token: string): boolean {
    if (!token || typeof token !== "string") return false;
    return this.TOKEN_REGEX.test(token);
  }

  private static containsHtml(str: string): boolean {
    const htmlRegex = /<[^>]*>/g;
    return htmlRegex.test(str);
  }

  private static isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload?.exp) return true;

      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true;
    }
  }
}
```

### React/TanStack Query Integration

```typescript
// src/hooks/useAuth.ts
export const useAuth = () => {
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) throw new Error("Login failed");

      const { accessToken, refreshToken } = await response.json();

      // Store tokens in memory via SecureTokenManager
      secureTokenManager.storeTokens(accessToken, refreshToken);

      return { accessToken, refreshToken };
    },
    onSuccess: () => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries(["user"]);
    },
  });

  const logout = useMutation({
    mutationFn: async () => {
      // Call logout endpoint
      await SecureTokenManager.makeAuthenticatedRequest("/api/auth/logout", {
        method: "POST",
      });

      // Clear tokens from memory
      secureTokenManager.clearTokens();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
    },
  });

  return { login, logout };
};
```

### API Client Pattern

```typescript
// src/lib/api-client.ts
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "/api") {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Use SecureTokenManager for all requests
    const response = await SecureTokenManager.makeAuthenticatedRequest(url, {
      ...options,
      headers: {
        ...options.headers,
        ...SecureTokenManager.getAuthHeaders(),
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try refresh
        await SecureTokenManager.refreshAccessToken();
        // Retry request
        return this.request(endpoint, options);
      }

      throw new ApiError(response.status, await response.text());
    }

    return response.json();
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export const apiClient = new ApiClient();
```

## Common Mistakes and Prevention

### Mistake 1: Using Cookies for JWT

❌ **WRONG**:

```typescript
// Never do this!
document.cookie = `token=${jwt}; path=/; secure; httpOnly`;

// Also wrong - localStorage is vulnerable to XSS
localStorage.setItem("auth_token", jwt);

// Also wrong
fetch("/api/data", {
  credentials: "include", // Sends cookies
});
```

✅ **CORRECT**:

```typescript
// Always use memory-only storage via SecureTokenManager
secureTokenManager.storeTokens(jwt);

// Always use Authorization header
fetch("/api/data", {
  headers: {
    Authorization: `Bearer ${secureTokenManager.getAccessToken()}`,
  },
});
```

### Mistake 2: Using localStorage or sessionStorage

❌ **WRONG**:

```typescript
// localStorage is vulnerable to XSS
localStorage.setItem("token", jwt);

// sessionStorage is also vulnerable to XSS
sessionStorage.setItem("token", jwt);
```

✅ **CORRECT**:

```typescript
// Memory-only storage is XSS-resistant
secureTokenManager.storeTokens(jwt);
```

### Mistake 3: Not Validating Tokens

❌ **WRONG**:

```typescript
const setToken = (token: any) => {
  this.accessToken = token; // No validation!
};
```

✅ **CORRECT**:

```typescript
storeTokens(token: string) {
  if (!this.isValidJwtFormat(token)) {
    throw new Error('Invalid token format');
  }
  if (this.containsHtmlOrScript(token)) {
    throw new Error('Token contains invalid characters');
  }
  // Store in memory only after validation
  this.accessToken = token;
  this.tokenFingerprint = this.generateFingerprint();
}
```

### Mistake 4: Including CSRF Tokens

❌ **WRONG**:

```typescript
// CSRF tokens not needed with JWT headers
const csrfToken = document.querySelector("[name=csrf-token]").content;
headers["X-CSRF-Token"] = csrfToken;
```

✅ **CORRECT**:

```typescript
// JWT in Authorization header provides CSRF protection
headers["Authorization"] = `Bearer ${token}`;
// No CSRF token needed!
```

### Mistake 5: Using credentials: 'include'

❌ **WRONG**:

```typescript
fetch("/api/data", {
  credentials: "include", // Sends cookies
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

✅ **CORRECT**:

```typescript
fetch("/api/data", {
  credentials: "same-origin", // Or omit entirely
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

## Testing Checklist

### Pre-Development

- [ ] Review JWT Authorization Header Only Policy
- [ ] Set up SecureTokenManager class with memory-only storage
- [ ] Configure test environment
- [ ] Install security audit scripts

### During Development

- [ ] Write security tests first (TDD)
- [ ] Never use document.cookie for auth
- [ ] Never use localStorage/sessionStorage for tokens (XSS vulnerable)
- [ ] Always use memory-only storage via SecureTokenManager
- [ ] Always use Authorization headers
- [ ] Validate all token inputs
- [ ] Handle token expiration
- [ ] Implement token refresh flow

### Pre-Commit

- [ ] Run `npm run audit:jwt:cookies` (ensure no cookie usage)
- [ ] Run `npm run audit:jwt:storage` (ensure NO localStorage usage)
- [ ] Run `npm run audit:jwt:headers` (verify Bearer headers)
- [ ] Run `npm run test:security`
- [ ] Review security violations

### Pre-Deployment

- [ ] Run `npm run security:audit:all`
- [ ] Run `npm run validate:jwt`
- [ ] Verify CI/CD security gates pass
- [ ] Review audit logs
- [ ] Confirm Philippine compliance

### Post-Deployment

- [ ] Monitor authentication errors
- [ ] Review security audit logs
- [ ] Check for unusual token patterns
- [ ] Verify no cookie usage in production
- [ ] Validate internal status reports

## Remediation Guide

### If Cookies Are Found

1. **Immediate Actions**:

   ```bash
   # Find all cookie usage
   grep -r "document.cookie" src/ api/
   grep -r "Set-Cookie" api/
   grep -r "credentials.*include" src/
   ```

2. **Fix Implementation**:

   ```typescript
   // Replace cookie or localStorage storage
   // FROM:
   document.cookie = `token=${jwt}`;
   // OR FROM:
   localStorage.setItem("auth_token", jwt);

   // TO:
   secureTokenManager.storeTokens(jwt);
   ```

3. **Update API Calls**:

   ```typescript
   // FROM:
   fetch(url, { credentials: "include" });

   // TO:
   fetch(url, {
     headers: {
       Authorization: `Bearer ${token}`,
     },
   });
   ```

4. **Verify Fix**:
   ```bash
   npm run security:jwt:full
   ```

### If Tests Fail

1. **Check Test Output**:

   ```bash
   npm run test:security -- --reporter=verbose
   ```

2. **Fix Violations**:
   - Review failed test cases
   - Update implementation
   - Re-run tests

3. **Verify Compliance**:
   ```bash
   npm run validate:jwt
   ```

## Related Documentation

- [SECURITY_VERIFICATION_SCRIPTS.md](../implementation/SECURITY_VERIFICATION_SCRIPTS.md) -
  Audit script specifications
- [JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md](./JWT_AUTHORIZATION_HEADER_ONLY_POLICY.md) -
  Policy details
- [MODERN_SECURITY_HEADERS_GUIDE.md](./MODERN_SECURITY_HEADERS_GUIDE.md) -
  Security headers
- [SECURITY_TEST_REQUIREMENTS.md](./SECURITY_TEST_REQUIREMENTS.md) - Testing
  standards
- [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - Security validation

## Support

For security questions or concerns:

- **Security Issues**: security-compliance-auditor agent
- **Implementation**: typescript-react-quality-expert agent
- **Internal Management**: Family business coordinator

---

_Document Owner: security-compliance-auditor_  
_Classification: Security Critical_  
_Review Frequency: Monthly_  
_Last Security Audit: August 31, 2025_
