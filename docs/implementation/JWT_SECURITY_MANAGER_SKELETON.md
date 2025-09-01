# JWT Security Manager Skeleton Requirements

## Overview

This document specifies the minimal JWT Security Manager skeleton that MUST
exist before Phase 1 RED tests can run. Without this file, the JWT security
tests will fail immediately with import errors, blocking the TDD workflow.

**Owner**: security-compliance-auditor  
**Status**: Critical Pre-Phase 1 Requirement  
**Last Updated**: August 31, 2025  
**Priority**: BLOCKING - Required for RED tests to execute

## Table of Contents

1. [Why This Skeleton Is Required](#why-this-skeleton-is-required)
2. [Complete Minimal Implementation](#complete-minimal-implementation)
3. [Required Exports Reference](#required-exports-reference)
4. [Package.json Scaffold Command](#packagejson-scaffold-command)
5. [Integration with Phase 1 Requirements](#integration-with-phase-1-requirements)
6. [Verification Steps](#verification-steps)

## Why This Skeleton Is Required

### Immediate Blocking Issue

The security verification scripts at
`src/__tests__/security/jwt.security.test.ts` import from
`@/lib/security/secure-token-manager`, which expects:

```typescript
import { secureTokenManager } from "@/lib/security/secure-token-manager";
```

**Without this file, the following failures occur:**

1. **Import Error**: `Cannot find module '@/lib/security/secure-token-manager'`
2. **Test Suite Failure**: All JWT security tests fail before execution
3. **CI/CD Blocked**: Security gates cannot run
4. **TDD Workflow Broken**: Cannot see RED tests for implementation guidance

### TDD Workflow Impact

In proper TDD:

1. **RED**: Tests must run and fail (not error on import)
2. **GREEN**: Implementation makes tests pass
3. **REFACTOR**: Improve implementation while maintaining green

The skeleton enables step 1 by allowing tests to execute and show specific
failures.

## Complete Minimal Implementation

Create `src/lib/security/secure-token-manager.ts`:

```typescript
/**
 * JWT Security Manager Skeleton
 *
 * This is a minimal skeleton implementation that allows RED tests to run.
 * It provides all required exports with failing implementations that will
 * guide TDD development during Phase 1.
 *
 * IMPORTANT: This skeleton is intentionally incomplete. The failing tests
 * will guide the actual implementation.
 */

import type { DecodedToken } from "@/types/auth";

// Event listener type for token lifecycle
type TokenEventHandler = () => void;
type TokenEvent = "token:set" | "token:cleared" | "token:expired";

// Storage for event handlers
const eventHandlers: Map<TokenEvent, TokenEventHandler[]> = new Map();

/**
 * Secure Token Manager Skeleton
 * All methods return failing implementations to enable RED tests
 */
export const secureTokenManager = {
  /**
   * Set the access token in storage
   * RED TEST: Should store in memory only, never in cookies or localStorage
   */
  setToken(token: string): void {
    // Skeleton: Do nothing - tests will fail and guide implementation
    console.warn("setToken: Not implemented - RED test phase");
  },

  /**
   * Get the current access token
   * RED TEST: Should retrieve from memory only
   */
  getToken(): string | null {
    // Skeleton: Always return null - tests will fail
    console.warn("getToken: Not implemented - RED test phase");
    return null;
  },

  /**
   * Clear the access token from storage
   * RED TEST: Should remove from memory
   */
  clearToken(): void {
    // Skeleton: Do nothing - tests will fail
    console.warn("clearToken: Not implemented - RED test phase");
  },

  /**
   * Get headers for authenticated requests
   * RED TEST: Should return Authorization Bearer header when token exists
   */
  getAuthHeaders(): Record<string, string> {
    // Skeleton: Return minimal headers - Authorization test will fail
    console.warn("getAuthHeaders: Not implemented - RED test phase");
    return {
      "Content-Type": "application/json",
    };
  },

  /**
   * Set the refresh token in storage
   * RED TEST: Should store in localStorage separately from access token
   */
  setRefreshToken(token: string): void {
    // Skeleton: Do nothing - tests will fail
    console.warn("setRefreshToken: Not implemented - RED test phase");
  },

  /**
   * Get the current refresh token
   * RED TEST: Should retrieve from localStorage
   */
  getRefreshToken(): string | null {
    // Skeleton: Always return null - tests will fail
    console.warn("getRefreshToken: Not implemented - RED test phase");
    return null;
  },

  /**
   * Clear the refresh token from storage
   * RED TEST: Should remove from memory
   */
  clearRefreshToken(): void {
    // Skeleton: Do nothing - tests will fail
    console.warn("clearRefreshToken: Not implemented - RED test phase");
  },

  /**
   * Decode a JWT token payload
   * RED TEST: Should parse and return token payload
   */
  decodeToken(token: string): DecodedToken | null {
    // Skeleton: Always return null - tests will fail
    console.warn("decodeToken: Not implemented - RED test phase");
    return null;
  },

  /**
   * Validate JWT token format
   * RED TEST: Should validate three-part JWT structure
   */
  isValidToken(token: string | null | undefined): boolean {
    // Skeleton: Always return false - tests will fail
    console.warn("isValidToken: Not implemented - RED test phase");
    return false;
  },

  /**
   * Check if token is expired
   * RED TEST: Should check exp claim against current time
   */
  isTokenExpired(token?: DecodedToken, bufferSeconds?: number): boolean {
    // Skeleton: Always return true - tests will fail
    console.warn("isTokenExpired: Not implemented - RED test phase");
    return true;
  },

  /**
   * Refresh the access token using refresh token
   * RED TEST: Should call /api/auth/refresh endpoint
   */
  async refreshAccessToken(): Promise<void> {
    // Skeleton: Always reject - tests will fail
    console.warn("refreshAccessToken: Not implemented - RED test phase");
    throw new Error("refreshAccessToken not implemented - RED test phase");
  },

  /**
   * Securely delete all tokens
   * RED TEST: Should clear all tokens and overwrite memory
   */
  secureDelete(): void {
    // Skeleton: Do nothing - tests will fail
    console.warn("secureDelete: Not implemented - RED test phase");
  },

  /**
   * Register event listener for token lifecycle
   * RED TEST: Should emit events for token operations
   */
  on(event: TokenEvent, handler: TokenEventHandler): void {
    // Skeleton: Basic event registration (won't emit)
    console.warn(
      `on: Event ${event} registered but not implemented - RED test phase`
    );
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, []);
    }
    eventHandlers.get(event)?.push(handler);
  },

  /**
   * Make authenticated request with auto token attachment
   * RED TEST: Should attach Authorization header automatically
   */
  async makeAuthenticatedRequest(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    // Skeleton: Basic fetch without auth - tests will fail
    console.warn("makeAuthenticatedRequest: Not implemented - RED test phase");
    return fetch(url, options || {});
  },
};

// Export type for TypeScript usage
export type SecureTokenManager = typeof secureTokenManager;
```

## Required Exports Reference

### Core Token Management

| Export       | Type                      | Purpose               | Test Expectation                        |
| ------------ | ------------------------- | --------------------- | --------------------------------------- |
| `setToken`   | `(token: string) => void` | Store access token    | Memory only, no cookies or localStorage |
| `getToken`   | `() => string \| null`    | Retrieve access token | From memory only                        |
| `clearToken` | `() => void`              | Remove access token   | Clear from memory                       |

### Refresh Token Management

| Export              | Type                      | Purpose                | Test Expectation                                  |
| ------------------- | ------------------------- | ---------------------- | ------------------------------------------------- |
| `setRefreshToken`   | `(token: string) => void` | Store refresh token    | Server-side only (httpOnly cookies in production) |
| `getRefreshToken`   | `() => string \| null`    | Retrieve refresh token | Not accessible client-side in production          |
| `clearRefreshToken` | `() => void`              | Remove refresh token   | Clear from memory                                 |

### Token Validation

| Export           | Type                                                 | Purpose             | Test Expectation           |
| ---------------- | ---------------------------------------------------- | ------------------- | -------------------------- |
| `isValidToken`   | `(token: any) => boolean`                            | Validate JWT format | Three-part structure check |
| `decodeToken`    | `(token: string) => DecodedToken \| null`            | Parse JWT payload   | Base64 decode and parse    |
| `isTokenExpired` | `(token?: DecodedToken, buffer?: number) => boolean` | Check expiration    | Compare exp claim to now   |

### HTTP Integration

| Export                     | Type                                                        | Purpose             | Test Expectation             |
| -------------------------- | ----------------------------------------------------------- | ------------------- | ---------------------------- |
| `getAuthHeaders`           | `() => Record<string, string>`                              | Get auth headers    | Include Authorization Bearer |
| `refreshAccessToken`       | `() => Promise<void>`                                       | Refresh token flow  | POST to /api/auth/refresh    |
| `makeAuthenticatedRequest` | `(url: string, options?: RequestInit) => Promise<Response>` | Authenticated fetch | Auto-attach auth headers     |

### Security Features

| Export         | Type                                               | Purpose              | Test Expectation        |
| -------------- | -------------------------------------------------- | -------------------- | ----------------------- |
| `secureDelete` | `() => void`                                       | Secure token removal | Clear and overwrite     |
| `on`           | `(event: TokenEvent, handler: () => void) => void` | Event emitter        | Lifecycle notifications |

## Package.json Scaffold Command

Add this command to `package.json`:

```json
{
  "scripts": {
    // Add to existing scripts
    "scaffold:jwt:manager": "mkdir -p src/lib/security && cp docs/implementation/jwt-skeleton.ts src/lib/security/secure-token-manager.ts && echo '✅ JWT Security Manager skeleton created'",

    // Alternative inline version if template file doesn't exist
    "scaffold:jwt:inline": "mkdir -p src/lib/security && node -e \"require('fs').writeFileSync('src/lib/security/secure-token-manager.ts', '// JWT Security Manager Skeleton\\n// See: docs/implementation/JWT_SECURITY_MANAGER_SKELETON.md\\n\\nexport const secureTokenManager = {\\n  setToken: (t) => console.warn(\\'Not implemented\\'),\\n  getToken: () => null,\\n  clearToken: () => {},\\n  getAuthHeaders: () => ({ \\'Content-Type\\': \\'application/json\\' }),\\n  setRefreshToken: (t) => {},\\n  getRefreshToken: () => null,\\n  clearRefreshToken: () => {},\\n  decodeToken: (t) => null,\\n  isValidToken: (t) => false,\\n  isTokenExpired: (t, b) => true,\\n  refreshAccessToken: async () => { throw new Error(\\'Not implemented\\') },\\n  secureDelete: () => {},\\n  on: (e, h) => {},\\n  makeAuthenticatedRequest: async (u, o) => fetch(u, o || {})\\n};\\n')\" && echo '✅ JWT Manager skeleton created'",

    // Verification command
    "verify:jwt:skeleton": "test -f src/lib/security/secure-token-manager.ts && echo '✅ JWT skeleton exists' || echo '❌ JWT skeleton missing - run: npm run scaffold:jwt:manager'"
  }
}
```

## Integration with Phase 1 Requirements

### Pre-Phase 1 Checklist

Before starting Phase 1 TDD implementation:

1. **Create Types File** (`src/types/auth.ts`):

```typescript
export interface DecodedToken {
  sub?: string;
  name?: string;
  email?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}
```

2. **Run Scaffold Command**:

```bash
npm run scaffold:jwt:manager
```

3. **Verify Skeleton**:

```bash
npm run verify:jwt:skeleton
```

4. **Run RED Tests**:

```bash
npm run test:phase1:security
# All tests should fail (RED) but not error on import
```

### Phase 1 Implementation Flow

1. **See RED Tests**:
   - Tests import successfully
   - All assertions fail as expected
   - Failure messages guide implementation

2. **Implement Each Method**:
   - Follow test failure messages
   - Implement one method at a time
   - Run tests after each implementation

3. **Achieve GREEN**:
   - All security tests pass
   - No cookie usage detected
   - Authorization headers working

4. **Refactor**:
   - Improve code quality
   - Add error handling
   - Optimize performance

## Verification Steps

### 1. Manual Verification

```bash
# Check file exists
ls -la src/lib/security/secure-token-manager.ts

# Verify exports
grep -E "export|setToken|getToken|clearToken" src/lib/security/secure-token-manager.ts

# Run import test
node -e "import('./src/lib/security/secure-token-manager.ts').then(() => console.log('✅ Import successful')).catch(e => console.error('❌ Import failed:', e))"
```

### 2. Automated Verification

```bash
# Run scaffold verification
npm run verify:jwt:skeleton

# Run security tests (should fail, not error)
npm run test -- src/__tests__/security/jwt.security.test.ts

# Check for import errors
npm run test -- src/__tests__/security/jwt.security.test.ts 2>&1 | grep -i "cannot find module" && echo "❌ Import error" || echo "✅ No import errors"
```

### 3. CI/CD Verification

The GitHub Actions workflow should:

1. Run `npm run scaffold:jwt:manager` in setup
2. Verify with `npm run verify:jwt:skeleton`
3. Execute security tests without import errors
4. Report RED test failures (expected in skeleton phase)

## Common Issues and Solutions

### Issue: Import Path Resolution

**Problem**: `Cannot find module '@/lib/security/secure-token-manager'`

**Solution**: Ensure `tsconfig.json` has path mapping:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Issue: Type Errors

**Problem**: `Cannot find name 'DecodedToken'`

**Solution**: Create types file first:

```bash
mkdir -p src/types
echo "export interface DecodedToken { exp?: number; [key: string]: any; }" > src/types/auth.ts
```

### Issue: Test Timeout

**Problem**: Tests timeout instead of failing

**Solution**: Ensure skeleton methods don't hang:

```typescript
// BAD: Hangs forever
async refreshAccessToken(): Promise<void> {
  // No implementation
}

// GOOD: Fails immediately
async refreshAccessToken(): Promise<void> {
  throw new Error('Not implemented');
}
```

## Summary

This JWT Security Manager skeleton is a **critical prerequisite** for Phase 1
TDD development. It:

1. **Enables RED tests** to run without import errors
2. **Provides all required exports** with failing implementations
3. **Guides TDD implementation** through test failures
4. **Maintains security standards** from the start
5. **Integrates with CI/CD** pipeline requirements

The skeleton is intentionally minimal and failing - the RED tests will guide the
actual implementation during Phase 1 development.

## Related Documentation

- [SECURITY_VERIFICATION_SCRIPTS.md](./SECURITY_VERIFICATION_SCRIPTS.md) -
  Security test requirements
- [JWT_TESTING_PATTERNS.md](../security/JWT_TESTING_PATTERNS.md) - Testing
  patterns and guidelines
- [PHASE_SCAFFOLDING_REQUIREMENTS.md](./PHASE_SCAFFOLDING_REQUIREMENTS.md) -
  Phase scaffolding standards
- [Phase 1 README](./phases/phase-1-login-tdd/README.md) - Phase 1
  implementation guide

---

_Document Owner: security-compliance-auditor_  
_Classification: Implementation Critical_  
_Status: Required Before Phase 1 RED Tests_  
_Last Updated: August 31, 2025_
