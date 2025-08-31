# Verification Script Suite Documentation

> **Status**: Comprehensive Reference Guide  
> **Purpose**: Complete documentation of all verification scripts for the Okaeri
> Resort Management System  
> **Last Updated**: August 2025

---

## Overview

This document provides comprehensive documentation for all verification scripts
in the project. These scripts ensure code quality, performance, security, and
TDD compliance throughout the development lifecycle.

---

## Critical Configuration Issues ⚠️

### Issue 1: Bundle Verification Not Enforcing

**Current**: `verify:bundle` → `build:analyze` (visualization only)  
**Required**: `verify:bundle` → `perf:budget` (actual enforcement)  
**Fix**: Update package.json script

### Issue 2: Lighthouse Scripts Missing Server Management

**Current**: Scripts don't start preview server  
**Required**: Use `start-server-and-test` package  
**Fix**: Install dependency and update scripts

### Issue 3: Phase Scripts Missing

**Current**: No phase-specific test scripts  
**Required**: scaffold:phase1, test:phase1, test:phase1:coverage  
**Fix**: Add phase scripts to package.json

---

## Script Categories

### 1. Primary Verification Scripts

#### `npm run verify`

**Alias for**: `npm run verify:all`  
**Purpose**: Run the complete quality gate suite  
**When to use**: Before pushing code or creating PRs

#### `npm run verify:all`

**Runs**: Tests, type checking, linting, security audit  
**Components**:

```bash
npm run verify:tests && npm run verify:types && npm run verify:lint && npm run verify:security
```

**Success Criteria**: All checks must pass

---

### 2. Test Verification Scripts

#### `npm run verify:tests`

**Command**: `vitest run --coverage`  
**Purpose**: Run all tests with coverage reporting  
**Coverage Requirements**: 90% minimum (95% for critical paths)  
**Output**: Coverage reports in `./coverage/`

#### `npm run test:coverage`

**Command**: `vitest run --coverage --reporter=verbose`  
**Purpose**: Detailed test run with verbose coverage output  
**Use Case**: Development and debugging

#### `npm run test:coverage:quick`

**Command**: `vitest run --coverage --reporter=dot src/**/*.test.{ts,tsx}`  
**Purpose**: Fast coverage check with minimal output  
**Use Case**: Quick validation during development

---

### 3. Type Checking Scripts

#### `npm run verify:types`

**Command**: `tsc --noEmit`  
**Purpose**: TypeScript type validation without emitting files  
**Requirements**: Zero type errors allowed

#### `npm run type-check`

**Command**: `tsc --noEmit`  
**Purpose**: Alias for verify:types  
**Use Case**: Quick type validation

---

### 4. Linting Scripts

#### `npm run verify:lint`

**Command**: `eslint . --max-warnings 0`  
**Purpose**: Enforce code style with zero warnings tolerance  
**Configuration**: `.eslintrc.json`

#### `npm run lint`

**Command**: `eslint .`  
**Purpose**: Check code style (warnings allowed)  
**Use Case**: Development checking

#### `npm run lint:fix`

**Command**: `eslint . --fix`  
**Purpose**: Auto-fix linting issues  
**Use Case**: Automatic code formatting

---

### 5. Security Scripts

#### `npm run verify:security`

**Command**: `npm audit --audit-level=high`  
**Purpose**: Check for high/critical vulnerabilities  
**Requirements**: Zero high or critical vulnerabilities

#### `npm run security:headers`

**Command**: `./scripts/validate-security-headers.sh`  
**Purpose**: Validate security headers configuration  
**Checks**: CSP, HSTS, X-Frame-Options, etc.

---

### 6. Performance Scripts

#### `npm run verify:performance` ⚠️

**Current Issue**: Doesn't start server  
**Required Command**:

```json
"npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --preset=desktop --output=json --output-path=./lighthouse-performance.json'"
```

**Purpose**: Lighthouse performance testing  
**Threshold**: Score ≥ 90

#### `npm run verify:accessibility` ⚠️

**Current Issue**: Doesn't start server  
**Required Command**:

```json
"npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --only-categories=accessibility --output=json --output-path=./lighthouse-accessibility.json'"
```

**Purpose**: Lighthouse accessibility testing  
**Threshold**: Score ≥ 90

#### `npm run verify:bundle` ⚠️

**Current Issue**: Points to visualization, not enforcement  
**Required**: Should use `npm run perf:budget`  
**Purpose**: Enforce bundle size limits  
**Configuration**: `bundlesize.config.json`

#### `npm run perf:budget`

**Command**: `npm run build && npx bundlesize`  
**Purpose**: Enforce bundle size budgets  
**Limits**: As defined in bundlesize.config.json

#### `npm run build:analyze`

**Command**: `ANALYZE=true npm run build`  
**Purpose**: Visualize bundle composition  
**Output**: Bundle analysis HTML report

---

### 7. Phase-Specific Scripts (Missing) ⚠️

#### Phase 1: Authentication

```json
{
  "scaffold:phase1": "echo 'See docs/implementation/phases/phase-1-login-tdd/PHASE_1_FORM_TEST_SPECIFICATIONS.md'",
  "test:phase1": "vitest run src/features/auth/**/__tests__/*.test.{ts,tsx}",
  "test:phase1:coverage": "vitest run --coverage src/features/auth/**/__tests__/*.test.{ts,tsx}"
}
```

#### Phase 2: Dashboard

```json
{
  "scaffold:phase2": "echo 'See docs/implementation/phases/phase-2-dashboard-tdd/README.md'",
  "test:phase2": "vitest run src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
  "test:phase2:coverage": "vitest run --coverage src/features/dashboard/**/__tests__/*.test.{ts,tsx}"
}
```

#### Phase 3-5

Similar patterns for booking, financial, and deployment phases.

---

### 8. Database Scripts

#### `npm run test:db`

**Command**: `vitest tests/db`  
**Purpose**: Run database-specific tests  
**Coverage**: Connection, isolation, performance, schema

#### `npm run test:db:isolation`

**Command**: `vitest tests/db/isolation.test.ts`  
**Purpose**: Test multi-tenant data isolation  
**Critical**: Must pass for security compliance

---

### 9. E2E Testing Scripts

#### `npm run test:e2e`

**Command**: `playwright test`  
**Purpose**: End-to-end testing  
**Configuration**: `playwright.config.ts`

#### `npm run test:runtime-errors`

**Command**: `playwright test runtime-errors.spec.ts`  
**Purpose**: Test error handling in production-like environment  
**Use Case**: Validate error boundaries and recovery

---

### 10. Composite Verification Scripts

#### `npm run verify:push` (Recommended Addition)

**Purpose**: Comprehensive pre-push validation  
**Command**:

```json
"npm run verify:all && npm run verify:bundle && npm run verify:performance"
```

**Use Case**: Run before pushing to ensure all quality gates pass

#### `npm run verify:ci` (For CI/CD)

**Purpose**: CI-specific verification with deterministic settings  
**Environment**:

```bash
FIXED_TIME="2024-01-01T00:00:00Z" \
RANDOM_SEED="test-seed-2024" \
TEST_SCENARIO="STABLE" \
npm run verify:all
```

---

## Required Dependencies

### Missing Dependencies ⚠️

```bash
npm install --save-dev start-server-and-test
```

### Verification Commands

```bash
# Check if start-server-and-test is installed
npm list start-server-and-test

# Check if bundlesize is configured
test -f bundlesize.config.json && echo "✅ Bundlesize configured" || echo "❌ Missing config"
```

---

## Environment Variables for Deterministic Testing

### Required Variables

```bash
export FIXED_TIME="2024-01-01T00:00:00Z"    # Fixed timestamp for tests
export RANDOM_SEED="test-seed-2024"         # Deterministic randomness
export TEST_SCENARIO="STABLE"               # Mock scenario selection
export MOCK_DELAY="0"                       # No artificial delays
export TZ="Asia/Manila"                     # Consistent timezone
```

### Usage in Scripts

```bash
# Run tests with deterministic settings
FIXED_TIME="2024-01-01T00:00:00Z" npm run test:coverage

# CI environment
env FIXED_TIME="2024-01-01T00:00:00Z" RANDOM_SEED="test-seed-2024" npm run verify
```

---

## Troubleshooting Common Issues

### Issue: Lighthouse Tests Fail (No Server)

**Solution**: Install `start-server-and-test` and update scripts

```bash
npm install --save-dev start-server-and-test
# Update verify:accessibility and verify:performance scripts
```

### Issue: Bundle Size Not Enforced

**Solution**: Change verify:bundle to use perf:budget

```json
"verify:bundle": "npm run perf:budget"
```

### Issue: Tests Not Deterministic

**Solution**: Ensure FIXED_TIME is set

```bash
grep "2024-01-01" src/test/setup.ts || echo "Update test setup"
```

### Issue: Phase Scripts Missing

**Solution**: Add phase-specific scripts to package.json

```bash
npm run scaffold:phase1 || echo "Add phase scripts"
```

---

## Quick Validation Commands

### Check Script Configuration

```bash
# Verify all critical scripts exist
npm run verify --dry-run
npm run verify:bundle --dry-run
npm run verify:performance --dry-run
npm run verify:accessibility --dry-run

# Check for missing dependencies
npm list start-server-and-test || echo "Missing dependency"

# Verify deterministic setup
grep "2024-01-01" src/test/setup.ts && echo "✅ Deterministic" || echo "❌ Not deterministic"

# Check bundle configuration
test -f bundlesize.config.json && echo "✅ Bundle config exists" || echo "❌ Missing"
```

### Run Complete Verification

```bash
# Full verification suite (after fixes applied)
npm run verify && \
npm run verify:bundle && \
npm run verify:performance && \
npm run verify:accessibility && \
echo "✅ All verifications passed"
```

---

## CI/CD Integration

### GitHub Actions Usage

```yaml
- name: Run Verification Suite
  env:
    FIXED_TIME: "2024-01-01T00:00:00Z"
    RANDOM_SEED: "test-seed-2024"
    TEST_SCENARIO: "STABLE"
  run: |
    npm run verify
    npm run verify:bundle
    npm run verify:performance
```

### Pre-commit Hook

```bash
#!/bin/sh
npm run verify:tests && npm run verify:types && npm run verify:lint
```

### Pre-push Hook

```bash
#!/bin/sh
npm run verify:push
```

---

## Migration Checklist

To align verification scripts with TDD requirements:

- [ ] Install `start-server-and-test` dependency
- [ ] Update `verify:accessibility` script with server management
- [ ] Update `verify:performance` script with server management
- [ ] Change `verify:bundle` to use `perf:budget`
- [ ] Add Phase 1-5 specific test scripts
- [ ] Update CI workflow with deterministic environment variables
- [ ] Create `verify:push` composite script
- [ ] Test all scripts locally before deployment
- [ ] Update team documentation and training

---

## Summary

This verification script suite ensures:

1. **Code Quality**: Through linting and type checking
2. **Test Coverage**: 90% minimum with phase-specific requirements
3. **Performance**: Bundle size and Lighthouse score enforcement
4. **Security**: Vulnerability scanning and header validation
5. **Accessibility**: WCAG 2.1 AA compliance
6. **Determinism**: Reproducible test results across environments

Regular use of these scripts throughout development ensures high-quality,
maintainable code that meets all project requirements.
