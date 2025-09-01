# Final Implementation Requirements - TDD Phase 1 RED Readiness

## Overview

This document consolidates ALL requirements that must be implemented before
Phase 1 RED can begin. It provides copy-paste ready commands and configuration
blocks in priority order.

**Coordinator**: context-manager  
**Status**: Action Required  
**Last Updated**: August 31, 2025

## 🔴 CRITICAL - Must Complete Before Phase 1 RED

### 1. Install Missing DevDependencies

```bash
# Run this command NOW - Critical for CI/local parity
npm i -D lighthouse bundlesize jest-axe axe-core @types/jest-axe

# Verify installation
npm list lighthouse bundlesize jest-axe axe-core @types/jest-axe
```

### 2. Update Vitest Configuration for Coverage Thresholds

**File**: `vitest.config.ts`

Add phase-specific coverage thresholds:

```typescript
// vitest.config.ts - UPDATE coverage section
coverage: {
  provider: "v8",
  reporter: ["text", "json-summary", "lcov", "html"],
  reportsDirectory: "./coverage",

  // ADD THIS: Phase-specific thresholds
  thresholds: {
    // Global thresholds (existing)
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // ADD: Phase 1 auth requires 95%
    "src/features/auth/**": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },

  // ... rest of existing configuration
}
```

### 3. Add jest-axe Integration to Test Setup

**File**: `src/test/setup.ts`

Add after existing imports:

```typescript
// src/test/setup.ts - ADD these lines
import { expect } from "vitest";
import { toHaveNoViolations } from "jest-axe";

// Extend Vitest matchers with jest-axe
expect.extend({ toHaveNoViolations });
```

### 4. Verify Shell Scripts Exist and Are Executable

```bash
# Check if scripts exist
ls -la scripts/test-accessibility-local.sh
ls -la scripts/test-performance-local.sh
ls -la scripts/validate-security-headers.sh

# If any are missing, create them from docs/implementation/LOCAL_TESTING_ERGONOMICS.md
# Then make executable:
chmod +x scripts/*.sh
```

### 5. Verify .env.test Configuration

```bash
# Verify .env.test exists and has deterministic values
cat .env.test | grep -E "FIXED_TIME|RANDOM_SEED|TEST_SCENARIO"

# Should show:
# FIXED_TIME=2024-01-01T00:00:00Z
# RANDOM_SEED=test-seed-2024
# TEST_SCENARIO=STABLE
```

## 🟡 HIGH PRIORITY - Required for CI/CD

### 6. Add Missing Package.json Scripts

**File**: `package.json`

**CRITICAL CHANGES**:

- Replace `npx bundlesize` with `bundlesize` (use devDependency)
- Replace `npx lighthouse` with `lighthouse` (use devDependency)
- Fix Phase 5 to use `deployment/` directory (not `monitoring/`)
- Add comprehensive JWT security verification scripts
- Add scaffold scripts with directory creation

Add these scripts:

```json
{
  "scripts": {
    // Bundle enforcement via devDependency bundlesize (NOT npx)
    "perf:budget": "npm run build && bundlesize --enable-github-checks",
    "perf:budget-ci": "npm run build && bundlesize --enable-github-checks --json > bundle-report.json",
    "verify:bundle": "npm run perf:budget",

    // Performance verification with server lifecycle management
    "verify:performance": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --preset=desktop --output=json --output-path=./reports/lighthouse-performance.json'",
    "verify:accessibility": "npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --only-categories=accessibility --output=json --output-path=./reports/lighthouse-accessibility.json'",

    // Composite verification script
    "verify:push": "npm run verify:all && npm run verify:bundle && npm run verify:performance && npm run verify:accessibility",

    // JWT security scripts
    "verify:jwt": "vitest run src/__tests__/security/jwt.security.test.ts --reporter=verbose && npm run audit:jwt:cookies",
    "audit:jwt:cookies": "bash -c \"! grep -r 'document\\.cookie' src/ api/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' | grep -iE '(token|jwt|auth|bearer|session)' || (echo '✅ No JWT cookie usage detected' && exit 0)\"",
    "audit:jwt:storage": "bash -c \"! grep -r 'localStorage.*token\\|localStorage.*jwt\\|localStorage.*auth' src/ --include='*.ts' --include='*.tsx' --exclude-dir='__tests__' --exclude='*.test.ts' --exclude='*.test.tsx' && echo '✅ No localStorage token usage detected (secure memory-only storage)' || (echo '❌ ERROR: localStorage token usage detected - security violation! Tokens must be stored in memory only' && exit 1)\"",
    "audit:jwt:headers": "bash -c \"grep -r 'Authorization.*Bearer' src/ api/ --include='*.ts' --include='*.tsx' && echo '✅ Authorization Bearer headers detected' || (echo '⚠️ WARNING: No Authorization Bearer headers found' && exit 1)\"",
    "audit:jwt:no-cookies": "bash -c \"! grep -rE '(Set-Cookie|withCredentials|credentials:\\s*[\\\"'\\`]include)' src/ api/ --include='*.ts' --include='*.tsx' | grep -iE '(token|jwt|auth)' || (echo '✅ No cookie-based auth patterns' && exit 0)\"",
    "security:jwt:full": "npm run verify:jwt && npm run audit:jwt:storage && npm run audit:jwt:headers && npm run audit:jwt:no-cookies",

    // Phase 2-5 scaffold scripts with directory creation
    "scaffold:phase2": "echo 'Phase 2: Dashboard - See docs/implementation/phases/phase-2-dashboard-tdd/README.md' && npm run scaffold:phase2:dirs",
    "scaffold:phase2:dirs": "mkdir -p src/features/dashboard/{components,hooks,stores,types,__tests__} && touch src/features/dashboard/__tests__/.gitkeep",
    "test:phase2": "vitest run src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:coverage": "vitest run --coverage src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:watch": "vitest watch src/features/dashboard/**/__tests__/*.test.{ts,tsx}",

    "scaffold:phase3": "echo 'Phase 3: Booking - See docs/implementation/phases/phase-3-booking-tdd/README.md' && npm run scaffold:phase3:dirs",
    "scaffold:phase3:dirs": "mkdir -p src/features/booking/{components,hooks,stores,types,__tests__} && touch src/features/booking/__tests__/.gitkeep",
    "test:phase3": "vitest run src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:coverage": "vitest run --coverage src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:watch": "vitest watch src/features/booking/**/__tests__/*.test.{ts,tsx}",

    "scaffold:phase4": "echo 'Phase 4: Financial - See docs/implementation/phases/phase-4-financial-tdd/README.md' && npm run scaffold:phase4:dirs",
    "scaffold:phase4:dirs": "mkdir -p src/features/financial/{components,hooks,stores,types,__tests__} && touch src/features/financial/__tests__/.gitkeep",
    "test:phase4": "vitest run src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:coverage": "vitest run --coverage src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:watch": "vitest watch src/features/financial/**/__tests__/*.test.{ts,tsx}",

    "scaffold:phase5": "echo 'Phase 5: Deployment - See docs/implementation/phases/phase-5-deployment/README.md' && npm run scaffold:phase5:dirs",
    "scaffold:phase5:dirs": "mkdir -p src/features/deployment/{components,utils,__tests__} && touch src/features/deployment/__tests__/.gitkeep",
    "test:phase5": "vitest run src/features/deployment/**/__tests__/*.test.{ts,tsx}",
    "test:phase5:coverage": "vitest run --coverage src/features/deployment/**/__tests__/*.test.{ts,tsx}",
    "test:phase5:watch": "vitest watch src/features/deployment/**/__tests__/*.test.{ts,tsx}",

    // Composite phase scripts
    "scaffold:all-phases": "npm run scaffold:phase2:dirs && npm run scaffold:phase3:dirs && npm run scaffold:phase4:dirs && npm run scaffold:phase5:dirs",
    "test:all-phases": "npm run test:phase1 && npm run test:phase2 && npm run test:phase3 && npm run test:phase4 && npm run test:phase5",
    "test:all-phases:coverage": "vitest run --coverage src/features/**/__tests__/*.test.{ts,tsx}"
  }
}
```

### 7. Create Phase Directory Structure and Reports Directory

```bash
# Create reports directory for Lighthouse outputs
mkdir -p reports

# Create phase directories with placeholders
mkdir -p src/features/dashboard/{components,hooks,stores,types,__tests__}
mkdir -p src/features/booking/{components,hooks,stores,types,__tests__}
mkdir -p src/features/financial/{components,hooks,stores,types,__tests__}
mkdir -p src/features/deployment/{components,utils,__tests__}

# Add .gitkeep to empty test directories
touch src/features/dashboard/__tests__/.gitkeep
touch src/features/booking/__tests__/.gitkeep
touch src/features/financial/__tests__/.gitkeep
touch src/features/deployment/__tests__/.gitkeep

# Alternative: Use scaffold scripts
npm run scaffold:all-phases
```

### 8. Create JWT Security Test File

**File**: `src/__tests__/security/jwt.security.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("JWT Security Verification", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "";
  });

  describe("Token Storage Security", () => {
    it("should NEVER store JWT in cookies", () => {
      // This test will be implemented when secureTokenManager is created
      expect(document.cookie).toBe("");
      expect(document.cookie).not.toContain("token");
    });

    it("should store JWT only in memory (not localStorage or sessionStorage)", () => {
      // JWT tokens must be stored in memory only via SecureTokenManager
      const tokenManager = SecureTokenManager.getInstance();
      tokenManager.storeTokens("test-access-token", "test-refresh-token");

      // Verify tokens are NOT in browser storage (security requirement)
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(sessionStorage.getItem("auth_token")).toBeNull();
      expect(document.cookie).not.toContain("token");
    });
  });

  describe("CSRF Protection", () => {
    it("should not require CSRF tokens (JWT-only auth)", () => {
      expect(window).not.toHaveProperty("getCSRFToken");
      expect(document.querySelector('meta[name="csrf-token"]')).toBeNull();
    });
  });
});
```

## 🟢 MEDIUM PRIORITY - Improves Development Experience

### 9. Update TypeScript Configuration

**File**: `tsconfig.json`

Ensure these types are included:

```json
{
  "compilerOptions": {
    "types": [
      "vite/client",
      "vitest/globals",
      "@testing-library/jest-dom",
      "jest-axe" // ADD THIS
    ]
  }
}
```

### 10. Create Audit Script for JWT Cookies

**File**: `scripts/audit-jwt-cookies.sh`

```bash
#!/bin/bash

echo "🔒 JWT Cookie Security Audit"
echo "=============================="

# Check for cookie usage with JWT/token/auth
COOKIE_VIOLATIONS=$(grep -r "document.cookie" src/ api/ | grep -iE "jwt|token|auth" || true)

if [ -n "$COOKIE_VIOLATIONS" ]; then
  echo "❌ SECURITY VIOLATION: JWT/token storage in cookies detected!"
  echo "Found in: $COOKIE_VIOLATIONS"
  exit 1
else
  echo "✅ No JWT cookie usage detected"
fi

echo "Audit complete!"
```

Make executable:

```bash
chmod +x scripts/audit-jwt-cookies.sh
```

## ✅ Verification Checklist

Run these commands in order to verify all requirements are met:

```bash
# 1. Verify dependencies installed
npm list lighthouse bundlesize jest-axe axe-core @types/jest-axe

# 2. Verify Phase 1 tests run (expect RED/failures initially)
npm run test:phase1

# 3. Verify coverage thresholds work
npm run test:phase1:coverage
# Should show 95% requirement for auth files

# 4. Verify all verification scripts work
npm run verify:all

# 5. Verify bundle size enforcement
npm run verify:bundle

# 6. Verify performance testing
npm run verify:performance

# 7. Verify security audits
npm run audit:jwt:cookies

# 8. Verify Phase 2-5 scripts (should run with no files found)
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:phase5

# 9. Verify comprehensive push verification
npm run verify:push
```

## 🚀 Quick Start Commands (Copy & Run)

```bash
# Complete setup in one go:

# 1. Install all dependencies (CRITICAL - Use devDependencies, not npx)
npm i -D lighthouse bundlesize jest-axe axe-core @types/jest-axe

# 2. Create reports directory for Lighthouse outputs
mkdir -p reports

# 3. Create phase directories using scaffold scripts
mkdir -p src/features/{dashboard,booking,financial,deployment}/{components,hooks,stores,types,__tests__}
touch src/features/{dashboard,booking,financial,deployment}/__tests__/.gitkeep

# Or use the scaffold scripts:
# npm run scaffold:all-phases

# 4. Create security test directory
mkdir -p src/__tests__/security

# 5. Make scripts executable
chmod +x scripts/*.sh

# 6. Run initial verification
npm run verify:all
```

## CI/CD Environment Variables

Ensure these are set in GitHub Actions:

```yaml
env:
  NODE_ENV: test
  FIXED_TIME: "2024-01-01T00:00:00Z"
  RANDOM_SEED: "test-seed-2024"
  TEST_SCENARIO: "STABLE"
  MOCK_DELAY: "0"
  TZ: "Asia/Manila"
  VITEST_DETERMINISTIC: "true"
```

## Summary of Changes Required

| Category        | Items                | Priority    | Blocking Phase 1? | Notes                                    |
| --------------- | -------------------- | ----------- | ----------------- | ---------------------------------------- |
| DevDependencies | 5 packages           | 🔴 Critical | Yes               | Must use local deps, not npx             |
| Vitest Config   | Coverage thresholds  | 🔴 Critical | Yes               | Auth requires 95%, not global 90%        |
| Test Setup      | jest-axe integration | 🔴 Critical | Yes               | Required for accessibility testing       |
| Package.json    | 30+ scripts          | 🟡 High     | Partially         | Bundle/perf scripts must use devDeps     |
| Reports Dir     | Lighthouse outputs   | 🟡 High     | No                | Create reports/ directory                |
| Directories     | Phase 2-5 structure  | 🟡 High     | No (CI Matrix)    | Phase 5 uses deployment/, not monitoring |
| Security Tests  | JWT verification     | 🟡 High     | No                | Create jwt.security.test.ts              |
| Shell Scripts   | Already exist        | ✅ Done     | No                | Make executable with chmod +x            |
| .env.test       | Already configured   | ✅ Done     | No                | Deterministic values set                 |

## Final Validation

After completing all requirements:

```bash
# This should pass without errors:
npm run verify:all && npm run verify:bundle && npm run verify:performance

# This should show 95% threshold for auth:
npm run test:phase1:coverage

# This should work (even with no tests initially):
npm run test:all-phases
```

## Next Steps After Requirements Complete

1. Begin Phase 1 RED with typescript-react-quality-expert agent
2. Write failing tests following PHASE_1_FORM_TEST_SPECIFICATIONS.md
3. Use `npm run test:phase1:watch` for TDD development
4. Achieve RED state for all Phase 1 tests
5. Proceed to GREEN implementation

## Related Documentation

- [TEST_INFRASTRUCTURE_REQUIREMENTS.md](./TEST_INFRASTRUCTURE_REQUIREMENTS.md) -
  DevDependencies details
- [PERFORMANCE_TESTING_REQUIREMENTS.md](./PERFORMANCE_TESTING_REQUIREMENTS.md) -
  Performance tools
- [SECURITY_VERIFICATION_SCRIPTS.md](./SECURITY_VERIFICATION_SCRIPTS.md) -
  Security scripts
- [PHASE_SCAFFOLDING_REQUIREMENTS.md](./PHASE_SCAFFOLDING_REQUIREMENTS.md) -
  Phase structure
- [CI_CD_TDD_ENFORCEMENT.md](./CI_CD_TDD_ENFORCEMENT.md) - CI/CD configuration

---

_Document Coordinator: context-manager_  
_Status: Ready for Implementation_  
_Priority: EXECUTE IMMEDIATELY - Blocks Phase 1 RED_
