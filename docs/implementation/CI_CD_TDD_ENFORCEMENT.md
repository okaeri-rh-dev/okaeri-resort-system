# CI/CD TDD Enforcement Guide

## Overview

This document defines the CI/CD requirements for enforcing Test-Driven
Development (TDD) practices in the Okaeri Resort Management System. It addresses
critical issues with deterministic testing environments and provides
comprehensive GitHub Actions workflow configurations.

## Critical Issues Addressed

### Issue 2: CI Lacks Deterministic Environment

**Problem**: The current CI configuration (`.github/workflows/ci.yml`) is
missing critical environment variables required for deterministic testing,
leading to flaky builds and non-reproducible test results.

**Missing Variables**:

- `FIXED_TIME`: For date/time dependent tests
- `RANDOM_SEED`: For consistent random data generation
- `TEST_SCENARIO`: For test environment configuration
- `MOCK_DELAY`: For API response timing consistency
- `TZ`: For timezone-dependent operations

**Impact**: Tests may pass locally but fail in CI, or vice versa, due to
environmental differences.

## Required Environment Variables

### Deterministic Testing Environment

All CI jobs must include these environment variables:

```yaml
env:
  # Core deterministic variables
  NODE_VERSION: "20"
  FIXED_TIME: "2024-01-01T00:00:00Z"
  RANDOM_SEED: "test-seed-2024"
  TEST_SCENARIO: "STABLE"
  MOCK_DELAY: "0"
  TZ: "Asia/Manila"

  # Test configuration
  NODE_ENV: "test"
  VITE_USE_MOCK_API: "true"
  VITEST_DETERMINISTIC: "true"
  TEST_TIMEOUT: "30000"

  # Performance budgets
  MAX_BUNDLE_SIZE_KB: "150"
  MAX_VENDOR_SIZE_KB: "200"
  MAX_CSS_SIZE_KB: "50"
  LIGHTHOUSE_SCORE_THRESHOLD: "90"
```

### Environment Variable Purposes

| Variable               | Purpose                        | Example Value            | Impact if Missing                           |
| ---------------------- | ------------------------------ | ------------------------ | ------------------------------------------- |
| `FIXED_TIME`           | Consistent timestamps in tests | `"2024-01-01T00:00:00Z"` | Date-dependent tests become flaky           |
| `RANDOM_SEED`          | Reproducible random data       | `"test-seed-2024"`       | Random test data varies between runs        |
| `TEST_SCENARIO`        | Test environment mode          | `"STABLE"`               | Different test behaviors in CI vs local     |
| `MOCK_DELAY`           | API response timing            | `"0"`                    | Timeout issues in fast CI environment       |
| `TZ`                   | Timezone consistency           | `"Asia/Manila"`          | Timezone-dependent operations fail          |
| `VITEST_DETERMINISTIC` | Enable deterministic mode      | `"true"`                 | Test runner uses non-deterministic features |

## GitHub Actions Workflow Configuration

### Complete CI Workflow

Create or update `.github/workflows/ci.yml`:

```yaml
name: Deterministic CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      environment:
        description: "Target deployment environment"
        required: true
        default: "preview"
        type: choice
        options:
          - preview
          - staging
          - production

# Optimize for free tier usage
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  # Deterministic testing environment
  NODE_VERSION: "20"
  FIXED_TIME: "2024-01-01T00:00:00Z"
  RANDOM_SEED: "test-seed-2024"
  TEST_SCENARIO: "STABLE"
  MOCK_DELAY: "0"
  TZ: "Asia/Manila"

  # Test configuration
  NODE_ENV: "test"
  VITE_USE_MOCK_API: "true"
  VITEST_DETERMINISTIC: "true"
  TEST_TIMEOUT: "30000"

  # Performance budgets
  MAX_BUNDLE_SIZE_KB: "150"
  MAX_VENDOR_SIZE_KB: "200"
  MAX_CSS_SIZE_KB: "50"
  LIGHTHOUSE_SCORE_THRESHOLD: "90"

jobs:
  # ==========================================
  # PHASE 1: Quality Gates & TDD Enforcement
  # ==========================================

  tdd-quality-gates:
    name: TDD Quality Gates
    runs-on: ubuntu-latest
    outputs:
      should-deploy: ${{ steps.deploy-decision.outputs.should-deploy }}
      environment: ${{ steps.deploy-decision.outputs.environment }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js with caching
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
          cache-dependency-path: package-lock.json

      - name: Install dependencies with retry
        run: |
          npm ci --prefer-offline --no-audit --progress=false || \
          npm ci --prefer-offline --no-audit --progress=false || \
          npm ci --no-audit --progress=false

      - name: Validate deterministic environment
        run: |
          echo "=== Deterministic Environment Validation ==="
          echo "FIXED_TIME: ${{ env.FIXED_TIME }}"
          echo "RANDOM_SEED: ${{ env.RANDOM_SEED }}"
          echo "TEST_SCENARIO: ${{ env.TEST_SCENARIO }}"
          echo "MOCK_DELAY: ${{ env.MOCK_DELAY }}"
          echo "TZ: ${{ env.TZ }}"
          echo "VITEST_DETERMINISTIC: ${{ env.VITEST_DETERMINISTIC }}"

          # Verify all required variables are set
          [ -n "${{ env.FIXED_TIME }}" ] || { echo "❌ FIXED_TIME not set"; exit 1; }
          [ -n "${{ env.RANDOM_SEED }}" ] || { echo "❌ RANDOM_SEED not set"; exit 1; }
          [ -n "${{ env.TEST_SCENARIO }}" ] || { echo "❌ TEST_SCENARIO not set"; exit 1; }
          [ -n "${{ env.MOCK_DELAY }}" ] || { echo "❌ MOCK_DELAY not set"; exit 1; }
          [ -n "${{ env.TZ }}" ] || { echo "❌ TZ not set"; exit 1; }

          echo "✅ All deterministic environment variables are set"

      # TDD Gate 1: Code Quality
      - name: TypeScript type checking (RED-GREEN-REFACTOR Gate)
        run: npm run type-check

      - name: ESLint with zero warnings (Code Quality Gate)
        run: npm run lint -- --max-warnings 0

      - name: Code formatting validation (Consistency Gate)
        run: npm run format:check

      # TDD Gate 2: Security
      - name: Security audit (Security Gate)
        run: |
          npm audit --audit-level=high --omit=dev || {
            echo "❌ High-severity vulnerabilities found"
            npm audit --audit-level=high --omit=dev
            exit 1
          }

      - name: Determine deployment environment
        id: deploy-decision
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "environment=${{ github.event.inputs.environment }}" >> $GITHUB_OUTPUT
            echo "should-deploy=true" >> $GITHUB_OUTPUT
          elif [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "should-deploy=true" >> $GITHUB_OUTPUT
          elif [ "${{ github.ref }}" = "refs/heads/develop" ]; then
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "should-deploy=true" >> $GITHUB_OUTPUT
          else
            echo "environment=preview" >> $GITHUB_OUTPUT
            echo "should-deploy=false" >> $GITHUB_OUTPUT
          fi

  # ==========================================
  # PHASE 2: Deterministic Test Matrix
  # ==========================================

  deterministic-test-matrix:
    name: Deterministic Tests (${{ matrix.test-suite }})
    runs-on: ubuntu-latest
    needs: tdd-quality-gates

    strategy:
      matrix:
        test-suite: [unit, integration, security, e2e]
      fail-fast: false

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci --prefer-offline --no-audit --progress=false

      - name: Setup deterministic test environment
        run: |
          # Create deterministic test configuration
          echo "Setting up deterministic test environment for ${{ matrix.test-suite }}"

          # Environment validation
          echo "NODE_ENV=test" >> $GITHUB_ENV
          echo "VITE_USE_MOCK_API=true" >> $GITHUB_ENV
          echo "VITEST_DETERMINISTIC=true" >> $GITHUB_ENV
          echo "TEST_SCENARIO=STABLE" >> $GITHUB_ENV

          # Create test environment file
          cat > .env.test << EOF
          NODE_ENV=test
          VITE_USE_MOCK_API=true
          VITEST_DETERMINISTIC=true
          TEST_TIMEOUT=30000
          FIXED_TIME=${{ env.FIXED_TIME }}
          RANDOM_SEED=${{ env.RANDOM_SEED }}-${{ matrix.test-suite }}
          TEST_SCENARIO=${{ env.TEST_SCENARIO }}
          MOCK_DELAY=${{ env.MOCK_DELAY }}
          TZ=${{ env.TZ }}
          EOF

          echo "✅ Deterministic test environment configured for ${{ matrix.test-suite }}"

      - name:
          Run ${{ matrix.test-suite }} tests with deterministic configuration
        run: |
          # Set deterministic environment
          export NODE_ENV=test
          export VITEST_DETERMINISTIC=true
          export TEST_SCENARIO=STABLE
          export FIXED_TIME="${{ env.FIXED_TIME }}"
          export RANDOM_SEED="${{ env.RANDOM_SEED }}-${{ matrix.test-suite }}"
          export MOCK_DELAY="${{ env.MOCK_DELAY }}"
          export TZ="${{ env.TZ }}"

          case "${{ matrix.test-suite }}" in
            "unit")
              echo "Running unit tests with coverage..."
              npm run test:coverage -- \
                --reporter=json \
                --outputFile=coverage-${{ matrix.test-suite }}.json \
                --run \
                --passWithNoTests \
                --testTimeout=30000 \
                --teardownTimeout=10000
              ;;
            "integration")
              echo "Running integration tests..."
              npm run test:db -- \
                --run \
                --reporter=json \
                --outputFile=test-results-${{ matrix.test-suite }}.json
              ;;
            "security")
              echo "Running security tests..."
              npm run verify:security
              ;;
            "e2e")
              echo "Running E2E tests with deterministic environment..."
              npm run test:e2e -- \
                --reporter=json \
                --outputFile=e2e-results-${{ matrix.test-suite }}.json
              ;;
          esac

      - name: Validate deterministic test results
        run: |
          echo "=== Test Results Validation ==="

          if [ "${{ matrix.test-suite }}" = "unit" ] && [ -f coverage-unit.json ]; then
            # Extract coverage metrics
            coverage_lines=$(cat coverage-unit.json | jq -r '.total.lines.percent // 0')
            coverage_functions=$(cat coverage-unit.json | jq -r '.total.functions.percent // 0')
            coverage_branches=$(cat coverage-unit.json | jq -r '.total.branches.percent // 0')
            
            echo "Coverage Results:"
            echo "  Lines: ${coverage_lines}%"
            echo "  Functions: ${coverage_functions}%"
            echo "  Branches: ${coverage_branches}%"
            
            # TDD Coverage Gates
            if (( $(echo "$coverage_lines < 90" | bc -l) )); then
              echo "❌ FAILED: Line coverage ${coverage_lines}% below 90% TDD requirement"
              exit 1
            fi
            
            if (( $(echo "$coverage_functions < 75" | bc -l) )); then
              echo "⚠️ WARNING: Function coverage ${coverage_functions}% below 75% target"
            fi
            
            echo "✅ TDD coverage requirements met"
          fi

          # Verify deterministic behavior
          echo "Deterministic test environment used:"
          echo "  FIXED_TIME: ${FIXED_TIME}"
          echo "  RANDOM_SEED: ${RANDOM_SEED}"
          echo "  TEST_SCENARIO: ${TEST_SCENARIO}"

      - name: Upload test artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-${{ matrix.test-suite }}-${{ github.run_id }}
          path: |
            coverage-*.json
            test-results-*.json
            e2e-results-*.json
            test-results/
          retention-days: 7

  # ==========================================
  # PHASE 3: Performance Validation with Server Lifecycle
  # ==========================================

  lighthouse-performance:
    name: Lighthouse Performance (Deterministic)
    runs-on: ubuntu-latest
    needs: [tdd-quality-gates, deterministic-test-matrix]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci --prefer-offline --no-audit --progress=false

      - name: Install start-server-and-test for server lifecycle management
        run: npm install --save-dev start-server-and-test

      - name: Build application (deterministic)
        run: |
          # Deterministic build
          export NODE_ENV=production
          export VITE_API_URL=/api
          export VITE_APP_VERSION=${{ github.sha }}

          npm run build
        env:
          NODE_ENV: production
          VITE_API_URL: /api
          VITE_APP_VERSION: ${{ github.sha }}

      - name: Run Lighthouse with server lifecycle management
        run: |
          echo "Running Lighthouse with automatic server management..."

          # Use start-server-and-test to handle server lifecycle
          npx start-server-and-test preview http://localhost:4173 'npx lighthouse http://localhost:4173 --preset=desktop --output=json --output-path=lighthouse-performance.json --chrome-flags="--headless --no-sandbox"'

          echo "✅ Lighthouse performance test completed with server lifecycle management"

      - name: Validate Lighthouse scores against TDD performance requirements
        run: |
          if [ -f lighthouse-performance.json ]; then
            performance_score=$(cat lighthouse-performance.json | jq -r '.categories.performance.score * 100')
            accessibility_score=$(cat lighthouse-performance.json | jq -r '.categories.accessibility.score * 100')
            
            echo "Lighthouse Scores:"
            echo "  Performance: ${performance_score}"
            echo "  Accessibility: ${accessibility_score}"
            
            # TDD Performance Gates
            if (( $(echo "$performance_score < ${{ env.LIGHTHOUSE_SCORE_THRESHOLD }}" | bc -l) )); then
              echo "❌ FAILED: Performance score ${performance_score} below ${{ env.LIGHTHOUSE_SCORE_THRESHOLD }} TDD requirement"
              exit 1
            fi
            
            echo "✅ TDD performance requirements met"
          else
            echo "❌ FAILED: lighthouse-performance.json not found"
            exit 1
          fi

      - name: Upload Lighthouse results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-results-${{ github.run_id }}
          path: |
            lighthouse-*.json
          retention-days: 7
```

## TDD Enforcement Gates

### Gate 1: Pre-commit Hooks

Configure `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 TDD Pre-commit validation..."

# Export deterministic environment
export FIXED_TIME="2024-01-01T00:00:00Z"
export RANDOM_SEED="test-seed-local"
export TEST_SCENARIO="STABLE"
export MOCK_DELAY="0"
export TZ="Asia/Manila"

# Quick TDD gates
npm run type-check || exit 1
npm run lint -- --max-warnings 0 || exit 1
npm run format:check || exit 1

echo "✅ Pre-commit TDD gates passed"
```

### Gate 2: Pre-push Hooks

Configure `.husky/pre-push`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🚀 TDD Pre-push validation..."

# Export deterministic environment
export FIXED_TIME="2024-01-01T00:00:00Z"
export RANDOM_SEED="test-seed-local"
export TEST_SCENARIO="STABLE"
export MOCK_DELAY="0"
export TZ="Asia/Manila"
export VITEST_DETERMINISTIC="true"

# Run tests on changed files only
npm run test:coverage:quick -- --changed || exit 1

echo "✅ Pre-push TDD gates passed"
```

### Gate 3: Pull Request Checks

Branch protection rules must require:

1. ✅ TDD Quality Gates job passes
2. ✅ All deterministic test matrix jobs pass
3. ✅ Lighthouse performance job passes
4. ✅ Bundle size within performance budgets
5. ✅ Code review approval from TDD-certified reviewer

### Gate 4: Merge Protection

Configure GitHub branch protection:

```yaml
# GitHub Settings > Branches > Branch protection rules
protection_rules:
  main:
    required_status_checks:
      strict: true
      checks:
        - "TDD Quality Gates"
        - "Deterministic Tests (unit)"
        - "Deterministic Tests (integration)"
        - "Deterministic Tests (security)"
        - "Deterministic Tests (e2e)"
        - "Lighthouse Performance (Deterministic)"
    enforce_admins: true
    required_pull_request_reviews:
      required_approving_review_count: 1
      dismiss_stale_reviews: true
    restrictions: null
```

## Environment-Specific Configuration

### Preview Environment

```yaml
environment:
  name: preview
  vars:
    VITE_API_URL: "https://api-preview.okaeri.dev"
    VITE_ENVIRONMENT: "preview"
```

### Staging Environment

```yaml
environment:
  name: staging
  vars:
    VITE_API_URL: "https://api-staging.okaeri.dev"
    VITE_ENVIRONMENT: "staging"
    # Staging uses same deterministic variables for consistency
    FIXED_TIME: "2024-01-01T00:00:00Z"
    RANDOM_SEED: "staging-seed-2024"
```

### Production Environment

```yaml
environment:
  name: production
  vars:
    VITE_API_URL: "https://api.okaeri.dev"
    VITE_ENVIRONMENT: "production"
    # Production may have different performance budgets
    MAX_BUNDLE_SIZE_KB: "120" # Stricter in production
```

## Vercel Deployment Configuration

### vercel.json Updates

```json
{
  "build": {
    "env": {
      "FIXED_TIME": "2024-01-01T00:00:00Z",
      "RANDOM_SEED": "vercel-build-seed",
      "TEST_SCENARIO": "STABLE",
      "MOCK_DELAY": "0",
      "TZ": "Asia/Manila"
    }
  },
  "env": {
    "NODE_VERSION": "20",
    "VITE_USE_MOCK_API": "false"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        }
      ]
    }
  ]
}
```

## Rollback Procedures

### Failed Quality Gates

1. **Automatic Actions**:
   - PR is blocked from merging
   - Slack notification sent to team
   - GitHub comment with failure details

2. **Manual Recovery**:

   ```bash
   # Fix locally
   npm run verify  # Run full verification suite

   # If deterministic issues
   export FIXED_TIME="2024-01-01T00:00:00Z"
   export RANDOM_SEED="test-seed-2024"
   export TEST_SCENARIO="STABLE"
   npm run test:coverage
   ```

### Bundle Size Exceeded

1. **Immediate Block**: PR cannot merge until resolved
2. **Analysis Required**:
   ```bash
   npm run build:analyze  # Check bundle composition
   npm run perf:budget    # Verify against budgets
   ```
3. **Optimization Required**: Developer must optimize or request exception

### Performance Regression

1. **Lighthouse Score Below Threshold**:
   - Automatic PR comment with performance impact
   - Bundle size analysis attachment
   - Performance recommendations

2. **Recovery Process**:
   ```bash
   # Local performance testing
   npm install --save-dev start-server-and-test
   npm run verify:performance  # Should match CI results
   ```

## Monitoring and Alerts

### GitHub Actions Notifications

Configure Slack/Discord webhooks for:

- ❌ Any deterministic test matrix failure
- ⚠️ Performance regression detected
- 🔒 Security audit failures
- 📦 Bundle size budget exceeded

### Metrics Tracking

Track these TDD enforcement metrics:

- Test coverage percentage over time
- Build success rate per branch
- Performance score trends
- Time to resolve failed gates

## Migration Checklist

### Phase 1: Environment Variables

- [ ] Add all deterministic environment variables to CI
- [ ] Update local `.env.test` files
- [ ] Verify variable consistency across environments

### Phase 2: Server Lifecycle Management

- [ ] Install `start-server-and-test` dependency
- [ ] Update Lighthouse scripts in package.json
- [ ] Test server lifecycle in CI

### Phase 3: Gate Enforcement

- [ ] Configure branch protection rules
- [ ] Set up pre-commit and pre-push hooks
- [ ] Test gate enforcement with intentional failures

### Phase 4: Monitoring

- [ ] Configure notification webhooks
- [ ] Set up metrics dashboard
- [ ] Document incident response procedures

## Conclusion

TDD enforcement through CI/CD requires deterministic testing environments,
proper server lifecycle management, and strict quality gates. This configuration
ensures that tests are reliable, performance is maintained, and code quality
standards are enforced automatically.
