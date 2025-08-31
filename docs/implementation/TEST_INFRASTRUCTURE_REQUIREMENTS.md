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

**Required vitest.config.ts Update**:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",

      // CRITICAL: Phase-specific thresholds
      thresholds: {
        // Global thresholds (Phase 2+)
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Phase 1 auth requires higher coverage
        "src/features/auth/**": {
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
      ],
      all: true,
      skipFull: false,
    },
    // Ensure setup files are loaded
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

### Test Setup Configuration

**Required src/test/setup.ts Additions**:

```typescript
// src/test/setup.ts - Add after existing imports
import { expect } from "vitest";
import { toHaveNoViolations } from "jest-axe";

// Extend Vitest matchers with jest-axe
expect.extend({ toHaveNoViolations });

// Existing setup code...
// (deterministic time, seeded random, etc.)
```

## Accessibility Testing Setup

### jest-axe Integration with Vitest

**Pattern for Component Tests**:

```typescript
// Example: src/features/auth/__tests__/LoginForm.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { LoginForm } from '../LoginForm';

describe('LoginForm Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Configuration for axe-core

Create `src/test/axe.config.ts`:

```typescript
// src/test/axe.config.ts
export const axeConfig = {
  rules: {
    // Disable color contrast in tests (handled by design system)
    "color-contrast": { enabled: false },
    // Ensure all interactive elements are keyboard accessible
    "keyboard-accessible": { enabled: true },
    // Require labels for all form controls
    label: { enabled: true },
    // Ensure proper heading hierarchy
    "heading-order": { enabled: true },
  },
  // Focus on WCAG 2.1 AA compliance
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  },
};
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

### Required tsconfig.json Types

Ensure these types are included:

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": [
      "vite/client",
      "vitest/globals",
      "@testing-library/jest-dom",
      "jest-axe"
    ]
  }
}
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
