# JWT Token Storage Environment Matrix

## Executive Summary

This document defines the **authoritative token storage policy** for the Okaeri
Resort System across all environments. The system enforces memory-only storage
by default with controlled exceptions for developer convenience in mock
authentication scenarios.

**Last Updated**: September 1, 2025  
**Document Owner**: security-compliance-auditor  
**Classification**: Security Critical

## Token Storage Environment Matrix

| Environment                 | Storage Method          | Persistence    | Web Storage APIs   | Security Level | Configuration           |
| --------------------------- | ----------------------- | -------------- | ------------------ | -------------- | ----------------------- |
| **Production**              | Memory-only             | None           | ❌ **FORBIDDEN**   | Maximum        | Enforced, no exceptions |
| **Test/CI**                 | Memory-only             | None           | ❌ **FORBIDDEN**   | Maximum        | Enforced, no exceptions |
| **Development (Default)**   | Memory-only             | None           | ❌ Forbidden\*     | High           | Default secure behavior |
| **Development + Mock Auth** | Memory + SessionStorage | Tab-level only | ⚠️ **Conditional** | Medium         | `VITE_MOCK_AUTH=true`   |

\*Exception: Mock tokens ONLY when properly gated with `isDevelopmentMockAuth()`

## Environment-Specific Policies

### 🔒 Production Environment

**Policy**: ZERO TOLERANCE for Web Storage APIs

- **Storage**: Memory-only via private class variables
- **Persistence**: None - tokens cleared on page refresh/close
- **Web Storage**: Strictly forbidden - deployment blocked if detected
- **Audit**: `npm run audit:jwt:production` (strict mode)
- **Enforcement**: CI/CD pipeline blocks deployment on violations

```bash
# Production audit command (STRICT)
NODE_ENV=production npm run audit:jwt:production
```

### 🧪 Test/CI Environment

**Policy**: Production-equivalent security

- **Storage**: Memory-only, all mocks use in-memory storage
- **Persistence**: None - fresh state for each test
- **Web Storage**: Forbidden - tests fail if detected
- **Configuration**: Enforced via test setup
- **Mocking**: Use in-memory token storage for all test scenarios

### 💻 Development Environment

#### Default Mode (Secure)

**Policy**: Memory-only by default

- **Storage**: Memory-only via SecureTokenManager
- **Persistence**: None unless explicitly enabled
- **Web Storage**: Not used unless mock auth enabled
- **Configuration**: Default, no action required

#### Mock Authentication Mode

**Policy**: Controlled persistence for developer convenience

- **Storage**: Memory + optional sessionStorage
- **Persistence**: Tab-level only (sessionStorage)
- **Web Storage**: Allowed ONLY when ALL conditions met:
  1. `import.meta.env.DEV === true` (Development build)
  2. `VITE_MOCK_AUTH === "true"` in `.env.development`
  3. Storage keys prefixed with `mock_`
  4. Code wrapped in `isDevelopmentMockAuth()` check

**Configuration**:

```bash
# .env.development
VITE_MOCK_AUTH="true"  # Enables mock auth with sessionStorage persistence
```

**Implementation Pattern**:

```typescript
// REQUIRED: Proper gating for dev-mode persistence
private isDevelopmentMockAuth(): boolean {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_MOCK_AUTH === "true"
  );
}

// Usage MUST be gated
if (this.isDevelopmentMockAuth()) {
  // ONLY mock tokens with mock_ prefix
  sessionStorage.setItem("mock_access_token", mockToken);
  sessionStorage.setItem("mock_refresh_token", mockRefreshToken);
}
```

## Security Audit Commands

### Environment-Specific Audits

```bash
# Development mode with mock auth
npm run security:jwt:dev

# Production mode (strict)
npm run security:jwt:prod

# Full audit (all checks)
npm run security:jwt:full

# Enhanced storage audit (environment-aware)
npm run audit:jwt:storage:enhanced
```

### Audit Behavior by Environment

| Check                                    | Production  | Test/CI     | Dev (Default) | Dev (Mock Auth) |
| ---------------------------------------- | ----------- | ----------- | ------------- | --------------- |
| localStorage for tokens                  | ❌ Fails    | ❌ Fails    | ❌ Fails      | ❌ Fails        |
| sessionStorage for real tokens           | ❌ Fails    | ❌ Fails    | ❌ Fails      | ❌ Fails        |
| sessionStorage for mock tokens (gated)   | ❌ Fails    | ❌ Fails    | ✅ Passes     | ✅ Passes       |
| sessionStorage for mock tokens (ungated) | ❌ Fails    | ❌ Fails    | ⚠️ Warning    | ⚠️ Warning      |
| Cookies for JWT                          | ❌ Fails    | ❌ Fails    | ❌ Fails      | ❌ Fails        |
| Authorization headers                    | ✅ Required | ✅ Required | ✅ Required   | ✅ Required     |

## Implementation Files

### Core Token Management

- **SecureTokenManager**: `/src/lib/security/secure-token-manager.ts`
  - Memory-only storage implementation
  - Development mode gating logic
  - Browser fingerprinting for security

- **TokenManager**: `/src/lib/security/token-manager.ts`
  - Simplified token lifecycle management
  - Mock auth support with proper gating

### Security Audit Scripts

- **Enhanced Storage Audit**:
  `/scripts/security-audits/storage-audit-enhanced.cjs`
  - Environment-aware validation
  - Proper gating verification
  - Mock token detection

- **Production Audit**: Strict mode via `NODE_ENV=production`
  - Zero tolerance for Web Storage
  - Deployment gate enforcement

## Compliance Checklist

### ✅ Required for All Environments

- [ ] Tokens stored in memory by default
- [ ] No localStorage for JWT tokens
- [ ] No cookies for JWT authentication
- [ ] Authorization: Bearer headers for API calls
- [ ] Token refresh handled in memory

### ✅ Production-Specific Requirements

- [ ] NO Web Storage APIs in production code
- [ ] NO sessionStorage even for mock tokens
- [ ] All dev-mode code tree-shaken from build
- [ ] Security audits pass in strict mode
- [ ] CI/CD blocks deployment on violations

### ✅ Development-Specific Guidelines

- [ ] Mock tokens use `mock_` prefix
- [ ] sessionStorage gated with `isDevelopmentMockAuth()`
- [ ] `VITE_MOCK_AUTH` only in `.env.development`
- [ ] Regular audits during development
- [ ] Clear documentation of dev-mode behavior

## Common Violations and Fixes

### ❌ Violation: Ungated sessionStorage

```typescript
// WRONG - No gating
sessionStorage.setItem("mock_token", token);

// CORRECT - Properly gated
if (this.isDevelopmentMockAuth()) {
  sessionStorage.setItem("mock_access_token", token);
}
```

### ❌ Violation: Real token in sessionStorage

```typescript
// WRONG - Real token key
sessionStorage.setItem("auth_token", token);

// CORRECT - Mock token with prefix
sessionStorage.setItem("mock_access_token", mockToken);
```

### ❌ Violation: localStorage for any token

```typescript
// WRONG - Never use localStorage
localStorage.setItem("token", jwt);

// CORRECT - Use SecureTokenManager
tokenManager.storeTokens(jwt);
```

## Security Benefits

### Memory-Only Storage Advantages

1. **XSS Protection**: Tokens inaccessible to injected scripts
2. **No Persistence**: Automatic cleanup on tab/browser close
3. **Reduced Attack Surface**: No browser storage API vulnerabilities
4. **OWASP Compliance**: Follows latest security best practices
5. **Simple Security Model**: Clear boundaries and enforcement

### Development Mode Trade-offs

- **Benefit**: Improved developer experience with mock auth
- **Risk**: Minimal - only mock tokens, properly gated
- **Mitigation**: Strict production audits prevent leakage

## Migration Guide

### For Existing Code

1. **Identify violations**: Run `npm run audit:jwt:storage:enhanced`
2. **Fix localStorage usage**: Replace with SecureTokenManager
3. **Gate sessionStorage**: Add `isDevelopmentMockAuth()` checks
4. **Update keys**: Ensure mock tokens use `mock_` prefix
5. **Test thoroughly**: Run audits in both dev and prod modes

### For New Features

1. **Use SecureTokenManager**: Never directly access Web Storage
2. **Follow patterns**: Copy from existing implementations
3. **Test early**: Run audits before committing
4. **Document**: Note any dev-mode conveniences

## References

- [JWT_STORAGE_IMPLEMENTATION_GUIDE.md](./JWT_STORAGE_IMPLEMENTATION_GUIDE.md)
- [MEMORY_ONLY_JWT_STORAGE_UPDATE.md](./MEMORY_ONLY_JWT_STORAGE_UPDATE.md)
- [JWT_SECURITY_SCRIPTS_DOCUMENTATION.md](./JWT_SECURITY_SCRIPTS_DOCUMENTATION.md)
- [OWASP Token Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html#token-storage-on-client-side)

---

**Document Status**: AUTHORITATIVE  
**Compliance**: MANDATORY  
**Review Cycle**: Security Team Approval Required for Changes
