# JWT Storage Implementation Guide

## Overview

This guide enforces the **MEMORY-ONLY** JWT storage strategy for the Okaeri
Resort System. This document serves as the definitive implementation reference,
prohibiting both cookie storage AND localStorage, mandating memory-only storage
with Authorization header transmission.

**Owner**: security-compliance-auditor  
**Status**: Authoritative Implementation Standard  
**Last Updated**: September 1, 2025  
**Priority**: CRITICAL - Security Architecture

## Core Security Principle

**JWTs are stored EXCLUSIVELY in memory (JavaScript variables) and transmitted
ONLY via Authorization headers.**

### Why Memory-Only Architecture

1. **XSS Protection**: Tokens in memory cannot be accessed by injected scripts
   via localStorage/sessionStorage
2. **CSRF Immunity**: Authorization headers are never automatically included by
   browsers
3. **No Persistence Attack Vector**: Tokens are cleared on page refresh/close
4. **Simplified Security**: No browser storage API vulnerabilities
5. **Explicit Control**: Developers must intentionally manage token lifecycle

## Storage Implementation

### Environment-Specific Storage Mechanisms

#### Production: Memory-Only Storage (REQUIRED)

**Configuration**: Automatic - no configuration needed **Enforcement**: Strict -
violations cause security audit failures

#### Development Mode Token Persistence

The system supports optional token persistence in development mode ONLY for mock
authentication scenarios. This is designed to improve developer experience
during testing while maintaining strict security in production.

##### When Development Persistence is Enabled:

**Conditions** (ALL must be true):

1. `import.meta.env.DEV === true` (Development build)
2. `VITE_MOCK_AUTH === "true"` (Mock authentication enabled)
3. Using mock tokens only (not real authentication)

**Behavior**:

- Tokens stored in memory (primary)
- Mock tokens also persisted to sessionStorage (convenience)
- Tokens survive page refresh within same tab
- Tokens cleared when tab closes
- Security audits skip sessionStorage checks in this mode

##### Configuration:

```bash
# .env.development - Enable mock auth with persistence
VITE_MOCK_AUTH="true"  # Enables mock authentication mode
# No separate flag needed - sessionStorage automatically enabled for mock auth

# To disable persistence even in mock mode:
VITE_MOCK_AUTH="false"  # Disables mock auth and any persistence
```

##### Security Boundaries:

```typescript
// The ONLY approved use of sessionStorage for tokens
private isDevelopmentMockAuth(): boolean {
  return (
    import.meta.env.DEV &&  // Must be development build
    ((window as any).__VITE_ENV__?.VITE_MOCK_AUTH === "true" ||
     import.meta.env.VITE_MOCK_AUTH === "true")
  );
}

// Usage is strictly gated
if (this.isDevelopmentMockAuth()) {
  // ONLY mock tokens, ONLY in dev, ONLY when explicitly enabled
  sessionStorage.setItem("mock_access_token", mockToken);
}
```

#### Memory-Only Storage (DEFAULT)

```typescript
// src/lib/security/secure-token-manager.ts

export class SecureTokenManager {
  private static instance: SecureTokenManager;

  // Memory-only storage - not accessible via window object
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenFingerprint: string | null = null;

  /**
   * Store JWT in memory ONLY - NEVER in localStorage or cookies
   * @throws {Error} If token validation fails
   */
  storeTokens(accessToken: string, refreshToken?: string): void {
    this.validateToken(accessToken);
    this.preventBrowserStorage();

    // Store in memory only
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }

    this.auditTokenOperation("token_stored", { storage: "memory" });
    this.setupTokenRefresh();
  }

  /**
   * Retrieve access token from memory
   */
  getAccessToken(): string | null {
    if (!this.accessToken) return null;

    // Validate token is still valid
    if (this.isTokenExpired(this.accessToken)) {
      this.clearTokens();
      return null;
    }

    return this.accessToken;
  }

  /**
   * Clear all tokens from memory
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenFingerprint = null;

    // Ensure no browser storage contamination
    this.preventBrowserStorage();

    this.auditTokenOperation("tokens_cleared", { storage: "memory" });
  }

  /**
   * Prevent any browser storage usage (security enforcement)
   */
  private preventBrowserStorage(): void {
    // Critical: Ensure tokens are NEVER in browser storage
    const storageKeys = ["auth_token", "refresh_token", "jwt", "token"];

    storageKeys.forEach((key) => {
      // Clear any existing tokens from browser storage
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    // Clear any token cookies
    document.cookie.split(";").forEach((cookie) => {
      const [name] = cookie.split("=");
      if (storageKeys.some((key) => name.trim().toLowerCase().includes(key))) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  }
}
```

### Prohibited Storage Mechanisms

#### ❌ localStorage (ALWAYS FORBIDDEN)

```typescript
// NEVER DO THIS - XSS Vulnerability
localStorage.setItem("auth_token", token); // ❌ FORBIDDEN in all environments
localStorage.setItem("jwt", token); // ❌ FORBIDDEN in all environments
```

#### ❌ sessionStorage (FORBIDDEN IN PRODUCTION)

```typescript
// Production & Test Environments
sessionStorage.setItem("auth_token", token); // ❌ FORBIDDEN
sessionStorage.setItem("jwt", token); // ❌ FORBIDDEN

// Development with Mock Auth ONLY
if (this.isDevelopmentMockAuth()) {
  // ✅ ALLOWED: Mock tokens only, dev mode only
  sessionStorage.setItem("mock_access_token", mockToken);
  sessionStorage.setItem("mock_refresh_token", mockRefreshToken);
}
```

#### ❌ Cookies (FORBIDDEN)

```typescript
// NEVER DO THIS - Not our authentication pattern
document.cookie = `token=${jwt}; path=/`; // ❌ FORBIDDEN
response.setHeader("Set-Cookie", `jwt=${token}`); // ❌ FORBIDDEN
```

## Token Transmission

### Authorization Header (REQUIRED)

```typescript
// src/lib/api-client.ts

class ApiClient {
  private tokenManager = SecureTokenManager.getInstance();

  async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.tokenManager.getAccessToken();

    const headers = new Headers(options.headers);

    // ALWAYS use Authorization header for JWT transmission
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // NEVER include credentials
    return fetch(url, {
      ...options,
      headers,
      credentials: "omit", // Critical: Never send cookies
    });
  }
}
```

## Security Verification Scripts

### Package.json Scripts

```json
{
  "scripts": {
    "audit:jwt:storage": "bash -c \"! grep -r 'localStorage.*token\\|localStorage.*jwt\\|localStorage.*auth' src/ --include='*.ts' --include='*.tsx' --exclude-dir='__tests__' --exclude='*.test.ts' --exclude='*.test.tsx' && echo '✅ No localStorage token usage detected (secure memory-only storage)' || (echo '❌ ERROR: localStorage token usage detected - security violation! Tokens must be stored in memory only' && exit 1)\"",
    "audit:jwt:cookies": "bash -c \"! grep -r 'document\\.cookie' src/ api/ --include='*.ts' --include='*.tsx' | grep -iE '(token|jwt|auth|bearer|session)' || (echo '✅ No JWT cookie usage detected' && exit 0)\"",
    "audit:jwt:headers": "bash -c \"grep -r 'Authorization.*Bearer' src/ api/ --include='*.ts' --include='*.tsx' && echo '✅ Authorization Bearer headers detected' || (echo '⚠️ WARNING: No Authorization Bearer headers found' && exit 1)\"",
    "audit:jwt:production": "bash -c \"if [ \\\"$NODE_ENV\\\" = 'production' ]; then ! grep -r 'sessionStorage.*token\\|sessionStorage.*jwt' src/ --include='*.ts' --include='*.tsx' || (echo '❌ ERROR: sessionStorage token usage in production!' && exit 1); fi\"",
    "security:jwt:full": "npm run audit:jwt:storage && npm run audit:jwt:cookies && npm run audit:jwt:headers"
  }
}
```

**Note**: The `audit:jwt:production` script specifically checks for
sessionStorage usage in production builds. Development mode with
`VITE_MOCK_AUTH=true` is exempt from this check.

## Testing Requirements

### Security Test Suite

```typescript
// src/__tests__/security/jwt.security.test.ts

describe("JWT Storage Security", () => {
  let tokenManager: SecureTokenManager;

  beforeEach(() => {
    tokenManager = SecureTokenManager.getInstance();
    tokenManager.clearTokens();

    // Clear any browser storage
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "";
  });

  it("should store tokens in memory only", () => {
    const accessToken = "test.access.token";
    const refreshToken = "test.refresh.token";

    tokenManager.storeTokens(accessToken, refreshToken);

    // Verify tokens are accessible from memory
    expect(tokenManager.getAccessToken()).toBe(accessToken);

    // Critical: Verify NO browser storage
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(sessionStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("refresh_token")).toBeNull();
    expect(document.cookie).not.toContain("token");
    expect(document.cookie).not.toContain("jwt");
  });

  it("should clear any existing browser storage on init", () => {
    // Simulate contaminated browser storage
    localStorage.setItem("auth_token", "contaminated");
    sessionStorage.setItem("jwt", "contaminated");
    document.cookie = "token=contaminated; path=/";

    // Initialize token manager
    tokenManager.storeTokens("clean.token");

    // Verify browser storage is cleared
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("jwt")).toBeNull();
    expect(document.cookie).not.toContain("token");
  });

  it("should include token in Authorization header only", async () => {
    const token = "test.jwt.token";
    tokenManager.storeTokens(token);

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const client = new ApiClient();
    await client.request("/api/data");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/data",
      expect.objectContaining({
        headers: expect.any(Headers),
        credentials: "omit",
      })
    );

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.get("Authorization")).toBe(`Bearer ${token}`);
  });
});
```

## Implementation Checklist

### Security Requirements

- [ ] Use SecureTokenManager for all token operations
- [ ] Store tokens in memory variables only (production)
- [ ] Never use localStorage for tokens (any environment)
- [ ] Never use sessionStorage for real tokens (only mock tokens in dev)
- [ ] Never use cookies for JWT tokens
- [ ] Always transmit via Authorization header
- [ ] Clear browser storage on initialization
- [ ] Implement token refresh in memory
- [ ] Clear tokens on logout
- [ ] Validate tokens before storage
- [ ] Gate sessionStorage usage with `isDevelopmentMockAuth()` check
- [ ] Ensure `VITE_MOCK_AUTH` is not set in production configs

### Code Review Checklist

- [ ] No `localStorage.setItem` with token/jwt/auth (any environment)
- [ ] No unguarded `sessionStorage.setItem` with tokens
- [ ] All sessionStorage usage wrapped in `isDevelopmentMockAuth()` check
- [ ] No `document.cookie` assignments with tokens
- [ ] No `credentials: 'include'` in fetch calls
- [ ] All API calls use Authorization header
- [ ] Token manager is singleton instance
- [ ] Tokens cleared on security events
- [ ] Production builds never persist tokens
- [ ] Mock auth flag only in development configs

## Security Rationale

### Why NOT localStorage?

1. **XSS Vulnerability**: Any injected script can read
   `localStorage.getItem('token')`
2. **Persistence**: Tokens remain after tab close, increasing attack window
3. **Cross-Origin**: Can be accessed by any script on the same origin
4. **No Automatic Expiry**: Requires manual cleanup

### Why NOT Cookies?

1. **CSRF Risk**: Even with SameSite, still requires additional protections
2. **Complexity**: Requires careful configuration of security attributes
3. **Debugging**: Harder to inspect and manage in development
4. **Not Our Pattern**: We use Authorization headers exclusively

### Why Memory-Only?

1. **XSS Mitigation**: Injected scripts cannot access JavaScript memory directly
2. **Automatic Cleanup**: Tokens cleared on page refresh/close
3. **Reduced Attack Surface**: No browser API vulnerabilities
4. **Explicit Lifecycle**: Clear token management boundaries

## Common Violations and Fixes

### Violation: Token in localStorage

```typescript
// ❌ WRONG
const token = localStorage.getItem("auth_token");
localStorage.setItem("auth_token", newToken);

// ✅ CORRECT
const tokenManager = SecureTokenManager.getInstance();
const token = tokenManager.getAccessToken();
tokenManager.storeTokens(newToken);
```

### Violation: Token in Cookie

```typescript
// ❌ WRONG
document.cookie = `jwt=${token}; path=/`;
fetch("/api/data", { credentials: "include" });

// ✅ CORRECT
fetch("/api/data", {
  headers: {
    Authorization: `Bearer ${tokenManager.getAccessToken()}`,
  },
  credentials: "omit",
});
```

### Violation: Direct Token Variable

```typescript
// ❌ WRONG
let globalToken = null;
window.authToken = token; // Exposed to window

// ✅ CORRECT
// Use SecureTokenManager encapsulation
const tokenManager = SecureTokenManager.getInstance();
tokenManager.storeTokens(token);
```

## Enforcement

### CI/CD Pipeline

```yaml
# .github/workflows/security.yml
- name: JWT Security Audit
  run: |
    npm run audit:jwt:storage
    npm run audit:jwt:cookies
    npm run audit:jwt:headers
```

### Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

npm run security:jwt:full
if [ $? -ne 0 ]; then
  echo "❌ JWT security violations detected. Commit blocked."
  exit 1
fi
```

## References

- [OWASP Token Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html#token-storage-on-client-side)
- [SecureTokenManager Implementation](../src/lib/security/secure-token-manager.ts)
- [Security Test Suite](../src/__tests__/security/jwt.security.test.ts)
- [Memory-Only JWT Storage Update](./MEMORY_ONLY_JWT_STORAGE_UPDATE.md)

---

**Document Status**: AUTHORITATIVE  
**Compliance**: MANDATORY  
**Review Cycle**: Security Team Approval Required for Changes
