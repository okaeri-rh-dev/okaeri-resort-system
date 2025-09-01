# Phase-Specific NPM Scripts Documentation

> **Purpose**: Complete documentation for TDD workflow scripts across all
> implementation phases **Status**: Documentation-only (scripts to be added to
> package.json) **Last Updated**: August 2025

---

## Overview

This document provides comprehensive documentation for the phase-specific NPM
scripts required for the Okaeri Resort Management System's Test-Driven
Development (TDD) workflow. These scripts enable developers to follow the
RED-GREEN-REFACTOR methodology systematically through each implementation phase.

## Complete Script Set for package.json

```json
{
  "scripts": {
    // ============================================
    // PHASE 1: Authentication & Login
    // ============================================
    "scaffold:phase1": "echo 'See docs/implementation/phases/phase-1-login-tdd/PHASE_1_RED_TEST_SKELETONS.md'",
    "test:phase1": "vitest run src/features/auth/**/__tests__/*.test.{ts,tsx}",
    "test:phase1:coverage": "vitest run --coverage src/features/auth/**/__tests__/*.test.{ts,tsx}",
    "test:phase1:watch": "vitest watch src/features/auth/**/__tests__/*.test.{ts,tsx}",

    // ============================================
    // PHASE 2: Dashboard & Navigation
    // ============================================
    "scaffold:phase2": "echo 'See docs/implementation/phases/phase-2-dashboard-tdd/README.md'",
    "test:phase2": "vitest run src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:coverage": "vitest run --coverage src/features/dashboard/**/__tests__/*.test.{ts,tsx}",
    "test:phase2:watch": "vitest watch src/features/dashboard/**/__tests__/*.test.{ts,tsx}",

    // ============================================
    // PHASE 3: Booking Management
    // ============================================
    "scaffold:phase3": "echo 'See docs/implementation/phases/phase-3-booking-tdd/README.md'",
    "test:phase3": "vitest run src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:coverage": "vitest run --coverage src/features/booking/**/__tests__/*.test.{ts,tsx}",
    "test:phase3:watch": "vitest watch src/features/booking/**/__tests__/*.test.{ts,tsx}",

    // ============================================
    // PHASE 4: Financial & Reporting
    // ============================================
    "scaffold:phase4": "echo 'See docs/implementation/phases/phase-4-financial-tdd/README.md'",
    "test:phase4": "vitest run src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:coverage": "vitest run --coverage src/features/financial/**/__tests__/*.test.{ts,tsx}",
    "test:phase4:watch": "vitest watch src/features/financial/**/__tests__/*.test.{ts,tsx}",

    // ============================================
    // PHASE 5: Deployment & E2E
    // ============================================
    "scaffold:phase5": "echo 'See docs/implementation/phases/phase-5-deployment/README.md'",
    "test:phase5": "vitest run tests/e2e/**/*.test.{ts,tsx}",
    "test:phase5:coverage": "vitest run --coverage tests/e2e/**/*.test.{ts,tsx}",
    "test:phase5:watch": "vitest watch tests/e2e/**/*.test.{ts,tsx}",

    // ============================================
    // COMBINED PHASE TESTING
    // ============================================
    "test:all-phases": "npm run test:phase1 && npm run test:phase2 && npm run test:phase3 && npm run test:phase4 && npm run test:phase5",
    "test:all-phases:coverage": "npm run test:phase1:coverage && npm run test:phase2:coverage && npm run test:phase3:coverage && npm run test:phase4:coverage && npm run test:phase5:coverage",
    "test:phases:1-3": "npm run test:phase1 && npm run test:phase2 && npm run test:phase3",
    "test:phases:4-5": "npm run test:phase4 && npm run test:phase5"
  }
}
```

## Phase Coverage Requirements

| Phase       | Feature Area           | Minimum Coverage | Critical Components                                        |
| ----------- | ---------------------- | ---------------- | ---------------------------------------------------------- |
| **Phase 1** | Authentication & Login | 95%              | JWT handling, session management, form validation          |
| **Phase 2** | Dashboard & Navigation | 90%              | Metrics display, real-time updates, role-based routing     |
| **Phase 3** | Booking Management     | 95%              | Availability logic, conflict detection, payment processing |
| **Phase 4** | Financial & Reporting  | 95%              | Tax calculations, receipt generation, BIR compliance       |
| **Phase 5** | Deployment & E2E       | 90%              | User journeys, performance testing, security verification  |

## TDD Workflow by Phase

### Phase 1: Authentication (Days 1-3)

```bash
# Day 1: RED Phase - Write all authentication tests
npm run scaffold:phase1           # Get test specifications
npm run test:phase1               # Verify tests fail (RED)

# Day 2: GREEN Phase - Implement authentication
npm run test:phase1:watch         # Watch mode for development
npm run test:phase1               # Verify tests pass (GREEN)

# Day 3: REFACTOR Phase - Optimize and polish
npm run test:phase1:coverage      # Ensure 95% coverage
npm run verify:security           # Security audit
```

### Phase 2: Dashboard (Days 4-6)

```bash
# Day 4: RED Phase - Write dashboard tests
npm run scaffold:phase2           # Get dashboard specifications
npm run test:phase2               # Verify tests fail (RED)

# Day 5: GREEN Phase - Implement dashboard
npm run test:phase2:watch         # Watch mode for development
npm run test:phases:1-2           # Ensure integration with auth

# Day 6: REFACTOR Phase - Performance optimization
npm run test:phase2:coverage      # Ensure 90% coverage
npm run verify:performance        # Check Core Web Vitals
```

### Phase 3: Booking (Days 7-10)

```bash
# Day 7-8: RED Phase - Write booking tests
npm run scaffold:phase3           # Get booking specifications
npm run test:phase3               # Verify tests fail (RED)

# Day 9: GREEN Phase - Implement booking system
npm run test:phase3:watch         # Watch mode for development
npm run test:phases:1-3           # Test full flow

# Day 10: REFACTOR Phase - Database optimization
npm run test:phase3:coverage      # Ensure 95% coverage
npm run test:db:performance       # Database query optimization
```

### Phase 4: Financial (Days 11-14)

```bash
# Day 11-12: RED Phase - Write financial tests
npm run scaffold:phase4           # Get financial specifications
npm run test:phase4               # Verify tests fail (RED)

# Day 13: GREEN Phase - Implement financial features
npm run test:phase4:watch         # Watch mode for development
npm run test:phases:3-4           # Ensure booking-financial integration

# Day 14: REFACTOR Phase - Calculation precision
npm run test:phase4:coverage      # Ensure 95% coverage
npm run test:tax:compliance       # BIR compliance verification
```

### Phase 5: Deployment (Days 15-17)

```bash
# Day 15: RED Phase - Write E2E tests
npm run scaffold:phase5           # Get E2E specifications
npm run test:phase5               # Verify tests fail (RED)

# Day 16: GREEN Phase - Deployment setup
npm run test:e2e                  # Run Playwright tests
npm run test:all-phases           # Full system verification

# Day 17: REFACTOR Phase - Production optimization
npm run test:phase5:coverage      # Ensure 90% coverage
npm run build && vercel --prod    # Deploy to production
```

## Directory Structure

```
src/
├── features/
│   ├── auth/
│   │   └── __tests__/           # Phase 1 tests
│   ├── dashboard/
│   │   └── __tests__/           # Phase 2 tests
│   ├── booking/
│   │   └── __tests__/           # Phase 3 tests
│   └── financial/
│       └── __tests__/           # Phase 4 tests
└── tests/
    └── e2e/                      # Phase 5 tests
```

## Common Issues and Solutions

### Test Discovery Issues

| Problem               | Solution                                       |
| --------------------- | ---------------------------------------------- |
| "No test files found" | Check glob pattern matches your file structure |
| "Cannot find module"  | Verify TypeScript paths are configured         |
| "Test timeout"        | Increase timeout for async operations          |
| "Coverage not met"    | Add tests for error cases and edge scenarios   |

### Phase-Specific Issues

#### Phase 1 (Authentication)

- **Issue**: JWT tests failing
- **Solution**: Ensure mock auth service returns proper token structure

#### Phase 2 (Dashboard)

- **Issue**: WebSocket connection errors
- **Solution**: Mock WebSocket in test environment

#### Phase 3 (Booking)

- **Issue**: Date/time inconsistencies
- **Solution**: Use fixed timestamps (2024-01-01T00:00:00Z)

#### Phase 4 (Financial)

- **Issue**: Calculation precision errors
- **Solution**: Use decimal.js for all money calculations

#### Phase 5 (Deployment)

- **Issue**: E2E tests fail in CI
- **Solution**: Ensure headless browser configuration

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Phase Testing

on: [push, pull_request]

jobs:
  test-phases:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        phase: [1, 2, 3, 4, 5]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Run Phase ${{ matrix.phase }} Tests
        run: npm run test:phase${{ matrix.phase }}:coverage

      - name: Check Coverage
        run: |
          if [ ${{ matrix.phase }} -eq 1 ] || [ ${{ matrix.phase }} -eq 3 ] || [ ${{ matrix.phase }} -eq 4 ]; then
            echo "Checking for 95% coverage..."
            # Add coverage threshold check
          else
            echo "Checking for 90% coverage..."
            # Add coverage threshold check
          fi
```

## Best Practices

### 1. Always Follow RED-GREEN-REFACTOR

```bash
# RED: Write failing tests first
npm run scaffold:phaseN
npm run test:phaseN              # Must see red (failing tests)

# GREEN: Write minimal code to pass
npm run test:phaseN:watch        # Develop until green

# REFACTOR: Improve without breaking tests
npm run test:phaseN:coverage     # Maintain coverage while refactoring
```

### 2. Phase Dependencies

- Phase 2 depends on Phase 1 (authentication)
- Phase 3 can run parallel to Phase 2
- Phase 4 depends on Phase 3 (booking data)
- Phase 5 depends on all previous phases

### 3. Coverage Enforcement

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
        // Phase-specific overrides
        "src/features/auth/**": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
```

### 4. Test Isolation

```javascript
// Always reset state between tests
beforeEach(() => {
  vi.clearAllMocks();
  // Reset Zustand stores
  useAuthStore.getState().reset();
  // Clear TanStack Query cache
  queryClient.clear();
});
```

## Verification Commands

```bash
# Quick health check
npm run test:all-phases          # All tests must pass

# Detailed verification
npm run verify:all               # Comprehensive quality checks

# Phase-specific verification
npm run test:phase1:coverage && npm run verify:security
npm run test:phase2:coverage && npm run verify:performance
npm run test:phase3:coverage && npm run test:db:performance
npm run test:phase4:coverage && npm run test:tax:compliance
npm run test:phase5:coverage && npm run test:e2e
```

## Migration Path

For teams currently without these scripts:

1. **Add scripts to package.json** (copy from this document)
2. **Create test directories** if missing
3. **Run scaffold commands** to get specifications
4. **Begin with Phase 1** and progress sequentially
5. **Enforce coverage thresholds** in CI/CD pipeline

## Support and Troubleshooting

For issues with phase-specific testing:

1. Check the phase README in `docs/implementation/phases/`
2. Verify test file locations match glob patterns
3. Ensure mock services are properly configured
4. Review TDD_SINGLE_SOURCE_OF_TRUTH.md for standards
5. Check CI/CD logs for detailed error messages

---

**Note**: This documentation is for reference only. The actual NPM scripts must
be added to package.json for the commands to work. Each phase has detailed
specifications in its respective documentation folder.
