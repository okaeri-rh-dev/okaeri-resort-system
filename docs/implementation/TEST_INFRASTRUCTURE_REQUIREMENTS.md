# Test Infrastructure Requirements

## Overview

This document specifies the complete test infrastructure requirements for the
Okaeri Resort Management System TDD implementation. It addresses critical gaps
identified in the test setup and ensures CI/local parity for deterministic
testing.

**Owner**: typescript-react-quality-expert  
**Status**: Required for Phase 1 RED  
**Last Updated**: August 31, 2025

## Critical DevDependencies Requirements

### 1. Missing DevDependencies Installation

The following packages are currently referenced in scripts but not installed as
devDependencies, causing CI fragility and slower execution:

```bash
# REQUIRED: Install these packages before Phase 1 RED
npm i -D lighthouse bundlesize jest-axe axe-core @types/jest-axe
```

#### Package Purposes

| Package           | Purpose                        | Current State            | Required For                |
| ----------------- | ------------------------------ | ------------------------ | --------------------------- |
| `lighthouse`      | Local performance testing      | Using npx (slow/brittle) | verify:performance, CI jobs |
| `bundlesize`      | Bundle size enforcement        | Using npx (slow/brittle) | verify:bundle, perf:budget  |
| `jest-axe`        | Accessibility testing matchers | Not installed            | Phase 1 a11y tests          |
| `axe-core`        | Accessibility testing engine   | Not installed            | jest-axe dependency         |
| `@types/jest-axe` | TypeScript definitions         | Not installed            | Type safety                 |

### 2. Additional Recommended DevDependencies

```bash
# RECOMMENDED: Improve test reliability
npm i -D pwa-asset-generator dotenv-cli
```

| Package               | Purpose                      | Benefit                    |
| --------------------- | ---------------------------- | -------------------------- |
| `pwa-asset-generator` | PWA asset generation         | Avoid npx in pwa:validate  |
| `dotenv-cli`          | Environment variable loading | Explicit .env.test loading |

## Vitest Configuration Requirements

### Coverage Thresholds Configuration

**Current Issue**: Global thresholds are 90% but Phase 1 auth requires 95% per
documentation.

**CRITICAL: Complete vitest.config.ts Configuration Required**:

```typescript
// vitest.config.ts - COMPLETE CONFIGURATION
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],

    // CRITICAL: Phase-specific coverage thresholds
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",

      // Phase-specific thresholds (EXACT CONFIGURATION REQUIRED)
      thresholds: {
        // Global thresholds (Phase 2+) - 90% minimum
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Phase 1 auth requires higher coverage - 95% minimum
        "src/features/auth/**": {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        // Critical business logic requires higher coverage
        "src/stores/**": {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },

      include: ["src/**/*.{ts,tsx,js,jsx}"],
      exclude: [
        "coverage/**",
        "dist/**",
        "**/*.d.ts",
        "**/types/**",
        "**/__tests__/**",
        "**/__mocks__/**",
        "**/mock*/**",
        "src/test/**",
        "src/components/ui/**", // shadcn/ui components
        "**/*.config.{ts,js}",
        "**/*.stories.{ts,tsx}",
      ],
      all: true,
      skipFull: false,
    },

    // Deterministic test configuration
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Prevent race conditions
      },
    },
  },
});
```

**Why Phase 1 Auth Needs 95% Coverage**:

1. **Security Critical**: Authentication logic must be thoroughly tested
2. **User Trust**: Login/logout failures break user confidence
3. **Attack Surface**: Auth components are primary security entry points
4. **Business Impact**: Auth failures prevent all other system use

### Test Setup Configuration

**CRITICAL: Complete src/test/setup.ts Configuration**:

```typescript
// src/test/setup.ts - COMPLETE CONFIGURATION WITH JEST-AXE
import { expect, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { config } from "dotenv";

// CRITICAL: Load test environment variables
config({ path: ".env.test" });

// CRITICAL: Jest-axe integration for accessibility testing
import { toHaveNoViolations } from "jest-axe";
expect.extend({ toHaveNoViolations });

// CRITICAL: Deterministic time setup
beforeAll(() => {
  // Set fixed time for deterministic tests
  const FIXED_TIME = process.env.FIXED_TIME || "2024-01-01T00:00:00Z";
  const fixedDate = new Date(FIXED_TIME);

  // Mock Date constructor
  vi.setSystemTime(fixedDate);

  // Set timezone for consistent testing
  process.env.TZ = "Asia/Manila";
});

// CRITICAL: Seeded random for deterministic tests
beforeAll(() => {
  const RANDOM_SEED = process.env.RANDOM_SEED || "test-seed-2024";
  // Use seedrandom or similar if needed for complex randomization
  Math.random = vi.fn(() => 0.5); // Deterministic for tests
});

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// CRITICAL: Global test configuration
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for components that use it
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver for lazy loading components
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

## Accessibility Testing Setup

### CRITICAL: jest-axe Integration with Vitest

**Required DevDependencies Installation**:

```bash
# MUST install these exact packages for accessibility testing
npm i -D jest-axe@^9.0.0 axe-core@^4.8.0 @types/jest-axe@^3.3.0
```

**Complete Integration Pattern**:

```typescript
// Example: src/features/auth/__tests__/LoginForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoginForm } from '../LoginForm';
import { axeConfig } from '../../../test/axe.config';

// Extend expect matchers (already done globally in setup.ts)
expect.extend({ toHaveNoViolations });

describe('LoginForm Accessibility', () => {
  it('should have no accessibility violations on initial render', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations with validation errors', async () => {
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);

    // Trigger validation errors
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in loading state', async () => {
    const { container } = render(<LoginForm isLoading={true} />);
    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });
});
```

### CRITICAL: axe-core Configuration

**Create `src/test/axe.config.ts`**:

```typescript
// src/test/axe.config.ts - EXACT CONFIGURATION REQUIRED
import type { AxeOptions } from "axe-core";

export const axeConfig: AxeOptions = {
  rules: {
    // CRITICAL: Disable problematic rules for testing environment
    "color-contrast": { enabled: false }, // Design system responsibility
    "duplicate-id": { enabled: false }, // Portal components create duplicates

    // CRITICAL: Enable essential accessibility rules
    "aria-allowed-attr": { enabled: true },
    "aria-required-attr": { enabled: true },
    "button-name": { enabled: true },
    "form-field-multiple-labels": { enabled: true },
    "input-button-name": { enabled: true },
    label: { enabled: true },
    "link-name": { enabled: true },
    "heading-order": { enabled: true },
    "landmark-unique": { enabled: true },
    region: { enabled: true },
    "skip-link": { enabled: true },
  },

  // CRITICAL: Focus on WCAG 2.1 AA compliance
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
  },

  // CRITICAL: Test environment optimizations
  resultTypes: ["violations", "incomplete"],

  // CRITICAL: Performance optimization for CI
  preload: false,
  timeout: 30000,
};

// Export for direct use in tests
export default axeConfig;
```

### TypeScript Integration Requirements

**Add to `src/test/setup.ts` (already included above)**:

```typescript
// CRITICAL: This must be in setup.ts for global availability
import { toHaveNoViolations } from "jest-axe";
expected.extend({ toHaveNoViolations });
```

**Verification Commands**:

```bash
# Test jest-axe installation
npm run test:phase1 -- --run
# Should recognize toHaveNoViolations matcher

# Test axe-core functionality
node -e "console.log(require('axe-core').version)"
# Should output version number
```

## Test File Organization

### Canonical Test Locations

Based on package.json scripts, use these locations:

```
src/
├── features/
│   ├── auth/
│   │   ├── __tests__/        # Phase 1 tests
│   │   │   ├── LoginForm.test.tsx
│   │   │   ├── RegistrationForm.test.tsx
│   │   │   └── PasswordResetForm.test.tsx
│   ├── dashboard/
│   │   └── __tests__/        # Phase 2 tests
│   ├── booking/
│   │   └── __tests__/        # Phase 3 tests
│   ├── financial/
│   │   └── __tests__/        # Phase 4 tests
│   └── deployment/
│       └── __tests__/        # Phase 5 tests
```

## Environment Variable Loading

### Ensure .env.test is Loaded

**Option 1: Via dotenv in setup** (Currently implemented ✅):

```typescript
// src/test/setup.ts
import { config } from "dotenv";
config({ path: ".env.test" });
```

**Option 2: Via dotenv-cli** (Alternative):

```json
// package.json
{
  "test:phase1": "dotenv -e .env.test -- vitest run src/features/auth/**/__tests__/*.test.{ts,tsx}"
}
```

## TypeScript Configuration

### TypeScript Configuration Requirements

**CRITICAL: Complete tsconfig.app.json types configuration**:

```json
// tsconfig.app.json - Add to types array
{
  "compilerOptions": {
    "types": [
      "vite/client",
      "vitest/globals",
      "@testing-library/jest-dom",
      "jest-axe",
      "@types/jest-axe"
    ]
  }
}
```

**CRITICAL: Vitest globals configuration for TypeScript**:

Ensure `vitest/globals` is included to enable global test functions (`describe`,
`it`, `expect`) without imports.

**Verification Command**:

```bash
# Verify TypeScript recognizes jest-axe types
npx tsc --noEmit
# Should not show errors for toHaveNoViolations matcher
```

## Verification Commands

After implementing these requirements, verify with:

```bash
# 1. Verify dependencies installed
npm list lighthouse bundlesize jest-axe axe-core @types/jest-axe

# 2. Verify coverage thresholds work
npm run test:phase1:coverage
# Should enforce 95% for auth files

# 3. Verify accessibility testing works
npm run test:phase1
# Should run tests with axe matchers

# 4. Verify all verification scripts work
npm run verify:all
npm run verify:bundle
npm run verify:performance
```

## Common Issues and Solutions

### Issue: "Cannot find module 'jest-axe'"

**Solution**: Install jest-axe and @types/jest-axe as devDependencies

### Issue: "toHaveNoViolations is not a function"

**Solution**: Add expect.extend in src/test/setup.ts

### Issue: Coverage thresholds not enforced

**Solution**: Update vitest.config.ts with proper threshold configuration

### Issue: Lighthouse/bundlesize slow in CI

**Solution**: Install as devDependencies instead of using npx

## Integration with CI/CD

### GitHub Actions Environment

Ensure CI workflow includes:

```yaml
env:
  # Deterministic environment
  NODE_ENV: test
  FIXED_TIME: "2024-01-01T00:00:00Z"
  RANDOM_SEED: "test-seed-2024"
  TEST_SCENARIO: "STABLE"
  MOCK_DELAY: "0"
  TZ: "Asia/Manila"
```

### Coverage Gate Automation

With proper threshold configuration, CI will automatically fail if coverage
drops below:

- 95% for `src/features/auth/**`
- 90% for all other files

## Checklist for Phase 1 RED Readiness

- [ ] Install all required devDependencies
- [ ] Update vitest.config.ts with coverage thresholds
- [ ] Add jest-axe matchers to src/test/setup.ts
- [ ] Verify .env.test is loaded in tests
- [ ] Update tsconfig.json with required types
- [ ] Run verification commands successfully
- [ ] Confirm coverage enforcement works

## Related Documentation

- [TDD_SINGLE_SOURCE_OF_TRUTH.md](./TDD_SINGLE_SOURCE_OF_TRUTH.md) -
  Authoritative testing standards
- [DETERMINISTIC_TEST_CONFIGURATION.md](./DETERMINISTIC_TEST_CONFIGURATION.md) -
  Environment setup
- [COMPONENT_TESTING_PATTERNS.md](./COMPONENT_TESTING_PATTERNS.md) - Testing
  patterns
- [TEST_TYPE_SAFETY_SPECIFICATION.md](./TEST_TYPE_SAFETY_SPECIFICATION.md) -
  TypeScript testing

---

_Document Owner: typescript-react-quality-expert_  
_Review Status: Ready for Implementation_  
_Priority: CRITICAL - Blocks Phase 1 RED_
