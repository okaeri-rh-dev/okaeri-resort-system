# Verification Script Suite Documentation

> **Status**: Comprehensive Reference Guide **Purpose**: Complete documentation
> of all verification scripts for the Okaeri Resort Management System **Last
> Updated**: September 2025

---

## Overview

This document provides comprehensive documentation for all verification scripts
in the project. These scripts ensure code quality, performance, security, and
TDD compliance throughout the development lifecycle.

---

## Critical Configuration Issues ⚠️

### Issue 1: Bundle Verification Not Enforcing

**Current**: `verify:bundle` → `build:analyze` (visualization only)
**Required**: `verify:bundle` → `perf:budget` (actual enforcement with
devDependency bundlesize) **Fix**: Update package.json script to use local
bundlesize (not npx)

### Issue 2: Lighthouse Scripts Missing Server Management

**Current**: Scripts don't start preview server and use npx **Required**: Use
`start-server-and-test` package with local lighthouse devDependency **Fix**:
Install lighthouse and start-server-and-test as devDependencies and update
scripts

### Issue 3: Phase Scripts and JWT Security Scripts Missing

**Current**: Missing phase scaffold scripts with directory creation and JWT
security verification **Required**: scaffold:phaseX:dirs, JWT verification
scripts, Phase 5 uses deployment/ paths **Fix**: Add complete phase scripts and
JWT security scripts to package.json

---

## Script Categories

### 1. Primary Verification Scripts

#### `npm run verify`

**Alias for**: `npm run verify:all` **Purpose**: Run the complete quality gate
suite **When to use**: Before pushing code or creating PRs

#### `npm run verify:all`

**Runs**: Tests, type checking, linting, security audit **Components**:

```bash
npm run verify:tests && npm run verify:types && npm run verify:lint && npm run verify:security
```

**Success Criteria**: All checks must pass

---

### 2. Test Verification Scripts

#### `npm run verify:tests`

**Command**: `vitest run --coverage` **Purpose**: Run all tests with coverage
reporting **Coverage Requirements**: 90% minimum (95% for critical paths)
**Output**: Coverage reports in `./coverage/`

#### `npm run test:coverage`

**Command**: `vitest run --coverage --reporter=verbose` **Purpose**: Detailed
test run with verbose coverage output **Use Case**: Development and debugging

#### `npm run test:coverage:quick`

**Command**: `vitest run --coverage --reporter=dot src/**/*.test.{ts,tsx}`
**Purpose**: Fast coverage check with minimal output **Use Case**: Quick
validation during development

---

### 3. Type Checking Scripts

#### `npm run verify:types`

**Command**: `tsc --noEmit` **Purpose**: TypeScript type validation without
emitting files **Requirements**: Zero type errors allowed

#### `npm run type-check`

**Command**: `tsc --noEmit` **Purpose**: Alias for verify:types **Use Case**:
Quick type validation

---

### 4. Linting Scripts

#### `npm run verify:lint`

**Command**: `eslint . --max-warnings 0` **Purpose**: Enforce code style with
zero warnings tolerance **Configuration**: `.eslintrc.json`

#### `npm run lint`

**Command**: `eslint .` **Purpose**: Check code style (warnings allowed) **Use
Case**: Development checking

#### `npm run lint:fix`

**Command**: `eslint . --fix` **Purpose**: Auto-fix linting issues **Use Case**:
Automatic code formatting

---

### 5. Security Scripts

#### `npm run verify:security`

**Command**: `npm audit --audit-level=high` **Purpose**: Check for high/critical
vulnerabilities **Requirements**: Zero high or critical vulnerabilities

#### `npm run security:headers`

**Command**: `./scripts/validate-security-headers.sh` **Purpose**: Validate
security headers configuration **Checks**: CSP, HSTS, X-Frame-Options, etc.

---

### 6. Performance Scripts

#### `npm run verify:performance`

**Command**:

```json
"npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --preset=desktop --output=json --output-path=./reports/lighthouse-performance.json'"
```

**Purpose**: Lighthouse performance testing with server lifecycle management
**Threshold**: Score ≥ 90 **Output**: Reports saved to `./reports/` directory
**Requires**: lighthouse and start-server-and-test as devDependencies

#### `npm run verify:accessibility`

**Command**:

```json
"npm run build && start-server-and-test preview http://localhost:4173 'lighthouse http://localhost:4173 --only-categories=accessibility --output=json --output-path=./reports/lighthouse-accessibility.json'"
```

**Purpose**: Lighthouse accessibility testing with server lifecycle management
**Threshold**: Score ≥ 90 **Output**: Reports saved to `./reports/` directory
**Requires**: lighthouse and start-server-and-test as devDependencies

#### `npm run verify:bundle`

**Command**: `npm run perf:budget` **Purpose**: Enforce bundle size limits (not
just visualization) **Configuration**: `bundlesize.config.json`
**Implementation**: Uses bundlesize devDependency for consistent enforcement

#### `npm run perf:budget`

**Command**: `npm run build && bundlesize --enable-github-checks` **Purpose**:
Enforce bundle size budgets (using local devDependency, NOT npx) **Limits**: As
defined in bundlesize.config.json **Note**: Requires bundlesize installed as
devDependency for CI reliability

#### `npm run build:analyze`

**Command**: `ANALYZE=true npm run build` **Purpose**: Visualize bundle
composition **Output**: Bundle analysis HTML report

---

### 7. Phase-Specific Scripts (Complete Implementation)

#### Phase 1: Authentication (Current - 95% Coverage Required)

```json
{
  "scaffold:phase1": "echo 'See docs/implementation/phases/phase-1-login-tdd/PHASE_1_FORM_TEST_SPECIFICATIONS.md'",
  "test:phase1": "vitest run src/features/auth/**/__tests__/*.test.{ts,tsx}",
  "test:phase1:coverage": "vitest run --coverage src/features/auth/**/__tests__/*.test.{ts,tsx}",
  "test:phase1:watch": "vitest watch src/features/auth/**/__tests__/*.test.{ts,tsx}"
}

// Note: 95% coverage threshold for auth is enforced via scripts/check-coverage.js, NOT in vitest.config.ts
```

**Phase 1 Coverage Requirements**:

- **Lines**: 95% (business critical authentication)
- **Functions**: 95% (all auth flows must be tested)
- **Branches**: 90% (error handling coverage)
- **Statements**: 95% (comprehensive validation)

**Key Test Scenarios**:

- Login form validation and submission
- Password reset flow with email verification
- Registration with field validation
- JWT token handling and storage
- Session management and timeout
- Security headers and CORS validation

#### Phase 2: Dashboard (Planned - 90% Coverage)

```json
{
  "scaffold:phase2": "echo 'Phase 2: Dashboard - See docs/implementation/phases/phase-2-dashboard-tdd/README.md' && npm run scaffold:phase2:dirs",
  "scaffold:phase2:dirs": "mkdir -p src/features/dashboard/{components,hooks,stores,types,__tests__} && touch src/features/dashboard/__tests__/.gitkeep",
  "test:phase2": "vitest run src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
  "test:phase2:coverage": "vitest run --coverage src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
  "test:phase2:watch": "vitest watch src/features/dashboard/**/__tests__/*.test.{ts,tsx}"
}
```

#### Phase 3: Booking System (Planned - 95% Coverage)

```json
{
  "scaffold:phase3": "echo 'Phase 3: Booking - See docs/implementation/phases/phase-3-booking-tdd/README.md' && npm run scaffold:phase3:dirs",
  "scaffold:phase3:dirs": "mkdir -p src/features/booking/{components,hooks,stores,types,__tests__} && touch src/features/booking/__tests__/.gitkeep",
  "test:phase3": "vitest run src/features/booking/**/__tests__/*.test.{ts,tsx}",
  "test:phase3:coverage": "vitest run --coverage src/features/booking/**/__tests__/*.test.{ts,tsx}",
  "test:phase3:watch": "vitest watch src/features/booking/**/__tests__/*.test.{ts,tsx}"
}
```

#### Phase 4: Financial Management (Planned - 95% Coverage)

```json
{
  "scaffold:phase4": "echo 'Phase 4: Financial - See docs/implementation/phases/phase-4-financial-tdd/README.md' && npm run scaffold:phase4:dirs",
  "scaffold:phase4:dirs": "mkdir -p src/features/financial/{components,hooks,stores,types,__tests__} && touch src/features/financial/__tests__/.gitkeep",
  "test:phase4": "vitest run src/features/financial/**/__tests__/*.test.{ts,tsx}",
  "test:phase4:coverage": "vitest run --coverage src/features/financial/**/__tests__/*.test.{ts,tsx}",
  "test:phase4:watch": "vitest watch src/features/financial/**/__tests__/*.test.{ts,tsx}"
}
```

#### Phase 5: Deployment (Planned - 85% Coverage)

```json
{
  "scaffold:phase5": "echo 'Phase 5: Deployment - See docs/implementation/phases/phase-5-deployment/README.md' && npm run scaffold:phase5:dirs",
  "scaffold:phase5:dirs": "mkdir -p src/features/deployment/{components,utils,__tests__} tests/e2e/deployment && touch src/features/deployment/__tests__/.gitkeep tests/e2e/deployment/.gitkeep",
  "test:phase5": "vitest run src/features/deployment/**/__tests__/*.test.{ts,tsx} && playwright test tests/e2e/deployment",
  "test:phase5:coverage": "vitest run --coverage src/features/deployment/**/__tests__/*.test.{ts,tsx}",
  "test:phase5:watch": "vitest watch src/features/deployment/**/__tests__/*.test.{ts,tsx}"
}
```

#### Phase Matrix Testing in CI

```yaml
# CI Matrix Strategy for Phase Testing
strategy:
  matrix:
    phase: [phase1, phase2, phase3, phase4, phase5]
    include:
      - phase: phase1
        coverage_threshold: 95
        critical: true
        features: "auth"
      - phase: phase2
        coverage_threshold: 90
        critical: false
        features: "dashboard"
      - phase: phase3
        coverage_threshold: 95
        critical: true
        features: "booking"
      - phase: phase4
        coverage_threshold: 95
        critical: true
        features: "financial"
      - phase: phase5
        coverage_threshold: 85
        critical: false
        features: "deployment"
fail-fast: false # Continue testing other phases even if one fails

steps:
  - name: Run ${{ matrix.phase }} tests
    run: |
      npm run test:${{ matrix.phase }}:coverage

  - name: Validate coverage threshold
    run: |
      # Extract coverage from coverage-summary.json (see CI Coverage Calculation section below)
      coverage_actual=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")
      if [ "${{ matrix.critical }}" = "true" ] && [ "$coverage_actual" -lt "${{ matrix.coverage_threshold }}" ]; then
        echo "❌ Critical phase ${{ matrix.phase }} below ${{ matrix.coverage_threshold }}% threshold"
        exit 1
      fi
```

#### CI Coverage Calculation Methods

**Purpose**: Extract and validate coverage percentages in CI pipelines

**Method 1: Using Node.js (Recommended)**

```bash
# Extract line coverage percentage
coverage_actual=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")

# Extract branch coverage percentage
branch_coverage=$(node -e "console.log(require('./coverage/coverage-summary.json').total.branches.pct)")

# Extract function coverage percentage
function_coverage=$(node -e "console.log(require('./coverage/coverage-summary.json').total.functions.pct)")

# Extract statement coverage percentage
statement_coverage=$(node -e "console.log(require('./coverage/coverage-summary.json').total.statements.pct)")
```

**Method 2: Using jq (Alternative)**

```bash
# Requires jq to be installed in CI environment
coverage_actual=$(jq '.total.lines.pct' coverage/coverage-summary.json)
branch_coverage=$(jq '.total.branches.pct' coverage/coverage-summary.json)
function_coverage=$(jq '.total.functions.pct' coverage/coverage-summary.json)
statement_coverage=$(jq '.total.statements.pct' coverage/coverage-summary.json)
```

**Method 3: Using Vitest JSON Reporter**

```bash
# Configure vitest to output JSON summary
vitest run --coverage --reporter=json --outputFile=coverage-report.json

# Parse the JSON output
coverage_actual=$(node -e "
  const report = require('./coverage-report.json');
  const coverage = report.coverageMap.getCoverageSummary();
  console.log(coverage.lines.pct);
")
```

**Coverage Threshold Enforcement Script**

```bash
#!/bin/bash
# check-coverage.sh - Complete coverage validation script

# Run tests with coverage
npm run test:coverage

# Extract all coverage metrics
lines=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")
branches=$(node -e "console.log(require('./coverage/coverage-summary.json').total.branches.pct)")
functions=$(node -e "console.log(require('./coverage/coverage-summary.json').total.functions.pct)")
statements=$(node -e "console.log(require('./coverage/coverage-summary.json').total.statements.pct)")

# Define thresholds
THRESHOLD=90
CRITICAL_THRESHOLD=95

# Check against thresholds
if (( $(echo "$lines < $THRESHOLD" | bc -l) )); then
  echo "❌ Line coverage $lines% is below threshold $THRESHOLD%"
  exit 1
fi

if (( $(echo "$branches < $THRESHOLD" | bc -l) )); then
  echo "❌ Branch coverage $branches% is below threshold $THRESHOLD%"
  exit 1
fi

echo "✅ Coverage passed: Lines: $lines%, Branches: $branches%, Functions: $functions%, Statements: $statements%"
```

**GitHub Actions Integration**

```yaml
- name: Calculate and validate coverage
  run: |
    # Generate coverage report
    npm run test:coverage

    # Extract coverage percentages
    export COVERAGE_LINES=$(node -e "console.log(require('./coverage/coverage-summary.json').total.lines.pct)")
    export COVERAGE_BRANCHES=$(node -e "console.log(require('./coverage/coverage-summary.json').total.branches.pct)")
    export COVERAGE_FUNCTIONS=$(node -e "console.log(require('./coverage/coverage-summary.json').total.functions.pct)")
    export COVERAGE_STATEMENTS=$(node -e "console.log(require('./coverage/coverage-summary.json').total.statements.pct)")

    # Output for visibility
    echo "Coverage Results:"
    echo "  Lines: $COVERAGE_LINES%"
    echo "  Branches: $COVERAGE_BRANCHES%"
    echo "  Functions: $COVERAGE_FUNCTIONS%"
    echo "  Statements: $COVERAGE_STATEMENTS%"

    # Validate against thresholds
    node -e "
      const lines = $COVERAGE_LINES;
      const branches = $COVERAGE_BRANCHES;
      const threshold = 90;
      
      if (lines < threshold || branches < threshold) {
        console.error('Coverage below threshold');
        process.exit(1);
      }
      console.log('Coverage validation passed');
    "
```

---

### 8. JWT Security Scripts (CRITICAL)

#### `npm run verify:jwt`

**Command**:
`vitest run src/__tests__/security/jwt.security.test.ts --reporter=verbose && npm run security:jwt:full`
**Purpose**: Run JWT security tests and then the full JWT audit suite
**Critical**: Must pass for security compliance

#### `npm run audit:jwt:cookies`

**Command**:
`bash -c "! grep -r 'document\\.cookie' src/ api/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' | grep -iE '(token|jwt|auth|bearer|session)' || (echo '✅ No JWT cookie usage detected' && exit 0)"`
**Purpose**: Verify JWT tokens are never stored in cookies **Requirement**: Zero
instances allowed

#### `npm run audit:jwt:storage`

**Command**:
`bash -c "! grep -r 'localStorage.*token\\|localStorage.*jwt\\|localStorage.*auth' src/ --include='*.ts' --include='*.tsx' --exclude-dir='__tests__' --exclude='*.test.ts' --exclude='*.test.tsx' && echo '✅ No localStorage token usage detected (secure memory-only storage)' || (echo '❌ ERROR: localStorage token usage detected - security violation! Tokens must be stored in memory only' && exit 1)"`
**Purpose**: Verify JWT tokens are stored in memory only (NO localStorage, NO
cookies) **Requirement**: Zero instances of localStorage token storage allowed -
must use SecureTokenManager for memory-only storage

#### `npm run audit:jwt:headers`

**Command**:
`bash -c "grep -r 'Authorization.*Bearer' src/ api/ --include='*.ts' --include='*.tsx' && echo '✅ Authorization Bearer headers detected' || (echo '⚠️ WARNING: No Authorization Bearer headers found' && exit 1)"`
**Purpose**: Verify Authorization Bearer pattern is used **Requirement**: Must
find Bearer header usage

#### `npm run audit:jwt:no-cookies`

**Command**:
`bash -c "! grep -rE '(Set-Cookie|withCredentials|credentials:\\s*[\\"'\`]include)'
src/ api/ --include='_.ts' --include='_.tsx' | grep -iE '(token|jwt|auth)' ||
(echo '✅ No cookie-based auth patterns' && exit 0)"` **Purpose**: Verify no
cookie-based auth patterns exist **Requirement**: Zero instances allowed

#### `npm run security:jwt:full`

**Command**:
`npm run verify:jwt && npm run audit:jwt:storage && npm run audit:jwt:headers && npm run audit:jwt:no-cookies`
**Purpose**: Complete JWT security verification suite **Use Case**: Pre-push and
CI security gates

#### Composite Phase Scripts

```json
{
  "scaffold:all-phases": "npm run scaffold:phase2:dirs && npm run scaffold:phase3:dirs && npm run scaffold:phase4:dirs && npm run scaffold:phase5:dirs",
  "test:all-phases": "npm run test:phase1 && npm run test:phase2 && npm run test:phase3 && npm run test:phase4 && npm run test:phase5",
  "test:all-phases:coverage": "vitest run --coverage src/features/**/__tests__/*.test.{ts,tsx}"
}
```

---

### 9. Database Scripts

#### `npm run test:db`

**Command**: `vitest tests/db` **Purpose**: Run database-specific tests
**Coverage**: Connection, isolation, performance, schema

#### `npm run test:db:isolation`

**Command**: `vitest tests/db/isolation.test.ts` **Purpose**: Test multi-tenant
data isolation **Critical**: Must pass for security compliance

---

### 9. E2E Testing Scripts

#### `npm run test:e2e`

**Command**: `playwright test` **Purpose**: End-to-end testing
**Configuration**: `playwright.config.ts`

#### `npm run test:runtime-errors`

**Command**: `playwright test runtime-errors.spec.ts` **Purpose**: Test error
handling in production-like environment **Use Case**: Validate error boundaries
and recovery

---

### 10. Composite Verification Scripts

#### `npm run verify:push` (Critical Implementation Required)

**Purpose**: Comprehensive pre-push validation ensuring local-CI parity
**Complete Implementation**:

```json
{
  "scripts": {
    "verify:push": "npm run verify:all && npm run verify:bundle && npm run verify:performance && npm run verify:accessibility"
  }
}
```

**Script Execution Order & Dependencies**:

1. **verify:all** (Sequential execution - ~90 seconds)
   - verify:tests (45s) → verify:types (15s) → verify:lint (10s) →
     verify:security (20s)
2. **verify:bundle** (Parallel after build - ~30 seconds)
   - Requires successful build from verify:tests
3. **verify:performance** (Server lifecycle managed - ~45 seconds)
   - Requires build artifacts from previous steps
4. **verify:accessibility** (Server lifecycle managed - ~30 seconds)
   - Can run in parallel with verify:performance

**Total Execution Time**: < 3 minutes (optimized with caching) **Use Case**: Run
before pushing to ensure all quality gates pass locally

**Pre-push Hook Integration**:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🚀 Running comprehensive pre-push verification..."

# Export deterministic environment
export FIXED_TIME="2024-01-01T00:00:00Z"
export RANDOM_SEED="test-seed-local"
export TEST_SCENARIO="STABLE"
export MOCK_DELAY="0"
export TZ="Asia/Manila"
export VITEST_DETERMINISTIC="true"

# Run comprehensive verification with timing
start_time=$(date +%s)
npm run verify:push || {
  echo "❌ Pre-push verification failed"
  echo "Please fix issues before pushing"
  exit 1
}
end_time=$(date +%s)
execution_time=$((end_time - start_time))

echo "✅ All pre-push verifications passed in ${execution_time}s"
```

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

## Script Dependency Graph

### Visual Dependency Representation

```
verify:push (Root)
├── verify:all (Sequential Chain - Critical Path)
│   ├── verify:tests (Base requirement - 45s)
│   ├── verify:types (Independent - 15s)
│   ├── verify:lint (Independent - 10s)
│   └── verify:security (Independent - 20s)
├── verify:bundle (Depends on build artifacts - 30s)
│   └── perf:budget (Bundle size enforcement)
├── verify:performance (Server lifecycle - 45s)
│   ├── build (Required dependency)
│   └── start-server-and-test + lighthouse
└── verify:accessibility (Server lifecycle - 30s)
    ├── build (Shared dependency)
    └── start-server-and-test + lighthouse
```

### Critical Path Analysis

**Longest Path**: verify:tests → build → verify:performance **Optimization
Opportunities**:

1. **Parallel execution** of verify:types, verify:lint, verify:security after
   verify:tests
2. **Shared build artifacts** between verify:bundle and verify:performance
3. **Concurrent server management** for performance and accessibility tests
4. **Cache reuse** of node_modules and build outputs

**Performance Targets by Script**: | Script | Target Time | Optimization
Strategy | |--------|-------------|----------------------| | verify:tests | <
45s | Parallel test execution, coverage caching | | verify:types | < 15s |
Incremental type checking | | verify:lint | < 10s | ESLint cache, focused file
scanning | | verify:security | < 20s | Audit cache, dependency tree optimization
| | verify:bundle | < 30s | Build cache reuse, gzip compression | |
verify:performance | < 45s | Lighthouse cache, desktop preset | |
verify:accessibility | < 30s | Shared server instance |

---

## Required Dependencies & Configuration

### Critical Dependencies Status

```bash
# Install missing dependencies with exact versions for CI parity
npm install --save-dev --save-exact start-server-and-test@2.0.13 bundlesize@0.18.2 lighthouse@12.8.2 jest-axe@10.0.0 axe-core@4.10.3 @types/jest-axe@3.5.9
```

### Local-CI Parity Requirements

#### Tool Version Locking

```json
// package.json - Exact versions for CI parity (aligned with current package.json)
{
  "devDependencies": {
    "start-server-and-test": "2.0.13",
    "lighthouse": "12.8.2",
    "bundlesize": "0.18.2",
    "jest-axe": "10.0.0",
    "axe-core": "4.10.3",
    "@types/jest-axe": "3.5.9"
  },
  "engines": {
    "node": "20.x",
    "npm": ">=10.0.0"
  }
}
```

#### Environment Variable Alignment

```bash
# .env.test (Local development)
FIXED_TIME="2024-01-01T00:00:00Z"
RANDOM_SEED="test-seed-2024"
TEST_SCENARIO="STABLE"
MOCK_DELAY="0"
TZ="Asia/Manila"
VITEST_DETERMINISTIC="true"
TEST_TIMEOUT="30000"

# CI Environment (must match exactly)
env:
  FIXED_TIME: "2024-01-01T00:00:00Z"
  RANDOM_SEED: "test-seed-2024"
  TEST_SCENARIO: "STABLE"
  MOCK_DELAY: "0"
  TZ: "Asia/Manila"
  VITEST_DETERMINISTIC: "true"
  TEST_TIMEOUT: "30000"
```

#### Cache Strategy Configuration

```bash
# Local cache directories (should match CI)
.vite/
.eslintcache
node_modules/.cache/
coverage/
dist/
lighthouse-*.json

# Verification commands for parity
# Check if start-server-and-test is installed
npm list start-server-and-test

# Verify bundlesize configuration exists
test -f bundlesize.config.json && echo "✅ Bundlesize configured" || echo "❌ Missing config"

# Validate environment parity
echo "Local: $FIXED_TIME" && echo "Expected: 2024-01-01T00:00:00Z"

# Test deterministic behavior locally
FIXED_TIME="2024-01-01T00:00:00Z" npm run test:coverage:quick
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
{
  "scripts": {
    "verify:bundle": "npm run perf:budget"
  }
}
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

### GitHub Actions Usage (Complete Implementation)

```yaml
- name: Run Verification Suite with Performance Tracking
  env:
    # Deterministic environment (matches local)
    FIXED_TIME: "2024-01-01T00:00:00Z"
    RANDOM_SEED: "test-seed-2024"
    TEST_SCENARIO: "STABLE"
    MOCK_DELAY: "0"
    TZ: "Asia/Manila"
    VITEST_DETERMINISTIC: "true"
    # Performance budgets
    MAX_BUNDLE_SIZE_KB: "150"
    LIGHTHOUSE_SCORE_THRESHOLD: "90"
  run: |
    # Track execution time for optimization
    start_time=$(date +%s)

    echo "=== Comprehensive Verification Suite ==="

    # Phase 1: Core verification (sequential for dependencies)
    npm run verify:tests || exit 1

    # Phase 2: Independent checks (can run in parallel)
    npm run verify:types & pid1=$!
    npm run verify:lint & pid2=$!
    npm run verify:security & pid3=$!
    wait $pid1 $pid2 $pid3 || exit 1

    # Phase 3: Build-dependent checks
    npm run verify:bundle || exit 1

    # Phase 4: Performance validation (server lifecycle managed)
    npm run verify:performance & pid4=$!
    npm run verify:accessibility & pid5=$!
    wait $pid4 $pid5 || exit 1

    end_time=$(date +%s)
    execution_time=$((end_time - start_time))
    echo "✅ Complete verification suite passed in ${execution_time}s"

    # Log performance metrics
    echo "VERIFICATION_TIME=${execution_time}" >> $GITHUB_OUTPUT
```

### Performance Optimization for CI

```yaml
# Cache strategy for faster builds
- name: Cache dependencies and build outputs
  uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
      .vite
      .eslintcache
      coverage
    key:
      ${{ runner.os }}-verification-${{ hashFiles('package-lock.json') }}-${{
      hashFiles('src/**/*') }}
    restore-keys: |
      ${{ runner.os }}-verification-${{ hashFiles('package-lock.json') }}
      ${{ runner.os }}-verification-

# Parallel job strategy for maximum efficiency
- name: Parallel verification matrix
  strategy:
    matrix:
      verification-type:
        [tests, types, lint, security, performance, accessibility]
    fail-fast: false
  steps:
    - name: Run ${{ matrix.verification-type }} verification
      run: npm run verify:${{ matrix.verification-type }}
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

## Ready-for-RED Checklist (Phase 1)

Mark these done before officially starting Phase 1 RED:

- [ ] **Coverage Enforcement**: scripts/check-coverage.js handles path-specific
      thresholds (95% for auth)
- [ ] **Global Coverage**: vitest.config.ts includes global 90% thresholds only
- [ ] **Path Coverage Script**: verify:coverage:paths script configured to run
      scripts/check-coverage.js
- [ ] jest-axe integrated in src/test/setup.ts (expect.extend with
      toHaveNoViolations)
- [ ] **DevDependencies installed with exact versions**: lighthouse@12.8.2,
      bundlesize@0.18.2, jest-axe@10.0.0, axe-core@4.10.3,
      @types/jest-axe@3.5.9, start-server-and-test@2.0.13
- [ ] JWT security test skeleton present:
      src/**tests**/security/jwt.security.test.ts (see Security Verification
      Scripts doc)
- [ ] JWT security scripts added to package.json (verify:jwt, audit:jwt:cookies,
      audit:jwt:storage, audit:jwt:headers, security:jwt:full)
- [ ] verify:push composite script added to package.json
- [ ] Optional: scripts/audit-jwt-cookies.sh created and executable

**CRITICAL**: Coverage enforcement is NOT handled in vitest.config.ts for
path-specific thresholds. Use scripts/check-coverage.js via npm run
verify:coverage:paths.

## Validation Commands (Run in Order)

1. Install missing devDependencies with exact versions

```bash
npm i -D --save-exact lighthouse@12.8.2 bundlesize@0.18.2 jest-axe@10.0.0 axe-core@4.10.3 @types/jest-axe@3.5.9 start-server-and-test@2.0.13
```

2. Verify deterministic setup

```bash
grep "2024-01-01" src/test/setup.ts && echo "✅ Time constant aligned" || echo "⚠️ Update time constant"
```

3. Run Phase 1 tests (expect RED initially)

```bash
npm run test:phase1
```

4. Verify coverage thresholds (should require 95% for auth via custom script)

```bash
npm run test:phase1:coverage
npm run verify:coverage:paths  # This enforces 95% for auth via scripts/check-coverage.js
```

5. Run verification suite

```bash
npm run verify:all
npm run verify:bundle
npm run verify:performance
```

6. Run JWT security verification

```bash
npm run verify:jwt
npm run security:jwt:full
```

7. Composite pre-push verification

```bash
npm run verify:push
```

---

## Related Documentation

- **[Composite Scripts Guide](./COMPOSITE_SCRIPTS_GUIDE.md)** - Multi-phase
  script orchestration patterns
- **[Scaffold Scripts Reference](./SCAFFOLD_SCRIPTS_REFERENCE.md)** -
  Phase-specific scaffolding scripts
- **[CI/CD Pipeline Guide](./CI_CD_PIPELINE_GUIDE.md)** - Complete CI/CD
  configuration

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
